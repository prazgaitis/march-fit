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
    // Vitest 5 removed poolOptions.forks.singleFork. Run files serially in a
    // single worker to keep the previous one-fork-at-a-time behavior.
    fileParallelism: false,
    maxWorkers: 1,
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
