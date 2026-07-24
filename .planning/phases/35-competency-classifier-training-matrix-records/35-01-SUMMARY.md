---
phase: 35-competency-classifier-training-matrix-records
plan: 01
subsystem: competency-classifier
tags: [competency, training-matrix, csv-export, pure-function, playwright]
dependency-graph:
  requires: []
  provides:
    - classifyCompetency (src/lib/competency/classify.ts)
    - buildMatrix (src/lib/competency/matrix.ts)
    - generateTrainingCsv (src/lib/competency/csv.ts)
    - phase35 / phase35-unit Playwright projects
  affects:
    - future 35-02..35-04 plans (server actions, matrix UI, worker profile, CSV entry points)
tech-stack:
  added: []
  patterns:
    - "Pure DB-free classifier mirroring src/lib/governance/classify.ts (no 'use server', no supabase import, sync export)"
    - "Pure assembler mirroring src/lib/org-model/resolve-sop-access.ts (pre-fetched arrays in, computed cells/rollups out)"
    - "Source-contract regex guard forked from tests/phase28/library-and-worker.spec.ts (D28-07 -> CMP-04)"
key-files:
  created:
    - src/lib/competency/classify.ts
    - src/lib/competency/matrix.ts
    - src/lib/competency/csv.ts
    - src/lib/competency/__tests__/classify.test.ts
    - src/lib/competency/__tests__/matrix.test.ts
    - src/lib/competency/__tests__/csv.test.ts
    - tests/phase35/matrix-derivation.spec.ts
    - tests/phase35/no-competency-gate.spec.ts
  modified:
    - playwright.config.ts
decisions:
  - "CompetencyState kept at exactly four members; 'awaitingSignOff' added as a presentation-only boolean on CompetencyResult rather than a 5th canonical state (Open Question 1, resolved in RESEARCH)"
  - "csv.ts/matrix.ts header comments avoid literal 'access_grants'/'use server' substrings in prose so the MTX-02 source-contract guard doesn't false-positive on its own analog file's documentation"
metrics:
  duration: ~35min
  completed: 2026-07-24
---

# Phase 35 Plan 01: Competency Classifier + Matrix Assembler + CSV Generator Summary

Built the three pure, DB-free competency derivation modules (classifier, matrix assembler, CSV generator) plus the full Phase 35 Playwright test harness — including the locked CMP-04 north-star guard — establishing the single source of truth every downstream 35-0x plan (server actions, matrix UI, worker profile, CSV export) must call rather than recompute.

## What Was Built

**`src/lib/competency/classify.ts`** — `classifyCompetency(evidence)` implements the D-01 highest-evidence-wins ladder (`not_started` → `read` → `supervised` → `competent_signed_off`, no prerequisite ordering — a sign-off alone yields `competent_signed_off`) plus the D-02 `needs_support` reset (a `needs_support` observation newer than the latest positive evidence drops state to `read` and flags it, never demoting below `read`, never advancing `not_started`). Adds a presentation-only `awaitingSignOff` boolean without expanding the four-member `CompetencyState` union.

**`src/lib/competency/matrix.ts`** — `buildMatrix(input)` takes pre-fetched arrays (people, `requiredSopsByPerson` map, sops, completions, sign-offs, observations) and maps `classifyCompetency()` over every (person, requiredSop) pair with zero further DB round-trips. Returns `{ cells, rowRollups, colRollups }`. Each cell exposes `latestCompletionAt`/`latestCompletionVersion` for Phase 36 forward-compat. Required set is required-SOPs-only (D-10) — completions of SOPs outside a person's required set never appear in cells or rollups.

**`src/lib/competency/csv.ts`** — `generateTrainingCsv(rows)` emits a SuccessFactors-shaped generic training-events CSV (one row per completion, D-14): `worker_email, worker_name, sop_identifier, sop_title, sop_version, completion_date, signoff_status, signoff_by, signoff_date`. Internal `csvField()` applies RFC-4180 quoting (wraps + doubles embedded quotes when a value contains a comma, quote, or newline). `worker_name` falls back to `worker_email` since no full-name field exists anywhere in this codebase (RESEARCH Assumption A1).

**Playwright harness** — registered `phase35` (broad `tests/phase35/**` source-contract project) and `phase35-unit` (`src/lib/competency/__tests__` static-`@/`-import behavioral project), mirroring the phase28/32/33/34 registration-discipline convention. `matrix-derivation.spec.ts` mechanically enforces MTX-02 (matrix.ts never references the raw grants table name or imports the grants action module) and purity (no `'use server'`, no Supabase import) across all three lib modules. `no-competency-gate.spec.ts` forks the Phase 28 D28-07 `GATE_PATTERN` idiom to guard `ReadTab.tsx`, the worker SOP detail route, and the not-yet-created `CompetencySection.tsx` (skipped via `fs.existsSync` until 35-04 ships it) against any competency-state conditional — CMP-04's locked north star that competency state never gates worker access.

## Verification

- `npx playwright test --project=phase35-unit` — 17/17 passed (classify: 7, matrix: 5, csv: 5)
- `npx playwright test --project=phase35` — 12 passed, 1 correctly skipped (CompetencySection.tsx not yet created)
- `npx playwright test --list --project=phase35-unit` — lists all 3 test files (registration proof)
- `npx playwright test --list --project=phase35` — lists both spec files, 13 tests total (registration proof)
- `npx tsc --noEmit` — clean, zero errors on the new modules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header comments in matrix.ts/csv.ts false-positived their own MTX-02/purity source-contract guard**
- **Found during:** Task 2 verification (`npx playwright test --project=phase35 tests/phase35/matrix-derivation.spec.ts` failed 4/9)
- **Issue:** The plan-specified documentation comments in `matrix.ts` and `csv.ts` explained the MTX-02/purity rules by literally quoting the forbidden substrings (`access_grants`, `'use server'`) in prose — the regex-based source-contract test can't distinguish a comment describing the rule from an actual violation, so it correctly flagged the literal string match.
- **Fix:** Reworded the header comments to describe the same rules without using the literal substrings (e.g. "the grants action module" instead of `@/actions/grants`'s raw table name, "server-action directive" instead of quoting `'use server'`).
- **Files modified:** src/lib/competency/matrix.ts, src/lib/competency/csv.ts
- **Commit:** 97d146c

No other deviations — plan executed as written.

## Self-Check: PASSED

- FOUND: src/lib/competency/classify.ts
- FOUND: src/lib/competency/matrix.ts
- FOUND: src/lib/competency/csv.ts
- FOUND: src/lib/competency/__tests__/classify.test.ts
- FOUND: src/lib/competency/__tests__/matrix.test.ts
- FOUND: src/lib/competency/__tests__/csv.test.ts
- FOUND: tests/phase35/matrix-derivation.spec.ts
- FOUND: tests/phase35/no-competency-gate.spec.ts
- FOUND commit c5e7881 (Task 1)
- FOUND commit 97d146c (Task 2)
- FOUND commit 27e5350 (Task 3)
