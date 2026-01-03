import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts'],
    globals: true,
    env: {
      // Test environment variables for security tests
      JWT_SECRET: 'test-jwt-secret-minimum-32-characters-for-testing',
      JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-for-testing',
      SESSION_SECRET: 'test-session-secret-min-32-chars-for-testing',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
