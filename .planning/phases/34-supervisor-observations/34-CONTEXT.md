# Phase 34: Supervisor Observations - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Supervisors can record a 30-second, append-only observation (verdict + optional note) of a worker against a specific SOP, and workers can see every observation recorded about them on their own profile. This is the standalone evidence layer for v7.0 — Phase 35's competency classifier and Phase 37's assessor gate build on top of it, but nothing in this phase depends on them. Requirements: OBS-01, OBS-02, OBS-03.

</domain>

<decisions>
## Implementation Decisions

### Verdict scale
- **D-01:** Binary verdict — canonical values `performed_to_sop` / `needs_support`. "Needs support" is framed as a coaching flag, not a disciplinary/fail record.
- **D-02:** Canonical values are fixed platform-wide (Phase 35 classifier and Phase 37 gate hard-code their semantics), but **display labels are renamable per organisation**. A small per-org label config (e.g. two text fields on org settings, or a jsonb column on `organisations`) — the classifier always reads canonical values, never labels.

### Recording entry point (validated via sketch — see canonical refs)
- **D-03:** **Both entry points ship (A + B):**
  - **A — Person panel on /admin/team:** clicking a person in the existing org chart / columns view opens a side panel showing person info, their observation history, and a "Record observation" CTA with the worker pre-filled. This panel is intentionally the future home of Phase 35's per-worker training record — build it as a surface that can grow.
  - **B — /activity supervisor view:** a "Record observation" header button (manual worker+SOP pick) plus a one-tap "I observed this" row action on completions that pre-fills worker + SOP and links the observation to that completion.
