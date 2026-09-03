import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Load env from the repository root so the shared .env applies to the web app.
export default defineConfig(({ mode }) => {
  const repoRoot = new URL('../../', import.meta.url).pathname;
  const env = loadEnv(mode, repoRoot, '');
  const port = env.WEB_PORT ? Number(env.WEB_PORT) : 5173;

  return {
    plugins: [react()],
    envDir: repoRoot,
    server: { port },
    preview: { port },
  };
});
