# Phase 28: Ownership + Review Lifecycle + Governance Queue - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning
**Mode:** Autonomous (grey areas resolved by Claude under Simon's locked north star; Simon reviews on completion)

<domain>
## Phase Boundary

Every SOP displays a single accountable owner and a review-due date — both auto-backfilled with zero admin data-entry — and admins get one unified governance queue (due-soon / overdue / unowned / stale-role) with one-click actions. Worker read/walkthrough access is NEVER blocked by ownership or review state.

**NORTH STAR (Simon, locked 2026-07-12):** ease of use and maintenance FIRST; process and blockers never beat ease of use. Governance exists only in service of SOP accuracy + shop-floor usability. Any worker-facing friction is wrong by definition.

**Primary source:** Visy interview pain #1 — "I can't give you one person that's in charge of SOPs… there isn't anybody." Also: stale revisions with no review reminders (example SOP unreviewed since 2021); review-due notifications + grey-out stale SOPs was a direct feature request.

</domain>

<decisions>
## Implementation Decisions

### D28-01 — Owner model: `owner_user_id` column on `sops`
Nullable uuid FK referencing the owning member's user id. NOT a new junction table — one accountable owner per SOP is the Visy ask ("one person in charge"). Backfill migration: `created_by` if that user is still an active org member, else the org's earliest admin/safety_manager. New SOPs default owner = creator at insert.

### D28-02 — Unowned = owner no longer an active org member (computed on read)
No tombstone flags, no background sweep. The governance queue query LEFT JOINs organisation_members and classifies "unowned" when owner_user_id is NULL or the owner is no longer an active member. Self-healing on read — same philosophy as the 2026-07-12 video-render fix (fix visible the moment it's looked at, no cron).

### D28-03 — Review cadence: org-level per-category defaults + per-SOP override
- `review_due_at timestamptz` + `last_reviewed_at` + `last_reviewed_by` columns on `sops`.
- Per-category cadence lives in a small org-scoped settings table (`sop_review_cadences`: organisation_id, category, months) following the `ai_model_settings` pattern (Phase 27) — service-role writes with self-enforced org scoping (2026-06-15 learning), REVOKE-style RLS posture per 00041 precedent.
- **Default cadence: 12 months** (aligned with NZ WorkSafe annual-review practice) when no category cadence is set.
- Backfill: `review_due_at = GREATEST(published_at, updated_at) + cadence`. Many existing SOPs will backfill as ALREADY overdue — that is correct and desirable (it makes the queue immediately honest, cf. Visy's 2021-stale SOP).

### D28-04 — "Confirm current" is ONE click, and it's an audited event
Button on library row / SOP detail / queue row → sets `last_reviewed_at = now()`, `review_due_at = now() + cadence`, `last_reviewed_by = caller`. Append a row to a minimal `sop_review_events` table (sop_id, org_id, reviewed_by, action 'confirmed_current' | 'superseded', created_at) — append-only like completions (legal-defensibility precedent from Phase 4). "Needs changes" routes into the EXISTING edit → version-supersede flow (Phase 23); a supersede also resets review_due_at.

### D28-05 — Governance queue: ONE route, `/admin/governance`
Single page, one list, filter chips (Overdue / Due soon / Unowned / Stale-role / All). Each row: SOP title, category, owner avatar/name, due state, ONE primary action button inline (Confirm current / Assign owner / Fix assignment → opens builder or assign page). Due-soon window: 30 days. No separate consoles, no multi-step wizards. Computed entirely on read — no jobs, no materialized state.

### D28-06 — Stale-role detection = dangling/renamed department + sub-trade references
Phase 25 made departments first-class; assignments also reference roles/sub-trades (Phase 15). Queue query flags SOPs whose sop_departments / assignment rows reference a department or sub-trade tag that no longer exists (or a department renamed since the SOP's last review — detectable via departments.updated_at > sops.last_reviewed_at where joined). Start with dangling references (deterministic); renamed-since-review is the stretch slice of the same query.

### D28-07 — Worker-facing surface: ONE passive line, nothing else
"Current as of <last_reviewed_at | published_at date>" caption on the SOP overview (worker view). NO badges, NO warnings, NO blocking states on worker routes. Overdue grey-out/badge appears ONLY in the admin library. Metric/NZ date format (feedback_nz_metric_only / NZ locale).

### D28-08 — "My SOPs" = owner filter, not a new page
Admin library gains an "Owned by me" filter chip (`/admin/sops?owner=me`) showing review status column; governance queue defaults to org-wide with a "Mine" toggle. No new standalone route beyond `/admin/governance`.

### D28-09 — Dashboard widget on admin home
Counts card (Overdue / Unowned / Due soon) with deep links to `/admin/governance?filter=...`. Place on the admin SOPs landing (`/admin/sops`) header area — that's the admin home in practice.

### D28-10 — No notifications this phase
Email/digest deferred (REQUIREMENTS Future). The queue + dashboard widget IS the surfacing mechanism. Avoids notification-fatigue friction and infra.

### Claude's Discretion
Component naming, exact chip styling (paper/ink design language per sketch-findings-SOPstart), query shapes, and index choices are at the planner/executor's discretion within the decisions above.

</decisions>

<code_context>
## Existing Code Insights

- `sops` table: has `created_by`, `category`/`category_tag`, `published_at`, `updated_at`, `status` — owner/review columns are additive (migration 00043+).
- **Settings-table precedent:** `ai_model_settings` (migration 00042, Phase 27) — org-scoped, service-role writes, org self-enforcement in the action (`src/actions/ai-settings.ts:47-90`), locked RPC posture per 00041. Copy this shape for `sop_review_cadences`.
- **Append-only event precedent:** completions (Phase 4) — no UPDATE/DELETE policies.
- **Departments:** Phase 25 junctions (`sop_departments`, `member_departments`) + `src/actions/*departments*`; admin-client writes with org self-enforcement (2026-06-15 learning).
- **Version supersede:** Phase 23 `src/actions/versioning.ts` + `/admin/sops/[sopId]/versions` — "needs changes" routes here; helper logic must live OUTSIDE 'use server' files if sync (2026-06-27 learning).
- **Admin library:** `/admin/sops/page.tsx` — rows already have actions; add owner display + overdue badge + confirm-current here.
- **JWT org claim:** use shared `parseJwtPayload` from `src/lib/supabase/jwt.ts` — never raw `atob` (2026-06-26 learning).
- **journeys.ts:** new `/admin/governance` route MUST be added to `src/lib/journeys/journeys.ts` in the same commit (project convention; /pathways flags unmapped screens).
- **Playwright:** new specs must be registered in a `playwright.config.ts` project regex or they never run (2026-05-25 learning). Suggested project: `phase28-*`.
- **Final gates:** full `npx tsc --noEmit` + `npm run build` (touches `src/actions/*` ⇒ 2026-06-27 learning applies).

</code_context>

<specifics>
## Specific Ideas

- Queue rows must be actionable without leaving the page: Confirm current (instant, optimistic), Assign owner (inline member picker popover — ≤2 clicks total per OWN-02), stale-role rows deep-link to the assign surface.
- Backfill script pattern: follow `scripts/backfill-section-layouts.ts` precedent (idempotent, only touches rows missing the value, logs per-row outcome; per-step failure must NOT null-clobber — 2026-07-05 learning).
- RLS: new sops columns ride existing sops policies; `sop_review_cadences` readable by org members, writes admin-action-only; `sop_review_events` INSERT-only via server action, SELECT org-scoped.

</specifics>

<deferred>
## Deferred Ideas

- Email/digest notifications for due/overdue (Future Requirements)
- Renamed-role deep diffing beyond dangling refs + renamed-since-review heuristic
- Per-site governance rollups
- Approval-pending queue section (Phase 29 adds it to this queue)

</deferred>