- **D-04:** Recorders in this phase: `supervisor`, `admin`, `safety_manager` roles. Phase 37 narrows this to signed-off assessors later — do not build any assessor logic now.
- **D-05:** **Desktop-first** recording flow (Visy: supervisors/admins work desktop-first). Same responsive surface works on mobile but desktop is the design target — no glove-first mobile optimization work this phase.
- **D-06:** Recording is one modal regardless of entry point: worker (usually pre-filled) → SOP picker (worker's required SOPs listed first) → two verdict buttons → optional note → save. The form states on-face that the record is permanent and visible to the worker.

### Worker visibility & privacy (OBS-02)
- **D-07:** Full transparency: worker sees every observation about them — verdict, note, observer name, date, SOP version — in an "Observations about you" section on their own `/profile` page.
- **D-08:** Trust-framing banner ships with it, plain language: these are training-evidence records made by supervisors who watched you work; they're yours to see; nothing is hidden (NZ Privacy Act alignment). Notes are never redacted from the worker — supervisors know the worker will read them, which keeps note tone professional.

### Record shape & linkage
- **D-09:** Observations are **standalone records** (organisation + worker + SOP + verdict + optional note + observer + timestamp). Not required to anchor to a walkthrough completion.
- **D-10:** The **current SOP version is auto-stamped** on every observation at record time (feeds Phase 36's trained-on-outdated-version logic; cheap now, expensive to backfill).
- **D-11:** Optional `completion_id` link — populated only when the entry point provides it for free (the /activity "I observed this" row action). Never a required field.

### Immutability & tenancy (carried forward, locked)
- **D-12:** Append-only via the proven RLS pattern from `sop_review_events` (migration 00043): org-scoped read policy, role-checked insert with `observed_by = auth.uid()`, **no UPDATE policy, no DELETE policy**.
- **D-13:** Strictly org-scoped with a runtime cross-org write/read test (the codebase's recurring service-role write-hole class — success criterion 4 in ROADMAP.md). If any server action uses the admin client, it must self-enforce org ownership on every path.

### Claude's Discretion
- Table/column naming, exact migration shape, whether org verdict labels live on `organisations` or a settings table.
- Person-panel information architecture beyond "info + observation history + record CTA" (keep it lean; it grows in Phase 35).
- Empty states, loading skeletons, and whether the /activity header button and row action share one modal component (they should).
- Offline capture is NOT required this phase (desktop-first decision) — do not build an offline observation queue.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design (validated with Simon 2026-07-19)
- `sketches/supervisor-observations/index.html` — **the approved sketch.** Sections 01 (person panel), 02 (/activity entry), 03 (recording modal), 04 (worker /profile view) were explicitly approved as-sketched; section 05 (matrix) is Phase 35 context only, do not build. Blueprint paper/ink aesthetic per `sketch-findings-SOPstart` skill.
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` + `references/design-tokens.md`, `references/layout-primitives.md`, `references/org-model-views.md` — tokens, pills/frames/buttons, and the org-chart surface the person panel attaches to.

### Product rationale
- `.planning/todos/pending/2026-07-19-phase-seed-competency-layer.md` — the competency-layer seed (tagged resolves_phase 35, but its "Supervisor observation records" section defines this phase's intent: supervisor-initiated legal-evidence layer, complacency reset, feeds the matrix).
- `.planning/research/customer-interviews/` — Visy interview 2026-05-05: fraudulent/shared sign-offs = #1 named pain; desktop-first admin/supervisor usage.

### Pattern precedents
- `supabase/migrations/00043_ownership_review_governance.sql` — `sop_review_events` append-only table: the exact RLS pattern to copy (org read, role-checked insert, NO update/delete policies).
- `src/app/(protected)/admin/team/page.tsx` + `src/components/admin/org-model/TeamViewShell.tsx` — the org-model surface the person panel extends.
- `src/app/(protected)/activity/SupervisorActivityView.tsx` — where entry point B lands.
- `src/app/(protected)/profile/page.tsx` — where the worker's "Observations about you" section lands.
- `src/lib/auth/session-context.ts` + `src/lib/auth/guards.ts` — all new server entrypoints resolve auth via `getSessionContext()` / `requireAdminContext()` (2026-07-13 learning; do not use the old createClient/getUser triplet).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sop_review_events` migration (00043): copy-paste-adapt for the observations table — append-only RLS proven three times.
- `TeamViewShell` org chart (Phase 32): person chips already clickable-adjacent; the panel attaches here.
- `SupervisorActivityView` / `WorkerActivityView` split on /activity: entry point B and the completion-row shortcut slot in here.
- Blueprint UI primitives (pills, frames, verdict-style decision buttons) already exist in the paper/ink system.

### Established Patterns
- Append-only = no UPDATE/DELETE policies, insert checks `auth.uid()` + role — never soft-delete flags.
- Server actions in `src/actions/`; runtime cross-org test required for any admin-client write (Phase 25/33 precedent).
- `journeys.ts` + `src/lib/uat/tests.ts` must be updated in the same change as the new flows (project convention).

### Integration Points
- New table feeds Phase 35 classifier (read-only consumer) — keep the verdict canonical values stable.
- Person panel on /admin/team is the growth point for Phase 35's training record — structure it to accept more sections.
- Optional `completion_id` FK into the existing completions table.

</code_context>

<specifics>
## Specific Ideas

- Simon initially didn't understand what an observation was or why it should exist — the concept was validated via sketch (`sketches/supervisor-observations/index.html`) with rationale panels before locking decisions. **The four-part rationale (supervisor-initiated counter-evidence to shared sign-offs; HSWA due-diligence evidence; the missing middle competency state; complacency reset) is the agreed framing** — worker-facing and admin-facing copy should echo it.
- The recording modal shows "🔒 Permanent record — cannot be edited or deleted after saving. Visible to [worker name]." on-face.
- Worker-facing banner copy direction: "These are records your supervisors made after watching you work — they're part of your training evidence, and they're yours to see. Nothing here is hidden from you."

</specifics>

<deferred>
## Deferred Ideas

- Assessor gating (who may record competence-advancing observations) — Phase 37.
- Competency states / training matrix / training record view — Phase 35 (the person panel built here is its future home, but no derived-state logic ships now).
- Trained-on-outdated-version surfacing — Phase 36 (enabled by D-10's version stamp).
- Offline observation capture queue — explicitly out of scope (desktop-first decision); revisit only if field usage demands it.

### Reviewed Todos (not folded)
- `2026-07-19-phase-seed-competency-layer.md` — tagged `resolves_phase: 35`; kept as a canonical ref for rationale, not folded into Phase 34 scope.

</deferred>

---

*Phase: 34-Supervisor Observations*
*Context gathered: 2026-07-19*
