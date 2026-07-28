# Phase 37: Assessor Governance - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Recording a competence-advancing record (a `performed_to_sop` observation or a completion sign-off) requires the recorder to be themselves signed off on that SOP — assessorship is **derived from the existing sign-off data**, not a new designation system. Admin/safety_manager get an always-available, audited override (reason mandatory, append-only trail) so a brand-new organisation with zero assessors is never deadlocked. Blocked supervisors get a request path, not a dead end. Requirement: ASR-01.

**Locked north star (unchanged):** this phase gates *recorders* (supervisors/admins), never workers — worker read/walkthrough access remains ungated (CMP-04 guard class stays green).

</domain>

<decisions>
## Implementation Decisions

### Assessor model (the gate predicate)
- **D-01: Derived assessorship — no designation table.** A person may assess others on SOP X iff they are themselves `competent_signed_off` on SOP X (per the Phase 35 classifier over the same evidence tables). No admin "assessor flag" surface, no new entity — the sign-off data IS the assessor registry, and it self-maintains.
- **D-02: Org-wide, no department fencing.** A person signed off on SOP X can assess anyone in the org on SOP X regardless of department. Per-SOP granularity comes for free from D-01; no per-department or per-SOP grant administration.

### Gate coverage
- **D-03: Gate BOTH competence-advancing record types:** `performed_to_sop` observations (`recordObservation` in `src/actions/observations.ts`) AND completion sign-offs (`signOffCompletion` in `src/actions/completions.ts`). Leaving sign-offs ungated would let a non-assessor bypass the gate via the stronger record — the ladder's top rung must be guarded too.
- **D-04: `needs_support` coaching observations stay open** to all current recorder roles (supervisor/admin/safety_manager) with no assessor check — coaching-not-discipline framing (Phase 34 D-01) is preserved.

### Override (bootstrap + continuity)
- **D-05: Always available, always audited.** Admin and safety_manager can record an advancing observation or sign-off even when not signed off on that SOP themselves — every such use is stamped as an override on the record, requires a short free-text **reason (mandatory)**, and writes an append-only audit row. One mechanism covers both the new-org bootstrap AND the "sole assessor left the company" case; it never re-deadlocks.
- **D-06: Override roles = admin + safety_manager** (peers on every other governance surface). Plain supervisors never get the override.
- **D-07: Audit trail is append-only** — copy the proven `sop_review_events` pattern (migration 00043): org-scoped read, role-checked insert, NO update/delete policies. Every override use must be reconstructible: who, when, which worker, which SOP, which record, reason.

### Blocked-recorder UX
- **D-08: Request path.** A supervisor who isn't signed off on the SOP sees the advancing verdict / sign-off control disabled with plain-language copy ("You need to be signed off on this SOP yourself before you can assess others on it") PLUS a "request assessment" action that notifies an existing assessor/admin to come assess *the supervisor* on that SOP. Keep the plumbing minimal — reuse the existing `worker_notifications` table (Phase 3) or an equivalent lightweight request row; no new notification infrastructure.
- **D-09: `needs_support` stays fully enabled** in the same modal — only the advancing controls are gated.

