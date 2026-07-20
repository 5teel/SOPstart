---
phase: 34-supervisor-observations
verified: 2026-07-20T08:00:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Observations are strictly org-scoped AND worker-private — a plain worker can only ever read their own observation rows (OBS-02 self-read-only invariant)"
    status: failed
    reason: "The sop_observations_read_org RLS SELECT policy's org branch (`organisation_id = public.current_organisation_id()`) carries no role check. Any authenticated same-org user — including a plain worker — satisfies this branch and can read every observation row in the org directly via PostgREST (`supabase.from('sop_observations').select('*')`), including peers' needs_support verdicts and supervisors' free-text coaching notes. This contradicts the migration's own inline comment (\"worker self-read, own rows only\"), the closest precedent (sop_completions/00010, which role-scopes every org-wide SELECT branch), and the phase's stated trust/NZ Privacy Act framing (\"they're yours to see\" implies only theirs). The 34-09 phase-gate audit marked OBS-02 PASS citing only that the self-read branch is never a widened `= any(...)` form — it never checked whether the ORG branch leaks to non-recorder roles. Confirmed independently by reading migration 00052 (lines 34-40) and the SC-4 source-contract spec (tests/phase34/observation-cross-org-isolation.spec.ts:55-60), which asserts the self-read branch shape only and has zero coverage of a same-org worker session reading peer rows."
    artifacts:
      - path: "supabase/migrations/00052_supervisor_observations.sql"
        issue: "sop_observations_read_org policy's org branch has no `current_user_role() in ('admin','safety_manager','supervisor')` restriction — every same-org authenticated user can read every row"
    missing:
      - "New migration (00054) restricting the org SELECT branch to recorder roles, mirroring 00010's sop_completions pattern, e.g.: (organisation_id = current_organisation_id() AND current_user_role() in ('admin','safety_manager','supervisor')) OR observed_worker_id = auth.uid()"
      - "A live runtime test (same ephemeral-org pattern as observation-immutability.spec.ts) proving a same-org plain-worker session selecting sop_observations returns only rows where observed_worker_id = self"
  - truth: "The shared record modal's SOP picker is required/assigned-first for the primary recorder persona (D-06, 34-05 must-have)"
    status: failed
    reason: "listWorkerSopsForPicker's two sop_assignments queries run through the session client. RLS policy workers_can_view_own_assignments only exposes individual-assignment rows where user_id = auth.uid() (the CALLER, not the observed worker) and role-assignment rows where role = current_user_role() (the caller's own role, e.g. 'supervisor', never 'worker'). For a supervisor calling on behalf of a worker — the phase's primary recorder persona and both stated entry points (PersonPanel, /activity) — both queries are silently RLS-filtered to empty, so assignedIds is always an empty set. 'Required' tags and assigned-first ordering never appear for supervisor callers; the picker degrades to an unordered SOP list. No error is raised (RLS filtering is silent) so this passed every automated gate."
    artifacts:
      - path: "src/actions/observations.ts"
        issue: "listWorkerSopsForPicker (lines 210-258) queries sop_assignments with the session client; RLS (00007_sop_assignments.sql:24-32) filters both individual and role branches down to rows visible to the CALLER, not the target worker, for any non-admin caller"
    missing:
      - "Either: role-gate the action to recorder roles and read sop_assignments via createAdminClient() with explicit .eq('organisation_id', organisationId) self-scoping on both queries, or add a new SELECT policy letting supervisors read org-wide assignments"
      - "A live test as a supervisor session confirming an individually-assigned SOP for another worker comes back assigned: true"
deferred: []
human_verification: []
---

# Phase 34: Supervisor Observations Verification Report

