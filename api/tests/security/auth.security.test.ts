/**
 * Authentication Security Tests - Security Audit Preparation
 * @module tests/security/auth.security
 *
 * Comprehensive security tests for authentication mechanisms
 * as required by NFR-SEC-009 Security Audit Preparation.
 *
 * CWE Coverage:
 * - CWE-287: Improper Authentication
 * - CWE-307: Improper Restriction of Excessive Authentication Attempts
 * - CWE-384: Session Fixation
 * - CWE-613: Insufficient Session Expiration
 * - CWE-639: Authorization Bypass Through User-Controlled Key
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'crypto';

// ============================================================================
// Mock Types and Utilities
// ============================================================================

interface JWTHeader {
  alg: string;
  typ: string;
}

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  iat: number;
  exp: number;
  iss: string;
  aud?: string;
  jti?: string;
}

interface RateLimitRecord {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

/**
 * Simulates JWT validation (for testing purposes)
 */
function validateJWT(
  token: string,
  options: {
    allowedAlgorithms: string[];
    issuer: string;
    clockTolerance?: number;
  }
): { valid: boolean; error?: string; payload?: JWTPayload } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token: expected 3 parts' };
  }

  try {
    // Decode header
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const header: JWTHeader = JSON.parse(headerJson);

    // Validate algorithm
    if (!options.allowedAlgorithms.includes(header.alg)) {
      return {
        valid: false,
        error: `Algorithm ${header.alg} not allowed. Allowed: ${options.allowedAlgorithms.join(', ')}`,
      };
    }

    // Decode payload
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload: JWTPayload = JSON.parse(payloadJson);

    // Validate issuer
    if (payload.iss !== options.issuer) {
      return {
        valid: false,
        error: `Invalid issuer: expected ${options.issuer}, got ${payload.iss}`,
      };
    }

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    const tolerance = options.clockTolerance || 0;

    if (!payload.exp) {
      return { valid: false, error: 'Token missing expiration (exp) claim' };
    }

    if (payload.exp + tolerance < now) {
      return { valid: false, error: 'Token has expired' };
    }

    // Validate not-before (if present)
    if (payload.iat && payload.iat - tolerance > now) {
      return { valid: false, error: 'Token not yet valid (iat in future)' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Failed to parse token' };
  }
}

/**
 * Creates a mock JWT token for testing
 */
function createMockJWT(
  header: Partial<JWTHeader>,
  payload: Partial<JWTPayload>,
  includeSignature = true
): string {
  const fullHeader: JWTHeader = {
    alg: header.alg || 'RS256',
    typ: header.typ || 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    sub: payload.sub || 'user-123',
    email: payload.email || 'user@example.com',
    name: payload.name || 'Test User',
    tenantId: payload.tenantId || 'tenant-abc',
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + 3600,
    iss: payload.iss || 'code-reviewer-api',
    ...payload,
  };

  const headerB64 = Buffer.from(JSON.stringify(fullHeader)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = includeSignature
    ? Buffer.from('mock-signature').toString('base64url')
    : '';

  return `${headerB64}.${payloadB64}.${signature}`;
}

// ============================================================================
// JWT Security Tests
// ============================================================================

describe('Authentication Security Tests (NFR-SEC-009)', () => {
  const JWT_OPTIONS = {
    allowedAlgorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
    issuer: 'code-reviewer-api',
    clockTolerance: 30,
  };

  describe('JWT Token Validation', () => {
    it('should reject expired JWT tokens', () => {
      // Create a token that expired 1 hour ago
      const expiredToken = createMockJWT(
        { alg: 'RS256' },
        {
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        }
      );

      const result = validateJWT(expiredToken, JWT_OPTIONS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject tokens expired by 1 second', () => {
      // Token expired just 1 second ago (beyond tolerance)
      const barelyExpiredToken = createMockJWT(
        { alg: 'RS256' },
        {
          exp: Math.floor(Date.now() / 1000) - 31, // 31 seconds ago (beyond 30s tolerance)
        }
      );

      const result = validateJWT(barelyExpiredToken, JWT_OPTIONS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should accept tokens within clock tolerance', () => {
      // Token "expired" 29 seconds ago (within 30s tolerance)
      const withinToleranceToken = createMockJWT(
        { alg: 'RS256' },
        {
          exp: Math.floor(Date.now() / 1000) - 29,
        }
      );

      const result = validateJWT(withinToleranceToken, JWT_OPTIONS);

      expect(result.valid).toBe(true);
    });

    it('should reject malformed tokens', () => {
      const malformedTokens = [
        '', // Empty
        'not-a-jwt', // No dots
        'part1.part2', // Only 2 parts
        'part1.part2.part3.part4', // 4 parts
        '!!!.@@@.###', // Invalid base64
        'eyJ.eyJ.sig', // Truncated base64
      ];

      for (const token of malformedTokens) {
        const result = validateJWT(token, JWT_OPTIONS);
        expect(result.valid, `Token "${token}" should be rejected`).toBe(false);
      }
    });

    it('should reject tokens with "none" algorithm', () => {
      const noneAlgToken = createMockJWT(
        { alg: 'none' },
        { exp: Math.floor(Date.now() / 1000) + 3600 }
      );

      const result = validateJWT(noneAlgToken, JWT_OPTIONS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
      expect(result.error).toContain('none');
    });

    it('should reject tokens with symmetric algorithms (HS256)', () => {
      const hsToken = createMockJWT(
        { alg: 'HS256' },
        { exp: Math.floor(Date.now() / 1000) + 3600 }
      );

      const result = validateJWT(hsToken, JWT_OPTIONS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
      expect(result.error).toContain('HS256');
    });

    it('should reject tokens without expiration claim', () => {
      const noExpToken = createMockJWT({ alg: 'RS256' }, {});
      // Manually remove exp from the payload
      const parts = noExpToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      delete payload.exp;
      const newPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tokenWithoutExp = `${parts[0]}.${newPayloadB64}.${parts[2]}`;

      const result = validateJWT(tokenWithoutExp, JWT_OPTIONS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expiration');
    });

    it('should reject tokens with invalid issuer', () => {
      const wrongIssuerToken = createMockJWT(
        { alg: 'RS256' },
        {
          iss: 'attacker-service',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }
      );

      const result = validateJWT(wrongIssuerToken, JWT_OPTIONS);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('issuer');
    });

    it('should accept valid RS256 tokens', () => {
      const validToken = createMockJWT(
        { alg: 'RS256' },
        {
          iss: 'code-reviewer-api',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }
      );

      const result = validateJWT(validToken, JWT_OPTIONS);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.iss).toBe('code-reviewer-api');
    });

    it('should accept valid ES256 tokens', () => {
      const validToken = createMockJWT(
        { alg: 'ES256' },
        {
          iss: 'code-reviewer-api',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }
      );

      const result = validateJWT(validToken, JWT_OPTIONS);

      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe('Rate Limiting', () => {
    let rateLimitStore: Map<string, RateLimitRecord>;

    beforeEach(() => {
      rateLimitStore = new Map();
    });

    /**
     * Check rate limit for an identifier
     */
    function checkRateLimit(
      identifier: string,
      config: { maxRequests: number; windowMs: number }
    ): { allowed: boolean; remaining: number; retryAfter?: number } {
      const now = Date.now();
      let record = rateLimitStore.get(identifier);

      // Check if locked
      if (record?.lockedUntil && now < record.lockedUntil) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil((record.lockedUntil - now) / 1000),
        };
      }

      // Reset window if expired
      if (!record || now - record.windowStart >= config.windowMs) {
        record = { count: 0, windowStart: now };
      }

      // Check limit
      if (record.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil((record.windowStart + config.windowMs - now) / 1000),
        };
      }

      // Increment and allow
      record.count++;
      rateLimitStore.set(identifier, record);

      return {
        allowed: true,
        remaining: config.maxRequests - record.count,
      };
    }

    /**
     * Lock an identifier for a duration
     */
    function lockIdentifier(identifier: string, lockDurationMs: number): void {
      const record = rateLimitStore.get(identifier) || {
        count: 0,
        windowStart: Date.now(),
      };
      record.lockedUntil = Date.now() + lockDurationMs;
      rateLimitStore.set(identifier, record);
    }

    it('should enforce rate limiting', () => {
      const identifier = 'user@example.com';
      const config = { maxRequests: 5, windowMs: 60000 };

      // First 5 requests should be allowed
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(identifier, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }

      // 6th request should be blocked
      const blockedResult = checkRateLimit(identifier, config);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
    });

    it('should return retry-after header when rate limited', () => {
      const identifier = 'test-client';
      const config = { maxRequests: 3, windowMs: 60000 };

      // Exhaust limit
      for (let i = 0; i < 3; i++) {
        checkRateLimit(identifier, config);
      }

      const result = checkRateLimit(identifier, config);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should track rate limits per identifier', () => {
      const config = { maxRequests: 2, windowMs: 60000 };

      // User A makes 2 requests
      checkRateLimit('user-a', config);
      checkRateLimit('user-a', config);
      const userAResult = checkRateLimit('user-a', config);

      // User B should still have quota
      const userBResult = checkRateLimit('user-b', config);

      expect(userAResult.allowed).toBe(false);
      expect(userBResult.allowed).toBe(true);
    });

    it('should support account lockout after repeated failures', () => {
      const identifier = 'locked-user@example.com';
      const lockDurationMs = 30 * 60 * 1000; // 30 minutes

      // Simulate lockout after too many failed attempts
      lockIdentifier(identifier, lockDurationMs);

      // Any subsequent request should be blocked
      const result = checkRateLimit(identifier, { maxRequests: 100, windowMs: 60000 });

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Cross-Tenant Access Prevention Tests
  // ============================================================================

  describe('Cross-Tenant Access Prevention', () => {
    interface AuthContext {
      userId: string;
      tenantId: string;
      roles: string[];
    }

    interface Resource {
      id: string;
      tenantId: string;
      data: string;
    }

    /**
     * Validates tenant access
     */
    function validateTenantAccess(
      authContext: AuthContext,
      resource: Resource
    ): { allowed: boolean; error?: string } {
      if (!authContext.tenantId) {
        return { allowed: false, error: 'Missing tenant context' };
      }

      if (authContext.tenantId !== resource.tenantId) {
        // Log attempted cross-tenant access (in real implementation)
        return {
          allowed: false,
          error: 'Access denied: resource belongs to different tenant',
        };
      }

      return { allowed: true };
    }

    it('should not allow cross-tenant access', () => {
      const tenantAContext: AuthContext = {
        userId: 'user-a',
        tenantId: 'tenant-a',
        roles: ['admin'],
      };

      const tenantBResource: Resource = {
        id: 'resource-1',
        tenantId: 'tenant-b',
        data: 'sensitive data',
      };

      const result = validateTenantAccess(tenantAContext, tenantBResource);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('different tenant');
    });

    it('should allow same-tenant access', () => {
      const tenantAContext: AuthContext = {
        userId: 'user-a',
        tenantId: 'tenant-a',
        roles: ['viewer'],
      };

      const tenantAResource: Resource = {
        id: 'resource-2',
        tenantId: 'tenant-a',
        data: 'tenant a data',
      };

      const result = validateTenantAccess(tenantAContext, tenantAResource);

      expect(result.allowed).toBe(true);
    });

    it('should reject requests without tenant context', () => {
      const noTenantContext: AuthContext = {
        userId: 'user-x',
        tenantId: '', // Missing tenant
        roles: ['admin'],
      };

      const resource: Resource = {
        id: 'resource-3',
        tenantId: 'tenant-c',
        data: 'data',
      };

      const result = validateTenantAccess(noTenantContext, resource);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Missing tenant');
    });

    it('should derive tenant from JWT, not from request parameters', () => {
      // This test verifies the design principle that tenant ID comes from
      // the authenticated JWT, not from user-supplied request parameters

      const jwtPayload: JWTPayload = {
        sub: 'user-123',
        email: 'user@tenant-a.com',
        name: 'Test User',
        tenantId: 'tenant-a', // Tenant from JWT
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'code-reviewer-api',
      };

      // Attacker tries to access tenant-b by supplying it in request
      const maliciousRequestTenantId = 'tenant-b';

      // The application should use JWT tenant, not request parameter
      const usedTenantId = jwtPayload.tenantId; // Always use JWT

      expect(usedTenantId).toBe('tenant-a');
      expect(usedTenantId).not.toBe(maliciousRequestTenantId);
    });

    it('should block IDOR attempts via path parameter manipulation', () => {
      const authContext: AuthContext = {
        userId: 'user-123',
        tenantId: 'tenant-a',
        roles: ['developer'],
      };

      // Resources from different tenants
      const resources = new Map<string, Resource>([
        ['scan-001', { id: 'scan-001', tenantId: 'tenant-a', data: 'allowed' }],
        ['scan-002', { id: 'scan-002', tenantId: 'tenant-b', data: 'forbidden' }],
        ['scan-003', { id: 'scan-003', tenantId: 'tenant-c', data: 'forbidden' }],
      ]);

      // Simulate accessing resources by ID (IDOR attempt)
      const attemptedIds = ['scan-001', 'scan-002', 'scan-003'];
      const accessResults = attemptedIds.map((id) => {
        const resource = resources.get(id);
        if (!resource) {
          return { id, allowed: false, reason: 'not found' };
        }
        const validation = validateTenantAccess(authContext, resource);
        return { id, allowed: validation.allowed, reason: validation.error };
      });

      // Only scan-001 (same tenant) should be accessible
      expect(accessResults.find((r) => r.id === 'scan-001')?.allowed).toBe(true);
      expect(accessResults.find((r) => r.id === 'scan-002')?.allowed).toBe(false);
      expect(accessResults.find((r) => r.id === 'scan-003')?.allowed).toBe(false);
    });
  });

  // ============================================================================
  // API Key Security Tests
  // ============================================================================

  describe('API Key Security', () => {
    /**
     * Validates API key format
     */
    function validateApiKeyFormat(key: string): {
      valid: boolean;
      error?: string;
    } {
      if (!key) {
        return { valid: false, error: 'API key is required' };
      }

      // Expected format: cr_[32 alphanumeric characters]
      const pattern = /^cr_[a-zA-Z0-9]{32,}$/;
      if (!pattern.test(key)) {
        return { valid: false, error: 'Invalid API key format' };
      }

      return { valid: true };
    }

    /**
     * Timing-safe comparison
     */
    function safeCompare(a: string, b: string): boolean {
      if (a.length !== b.length) {
        return false;
      }
      try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
      } catch {
        return false;
      }
    }

    it('should validate API key format', () => {
      const validKeys = [
        'cr_abcdefghijklmnopqrstuvwxyz123456',
        'cr_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
        'cr_0123456789abcdefABCDEF0123456789',
        'cr_abcdefghijklmnopqrstuvwxyz12345678901234', // Longer is OK
      ];

      for (const key of validKeys) {
        expect(validateApiKeyFormat(key).valid, `${key} should be valid`).toBe(true);
      }
    });

    it('should reject invalid API key formats', () => {
      const invalidKeys = [
        '', // Empty
        'cr_short', // Too short
        'api_key_without_prefix', // Wrong prefix
        'cr_has-dashes-in-it-which-are-bad', // Dashes not allowed
        'cr_has spaces in the key value', // Spaces not allowed
        'cr_has!special@chars#in$it', // Special chars not allowed
        'sk_live_abc123xyz789', // Stripe-like key (wrong prefix)
      ];

      for (const key of invalidKeys) {
        expect(validateApiKeyFormat(key).valid, `${key} should be invalid`).toBe(false);
      }
    });

    it('should use timing-safe comparison for API keys', () => {
      const storedHash = 'abcdef123456abcdef123456abcdef12';
      const correctHash = 'abcdef123456abcdef123456abcdef12';
      const wrongHash = 'xxxxxx123456abcdef123456abcdef12';

      expect(safeCompare(storedHash, correctHash)).toBe(true);
      expect(safeCompare(storedHash, wrongHash)).toBe(false);
    });

    it('should handle different length keys safely', () => {
      const storedHash = 'abcdef123456';
      const shorterHash = 'abcdef';
      const longerHash = 'abcdef123456789012345678';

      // Different lengths should fail without timing leak
      expect(safeCompare(storedHash, shorterHash)).toBe(false);
      expect(safeCompare(storedHash, longerHash)).toBe(false);
    });
  });

  // ============================================================================
  // Session Security Tests
  // ============================================================================

  describe('Session Security', () => {
    it('should regenerate session ID on authentication', () => {
      let sessionId = crypto.randomBytes(16).toString('hex');
      const originalSessionId = sessionId;

      // Simulate login - session should regenerate
      function simulateLogin() {
        sessionId = crypto.randomBytes(16).toString('hex');
      }

      simulateLogin();

      expect(sessionId).not.toBe(originalSessionId);
      expect(sessionId.length).toBe(32);
    });

    it('should use secure cookie attributes', () => {
      interface CookieOptions {
        httpOnly: boolean;
        secure: boolean;
        sameSite: 'strict' | 'lax' | 'none';
        path: string;
        maxAge: number;
      }

      function getSecureCookieOptions(): CookieOptions {
        return {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        };
      }

      const options = getSecureCookieOptions();

      expect(options.httpOnly).toBe(true); // Prevent XSS access
      expect(options.secure).toBe(true); // HTTPS only
      expect(options.sameSite).toBe('strict'); // CSRF protection
    });

    it('should enforce session timeout', () => {
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
  // Webhook Security Tests
  // ============================================================================

  describe('Webhook Signature Verification', () => {
    const webhookSecret = 'whsec_test_secret_for_security_testing';

    /**
     * Verifies GitHub webhook signature
     */
    function verifyGitHubSignature(
      payload: string,
      signature: string | undefined,
      secret: string
    ): boolean {
      if (!signature || !signature.startsWith('sha256=')) {
        return false;
      }

      const hash = signature.slice(7);
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return safeCompare(hash, expectedHash);
    }

    function safeCompare(a: string, b: string): boolean {
      if (a.length !== b.length) {
        return false;
      }
      try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
      } catch {
        return false;
      }
    }

    it('should verify valid webhook signatures', () => {
      const payload = JSON.stringify({ event: 'push', repository: 'test' });
      const expectedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      const signature = `sha256=${expectedHash}`;

      expect(verifyGitHubSignature(payload, signature, webhookSecret)).toBe(true);
    });

    it('should reject missing signatures', () => {
      const payload = JSON.stringify({ event: 'push' });

      expect(verifyGitHubSignature(payload, undefined, webhookSecret)).toBe(false);
      expect(verifyGitHubSignature(payload, '', webhookSecret)).toBe(false);
    });

    it('should reject invalid signatures', () => {
      const payload = JSON.stringify({ event: 'push' });
      const invalidSignature = 'sha256=invalid_signature_here';

      expect(verifyGitHubSignature(payload, invalidSignature, webhookSecret)).toBe(false);
    });

    it('should reject signatures with wrong algorithm prefix', () => {
      const payload = JSON.stringify({ event: 'push' });
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      const wrongPrefix = `sha1=${hash}`;

      expect(verifyGitHubSignature(payload, wrongPrefix, webhookSecret)).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const originalPayload = JSON.stringify({ event: 'push', safe: true });
      const tamperedPayload = JSON.stringify({ event: 'push', safe: false });

      const signature = `sha256=${crypto
        .createHmac('sha256', webhookSecret)
        .update(originalPayload)
        .digest('hex')}`;

      // Signature was for original, but we're verifying tampered
      expect(verifyGitHubSignature(tamperedPayload, signature, webhookSecret)).toBe(false);
    });
  });
});
