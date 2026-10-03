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
| **Config file** | `playwright.config.ts` (Wave 0 adds project `phase56`; any new `tests/lint/*.spec.ts` appended to the `phase15-stubs` regex) |
| **Quick run command** | `npx playwright test --project=phase56` |
| **Full suite command** | `npx playwright test` — **once per gate only** (shared Supabase OTP budget; compare non-live failures against `55-BASELINE-FAILURES.md`, never loop) |
| **Deployed eval** | `npm run eval -- --phase 56` |
| **Estimated runtime** | phase56 project ~60 s; full suite ~15 min; eval ~5 min |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase56` + `npx tsc --noEmit`; `npm run build` for any task touching `src/actions/*`, a route, or the `/sops` chunk (postbuild bundle gate, 817 KB +2 on both gated routes)
- **After every plan wave:** `npm run build` + the lint project once
- **Before `/gsd-verify-work`:** full suite once, then `npm run eval -- --phase 56` against the pushed HEAD; screenshots READ before pass
- **Max feedback latency:** ~60 s (phase56 project)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | SOP-01 | — | 18 registry types map per D-02/D-03/A-02; unknown type or empty hazard/PPE text = failure | unit (pure, static imports) | `npx playwright test --project=phase56 convert-kinds` | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-01 | — | hazard ≥ (HazardCards + Warning/Caution), ppe ≥ PPE cards, every PPE item present, per SOP; failing SOP writes nothing | unit + live read-only dry-run | `... convert-gate`; `scripts/convert-sops-to-steps.ts --dry-run` over production | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-01 | — | Re-run on unchanged SOP = no-op (hash); after a layout edit only generated rows change; originals untouched; step-level standard attachment survives | unit (plan diff) + live | `... convert-idempotent` | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-01 | — | Old SOP page + builder render identically on a converted SOP | deployed eval | `npm run eval -- --phase 56` (`sop-ledger.eval.ts`) | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-02 | T-56-xx | Add/rename/remove; rename propagates; remove detaches everywhere; admin-only writes | live DB spec (service key) + eval | `... standards-model`; eval | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-02 | T-56-xx | New tables pass org-scope RLS lint (USING + matching WITH CHECK) | lint | `npx playwright test --project=phase15-stubs rls-org-scope` | ✅ | ⬜ pending |
| TBD | — | — | SOP-02 | — | Label visible to worker (SOP + section level); bundle gate holds | eval + build | eval; `npm run build` | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-03 | — | `placement` flips with `sop_machines` insert/delete incl. FK cascade; never both | live DB spec | `... placement-sync` | ❌ W0 | ⬜ pending |
| TBD | — | — | SOP-03 | — | Shown department = machine departments; site SOP shows none; access RLS untouched | unit + eval screenshot | `... sop-departments`; eval | ❌ W0 | ⬜ pending |
| TBD | — | — | DEC-01 | — | Every write to the 7 decision tables is in a file that calls `recordDecision(` or is allowlisted with a reason (data-keyed sweep) | source sweep | `... decision-writers-sweep` | ❌ W0 | ⬜ pending |
| TBD | — | — | DEC-01 | — | Each hooked writer calls `recordDecision(` AFTER its primary write and awaits it | source contract | `... decision-writer-wiring` | ❌ W0 | ⬜ pending |
| TBD | — | — | DEC-01 | — | A real action produces a ledger row (owner change; sign-off) | deployed eval | eval | ❌ W0 | ⬜ pending |
| TBD | — | — | DEC-01 | — | Backfill: per-source counts equal across 7 tables; ledger non-empty on deploy | migration assertion + eval | `scripts/apply-phase56-migration.mjs` assertions; eval | ❌ W0 | ⬜ pending |
| TBD | — | — | DEC-03 | T-56-xx | UPDATE and DELETE on an EXISTING row refused as service role (row unchanged); TRUNCATE refused; trigger `tgenabled='A'`; no UPDATE/DELETE/TRUNCATE grant to app roles | live probe | `node scripts/probe-decisions-immutable.mjs` + supabase-js service-key attempt inside the eval | ❌ W0 | ⬜ pending |
| TBD | — | — | DEC-04 | — | Unnamed agent rejected by type, by `recordDecision`, and by DB CHECK; named agent row stored; `applyAiWrite` produces one | unit + live | `... decision-agent` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — the planner fills Task IDs when plans exist.*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `phase56` project
- [ ] `tests/phase56/` — convert-kinds, convert-gate, convert-idempotent, standards-model, placement-sync, sop-departments, decision-writers-sweep, decision-writer-wiring, decision-agent
- [ ] `scripts/convert-sops-to-steps.ts --dry-run` against production (read-only) BEFORE any write — the riskiest-change de-risk
- [ ] `scripts/probe-decisions-immutable.mjs`, `scripts/apply-phase56-migration.mjs`
- [ ] `tests/evals/sop-ledger.eval.ts` (+ extend `scripts/eval-fixtures.mjs` with a fixture SOP carrying hazard, PPE, warning/caution and a photo step if none exists)
- [ ] Probes confirming research assumptions A2 (placement trigger as invoker) and A3 (`ReviewerFlag.block_id` = junction id)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dry-run conversion report read before `--apply` | SOP-01 | A count report is a judgment artefact; the gate is mechanical but the first production apply is a one-way write | Executor pastes the per-SOP before/after table into the plan SUMMARY; orchestrator reads it before the apply task |
| Deployed screenshots of old SOP page + builder on a converted SOP | SOP-01 | CSS/token bugs invisible to assertions (CLAUDE.md 2026-07-14) | Read `.planning/evals/latest/*.png` before declaring pass |
