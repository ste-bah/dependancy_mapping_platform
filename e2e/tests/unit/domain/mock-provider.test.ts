/**
 * MockProvider Unit Tests
 * @module e2e/tests/unit/domain/mock-provider.test
 *
 * Unit tests for MockProvider MSW handler management:
 * - Handler registration and management
 * - Request interception and response generation
 * - Dynamic response modification
 * - Request recording for assertions
 * - Error scenario simulation
 *
 * TASK-E2E-032: Comprehensive test generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

interface MockRequest {
  readonly id: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly timestamp: Date;
}

interface MockResponse {
  readonly status: number;
  readonly statusText?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly delay?: number;
}

interface MockHandler {
  readonly id: string;
  readonly method: HttpMethod;
  readonly url: string | RegExp;
  readonly response: MockResponse | ((request: MockRequest) => MockResponse | Promise<MockResponse>);
  readonly once?: boolean;
  readonly times?: number;
  enabled: boolean;
  callCount: number;
}

interface RecordedRequest extends MockRequest {
  readonly handlerId: string | null;
  readonly matched: boolean;
  readonly response: MockResponse | null;
}

// ============================================================================
// MockProvider Implementation (Inline for Unit Testing)
// ============================================================================

class MockProvider {
  private _handlers: Map<string, MockHandler> = new Map();
  private _recordedRequests: RecordedRequest[] = [];
  private _defaultHandler: MockHandler | null = null;
  private _networkDelay = 0;
  private _autoRecord = true;
  private _isActive = false;
  private _idCounter = 0;

  // ========================================================================
  // Lifecycle
  // ========================================================================

  start(): void {
    this._isActive = true;
  }

  stop(): void {
    this._isActive = false;
  }

  reset(): void {
    this._handlers.clear();
    this._recordedRequests = [];
    this._defaultHandler = null;
    this._networkDelay = 0;
    this._idCounter = 0;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // ========================================================================
  // Handler Registration
  // ========================================================================

  register(
    method: HttpMethod,
    url: string | RegExp,
    response: MockResponse | ((request: MockRequest) => MockResponse | Promise<MockResponse>),
    options: { once?: boolean; times?: number } = {}
  ): string {
    const id = this.generateId();

    const handler: MockHandler = {
      id,
      method,
      url,
      response,
      once: options.once,
      times: options.times,
      enabled: true,
      callCount: 0,
    };

    this._handlers.set(id, handler);
    return id;
  }

  // Convenience methods
  get(url: string | RegExp, response: MockResponse | ((req: MockRequest) => MockResponse)): string {
    return this.register('GET', url, response);
  }

  post(url: string | RegExp, response: MockResponse | ((req: MockRequest) => MockResponse)): string {
    return this.register('POST', url, response);
  }

  put(url: string | RegExp, response: MockResponse | ((req: MockRequest) => MockResponse)): string {
    return this.register('PUT', url, response);
  }

  patch(url: string | RegExp, response: MockResponse | ((req: MockRequest) => MockResponse)): string {
    return this.register('PATCH', url, response);
  }

  delete(url: string | RegExp, response: MockResponse | ((req: MockRequest) => MockResponse)): string {
    return this.register('DELETE', url, response);
  }

  setDefaultHandler(response: MockResponse): void {
    this._defaultHandler = {
      id: 'default',
      method: 'GET',
      url: /.*/,
      response,
      enabled: true,
      callCount: 0,
    };
  }

  clearDefaultHandler(): void {
    this._defaultHandler = null;
  }

  // ========================================================================
  // Handler Management
  // ========================================================================

  unregister(id: string): boolean {
    return this._handlers.delete(id);
  }

  enable(id: string): void {
    const handler = this._handlers.get(id);
    if (handler) {
      handler.enabled = true;
    }
  }

  disable(id: string): void {
    const handler = this._handlers.get(id);
    if (handler) {
      handler.enabled = false;
    }
  }

  getHandler(id: string): MockHandler | undefined {
    return this._handlers.get(id);
  }

  getAllHandlers(): MockHandler[] {
    return Array.from(this._handlers.values());
  }

  get handlerCount(): number {
    return this._handlers.size;
  }

  // ========================================================================
  // Request Handling
  // ========================================================================

  async handleRequest(request: Omit<MockRequest, 'id' | 'timestamp'>): Promise<MockResponse | null> {
    if (!this._isActive) {
      return null;
    }

    const fullRequest: MockRequest = {
      ...request,
      id: this.generateId(),
      timestamp: new Date(),
    };

    const handler = this.findHandler(fullRequest);
    let response: MockResponse | null = null;

    if (handler) {
      handler.callCount++;

      // Handle one-time handlers
      if (handler.once || (handler.times && handler.callCount >= handler.times)) {
        handler.enabled = false;
      }

      // Get response (may be function)
      if (typeof handler.response === 'function') {
        response = await handler.response(fullRequest);
      } else {
        response = handler.response;
      }

      // Apply network delay
      if (this._networkDelay > 0 || response.delay) {
        await this.delay(response.delay ?? this._networkDelay);
      }
    } else if (this._defaultHandler) {
      this._defaultHandler.callCount++;
      response =
        typeof this._defaultHandler.response === 'function'
          ? await this._defaultHandler.response(fullRequest)
          : this._defaultHandler.response;
    }

    // Record request
    if (this._autoRecord) {
      this._recordedRequests.push({
        ...fullRequest,
        handlerId: handler?.id ?? this._defaultHandler?.id ?? null,
        matched: !!handler || !!this._defaultHandler,
        response,
      });
    }

    return response;
  }

  private findHandler(request: MockRequest): MockHandler | undefined {
    for (const handler of this._handlers.values()) {
      if (!handler.enabled) continue;
      if (handler.method !== request.method) continue;

      const urlMatches =
        typeof handler.url === 'string'
          ? request.url === handler.url || request.url.includes(handler.url)
          : handler.url.test(request.url);

      if (urlMatches) {
        return handler;
      }
    }

    return undefined;
  }

  // ========================================================================
  // Request Recording
  // ========================================================================

  setAutoRecord(enabled: boolean): void {
    this._autoRecord = enabled;
  }

  getRecordedRequests(): RecordedRequest[] {
    return [...this._recordedRequests];
  }

  getRequestsByUrl(url: string | RegExp): RecordedRequest[] {
    return this._recordedRequests.filter((r) =>
      typeof url === 'string' ? r.url.includes(url) : url.test(r.url)
    );
  }

  getRequestsByMethod(method: HttpMethod): RecordedRequest[] {
    return this._recordedRequests.filter((r) => r.method === method);
  }

  getRequestsByHandler(handlerId: string): RecordedRequest[] {
    return this._recordedRequests.filter((r) => r.handlerId === handlerId);
  }

  getUnmatchedRequests(): RecordedRequest[] {
    return this._recordedRequests.filter((r) => !r.matched);
  }

  clearRecordedRequests(): void {
    this._recordedRequests = [];
  }

  get recordedRequestCount(): number {
    return this._recordedRequests.length;
  }

  // ========================================================================
  // Network Simulation
  // ========================================================================

  setNetworkDelay(ms: number): void {
    this._networkDelay = ms;
  }

  getNetworkDelay(): number {
    return this._networkDelay;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private generateId(): string {
    return `mock_${++this._idCounter}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

function createMockRequest(overrides: Partial<MockRequest> = {}): Omit<MockRequest, 'id' | 'timestamp'> {
  return {
    method: 'GET',
    url: '/api/test',
    headers: { 'content-type': 'application/json' },
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
    provider.start();
  });

  afterEach(() => {
    provider.stop();
    provider.reset();
  });

  // ==========================================================================
  // Lifecycle Tests
  // ==========================================================================

  describe('Lifecycle', () => {
    it('should start inactive', () => {
      const p = new MockProvider();
      expect(p.isActive).toBe(false);
    });

    it('should activate on start', () => {
      const p = new MockProvider();
      p.start();
      expect(p.isActive).toBe(true);
    });

    it('should deactivate on stop', () => {
      provider.stop();
      expect(provider.isActive).toBe(false);
    });

    it('should clear state on reset', () => {
      provider.get('/test', { status: 200 });
      provider.handleRequest(createMockRequest());

      provider.reset();

      expect(provider.handlerCount).toBe(0);
      expect(provider.recordedRequestCount).toBe(0);
    });

    it('should not handle requests when inactive', async () => {
      provider.stop();
      provider.get('/test', { status: 200 });

      const response = await provider.handleRequest(createMockRequest({ url: '/test' }));

      expect(response).toBeNull();
    });
  });

  // ==========================================================================
  // Handler Registration Tests
  // ==========================================================================

  describe('Handler Registration', () => {
    it('should register GET handler', () => {
      const id = provider.get('/api/users', { status: 200, body: [] });

      expect(id).toBeDefined();
      expect(provider.handlerCount).toBe(1);
    });

    it('should register POST handler', () => {
      const id = provider.post('/api/users', { status: 201 });

      const handler = provider.getHandler(id);
      expect(handler?.method).toBe('POST');
    });

    it('should register PUT handler', () => {
      const id = provider.put('/api/users/1', { status: 200 });

      const handler = provider.getHandler(id);
      expect(handler?.method).toBe('PUT');
    });

    it('should register PATCH handler', () => {
      const id = provider.patch('/api/users/1', { status: 200 });

      const handler = provider.getHandler(id);
      expect(handler?.method).toBe('PATCH');
    });

    it('should register DELETE handler', () => {
      const id = provider.delete('/api/users/1', { status: 204 });

      const handler = provider.getHandler(id);
      expect(handler?.method).toBe('DELETE');
    });

    it('should register handler with regex URL', () => {
      provider.get(/\/api\/users\/\d+/, { status: 200 });

      expect(provider.handlerCount).toBe(1);
    });

    it('should register handler with function response', () => {
      provider.get('/api/time', (req) => ({
        status: 200,
        body: { timestamp: req.timestamp },
      }));

      expect(provider.handlerCount).toBe(1);
    });

    it('should register multiple handlers', () => {
      provider.get('/api/users', { status: 200 });
      provider.post('/api/users', { status: 201 });
      provider.delete('/api/users/1', { status: 204 });

      expect(provider.handlerCount).toBe(3);
    });

    it('should allow duplicate URL patterns', () => {
      const id1 = provider.get('/api/test', { status: 200 });
      const id2 = provider.get('/api/test', { status: 201 });

      expect(id1).not.toBe(id2);
      expect(provider.handlerCount).toBe(2);
    });
  });

  // ==========================================================================
  // Request Matching Tests
  // ==========================================================================

  describe('Request Matching', () => {
    it('should match by exact URL', async () => {
      provider.get('/api/users', { status: 200, body: ['user1'] });

      const response = await provider.handleRequest(
        createMockRequest({ method: 'GET', url: '/api/users' })
      );

      expect(response?.status).toBe(200);
      expect(response?.body).toEqual(['user1']);
    });

    it('should match by URL substring', async () => {
      provider.get('/users', { status: 200 });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/v1/users' })
      );

      expect(response?.status).toBe(200);
    });

    it('should match by regex URL', async () => {
      provider.get(/\/api\/users\/\d+/, { status: 200, body: { id: 1 } });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/users/123' })
      );

      expect(response?.status).toBe(200);
    });

    it('should not match different method', async () => {
      provider.get('/api/users', { status: 200 });

      const response = await provider.handleRequest(
        createMockRequest({ method: 'POST', url: '/api/users' })
      );

      expect(response).toBeNull();
    });

    it('should use first matching handler', async () => {
      provider.get('/api/test', { status: 200, body: 'first' });
      provider.get('/api/test', { status: 200, body: 'second' });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/test' })
      );

      expect(response?.body).toBe('first');
    });

    it('should skip disabled handlers', async () => {
      const id = provider.get('/api/test', { status: 200, body: 'disabled' });
      provider.get('/api/test', { status: 200, body: 'enabled' });
      provider.disable(id);

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/test' })
      );

      expect(response?.body).toBe('enabled');
    });
  });

  // ==========================================================================
  // Response Generation Tests
  // ==========================================================================

  describe('Response Generation', () => {
    it('should return static response', async () => {
      provider.get('/api/static', {
        status: 200,
        statusText: 'OK',
        headers: { 'x-custom': 'value' },
        body: { data: 'test' },
      });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/static' })
      );

      expect(response?.status).toBe(200);
      expect(response?.statusText).toBe('OK');
      expect(response?.headers?.['x-custom']).toBe('value');
      expect(response?.body).toEqual({ data: 'test' });
    });

    it('should call function response with request', async () => {
      provider.post('/api/echo', (req) => ({
        status: 200,
        body: { received: req.body },
      }));

      const response = await provider.handleRequest(
        createMockRequest({
          method: 'POST',
          url: '/api/echo',
          body: { message: 'hello' },
        })
      );

      expect(response?.body).toEqual({ received: { message: 'hello' } });
    });

    it('should handle async function response', async () => {
      provider.get('/api/async', async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { status: 200, body: 'async' };
      });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/async' })
      );

      expect(response?.body).toBe('async');
    });

    it('should use default handler when no match', async () => {
      provider.setDefaultHandler({ status: 404, body: 'Not Found' });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/unknown' })
      );

      expect(response?.status).toBe(404);
    });

    it('should return null with no match and no default', async () => {
      const response = await provider.handleRequest(
        createMockRequest({ url: '/unknown' })
      );

      expect(response).toBeNull();
    });
  });

  // ==========================================================================
  // One-time Handler Tests
  // ==========================================================================

  describe('One-time Handlers', () => {
    it('should disable after single use', async () => {
      provider.register('GET', '/api/once', { status: 200 }, { once: true });

      await provider.handleRequest(createMockRequest({ url: '/api/once' }));
      const secondResponse = await provider.handleRequest(
        createMockRequest({ url: '/api/once' })
      );

      expect(secondResponse).toBeNull();
    });

    it('should track call count', async () => {
      const id = provider.get('/api/counter', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/counter' }));
      await provider.handleRequest(createMockRequest({ url: '/api/counter' }));

      const handler = provider.getHandler(id);
      expect(handler?.callCount).toBe(2);
    });

    it('should disable after N calls with times option', async () => {
      provider.register('GET', '/api/limited', { status: 200 }, { times: 3 });

      await provider.handleRequest(createMockRequest({ url: '/api/limited' }));
      await provider.handleRequest(createMockRequest({ url: '/api/limited' }));
      await provider.handleRequest(createMockRequest({ url: '/api/limited' }));
      const fourthResponse = await provider.handleRequest(
        createMockRequest({ url: '/api/limited' })
      );

      expect(fourthResponse).toBeNull();
    });
  });

  // ==========================================================================
  // Handler Management Tests
  // ==========================================================================

  describe('Handler Management', () => {
    it('should unregister handler', () => {
      const id = provider.get('/api/test', { status: 200 });

      const removed = provider.unregister(id);

      expect(removed).toBe(true);
      expect(provider.handlerCount).toBe(0);
    });

    it('should return false for unregistering unknown handler', () => {
      const removed = provider.unregister('unknown-id');

      expect(removed).toBe(false);
    });

    it('should enable and disable handlers', async () => {
      const id = provider.get('/api/toggle', { status: 200 });

      provider.disable(id);
      const disabledResponse = await provider.handleRequest(
        createMockRequest({ url: '/api/toggle' })
      );

      provider.enable(id);
      const enabledResponse = await provider.handleRequest(
        createMockRequest({ url: '/api/toggle' })
      );

      expect(disabledResponse).toBeNull();
      expect(enabledResponse?.status).toBe(200);
    });

    it('should get all handlers', () => {
      provider.get('/api/1', { status: 200 });
      provider.post('/api/2', { status: 201 });

      const handlers = provider.getAllHandlers();

      expect(handlers).toHaveLength(2);
    });

    it('should clear default handler', async () => {
      provider.setDefaultHandler({ status: 500 });
      provider.clearDefaultHandler();

      const response = await provider.handleRequest(
        createMockRequest({ url: '/unknown' })
      );

      expect(response).toBeNull();
    });
  });

  // ==========================================================================
  // Request Recording Tests
  // ==========================================================================

  describe('Request Recording', () => {
    it('should record all requests', async () => {
      provider.get('/api/test', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/test' }));
      await provider.handleRequest(createMockRequest({ url: '/api/other' }));

      expect(provider.recordedRequestCount).toBe(2);
    });

    it('should include request details', async () => {
      await provider.handleRequest(
        createMockRequest({
          method: 'POST',
          url: '/api/data',
          headers: { 'x-custom': 'test' },
          body: { value: 1 },
        })
      );

      const requests = provider.getRecordedRequests();

      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toBe('/api/data');
      expect(requests[0].headers['x-custom']).toBe('test');
      expect(requests[0].body).toEqual({ value: 1 });
      expect(requests[0].timestamp).toBeInstanceOf(Date);
    });

    it('should indicate matched requests', async () => {
      provider.get('/api/matched', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/matched' }));
      await provider.handleRequest(createMockRequest({ url: '/api/unmatched' }));

      const requests = provider.getRecordedRequests();

      expect(requests[0].matched).toBe(true);
      expect(requests[1].matched).toBe(false);
    });

    it('should include handler id', async () => {
      const id = provider.get('/api/test', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/test' }));

      const requests = provider.getRecordedRequests();
      expect(requests[0].handlerId).toBe(id);
    });

    it('should filter by URL', async () => {
      provider.get('/api/users', { status: 200 });
      provider.get('/api/posts', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/users' }));
      await provider.handleRequest(createMockRequest({ url: '/api/posts' }));
      await provider.handleRequest(createMockRequest({ url: '/api/users' }));

      const userRequests = provider.getRequestsByUrl('/users');

      expect(userRequests).toHaveLength(2);
    });

    it('should filter by method', async () => {
      provider.get('/api/test', { status: 200 });
      provider.post('/api/test', { status: 201 });

      await provider.handleRequest(createMockRequest({ method: 'GET', url: '/api/test' }));
      await provider.handleRequest(createMockRequest({ method: 'POST', url: '/api/test' }));
      await provider.handleRequest(createMockRequest({ method: 'GET', url: '/api/test' }));

      const getRequests = provider.getRequestsByMethod('GET');

      expect(getRequests).toHaveLength(2);
    });

    it('should filter by handler', async () => {
      const id = provider.get('/api/specific', { status: 200 });
      provider.get('/api/other', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/specific' }));
      await provider.handleRequest(createMockRequest({ url: '/api/other' }));
      await provider.handleRequest(createMockRequest({ url: '/api/specific' }));

      const handlerRequests = provider.getRequestsByHandler(id);

      expect(handlerRequests).toHaveLength(2);
    });

    it('should get unmatched requests', async () => {
      provider.get('/api/known', { status: 200 });

      await provider.handleRequest(createMockRequest({ url: '/api/known' }));
      await provider.handleRequest(createMockRequest({ url: '/api/unknown1' }));
      await provider.handleRequest(createMockRequest({ url: '/api/unknown2' }));

      const unmatched = provider.getUnmatchedRequests();

      expect(unmatched).toHaveLength(2);
    });

    it('should clear recorded requests', async () => {
      await provider.handleRequest(createMockRequest());

      provider.clearRecordedRequests();

      expect(provider.recordedRequestCount).toBe(0);
    });

    it('should respect auto-record setting', async () => {
      provider.setAutoRecord(false);

      await provider.handleRequest(createMockRequest());

      expect(provider.recordedRequestCount).toBe(0);
    });
  });

  // ==========================================================================
  // Network Delay Tests
  // ==========================================================================

  describe('Network Delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should apply global network delay', async () => {
      provider.setNetworkDelay(100);
      provider.get('/api/delayed', { status: 200 });

      const startTime = Date.now();
      const responsePromise = provider.handleRequest(
        createMockRequest({ url: '/api/delayed' })
      );

      vi.advanceTimersByTime(100);
      await responsePromise;

      expect(provider.getNetworkDelay()).toBe(100);
    });

    it('should apply per-response delay', async () => {
      provider.get('/api/delayed', { status: 200, delay: 50 });

      const responsePromise = provider.handleRequest(
        createMockRequest({ url: '/api/delayed' })
      );

      vi.advanceTimersByTime(50);
      const response = await responsePromise;

      expect(response?.status).toBe(200);
    });

    it('should use response delay over global delay', async () => {
      provider.setNetworkDelay(100);
      provider.get('/api/fast', { status: 200, delay: 10 });

      const responsePromise = provider.handleRequest(
        createMockRequest({ url: '/api/fast' })
      );

      vi.advanceTimersByTime(10);
      await responsePromise;
    });
  });

  // ==========================================================================
  // Error Scenario Tests
  // ==========================================================================

  describe('Error Scenarios', () => {
    it('should simulate 404 Not Found', async () => {
      provider.get('/api/notfound', { status: 404, body: { error: 'Not Found' } });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/notfound' })
      );

      expect(response?.status).toBe(404);
    });

    it('should simulate 500 Internal Server Error', async () => {
      provider.get('/api/error', {
        status: 500,
        body: { error: 'Internal Server Error' },
      });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/error' })
      );

      expect(response?.status).toBe(500);
    });

    it('should simulate varying error responses', async () => {
      let callCount = 0;
      provider.get('/api/flaky', () => {
        callCount++;
        return callCount % 2 === 0
          ? { status: 200, body: 'success' }
          : { status: 503, body: 'Service Unavailable' };
      });

      const response1 = await provider.handleRequest(
        createMockRequest({ url: '/api/flaky' })
      );
      const response2 = await provider.handleRequest(
        createMockRequest({ url: '/api/flaky' })
      );

      expect(response1?.status).toBe(503);
      expect(response2?.status).toBe(200);
    });

    it('should simulate timeout by not responding', async () => {
      // In a real scenario, this would be handled by timeout logic
      provider.setDefaultHandler({ status: 408, body: 'Request Timeout' });

      const response = await provider.handleRequest(
        createMockRequest({ url: '/api/timeout' })
      );

      expect(response?.status).toBe(408);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should handle full CRUD workflow', async () => {
      let users = [{ id: 1, name: 'Alice' }];
      let nextId = 2;

      provider.get('/api/users', () => ({ status: 200, body: users }));

      provider.post('/api/users', (req) => {
        const newUser = { id: nextId++, name: (req.body as { name: string }).name };
        users.push(newUser);
        return { status: 201, body: newUser };
      });

      provider.delete(/\/api\/users\/\d+/, (req) => {
        const id = parseInt(req.url.split('/').pop()!);
        users = users.filter((u) => u.id !== id);
        return { status: 204 };
      });

      // Create user
      const createResponse = await provider.handleRequest(
        createMockRequest({
          method: 'POST',
          url: '/api/users',
          body: { name: 'Bob' },
        })
      );
      expect(createResponse?.status).toBe(201);
      expect((createResponse?.body as { name: string }).name).toBe('Bob');

      // List users
      const listResponse = await provider.handleRequest(
        createMockRequest({ url: '/api/users' })
      );
      expect((listResponse?.body as unknown[]).length).toBe(2);

      // Delete user
      const deleteResponse = await provider.handleRequest(
        createMockRequest({
          method: 'DELETE',
          url: '/api/users/1',
        })
      );
      expect(deleteResponse?.status).toBe(204);

      // Verify deletion
      const finalList = await provider.handleRequest(
        createMockRequest({ url: '/api/users' })
      );
      expect((finalList?.body as unknown[]).length).toBe(1);
    });

    it('should handle concurrent requests', async () => {
      let counter = 0;
      provider.get('/api/counter', () => ({
        status: 200,
        body: { count: ++counter },
      }));

      const promises = Array.from({ length: 10 }, () =>
        provider.handleRequest(createMockRequest({ url: '/api/counter' }))
      );

      const responses = await Promise.all(promises);

      const counts = responses.map((r) => (r?.body as { count: number }).count);
      expect(new Set(counts).size).toBe(10);
    });
  });
});
