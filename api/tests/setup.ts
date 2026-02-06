/**
 * Vitest Global Test Setup
 * @module tests/setup
 *
 * Global test configuration and utilities for the IaC Dependency Detection API.
 * Sets up mocks, environment variables, and test utilities.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// ============================================================================
// Environment Setup
// ============================================================================

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret-key-for-testing-only';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';

// ============================================================================
// Global Mocks
// ============================================================================

// Mock pino logger to prevent console output during tests
vi.mock('pino', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
    level: 'silent',
  };

  const pino = vi.fn(() => mockLogger);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (pino as unknown as Record<string, unknown>).default = pino;

  return { default: pino, pino };
});

// Mock pino-pretty to prevent import errors
vi.mock('pino-pretty', () => ({
  default: vi.fn(() => ({
    write: vi.fn(),
  })),
}));

// ============================================================================
// Database Mocks
// ============================================================================

// Mock pg module for unit tests (integration tests should use real DB)
vi.mock('pg', async () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  const mockPool = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn(),
    on: vi.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };

  return {
    default: {
      Pool: vi.fn(() => mockPool),
      Client: vi.fn(() => mockClient),
    },
    Pool: vi.fn(() => mockPool),
    Client: vi.fn(() => mockClient),
  };
});

// ============================================================================
// Redis Mocks
// ============================================================================

// Mock ioredis for unit tests
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-2),
    keys: vi.fn().mockResolvedValue([]),
    mget: vi.fn().mockResolvedValue([]),
    mset: vi.fn().mockResolvedValue('OK'),
    hget: vi.fn().mockResolvedValue(null),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    lpush: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    lpop: vi.fn().mockResolvedValue(null),
    rpop: vi.fn().mockResolvedValue(null),
    lrange: vi.fn().mockResolvedValue([]),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    sismember: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    off: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    duplicate: vi.fn(function (this: unknown) {
      return this;
    }),
    status: 'ready',
  };

  return {
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis),
  };
});

// ============================================================================
// OpenTelemetry Mocks
// ============================================================================

// Mock OpenTelemetry to prevent initialization in tests
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@opentelemetry/api')>();
  return {
    ...original,
    trace: {
      ...original.trace,
      getTracer: vi.fn(() => ({
        startSpan: vi.fn(() => ({
          setAttribute: vi.fn(),
          setAttributes: vi.fn(),
          addEvent: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn(),
          end: vi.fn(),
          isRecording: vi.fn().mockReturnValue(true),
          spanContext: vi.fn().mockReturnValue({
            traceId: 'test-trace-id',
            spanId: 'test-span-id',
            traceFlags: 1,
          }),
        })),
        startActiveSpan: vi.fn((_name, fn) => fn({
          setAttribute: vi.fn(),
          setAttributes: vi.fn(),
          addEvent: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn(),
          end: vi.fn(),
          isRecording: vi.fn().mockReturnValue(true),
          spanContext: vi.fn().mockReturnValue({
            traceId: 'test-trace-id',
            spanId: 'test-span-id',
            traceFlags: 1,
          }),
        })),
      })),
      getActiveSpan: vi.fn(),
      setSpan: vi.fn(),
    },
    context: {
      ...original.context,
      active: vi.fn(),
      with: vi.fn((_ctx, fn) => fn()),
    },
  };
});

// ============================================================================
// External Service Mocks
// ============================================================================

// Mock undici for HTTP client tests
vi.mock('undici', () => ({
  request: vi.fn().mockResolvedValue({
    statusCode: 200,
    headers: {},
    body: {
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
    },
  }),
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
  }),
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock Fastify request object
 */
export function createMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-request-id',
    method: 'GET',
    url: '/test',
    headers: {},
    query: {},
    params: {},
    body: undefined,
    ip: '127.0.0.1',
    hostname: 'localhost',
    protocol: 'http',
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
    ...overrides,
  };
}

/**
 * Create a mock Fastify reply object
 */
export function createMockReply(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const reply: Record<string, unknown> = {
    statusCode: 200,
    sent: false,
    code: vi.fn().mockImplementation(function (this: Record<string, unknown>, code: number) {
      this.statusCode = code;
      return this;
    }),
    status: vi.fn().mockImplementation(function (this: Record<string, unknown>, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.sent = true;
      return this;
    }),
    header: vi.fn().mockReturnThis(),
    headers: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return reply;
}

/**
 * Create a mock database pool
 */
export function createMockPool(): Record<string, unknown> {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };

  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn(),
    on: vi.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise for testing async flows
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

// ============================================================================
// Global Hooks
// ============================================================================

beforeAll(() => {
  // Any global setup
});

afterAll(() => {
  // Any global teardown
});

afterEach(() => {
  // Reset all mocks after each test
  vi.clearAllMocks();
});

// ============================================================================
// Extend Vitest matchers (optional custom matchers)
// ============================================================================

// Add custom matchers here if needed
// Example:
// expect.extend({
//   toBeValidUUID(received) {
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//     const pass = uuidRegex.test(received);
//     return {
//       pass,
//       message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
//     };
//   },
// });
