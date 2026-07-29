---
phase: 40-shared-creation-foundation
plan: 10
subsystem: upload
tags: [zod, file-intake, validation, gap-closure]

requires:
  - phase: 40-shared-creation-foundation (plan 40-02)
    provides: "src/lib/upload/file-intake.ts — the shared client-side intake module (ACCEPTED_MIME_TYPES, BLOCKED_EXTENSIONS, size limits, HEIC conversion)"
provides:
  - "src/lib/validators/sop.ts's uploadFileSchema/uploadVideoFileSchema derive their accept/blocked/size lists from file-intake.ts instead of maintaining a second, drift-prone copy"
  - "file-intake.ts is now the sole owner of BLOCKED_MIME_TYPES (macro-enabled Office MIME strings), and validateIntakeFile's blocked-macro check is MIME-aware as well as extension-aware"
  - "scripts/accept-list-parity-check.tsx — a runnable proof exercising the real server schema/getSourceFileType for every shared accepted/blocked MIME type"
  - "A structural single-source sweep in dup01-file-intake.spec.ts that fails if any of the five list constants is ever re-declared outside file-intake.ts"
affects: [creation-flow, video-upload, versions-reupload]

tech-stack:
  added: []
  patterns:
    - "Single-source accept/blocked/size-limit lists: one module owns the const, every consumer (client validator, server zod schema) imports rather than re-declares"
    - "Behavioural parity harness (tsx subprocess) over grep/substring assertions for accept-list correctness — see 2026-06-05 CLAUDE.md learning"

key-files:
  created:
    - scripts/accept-list-parity-check.tsx
  modified:
    - src/lib/upload/file-intake.ts
    - src/lib/validators/sop.ts
    - tests/phase40/dup01-file-intake.spec.ts

key-decisions:
  - "BLOCKED_MIME_TYPES relocated from validators/sop.ts to file-intake.ts as the fifth exported list; the blocked-macro check in validateIntakeFile now checks both BLOCKED_EXTENSIONS and BLOCKED_MIME_TYPES so a macro workbook renamed to .xlsx is caught client-side too, not just server-side"
  - "uploadFileSchema's error message now interpolates the shared INTAKE_HINT string instead of hardcoding a second, independently-maintained format list"

requirements-completed: [DUP-01]

duration: 25min
completed: 2026-07-29
---

# Phase 40 Plan 10: DUP-01 accept-list derivation gap closure

**A .webp upload used to pass the client's shared intake validator and then get rejected by the server's separately-maintained accept list; now both derive from one module, and the regression test that missed this exercises the real zod schema instead of grepping for a substring.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-29T13:38:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created)

## Accomplishments

- `src/lib/upload/file-intake.ts` is now the single owner of `ACCEPTED_MIME_TYPES`, `BLOCKED_EXTENSIONS`, `BLOCKED_MIME_TYPES`, `MAX_FILE_SIZE`, `MAX_VIDEO_FILE_SIZE` (adds `BLOCKED_MIME_TYPES`, previously duplicated only in `validators/sop.ts`)
- `validateIntakeFile`'s blocked-macro branch is now MIME-aware as well as extension-aware (closes a real spoofing hole: a macro workbook renamed to `.xlsx` used to pass the client check)
- `src/lib/validators/sop.ts` deleted its five duplicate local consts and imports everything from `@/lib/upload/file-intake`; `uploadFileSchema` and `uploadVideoFileSchema` now derive their accept/reject predicates and size caps from the shared lists, and the error message uses the shared `INTAKE_HINT` string
- `scripts/accept-list-parity-check.tsx` — new tsx harness that runs the REAL `uploadFileSchema`/`uploadVideoFileSchema`/`getSourceFileType` against every entry in `ACCEPTED_MIME_TYPES` and `BLOCKED_MIME_TYPES`, rather than grepping source text
- `dup01-file-intake.spec.ts`: replaced the IN-03 presence-only test with a shell-out to the harness, added a structural single-source sweep across all of `src/`, and an import-of-shared-module assertion

