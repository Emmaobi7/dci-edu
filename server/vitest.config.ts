import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 60000,
    testTimeout: 60000,
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
