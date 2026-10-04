---
phase: 56-a-simpler-sop-the-decision-ledger
verified: 2026-10-04T02:30:00Z
status: passed
score: 5/5 roadmap success criteria verified (plus plan must-haves; 6/6 requirement IDs earned)
overrides_applied: 0
re_verification: false
gaps: []
deferred:
  - truth: "Step-level standard labels visible to a worker on the walk"
    addressed_in: "Phase 58"
    evidence: "Amendment A-05 (56-CONTEXT): step-level labels show in the standards panel and reach the walk in Phase 58; Phase 58 goal re-homes the walk over the Phase 56 focus-step rows and FOC-02 puts standards in the left rail"
  - truth: "Standards manager mounted in the Workshop"
    addressed_in: "Phase 61"
    evidence: "ROADMAP Phase 56 goal and placement notes: 'standalone panel opened from the admin SOP page now; Phase 61 mounts it in the Workshop'"
human_verification: []
---

# Phase 56: A Simpler SOP and the Decision Ledger - Verification Report

**Phase Goal:** A SOP becomes sections and steps (hazard, PPE, step, check as kinds of step) with every existing SOP converted losslessly; standards as plain labels on SOP, section or step with one list to manage them; every SOP on a machine or the whole site with department from the machine; an append-only decision ledger the database protects, written by every existing decision-making action; the old SOP page and builder keep working until Phase 58.
**Status:** passed
**Re-verification:** No, initial verification.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every existing SOP keeps every hazard and PPE item, now as hazard/PPE steps in its section; per-SOP before/after count shows nothing lost | VERIFIED | `src/lib/sop/convert.ts` (hard gate: hazard-after >= hazard sources, ppe-after >= PPE cards, every PPE item present, unknown type or empty hazard = failure). Production apply 56-CONVERSION-APPLY.md: 70 SOPs, 70 ok, 0 failed, hazard 288->293, PPE cards 17->19 (items 111/111), second run 0 converted. Counts persist per SOP in `sop_conversion_runs`; eval A reads them live. I re-ran the read-only dry run with the post-review converter: hazard 288->293, PPE 17->19 (111/111), 72/72 ok. The WR-01 fix changes nothing in production data. The 46 "empty" SOPs are probe/fixture/empty-upload drafts (0->0). Note: converted rows live in `sop_focus_steps` beside the untouched originals (D-01/A-01), not in `sop_steps`. |
| 2 | Admin can put a standard on a SOP, section or step, add/rename/remove from one list; label shown wherever the SOP is shown; library-linked SOPs still show their content | VERIFIED | `00069` `standards` + `standard_attachments` (one FK column per level, `num_nonnulls = 1`, cascade on delete); `src/actions/standards.ts` (`requireAdminContext` first, org checks); `BuilderStandardsButton` mounted in `BuilderStageShell` Tools menu; `StandardLabels` rendered in `sops/[sopId]/page.tsx`, ReadTab, DesktopWalkthrough, ImmersiveStepCard. Eval C (add, attach to SOP and section, worker sees label on Read and walk, rename propagates, remove clears) green with screenshots read. Eval A confirms library-linked SOPs converted; no library row dropped. Step-level labels are panel-only until Phase 58 (A-05, deferred). |
| 3 | Every SOP is on machine(s) or the whole site, shows its machine's department; unplaced SOPs are site-wide | VERIFIED | `00069` `sops.placement` (default `'site'`, backfilled from `sop_machines`) kept true by invoker trigger `sop_machines_sync_placement` (insert/delete, covers FK cascade; live spec 56-04 proved it). `src/lib/sop/placement.ts` derives department from machines; worker page renders `placementLabel`; machines picker shows Whole site. Eval D screenshots: "EVAL Press · Forming" and "Whole site". |
| 4 | Approve, reject, sign off, assign, publish, change owner, record observation, clear AI finding each write one decision naming who/when/what/about; AI agent decisions name the agent | VERIFIED | One writer `src/lib/decisions/record.ts` (org + actor from `getSessionContext()` only; `DecisionInput` has no org/actor field). 17 `recordDecision(` call sites across approvals (approve/reject), completions (sign_off/reject/countersign), assignments (assign/unassign), publish-core (publish), governance (owner_change/review/cadence), observations, sop-section-blocks (verify / ai_finding_cleared / verify_withdrawn), ai-fields (accept/reject/ai_field_write). `scripts/decision-writers.json` data-keyed sweep over 9 decision tables + 3 column keys passes (phase56 project: 98 passed, 15 live specs skipped). Publish gate body hash pin holds (`assertPublishGates` contains no `recordDecision`). Agent rows: `AGENT_NAMES` allowlist, `buildDecisionRow`, and DB CHECK `decisions_agent_named`; eval E asserts `actor_kind='agent'`, `actor_name='SOPstart assistant'`. Fail-soft after the primary write, distinct log tag. |
| 5 | Nobody can change or delete a decision; the database refuses even with the screen bypassed | VERIFIED | `00070`: row trigger `decisions_no_update_delete` and statement trigger `decisions_no_truncate`, both `enable always` (`tgenabled='A'` asserted live in 56-04); UPDATE/DELETE/TRUNCATE revoked from anon, authenticated and service_role; no authenticated INSERT policy; single admin-only SELECT policy; the two orphan SECURITY DEFINER block-update RPCs lose EXECUTE. Eval F (deployed, service key) asserts UPDATE and DELETE on the oldest decision return errors and the row is unchanged; unnamed agent insert returns 23514. Honest limit (documented in migration and matrix): the table owner could disable a trigger on purpose. |