### Claude's Discretion
- Whether the gate predicate calls the full Phase 35 classifier or a leaner "has sign-off on this SOP (lineage-widened)" check — but semantics must match the classifier: a `needs_support` reset (35 D-02) that drops an assessor's own state below `competent_signed_off` also suspends their assess capability, and version lineage must not orphan assessorship after a supersede (Phase 36 `resolveLineage` in `src/lib/competency/lineage.ts` is the tool).
- Where the override audit rows live (dedicated table vs stamped columns + event row) — as long as D-07's append-only reconstruction holds.
- Exact request-path notification mechanism and copy; batching/dedupe of repeat requests.
- Whether server-side enforcement is action-layer only or also RLS-hardened (note: `sop_observations` INSERT policy currently role-checks; extending it to check sign-off state cross-table needs a SECURITY DEFINER helper per the 00053 precedent — planner/researcher decide cost/benefit).
- UI placement of override affordance for admins (inline in the recording modal vs separate confirm step) — must show the reason field and make the audit consequence visible on-face (Phase 34's "permanent record" honesty pattern).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & rationale
- `.planning/REQUIREMENTS.md` §v7.0 — ASR-01 exact wording (line ~641).
- `.planning/ROADMAP.md` §Phase 37 — goal + 2 success criteria.
- `.planning/todos/completed/2026-07-19-phase-seed-competency-layer.md` — the competency-layer seed; its "Assessor capability" bullet ("who may assess/sign off is itself governed — trainer must have been signed off themselves") is this phase's rationale. (Moved to completed — its `resolves_phase: 35` shipped.)

### Prior phase contracts (the surfaces this phase gates)
- `.planning/phases/34-supervisor-observations/34-CONTEXT.md` — canonical verdicts `performed_to_sop`/`needs_support` (D-01/D-02 there), recorder roles D-04 ("Phase 37 narrows this"), append-only D-12.
- `.planning/phases/35-competency-classifier-training-matrix-records/35-CONTEXT.md` — classifier ladder D-01, `needs_support` reset D-02, CMP-04 never-gates guard.
- `src/actions/observations.ts` — `recordObservation` (the observation write path to gate), `RECORDER_ROLES`, org label config.
- `src/actions/completions.ts` — `signOffCompletion` (the sign-off write path to gate; note the Phase 23 CR-02 lesson lives here: org-scope every path).
- `src/lib/competency/classify.ts` — `classifyCompetency` ladder semantics the gate must agree with.
- `src/lib/competency/lineage.ts` — `resolveLineage` (Phase 36): assessor's sign-off must survive version supersede.

### Pattern precedents
- `supabase/migrations/00043_ownership_review_governance.sql` — `sop_review_events` append-only audit pattern to copy for the override trail (D-07).
- `supabase/migrations/00052`–`00054` — `sop_observations` schema + RLS incl. the 00053 SECURITY DEFINER cross-table guard precedent.
- `src/lib/auth/session-context.ts` + `src/lib/auth/guards.ts` — all new server entrypoints via `getSessionContext()` / `requireAdminContext()`.
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — blueprint tokens for the recording-modal changes and any request-path UI.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `recordObservation` + the Phase 34 recording modal — the gate lands inside the existing flow; verdict buttons already exist, advancing one gains the disabled/override states.
- `signOffCompletion` (`src/actions/completions.ts:117`) — second gated path; already has role + org checks to extend.
- `resolveLineage` + `classifyCompetency` — the "is this recorder signed off on this SOP" predicate composes from these; no new derivation logic.
- `worker_notifications` table + `useNotifications` hook (Phase 3) — cheapest request-path transport.
- `sop_review_events` migration 00043 — copy-paste-adapt for the override audit table.

### Established Patterns
- Append-only = no UPDATE/DELETE policies; insert checks `auth.uid()` + role.
- Pure predicate logic outside `src/actions/` (2026-06-27 'use server' learning); server actions stay thin.
- Every RLS branch needs positive AND negative runtime probes per role (2026-07-20 learning); admin-client writes self-enforce org scope on every path.
- `journeys.ts` + `src/lib/uat/tests.ts` updated in the same change; UAT items in layman click-paths.
- Worker bundle gate: all of this is admin/supervisor surface — worker `/sops/[sopId]` stays flat.

### Integration Points
- Recording modal (Phase 34) — gate + override + request CTA.
- `/activity` supervisor view sign-off flow — same gate on sign-offs.
- Training matrix / PersonPanel (Phase 35) — no changes required, but override-stamped records could carry a small badge in evidence trails (discretion).

</code_context>

<specifics>
## Specific Ideas

- The override must feel like a deliberate, on-record act — mirror Phase 34's on-face honesty ("🔒 Permanent record…"): show "This will be recorded as an assessor override with your reason, visible in the audit trail" before saving.
- Blocked-supervisor copy teaches the rule rather than hiding it: "You need to be signed off on this SOP yourself before you can assess others on it" + request assessment.

</specifics>

<deferred>
## Deferred Ideas

- Explicit assessor designation flag (admin-granted, on top of derived competence) — rejected this phase; revisit only if a customer asks for narrower control than "any signed-off person".
- Department-fenced assessorship — rejected; org-wide is the model.
- Notification digests / richer request-assessment workflow (queues, SLAs) — keep v1 minimal per D-08.
- Gating `needs_support` coaching notes — explicitly rejected (D-04).

### Reviewed Todos (not folded)
- `2026-07-19-phase-seed-competency-layer.md` — already resolved by Phase 35 (moved to completed in this session); retained as a canonical ref for the assessor rationale only.

</deferred>

---

*Phase: 37-Assessor Governance*
*Context gathered: 2026-07-28*
