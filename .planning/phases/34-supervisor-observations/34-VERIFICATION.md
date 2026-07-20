---
phase: 34-supervisor-observations
verified: 2026-07-20T09:15:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Observations are strictly org-scoped AND worker-private — a plain worker can only ever read their own observation rows (OBS-02 self-read-only invariant, CR-01)"
    - "The shared record modal's SOP picker is required/assigned-first for the primary recorder persona (D-06, 34-05 must-have, CR-02)"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification: []
---

# Phase 34: Supervisor Observations Verification Report

**Phase Goal:** Supervisors can record a 30-second, append-only observation of a worker against a specific SOP, and workers can see every observation recorded about them — the tamper-evident evidence layer that directly answers Visy's #1 named pain point (fraudulent/shared sign-offs), independent of everything else in the milestone.
**Verified:** 2026-07-20T09:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (34-10-PLAN.md, commits `a4ff048`, `835ba9b`, `24edd75`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supervisor can record an observation (verdict + optional note) of a worker against a SOP in a few taps from the worker's profile or /activity (SC-1) | VERIFIED (regression-checked) | `recordObservation()` unchanged by 34-10; still role-gated, session-client insert, server-resolved sop_version. Both entry points (PersonPanel, SupervisorActivityView) unaffected. |
| 2 | Observation records are append-only — no edit or delete path exists (SC-2) | VERIFIED (regression-checked) | Migrations 00052/00053 untouched by 00054 (00054 only replaces the SELECT policy). Re-ran `observation-immutability.spec.ts` live against production DB — both UPDATE and DELETE attempts still denied with zero rows affected. |
| 3 | Worker can see every observation recorded about them on their own profile, and **only** their own (SC-3 + OBS-02 privacy invariant) | VERIFIED | `ObservationsSection.tsx` / `listObservationsForWorker()` unchanged (self-scoped by session `userId`). The previously-broken data-layer invariant is now closed: migration 00054 (read live, matches plan exactly) role-scopes the `sop_observations_read_org` org-wide branch to `current_user_role() in ('admin','safety_manager','supervisor')`, leaving the `observed_worker_id = auth.uid()` self-read branch untouched. Independently re-ran the new runtime spec against the live production DB (not taken on SUMMARY's word): a real ephemeral-org plain-worker session reading `sop_observations` returns its own row and **does not** return a same-org peer's row (`observation-read-role-scope.spec.ts:144`, passed in 1.1s against live Supabase). |
| 4 | Observations are strictly org-scoped — a runtime cross-org write/read test proves no leakage (SC-4) | VERIFIED (regression-checked) | Re-ran `observation-cross-org-isolation.spec.ts` live — cross-org insert still denied via `sop_observation_refs_in_org`, cross-org read still returns zero rows. No regression from the 00054 policy rewrite. |
| 5 | SOP picker in the shared modal is assigned/required-first for the primary recorder persona (D-06, 34-05 must-have) | VERIFIED | `listWorkerSopsForPicker` in `src/actions/observations.ts` now role-gates to `RECORDER_ROLES`, reads `sop_assignments` via `createAdminClient()` (not the session client) on both queries, each explicitly `.eq('organisation_id', organisationId)`-scoped, with the role-assignment query keyed to `workerMember.role` (the **observed** worker's role) rather than the caller's session `role`. Confirmed by direct code read (matches 34-10-PLAN's `<action>` block verbatim) and by independently running `picker-assigned-first-role-scope.spec.ts` — all 4 wiring assertions pass (role gate present, exactly two `sop_assignments` calls both via `admin`, both org-scoped, role query keyed to `workerMember.role` not `role`). |

**Score:** 5/5 truths verified (both previously-failed truths closed; three previously-passing truths regression-checked with no breakage)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00054_observation_read_role_scope.sql` | Role-scoped `sop_observations_read_org` SELECT policy | VERIFIED | Drops and recreates the policy; org branch gains `current_user_role() in ('admin','safety_manager','supervisor')`, self-read branch (`observed_worker_id = auth.uid()`) unchanged. Confirmed **live on production DB** — not just present as a file — via a real runtime probe run in this verification session (see truth #3), which only passes if the new policy text is actually enforced by Postgres. |
| `scripts/apply-phase34-gap-migration.mjs` | db-push + NOTIFY reload + `pg_policies` assertion, copy-adapted from `apply-phase29-migration.mjs` | VERIFIED | File present, correct Management-API idiom (matches CLAUDE.md 2026-06-15 PostgREST schema-cache learning); its live-push claim is independently corroborated by the runtime probe passing against production. |
| `tests/phase34/observation-read-role-scope.spec.ts` | Live runtime proof: worker self-read positive+negative, supervisor org-wide positive | VERIFIED (ran independently, not trusted from SUMMARY) | Source-contract test + 2 live runtime tests. Re-executed directly: worker-negative (peer row excluded) and supervisor-positive (org-wide read intact) both pass against real ephemeral orgs on the live DB — satisfies the CLAUDE.md 2026-07-20 "every RLS branch needs its own positive AND negative probe per role" learning. |
| `src/actions/observations.ts` | `listWorkerSopsForPicker` role-gated + admin-client org-scoped reads keyed to observed worker's role; `setObservationLabels` Zod-validated | VERIFIED | Full file read. `recordObservation` untouched. `listWorkerSopsForPicker` rewritten exactly per plan. `setObservationLabels` now `safeParse`s `rawInput: unknown` against `ObservationLabelsSchema` before any DB write. |
| `tests/phase34/picker-assigned-first-role-scope.spec.ts` | Source-contract wiring proof (role gate, admin client, org scope, observed-worker-role keying) | VERIFIED (ran independently) | All 4 assertions pass; extracts the real function body (not the whole file) so the assertions target actual wiring, not token presence anywhere in the file — matches the CLAUDE.md 2026-06-05 source-contract learning. |
| `src/lib/validators/observations.ts` | `ObservationLabelsSchema` (WR-01) | VERIFIED | `z.object({ performed_to_sop, needs_support })`, both `.trim().min(1).max(80).optional()`, matches plan. |
| `src/components/admin/observations/ObservationLabelsCard.tsx` | 80-char input caps (WR-01) | VERIFIED | `maxLength={80}` present on both `<input>` elements. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| RLS select policy (00054) | worker-self-read-only invariant | USING clause, org branch role-checked | **WIRED (fixed)** | Independently proven at runtime against production — worker A cannot read worker B's row; supervisor still reads both. |
| RecordObservationModal SOP picker | listWorkerSopsForPicker assigned-first ordering | admin-client, org-scoped, keyed to observed worker | **WIRED (fixed)** | Confirmed by direct code read + independently-run wiring spec. |
| listWorkerSopsForPicker admin-client reads | org self-scoping (CLAUDE.md 2026-06-15 pattern) | `.eq('organisation_id', organisationId)` on both queries | **WIRED — no new cross-tenant hole** | Both `sop_assignments` admin-client reads carry an explicit `.eq('organisation_id', organisationId)` in addition to their id/role filter; `organisationId` is session-derived (never client input), `workerMember.role` is itself resolved from a session-client query already scoped to `.eq('user_id', workerId).eq('organisation_id', organisationId)`. Spot-checked per the CLAUDE.md 2026-06-15 "admin client bypasses RLS — the action must self-enforce org scope" learning; no regression of that class introduced by this fix. |
| RecordObservationModal | recordObservation | server action call | WIRED (unchanged) | Regression-checked, no change from 34-10. |
| PersonPanel / SupervisorActivityView | RecordObservationModal | mount + props | WIRED (unchanged) | Regression-checked. |
| ObservationsSection | listObservationsForWorker | self-scoped server read | WIRED (unchanged) | Regression-checked. |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| OBS-01 | Supervisor can record a 30-second observation (verdict + optional note) against worker+SOP, append-only | SATISFIED | Unchanged from initial verification; regression-checked, no breakage from 34-10. |
| OBS-02 | Worker can see observations recorded about them (trust / NZ Privacy Act framing) | **SATISFIED (gap closed)** | The privacy invariant this requirement exists to deliver is now enforced at the data layer, not just the UI layer — proven at runtime in this verification session. |
| OBS-03 | Observations appear under the worker's profile and feed the derived competency state | SATISFIED (data layer) | Unchanged; "feed the competency state" correctly deferred to Phase 35 per ROADMAP. |

No orphaned requirements — REQUIREMENTS.md maps only OBS-01/02/03 to Phase 34 (lines 635-637, 682-684), all three appear in plan frontmatter across 34-01 through 34-10.

### Anti-Patterns Found

CR-01 and CR-02 (both BLOCKER-class for goal achievement) are closed by this plan. Remaining items from `34-REVIEW.md` are WARNING/INFO severity, out of this gap-closure plan's scope, and do not block the phase's stated success criteria (OBS-01/02/03, SC-1..4, D-06). Carried forward for awareness, not as re-verification gaps:

| File | Line | Pattern | Severity | Status |
|------|------|---------|----------|--------|
| `supabase/migrations/00052...sql` | 34-40 | RLS SELECT org branch missing role check | ~~BLOCKER~~ | **CLOSED by migration 00054** |
| `src/actions/observations.ts` | 229-243 (orig) | Session-client sop_assignments read filtered to caller's own assignments | ~~BLOCKER~~ | **CLOSED — admin-client, org-scoped, observed-worker-keyed** |
| `src/actions/observations.ts` | 90-105 (orig) | `setObservationLabels` no Zod validation | ~~WARNING (WR-01)~~ | **CLOSED — ObservationLabelsSchema + 80-char UI caps** |
| `src/actions/observations.ts` | ~52-61 | `completionId` not validated against org/worker/SOP match (WR-02) | WARNING | Open — not in 34-10 scope |
| `supabase/migrations/00053...sql` | 20-30 | `sop_observation_refs_in_org` PostgREST-exposed cross-org membership/SOP-existence oracle (WR-03) | WARNING | Open — not in 34-10 scope |
| `RecordObservationModal.tsx` | 36-153 | Preset SOP can desync from picker list while `canSave` stays true (WR-04) | WARNING | Open — not in 34-10 scope |
| `RecordObservationModal.tsx` / `PersonPanel.tsx` / `OrgColumnsBoard.tsx` | various | Unhandled promise rejections leave permanent loading state (WR-05) | WARNING | Open — not in 34-10 scope |
| `OrgChartCanvas.tsx` / `OrgColumnsBoard.tsx` | various | Person chips are `<span onClick>` — no keyboard/AT access (WR-06) | WARNING | Open — not in 34-10 scope |
| `SupervisorActivityView.tsx` | 21-39 | `useWorkerProfiles` fabricates `Worker <uuid-fragment>` display names (WR-07) | WARNING | Open — not in 34-10 scope |

No TBD/FIXME/XXX debt markers found in any 34-10 file (`observation-read-role-scope.spec.ts`, `picker-assigned-first-role-scope.spec.ts`, `apply-phase34-gap-migration.mjs`, `00054...sql`, `observations.ts`, `validators/observations.ts`, `ObservationLabelsCard.tsx`).

The remaining open WARNING items (WR-02 through WR-07) are pre-existing, non-blocking findings that do not affect OBS-01/02/03 satisfaction or the roadmap Success Criteria — they are candidates for a future hygiene pass but are not gates on Phase 34 completion.

### Behavioral Spot-Checks / Probe Execution

Ran the full closure-relevant phase34 spec set directly in this verification session (not taken from SUMMARY.md claims):

| Spec | Command | Result | Status |
|------|---------|--------|--------|
| `observation-read-role-scope.spec.ts` (3 tests: source-contract + worker negative + supervisor positive) | `npx playwright test --project=phase34 tests/phase34/observation-read-role-scope.spec.ts` | 3/3 passed against live production DB | PASS |
| `picker-assigned-first-role-scope.spec.ts` (4 wiring assertions) | `npx playwright test --project=phase34 tests/phase34/picker-assigned-first-role-scope.spec.ts` | 4/4 passed | PASS |
| `observation-cross-org-isolation.spec.ts` (regression) | same run | 4/4 passed, no regression | PASS |
| `observation-immutability.spec.ts` (regression) | same run | 4/4 passed, no regression | PASS |
| `npx playwright test --list --project=phase34` | registration check | Both new spec files discovered (27 total tests across 7 files) — satisfies the CLAUDE.md 2026-05-25 "unregistered spec never runs" learning | PASS |
| `npx tsc --noEmit -p tsconfig.json` (filtered to touched files) | typecheck | Zero errors in `actions/observations.ts`, `validators/observations.ts`, `ObservationLabelsCard.tsx` | PASS |
| `npm run build` | production build | Succeeded, bundle-size gate passed, zero errors | PASS |

All 15 relevant tests passed on a live run in this session (5.0s wall time), confirming migration 00054 is genuinely applied and enforced on the production database — the runtime worker-negative assertion would fail if the old unrestricted policy were still live.

### Human Verification Required

None — all findings are verifiable from source (RLS policy text confirmed live via runtime probe, query construction, component wiring, independently re-run tests). No visual/UX judgment calls block the goal determination.

### Gaps Summary

Both goal-level gaps from the initial verification (2026-07-20T08:00:00Z, `gaps_found`, 3/5) are closed:

1. **CR-01 (was BLOCKER):** Migration 00054 role-scopes the `sop_observations_read_org` org-wide SELECT branch to recorder roles, mirroring the `sop_completions` (00010) precedent. Independently re-proven at runtime in this session (not taken from `34-10-SUMMARY.md`'s claim): a plain worker's session cannot read a same-org peer's observation row; a supervisor's org-wide read is unaffected. The privacy/trust framing OBS-02 exists to deliver is now genuinely enforced at the data layer.

2. **CR-02 (was WARNING affecting the primary persona's core workflow):** `listWorkerSopsForPicker` now role-gates and reads `sop_assignments` via the admin client, explicitly org-scoped on both queries and keyed to the *observed* worker's id/role rather than the caller's — closing the silent RLS-filter-to-empty bug for supervisor callers (the phase's stated primary recorder persona). Confirmed by direct code read matching the plan's `<action>` block exactly, and by an independently-run wiring spec.

No regressions: the three previously-passing truths (SC-1, SC-2, SC-4) were re-run live and remain green after the 00054 policy rewrite. The admin-client fix does not introduce the CLAUDE.md 2026-06-15 cross-tenant-write-hole class — both `sop_assignments` reads self-enforce `organisation_id` scoping, and the role lookup that seeds `workerMember.role` is itself correctly scoped to the observed worker within the caller's org.

WR-01 (label input validation) was folded in and is also closed. WR-02 through WR-07 remain open as pre-existing WARNING/INFO findings outside this plan's declared scope — they do not block phase goal achievement (OBS-01/02/03, SC-1..4, D-06 are all satisfied) but are flagged here for a future hygiene pass, particularly WR-02 (completion-link integrity) given Phase 35 will build its competency classifier on top of this table.

**Phase 34 goal achieved.** Ready to proceed to Phase 35.

---

_Verified: 2026-07-20T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