**Score:** 5/5

## Plan must-haves (spot checks beyond roadmap)

| Must-have | Status | Evidence |
|-----------|--------|----------|
| Old SOP page and builder keep working over converted SOPs (no row or column added to `sop_steps` / `sop_sections` / `layout_data`) | VERIFIED | Converted rows in separate `sop_focus_steps`; `sop_steps` count and `layout_data` unchanged per apply report; eval B (deployed) renders converted fixture on worker Read, walk ("Step 1 of 2") and builder with hazards, callouts and measurement; screenshots read. |
| Conversion safe to re-run at Phase 58 cutover | VERIFIED | Upsert keyed `(section_id, source_key)` preserving ids so step-level attachments survive; layout hash no-op; second `--apply --all` = 0 converted / 70 unchanged. |
| RLS org-scoped on every new table (USING restated in WITH CHECK) | VERIFIED | 00069/00070 read in full; `rls-org-scope` lint passes per VALIDATION; `tsc --noEmit` exit 0. |
| Capability matrix updated with new gates | VERIFIED | `CAPABILITY-MATRIX.md` rows for view/manage standards, read/write/change decisions, placement trigger, RPC lockdown. |
| `journeys.ts` updated for the new flow | VERIFIED | New "Label a SOP with a standard" journey; build-stage Tools list updated; no new `page.tsx` route was added (panel is a modal), so no unmapped screen. |
| Design tokens only | VERIFIED | Review confirmed token utilities only; eval screenshots show tinted labels. |

## Review fixes (post-56-REVIEW) present

| Finding | Commit | Verified in code |
|---------|--------|------------------|
| WR-01 empty `layout_data.content` shadows step rows | 951d40f | `convert.ts`: `useLayout = Array.isArray(layout) && layout.length > 0`; unit case added; spec passes |
| WR-02 `recordSignature` `sop_id: null` | 1d1c249 | `completions.ts` selects `sop_id` and passes `completion.sop_id` |
| WR-03 reconcile reports every cadence row unmatched | 4d00b15 | `reconcile-decisions.mjs` subj now text, cadence matched on `details->>'category'` |
| WR-04 standards panel 8-10 KB GET | 9cf28a4 | `standards.ts`: `.or(...)` removed; in-memory filter against id sets |

