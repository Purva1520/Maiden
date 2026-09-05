import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@maiden/simulator': path.resolve(__dirname, '../simulator/src/index.ts'),
      '@maiden/game-data': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    include: [
      'src/**/*.{test,spec}.ts',
      '../../tests/team/**/*.{test,spec}.ts',
      '../../tests/team/**/test-*.ts',
      '../../tests/campaign/**/*.{test,spec}.ts',
      '../../tests/campaign/**/test-*.ts',
    ],
  },
});
