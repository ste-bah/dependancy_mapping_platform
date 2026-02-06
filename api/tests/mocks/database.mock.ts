/**
 * Database Mock Utilities
 * @module tests/mocks/database.mock
 *
 * Provides mock implementations for database connections and repositories.
 * Used for isolating unit tests from actual database dependencies.
 *
 * TASK-DETECT-001 through TASK-DETECT-010 implementation
 * Agent #33 of 47 | Phase 5: Testing
 */

import { vi, type Mock } from 'vitest';

/**
 * Mock PostgreSQL client interface
 */
export interface MockPoolClient {
  query: Mock;
  release: Mock;
}

/**
 * Mock PostgreSQL pool interface
 */
export interface MockPool {
  connect: Mock<[], Promise<MockPoolClient>>;
  query: Mock;
  end: Mock;
  on: Mock;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/**
 * Mock transaction interface
 */
export interface MockTransaction {
  begin: Mock;
  commit: Mock;
  rollback: Mock;
  query: Mock;
  savepoint: Mock;
  releaseSavepoint: Mock;
}

/**
 * Create a mock PostgreSQL pool client
 */
export function createMockPoolClient(
  queryResults: Record<string, unknown[]> = {}
): MockPoolClient {
  const queryMock = vi.fn().mockImplementation((sql: string) => {
    // Check for matching query pattern
    for (const [pattern, rows] of Object.entries(queryResults)) {
      if (sql.includes(pattern)) {
        return Promise.resolve({ rows, rowCount: rows.length });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });

  return {
    query: queryMock,
    release: vi.fn(),
  };
}

/**
 * Create a mock PostgreSQL pool
 */
export function createMockPool(
  queryResults: Record<string, unknown[]> = {}
): MockPool {
  const client = createMockPoolClient(queryResults);

  return {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockImplementation((sql: string) => {
      for (const [pattern, rows] of Object.entries(queryResults)) {
        if (sql.includes(pattern)) {
          return Promise.resolve({ rows, rowCount: rows.length });
        }
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 0,
  };
}

/**
 * Create a mock transaction
 */
export function createMockTransaction(): MockTransaction {
  return {
    begin: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    savepoint: vi.fn().mockResolvedValue(undefined),
    releaseSavepoint: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Generic repository mock factory
 */
export interface MockRepository<T> {
  findById: Mock<[string], Promise<T | null>>;
  findAll: Mock<[], Promise<T[]>>;
  findBy: Mock<[Partial<T>], Promise<T[]>>;
  create: Mock<[Omit<T, 'id'>], Promise<T>>;
  update: Mock<[string, Partial<T>], Promise<T | null>>;
  delete: Mock<[string], Promise<boolean>>;
  count: Mock<[], Promise<number>>;
  exists: Mock<[string], Promise<boolean>>;
}

/**
 * Create a mock repository with optional initial data
 */
export function createMockRepository<T extends { id: string }>(
  initialData: T[] = []
): MockRepository<T> {
  const data = new Map<string, T>(initialData.map((item) => [item.id, item]));

  return {
    findById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(data.get(id) ?? null)
    ),

    findAll: vi.fn().mockImplementation(() =>
      Promise.resolve(Array.from(data.values()))
    ),

    findBy: vi.fn().mockImplementation((criteria: Partial<T>) =>
      Promise.resolve(
        Array.from(data.values()).filter((item) =>
          Object.entries(criteria).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value
          )
        )
      )
    ),

    create: vi.fn().mockImplementation((item: Omit<T, 'id'>) => {
      const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newItem = { ...item, id } as T;
      data.set(id, newItem);
      return Promise.resolve(newItem);
    }),

    update: vi.fn().mockImplementation((id: string, updates: Partial<T>) => {
      const existing = data.get(id);
      if (!existing) return Promise.resolve(null);
      const updated = { ...existing, ...updates };
      data.set(id, updated);
      return Promise.resolve(updated);
    }),

    delete: vi.fn().mockImplementation((id: string) => {
      const existed = data.has(id);
      data.delete(id);
      return Promise.resolve(existed);
    }),

    count: vi.fn().mockImplementation(() =>
      Promise.resolve(data.size)
    ),

    exists: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(data.has(id))
    ),
  };
}

/**
 * Mock Redis client interface
 */
export interface MockRedisClient {
  get: Mock;
  set: Mock;
  del: Mock;
  exists: Mock;
  expire: Mock;
  ttl: Mock;
  keys: Mock;
  mget: Mock;
  mset: Mock;
  hget: Mock;
  hset: Mock;
  hgetall: Mock;
  hdel: Mock;
  lpush: Mock;
  rpush: Mock;
  lpop: Mock;
  rpop: Mock;
  lrange: Mock;
  sadd: Mock;
  smembers: Mock;
  srem: Mock;
  publish: Mock;
  subscribe: Mock;
  quit: Mock;
  disconnect: Mock;
}

/**
 * Create a mock Redis client
 */
export function createMockRedisClient(
  initialData: Record<string, string> = {}
): MockRedisClient {
  const store = new Map<string, string>(Object.entries(initialData));
  const hashStore = new Map<string, Map<string, string>>();
  const listStore = new Map<string, string[]>();
  const setStore = new Map<string, Set<string>>();

  return {
    get: vi.fn().mockImplementation((key: string) =>
      Promise.resolve(store.get(key) ?? null)
    ),

    set: vi.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),

    del: vi.fn().mockImplementation((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return Promise.resolve(count);
    }),

    exists: vi.fn().mockImplementation((...keys: string[]) => {
      return Promise.resolve(keys.filter((k) => store.has(k)).length);
    }),

    expire: vi.fn().mockResolvedValue(1),

    ttl: vi.fn().mockResolvedValue(-1),

    keys: vi.fn().mockImplementation((pattern: string) => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return Promise.resolve(
        Array.from(store.keys()).filter((k) => regex.test(k))
      );
    }),

    mget: vi.fn().mockImplementation((...keys: string[]) =>
      Promise.resolve(keys.map((k) => store.get(k) ?? null))
    ),

    mset: vi.fn().mockImplementation((data: Record<string, string>) => {
      for (const [k, v] of Object.entries(data)) {
        store.set(k, v);
      }
      return Promise.resolve('OK');
    }),

    hget: vi.fn().mockImplementation((key: string, field: string) => {
      const hash = hashStore.get(key);
      return Promise.resolve(hash?.get(field) ?? null);
    }),

    hset: vi.fn().mockImplementation((key: string, field: string, value: string) => {
      if (!hashStore.has(key)) {
        hashStore.set(key, new Map());
      }
      hashStore.get(key)!.set(field, value);
      return Promise.resolve(1);
    }),

    hgetall: vi.fn().mockImplementation((key: string) => {
      const hash = hashStore.get(key);
      if (!hash) return Promise.resolve({});
      return Promise.resolve(Object.fromEntries(hash));
    }),

    hdel: vi.fn().mockImplementation((key: string, ...fields: string[]) => {
      const hash = hashStore.get(key);
      if (!hash) return Promise.resolve(0);
      let count = 0;
      for (const field of fields) {
        if (hash.delete(field)) count++;
      }
      return Promise.resolve(count);
    }),

    lpush: vi.fn().mockImplementation((key: string, ...values: string[]) => {
      if (!listStore.has(key)) listStore.set(key, []);
      listStore.get(key)!.unshift(...values);
      return Promise.resolve(listStore.get(key)!.length);
    }),

    rpush: vi.fn().mockImplementation((key: string, ...values: string[]) => {
      if (!listStore.has(key)) listStore.set(key, []);
      listStore.get(key)!.push(...values);
      return Promise.resolve(listStore.get(key)!.length);
    }),

    lpop: vi.fn().mockImplementation((key: string) => {
      const list = listStore.get(key);
      return Promise.resolve(list?.shift() ?? null);
    }),

    rpop: vi.fn().mockImplementation((key: string) => {
      const list = listStore.get(key);
      return Promise.resolve(list?.pop() ?? null);
    }),

    lrange: vi.fn().mockImplementation((key: string, start: number, stop: number) => {
      const list = listStore.get(key) ?? [];
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      return Promise.resolve(list.slice(start, end));
    }),

    sadd: vi.fn().mockImplementation((key: string, ...members: string[]) => {
      if (!setStore.has(key)) setStore.set(key, new Set());
      let added = 0;
      for (const member of members) {
        if (!setStore.get(key)!.has(member)) {
          setStore.get(key)!.add(member);
          added++;
        }
      }
      return Promise.resolve(added);
    }),

    smembers: vi.fn().mockImplementation((key: string) => {
      const set = setStore.get(key);
      return Promise.resolve(set ? Array.from(set) : []);
    }),

    srem: vi.fn().mockImplementation((key: string, ...members: string[]) => {
      const set = setStore.get(key);
      if (!set) return Promise.resolve(0);
      let removed = 0;
      for (const member of members) {
        if (set.delete(member)) removed++;
      }
      return Promise.resolve(removed);
    }),

    publish: vi.fn().mockResolvedValue(0),
    subscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Default mock pool for global use
 */
export const mockPool = createMockPool();

/**
 * Default mock transaction for global use
 */
export const mockTransaction = createMockTransaction();

/**
 * Default mock Redis client for global use
 */
export const mockRedis = createMockRedisClient();