All four are on `origin/master` (HEAD 9cf28a4). They post-date the deployed eval (fa65313) and are covered by unit/source specs; none alters a path the eval exercises beyond standards panel read shape (unchanged).

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|-------------|--------------|--------|----------|
| SOP-01 | 56-01 (early tick), 56-02, 56-03, 56-07, 56-10 | SATISFIED (earned) | Converter + hard gate + production apply 70/70 + before/after report. The 56-01 tick was early (Wave 0 only); now earned by 56-02/07 shipped code and data. |
| SOP-02 | 56-03 (early tick), 56-06, 56-09 | SATISFIED (earned) | Tables, actions, builder panel, worker labels, eval C. The "in the Workshop" half is Phase 61 by roadmap decision (deferred, not a gap). |
| SOP-03 | 56-03 (early tick), 56-04, 56-09 | SATISFIED (earned) | `placement` column + trigger + helper + UI; eval D. |
| DEC-01 | 56-01, 56-03, 56-05, 56-08 | SATISFIED | 17 hook sites + sweep + backfill (5 rows from seven sources) + eval E/F. |
| DEC-03 | 56-03 (early tick), 56-04, 56-10 | SATISFIED (earned) | Triggers + revokes live; probe and eval F. |
| DEC-04 | 56-03 (early tick), 56-05, 56-08 | SATISFIED (earned) | Allowlist, builder, DB CHECK, `applyAiWrite`; eval E/F. |

No orphaned requirement IDs: REQUIREMENTS.md maps exactly SOP-01..03 and DEC-01, DEC-03, DEC-04 to Phase 56; all appear in plan frontmatter. DEC-02 is Phase 59.

## Behavioral Spot-Checks and Evidence Weighed

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx playwright test --project=phase56` | 98 passed, 15 skipped (live-DB specs, self-skip without `PHASE56_LIVE=1`; not re-run to protect OTP budget) |
| Read-only converter dry run (service key, no OTP; report to scratchpad, not the phase dir) | 72/72 ok, hazard 288->293, PPE 17->19 (111/111); matches the applied totals |
| 56-EVAL.md | 34 passed / 0 failed / 1 skipped (pre-existing Phase 52 skip) on https://sopstart.com, commit fa65313; every `ledger-*.png` read |
| Debt markers (TBD / FIXME / XXX) in files changed this phase | none |

## Anti-Patterns

None blocking. Info:

| Item | Severity | Note |
|------|----------|------|
| Migrations 00068-00070 not recorded in `supabase_migrations.schema_migrations` (applied via Management API; bare `supabase db push` will fail on 00068 until `supabase migration repair --status applied 00068 00069 00070`) | Warning (operational, not a goal gap) | Documented in 56-04-SUMMARY; do not run a bare `db push` first |
| Ledger-writing evals leave permanent rows by design (append-only) | Info | Eval scoped to the eval-site org and refuses the real org id |
| REVIEW info items IN-01 (`supersedes` unvalidated, no caller) and IN-02 (`any` cast in `record.ts`) remain | Info | No caller passes `supersedes` today; revisit when Phase 59 adds corrections |
| REQUIREMENTS.md traceability table still says Pending for SOP-01..03 and DEC-03..04 (checkboxes are ticked) | Info (bookkeeping) | Orchestrator should flip the table to Complete when it closes the phase |

## Human Verification Required

None. The deployed eval with read screenshots is the UAT artefact; nothing here needs a manual click-path.

## Gaps Summary

No gaps. Two items are explicitly deferred by locked decisions, not omissions: step-level labels on the worker walk (Phase 58, A-05) and the Workshop mount of the standards manager (Phase 61). The phase delivers a reversible, additive conversion (original rows untouched, re-runnable), the standards model with a working admin panel, derived placement, and a database-enforced append-only ledger written by every existing decision path.

---

_Verified: 2026-10-04_
_Verifier: Claude (gsd-verifier)_
