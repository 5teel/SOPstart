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
    {
      name: 'phase6-stubs',
      testMatch: /video-upload|youtube-url|youtube-no-captions|stage-progress|transcript-review|publish-gate|safety-warning/,
    },
    {
      name: 'phase8-stubs',
      testMatch: /video-gen-slideshow|video-gen-scroll|video-chapters|video-admin-preview|video-player|video-completion|sw-video-exclusion/,
    },
    {
      name: 'phase9-stubs',
      testMatch: /pipeline-entry|pipeline-linkage|pipeline-autoqueue|pipeline-progress|pipeline-failure-recovery|pipeline-review-gate/,
    },
    {
      name: 'phase10-stubs',
      testMatch: /video-version-management/,
    },
    {
      name: 'phase11-stubs',
      testMatch: /sb-auth-builder|sb-section-schema|sb-layout-editor|sb-image-annotation|sb-collaborative-editing|sb-block-library|sb-builder-infrastructure|resolve-render-family/,
    },
    {
      name: 'phase12.5-stubs',
      testMatch: /sb-ux-(blueprint|voice|flow|cmdk|contract|walkthrough|escalate|blocks)\.test\.ts$/,
      use: { browserName: 'chromium' },
    },
  ],
})
