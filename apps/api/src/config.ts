/**
 * API configuration, loaded from environment variables with safe development
 * defaults. Values mirror .env.example at the repository root.
 */
export interface ApiConfig {
  nodeEnv: string;
  port: number;
  host: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: env.API_PORT ? Number(env.API_PORT) : 3000,
    host: env.API_HOST ?? '127.0.0.1',
  };
}
