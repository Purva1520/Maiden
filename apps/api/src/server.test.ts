import { describe, it, expect, afterAll } from 'vitest';
import { buildServer } from './server.js';

const app = buildServer();

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns { status: "ok" } with a 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
