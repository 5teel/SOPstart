import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.test.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'integration',
      testMatch: /rls-isolation|auth-flows/,
    },
    {
      name: 'e2e',
      testMatch: /offline-indicator/,
      use: { browserName: 'chromium' },
    },
  ],
})
