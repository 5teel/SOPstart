# Phase 46: Capability Matrix - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Source:** Express path — decisions locked in the 2026-08-04 Joe + Simon working session and the v9.0 D1–D5 decision sequence (settled 2026-08-25). See `.planning/v9.0-DEV-PLAN.md` and ROADMAP.md § v9.0.

<domain>
## Phase Boundary

Two deliverables, nothing else:

1. **CAP-01** — One written role × capability matrix, in-repo, covering every role × every capability surfaced in the app, referenced from CLAUDE.md/planning docs as the single authority on who can see and do what.
2. **CAP-02** — "Sign-off authority carries edit rights" enforced in code, server-side: a user with sign-off authority on a SOP can edit that SOP; one without cannot. Proven with positive AND negative probes per role (2026-07-20 learning: one probe per policy is not coverage — enumerate role × own/other × allowed/denied for the roles that matter).

**No route work, no new UI surfaces** — this phase runs in parallel with v8.0 Phase 41 (surface merge) precisely because it touches no routes. A capability matrix document plus server-side enforcement and tests.
</domain>

<decisions>
## Implementation Decisions

### From the Joe + Simon session (locked)
- Users with sign-off authority on a SOP also have edit permissions on that SOP — this is the CAP-02 rule, verbatim from the meeting
- Keep the application as simple as possible — no new permission machinery beyond what the rule requires; prefer extending existing guards over new frameworks
- Separate SOPs for operators vs engineers; SOPs assigned at team level with role-based visibility (context for the matrix's rows, shipping in 44a/44b — do NOT build role-ladder logic in this phase)

### From the v9.0 decision sequence (locked)
- Obligation ≠ access (D1): the matrix document must distinguish the *visibility* channel from the *obligation* channel per capability — do not describe them as one thing
- Edit history read-only to everyone with SOP access (D5) and feedback moderation rules (D4) are settled — the matrix documents them as planned capabilities (Phases 47/48) marked as such, distinct from shipped ones

### Claude's Discretion
- Where the matrix document lives and its exact format (a markdown table in-repo; location + granularity are the planner's call — it must be referenced from CLAUDE.md or .planning docs as the authority)
- What "sign-off authority" concretely maps to in the current schema (approval chains from Phase 29, `sops` ownership from Phase 28, supervisor/safety_manager roles) — RESEARCH must pin this before the enforcement point is chosen
- Where the CAP-02 guard lives (server action guard vs RLS policy vs both) — follow the codebase's established pattern: server actions self-enforce org-scope; service-role writes re-check; RLS is the backstop
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and decisions
- `.planning/v9.0-DEV-PLAN.md` — the milestone dev plan; locked decisions incl. CAP-02's origin
- `.planning/ROADMAP.md` § Phase 46 — goal + success criteria

### Existing permission machinery (do not duplicate — extend)
- `src/lib/auth/guards.ts` — shared `requireAdminContext()`; every server entrypoint resolves auth via `getSessionContext()` (2026-07-13 consistency sweep)
- `src/lib/auth/session-context.ts` — per-request cached session context
- `src/actions/versioning.ts`, `src/actions/completions.ts` — sign-off related actions (Phase 23 `signOffCompletion` org-scope lesson, 2026-06-26)
- `supabase/migrations/00046_org_model_schema.sql` — `roles` table (dept-scoped, `sort` is display order)
- Phase 28 (ownership: `sops` owner fields, `default_sop_owner` trigger), Phase 29 (`approval_chains`, `sop_approvals`) — the candidates for what "sign-off authority" means in schema terms

### Security learnings that bind this phase (CLAUDE.md § Learnings)
- 2026-07-20 — every RLS/guard branch needs positive AND negative runtime probes per role
- 2026-08-04 — permissive RLS policies OR-combine; a `WITH CHECK` replaces (not adds to) `USING`
- 2026-06-15 / 2026-06-26 / 2026-07-28 — service-role writes must self-enforce org-scope; never trust a fetched row's `organisation_id` derived from a client-supplied id
</canonical_refs>

<specifics>
## Specific Ideas

- The matrix rows are roles (worker, supervisor, sop admin/admin, safety_manager, platform_admin — plus the v9.0-planned dept-scoped roles noted as incoming); columns are the app's real capabilities (read SOP, walk SOP, self-add, edit SOP blocks, publish, verify blocks, sign off completions, approve chain steps, manage team, manage departments, manage blocks library, view governance queue, export records, etc.)
- Matrix cells distinguish: shipped-and-enforced / shipped-but-unenforced (gap!) / planned (phase ref). Any shipped-but-unenforced cell found while writing the matrix is a finding to surface, not silently fix beyond CAP-02's scope
- CAP-02 test shape: Playwright spec with live-Supabase probes where feasible, else source-contract assertions pinning the guard where it lives PLUS that callers call it (2026-07-13 relocation learning); mutation-proof the guard per the project's standing practice
</specifics>

<deferred>
## Deferred Ideas

- Role-ladder visibility (Phase 44b), obligation record (44a), view-as (45), edit log (47), feedback (48) — the matrix documents them as planned; no implementation here
- Any UI for viewing the matrix in-app — the deliverable is a document + enforcement, not a screen
</deferred>

---
*Phase: 46-capability-matrix*
*Context gathered: 2026-08-25 via express path (meeting decisions + D1–D5)*
