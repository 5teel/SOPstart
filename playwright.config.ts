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
    {
      name: 'phase2-stubs',
      testMatch: /sop-upload|sop-parsing|sop-review/,
    },
    {
      name: 'phase3-stubs',
      testMatch: /offline-sync|walkthrough|quick-ref|sop-library|sop-assignment|sop-versioning/,
    },
  ],
})
