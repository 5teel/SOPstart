---
phase: 58-the-sop-focus-screen-walk-edit
plan: 06
subsystem: ai-reviewer
tags: [anthropic, reviewer, sop_ai_findings, focus-steps, api-route]
requires: [58-03, 58-04, 58-05]
provides:
  - "AI check reads the draft: second non-cached DRAFT STEPS block of { step_id, section, kind, text } after the cached source block"
  - "every finding names a step_id from the draft or none (unknown ids nulled)"
  - "findings stored as sop_ai_findings rows; new run retires the previous run's OPEN rows, cleared rows stay"
  - "runReviewerForSop: runs for any SOP; no source => draft-only jobs D and E"
  - "route POST for any SOP in the session org; GET returns { findings, lastRunAt, hasSource, flags }"
affects: [58-07, 58-12, 58-13, 58-16]
key-files:
  modified:
    - src/lib/parsers/ai-reviewer/orchestrator.ts
    - src/lib/parsers/ai-reviewer/types.ts
    - src/lib/parsers/ai-reviewer/index.ts
    - src/lib/parsers/ai-reviewer/source-content.ts
    - src/lib/parsers/ai-reviewer/jobs/job-a-hallucination.ts
    - src/lib/parsers/ai-reviewer/jobs/job-b-omission.ts
    - src/lib/parsers/ai-reviewer/jobs/job-c-anchoring.ts
    - src/lib/parsers/ai-reviewer/jobs/job-d-table-fidelity.ts
    - src/lib/parsers/ai-reviewer/jobs/job-e-terminology.ts
    - src/lib/parsers/ai-reviewer/__tests__/orchestrator.test.ts
    - src/lib/parsers/ai-reviewer/jobs/__tests__/jobs.test.ts
    - src/app/api/sops/[sopId]/ai-reviewer/route.ts
    - src/components/admin/ai-reviewer/useReviewerFlags.ts
    - tests/phase58/reviewer-steps.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "The all-clear marker is severity 'warning' with cleared_at set, not 'info': sop_ai_findings.severity only allows critical/warning (00071)"
  - "New rows are inserted BEFORE the previous run's open rows are deleted, so a failed insert leaves the old findings (and the gate) in place"
  - "Without a source, runReviewerForSop forces jobs D and E whatever was requested, and the system prompt gets a 'no source document' note"
  - "A SOP with neither source nor steps answers 422 nothing_to_review instead of writing a misleading all-clear"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 06: AI check reads steps, findings as rows Summary

**The AI check now reads the draft's focus steps, every finding names a real step id (or none), findings are `sop_ai_findings` rows the gate and editor both understand, and a blank SOP with no source runs the wording-and-numbers jobs only.**

WRK-04 is not ticked: the editor banner that shows these rows lands in 58-13.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `554a856e` | orchestrator + five jobs re-keyed to `step_id`, rows persisted, tests repointed |
| 2 | `1e6267bd` | route reshaped, `reviewer-steps` spec filled |
| 2b | summary commit | matrix row names the route gate; this summary |

## Job set without a source (D-17)

`hasSource` is the trimmed source text of the SOP's latest parse job (`pickSourceText`, one shared helper, used by the orchestrator, `buildSourceContentBlock` and the route). No parse job or an empty source means `hasSource = false`: only **D** (numbers) and **E** (terminology) run, on the DRAFT STEPS block alone, with a "there is no source document" note appended to the system prompt. A/B/C need a source to compare against and are skipped.

## How the per-day cap counts

Unchanged. `ai_review_rate_limits` is keyed on `sop_id` (not on a parse job), so a blank SOP is capped at 5 runs per UTC day like any other; the planned fallback (count distinct `run_id` in `sop_ai_findings`) was not needed. The org spend cap is untouched; spend is recorded in a `finally`, so a failed persist still records the cost.

## Persistence rules

