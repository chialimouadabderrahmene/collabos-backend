import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './',
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
  },
  plugins: [swc.vite()],
});
