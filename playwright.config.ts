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
        /(desktop-walkthrough-layout|sequential-ack|voice-qa-happy-path|voice-grounding-scope|sub-trade-rls-backward-compat|sub-trade-assignment|no-static-desktop-import|no-bulk-verify-ui|no-undefined-css-tokens|use-viewport|walkthrough-store-ack)\.spec\.ts$/,
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
      // Self-healing Shotstack render finalizer (idempotency + branching).
      // CLAUDE.md 2026-05-25: a test file not in any project regex NEVER runs.
      name: 'video-gen-unit',
      testDir: './src/lib/video-gen/__tests__',
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
      //   member-dept.spec.ts          — member↔dept junction + owner-set (REQ-4, REQ-5, D-03)
      //   wizard-sop-dept.spec.ts      — wizard writes sop_departments (REQ-9, D-04) [Plan 06]
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      name: 'phase25-integration',
      testDir: '.',
      testMatch: /(departments-rls|sop-dept-visibility|no-global-blocks-in-journeys|member-dept|wizard-sop-dept)\.(test|spec)\.ts$/,
    },
    {
      // Phase 25 Plan 04 — /admin/departments e2e smoke spec.
      //   admin-departments.spec.ts — source-contract assertions for DepartmentCard/Grid/FormModal/page
      //                               + runtime fixme stubs (REQ-6, D-03, T-25-01)
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // Verify registration: `npx playwright test --list | grep admin-departments`
      name: 'phase25-e2e',
      testDir: '.',
      testMatch: /admin-departments\.(test|spec)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 22 — Voice-Driven Walkthrough source-contract + unit stub specs (Plan 01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // Specs are registered here so the Nyquist Wave-0 harness gates every requirement
      // before production code ships in Waves 1-2.
      //
      // Verify registration: `npx playwright test --list --project=phase22-stubs`
      // (should list all 6 tests/phase22/*.spec.ts files — zero discovered = FAIL)
      //
      // Files registered here:
      //   tests/phase22/intent-classifier.spec.ts  — VDW-VOICE-03 unit test (Plan 02)
      //   tests/phase22/tts-route.spec.ts           — VDW-LIT-03 TTS route auth gate (Plan 02)
      //   tests/phase22/stt-keyterms.spec.ts        — VDW-VOICE-01 Deepgram keyterms (Plan 02)
      //   tests/phase22/visual-layer.spec.ts        — VDW-LIT-01/02 icon+image layer (Plan 04)
      //   tests/phase22/voice-modal.spec.ts         — VDW-VOICE-02/03 STT+TTS+intent wiring (Plan 03)
      //   tests/phase22/voice-safety-gate.spec.ts   — D-02 onVoiceNext→handleMarkComplete chain (Plan 03)
      name: 'phase22-stubs',
      testDir: '.',
      testMatch: /tests\/phase22\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 23 — AI Field Layer + Version Supersede source-contract stubs (Wave 0 / Plan 23-00).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // Specs are registered here so the Nyquist Wave-0 harness gates every AFL-* requirement
      // and D-11 BEFORE any production code ships in Waves 1-3.
      //
      // Verify registration: `npx playwright test --list --project=phase23-stubs`
      // (should list all 4 tests/phase23/*.spec.ts files — zero discovered = FAIL per CLAUDE.md 2026-05-25)
      //
      // Files registered here:
      //   tests/phase23/ai-field-registry.spec.ts  — AFL-AI-01/02/03 (Plan 23-02)
      //   tests/phase23/version-supersede.spec.ts  — AFL-VER-01/02/03 (Plan 23-03)
      //   tests/phase23/version-indicator.spec.ts  — AFL-VER-04 (Plan 23-05)
      //   tests/phase23/completion-roster.spec.ts  — AFL-VER-05 + D-11 (Plan 23-04/06)
      name: 'phase23-stubs',
      testDir: '.',
      testMatch: /tests\/phase23\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 23 — field registry unit tests (pure module; static imports; no dynamic import()).
      //
      // CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
      // outside a testDir-scoped project — use STATIC @/ imports here.
      // testDir: './src/lib/ai-fields/__tests__' so Playwright's TS compiler resolves
      // @/ path aliases (mirrors phase15-unit pattern for voice/__tests__).
      //
      // Verify: `npx playwright test --list --project=phase23-unit`
      name: 'phase23-unit',
      testDir: './src/lib/ai-fields/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 27 — AI Provider & Settings unit tests (pure modules; static imports).
      //
      // CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
      // outside a testDir-scoped project — use STATIC @/ imports here.
      // testDir: './src/lib/ai/__tests__' so Playwright's TS compiler resolves
      // @/ path aliases (mirrors phase23-unit pattern for ai-fields/__tests__).
      //
      // Verify: `npx playwright test --list --project=phase27-unit`
      name: 'phase27-unit',
      testDir: './src/lib/ai/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 27 — ai_model_settings org-scope regression (live Supabase integration).
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      //
      // Verify: `npx playwright test --list --project=phase27-stubs`
      name: 'phase27-stubs',
      testDir: '.',
      testMatch: /tests\/phase27\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 28 — Ownership + Review Lifecycle + Governance Queue unit tests
      // (pure modules; static imports).
      //
      // CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
      // outside a testDir-scoped project — use STATIC @/ imports here.
      // testDir: './src/lib/governance/__tests__' so Playwright's TS compiler resolves
      // @/ path aliases (mirrors phase27-unit pattern for ai/__tests__).
      //
      // Verify: `npx playwright test --list --project=phase28-unit`
      name: 'phase28-unit',
      testDir: './src/lib/governance/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 28 — Ownership + Review Lifecycle + Governance Queue Nyquist harness.
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase28/**) so every later plan in
      // the phase drops specs into tests/phase28/ with NO further config edit —
      // single registration point for the whole phase (mirrors phase26).
      //
      // Verify registration: `npx playwright test --list --project=phase28`
      name: 'phase28',
      testDir: '.',
      testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 29 — Approval Chains unit tests (pure modules; static imports).
      //
      // CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
      // outside a testDir-scoped project — use STATIC @/ imports here.
      // Shares testDir with phase28-unit (src/lib/governance/__tests__) — testMatch
      // is scoped to approvals.test.ts ONLY so the two projects don't double-run
      // each other's files (2026-07-12 plan note).
      //
      // Verify: `npx playwright test --list --project=phase29-unit`
      name: 'phase29-unit',
      testDir: './src/lib/governance/__tests__',
      testMatch: /approvals\.test\.ts$/,
    },
    {
      // Phase 29 — Approval Chains Nyquist harness.
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase29/**) so every later plan in
      // the phase drops specs into tests/phase29/ with NO further config edit —
      // single registration point for the whole phase (mirrors phase28/phase26).
      //
      // Verify registration: `npx playwright test --list --project=phase29`
      name: 'phase29',
      testDir: '.',
      testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 30 — UX Consolidation & Simplification Nyquist harness (Wave 0 / Plan 30-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase30/**) so every later plan in
      // the phase drops specs into tests/phase30/ with NO further config edit —
      // single registration point for the whole phase (mirrors phase28/phase29).
      //
      // Verify registration: `npx playwright test --list --project=phase30`
      // (should list all 8 tests/phase30/*.spec.ts files — zero discovered = FAIL)
      //
      // Wave-0 stub files (one per UX requirement):
      //   role-homes (UX-01) · admin-nav (UX-02) · governance-fold (UX-03) ·
      //   create-entry (UX-04) · tab-merge (UX-05) · list-rows (UX-06) ·
      //   plain-language (UX-07) · dead-weight (UX-08)
      name: 'phase30',
      testDir: '.',
      testMatch: /tests\/phase30\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 26 — SOP Builder Redesign Nyquist harness (Wave 1 / Plan 26-02).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase26/**) so every later plan in
      // the phase drops specs into tests/phase26/ with NO further config edit —
      // this is the single registration point for the whole phase.
      //
      // Verify registration: `npx playwright test --list --project=phase26`
      //
      // Files registered here (grows over the phase):
      //   tests/phase26/convert-golden-path.spec.ts — R6 byte-equivalence baseline (Plan 26-02)
      name: 'phase26',
      testDir: '.',
      testMatch: /tests\/phase26\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 26.5 — Agent Metadata Layer Nyquist harness (Wave 0 / Plan 26.5-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase26.5/**) so every later plan in
      // the phase drops specs into tests/phase26.5/ with NO further config edit —
      // single registration point for the whole phase (mirrors phase26).
      //
      // Verify registration: `npx playwright test --list --project=phase26.5`
      //
      // Wave-0 stub files (9, per 26.5-RESEARCH.md § Validation Architecture):
      //   schema-contract, synthesis-pipeline, proposal-evidence, signal-readers,
      //   voice-qa-persistence, synthesis-sweep-auth, backfill-coverage,
      //   agent-panel-readonly, agent-dashboard
      name: 'phase26.5',
      testDir: '.',
      testMatch: /tests\/phase26\.5\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
  ],
})
