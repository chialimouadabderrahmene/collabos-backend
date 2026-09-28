import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests against a real, disposable PostgreSQL database with all
 * migrations applied. They only run when INTEGRATION_DATABASE_URL is set and
 * must never point at a shared or production database.
 */
export default defineConfig({
  test: {
    root: './',
    globals: true,
    include: ['test/integration/**/*.integration-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  plugins: [swc.vite()],
});
