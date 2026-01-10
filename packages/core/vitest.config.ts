import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    root: '.',
  },
  css: {
    postcss: {},
  },
});
