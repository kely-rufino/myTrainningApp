import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret-key-do-not-use-in-production',
      RESEND_API_KEY: 're_test_placeholder',
    },
    globalSetup: './src/test/globalSetup.ts',
    singleFork: true,
    fileParallelism: false, // run test files one at a time — prevents concurrent beforeAll hooks from racing on SQLite writes
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/routes/**', 'src/lib/**', 'src/plugins/**'],
    },
  },
})
