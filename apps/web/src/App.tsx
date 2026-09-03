import { createHealthResponse } from '@maiden/shared';

/**
 * Phase 0 smoke-test page.
 *
 * This is intentionally minimal — it exists only to prove the React + Vite app
 * launches and that a workspace package (@maiden/shared) resolves and runs in
 * the browser bundle. No real Maiden UI is built in Phase 0.
 */
export function App() {
  const health = createHealthResponse();

  return (
    <main className="app">
      <h1>Maiden</h1>
      <p>Project foundation ready.</p>
      <p className="status">
        shared package status: <strong>{health.status}</strong>
      </p>
    </main>
  );
}
