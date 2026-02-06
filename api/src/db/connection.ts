/**
 * PostgreSQL Database Connection Pool
 * @module db/connection
 */

import pg from 'pg';
import pino from 'pino';

const { Pool } = pg;

const logger = pino({ name: 'db-connection' });

/**
 * Database configuration from environment variables
 */
interface DbConfig {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * Get database configuration from environment
 */
function getDbConfig(): DbConfig {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return {
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  };
}

/**
 * PostgreSQL connection pool singleton
 */
let pool: pg.Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const config = getDbConfig();
    pool = new Pool(config);

    pool.on('connect', () => {
      logger.debug('New client connected to pool');
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected pool error');
    });

    pool.on('remove', () => {
      logger.debug('Client removed from pool');
    });
  }

  return pool;
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

/**
 * Execute a query with the connection pool
 */
export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;

  logger.debug({ text, duration, rows: result.rowCount }, 'Query executed');

  return result;
}

/**
 * Get a client from the pool for transaction support
 */
export async function getClient(): Promise<pg.PoolClient> {
  return getPool().connect();
}

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health_check');
    return result.rows.length > 0;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

export { Pool, pg };
