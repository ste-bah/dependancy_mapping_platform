/**
 * MinIO/S3 Client Service
 * Object storage client singleton for repository archives
 * @module services/minio-client
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import pino from 'pino';
import { AppError } from '../middleware/error-handler.js';

const logger = pino({ name: 'minio-client' });

/**
 * MinIO configuration
 */
interface MinioConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

/**
 * Get MinIO configuration from environment
 */
function getMinioConfig(): MinioConfig {
  const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  const bucket = process.env.MINIO_BUCKET || 'dmp-repos';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables are required');
  }

  return {
    endpoint,
    region: process.env.MINIO_REGION || 'us-east-1',
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: true, // Required for MinIO
  };
}

/**
 * S3 client singleton
 */
let s3Client: S3Client | null = null;
let configuredBucket: string | null = null;

/**
 * Get or create S3 client instance
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getMinioConfig();
    configuredBucket = config.bucket;

    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
    });

    logger.info({ endpoint: config.endpoint, bucket: config.bucket }, 'MinIO client initialized');
  }

  return s3Client;
}

/**
 * Get configured bucket name
 */
function getBucket(): string {
  if (!configuredBucket) {
    const config = getMinioConfig();
    configuredBucket = config.bucket;
  }
  return configuredBucket;
}

/**
 * Upload object result
 */
export interface UploadResult {
  objectPath: string;
  bucket: string;
  size: number;
  etag: string;
}

/**
 * Upload a file to MinIO
 * @param key - Object key (path in bucket)
 * @param body - File content as Buffer or Readable stream
 * @param contentType - MIME type of the file
 * @param metadata - Optional metadata
 */
export async function uploadObject(
  key: string,
  body: Buffer | Readable,
  contentType: string = 'application/octet-stream',
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = getBucket();

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    const response = await client.send(command);

    const size = Buffer.isBuffer(body) ? body.length : 0;

    logger.debug({ key, bucket, size }, 'Object uploaded');

    return {
      objectPath: key,
      bucket,
      size,
      etag: response.ETag || '',
    };
  } catch (error) {
    logger.error({ error, key, bucket }, 'Failed to upload object');
    throw new AppError(
      'Failed to upload file to storage',
      500,
      'STORAGE_UPLOAD_ERROR'
    );
  }
}

/**
 * Download an object from MinIO
 * @param key - Object key
 * @returns Object content as Buffer
 */
export async function downloadObject(key: string): Promise<Buffer> {
  const client = getS3Client();
  const bucket = getBucket();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as Readable;

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);

    logger.debug({ key, bucket, size: buffer.length }, 'Object downloaded');

    return buffer;
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === 'NoSuchKey') {
      throw new AppError('File not found in storage', 404, 'STORAGE_NOT_FOUND');
    }

    logger.error({ error, key, bucket }, 'Failed to download object');
    throw new AppError(
      'Failed to download file from storage',
      500,
      'STORAGE_DOWNLOAD_ERROR'
    );
  }
}

/**
 * Delete an object from MinIO
 * @param key - Object key
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);

    logger.debug({ key, bucket }, 'Object deleted');
  } catch (error) {
    logger.error({ error, key, bucket }, 'Failed to delete object');
    throw new AppError(
      'Failed to delete file from storage',
      500,
      'STORAGE_DELETE_ERROR'
    );
  }
}

/**
 * Check if an object exists in MinIO
 * @param key - Object key
 * @returns true if object exists
 */
export async function objectExists(key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = getBucket();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === 'NotFound' || err.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

/**
 * Generate a presigned URL for downloading
 * @param key - Object key
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Presigned URL
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    logger.debug({ key, expiresIn }, 'Generated presigned download URL');

    return url;
  } catch (error) {
    logger.error({ error, key }, 'Failed to generate presigned URL');
    throw new AppError(
      'Failed to generate download URL',
      500,
      'STORAGE_URL_ERROR'
    );
  }
}

/**
 * List objects with a given prefix
 * @param prefix - Key prefix to filter by
 * @param maxKeys - Maximum number of keys to return
 * @returns Array of object keys
 */
export async function listObjects(
  prefix: string,
  maxKeys: number = 1000
): Promise<string[]> {
  const client = getS3Client();
  const bucket = getBucket();

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await client.send(command);

    const keys = (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key): key is string => key !== undefined);

    logger.debug({ prefix, count: keys.length }, 'Listed objects');

    return keys;
  } catch (error) {
    logger.error({ error, prefix }, 'Failed to list objects');
    throw new AppError(
      'Failed to list files in storage',
      500,
      'STORAGE_LIST_ERROR'
    );
  }
}

/**
 * Build object path for repository archives
 * @param tenantId - Tenant ID
 * @param repoId - Repository ID
 * @param commitSha - Commit SHA
 * @returns Object path
 */
export function buildRepoArchivePath(
  tenantId: string,
  repoId: string,
  commitSha: string
): string {
  return `${tenantId}/${repoId}/${commitSha}.tar.gz`;
}
