import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
// Type-only import: erased at compile time, so the API has no runtime dependency
// on @maiden/shared. It exists purely to share the response contract.
import type { HealthResponse } from '@maiden/shared';
import { registerGameRoutes } from './routes/game.js';

/**
 * Build the Fastify server instance. Kept separate from the entry point so tests
 * can construct the app and use `inject()` without opening a network socket.
 */
export function buildServer(): FastifyInstance {
  // Campaign state (with match event streams) can be large; allow generous bodies.
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 * 1024 });

  // The web app is served from a different origin/port in development.
  app.register(cors, { origin: true });

  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  app.register(registerGameRoutes);

  return app;
}
