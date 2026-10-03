---
phase: 56
slug: a-simpler-sop-the-decision-ledger
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-04
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `56-RESEARCH.md` § Validation Architecture, adjusted for amendment A-01 (generated rows in their own table — the `no-unfiltered-step-reads` lint is no longer needed).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Test (specs + deployed evals) |
| **Config file** | `playwright.config.ts` (56-01 adds project `phase56`; unit specs for pure modules live in `tests/phase56/` with static `@/` imports — precedent `tests/phase55/sop-pack.spec.ts`) |
| **Quick run command** | `npx playwright test --project=phase56` (live-DB specs self-skip unless `PHASE56_LIVE=1`) |
| **Live run command** | `PHASE56_LIVE=1 npx playwright test --project=phase56 <spec>` — once per plan that owns it (shared OTP budget) |
| **Full suite command** | `npx playwright test` — **once per gate only** (compare non-live failures against `55-BASELINE-FAILURES.md`, never loop) |
| **Deployed eval** | `npm run eval -- --phase 56` |
| **Estimated runtime** | phase56 quick ~60 s; full suite ~15 min; eval ~5 min |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase56` + `npx tsc --noEmit`; `npm run build` for any task touching `src/actions/*`, a route, or the `/sops` chunk (postbuild bundle gate, 817 KB +2 on both gated routes)
- **After every plan wave:** `npm run build` + the `phase15-stubs` lint project once
- **Before `/gsd-verify-work`:** full suite once, then `npm run eval -- --phase 56` against the pushed HEAD; screenshots READ before pass
- **Max feedback latency:** ~60 s (phase56 quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-02-01 | 02 | 2 | SOP-01 | T-56-07 | 18 registry types map per D-02/D-03/A-02; unknown type or empty hazard/PPE text = failure | unit (pure, static imports) | `npx playwright test --project=phase56 tests/phase56/convert.spec.ts -g kinds` | ❌ W0 | ⬜ pending |
| 56-02-01, 56-02-02 | 02 | 2 | SOP-01 | T-56-07 | hazard ≥ (HazardCards + Warning/Caution), ppe ≥ PPE cards, every PPE item present, per SOP; failing SOP writes nothing | unit + live read-only dry run | `npx playwright test --project=phase56 tests/phase56/convert.spec.ts -g gate`; `npx tsx scripts/convert-sops-to-steps.ts --all --report …/56-CONVERSION-DRYRUN.md` | ❌ W0 | ⬜ pending |
| 56-02-01, 56-07-01 | 02, 07 | 2, 4 | SOP-01 | T-56-07g | Re-run on unchanged SOP = no-op (hash); after a layout edit only generated rows change; originals untouched; step-level standard attachment survives | unit (plan diff) + live | `… convert.spec.ts -g plan`; `PHASE56_LIVE=1 npx playwright test --project=phase56 tests/phase56/convert-apply.spec.ts` | ❌ W0 | ⬜ pending |
| 56-07-02 | 07 | 4 | SOP-01 | T-56-07e | Production apply: every passing SOP converted; sop_steps count and layout_data unchanged; re-run 0 converted | live runner + report | `npx tsx scripts/convert-sops-to-steps.ts --apply --all --report …/56-CONVERSION-APPLY.md` | ❌ W0 | ⬜ pending |
| 56-10-01 | 10 | 6 | SOP-01 | — | Old SOP page + builder render the converted fixture's original content | deployed eval | `npm run eval -- --phase 56` (`sop-ledger.eval.ts` A, B) | ❌ W0 | ⬜ pending |
| 56-04-02, 56-06-01 | 04, 06 | 3, 4 | SOP-02 | T-56-04, T-56-20 | Add/rename/remove; remove detaches everywhere (cascade); admin-only writes; cross-org attach refused | live DB spec + source contract | `PHASE56_LIVE=1 … tests/phase56/schema-runtime.spec.ts`; `… tests/phase56/standards-actions.spec.ts` | ❌ W0 | ⬜ pending |
| 56-03-01 | 03 | 2 | SOP-02 | T-56-04 | New tables pass org-scope RLS lint (USING + matching WITH CHECK) | lint | `npx playwright test --project=phase15-stubs rls-org-scope` | ✅ | ⬜ pending |
| 56-06-02, 56-09-02, 56-10-01 | 06, 09, 10 | 4, 5, 6 | SOP-02 | T-56-22 | Panel reachable from Tools; label visible to worker (SOP + section level, Read + walk); bundle gate holds | source contract + build + eval | `npx playwright test --project=phase56`; `npm run build`; eval C | ❌ W0 | ⬜ pending |
| 56-04-02 | 04 | 3 | SOP-03 | T-56-11 | `placement` flips with `sop_machines` insert/delete under an admin session and after FK cascade; SOP delete with links succeeds | live DB spec | `PHASE56_LIVE=1 … tests/phase56/schema-runtime.spec.ts -g placement` | ❌ W0 | ⬜ pending |
| 56-09-01, 56-09-03, 56-10-01 | 09, 10 | 5, 6 | SOP-03 | T-56-26 | Shown department = machine departments; site SOP shows Whole site; access RLS untouched | unit + eval screenshot | `… tests/phase56/placement.spec.ts`; eval D | ❌ W0 | ⬜ pending |
| 56-01-01, 56-08-02 | 01, 08 | 1, 5 | DEC-01 | T-56-16 | Every write to the 7 decision tables (+ owner / publish / verify columns, cadence, AI proposals) is a listed hook or a reasoned allow entry (data-keyed sweep) | source sweep | `… tests/phase56/decision-writers-sweep.spec.ts` | ❌ W0 | ⬜ pending |
| 56-05-02, 56-08-01, 56-08-02 | 05, 08 | 4, 5 | DEC-01 | T-56-12 | Each hooked writer awaits `recordDecision(` AFTER its primary write; gate body hash unchanged | source contract | `… decision-writers-sweep.spec.ts`; `… publish-gate-pin.spec.ts` | ❌ W0 | ⬜ pending |
| 56-10-01 | 10 | 6 | DEC-01 | — | Real actions write a ledger row (owner change via inbox; completion reject; AI write) | deployed eval | eval E | ❌ W0 | ⬜ pending |
| 56-03-02, 56-04-01, 56-10-01 | 03, 04, 10 | 2, 3, 6 | DEC-01 | T-56-17 | Backfill: per-source counts equal across 7 tables; ledger non-empty on deploy | migration assertion + applier + eval | `node scripts/apply-phase56-migration.mjs`; eval F | ❌ W0 | ⬜ pending |
| 56-04-01, 56-04-02, 56-10-01 | 04, 10 | 3, 6 | DEC-03 | T-56-01 | UPDATE / DELETE on an EXISTING row refused as owner and service role (row unchanged); TRUNCATE refused; triggers `tgenabled='A'`; no UPDATE/DELETE/TRUNCATE grant to app roles; no authenticated INSERT | live probe + live spec + eval | `node scripts/probe-decisions-immutable.mjs`; schema-runtime ledger test; eval F | ❌ W0 | ⬜ pending |
| 56-05-01, 56-04-02, 56-08-02, 56-10-01 | 05, 04, 08, 10 | 4, 3, 5, 6 | DEC-04 | T-56-03 | Unnamed agent refused by type, by `buildDecisionRow` and by DB CHECK; named agent row stored; `applyAiWrite` produces one | unit + live + eval | `… tests/phase56/decision-shape.spec.ts`; schema-runtime ledger test; eval E/F | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `phase56` project (56-01)
- [ ] `tests/phase56/decision-writers-sweep.spec.ts` + `scripts/decision-writers.json`, `tests/phase56/publish-gate-pin.spec.ts` (56-01)
- [ ] `tests/evals/sop-ledger.eval.ts` skeleton + convert fixture SOP in `scripts/eval-fixtures.mjs` (56-01)
- [ ] `scripts/convert-sops-to-steps.ts --all` dry run against production (read-only) BEFORE any write path exists (56-02)
- [ ] Specs created by their owning plans: convert (02), schema-shape (03), schema-runtime (04), decision-shape (05), standards-actions (06), convert-apply (07), placement (09)
- [ ] Probes confirming research assumptions A2 (placement trigger as invoker, incl. FK cascade) — 56-04 schema-runtime; A3 (`ReviewerFlag.block_id` = junction id) — confirmed in planning from `useReviewerFlags`/`ReviewStation` keying by junction id

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dry-run conversion report read before `--apply` | SOP-01 | A count report is a judgment artefact; the gate is mechanical but the first production apply is a one-way write | 56-02 pastes the per-SOP before/after table into its SUMMARY; 56-07 Task 2 step 1 checks every failing SOP against the Needs-Simon list before applying |
| Deployed screenshots of old SOP page + builder on a converted SOP, standards labels, placement line | SOP-01, SOP-02, SOP-03 | CSS/token bugs invisible to assertions (CLAUDE.md 2026-07-14) | 56-10 Task 2 reads `.planning/evals/latest/*.png` before declaring pass |