## Task Commits

1. **Task 1: Make file-intake.ts the sole owner of the intake lists and derive uploadFileSchema from it** - `240c0b4` (fix)
2. **Task 2: Replace the presence-only accept-list assertion with a runnable parity proof** - `ff77b70` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/upload/file-intake.ts` - added exported `BLOCKED_MIME_TYPES`; `validateIntakeFile`'s blocked-macro check now also matches MIME type
- `src/lib/validators/sop.ts` - deleted duplicate `ACCEPTED_TYPES`/`BLOCKED_MIME_TYPES`/`BLOCKED_EXTENSIONS`/`MAX_FILE_SIZE`/`MAX_VIDEO_FILE_SIZE`; imports all five from `@/lib/upload/file-intake`; `uploadFileSchema`/`uploadVideoFileSchema` derive from the imports
- `scripts/accept-list-parity-check.tsx` - new tsx harness proving server-schema/getSourceFileType parity for every shared accepted/blocked MIME type
- `tests/phase40/dup01-file-intake.spec.ts` - IN-03 fix: real-schema parity test (shells to the harness) + single-source structural sweep + import assertion, replacing the old getSourceFileType presence-only test

## Decisions Made

- Kept `uploadFileSchema`'s size ceiling at `MAX_FILE_SIZE` (50MB) unchanged — video uploads route through `uploadVideoFileSchema`/`createVideoUploadSession`, not `uploadSessionSchema`, per the plan's explicit instruction not to alter that semantic.
- The single-source sweep is keyed on five specific token names (`ACCEPTED_MIME_TYPES`, `BLOCKED_EXTENSIONS`, `BLOCKED_MIME_TYPES`, `MAX_FILE_SIZE`, `MAX_VIDEO_FILE_SIZE`), matching the plan's data-keyed sweep design rather than a hardcoded file list — this is what makes the drift structurally impossible rather than merely currently-absent.

## Mutation-check observations (plan-mandated, run and reverted)

1. **Removing `image/webp` from `ACCEPTED_MIME_TYPES` in file-intake.ts** — the parity harness stays green (14 types instead of 15). This is expected and correct: the harness has no hardcoded expectation of which types must appear, it only proves the schema agrees with whatever the shared list currently says. It is NOT a regression detector for "someone deleted a type from the shared list" — that would need a separate fixed-list assertion (out of this plan's scope; the plan's own `"the shared module's accept list contains image/webp, video/mp4, video/quicktime"` test already covers that case).
2. **Re-adding a hardcoded `const ACCEPTED_MIME_TYPES = [...]` literal to `validators/sop.ts`** — the structural single-source sweep fails immediately (`declarers` includes both `file-intake.ts` and `validators/sop.ts`, sweep expects exactly `[file-intake.ts]`). This is the WR-01 guard working as designed: any future re-introduction of a second accept-list constant under `src/` is caught by this test, regardless of which file it lands in.

Both mutations were applied via `Edit`, verified, and reverted before the Task 2 commit; `git diff --stat` on `file-intake.ts`/`sop.ts` confirmed no residual drift before committing.

## Deviations from Plan

None - plan executed exactly as written. `isBlockedMacroFile` and `getSourceFileType` in `validators/sop.ts` needed no changes beyond the import swap (the plan anticipated this — `isBlockedMacroFile` already referenced the (now-imported) `BLOCKED_EXTENSIONS` identifier by name).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GAP 1 (DUP-01) from 40-VERIFICATION.md is closed: the shared intake module and the server schema now agree on `image/webp` (and every other type) by derivation, not by two lists happening to match.
- 40-REVIEW.md WR-01 and IN-03 are both closed.
- `npx tsc --noEmit` and `npm run build` both clean; `/sops/[sopId]` bundle unchanged (1059 KB, Δ0).
- `npx playwright test --project=phase40` — 50 passed, 1 skipped (pre-existing, unrelated to this plan), 0 failures.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
