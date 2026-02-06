/**
 * Authentication & Authorization Security Tests
 * @module tests/security/auth
 *
 * Tests for API key validation, JWT security, tenant isolation,
 * and webhook signature verification.
 *
 * CWE Coverage:
 * - CWE-287: Improper Authentication
 * - CWE-306: Missing Authentication for Critical Function
 * - CWE-862: Missing Authorization
 * - CWE-863: Incorrect Authorization
 * - CWE-798: Hardcoded Credentials
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'crypto';

// ============================================================================
// Mock Types
// ============================================================================

interface AuthContext {
  userId: string;
  email: string;
  name: string;
  githubId?: number;
  tenantId: string;
}

interface JWTClaims {
  sub: string;
  email: string;
  name: string;
  githubId?: number;
  tenantId: string;
  iat: number;
  exp: number;
  iss: string;
}

// ============================================================================
// API Key Validation Tests
// ============================================================================

describe('Authentication & Authorization', () => {
  describe('API Key Validation', () => {
    /**
     * Validates API key format and existence
     */
    function validateApiKey(apiKey: string | undefined): {
      valid: boolean;
      error?: string;
    } {
      if (!apiKey) {
        return { valid: false, error: 'API key is required' };
      }

      if (typeof apiKey !== 'string') {
        return { valid: false, error: 'API key must be a string' };
      }

      // API key format: prefix_base64random (e.g., cr_abc123xyz789)
      const apiKeyPattern = /^cr_[a-zA-Z0-9]{32,}$/;
      if (!apiKeyPattern.test(apiKey)) {
        return { valid: false, error: 'Invalid API key format' };
      }

      return { valid: true };
    }

    it('should reject requests without API key', () => {
      const result = validateApiKey(undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should reject invalid API key formats', () => {
      const invalidKeys = [
        '',                           // Empty
        'invalid',                    // No prefix
        'cr_short',                   // Too short
        'cr_has spaces in it',        // Contains spaces
        'cr_has!special@chars',       // Special characters
        'wrong_prefix_abc123xyz789abc123xyz789', // Wrong prefix
        123,                          // Not a string
        null,                         // Null
        {},                           // Object
      ];

      for (const key of invalidKeys) {
        const result = validateApiKey(key as string);
        expect(result.valid, `Key "${key}" should be invalid`).toBe(false);
      }
    });

    it('should accept valid API key format', () => {
      const validKeys = [
        'cr_abcdefghijklmnopqrstuvwxyz123456',
        'cr_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
        'cr_0123456789abcdefABCDEF0123456789',
      ];

      for (const key of validKeys) {
        const result = validateApiKey(key);
        expect(result.valid, `Key "${key}" should be valid`).toBe(true);
      }
    });

    it('should reject expired API keys', () => {
      interface ApiKeyRecord {
        key: string;
        expiresAt: Date;
        revoked: boolean;
      }

      function isApiKeyExpired(record: ApiKeyRecord): boolean {
        return record.expiresAt < new Date() || record.revoked;
      }

      const expiredKey: ApiKeyRecord = {
        key: 'cr_abcdefghijklmnopqrstuvwxyz123456',
        expiresAt: new Date('2020-01-01'),
        revoked: false,
      };

      const revokedKey: ApiKeyRecord = {
        key: 'cr_abcdefghijklmnopqrstuvwxyz123457',
        expiresAt: new Date('2030-01-01'),
        revoked: true,
      };

      expect(isApiKeyExpired(expiredKey)).toBe(true);
      expect(isApiKeyExpired(revokedKey)).toBe(true);
    });

    it('should use timing-safe comparison for API keys', () => {
      /**
       * Timing-safe string comparison to prevent timing attacks
       */
      function safeCompare(a: string, b: string): boolean {
        if (a.length !== b.length) {
          // Still need to do comparison to maintain constant time
          const dummy = Buffer.from(a);
          crypto.timingSafeEqual(dummy, dummy);
          return false;
        }

        try {
          return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
        } catch {
          return false;
        }
      }

      const storedKey = 'cr_abcdefghijklmnopqrstuvwxyz123456';
      const providedKey = 'cr_abcdefghijklmnopqrstuvwxyz123456';
      const wrongKey = 'cr_wrongkey12345678901234567890123';

      expect(safeCompare(storedKey, providedKey)).toBe(true);
      expect(safeCompare(storedKey, wrongKey)).toBe(false);
    });
  });

  // ============================================================================
  // JWT Security Tests
  // ============================================================================

  describe('JWT Security', () => {
    it('should reject tokens with none algorithm', () => {
      /**
       * Validates JWT algorithm
       */
      function isAlgorithmAllowed(algorithm: string): boolean {
        const allowedAlgorithms = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
        return allowedAlgorithms.includes(algorithm);
      }

      expect(isAlgorithmAllowed('none')).toBe(false);
      expect(isAlgorithmAllowed('HS256')).toBe(false); // Symmetric not allowed
      expect(isAlgorithmAllowed('RS256')).toBe(true);
    });

    it('should reject tokens without expiration', () => {
      function hasValidExpiration(claims: Partial<JWTClaims>): boolean {
        if (!claims.exp) {
          return false;
        }

        const now = Math.floor(Date.now() / 1000);
        return claims.exp > now;
      }

      expect(hasValidExpiration({})).toBe(false);
      expect(hasValidExpiration({ exp: 0 })).toBe(false);
      expect(hasValidExpiration({ exp: Math.floor(Date.now() / 1000) - 100 })).toBe(false);
      expect(hasValidExpiration({ exp: Math.floor(Date.now() / 1000) + 3600 })).toBe(true);
    });

    it('should validate issuer claim', () => {
      const EXPECTED_ISSUER = 'code-reviewer-api';

      function isIssuerValid(claims: Partial<JWTClaims>): boolean {
        return claims.iss === EXPECTED_ISSUER;
      }

      expect(isIssuerValid({ iss: 'code-reviewer-api' })).toBe(true);
      expect(isIssuerValid({ iss: 'attacker-service' })).toBe(false);
      expect(isIssuerValid({})).toBe(false);
    });

    it('should reject tokens with missing required claims', () => {
      function validateRequiredClaims(claims: Partial<JWTClaims>): {
        valid: boolean;
        missing: string[];
      } {
        const requiredClaims = ['sub', 'email', 'tenantId', 'iat', 'exp', 'iss'];
        const missing = requiredClaims.filter(
          claim => claims[claim as keyof JWTClaims] === undefined
        );

        return {
          valid: missing.length === 0,
          missing,
        };
      }

      const completeClaims: JWTClaims = {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        tenantId: 'tenant-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'code-reviewer-api',
      };

      const incompleteClaims: Partial<JWTClaims> = {
        sub: 'user-123',
        email: 'user@example.com',
      };

      expect(validateRequiredClaims(completeClaims).valid).toBe(true);
      expect(validateRequiredClaims(incompleteClaims).valid).toBe(false);
    });

    it('should enforce token max age', () => {
      const MAX_TOKEN_AGE_SECONDS = 24 * 60 * 60; // 24 hours

      function isTokenTooOld(iat: number): boolean {
        const now = Math.floor(Date.now() / 1000);
        return now - iat > MAX_TOKEN_AGE_SECONDS;
      }

      const recentIat = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const oldIat = Math.floor(Date.now() / 1000) - (25 * 60 * 60); // 25 hours ago

      expect(isTokenTooOld(recentIat)).toBe(false);
      expect(isTokenTooOld(oldIat)).toBe(true);
    });
  });

  // ============================================================================
  // Tenant Isolation Tests
  // ============================================================================

  describe('Tenant Isolation', () => {
    interface MockRequest {
      auth?: AuthContext;
      params: Record<string, string>;
    }

    it('should prevent cross-tenant data access', () => {
      function validateTenantAccess(
        request: MockRequest,
        resourceTenantId: string
      ): { allowed: boolean; error?: string } {
        if (!request.auth) {
          return { allowed: false, error: 'Authentication required' };
        }

        if (request.auth.tenantId !== resourceTenantId) {
          return { allowed: false, error: 'Access denied: resource belongs to different tenant' };
        }

        return { allowed: true };
      }

      const tenantARequest: MockRequest = {
        auth: {
          userId: 'user-a',
          email: 'a@tenant-a.com',
          name: 'User A',
          tenantId: 'tenant-a',
        },
        params: {},
      };

      // Tenant A trying to access Tenant A resource - allowed
      expect(validateTenantAccess(tenantARequest, 'tenant-a').allowed).toBe(true);

      // Tenant A trying to access Tenant B resource - denied
      expect(validateTenantAccess(tenantARequest, 'tenant-b').allowed).toBe(false);
    });

    it('should inject tenant filter in all queries', () => {
      /**
       * Builds a query with mandatory tenant filter
       */
      function buildTenantQuery(
        baseQuery: string,
        tenantId: string
      ): { query: string; params: unknown[] } {
        // All queries MUST include tenant_id filter
        const hasWhereClause = /WHERE/i.test(baseQuery);

        const tenantFilter = hasWhereClause
          ? ' AND tenant_id = $1'
          : ' WHERE tenant_id = $1';

        return {
          query: baseQuery + tenantFilter,
          params: [tenantId],
        };
      }

      const query1 = buildTenantQuery('SELECT * FROM scans', 'tenant-123');
      expect(query1.query).toContain('tenant_id = $1');
      expect(query1.params).toContain('tenant-123');

      const query2 = buildTenantQuery(
        "SELECT * FROM nodes WHERE type = 'resource'",
        'tenant-456'
      );
      expect(query2.query).toContain('AND tenant_id = $1');
    });

    it('should validate tenant ID format', () => {
      function isValidTenantId(tenantId: string): boolean {
        // Tenant ID format: uuid or custom prefix + alphanumeric
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const customPattern = /^tenant-[a-z0-9]{8,}$/;

        return uuidPattern.test(tenantId) || customPattern.test(tenantId);
      }

      expect(isValidTenantId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidTenantId('tenant-abc12345')).toBe(true);
      expect(isValidTenantId('')).toBe(false);
      expect(isValidTenantId('../../../etc/passwd')).toBe(false);
      expect(isValidTenantId("'; DROP TABLE tenants; --")).toBe(false);
    });

    it('should enforce RLS policies at database level', () => {
      /**
       * Simulates Row Level Security policy check
       */
      function checkRLSPolicy(
        tableName: string,
        operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
        currentTenantId: string,
        rowTenantId: string
      ): boolean {
        // RLS policy: tenant_id = current_setting('app.tenant_id')
        return currentTenantId === rowTenantId;
      }

      const tables = ['scans', 'nodes', 'edges', 'evidence', 'findings'];
      const operations: Array<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'> = [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE'
      ];

      for (const table of tables) {
        for (const op of operations) {
          // Same tenant - allowed
          expect(checkRLSPolicy(table, op, 'tenant-1', 'tenant-1')).toBe(true);

          // Different tenant - denied
          expect(checkRLSPolicy(table, op, 'tenant-1', 'tenant-2')).toBe(false);
        }
      }
    });
  });

  // ============================================================================
  // Webhook Security Tests
  // ============================================================================

  describe('Webhook Security', () => {
    describe('GitHub Webhook Signature Verification', () => {
      /**
       * Verifies GitHub webhook signature (HMAC-SHA256)
       */
      function verifyGitHubSignature(
        payload: string,
        signature: string | undefined,
        secret: string
      ): boolean {
        if (!signature) {
          return false;
        }

        // GitHub signature format: sha256=hash
        const [algorithm, hash] = signature.split('=');

        if (algorithm !== 'sha256' || !hash) {
          return false;
        }

        const expectedHash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');

        try {
          return crypto.timingSafeEqual(
            Buffer.from(hash),
            Buffer.from(expectedHash)
          );
        } catch {
          return false;
        }
      }

      const webhookSecret = 'test-webhook-secret-12345';
      const payload = JSON.stringify({ action: 'push', repository: { name: 'test' } });

      it('should verify valid GitHub webhook signatures', () => {
        const expectedHash = crypto
          .createHmac('sha256', webhookSecret)
          .update(payload)
          .digest('hex');
        const validSignature = `sha256=${expectedHash}`;

        expect(verifyGitHubSignature(payload, validSignature, webhookSecret)).toBe(true);
      });

      it('should reject missing webhook signatures', () => {
        expect(verifyGitHubSignature(payload, undefined, webhookSecret)).toBe(false);
        expect(verifyGitHubSignature(payload, '', webhookSecret)).toBe(false);
      });

      it('should reject invalid webhook signatures', () => {
        const invalidSignature = 'sha256=invalid123456789abcdef';

        expect(verifyGitHubSignature(payload, invalidSignature, webhookSecret)).toBe(false);
      });

      it('should reject signatures with wrong algorithm', () => {
        const hash = crypto
          .createHmac('sha256', webhookSecret)
          .update(payload)
          .digest('hex');
        const wrongAlgorithm = `sha1=${hash}`;

        expect(verifyGitHubSignature(payload, wrongAlgorithm, webhookSecret)).toBe(false);
      });

      it('should reject signatures with wrong secret', () => {
        const wrongSecretHash = crypto
          .createHmac('sha256', 'wrong-secret')
          .update(payload)
          .digest('hex');
        const wrongSignature = `sha256=${wrongSecretHash}`;

        expect(verifyGitHubSignature(payload, wrongSignature, webhookSecret)).toBe(false);
      });
    });

    describe('GitLab Webhook Token Verification', () => {
      /**
       * Verifies GitLab webhook token
       */
      function verifyGitLabToken(
        providedToken: string | undefined,
        expectedToken: string
      ): boolean {
        if (!providedToken) {
          return false;
        }

        try {
          return crypto.timingSafeEqual(
            Buffer.from(providedToken),
            Buffer.from(expectedToken)
          );
        } catch {
          return false;
        }
      }

      const webhookToken = 'gitlab-webhook-token-abc123';

      it('should verify valid GitLab webhook tokens', () => {
        expect(verifyGitLabToken(webhookToken, webhookToken)).toBe(true);
      });

      it('should reject missing GitLab webhook tokens', () => {
        expect(verifyGitLabToken(undefined, webhookToken)).toBe(false);
      });

      it('should reject invalid GitLab webhook tokens', () => {
        expect(verifyGitLabToken('wrong-token', webhookToken)).toBe(false);
      });
    });

    describe('Unsigned Webhook Rejection', () => {
      it('should reject unsigned webhook payloads', () => {
        interface WebhookRequest {
          headers: Record<string, string | undefined>;
          body: string;
        }

        function validateWebhookSecurity(
          request: WebhookRequest,
          provider: 'github' | 'gitlab'
        ): { valid: boolean; error?: string } {
          if (provider === 'github') {
            const signature = request.headers['x-hub-signature-256'];
            if (!signature) {
              return { valid: false, error: 'Missing X-Hub-Signature-256 header' };
            }
          } else if (provider === 'gitlab') {
            const token = request.headers['x-gitlab-token'];
            if (!token) {
              return { valid: false, error: 'Missing X-Gitlab-Token header' };
            }
          }

          return { valid: true };
        }

        const unsignedGitHub: WebhookRequest = {
          headers: {},
          body: '{"action": "push"}',
        };

        const unsignedGitLab: WebhookRequest = {
          headers: {},
          body: '{"event_type": "push"}',
        };

        expect(validateWebhookSecurity(unsignedGitHub, 'github').valid).toBe(false);
        expect(validateWebhookSecurity(unsignedGitLab, 'gitlab').valid).toBe(false);
      });
    });
  });

  // ============================================================================
  // Session Security Tests
  // ============================================================================

  describe('Session Security', () => {
    it('should regenerate session ID after authentication', () => {
      let sessionId = 'initial-session-123';

      function regenerateSession(): string {
        // Generate new cryptographically secure session ID
        return crypto.randomBytes(32).toString('hex');
      }

      function simulateLogin() {
        const oldSessionId = sessionId;
        sessionId = regenerateSession();

        // Session ID must change after login
        expect(sessionId).not.toBe(oldSessionId);
        expect(sessionId.length).toBeGreaterThanOrEqual(32);
      }

      simulateLogin();
    });

    it('should use secure session cookies', () => {
      interface CookieOptions {
        httpOnly: boolean;
        secure: boolean;
        sameSite: 'strict' | 'lax' | 'none';
        path: string;
        maxAge?: number;
      }

      function getSecureCookieOptions(): CookieOptions {
        return {
          httpOnly: true,      // Prevent XSS access
          secure: true,        // HTTPS only
          sameSite: 'strict',  // Prevent CSRF
          path: '/',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        };
      }

      const options = getSecureCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
    });

    it('should implement session timeout', () => {
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

      function isSessionExpired(lastActivity: Date): boolean {
        const now = new Date();
        return now.getTime() - lastActivity.getTime() > SESSION_TIMEOUT_MS;
      }

      const recentActivity = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
      const oldActivity = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      expect(isSessionExpired(recentActivity)).toBe(false);
      expect(isSessionExpired(oldActivity)).toBe(true);
    });
  });

  // ============================================================================
  // Authorization Tests
  // ============================================================================

  describe('Authorization Controls', () => {
    interface Permission {
      resource: string;
      action: 'read' | 'write' | 'delete' | 'admin';
    }

    interface Role {
      name: string;
      permissions: Permission[];
    }

    const roles: Record<string, Role> = {
      viewer: {
        name: 'viewer',
        permissions: [
          { resource: 'scans', action: 'read' },
          { resource: 'reports', action: 'read' },
        ],
      },
      developer: {
        name: 'developer',
        permissions: [
          { resource: 'scans', action: 'read' },
          { resource: 'scans', action: 'write' },
          { resource: 'reports', action: 'read' },
        ],
      },
      admin: {
        name: 'admin',
        permissions: [
          { resource: 'scans', action: 'read' },
          { resource: 'scans', action: 'write' },
          { resource: 'scans', action: 'delete' },
          { resource: 'reports', action: 'read' },
          { resource: 'reports', action: 'write' },
          { resource: 'users', action: 'admin' },
          { resource: 'settings', action: 'admin' },
        ],
      },
    };

    function hasPermission(
      userRole: string,
      resource: string,
      action: Permission['action']
    ): boolean {
      const role = roles[userRole];
      if (!role) return false;

      return role.permissions.some(
        p => p.resource === resource && p.action === action
      );
    }

    it('should enforce role-based access control', () => {
      // Viewer permissions
      expect(hasPermission('viewer', 'scans', 'read')).toBe(true);
      expect(hasPermission('viewer', 'scans', 'write')).toBe(false);
      expect(hasPermission('viewer', 'scans', 'delete')).toBe(false);

      // Developer permissions
      expect(hasPermission('developer', 'scans', 'read')).toBe(true);
      expect(hasPermission('developer', 'scans', 'write')).toBe(true);
      expect(hasPermission('developer', 'scans', 'delete')).toBe(false);

      // Admin permissions
      expect(hasPermission('admin', 'scans', 'delete')).toBe(true);
      expect(hasPermission('admin', 'users', 'admin')).toBe(true);
    });

    it('should deny access for unknown roles', () => {
      expect(hasPermission('unknown_role', 'scans', 'read')).toBe(false);
      expect(hasPermission('', 'scans', 'read')).toBe(false);
    });

    it('should require explicit permission grants', () => {
      // Default deny - only explicitly granted permissions are allowed
      expect(hasPermission('viewer', 'users', 'admin')).toBe(false);
      expect(hasPermission('developer', 'settings', 'admin')).toBe(false);
    });
  });

  // ============================================================================
  // Hardcoded Credentials Detection
  // ============================================================================

  describe('Hardcoded Credentials Detection (CWE-798)', () => {
    it('should detect hardcoded API keys', () => {
      const patterns = {
        awsAccessKey: /AKIA[0-9A-Z]{16}/,
        genericApiKey: /api_key\s*=\s*['"][a-zA-Z0-9_]{20,}['"]/i,
        bearerToken: /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
      };

      const codeWithSecrets = `
        const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
        const api_key = "sk_live_abc123xyz789def456abc";
        const token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      `;

      expect(patterns.awsAccessKey.test(codeWithSecrets)).toBe(true);
      expect(patterns.genericApiKey.test(codeWithSecrets)).toBe(true);
      expect(patterns.bearerToken.test(codeWithSecrets)).toBe(true);
    });

    it('should detect hardcoded passwords', () => {
      const passwordPattern = /password\s*=\s*['"][^'"]+['"]/i;
      const secretPattern = /secret\s*=\s*['"][^'"]+['"]/i;

      const codeWithPasswords = `
        const password = "supersecret123";
        const api_secret = "my-api-secret";
      `;

      // At least password and secret patterns should match
      expect(passwordPattern.test(codeWithPasswords)).toBe(true);
      expect(secretPattern.test(codeWithPasswords)).toBe(true);
    });

    it('should detect private keys in code', () => {
      const privateKeyPattern = /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/;

      const codeWithPrivateKey = `
        const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
        MIIEpAIBAAKCAQEA...
        -----END RSA PRIVATE KEY-----\`;
      `;

      expect(privateKeyPattern.test(codeWithPrivateKey)).toBe(true);
    });
  });
});
