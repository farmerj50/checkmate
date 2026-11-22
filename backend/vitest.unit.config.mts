import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.e2e.test.ts'],
    setupFiles: ['tests/setup.unit.env.ts'],
    pool: 'forks',
    fileParallelism: false,
    isolate: true,
  },
});