**Phase Goal:** Supervisors can record a 30-second, append-only observation of a worker against a specific SOP, and workers can see every observation recorded about them — the tamper-evident evidence layer that directly answers Visy's #1 named pain point (fraudulent/shared sign-offs), independent of everything else in the milestone.
**Verified:** 2026-07-20T08:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supervisor can record an observation (verdict + optional note) of a worker against a SOP in a few taps from the worker's profile or /activity (SC-1) | VERIFIED | `recordObservation()` in `src/actions/observations.ts:31-68` — role-gated (supervisor/admin/safety_manager), session-client insert, server-resolved sop_version. Two entry points wired: `PersonPanel.tsx:94/133` ("+ Record observation" → mounts `RecordObservationModal`) and `SupervisorActivityView.tsx:92/193` (header button + "I observed this" row action → same modal). Migration confirmed pushed live (34-03-SUMMARY: `to_regclass`/`pg_policies` verification). |
| 2 | Observation records are append-only — no edit or delete path exists (SC-2) | VERIFIED | Migration 00052 defines only SELECT and INSERT policies, with explicit `-- NO UPDATE policy` / `-- NO DELETE policy` comments; grep of non-comment lines confirms zero `for update`/`for delete` policies. `tests/phase34/observation-immutability.spec.ts` runs real authenticated UPDATE/DELETE attempts against a live ephemeral-org row and confirms both denied with zero rows affected (proven at runtime, not just source-contract). No edit/delete UI affordance exists in `ObservationRow.tsx` or `ObservationsSection.tsx`. |
| 3 | Worker can see every observation recorded about them on their own profile (SC-3) | VERIFIED (display) / FAILED (isolation, see gap) | `ObservationsSection.tsx` renders on `/profile`, calls `listObservationsForWorker()` (self-scoped by session `userId`), shows verdict/note/observer/date/SOP version, plain-language NZ Privacy Act trust banner present, no edit/delete/hide control. Display mechanism is real. However the underlying RLS policy also lets the worker (and any org member) read **other workers'** observations — see gap #1. The "yours to see, yours only" trust framing that OBS-02 exists to deliver is not actually enforced at the data layer. |
| 4 | Observations are strictly org-scoped — a runtime cross-org write/read test proves no leakage (SC-4) | VERIFIED (cross-org) / FAILED (same-org role isolation, see gap) | `tests/phase34/observation-cross-org-isolation.spec.ts` runtime block: real ephemeral org-B supervisor insert naming org-A sop/worker refs is denied via the migration-00053 `sop_observation_refs_in_org()` SECURITY DEFINER guard; org-B session reading returns zero org-A rows. Both confirmed passing. This closes the *cross-org* leak, but the *same-org* leak (any org member reads any org member's observations via the unrestricted org SELECT branch) is untested and unfixed — see gap #1. |
| 5 | SOP picker in the shared modal is assigned/required-first for the primary recorder persona (D-06, 34-05 must-have) | FAILED | `listWorkerSopsForPicker` silently returns an empty `assignedIds` set for supervisor callers due to RLS filtering both `sop_assignments` queries down to the caller's own assignments, not the observed worker's. See gap #2. |

**Score:** 3/5 truths fully verified (2 partially verified with a data-layer gap each)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00052_supervisor_observations.sql` | sop_observations table + RLS + observation_labels column | VERIFIED (exists/substantive) / GAP (role isolation) | Table, indexes, INSERT policy correct; SELECT policy org branch unrestricted by role (gap #1) |
| `supabase/migrations/00053_sop_observations_cross_org_guard.sql` | Cross-org FK-ownership guard | VERIFIED | `sop_observation_refs_in_org()` SECURITY DEFINER wired into INSERT WITH CHECK; proven live |
| `src/lib/validators/observations.ts` | RecordObservationSchema + VerdictSchema | VERIFIED | Exports confirmed, matches DB check constraint |
| `src/actions/observations.ts` | recordObservation / listObservationsFor* / labels / picker | VERIFIED (wired) / GAP (picker RLS) | recordObservation correct; listWorkerSopsForPicker silently broken for supervisors (gap #2) |
| `src/components/observations/RecordObservationModal.tsx` | Shared modal, all entry points | VERIFIED (wired) | Mounted from PersonPanel and SupervisorActivityView |
| `src/components/observations/VerdictButtons.tsx` | Binary verdict picker | VERIFIED | Renders org-renamable labels |
| `src/components/observations/ObservationRow.tsx` | Single observation row | VERIFIED | Shared by person panel + profile |
| `src/components/profile/ObservationsSection.tsx` | Worker's own observation history + trust banner | VERIFIED | Confirmed rendered on `/profile`, self-scoped read, no edit control |
| `src/components/admin/org-model/PersonPanel.tsx` | Entry point A | VERIFIED (wired) | Opens modal, shows observation history |
| journeys.ts / uat/tests.ts | Flow documentation | VERIFIED | `record-observation` and `worker-sees-observations` journeys present; `p34-record-observation` / `p34-worker-sees-observations` UAT entries present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| RecordObservationModal | recordObservation | server action call | WIRED | Confirmed |
| PersonPanel / SupervisorActivityView | RecordObservationModal | mount + props | WIRED | Confirmed both entry points |
| ObservationsSection | listObservationsForWorker | self-scoped server read | WIRED | Confirmed |
| RLS insert policy | current_organisation_id() + current_user_role() + auth.uid() + FK ownership guard | WITH CHECK | WIRED | Confirmed via 00052 + 00053 |
| RLS select policy | worker-self-read-only invariant | USING clause | **NOT WIRED (broken invariant)** | Org branch has no role restriction — see gap #1 |
| RecordObservationModal SOP picker | listWorkerSopsForPicker assigned-first ordering | sop_assignments RLS | **NOT WIRED for supervisors** | See gap #2 |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| OBS-01 | Supervisor can record a 30-second observation (verdict + optional note) against worker+SOP, append-only | SATISFIED | recordObservation + append-only RLS + two entry points, all confirmed |
| OBS-02 | Worker can see observations recorded about them (trust/NZ Privacy Act framing) | **BLOCKED (partial)** | The worker-facing display is real and correct, but the "yours to see" privacy invariant this requirement exists to deliver is contradicted by the unrestricted org SELECT branch — any org member can read any other org member's observations, not just their own. This is the exact class of gap the requirement's framing (trust, privacy) was written to prevent. |
| OBS-03 | Observations appear under the worker's profile and feed the derived competency state | SATISFIED (data layer) | Observations render on /profile and PersonPanel; "feed the competency state" is explicitly Phase 35 scope per ROADMAP — data layer exists and is queryable, correctly deferred |

No orphaned requirements — REQUIREMENTS.md maps only OBS-01/02/03 to Phase 34, all three appear in plan frontmatter.

### Anti-Patterns Found

Carried forward from `34-REVIEW.md` (code review completed same day, all findings independently spot-checked here):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/00052_supervisor_observations.sql` | 34-40 | RLS SELECT org branch missing role check | BLOCKER | Same-org privacy leak (gap #1) |
| `src/actions/observations.ts` | 229-243 | Session-client sop_assignments read filtered by RLS to caller's own assignments | BLOCKER | Dead assigned-first ordering for supervisors (gap #2) |
| `src/actions/observations.ts` | 90-105 | `setObservationLabels` has no Zod validation on write path | WARNING | Malformed label data can crash worker-facing renders org-wide (WR-01) |
| `src/actions/observations.ts` | 52-61 | `completionId` not validated against org/worker/SOP match | WARNING | Corrupted append-only evidence link possible (WR-02) |
| `supabase/migrations/00053...sql` | 20-30 | `sop_observation_refs_in_org` SECURITY DEFINER exposed via PostgREST to any authenticated user cross-org | WARNING | Membership/SOP-existence oracle (WR-03) |
| `src/components/observations/RecordObservationModal.tsx` | 36-153 | Preset SOP can silently desync from picker list while canSave stays true | WARNING | Observation can be saved against a SOP not visibly selected (WR-04) |
| `RecordObservationModal.tsx` / `PersonPanel.tsx` / `OrgColumnsBoard.tsx` | various | Unhandled promise rejections leave permanent loading state | WARNING | (WR-05) |
| `OrgChartCanvas.tsx` / `OrgColumnsBoard.tsx` | 237-249 / 109-121 | Person chips are `<span onClick>` — no keyboard/AT access | WARNING | New interactive affordance unreachable without a mouse (WR-06, confirmed by direct grep) |
| `SupervisorActivityView.tsx` | 21-39 | `useWorkerProfiles` fetches only `user_id`, fabricates `Worker <uuid-fragment>` display names | WARNING | Supervisor cannot distinguish workers by name when recording (WR-07) |

No TBD/FIXME/XXX debt markers found in phase-34 files.

### Human Verification Required

None — all findings above are verifiable from source (RLS policy text, query construction, component wiring). No visual/UX judgment calls block the goal determination.

### Gaps Summary

Phase 34 delivers a real, working recording flow (write path, append-only enforcement, two entry points, worker-facing read UI, cross-org isolation) — the bulk of the phase goal is genuinely built and the 34-09 phase-gate audit's core claims (append-only proven at runtime, cross-org isolation proven at runtime) hold up under independent re-verification.

However, two Critical code-review findings are goal-level gaps, not just polish items:

1. **CR-01 (BLOCKER):** The SELECT RLS policy's org branch has no role restriction, so any same-org authenticated user — including a plain worker — can read every observation in the org via direct PostgREST calls, bypassing the server actions entirely. This directly contradicts the phase's own privacy/trust framing ("these are yours to see... nothing here is hidden from you" implicitly means *only* yours) and the migration's own inline comment. The 34-09 SUMMARY's OBS-02 "PASS" audit checked only that the self-read branch wasn't widened — it never checked that the org branch was unrestricted, which is the actual defect. A goal built around "tamper-evident, trustworthy evidence layer" cannot claim that goal while any worker can read every peer's coaching notes and support flags.

2. **CR-02 (WARNING, but affects the primary persona's core workflow):** The SOP picker's assigned-first ordering — an explicit 34-05 must-have — silently no-ops for supervisor callers (the phase's stated primary recorder persona) due to an RLS-filtered read on `sop_assignments`. Recording still works (supervisors can search/select any published SOP), so this does not block OBS-01 outright, but it is a real, silent failure of a stated must-have for the primary user.

Both are structural (RLS/query design), not cosmetic, and both were confirmed independently by reading the migration SQL and the query code directly — not taken on the review's word alone.

**This looks like it needs a fix, not an override.** Recommend routing back through `/gsd-plan-phase --gaps` for a small closure plan (new migration + role-scoped picker query) before Phase 35 builds its competency classifier on top of this table.

---

_Verified: 2026-07-20T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
