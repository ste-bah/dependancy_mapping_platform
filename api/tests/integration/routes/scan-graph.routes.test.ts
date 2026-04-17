/**
 * Scan and Graph Route Registration Tests
 * @module tests/integration/routes/scan-graph.routes
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '@/app';

/**
 * These tests verify that the route surface is mounted and protected.
 * Full authenticated persistence-backed coverage still needs a dedicated
 * test database and auth fixture harness.
 */
describe('Scan and Graph Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({
      tenantContext: false,
      swagger: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers scan list route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/scans',
    });

    expect(response.statusCode).toBe(401);
  });

  it('registers scan create route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        repositoryId: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('registers scan detail and status routes', async () => {
    const [detailResponse, statusResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-000000000001',
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-000000000001/status',
      }),
    ]);

    expect(detailResponse.statusCode).toBe(401);
    expect(statusResponse.statusCode).toBe(401);
  });

  it('registers graph query routes', async () => {
    const scanId = '00000000-0000-0000-0000-000000000001';
    const nodeId = '00000000-0000-0000-0000-000000000002';

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/graph` }),
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/nodes` }),
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/nodes/${nodeId}` }),
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/nodes/${nodeId}/dependencies` }),
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/nodes/${nodeId}/dependents` }),
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/edges` }),
      app.inject({ method: 'GET', url: `/api/v1/scans/${scanId}/cycles` }),
      app.inject({
        method: 'POST',
        url: `/api/v1/scans/${scanId}/impact`,
        payload: { nodeIds: [nodeId] },
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });
});
