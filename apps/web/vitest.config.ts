import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  esbuild: {
    target: 'node14'
  }
});
