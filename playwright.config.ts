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
      name: 'phase2-stubs',
      testMatch: /sop-upload|sop-parsing|sop-review/,
    },
    {
      name: 'phase3-stubs',
      testMatch: /walkthrough|quick-ref|sop-library|sop-assignment|sop-versioning/,
    },
    {
      name: 'phase6-stubs',
      testMatch: /video-upload|stage-progress|transcript-review|publish-gate|safety-warning/,
    },
    {
      name: 'phase11-stubs',
      testMatch: /sb-auth-builder|sb-section-schema|sb-layout-editor|sb-collaborative-editing|sb-builder-infrastructure|resolve-render-family/,
    },
    {
      name: 'phase12.5-stubs',
      testMatch: /sb-ux-(blueprint|flow|cmdk|contract|walkthrough|escalate|blocks)\.test\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'phase15-stubs',
      testMatch:
        /(sub-trade-rls-backward-compat|sub-trade-assignment|no-static-admin-lens-import|version-route-public|no-bulk-verify-ui|no-undefined-css-tokens|design-tokens|sops-select-policies-org-scoped|rls-org-scope|use-viewport|no-dead-internal-hrefs|no-scheduled-jobs|design-principles|no-walk-words|no-rooms)\.spec\.ts$/,
      use: { browserName: 'chromium' },
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
        /validators\/__tests__\/block-content-extended\.test\.ts$/,
    },
    {
      // Phase 21.5 — builder label map unit tests.
      name: 'phase21.5-unit',
      testDir: './src/lib/builder/__tests__',
      testMatch: /.*\.test\.ts$/,
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
      // @/ path aliases (testDir-scoped project).
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
      //   synthesis-sweep-auth, backfill-coverage,
      //   agent-panel-readonly, agent-dashboard
      name: 'phase26.5',
      testDir: '.',
      testMatch: /tests\/phase26\.5\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 32 — Visual Org Model & Library Permissions Nyquist harness (Wave 0 / Plan 32-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase32/**) so every later plan in
      // the phase drops specs into tests/phase32/ with NO further config edit —
      // single registration point for the whole phase (mirrors phase26/28/29/30).
      //
      // Verify registration: `npx playwright test --list --project=phase32`
      // (should list all 8 tests/phase32/*.spec.ts files — zero discovered = FAIL)
      //
      // Wave-0 stub files (one per SC-1..SC-6 + 2 project-learning-mandated guards):
      //   org-chart-build (SC-1) · resolve-access (SC-2) · wiring-at-scale (SC-3) ·
      //   library-filter-deeplink (SC-4) · wire-up-mode (SC-5) · banner-slot-stability (SC-6) ·
      //   grants-org-isolation (cross-tenant, [2026-06-15]) · person-grant-rls (D-13, [2026-06-15])
      name: 'phase32',
      testDir: '.',
      testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 32 Plan 04 — resolveEffectiveAccess unit tests (pure module; static imports).
      //
      // CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
      // outside a testDir-scoped project — use STATIC @/ imports here.
      // testDir: './src/lib/org-model/__tests__' so Playwright's TS compiler resolves
      // @/ path aliases (mirrors phase28-unit pattern for governance/__tests__).
      //
      // Verify: `npx playwright test --list --project=phase32-unit`
      name: 'phase32-unit',
      testDir: './src/lib/org-model/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 33 -- Per-SOP Access Granularity + Wayfinder Builder Header
      // Nyquist harness (Wave 0 / Plan 33-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase33/**) so every later plan in
      // the phase drops specs into tests/phase33/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32).
      //
      // Verify registration: `npx playwright test --list --project=phase33`
      // (should list all 6 tests/phase33/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files (one per SC-1..SC-6):
      //   teams-ladder (SC-1) - sop-drilldown (SC-2) - sop-grant-schema (SC-3) -
      //   sop-grant-materialization (SC-4, [2026-06-15]-mandated real runtime) -
      //   plain-language-access (SC-5) - wayfinder-header (SC-6)
      name: 'phase33',
      testDir: '.',
      testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 34 -- Supervisor Observations
      // Nyquist harness (Wave 0 / Plan 34-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase34/**) so every later plan in
      // the phase drops specs into tests/phase34/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33).
      //
      // Verify registration: `npx playwright test --list --project=phase34`
      // (should list all 5 tests/phase34/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files (one per requirement + success criterion 4):
      //   record-observation (OBS-01, live in 34-04) -
      //   observation-immutability (OBS-01 append-only, live in 34-03) -
      //   worker-observation-visibility (OBS-02, live in 34-08) -
      //   sop-version-stamp (OBS-03/D-10, live in 34-04) -
      //   observation-cross-org-isolation (success criterion 4, live in 34-03)
      name: 'phase34',
      testDir: '.',
      testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 35 -- Competency Classifier + Training Matrix + Records
      // Nyquist harness (Wave 0 / Plan 35-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase35/**) so every later plan in
      // the phase drops specs into tests/phase35/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34).
      //
      // Verify registration: `npx playwright test --list --project=phase35`
      //
      // Wave-0 stub files: matrix-derivation (MTX-02) - no-competency-gate (CMP-04)
      name: 'phase35',
      testDir: '.',
      testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 35 Plan 01 -- classify/matrix/csv unit tests (pure modules; static imports).
      //
      // CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
      // outside a testDir-scoped project -- use STATIC @/ imports here.
      // testDir: './src/lib/competency/__tests__' so Playwright's TS compiler resolves
      // @/ path aliases (mirrors phase28-unit/phase32-unit pattern).
      //
      // Verify: `npx playwright test --list --project=phase35-unit`
      name: 'phase35-unit',
      testDir: './src/lib/competency/__tests__',
      testMatch: /.*\.test\.ts$/,
    },
    {
      // Phase 36 -- Refresher Cadence + Version Currency
      // Nyquist harness (Wave 0 / Plan 36-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase36/**) so every later plan in
      // the phase drops specs into tests/phase36/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34/35).
      //
      // Verify registration: `npx playwright test --list --project=phase36`
      //
      // Wave-0 stub files: no-refresher-gate (REF-01/CMP-04, live) --
      //   version-currency-lineage (CMP-03, activates 36-10) --
      //   version-breakdown-panel (TRN-03, activates 36-09)
      name: 'phase36',
      testDir: '.',
      testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 37 -- Assessor Governance
      // Nyquist harness (Wave 0 / Plan 37-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase37/**) so every later plan in
      // the phase drops specs into tests/phase37/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34/35/36).
      //
      // Verify registration: `npx playwright test --list --project=phase37`
      // (should list all 6 tests/phase37/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files (ASR-01):
      //   no-competency-gate-worker (CMP-04 north star, live) --
      //   override-audit-schema (D-05/D-07, live) --
      //   assessor-gate (fixme, activates 37-03) --
      //   assessor-ui-observation (fixme, activates 37-05) --
      //   assessor-ui-signoff (fixme, activates 37-04) --
      //   bootstrap-override-runtime (fixme, activates 37-06)
      name: 'phase37',
      testDir: '.',
      testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 40 -- Shared Creation Foundation
      // Nyquist harness (Wave 0 / Plan 40-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase40/**) so every later plan in
      // the phase drops specs into tests/phase40/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34/35/36/37).
      //
      // Verify registration: `npx playwright test --list --project=phase40`
      // (should list all 7 tests/phase40/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files:
      //   spine-freeze (frozen publish spine guard, LIVE) --
      //   dup01-file-intake (DUP-01, fixme, activates 40-02/40-07) --
      //   dup02-metadata-picker (DUP-02, fixme, activates 40-08) --
      //   dup03-job-progress (DUP-03, fixme, activates 40-03) --
      //   dup04-page-shell (DUP-04, fixme, activates 40-09) --
      //   dat01-category-column (DAT-01, fixme, activates 40-04/40-05) --
      //   dat01-migration (DAT-01, fixme, activates 40-04/40-06)
      name: 'phase40',
      testDir: '.',
      testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 41 -- One SOP Surface
      // Nyquist harness (Wave 0 / Plan 41-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase41/**) so every later plan in
      // the phase drops specs into tests/phase41/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34/35/36/37/40/46).
      //
      // Verify registration: `npx playwright test --list --project=phase41`
      // (should list all 5 tests/phase41/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files:
      //   bundle-gate (SUR-05, LIVE from this plan) --
      //   merged-surface (SUR-01/SUR-02/SUR-06, fixme, activates 41-05) --
      //   nav-and-shim (SUR-03/SUR-04 + redirect shim, fixme, activates 41-06) --
      //   reference-sweep (SUR-03/SUR-04 sweep, fixme, activates 41-07) --
      //   spec-repoint-inventory (legacy spec repoint guard, fixme, activates 41-08)
      name: 'phase41',
      testDir: '.',
      testMatch: /tests\/phase41\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Deployed-site evals: run ONLY via `npm run eval` (scripts/run-evals.mjs sets
      // EVAL_BASE_URL); every spec self-skips without it, so `npm run test` never
      // touches production.
      name: 'evals',
      testDir: '.',
      testMatch: /tests\/evals\/.*\.eval\.ts$/,
      timeout: 90_000,
      retries: 1,
      use: { browserName: 'chromium', baseURL: process.env.EVAL_BASE_URL || 'http://localhost:3000', screenshot: 'only-on-failure' },
    },
    {
      // Phase 46 -- Capability Matrix
      // Nyquist harness (Wave 0 / Plan 46-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase46/**) so every later plan in
      // the phase drops specs into tests/phase46/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34/35/36/37/40).
      //
      // Verify registration: `npx playwright test --list --project=phase46`
      // (should list all 3 tests/phase46/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files:
      //   capability-matrix-doc (CAP-01, fixme, activates 46-02) --
      //   sop-edit-guard-wiring (CAP-02, fixme, activates 46-03) --
      //   sop-edit-owner-access (CAP-02 live probes, fixme, activates 46-03)
      name: 'phase46',
      testDir: '.',
      testMatch: /tests\/phase46\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 51 -- Site Model & Machine Editor
      // Nyquist harness (Wave 0 / Plan 51-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase51/**) so every later plan in
      // the phase drops specs into tests/phase51/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase26/28/29/30/32/33/34/35/36/37/40/41/46).
      //
      // Verify registration: `npx playwright test --list --project=phase51`
      // (should list all 7 tests/phase51/*.spec.ts files -- zero discovered = FAIL)
      //
      // Wave-0 stub files:
      //   site-model (SIT-01..04, LIVE from this plan -- TDD contract module) --
      //   site-migration-shape (SIT-01, fixme, activates 51-02) --
      //   site-model-rls-runtime (SIT-01, fixme, activates 51-02) --
      //   site-actions-contract (SIT-03/SIT-04, fixme, activates 51-03) --
      //   site-editor-canvas (SIT-02/SIT-03, fixme, activates 51-04) --
      //   site-workspace-wiring (SIT-02/SIT-03/SIT-04, fixme, activates 51-05) --
      //   builder-machines-row (SIT-04, fixme, activates 51-06)
      name: 'phase51',
      testDir: '.',
      testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 52 -- Worker Home: The Plant
      // Nyquist harness (Wave 0 / Plan 52-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase52/**) so every later plan in
      // the phase drops specs into tests/phase52/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase51/41/etc).
      //
      // Verify registration: `npx playwright test --list --project=phase52`
      // (should list all 8 tests/phase52/*.spec.ts files -- zero discovered = FAIL)
      //
      // Files registered here:
      //   The plant specs were retired in 63-19 / 63-20 (ADR-0005); the camera maths
      //   spec (scene-camera) and any spec dropped into tests/phase52/ run here.
      name: 'phase52',
      testDir: '.',
      testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 53 -- Phone: Scan or Ask
      // Nyquist harness (Wave 0 / Plan 53-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase53/**) so every later plan in
      // the phase drops specs into tests/phase53/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase51/52/etc).
      //
      // Verify registration: `npx playwright test --list --project=phase53`
      // (should list tests/phase53/login-next-redirect.spec.ts -- zero discovered = FAIL)
      //
      // Files registered here (Phase 55 removed the phone/QR surface; only
      // the login round-trip stays):
      //   login-next-redirect (PHN-02) --
      name: 'phase53',
      testDir: '.',
      testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 54 -- Admin: Inbox, Floor Health, Library Table
      // Nyquist harness (Wave 0 / Plan 54-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase54/**) so every later plan in
      // the phase drops specs into tests/phase54/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase51/52/53).
      //
      // Verify registration: `npx playwright test --list --project=phase54`
      // (should list all 8 tests/phase54/*.spec.ts files -- zero discovered = FAIL)
      //
      // Files registered here:
      //   library-table-checks (ADM-03, LIVE from 54-01) --
      //   site-health-action (ADM-02, LIVE from 54-01) --
      //   governance-inbox (ADM-01, fixme, activates 54-02) --
      //   inbox-reuses-governance-gating (ADM-01, fixme, activates 54-02) --
      //   admin-machine-panel (ADM-02, fixme, activates 54-03) --
      //   library-table (ADM-03, fixme, activates 54-04) --
      //   deletion-sweep (ADM-04, fixme scaffold from 54-01, activates 54-05)
      name: 'phase54',
      testDir: '.',
      testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 43 -- Dead-Surface Removal & Route Truth
      // Nyquist harness (Wave 0 / Plan 43-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase43/**) so every later plan in
      // the phase drops specs into tests/phase43/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase51/52/53/54).
      //
      // Verify registration: `npx playwright test --list --project=phase43`
      //
      // Files registered here:
      //   new-block (D-03, fixme scaffold from 43-01, activates 43-02) --
      //   dead-controls (D-02/D-04/D-05, fixme scaffold from 43-01 plus one
      //     LIVE carve-out pin, activates 43-03) --
      //   route-truth (D-01/D-06, fixme scaffold from 43-01 plus one LIVE
      //     doc-truth pin, activates 43-04)
      name: 'phase43',
      testDir: '.',
      testMatch: /tests\/phase43\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 55 -- Cut the Dropped Features & One Organisation
      // Nyquist harness (Wave 0 / Plan 55-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase55/**) so every later plan in
      // the phase drops specs into tests/phase55/ with NO further config edit --
      // single registration point for the whole phase (mirrors phase51..54).
      //
      // Verify registration: `npx playwright test --list --project=phase55`
      //
      // Files registered here:
      //   deletion-sweep (CUT-01/CUT-02; reads scripts/dropped-features.json;
      //     survivors + not-vacuous LIVE from 55-01, each feature fixme until
      //     the plan that deletes it flips it live)
      //   worker-path-contract (CUT-01, fixme, flipped by 55-02/55-03/55-09)
      //   org-single (ORG-01, D-06 + D-02 LIVE from 55-01, rest fixme until 55-12)
      name: 'phase55',
      testDir: '.',
      testMatch: /tests\/phase55\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 56 -- a simpler SOP + the decision ledger.
      // Nyquist harness (Wave 0 / Plan 56-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase56/**) so later plans drop
      // specs in with NO further config edit. Unit specs for pure modules live
      // here too with static `@/` imports (precedent: tests/phase55/sop-pack.spec.ts),
      // so no separate -unit project is added. Live-DB specs self-skip unless
      // PHASE56_LIVE=1, so quick runs never spend the shared OTP budget
      // (CLAUDE.md 2026-09-28).
      //
      // Verify registration: `npx playwright test --list --project=phase56`
      //
      // Files registered here:
      //   decision-writers-sweep (DEC-01; reads scripts/decision-writers.json;
      //     discovery LIVE from 56-01, per-writer wiring fixme until 56-05/56-08)
      //   publish-gate-pin (SOP-01; sha256 of assertPublishGates, LIVE from 56-01)
      name: 'phase56',
      testDir: '.',
      testMatch: /tests\/phase56\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 57 -- the one screen & its places.
      // Nyquist harness (Wave 0 / Plan 57-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase57/**) so later plans drop
      // specs in with NO further config edit. Unit specs for pure modules
      // live here with static `@/` imports. Live-DB specs
      // self-skip unless PHASE57_LIVE=1, so quick runs never spend the shared
      // OTP budget (CLAUDE.md 2026-09-28).
      //
      // Verify registration: `npx playwright test --list --project=phase57`
      //
      // Files registered here:
      //   repoint-inventory (retire; stale-guard inventory, LIVE from 57-01)
      //   The room specs were retired in 63-19 / 63-20 (ADR-0005, guard:
      //   tests/lint/no-rooms.spec.ts); what remains is departments, retirement-sweep
      //   and the other surviving specs.
      name: 'phase57',
      testDir: '.',
      testMatch: /tests\/phase57\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 58 -- the SOP focus screen (walk + edit).
      // Nyquist harness (Wave 0 / Plan 58-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase58/**) so later plans drop
      // specs in with NO further config edit. Pure-module unit specs (focus,
      // focus-path, lineage-current, parse-progress) live here with static `@/`
      // imports. Live-DB specs self-skip unless PHASE58_LIVE=1, so quick runs
      // never spend the shared OTP budget (CLAUDE.md 2026-09-28).
      //
      // Verify registration: `npx playwright test --list --project=phase58`
      //
      // Files registered here (fixme stubs until the owning plan lands):
      //   repoint-inventory (stale-guard inventory, LIVE from 58-01)
      //   retirement-sweep, frame-structure, edit-rail, legacy-redirects,
      //   walk-actions, walk-no-leak, parse-pipelines, publish-gate,
      //   reviewer-steps, edit-actions, fork-draft, cutover-converter-retired,
      //   capability-matrix
      name: 'phase58',
      testDir: '.',
      testMatch: /tests\/phase58\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 59 -- the Office (inbox, sign-offs, approvals, decisions, people, access).
      // Nyquist harness (Wave 0 / Plan 59-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase59/**) so later plans drop
      // specs in with NO further config edit. The live-DB spec (ledger-rls-live)
      // self-skips unless PHASE59_LIVE=1, so quick runs never spend the shared
      // OTP budget (CLAUDE.md 2026-09-28).
      //
      // Verify registration: `npx playwright test --list --project=phase59`
      //
      // Files registered here (fixme stubs until the owning plan lands):
      //   repoint-inventory (stale-guard inventory, LIVE from 59-01),
      //   retirement-sweep, place-tab, ledger-read, ledger-rls-live,
      //   inbox-model, people-actions, signoff-actions, approve-actions,
      //   owner-review-meta, signoff-panel, office-pane-structure, people-tab,
      //   access-mount, legacy-redirects, capability-matrix
      name: 'phase59',
      testDir: '.',
      testMatch: /tests\/phase59\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 60 -- requests, notifications and objectives.
      // Nyquist harness (Wave 0 / Plan 60-01).
      //
      // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
      // DELIBERATELY BROAD testMatch (tests/phase60/**) so later plans drop
      // specs in with NO further config edit. The live-DB spec
      // (requests-notifications-objectives-rls-live) self-skips unless
      // PHASE60_LIVE=1, so quick runs never spend the shared OTP budget
      // (CLAUDE.md 2026-09-28).
      //
      // Verify registration: `npx playwright test --list --project=phase60`
      //
      // Files registered here (fixme stubs until the owning plan lands):
      //   repoint-inventory (stale-guard inventory, LIVE from 60-01),
      //   retirement-sweep, ledger-kinds, requests-notifications-objectives-rls-live,
      //   request-model, notification-places, objective-model, request-actions,
      //   answer-actions, agent-requests, ask-do-sop, notification-triggers,
      //   review-due, cron-route, objective-actions, ai-objective-fields,
      //   office-requests, request-surfaces, objective-meta, overview-structure,
      //   bell-structure, capability-matrix
      name: 'phase60',
      testDir: '.',
      testMatch: /tests\/phase60\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
    {
      // Phase 63 -- SOP-first home, library site map and the SOPstart start.
      // Wave 0 / Plan 63-01. Deliberately broad testMatch (tests/phase63/**) so
      // later plans drop specs in with no further config edit (CLAUDE.md 2026-05-25).
      // Verify registration: `npx playwright test --list --project=phase63`
      name: 'phase63',
      testDir: '.',
      testMatch: /tests\/phase63\/.*\.(spec|test)\.ts$/,
      use: { browserName: 'chromium' },
    },
  ],
})
