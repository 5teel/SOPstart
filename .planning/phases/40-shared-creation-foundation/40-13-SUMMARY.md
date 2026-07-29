---
phase: 40-shared-creation-foundation
plan: 13
subsystem: api
tags: [supabase, server-actions, rls, ux-copy]

requires:
  - phase: 40-shared-creation-foundation
    provides: reparseSop/restructureSop re-parse flow (originally shipped in earlier 40-xx plans)
provides:
  - reparseSop with preconditions (auth, admin/safety_manager role, org match, source-file existence) ordered strictly before any destructive delete/status-reset
  - Retry affordance ("Try again") suppressed for input_type === 'ai_prompt' drafts, since reparseSop cannot recover them
  - Retry fetch response handling (res.ok check + network-error catch) instead of a bare .catch(console.error)
affects: [admin-sops-review, parse-job-status]

tech-stack:
  added: []
  patterns:
    - "Server action precondition ordering: fetch + verify everything (role, org, external resource) before the first destructive write, so a failed check destroys nothing"

key-files:
  created:
    - tests/phase40/reparse-precondition.spec.ts
  modified:
    - src/actions/sops.ts
    - src/components/admin/ParseJobStatus.tsx

key-decisions:
  - "Compared sop.organisation_id against the SESSION organisationId (not a value derived from the fetched row) per CLAUDE.md [2026-07-28] guidance"
  - "Did not touch restructureSop — its transcript_text precondition already runs before its own delete, confirmed by reading lines 261-307"
  - "Left the dead failedStageName/void onRetry block untouched (40-REVIEW.md IN-02, explicitly out of scope)"
  - "Re-driving an ai_prompt job from parse_jobs.prompt_text is out of scope; the affordance is removed instead"

requirements-completed: [DUP-01]

duration: ~20min
completed: 2026-07-29
---

# Phase 40 Plan 13: Safe re-parse precondition ordering Summary

**Reordered `reparseSop` so every precondition (role, org match, source-file existence) runs before any destructive delete/status-reset, and removed the "Try again" retry affordance for AI-prompt drafts that can never be re-parsed.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 (+1 test file created)

## Accomplishments
- `reparseSop` (`src/actions/sops.ts`) now verifies auth, admin/safety_manager role, org ownership (session-derived, not row-derived), SOP existence, and source-file existence via `createSignedUrl` — all BEFORE the `sop_sections` delete and `status: 'parsing'` reset. A failed precondition now costs the user nothing.
- Added the missing role guard on `reparseSop` (WR-02) — previously any authenticated org member could trigger a destructive re-parse.
- `ParseJobStatus.tsx`'s `handleReparse` no longer routes to `/api/sops/ai-prompt` (which requires `promptText` and creates a brand-new SOP rather than re-parsing). The "Try again" button is now gated by `canRetry = inputType !== 'ai_prompt'`, with a plain-language replacement line for AI-prompt drafts telling the admin to start a new draft.
- The retry fetch now awaits the response, checks `res.ok`, and on failure (or a network error) restores `status: 'failed'` with a user-facing message — instead of silently swallowing the response via `.catch(console.error)`.
- New `tests/phase40/reparse-precondition.spec.ts`: a positional guard (not a presence grep) asserting `createSignedUrl(` occurs before `.from('sop_sections')` and `status: 'parsing'` in the `reparseSop` body slice, plus role/org guard checks, the removed ai-prompt endpoint, the retry gate wiring, and the response-handling wiring.

## Task Commits

1. **Task 1: Reorder reparseSop so nothing is destroyed until its preconditions hold** - `35a4dcf` (fix)
2. **Task 2: Remove the retry affordance where it cannot work, and stop swallowing the response** - `a409bd4` (fix)

## Files Created/Modified
- `src/actions/sops.ts` - `reparseSop` reordered: role guard → SOP fetch → session-org comparison → source-file `createSignedUrl` check → (only then) section delete + status reset + parse_jobs insert
- `src/components/admin/ParseJobStatus.tsx` - `handleReparse` endpoint mapping drops the `ai_prompt` arm; `canRetry` gate added around the failed-state "Try again" button with a plain-language fallback line; retry fetch checks `res.ok` and catches network errors, restoring `'failed'` state with a message in both cases
- `tests/phase40/reparse-precondition.spec.ts` - positional + wiring guard for both fixes (new)

## Decisions Made
- Session-org comparison (`sop.organisation_id !== organisationId`) uses `getSessionContext()`'s `organisationId`, never a value derived from the fetched SOP row itself — per the CLAUDE.md [2026-07-28] "any value derived from a client-supplied id is untrusted" learning.
- `restructureSop` was read and confirmed to already check its `transcript_text` precondition before its own `sop_sections` delete — no change needed there, as anticipated by the plan.
- Scoped the "no swallowed .catch(console.error)" test assertion to `handleReparse`'s body only, not the whole file — `handleRestructure`'s fire-and-forget `.catch(console.error)` is a separate, out-of-scope pattern untouched by this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Mutation Proof (plan-required)

Per the plan's acceptance criteria, the positional test was proven to fail on regression:
1. Temporarily moved the `sop_sections` delete + `status: 'parsing'` reset back above the `createSignedUrl` check in `reparseSop` (simulating the original CR-04 bug).
2. Ran `npx playwright test --project=phase40 --grep "createSignedUrl precedes"` — **FAILED** with `Error: createSignedUrl check must run before sop_sections delete` (`Expected: < 1306, Received: 1806`).
3. Reverted the mutation (`git diff --stat src/actions/sops.ts` confirmed empty against the committed state afterward).
4. Re-ran the full `phase40` project — **54 passed, 1 skipped** (the 1 skip is a pre-existing unrelated test, not introduced by this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-04 and WR-02 from 40-REVIEW.md are closed.
- No destructive operation in `reparseSop` runs before its full precondition chain, enforced positionally by a spec that provably goes RED on regression.
- The retry affordance is offered only where retrying can succeed; a failed retry now reports itself to the user.
- Deliberately not addressed (per plan scope): re-driving an `ai_prompt` job from its persisted `parse_jobs.prompt_text`, and the dead `failedStageName`/`void onRetry` block (40-REVIEW.md IN-02).

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
