---
phase: 11-section-schema-block-foundation
plan: 00
subsystem: test-infrastructure
tags: [playwright, stubs, wave-0, sop-builder, v3.0]
one-liner: "Wave-0 Playwright test stubs for all 37 SB-XX requirements across 7 files, registered in new phase11-stubs project"
requires: []
provides:
  - phase11-stubs Playwright project
  - 7 SB-* test stub files
  - 37 named test.fixme cases tied to SB-XX requirement IDs
affects:
  - playwright.config.ts
tech-stack:
  added: []
  patterns:
    - "test.fixme stub-first convention (Phase 9/10 reuse)"
    - "testMatch regex project grouping by filename"
key-files:
  created:
    - tests/sb-auth-builder.test.ts
    - tests/sb-section-schema.test.ts
    - tests/sb-layout-editor.test.ts
    - tests/sb-image-annotation.test.ts
    - tests/sb-collaborative-editing.test.ts
    - tests/sb-block-library.test.ts
    - tests/sb-builder-infrastructure.test.ts
  modified:
    - playwright.config.ts
decisions:
  - "Stub-first approach mirrors Phase 9/10 pattern — every SB-XX requirement gets a named test.fixme up front so downstream phases (12-18) flip specific cases as they land"
  - "One test.describe block per requirement group (SB-AUTH, SB-SECT, SB-LAYOUT, SB-ANNOT, SB-COLLAB, SB-BLOCK, SB-INFRA)"
  - "Test titles begin with requirement ID (e.g. 'SB-SECT-01 ...') so CI can grep for coverage"
metrics:
  duration: "~10 minutes"
  completed: 2026-04-15
  tasks: 3
  files: 8
  tests_added: 37
---

# Phase 11 Plan 00: Wave-0 SB-XX Test Stub Foundation Summary

## Objective Recap

Create Wave-0 Playwright test stubs for every v3.0 SOP Builder requirement (37 SB-XX requirements across 7 requirement groups) and register them in a new `phase11-stubs` Playwright project so downstream phases 12-18 can flip `test.fixme` entries to real tests as each requirement lands.

## Outcome

All 37 SB-XX requirements now have at least one named `test.fixme` case whose title starts with the requirement ID. The new `phase11-stubs` Playwright project reports 37 tests in 7 files. All tests skipped (fixme) — zero CI perf impact, zero runtime surface touched.

## Stub Counts per Requirement Group

| Requirement Group | File                                      | Stubs | Requirement IDs       |
| ----------------- | ----------------------------------------- | ----- | --------------------- |
| SB-AUTH           | tests/sb-auth-builder.test.ts             | 5     | SB-AUTH-01..05        |
| SB-SECT           | tests/sb-section-schema.test.ts           | 5     | SB-SECT-01..05        |
| SB-LAYOUT         | tests/sb-layout-editor.test.ts            | 6     | SB-LAYOUT-01..06      |
| SB-ANNOT          | tests/sb-image-annotation.test.ts         | 5     | SB-ANNOT-01..05       |
| SB-COLLAB         | tests/sb-collaborative-editing.test.ts    | 6     | SB-COLLAB-01..06      |
| SB-BLOCK          | tests/sb-block-library.test.ts            | 6     | SB-BLOCK-01..06       |
| SB-INFRA          | tests/sb-builder-infrastructure.test.ts   | 4     | SB-INFRA-01..04       |
| **Total**         | **7 files**                               | **37** | **37 unique IDs**    |

## Playwright Project Config Diff

```diff
  {
    name: 'phase10-stubs',
    testMatch: /video-version-management/,
  },
+ {
+   name: 'phase11-stubs',
+   testMatch: /sb-auth-builder|sb-section-schema|sb-layout-editor|sb-image-annotation|sb-collaborative-editing|sb-block-library|sb-builder-infrastructure/,
+ },
```

Existing projects (`integration`, `e2e`, `phase2-stubs` through `phase10-stubs`) untouched.

## Downstream Phase → Stub Flip Map

Each downstream phase in v3.0 flips a specific stub set from `test.fixme` to real Playwright cases as it ships its requirement.