- Each run gets a `run_id`. Rows are inserted first, then the SOP's OPEN rows from other runs are deleted (`cleared_at is null`, `run_id <> this run`, org-scoped). Cleared rows stay on record.
- A job that throws becomes an open SOP-level `job_error` row ("The {job} check didn't run - clear it once you've looked over the steps yourself."), so an outage is never read as "no findings". The envelope's `job_status` / `job_errors` are kept.
- A run with no rows at all writes one `all_clear` row, born cleared (`cleared_by` null), so the editor can tell "never run" from "nothing found" and the gate never counts it.
- The `parse_jobs.ai_review_results` envelope is still written when a parse job exists (old builder panel, until 58-16). The route's GET also returns that envelope's `flags` so the old panel keeps working; `useReviewerFlags` groups by `step_id` now.

## Tests repointed

- `phase21-ai-reviewer` (7 tests, 21 across both reviewer projects): the three originals repointed to source + draft blocks and rewritten on a stub that serves `sop_focus_steps` / `sop_sections` and records `sop_ai_findings` inserts and deletes; new tests for unknown `step_id` nulling (+ 1000-char cap), draft-only run on a SOP with no parse job, job error row, all-clear row, and nothing-to-review. The stub evicts `source-content` and `job-e-terminology` too, which previously kept the first test's admin client.
- `phase21-ai-reviewer-jobs`: `block_id` -> `step_id`; one test for a null `step_id`.
- `phase58 reviewer-steps`: six source-contract tests (draft block not cached, `step_id` everywhere and no `block_id`, insert-before-delete and cleared rows kept, draft-only wiring, route caps + org scope on every admin query + role gates, cap keyed on `sop_id`).

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0 (bundle gate Δ 0 KB on both gated routes).
- `phase21-ai-reviewer` + `phase21-ai-reviewer-jobs` 21/21; `phase58 reviewer-steps` 6/6; whole `phase58` project 67 passed / 39 skipped (live probes, not run).
- Neighbouring guards that read these files: `phase21-stubs scp-ai-reviewer` 7/7, `phase40 route-auth-org-scope` 4/4, `phase30 plain-language` 4/4, both capability-matrix specs green.
- No Anthropic call was made; the client is stubbed.

## Deviations from Plan

**1. [Rule 1 - plan contradicts schema] All-clear severity.** The plan says `severity 'info'`; `sop_ai_findings.severity` is checked against `critical` / `warning` only (00071, noted in 58-03), so an `info` insert would be rejected. The marker is `severity 'warning'`, `kind 'all_clear'`, `cleared_at = now()`. Nothing counts it (the gate reads open rows).

**2. [Rule 2 - correctness] Insert before delete.** The plan's order (delete open rows, insert new) leaves a SOP with no open findings if the insert fails, silently lifting the publish gate. Order reversed.

**3. [Rule 2 - correctness] `NothingToReviewError`.** A SOP with no source and no steps would otherwise get an "all clear" for nothing. The orchestrator throws, the route answers 422 `nothing_to_review`.

**4. [Rule 3 - compat] GET keeps `flags`.** The plan removes the envelope response; the old builder's `useReviewerFlags` still reads `envelope.flags` until 58-16, so GET returns the latest envelope's flags alongside the new fields.

**5. Capability matrix.** The "run the AI check" row now also names the route's inline admin / safety_manager check (matrix maintenance trigger).

No deviation from the Anthropic model id: `VERIFY_MODEL` is untouched.

## Known Stubs

None. `reviewer-steps` has no `fixme` left.

## Threat Flags

None beyond the plan's register. T-58-reviewer (unknown ids nulled, JSON-parsed, 1000-char cap, findings advisory only), T-58-11 (SOP resolved with the session organisation; GET via `requireSopEditAccess`), T-58-12 (caps unchanged, POST admin/safety_manager) and T-58-13 (job errors become open rows) are each pinned by a unit test or the source-contract spec.

## Self-Check: PASSED

- Files present: orchestrator, route, both reviewer tests, `reviewer-steps.spec.ts`
- Commits `554a856e`, `1e6267bd` exist
- `grep block_id` over `src/lib/parsers/ai-reviewer` (non-test) returns nothing; no `sop_steps` in job E; no `no_parse_job` / `never_run` in the route
