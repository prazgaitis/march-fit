import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    // Serial, shared-process execution — the Vitest 5 replacement for
    // the removed poolOptions.forks.singleFork.
    fileParallelism: false,
    isolate: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './'),
      'server-only': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './tests/shims/server-only.ts'),
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
});
