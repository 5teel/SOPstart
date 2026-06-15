import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
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
    {
      name: 'phase15-stubs',
      testMatch:
        /(desktop-walkthrough-layout|sequential-ack|voice-qa-happy-path|voice-grounding-scope|sub-trade-rls-backward-compat|sub-trade-assignment|no-static-desktop-import|no-bulk-verify-ui|use-viewport|walkthrough-store-ack)\.spec\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'phase15-unit',
      testDir: './src/lib/voice/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      name: 'phase21-stubs',
      testMatch: /scp-(source-viewer|ai-reviewer|verify-checklist|parse-pipeline)\.test\.ts$/,
    },
    {
      name: 'phase20-parsers',
      testDir: './src/lib/parsers/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 24 — branch-aware flow derivation unit tests.
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      name: 'phase24-unit',
      testDir: './src/lib/sop/__tests__',
      testMatch: /flow-graph-derivation\.test\.ts$/,
    },
    {
      name: 'phase21-source-viewer',
      testDir: './src/lib/parsers/source-viewer/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      name: 'phase21-ai-reviewer',
      testDir: './src/lib/parsers/ai-reviewer/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      name: 'phase21-ai-reviewer-jobs',
      testDir: './src/lib/parsers/ai-reviewer/jobs/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Plan 21-05 — Zod schema unit tests + parser junction-creation tests.
      name: 'phase21-unit',
      testDir: './src',
      testMatch:
        /(validators\/__tests__\/block-content-extended|parsers\/__tests__\/parser-creates-junctions)\.test\.ts$/,
    },
    {
      // Phase 21.5 — builder label map unit tests.
      name: 'phase21.5-unit',
      testDir: './src/lib/builder/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 21.5 — source-contract stubs: block-type-labels unit test
      // (Plan 01) + builder-review-flow integration spec (Plan 05).
      // testDir covers both tests/ and src/ so both files are discoverable.
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      name: 'phase21.5-stubs',
      testDir: '.',
      testMatch: /(block-type-labels|builder-review-flow)\.(test|spec)\.ts$/,
    },
    {
      // Phase 21.6 — source-contract + lint guard stubs (Plan 01):
      //   builder-edit-stage.spec.ts  — E3/E4/E5/E6/E7 structural invariants
      //   no-raw-block-types-in-build.spec.ts — E2 raw block-type leak guard
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      name: 'phase21.6-stubs',
      testDir: '.',
      testMatch: /(no-raw-block-types-in-build|builder-edit-stage)\.(test|spec)\.ts$/,
    },
    {
      // Phase 24 — source-contract + lint guard stubs:
      //   no-preview-pill.spec.ts   — PREVIEW string absent from flow components (test.fixme until Plans 02/03 remove it)
      //   flow-graph-canvas.spec.ts — fitToView + exportPng wired; useViewport imported (test.fixme until Plans 02/03)
      //   flow-graph-schema.spec.ts — schema accepts min(1) ids, stepId still uuid (live — passes now)
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      name: 'phase24-stubs',
      testDir: '.',
      testMatch: /(no-preview-pill|flow-graph-canvas|flow-graph-schema)\.(test|spec)\.ts$/,
    },
    {
      // Phase 25 — departments RLS + SOP visibility integration specs.
      //   departments-rls.spec.ts      — cross-tenant isolation + no-42P17 recursion (REQ-1, T-25-01/03, D-02a)
      //   sop-dept-visibility.spec.ts  — OR-composed worker visibility: Forming sees Forming + all_departments (REQ-3, D-02)
      //   (Plan 05 will add no-global-blocks-in-journeys.spec.ts to this regex)
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      name: 'phase25-integration',
      testDir: '.',
      testMatch: /(departments-rls|sop-dept-visibility|no-global-blocks-in-journeys|member-dept)\.(test|spec)\.ts$/,
    },
  ],
})
