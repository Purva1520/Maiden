import Fastify, { type FastifyInstance } from 'fastify';
// Type-only import: erased at compile time, so the API has no runtime dependency
// on @maiden/shared. It exists purely to share the response contract.
import type { HealthResponse } from '@maiden/shared';

/**
 * Build the Fastify server instance. Kept separate from the entry point so tests
 * can construct the app and use `inject()` without opening a network socket.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  return app;
}
