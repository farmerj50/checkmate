import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Database-backed suites retain their existing environment setup.
    // Isolated unit suites use vitest.unit.config.mts through npm test.
    include: ['tests/**/*.e2e.test.ts'],
    setupFiles: ['tests/setup.env.ts'],
    pool: 'forks',
    fileParallelism: false,
    isolate: true,
    coverage: {
      reporter: ['text']
    }
  }
});