| Phase     | Stub file(s) flipped                                    | Requirements shipped             |
| --------- | ------------------------------------------------------- | -------------------------------- |
| Phase 12  | tests/sb-section-schema.test.ts                         | SB-SECT-01..05                   |
| Phase 13  | tests/sb-auth-builder.test.ts                           | SB-AUTH-01..05                   |
| Phase 14  | tests/sb-layout-editor.test.ts                          | SB-LAYOUT-01..06                 |
| Phase 15  | tests/sb-image-annotation.test.ts                       | SB-ANNOT-01..05                  |
| Phase 16  | tests/sb-collaborative-editing.test.ts                  | SB-COLLAB-01..06                 |
| Phase 17  | tests/sb-block-library.test.ts                          | SB-BLOCK-01..06                  |
| Phase 18  | tests/sb-builder-infrastructure.test.ts                 | SB-INFRA-01..04                  |

Mapping follows `.planning/ROADMAP.md` phase-to-requirement traceability for v3.0. Downstream plans can reference this summary's traceability table when deciding which `test.fixme` entries to turn on.

## Task Execution Log

| Task | Name                                                         | Commit    | Files                                                                       |
| ---- | ------------------------------------------------------------ | --------- | --------------------------------------------------------------------------- |
| 1    | Create SB-AUTH + SB-SECT stub files                          | 73434b6   | tests/sb-auth-builder.test.ts, tests/sb-section-schema.test.ts              |
| 2    | Create SB-LAYOUT, SB-ANNOT, SB-COLLAB stub files             | 3470be5   | tests/sb-layout-editor.test.ts, tests/sb-image-annotation.test.ts, tests/sb-collaborative-editing.test.ts |
| 3    | Create SB-BLOCK + SB-INFRA stubs and register phase11-stubs  | 7587eed   | tests/sb-block-library.test.ts, tests/sb-builder-infrastructure.test.ts, playwright.config.ts |

## Verification Results

1. **Lint / TypeScript:** All 7 new files parse cleanly as TypeScript — Playwright's TS resolver successfully lists tests without error (confirms no parse errors).
2. **Playwright test list:** `npx playwright test --project=phase11-stubs --list` reports `Total: 37 tests in 7 files` — exactly matches the 37 SB-XX requirements.
3. **Requirement ID coverage:** Regex scan across all 7 files finds exactly 37 matches of `SB-(AUTH|SECT|LAYOUT|ANNOT|COLLAB|BLOCK|INFRA)-0\d`.
4. **Existing projects untouched:** `phase2-stubs` through `phase10-stubs` entries unchanged; only addition is the new `phase11-stubs` entry after `phase10-stubs`.

## Deviations from Plan

None — plan executed exactly as written. All three atomic commits landed in the planned order (SB-AUTH+SECT → SB-LAYOUT+ANNOT+COLLAB → SB-BLOCK+INFRA+config).

## Known Stubs

None. All `test.fixme` entries in this plan are *intentional* Wave-0 placeholders, documented above and tracked via the phase11-stubs Playwright project. Each will be flipped to a real test in its respective downstream phase (12-18). These are NOT unresolved stubs blocking the plan goal — they ARE the plan goal.

## Requirements Shipped

This plan stubs (but does not yet implement) 37 SB-XX requirements. Each requirement is now represented by at least one named `test.fixme` case ready to be flipped in the downstream phase that ships the feature:

SB-AUTH-01..05, SB-SECT-01..05, SB-LAYOUT-01..06, SB-ANNOT-01..05, SB-COLLAB-01..06, SB-BLOCK-01..06, SB-INFRA-01..04.

Note: this plan establishes test-surface infrastructure — the requirements themselves remain open in `.planning/REQUIREMENTS.md` until their respective feature-shipping phases mark them complete.

## Self-Check: PASSED

- FOUND: tests/sb-auth-builder.test.ts
- FOUND: tests/sb-section-schema.test.ts
- FOUND: tests/sb-layout-editor.test.ts
- FOUND: tests/sb-image-annotation.test.ts
- FOUND: tests/sb-collaborative-editing.test.ts
- FOUND: tests/sb-block-library.test.ts
- FOUND: tests/sb-builder-infrastructure.test.ts
- FOUND: playwright.config.ts (modified with phase11-stubs project)
- FOUND commit: 73434b6 (Task 1)
- FOUND commit: 3470be5 (Task 2)
- FOUND commit: 7587eed (Task 3)
- VERIFIED: 37 tests in 7 files via `npx playwright test --project=phase11-stubs --list`
