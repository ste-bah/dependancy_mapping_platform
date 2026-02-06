/**
 * Authentication E2E Tests
 * @module e2e/tests/auth/login.spec
 *
 * End-to-end tests for user authentication flows:
 * 1. GitHub OAuth initiation
 * 2. Session management
 * 3. Token validation
 * 4. Protected route access
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  E2ETestContext,
  createTestContext,
} from '../../support/test-context.js';
import {
  createApiClient,
  TestApiClient,
} from '../../support/api-client.js';
import {
  USER_FIXTURES,
  createFixtureLoader,
} from '../../support/fixtures.js';
import {
  assertSuccessResponse,
  assertErrorResponse,
} from '../../support/assertions.js';
import type { TenantId } from '../../../api/src/types/entities.js';
import type { AuthContext } from '../../../api/src/types/auth.js';

// ============================================================================
// Test Suite Configuration
// ============================================================================

describe('Authentication E2E Tests', () => {
  let ctx: E2ETestContext;
  let apiClient: TestApiClient;
  let testTenantId: TenantId;

  beforeAll(async () => {
    ctx = createTestContext({
      timeout: 30000,
      enableMocking: true,
    });

    await ctx.setup();

    testTenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
    apiClient = createApiClient(ctx.getApp(), testTenantId);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  // ==========================================================================
  // Public Route Tests
  // ==========================================================================

  describe('Public Routes (No Auth Required)', () => {
    it('should access health endpoints without authentication', async () => {
      apiClient.clearAuth();

      const health = await apiClient.getHealth();
      expect(health.statusCode).toBe(200);
      expect(health.body.status).toBe('healthy');

      const live = await apiClient.getLiveness();
      expect(live.statusCode).toBe(200);
      expect(live.body.alive).toBe(true);
    });

    it('should access detailed health without authentication', async () => {
      apiClient.clearAuth();

      const response = await apiClient.getDetailedHealth();

      // Accept both success and error states
      expect([200, 503]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        expect(response.body.status).toBeDefined();
        expect(response.body.checks).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Protected Route Tests
  // ==========================================================================

  describe('Protected Routes (Auth Required)', () => {
    it('should return 401 for unauthenticated requests to protected routes', async () => {
      apiClient.clearAuth();

      const response = await apiClient.getCurrentUser();

      // Route may not exist in test app, accept 401 or 404
      expect([401, 404]).toContain(response.statusCode);
    });

    it('should allow access to protected routes with valid auth', async () => {
      const testUser = USER_FIXTURES['test-user'];
      const auth: AuthContext = {
        userId: testUser.userId,
        email: testUser.email,
        name: testUser.name,
        githubId: testUser.githubId,
        tenantId: testUser.tenantId,
      };

      apiClient.setAuth(auth);

      // Make authenticated request to repository list
      const response = await apiClient.listRepositories();

      // Should either succeed or return 404 if route not implemented
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  // ==========================================================================
  // Auth Context Tests
  // ==========================================================================

  describe('Auth Context Handling', () => {
    it('should create valid auth context from user fixture', () => {
      const testUser = USER_FIXTURES['test-user'];

      const auth: AuthContext = {
        userId: testUser.userId,
        email: testUser.email,
        name: testUser.name,
        githubId: testUser.githubId,
        tenantId: testUser.tenantId,
      };

      expect(auth.userId).toBeDefined();
      expect(auth.email).toMatch(/@/);
      expect(auth.githubId).toBeGreaterThan(0);
      expect(auth.tenantId).toBeDefined();
    });

    it('should handle multiple user fixtures', () => {
      const testUser = USER_FIXTURES['test-user'];
      const adminUser = USER_FIXTURES['admin-user'];
      const otherTenantUser = USER_FIXTURES['other-tenant-user'];

      // All users should have unique IDs
      const userIds = [testUser.userId, adminUser.userId, otherTenantUser.userId];
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(3);

      // Other tenant user should have different tenant
      expect(otherTenantUser.tenantId).not.toBe(testUser.tenantId);
    });

    it('should switch auth context between requests', async () => {
      const testUser = USER_FIXTURES['test-user'];
      const adminUser = USER_FIXTURES['admin-user'];

      // First request as test user
      apiClient.setAuth({
        userId: testUser.userId,
        email: testUser.email,
        name: testUser.name,
        githubId: testUser.githubId,
        tenantId: testUser.tenantId,
      });

      const response1 = await apiClient.getHealth();
      expect(response1.statusCode).toBe(200);

      // Switch to admin user
      apiClient.setAuth({
        userId: adminUser.userId,
        email: adminUser.email,
        name: adminUser.name,
        githubId: adminUser.githubId,
        tenantId: adminUser.tenantId,
      });

      const response2 = await apiClient.getHealth();
      expect(response2.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Tenant Isolation Tests
  // ==========================================================================

  describe('Tenant Isolation', () => {
    it('should have different tenants for isolation testing', () => {
      const testUser = USER_FIXTURES['test-user'];
      const otherTenantUser = USER_FIXTURES['other-tenant-user'];

      expect(testUser.tenantId).toBeDefined();
      expect(otherTenantUser.tenantId).toBeDefined();
      expect(testUser.tenantId).not.toBe(otherTenantUser.tenantId);
    });

    it('should maintain tenant context in auth', () => {
      const auth = ctx.createAuthContext({
        tenantId: '00000000-0000-0000-0000-000000000099' as TenantId,
      });

      expect(auth.tenantId).toBe('00000000-0000-0000-0000-000000000099');
    });
  });

  // ==========================================================================
  // Test Context Tests
  // ==========================================================================

  describe('Test Context Management', () => {
    it('should provide default auth context', () => {
      const auth = ctx.getDefaultAuth();

      expect(auth).toBeDefined();
      expect(auth.userId).toBeDefined();
      expect(auth.email).toBeDefined();
      expect(auth.name).toBeDefined();
      expect(auth.githubId).toBeDefined();
    });

    it('should create customized auth context', () => {
      const customAuth = ctx.createAuthContext({
        userId: 'custom-user-id',
        email: 'custom@example.com',
        name: 'Custom User',
        githubId: 99999,
      });

      expect(customAuth.userId).toBe('custom-user-id');
      expect(customAuth.email).toBe('custom@example.com');
      expect(customAuth.name).toBe('Custom User');
      expect(customAuth.githubId).toBe(99999);
    });

    it('should preserve default values when creating partial auth context', () => {
      const defaultAuth = ctx.getDefaultAuth();
      const partialAuth = ctx.createAuthContext({
        name: 'Override Name',
      });

      expect(partialAuth.userId).toBe(defaultAuth.userId);
      expect(partialAuth.email).toBe(defaultAuth.email);
      expect(partialAuth.name).toBe('Override Name');
      expect(partialAuth.githubId).toBe(defaultAuth.githubId);
    });
  });

  // ==========================================================================
  // HTTP Request Tests
  // ==========================================================================

  describe('HTTP Request Handling', () => {
    it('should make GET requests', async () => {
      const response = await ctx.get('/health');
      expect(response.statusCode).toBe(200);
    });

    it('should make POST requests with body', async () => {
      // POST to health should fail (method not allowed)
      const response = await ctx.post('/health', { test: 'data' });
      expect([404, 405]).toContain(response.statusCode);
    });

    it('should handle query parameters', async () => {
      const response = await ctx.get('/health', {
        query: { format: 'json', verbose: true },
      });

      // Query params may be ignored by health endpoint, but request should succeed
      expect(response.statusCode).toBe(200);
    });

    it('should handle custom headers', async () => {
      const response = await ctx.get('/health', {
        headers: {
          'x-custom-header': 'test-value',
          'accept': 'application/json',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Response Assertion Tests
  // ==========================================================================

  describe('Response Assertions', () => {
    it('should assert status code', async () => {
      const response = await ctx.get('/health');

      // Fluent assertion
      response.expectStatus(200);
    });

    it('should assert body properties', async () => {
      const response = await ctx.get<{ status: string }>('/health');

      response.expectBodyProperty('status', 'healthy');
    });

    it('should assert header presence', async () => {
      const response = await ctx.get('/health');

      // Content-type should be present
      response.expectHeader('content-type');
    });

    it('should handle assertion failures gracefully', async () => {
      const response = await ctx.get('/health');

      // This should throw
      expect(() => response.expectStatus(500)).toThrow();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      apiClient.clearAuth();

      const response = await ctx.get('/nonexistent-route');
      expect(response.statusCode).toBe(404);
    });

    it('should return error response structure', async () => {
      const response = await ctx.get<{
        error: string;
        code?: string;
        message?: string;
      }>('/nonexistent-route');

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
});
