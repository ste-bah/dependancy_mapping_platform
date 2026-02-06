/**
 * Server Entry Point
 * @module server
 */

import pino from 'pino';
import { buildApp } from './app.js';
import { closePool } from './db/connection.js';

const logger = pino({ name: 'server' });

/**
 * Server configuration from environment
 */
interface ServerConfig {
  host: string;
  port: number;
}

/**
 * Get server configuration from environment variables
 */
function getServerConfig(): ServerConfig {
  return {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
  };
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string, app: Awaited<ReturnType<typeof buildApp>>): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  try {
    // Close Fastify server
    await app.close();
    logger.info('HTTP server closed');

    // Close database connections
    await closePool();
    logger.info('Database connections closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

/**
 * Start the server
 */
async function start(): Promise<void> {
  const config = getServerConfig();

  try {
    // Build the application
    const app = await buildApp();

    // Register shutdown handlers
    const shutdownHandler = (signal: string) => gracefulShutdown(signal, app);
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      gracefulShutdown('uncaughtException', app);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection');
      gracefulShutdown('unhandledRejection', app);
    });

    // Start listening
    await app.listen({ host: config.host, port: config.port });

    logger.info(
      { host: config.host, port: config.port },
      `Server listening on http://${config.host}:${config.port}`
    );

    // Log available routes in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Available routes:');
      logger.info('  GET  /health          - Basic health check');
      logger.info('  GET  /health/detailed - Detailed health check');
      logger.info('  GET  /health/live     - Liveness probe');
      logger.info('  GET  /health/ready    - Readiness probe');
    }
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start server
start();
