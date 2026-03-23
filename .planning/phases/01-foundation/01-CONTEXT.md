# Phase 1: Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a multi-tenant SaaS foundation: organisation registration, user auth with role-based access (Worker/Supervisor/Admin/Safety Manager), tenant data isolation via Supabase RLS, and a functional PWA shell installable on iOS and Android. This phase produces NO SOP-related features — just the secure, role-aware, multi-tenant base that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### Org Signup Flow
- **D-01:** Self-service signup — anyone can register their org directly, no approval gate
- **D-02:** Minimal info at registration — company name and admin email only. Get them in fast.
- **D-03:** 14-day free trial with full access, then requires payment
- **D-04:** Per-user/month pricing model (billing implementation itself is a separate concern — Phase 1 needs the org/user model to support it later)

### User Onboarding
- **D-05:** Workers join via admin email invite OR org invite code (both options available)
- **D-06:** Admin email invite: admin enters worker's email → worker gets invite link → sets up account
- **D-07:** Org invite code: org has a shareable code → worker signs up and enters code to join
- **D-08:** Worker first run: brief 3-4 screen quick tour showing how the app works, then lands on assigned SOP list
- **D-09:** Admin first run: overview dashboard with action cards (Upload SOPs, Invite Team, etc.)

### Role Permissions
- **D-10:** Four roles: Worker, Supervisor, Admin, Safety Manager
- **D-11:** Worker — can only see and execute SOPs assigned to them. Cannot browse unassigned SOPs.
- **D-12:** Supervisor — reviews completions and signs off for explicitly assigned workers only (admin assigns workers to supervisors)
- **D-13:** Admin — manages SOPs, users, roles, assignments, and settings. Multiple admins per org allowed.
- **D-14:** Safety Manager — has org-wide visibility of ALL completion records and SOPs across the entire org. Does not need explicit worker assignments.
- **D-15:** Multiple admins per org supported — any admin can manage SOPs, users, and settings

### App Shell & Brand
- **D-16:** Unified "SOP Assistant" brand (working title) — no white-labelling per org in v1
- **D-17:** Dark mode as default, with a light mode toggle available
- **D-18:** Industrial colour palette: yellows, oranges, and metallic grays — high visibility, safety-tool aesthetic
- **D-19:** Bottom tab bar navigation — fixed tabs (SOPs, Activity, Profile), thumb-reachable, glove-friendly
- **D-20:** Product name is a working title — will be decided later. Build with easy name-swap capability.

### Claude's Discretion
- Tab bar icons and exact tab labels
- Exact shade selection within the yellow/orange/metallic gray palette
- Quick tour content and screen count (3-4 screens, Claude designs)
- Dashboard card layout and arrangement for admin first-run
- Specific form validation patterns and error messaging

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, constraints, NZ market context
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-06, PLAT-01 through PLAT-03 are this phase's requirements
- `.planning/ROADMAP.md` — Phase 1 details, success criteria, plan breakdown

### Research
- `.planning/research/STACK.md` — Verified stack: Next.js 16, Supabase (auth + RLS + storage), @serwist/next, Tailwind, Dexie.js
- `.planning/research/ARCHITECTURE.md` — Multi-tenant RLS patterns, JWT custom claims, tenant context middleware
- `.planning/research/PITFALLS.md` — Multi-tenant data leakage prevention, iOS PWA limitations, cross-tenant test requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes all foundational patterns

### Integration Points
- This phase creates the foundation that ALL subsequent phases integrate with:
  - Auth context (JWT with org_id + role) used by every API endpoint
  - RLS policies enforced on every database query
  - PWA shell wraps all subsequent UI
  - Bottom tab bar is the navigation frame for worker and admin experiences

</code_context>

<specifics>
## Specific Ideas

- **NZ market focus** — app is for New Zealand professionals. Consider NZ-specific terminology where relevant (e.g., "organisation" not "organization")
- **Industrial palette** — user specifically wants yellows, oranges, and metallic grays with dark mode default. Think high-vis workwear meets modern app design.
- **Glove-friendly from Phase 1** — the design system established here (72px+ tap targets, bottom-anchored actions) carries through every subsequent phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-23*
