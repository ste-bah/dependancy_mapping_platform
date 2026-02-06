/**
 * Rate Limiting Security Tests
 * @module tests/security/rate-limiting
 *
 * Tests for rate limiting protection against DoS,
 * brute force, and resource exhaustion attacks.
 *
 * CWE Coverage:
 * - CWE-307: Improper Restriction of Excessive Authentication Attempts
 * - CWE-770: Allocation of Resources Without Limits
 * - CWE-400: Uncontrolled Resource Consumption
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyGenerator?: (req: MockRequest) => string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface MockRequest {
  ip: string;
  path: string;
  method: string;
  userId?: string;
  headers: Record<string, string>;
}

/**
 * Simple in-memory rate limiter for testing
 */
class RateLimiter {
  private requests: Map<string, { count: number; windowStart: number }> = new Map();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: config.keyGenerator || ((req: MockRequest) => req.ip),
      skipFailedRequests: config.skipFailedRequests || false,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    };
  }

  check(request: MockRequest): RateLimitResult {
    const key = this.config.keyGenerator(request);
    const now = Date.now();

    let record = this.requests.get(key);

    // Reset window if expired
    if (!record || now - record.windowStart >= this.config.windowMs) {
      record = { count: 0, windowStart: now };
      this.requests.set(key, record);
    }

    const resetAt = record.windowStart + this.config.windowMs;

    if (record.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    record.count++;
    const remaining = Math.max(0, this.config.maxRequests - record.count);

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  clear(): void {
    this.requests.clear();
  }
}

/**
 * Specialized rate limiter for authentication endpoints
 */
class AuthRateLimiter {
  private failedAttempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();
  private config: {
    maxAttempts: number;
    windowMs: number;
    lockoutMs: number;
    progressiveDelay: boolean;
  };

  constructor(config: {
    maxAttempts?: number;
    windowMs?: number;
    lockoutMs?: number;
    progressiveDelay?: boolean;
  } = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 5,
      windowMs: config.windowMs || 15 * 60 * 1000, // 15 minutes
      lockoutMs: config.lockoutMs || 30 * 60 * 1000, // 30 minutes
      progressiveDelay: config.progressiveDelay || true,
    };
  }

  recordFailure(identifier: string): {
    locked: boolean;
    attemptsRemaining: number;
    unlockAt?: number;
  } {
    const now = Date.now();
    let record = this.failedAttempts.get(identifier);

    if (!record || now - record.lastAttempt >= this.config.windowMs) {
      record = { count: 0, lastAttempt: now };
    }

    record.count++;
    record.lastAttempt = now;

    if (record.count >= this.config.maxAttempts) {
      record.lockedUntil = now + this.config.lockoutMs;
      this.failedAttempts.set(identifier, record);

      return {
        locked: true,
        attemptsRemaining: 0,
        unlockAt: record.lockedUntil,
      };
    }

    this.failedAttempts.set(identifier, record);

    return {
      locked: false,
      attemptsRemaining: this.config.maxAttempts - record.count,
    };
  }

  isLocked(identifier: string): { locked: boolean; unlockAt?: number } {
    const record = this.failedAttempts.get(identifier);
    const now = Date.now();

    if (!record || !record.lockedUntil) {
      return { locked: false };
    }

    if (now >= record.lockedUntil) {
      this.failedAttempts.delete(identifier);
      return { locked: false };
    }

    return {
      locked: true,
      unlockAt: record.lockedUntil,
    };
  }

  recordSuccess(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }

  getDelay(identifier: string): number {
    if (!this.config.progressiveDelay) {
      return 0;
    }

    const record = this.failedAttempts.get(identifier);
    if (!record) {
      return 0;
    }

    // Progressive delay: 2^attempts seconds (capped at 60 seconds)
    return Math.min(Math.pow(2, record.count) * 1000, 60000);
  }

  clear(): void {
    this.failedAttempts.clear();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Rate Limiting', () => {
  describe('General Rate Limiting', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 60000, // 1 minute
        maxRequests: 100,
      });
    });

    afterEach(() => {
      rateLimiter.clear();
    });

    it('should allow requests under the limit', () => {
      const request: MockRequest = {
        ip: '192.168.1.1',
        path: '/api/data',
        method: 'GET',
        headers: {},
      };

      for (let i = 0; i < 50; i++) {
        const result = rateLimiter.check(request);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(100 - i - 1);
      }
    });

    it('should block requests over the limit', () => {
      const request: MockRequest = {
        ip: '192.168.1.2',
        path: '/api/data',
        method: 'GET',
        headers: {},
      };

      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        rateLimiter.check(request);
      }

      // Next request should be blocked
      const result = rateLimiter.check(request);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track limits per IP', () => {
      const request1: MockRequest = {
        ip: '192.168.1.10',
        path: '/api/data',
        method: 'GET',
        headers: {},
      };

      const request2: MockRequest = {
        ip: '192.168.1.20',
        path: '/api/data',
        method: 'GET',
        headers: {},
      };

      // IP 1 makes 100 requests (exhausts limit)
      for (let i = 0; i < 100; i++) {
        rateLimiter.check(request1);
      }

      // IP 1 is blocked
      expect(rateLimiter.check(request1).allowed).toBe(false);

      // IP 2 should still be allowed
      expect(rateLimiter.check(request2).allowed).toBe(true);
    });

    it('should support custom key generation', () => {
      const userBasedLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: (req) => req.userId || req.ip,
      });

      const user1Request: MockRequest = {
        ip: '192.168.1.1',
        path: '/api/data',
        method: 'GET',
        userId: 'user-1',
        headers: {},
      };

      const user2Request: MockRequest = {
        ip: '192.168.1.1', // Same IP
        path: '/api/data',
        method: 'GET',
        userId: 'user-2',
        headers: {},
      };

      // Exhaust user-1's limit
      for (let i = 0; i < 10; i++) {
        userBasedLimiter.check(user1Request);
      }

      // User-1 is blocked
      expect(userBasedLimiter.check(user1Request).allowed).toBe(false);

      // User-2 (same IP) should still be allowed
      expect(userBasedLimiter.check(user2Request).allowed).toBe(true);
    });

    it('should include rate limit headers in response', () => {
      const request: MockRequest = {
        ip: '192.168.1.100',
        path: '/api/data',
        method: 'GET',
        headers: {},
      };

      const result = rateLimiter.check(request);

      // These values should be included in response headers
      expect(result.remaining).toBeDefined();
      expect(result.resetAt).toBeDefined();
      expect(typeof result.resetAt).toBe('number');
    });
  });

  describe('Authentication Rate Limiting', () => {
    let authLimiter: AuthRateLimiter;

    beforeEach(() => {
      authLimiter = new AuthRateLimiter({
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        lockoutMs: 30 * 60 * 1000,
        progressiveDelay: true,
      });
    });

    afterEach(() => {
      authLimiter.clear();
    });

    it('should allow authentication attempts under the limit', () => {
      const identifier = 'user@example.com';

      for (let i = 0; i < 4; i++) {
        const result = authLimiter.recordFailure(identifier);
        expect(result.locked).toBe(false);
        expect(result.attemptsRemaining).toBe(4 - i);
      }
    });

    it('should lock account after too many failed attempts', () => {
      const identifier = 'attacker@example.com';

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        authLimiter.recordFailure(identifier);
      }

      // Account should now be locked
      const lockStatus = authLimiter.isLocked(identifier);
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.unlockAt).toBeDefined();
    });

    it('should implement progressive delay', () => {
      const identifier = 'slowdown@example.com';

      // First failure - small delay
      authLimiter.recordFailure(identifier);
      const delay1 = authLimiter.getDelay(identifier);

      // Second failure - larger delay
      authLimiter.recordFailure(identifier);
      const delay2 = authLimiter.getDelay(identifier);

      // Third failure - even larger delay
      authLimiter.recordFailure(identifier);
      const delay3 = authLimiter.getDelay(identifier);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap progressive delay at maximum', () => {
      const identifier = 'maxdelay@example.com';

      // Many failures
      for (let i = 0; i < 10; i++) {
        authLimiter.recordFailure(identifier);
      }

      const delay = authLimiter.getDelay(identifier);
      expect(delay).toBeLessThanOrEqual(60000); // 60 seconds max
    });

    it('should reset on successful authentication', () => {
      const identifier = 'reset@example.com';

      // Make some failed attempts
      for (let i = 0; i < 3; i++) {
        authLimiter.recordFailure(identifier);
      }

      // Successful login
      authLimiter.recordSuccess(identifier);

      // Should be reset
      const lockStatus = authLimiter.isLocked(identifier);
      expect(lockStatus.locked).toBe(false);

      const delay = authLimiter.getDelay(identifier);
      expect(delay).toBe(0);
    });

    it('should track by identifier (email/username)', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Lock user1
      for (let i = 0; i < 5; i++) {
        authLimiter.recordFailure(email1);
      }

      // User1 locked
      expect(authLimiter.isLocked(email1).locked).toBe(true);

      // User2 not affected
      expect(authLimiter.isLocked(email2).locked).toBe(false);
    });
  });

  describe('Endpoint-Specific Rate Limits', () => {
    it('should apply stricter limits to sensitive endpoints', () => {
      interface EndpointConfig {
        path: string;
        maxRequests: number;
        windowMs: number;
      }

      const endpointConfigs: EndpointConfig[] = [
        { path: '/api/auth/login', maxRequests: 5, windowMs: 60000 },
        { path: '/api/auth/register', maxRequests: 3, windowMs: 60000 },
        { path: '/api/auth/forgot-password', maxRequests: 3, windowMs: 60000 },
        { path: '/api/scans', maxRequests: 100, windowMs: 60000 },
        { path: '/api/data', maxRequests: 1000, windowMs: 60000 },
      ];

      function getEndpointLimit(path: string): EndpointConfig | undefined {
        return endpointConfigs.find(c =>
          path.startsWith(c.path) || path === c.path
        );
      }

      // Auth endpoints should have stricter limits
      const loginLimit = getEndpointLimit('/api/auth/login');
      const dataLimit = getEndpointLimit('/api/data');

      expect(loginLimit?.maxRequests).toBeLessThan(dataLimit?.maxRequests || Infinity);
    });

    it('should apply different limits for different HTTP methods', () => {
      const methodLimits: Record<string, number> = {
        GET: 1000,
        POST: 100,
        PUT: 100,
        PATCH: 100,
        DELETE: 50,
      };

      function getLimitForMethod(method: string): number {
        return methodLimits[method.toUpperCase()] || 100;
      }

      // GET should have higher limit than DELETE
      expect(getLimitForMethod('GET')).toBeGreaterThan(getLimitForMethod('DELETE'));

      // Write operations should have lower limits
      expect(getLimitForMethod('POST')).toBeLessThan(getLimitForMethod('GET'));
    });
  });

  describe('Distributed Rate Limiting', () => {
    /**
     * Mock Redis-based rate limiter for distributed environments
     */
    class DistributedRateLimiter {
      private store: Map<string, { count: number; expiresAt: number }> = new Map();

      constructor(
        private config: { windowMs: number; maxRequests: number }
      ) {}

      async check(key: string): Promise<RateLimitResult> {
        const now = Date.now();
        let record = this.store.get(key);

        if (!record || now >= record.expiresAt) {
          record = {
            count: 0,
            expiresAt: now + this.config.windowMs,
          };
        }

        if (record.count >= this.config.maxRequests) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: record.expiresAt,
            retryAfter: Math.ceil((record.expiresAt - now) / 1000),
          };
        }

        record.count++;
        this.store.set(key, record);

        return {
          allowed: true,
          remaining: this.config.maxRequests - record.count,
          resetAt: record.expiresAt,
        };
      }

      // In production, this would use Redis INCR with EXPIRE
      async increment(key: string): Promise<number> {
        const record = this.store.get(key);
        if (record) {
          record.count++;
          return record.count;
        }
        return 1;
      }
    }

    it('should support distributed rate limiting', async () => {
      const limiter = new DistributedRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });

      const key = 'user:123:api';

      // Simulate requests from multiple servers
      const results = await Promise.all([
        limiter.check(key),
        limiter.check(key),
        limiter.check(key),
      ]);

      // All should be counted together
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(3);
    });

    it('should handle concurrent requests atomically', async () => {
      const limiter = new DistributedRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const key = 'concurrent:test';

      // Simulate 10 concurrent requests
      const requests = Array(10).fill(null).map(() => limiter.check(key));
      const results = await Promise.all(requests);

      // Only 5 should be allowed
      const allowedCount = results.filter(r => r.allowed).length;
      expect(allowedCount).toBe(5);
    });
  });

  describe('Bypass Protection', () => {
    it('should not be bypassed by X-Forwarded-For spoofing', () => {
      function getClientIP(request: MockRequest): string {
        // In production, only trust proxy headers from known proxies
        const trustedProxies = ['10.0.0.1', '10.0.0.2'];

        if (trustedProxies.includes(request.ip)) {
          // Only then trust X-Forwarded-For
          const xff = request.headers['x-forwarded-for'];
          if (xff) {
            // Take the first (client) IP
            return xff.split(',')[0].trim();
          }
        }

        // Default to direct connection IP
        return request.ip;
      }

      // Request from untrusted source with spoofed header
      const spoofedRequest: MockRequest = {
        ip: '192.168.1.100', // Actual IP (not trusted proxy)
        path: '/api/data',
        method: 'GET',
        headers: {
          'x-forwarded-for': '8.8.8.8', // Attempted spoof
        },
      };

      // Should use actual IP, not spoofed header
      const clientIP = getClientIP(spoofedRequest);
      expect(clientIP).toBe('192.168.1.100');
      expect(clientIP).not.toBe('8.8.8.8');

      // Request from trusted proxy
      const legitimateRequest: MockRequest = {
        ip: '10.0.0.1', // Trusted proxy
        path: '/api/data',
        method: 'GET',
        headers: {
          'x-forwarded-for': '203.0.113.50',
        },
      };

      const legitimateIP = getClientIP(legitimateRequest);
      expect(legitimateIP).toBe('203.0.113.50');
    });

    it('should handle multiple rate limit keys for defense in depth', () => {
      interface MultiKeyLimiter {
        byIP: RateLimiter;
        byUser: RateLimiter;
        byEndpoint: RateLimiter;
        global: RateLimiter;
      }

      function checkAllLimits(
        limiters: MultiKeyLimiter,
        request: MockRequest
      ): RateLimitResult {
        const checks = [
          limiters.byIP.check(request),
          limiters.byEndpoint.check({
            ...request,
            ip: request.path, // Use path as key
          }),
          limiters.global.check({
            ...request,
            ip: 'global', // Single key for global limit
          }),
        ];

        if (request.userId) {
          checks.push(
            limiters.byUser.check({
              ...request,
              ip: request.userId,
            })
          );
        }

        // Any limit exceeded = blocked
        const blocked = checks.find(r => !r.allowed);
        if (blocked) {
          return blocked;
        }

        // Return the most restrictive remaining
        const minRemaining = Math.min(...checks.map(r => r.remaining));
        const minResetAt = Math.min(...checks.map(r => r.resetAt));

        return {
          allowed: true,
          remaining: minRemaining,
          resetAt: minResetAt,
        };
      }

      const limiters: MultiKeyLimiter = {
        byIP: new RateLimiter({ windowMs: 60000, maxRequests: 100 }),
        byUser: new RateLimiter({ windowMs: 60000, maxRequests: 1000 }),
        byEndpoint: new RateLimiter({ windowMs: 60000, maxRequests: 10000 }),
        global: new RateLimiter({ windowMs: 60000, maxRequests: 100000 }),
      };

      const request: MockRequest = {
        ip: '192.168.1.1',
        path: '/api/data',
        method: 'GET',
        userId: 'user-123',
        headers: {},
      };

      const result = checkAllLimits(limiters, request);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Rate Limit Response Handling', () => {
    it('should return proper 429 response structure', () => {
      interface RateLimitResponse {
        statusCode: number;
        error: string;
        message: string;
        retryAfter: number;
      }

      function buildRateLimitResponse(result: RateLimitResult): RateLimitResponse {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter || 60,
        };
      }

      const blockedResult: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
        retryAfter: 30,
      };

      const response = buildRateLimitResponse(blockedResult);

      expect(response.statusCode).toBe(429);
      expect(response.error).toBe('Too Many Requests');
      expect(response.retryAfter).toBe(30);
    });

    it('should include rate limit headers in all responses', () => {
      function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
        const headers: Record<string, string> = {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        };

        if (!result.allowed && result.retryAfter) {
          headers['Retry-After'] = String(result.retryAfter);
        }

        return headers;
      }

      const result: RateLimitResult = {
        allowed: true,
        remaining: 95,
        resetAt: Date.now() + 45000,
      };

      const headers = buildRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBeDefined();
      expect(headers['X-RateLimit-Remaining']).toBe('95');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should limit request body size', () => {
      const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

      function validateBodySize(contentLength: number | undefined): {
        allowed: boolean;
        maxSize: number;
      } {
        return {
          allowed: (contentLength || 0) <= MAX_BODY_SIZE,
          maxSize: MAX_BODY_SIZE,
        };
      }

      expect(validateBodySize(1000).allowed).toBe(true);
      expect(validateBodySize(50 * 1024 * 1024).allowed).toBe(false);
      expect(validateBodySize(undefined).allowed).toBe(true);
    });

    it('should limit query complexity', () => {
      interface Query {
        fields: string[];
        filters: number;
        sorts: number;
        includes: string[];
        depth: number;
      }

      function validateQueryComplexity(query: Query): {
        allowed: boolean;
        complexity: number;
        maxComplexity: number;
      } {
        const MAX_COMPLEXITY = 100;

        // Calculate complexity score
        const complexity =
          query.fields.length * 1 +
          query.filters * 2 +
          query.sorts * 2 +
          query.includes.length * 10 +
          query.depth * 5;

        return {
          allowed: complexity <= MAX_COMPLEXITY,
          complexity,
          maxComplexity: MAX_COMPLEXITY,
        };
      }

      // Simple query
      const simpleQuery: Query = {
        fields: ['id', 'name'],
        filters: 1,
        sorts: 1,
        includes: [],
        depth: 1,
      };
      expect(validateQueryComplexity(simpleQuery).allowed).toBe(true);

      // Complex query
      const complexQuery: Query = {
        fields: Array(20).fill('field'),
        filters: 10,
        sorts: 5,
        includes: ['relation1', 'relation2', 'relation3', 'relation4', 'relation5'],
        depth: 5,
      };
      expect(validateQueryComplexity(complexQuery).allowed).toBe(false);
    });

    it('should limit concurrent connections per client', () => {
      const MAX_CONCURRENT = 10;
      const connectionCounts: Map<string, number> = new Map();

      function trackConnection(clientId: string): {
        allowed: boolean;
        current: number;
        max: number;
      } {
        const current = connectionCounts.get(clientId) || 0;

        if (current >= MAX_CONCURRENT) {
          return { allowed: false, current, max: MAX_CONCURRENT };
        }

        connectionCounts.set(clientId, current + 1);
        return { allowed: true, current: current + 1, max: MAX_CONCURRENT };
      }

      function releaseConnection(clientId: string): void {
        const current = connectionCounts.get(clientId) || 0;
        if (current > 0) {
          connectionCounts.set(clientId, current - 1);
        }
      }

      const clientId = 'client-abc';

      // Open 10 connections
      for (let i = 0; i < 10; i++) {
        expect(trackConnection(clientId).allowed).toBe(true);
      }

      // 11th connection should be blocked
      expect(trackConnection(clientId).allowed).toBe(false);

      // Release one and try again
      releaseConnection(clientId);
      expect(trackConnection(clientId).allowed).toBe(true);
    });
  });
});
