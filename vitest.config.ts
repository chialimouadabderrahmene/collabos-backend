import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './',
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: ['**/*.e2e-spec.ts', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'test',
        '**/*.spec.ts',
        '**/*.module.ts',
        'src/main.ts',
      ],
    },
  },
  plugins: [swc.vite()],
});
