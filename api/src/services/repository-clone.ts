/**
 * Repository Clone Service
 * Handles cloning repositories and storing archives in MinIO
 * @module services/repository-clone
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { mkdir, rm, stat, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import pino from 'pino';
import type { Repository } from '../adapters/git/interface.js';
import {
  uploadObject,
  buildRepoArchivePath,
  objectExists,
  getPresignedDownloadUrl,
} from './minio-client.js';
import { AppError } from '../middleware/error-handler.js';

const execAsync = promisify(exec);
const logger = pino({ name: 'repository-clone' });

/**
 * Clone result
 */
export interface CloneResult {
  /** MinIO object path */
  objectPath: string;
  /** Commit SHA that was cloned */
  commitSha: string;
  /** Size of the archive in bytes */
  archiveSize: number;
  /** Whether this was a cached result */
  cached: boolean;
}

/**
 * Clone options
 */
export interface CloneOptions {
  /** Clone depth (default: 1 for shallow clone) */
  depth?: number;
  /** Specific branch to clone */
  branch?: string;
  /** Force re-clone even if archive exists */
  force?: boolean;
}

/**
 * Maximum archive size (500MB)
 */
const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024;

/**
 * Clone timeout (5 minutes)
 */
const CLONE_TIMEOUT = 5 * 60 * 1000;

/**
 * Sanitize path component to prevent directory traversal
 */
function sanitizePath(input: string): string {
  return input.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Get the latest commit SHA from a cloned repository
 */
async function getCommitSha(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', {
      cwd: repoPath,
    });
    return stdout.trim();
  } catch (error) {
    logger.error({ error, repoPath }, 'Failed to get commit SHA');
    throw new AppError('Failed to get commit SHA', 500, 'GIT_ERROR');
  }
}

/**
 * Create tar.gz archive from directory
 */
async function createArchive(
  sourceDir: string,
  archivePath: string
): Promise<void> {
  try {
    // Remove .git directory before archiving to reduce size
    const gitDir = join(sourceDir, '.git');
    await rm(gitDir, { recursive: true, force: true });

    // Create tar.gz archive
    await execAsync(
      `tar -czf "${archivePath}" -C "${sourceDir}" .`,
      { timeout: CLONE_TIMEOUT }
    );

    // Verify archive was created and check size
    const stats = await stat(archivePath);
    if (stats.size > MAX_ARCHIVE_SIZE) {
      throw new AppError(
        `Archive size ${stats.size} exceeds maximum ${MAX_ARCHIVE_SIZE}`,
        413,
        'ARCHIVE_TOO_LARGE'
      );
    }

    logger.debug(
      { archivePath, size: stats.size },
      'Archive created'
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, sourceDir, archivePath }, 'Failed to create archive');
    throw new AppError('Failed to create archive', 500, 'ARCHIVE_ERROR');
  }
}

/**
 * Clone a repository and store the archive in MinIO
 * @param repo - Repository to clone
 * @param tenantId - Tenant ID for organizing storage
 * @param accessToken - GitHub access token for authentication
 * @param options - Clone options
 * @returns Clone result with object path and commit SHA
 */
export async function cloneAndStore(
  repo: Repository,
  tenantId: string,
  accessToken: string,
  options: CloneOptions = {}
): Promise<CloneResult> {
  const { depth = 1, branch, force = false } = options;
  const sessionId = randomUUID();
  const tempBase = join(tmpdir(), 'dmp-clone');
  const tempDir = join(tempBase, sessionId);
  const repoDir = join(tempDir, 'repo');
  const archivePath = join(tempDir, 'archive.tar.gz');

  // Sanitize repository identifiers
  const sanitizedOwner = sanitizePath(repo.owner);
  const sanitizedName = sanitizePath(repo.name);

  logger.info(
    { repo: repo.fullName, tenantId, sessionId },
    'Starting repository clone'
  );

  try {
    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Build clone command with token authentication
    const cloneUrl = `https://x-access-token:${accessToken}@github.com/${sanitizedOwner}/${sanitizedName}.git`;
    let cloneCmd = `git clone --depth=${depth}`;

    if (branch) {
      cloneCmd += ` --branch "${sanitizePath(branch)}"`;
    }

    cloneCmd += ` "${cloneUrl}" "${repoDir}"`;

    // Execute clone (token is in URL, don't log the full command)
    logger.debug(
      { repo: repo.fullName, depth, branch },
      'Executing git clone'
    );

    await execAsync(cloneCmd, {
      timeout: CLONE_TIMEOUT,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large repos
    });

    // Get commit SHA
    const commitSha = await getCommitSha(repoDir);

    // Build object path
    const objectPath = buildRepoArchivePath(tenantId, repo.id, commitSha);

    // Check if archive already exists (unless force is true)
    if (!force) {
      const exists = await objectExists(objectPath);
      if (exists) {
        logger.info(
          { repo: repo.fullName, objectPath, commitSha },
          'Archive already exists, returning cached result'
        );

        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });

        return {
          objectPath,
          commitSha,
          archiveSize: 0, // Size not known for cached result
          cached: true,
        };
      }
    }

    // Create archive
    await createArchive(repoDir, archivePath);

    // Read archive and upload to MinIO
    const archiveBuffer = await readFile(archivePath);

    await uploadObject(
      objectPath,
      archiveBuffer,
      'application/gzip',
      {
        'x-amz-meta-repo-owner': sanitizedOwner,
        'x-amz-meta-repo-name': sanitizedName,
        'x-amz-meta-commit-sha': commitSha,
        'x-amz-meta-tenant-id': tenantId,
      }
    );

    logger.info(
      {
        repo: repo.fullName,
        objectPath,
        commitSha,
        size: archiveBuffer.length,
      },
      'Repository cloned and archived successfully'
    );

    return {
      objectPath,
      commitSha,
      archiveSize: archiveBuffer.length,
      cached: false,
    };
  } catch (error) {
    // Sanitize error message to remove token
    const sanitizedError = error instanceof Error
      ? error.message.replace(accessToken, '[REDACTED]')
      : 'Clone failed';

    logger.error(
      { repo: repo.fullName, error: sanitizedError },
      'Failed to clone and store repository'
    );

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Failed to clone repository: ${sanitizedError}`,
      500,
      'CLONE_ERROR'
    );
  } finally {
    // Always clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
      logger.debug({ sessionId }, 'Cleaned up temp directory');
    } catch (cleanupError) {
      logger.warn(
        { sessionId, error: cleanupError },
        'Failed to clean up temp directory'
      );
    }
  }
}

/**
 * Get download URL for a repository archive
 * @param tenantId - Tenant ID
 * @param repoId - Repository ID
 * @param commitSha - Commit SHA
 * @param expiresIn - URL expiration in seconds
 * @returns Presigned download URL
 */
export async function getArchiveDownloadUrl(
  tenantId: string,
  repoId: string,
  commitSha: string,
  expiresIn: number = 3600
): Promise<string> {
  const objectPath = buildRepoArchivePath(tenantId, repoId, commitSha);
  return getPresignedDownloadUrl(objectPath, expiresIn);
}

/**
 * Check if a repository archive exists
 * @param tenantId - Tenant ID
 * @param repoId - Repository ID
 * @param commitSha - Commit SHA
 * @returns true if archive exists
 */
export async function archiveExists(
  tenantId: string,
  repoId: string,
  commitSha: string
): Promise<boolean> {
  const objectPath = buildRepoArchivePath(tenantId, repoId, commitSha);
  return objectExists(objectPath);
}
