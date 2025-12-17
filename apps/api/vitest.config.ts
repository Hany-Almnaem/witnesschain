import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env from root directory (../../.env relative to apps/api)
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  
  return {
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.{test,spec}.ts'],
      exclude: ['node_modules', 'dist'],
      env: env, // Pass loaded env vars to tests
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          '**/*.d.ts',
          '**/*.config.*',
        ],
      },
      testTimeout: 30000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
