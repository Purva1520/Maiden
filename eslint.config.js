// Flat ESLint config for the Maiden monorepo (ESLint 10).
// Covers TypeScript and React source under apps/* and packages/*.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Paths ESLint should never lint.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.venv/**',
      'data/**',
      'data-pipeline/**',
      'notebooks/**',
      'scripts/**/*.py',
    ],
  },

  // Base JS + TypeScript recommended rules for all TS/TSX/JS files.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React-specific rules for the web app and UI package.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Node environment for the API and any tooling/config files.
  {
    files: ['apps/api/**/*.ts', '*.{js,mjs,ts}', 'scripts/**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Turn off formatting-related rules so Prettier is the single source of truth.
  prettier,
);
