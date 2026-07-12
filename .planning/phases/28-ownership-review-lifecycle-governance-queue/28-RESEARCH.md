# Phase 28: Ownership + Review Lifecycle + Governance Queue - Research

**Researched:** 2026-07-12
**Domain:** Brownfield Postgres/Supabase schema extension + Next.js Server Actions + admin RSC pages, on a mature SafeStart codebase (Phases 1-27 shipped)
**Confidence:** HIGH (all findings are direct codebase reads — migrations, actions, RLS policies, page source — not framework-API research)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D28-01 — Owner model: `owner_user_id` column on `sops`.** Nullable uuid FK referencing the owning member's user id. NOT a new junction table — one accountable owner per SOP is the Visy ask ("one person in charge"). Backfill migration: `created_by` if that user is still an active org member, else the org's earliest admin/safety_manager. New SOPs default owner = creator at insert.
- **D28-02 — Unowned = owner no longer an active org member (computed on read).** No tombstone flags, no background sweep. The governance queue query LEFT JOINs organisation_members and classifies "unowned" when owner_user_id is NULL or the owner is no longer an active member. Self-healing on read.
- **D28-03 — Review cadence: org-level per-category defaults + per-SOP override.** `review_due_at timestamptz` + `last_reviewed_at` + `last_reviewed_by` columns on `sops`. Per-category cadence lives in a small org-scoped settings table (`sop_review_cadences`: organisation_id, category, months) following the `ai_model_settings` pattern (Phase 27) — service-role writes with self-enforced org scoping, REVOKE-style RLS posture per 00041 precedent. Default cadence: 12 months when no category cadence is set. Backfill: `review_due_at = GREATEST(published_at, updated_at) + cadence`. Many existing SOPs will backfill as ALREADY overdue — that is correct and desirable.
- **D28-04 — "Confirm current" is ONE click, and it's an audited event.** Button on library row / SOP detail / queue row sets `last_reviewed_at = now()`, `review_due_at = now() + cadence`, `last_reviewed_by = caller`. Appends a row to a minimal `sop_review_events` table (sop_id, org_id, reviewed_by, action 'confirmed_current' | 'superseded', created_at) — append-only like completions. "Needs changes" routes into the EXISTING edit → version-supersede flow (Phase 23); a supersede also resets review_due_at.
- **D28-05 — Governance queue: ONE route, `/admin/governance`.** Single page, one list, filter chips (Overdue / Due soon / Unowned / Stale-role / All). Each row: SOP title, category, owner avatar/name, due state, ONE primary action button inline. Due-soon window: 30 days. No separate consoles, no multi-step wizards. Computed entirely on read.
- **D28-06 — Stale-role detection = dangling/renamed department + sub-trade references.** Queue query flags SOPs whose sop_departments / assignment rows reference a department or sub-trade tag that no longer exists (or a department renamed since the SOP's last review). Start with dangling references (deterministic); renamed-since-review is the stretch slice. (See RESEARCH Pitfall 3 — sub-trades are NOT currently admin-renamable; scope to departments for the initial slice.)
- **D28-07 — Worker-facing surface: ONE passive line, nothing else.** "Current as of <date>" caption on the SOP overview (worker view). NO badges, NO warnings, NO blocking states on worker routes. Overdue grey-out/badge appears ONLY in the admin library.
- **D28-08 — "My SOPs" = owner filter, not a new page.** Admin library gains an "Owned by me" filter chip; governance queue defaults to org-wide with a "Mine" toggle. No new standalone route beyond `/admin/governance`.
- **D28-09 — Dashboard widget on admin home.** Counts card (Overdue / Unowned / Due soon) with deep links to `/admin/governance?filter=...`. Placed on the admin SOPs landing (`/admin/sops`) header area.
- **D28-10 — No notifications this phase.** Email/digest deferred. The queue + dashboard widget IS the surfacing mechanism.

**NORTH STAR (Simon, locked 2026-07-12):** ease of use and maintenance FIRST; process and blockers never beat ease of use. Governance exists only in service of SOP accuracy + shop-floor usability. Any worker-facing friction is wrong by definition.

### Claude's Discretion

Component naming, exact chip styling (paper/ink design language per sketch-findings-SOPstart), query shapes, and index choices are at the planner/executor's discretion within the decisions above.

### Deferred Ideas (OUT OF SCOPE)

- Email/digest notifications for due/overdue (Future Requirements)
- Renamed-role deep diffing beyond dangling refs + renamed-since-review heuristic
- Per-site governance rollups
- Approval-pending queue section (Phase 29 adds it to this queue)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OWN-01 | Every SOP displays a single accountable owner; existing SOPs auto-backfilled (creator, else org admin) — no manual data-entry campaign | Pattern 1 (additive owner_user_id column); Code Example "Owner backfill on SOP insert" + backfill script skeleton; Runtime State Inventory |
| OWN-02 | Admin can reassign an SOP's owner in ≤2 clicks from the SOP itself | Pattern 1 (rides existing admins_can_update_sops RLS, plain session client); Security Domain (mirror setDepartmentOwner org-membership verification) |
| OWN-03 | SOPs whose owner is deactivated/removed surface as "unowned" in the queue | Pitfall 2 (no soft-delete state exists — removeMember hard-deletes); Code Example classifyGovernanceRow |
| OWN-04 | Owner sees a "My SOPs" view with review status | Architectural Responsibility Map row; Don't Hand-Roll (reuse getOrgMembers/library page WHERE clause, no new route) |
| REV-01 | Review-due date derived from per-category cadence, overridable per SOP, auto-backfilled | Pattern 2 (sop_review_cadences mirrors ai_model_settings); Open Question 2 (category taxonomy); Validation Architecture REV-01 row |
| REV-02 | Overdue SOPs show visible state in admin library; worker access never blocked | Pattern 1; Anti-Patterns "Blocking worker routes"; Validation Architecture REV-02 row (source-contract no-gate assertion) |
| REV-03 | Workers see lightweight "current as of" indicator, informational only | Architectural Responsibility Map; Code Example location (OverviewTab); Validation Architecture REV-03 row |
| REV-04 | One-click "Confirm current" (resets review-due) or routes to edit→supersede flow | Pattern 3 (sop_review_events append-only); Pattern 4 (supersede resets review_due_at); Open Question 1 (publish-hook location) |
| GQ-01 | One unified governance queue: due-soon/overdue/unowned/stale-role | System Architecture Diagram; Recommended Project Structure (/admin/governance) |
| GQ-02 | Every queue row has a one-click primary action inline | Precedent citing the dead-feature-passes-GREEN learning; Validation Architecture GQ-02 row (handler-wired assertion, not just prop-name grep) |
| GQ-03 | Stale-role items when a referenced role/department is renamed or removed | Pitfall 3 (scope to departments only, not sub-trades); Architectural Responsibility Map |
| GQ-04 | Dashboard widget with queue counts + deep links | D28-09 (placed on /admin/sops header); Validation Architecture GQ-04 row |
</phase_requirements>

## Summary

This phase is pure integration work on an already-mature schema; there is no new framework or library to evaluate. The three new pieces of state (`sops.owner_user_id` / `review_due_at` / `last_reviewed_at` / `last_reviewed_by`, a new `sop_review_cadences` settings table, and an append-only `sop_review_events` table) all have a near-identical precedent already live in the codebase: `ai_model_settings` (migration 00042, Phase 27) for org-scoped settings, and `sop_completions` (migration 00010, Phase 4) for append-only audit logs. Critically, **`sops` already has an authenticated `admins_can_update_sops` RLS policy** (migration 00003) scoped to `organisation_id = current_organisation_id() AND current_user_role() IN ('admin','safety_manager')` — so all four new `sops` columns ride this existing policy with zero RLS changes, and writes can go through the plain session client (`createClient()`), NOT the service-role client. This is a simpler risk profile than the departments/ai-settings precedent (which needed service-role + self-enforced org-scoping because those tables have no authenticated write policy at all).

There is no "deactivated" member state in this schema — `removeMember` (`src/actions/auth.ts:409`) does a hard `DELETE FROM organisation_members`. So OWN-03's "owner is deactivated or removed" collapses to one case: **no matching `organisation_members` row for `(owner_user_id, organisation_id)`**. This matches CONTEXT.md D28-02's computed-on-read LEFT JOIN exactly — no new schema needed to detect it.

**Primary recommendation:** One migration (00043) adds four nullable columns to `sops` + two new tables (`sop_review_cadences` mirroring `ai_model_settings`'s RLS shape, `sop_review_events` mirroring `sop_completions`'s append-only RLS shape) + one idempotent backfill script (mirroring `scripts/backfill-section-layouts.ts`). All governance-queue classification logic (unowned / overdue / due-soon / stale-role) should be one pure, exported, unit-testable function operating on already-fetched rows — Nyquist favors this because it needs zero live DB to test the four classification branches.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Owner display + reassignment (OWN-01/02) | API / Backend (server action + RLS) | Browser (inline picker popover) | Write must self-scope org; existing `admins_can_update_sops` RLS already gates it |
| Unowned detection (OWN-03) | API / Backend (query-time LEFT JOIN) | — | D28-02 locked: computed-on-read, no cron/materialized state |
| "My SOPs" filter (OWN-04) | Frontend Server (SSR page + searchParam) | — | Same page (`/admin/sops`), just a WHERE clause on `owner_user_id` |
| Review cadence settings (REV-01) | API / Backend (`sop_review_cadences` table + service-role action) | — | Copies `ai_model_settings` shape exactly |
| Overdue badge (REV-02) | Frontend Server (admin library row render) | — | Pure display of `review_due_at < now()`, computed in the page/component, not stored |
| Worker currency caption (REV-03) | Frontend Server (worker `OverviewTab`) | — | One read-only line; NEVER a client-side gate |
| Confirm current / event log (REV-04) | API / Backend (server action + `sop_review_events` insert) | — | Append-only audit table, same shape as `sop_completions` |
| Governance queue (GQ-01/02/03/04) | Frontend Server (`/admin/governance` RSC page) | API / Backend (query composition across sops + organisation_members + departments) | Single query-time composition; no new backend service |
| Stale-role detection (GQ-03) | API / Backend (query joining `sop_departments` → `departments`) | — | Dangling/renamed department refs only — `sub_trades` are NOT admin-editable today (see Pitfall 3) |

## Standard Stack

No new packages. This phase uses only what's already installed: Next.js Server Actions, `@supabase/supabase-js` admin/session clients, Zod, Tailwind (paper/ink tokens already in `globals.css`), Playwright.

### Package Legitimacy Audit

Not applicable — zero new dependencies. Skip the legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```
Admin library row / SOP detail / Governance queue row
        │  (click "Confirm current" / "Assign owner" / "Fix assignment")
        ▼
Server Action (src/actions/governance.ts, 'use server')
        │  requireAdmin() → { userId, organisationId } from parseJwtPayload
        │  (regular session client — sops has admins_can_update_sops RLS)
        ▼
  ┌─────────────────────────────┬───────────────────────────────┐
  │ UPDATE sops SET             │ INSERT sop_review_events       │
  │  owner_user_id / review_    │  (sop_id, org_id, reviewed_by, │
  │  due_at / last_reviewed_*   │   action, created_at)          │
  │  — rides existing RLS       │  — append-only, own RLS        │
  └─────────────────────────────┴───────────────────────────────┘
        │
        ▼
Governance queue READ path (server component, no client fetch):
  SELECT sops (owner_user_id, review_due_at, category, ...)
    LEFT JOIN organisation_members ON owner_user_id = user_id AND same org  → unowned?
    LEFT JOIN sop_departments → departments                                  → stale-role?
    compare review_due_at vs now()+30d vs now()                              → overdue/due-soon?
        │
        ▼
  classifyGovernanceRow() — PURE function, unit tested (Validation Architecture below)
        │
        ▼
  /admin/governance renders rows with filter chips + inline one-click actions
```

### Recommended Project Structure

```
supabase/migrations/
└── 00043_ownership_review_governance.sql   # 4 sops columns + 2 new tables + RLS + backfill
scripts/
└── backfill-owner-review.mjs               # idempotent, mirrors backfill-section-layouts.ts
src/actions/
└── governance.ts                            # setSopOwner, confirmSopCurrent, listGovernanceQueue
src/lib/governance/
├── classify.ts                               # PURE: classifyGovernanceRow(), computeDueDate()
└── cadences.ts                               # PURE: resolveCadenceMonths(category, orgSettings)
src/app/(protected)/admin/governance/
└── page.tsx                                  # new route — RSC, filter chips, one-click rows
src/components/admin/governance/
├── GovernanceQueueRow.tsx
├── GovernanceFilterChips.tsx
└── OwnerPicker.tsx                           # ≤2-click inline reassignment popover (OWN-02)
src/lib/journeys/journeys.ts                  # ADD /admin/governance journey (same commit)
tests/phase28/
└── *.spec.ts                                 # registered under a new `phase28` playwright project
src/lib/governance/__tests__/
└── classify.test.ts                          # static-import unit tests (phase28-unit project)
```

### Pattern 1: Additive-only sops columns riding existing RLS
**What:** Add `owner_user_id uuid references auth.users(id) on delete set null`, `review_due_at timestamptz`, `last_reviewed_at timestamptz`, `last_reviewed_by uuid references auth.users(id) on delete set null` directly to `public.sops`.
**When to use:** Always for this phase — do NOT create a parallel `sop_ownership` table (junction/1:1 side-table). `admins_can_update_sops` and `org_members_can_view_sops` (migration 00003) already cover write and read for these new columns with zero RLS edits, exactly like `parent_sop_id`/`superseded_by` were added post-hoc in later migrations.
**Example:**
```sql
-- Source: supabase/migrations/00003_sop_schema.sql:100-105 (existing policy, unmodified)
alter table public.sops
  add column if not exists owner_user_id    uuid references auth.users(id) on delete set null,
  add column if not exists review_due_at    timestamptz,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_reviewed_by uuid references auth.users(id) on delete set null;
-- No new policy needed: admins_can_update_sops already gates
-- organisation_id = current_organisation_id() AND current_user_role() IN ('admin','safety_manager')
```

### Pattern 2: Org-scoped settings table (`ai_model_settings` precedent)
**What:** `sop_review_cadences(organisation_id, category, months, updated_by, updated_at)` — composite PK `(organisation_id, category)`, authenticated SELECT policy only, writes via service-role server action self-enforcing org scope.
**When to use:** REV-01 per-category cadence override.
**Example:**
```sql
-- Source: supabase/migrations/00042_ai_model_settings.sql (verbatim shape, renamed)
create table public.sop_review_cadences (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category        text not null,        -- matches sops.category_tag values, or 'default'
  months          int not null default 12,
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, category)
);
alter table public.sop_review_cadences enable row level security;
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select using (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);
-- No authenticated INSERT/UPDATE/DELETE policy — writes go through
-- src/actions/governance.ts using createAdminClient(), self-enforcing org
-- scope from parseJwtPayload(), exactly like src/actions/ai-settings.ts:47-90.
```
**Server action mirrors** `src/actions/ai-settings.ts` line-for-line: `requireAdmin()` → `parseJwtPayload` → `createAdminClient() as any` (table not yet in `database.types.ts`) → `.upsert(..., { onConflict: 'organisation_id,category' })`.

### Pattern 3: Append-only audit table (`sop_completions` precedent — simpler than settings)
**What:** `sop_review_events(id, sop_id, organisation_id, reviewed_by, action, created_at)` — `action` CHECK IN ('confirmed_current','superseded'). Unlike `ai_model_settings`, this table CAN have an authenticated INSERT policy (like `sop_completions`) because the writer is always the current session user acting on their own org — no service-role needed.
**Example:**
```sql
-- Source: supabase/migrations/00010_completion_schema.sql:76-85 (verbatim pattern)
create table public.sop_review_events (
  id              uuid primary key default gen_random_uuid(),
  sop_id          uuid not null references public.sops(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reviewed_by     uuid references auth.users(id) on delete set null,
  action          text not null check (action in ('confirmed_current','superseded')),
  created_at      timestamptz not null default now()
);
alter table public.sop_review_events enable row level security;

create policy sop_review_events_read_org on public.sop_review_events
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy sop_review_events_insert_admin on public.sop_review_events
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin','safety_manager')
    and reviewed_by = auth.uid()
  );
-- NO UPDATE/DELETE policy — append-only (matches COMP-07/D-15 precedent).
```

### Pattern 4: Version supersede resets review_due_at
**What:** `cloneSopAsDraft` / the publish path in `src/actions/versioning.ts` is the D-04 "needs changes" routing target. When a new version is published (supersedes the prior one), stamp `review_due_at = now() + cadence` and `last_reviewed_at = now()` on the NEW row, and insert a `sop_review_events` row with `action='superseded'`.
**Where to hook it:** `cloneSopAsDraft` sets `status: 'uploading'` then flips to `'draft'` — the actual PUBLISH call (search for the publish route/action that flips `draft → published`) is the correct hook point, not the clone itself, because a draft may sit unpublished for a while. Locate the publish gate (Phase 6 "Publish gate computed as single derived boolean" — likely `src/actions/sops.ts` or `src/app/api/sops/publish` route) and add the review-reset there.
**Anti-pattern:** Do NOT reset `review_due_at` inside `cloneSopAsDraft` itself — a cloned draft that never gets published would falsely show "just reviewed."

### Anti-Patterns to Avoid
- **New junction table for ownership:** D28-01 explicitly rejects this — one nullable FK column is correct and matches the "one accountable owner" ask.
- **Background sweep / cron for unowned or overdue detection:** D28-02/D28-05 lock computed-on-read. Do not add a Railway cron job (unlike the 26.5 synthesis-sweep precedent) — that pattern exists for a different problem (embedding staleness), not this one.
- **Raw `atob` for JWT decode in new action code:** `departments.ts` (line 48) and `auth.ts` (line 416) still use raw `atob`/`JSON.parse(atob(...))` — these are PRE-EXISTING violations of the 2026-06-26 learning, not a pattern to copy. New `src/actions/governance.ts` code MUST use `parseJwtPayload` from `@/lib/supabase/jwt` (as `ai-settings.ts` and `versioning.ts` already do).
- **Blocking worker routes on ownership/review state:** D28-07 / REV-02 / v6.0 Out-of-Scope table are explicit — the worker `/sops/[sopId]` and `/sops/[sopId]/walkthrough` routes must never branch on `review_due_at` or `owner_user_id` being null/overdue. Only add the passive caption line.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org-scoped admin write gate | New RLS-bypassing service pattern | Existing `admins_can_update_sops` RLS + regular session client | Already exists, zero new attack surface (unlike the junction tables which needed service-role) |
| "Is this org member still active" check | New `is_active` column / soft-delete flag | LEFT JOIN `organisation_members` on `(user_id, organisation_id)`; absence = removed | `removeMember` already hard-deletes the row (`src/actions/auth.ts:409`) — there is no other "deactivated" state to model |
| Member picker UI for owner reassignment | New component from scratch | Reuse `getOrgMembers()` (`src/actions/assignments.ts:163`) — same list already powers the assign-to-team picker | Avoids a second "list org members" query path |
| Category → cadence resolution | Ad-hoc if/else in the query | Small pure `resolveCadenceMonths(category, orgOverrides)` helper, default 12 | Same shape as `getOrgAiModels` resolution order (org setting > env/default) |

**Key insight:** Every "how do I write this safely" question in this phase already has a shipped answer in the last three phases (25/27/4). The main planning risk is NOT figuring out a new pattern — it's picking the WRONG one of the two existing write patterns (service-role self-enforced vs. plain-RLS) for a given table. Use plain-RLS wherever an authenticated policy already exists (sops columns, review events); use service-role only for the brand-new `sop_review_cadences` settings table, matching its exact precedent.

## Common Pitfalls

### Pitfall 1: Using service-role/admin client for `sops` writes when RLS already covers it
**What goes wrong:** Copying the `departments.ts`/`ai-settings.ts` service-role pattern for `setSopOwner`/`confirmSopCurrent` when it isn't needed — this silently widens the blast radius (service-role bypasses ALL RLS, requiring you to hand-roll the org check that RLS would have given you for free).
**Why it happens:** Those are the two most recent precedents in the codebase, and the "always self-enforce org scope" instinct causes over-reaching for a service-role client even when regular session `createClient()` + existing RLS already validates it.
**How to avoid:** Check `admins_can_update_sops` gates `organisation_id + role` correctly (it does) → use `createClient()` (session, RLS-respecting) for all `sops` UPDATEs in this phase. Only `sop_review_cadences` needs the service-role pattern.
**Warning signs:** A new action importing `createAdminClient` to touch `sops` alone (no junction table involved) is a red flag — check the migration for an existing authenticated policy first.

### Pitfall 2: Treating "owner is not an active member" as needing a new "deactivated" flag
**What goes wrong:** Building a soft-delete/`is_active` column on `organisation_members` speculatively for OWN-03, when `removeMember` already hard-deletes.
**Why it happens:** "Deactivated OR removed" language in D28-02/OWN-03 reads like two states.
**How to avoid:** Confirm via `src/actions/auth.ts:409-455` — there is exactly one state to detect: **absence of an `organisation_members` row** for `(owner_user_id, organisation_id)`. Also true if `owner_user_id IS NULL` (never assigned). Both collapse into a single `LEFT JOIN ... IS NULL` check.
**Warning signs:** Any new migration adding a boolean/status column to `organisation_members` for this phase is unrequested scope.

### Pitfall 3: Treating `sub_trades` as admin-renamable for GQ-03 stale-role detection
**What goes wrong:** Building a `sub_trades.updated_at` staleness check (mirroring the department "renamed since review" heuristic) when `sub_trades` has no admin edit UI at all.
**Why it happens:** CONTEXT.md D28-06 says "assignments also reference roles/sub-trades (Phase 15)" which reads like sub-trades are equally mutable.
**How to avoid:** `src/actions/sub-trades.ts` has no `updateSubTrade`/`renameSubTrade` export — the Phase 15a seed vocab (`operator`/`fitter`/`sparky`/`maintainer`/`other`) is fixed; only Phase 15b (future, not built) would make it admin-editable. **Scope GQ-03 to `sop_departments` → `departments` only** (dangling department reference = department archived/deleted; renamed-since-review = `departments.updated_at > sops.last_reviewed_at` for a department still tagged on that SOP). Do not build sub-trade staleness detection this phase — there is nothing to detect yet.
**Warning signs:** A query joining `sops_sub_trades` → `sub_trades.updated_at` for staleness is speculative work against a table that currently never changes post-seed.

### Pitfall 4: `database.types.ts` doesn't have the new columns/tables
**What goes wrong:** TypeScript errors or silent `any`-typed footguns when querying `sops.owner_user_id` etc. via the typed Supabase client.
**Why it happens:** Per multiple STATE.md decisions, type regeneration "not available in this environment" — `all_departments`, `category_tag`'s siblings, and department tables were all either manually added to `database.types.ts` or accessed via `as any`.
**How to avoid:** For the FOUR new `sops` columns (existing typed table), manually extend the `sops` Row/Insert/Update types in `database.types.ts` (cheap, ~12 lines) — this is the pattern used for `parent_sop_id`/`superseded_by` and keeps `sops` queries type-safe elsewhere. For the TWO new tables (`sop_review_cadences`, `sop_review_events`), use `(supabase as any)` casts — matches `ai_model_settings`/`departments`/`block_suggestions` precedent exactly; do not attempt a full type regen mid-phase.
**Warning signs:** `npx tsc --noEmit` failing on `sops.owner_user_id does not exist on type` after the migration is applied but before `database.types.ts` is touched.

### Pitfall 5: `next build` "Server Actions must be async" (2026-06-27 recurrence risk)
**What goes wrong:** `resolveCadenceMonths()` / `classifyGovernanceRow()` — both naturally PURE and SYNC — get placed as exports inside `src/actions/governance.ts` (which starts with `'use server'`), passing `tsc` but failing `next build`.
**Why it happens:** These are exactly the kind of small pure helper that's tempting to co-locate with the action that calls them, same as `computeNextVersionLineage` was originally.
**How to avoid:** Put ALL pure/sync logic in `src/lib/governance/classify.ts` and `src/lib/governance/cadences.ts` (plain modules, no `'use server'`), and import them into `governance.ts`. Every export of `governance.ts` itself must be `async`.
**Warning signs:** Any `export function` (not `async function`) inside a file starting with `'use server'`.

### Pitfall 6: New Playwright specs silently never run
**What goes wrong:** `tests/phase28/*.spec.ts` files are created but no `playwright.config.ts` project regex matches them — same class of bug as the 2026-05-25 learning (`no-bulk-verify-ui.spec.ts`).
**How to avoid:** Add a `phase28` project with a BROAD `testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/` (mirrors the deliberately-broad `phase26` registration, which needed zero further config edits across the whole phase) — do this in Wave 0, not deferred. Verify immediately with `npx playwright test --list --project=phase28`. Also register a `phase28-unit` project pointed at `testDir: './src/lib/governance/__tests__'` for the pure-function unit tests (mirrors `phase27-unit` → `./src/lib/ai/__tests__`).

### Pitfall 7: Forgetting `journeys.ts` for the new `/admin/governance` route
**What goes wrong:** `/pathways` flags `/admin/governance` as an unmapped screen after the phase ships (project convention, `CLAUDE.md` § Pathways Map Maintenance).
**How to avoid:** Add the journey step in the SAME plan/commit that creates the route — treat it as a required task, not a follow-up.

## Code Examples

### Governance queue classification (pure, unit-testable)
```typescript
// Source: pattern synthesized from computeNextVersionLineage (src/lib/builder/version-lineage.ts)
// and the D28-02/D28-05/D28-06 CONTEXT.md decisions. Lives in src/lib/governance/classify.ts.
export type GovernanceFlag = 'overdue' | 'due_soon' | 'unowned' | 'stale_role'

export interface GovernanceInput {
  reviewDueAt: string | null       // sops.review_due_at
  ownerUserId: string | null       // sops.owner_user_id
  ownerIsActiveMember: boolean     // computed via LEFT JOIN organisation_members
  danglingDepartmentRefs: boolean  // sop_departments row references archived/missing department
  departmentRenamedSinceReview: boolean // departments.updated_at > sops.last_reviewed_at
  now?: Date
}

const DUE_SOON_WINDOW_DAYS = 30

export function classifyGovernanceRow(input: GovernanceInput): GovernanceFlag[] {
  const now = input.now ?? new Date()
  const flags: GovernanceFlag[] = []

  if (input.ownerUserId === null || !input.ownerIsActiveMember) flags.push('unowned')

  if (input.reviewDueAt) {
    const due = new Date(input.reviewDueAt)
    if (due < now) flags.push('overdue')
    else if (due.getTime() - now.getTime() <= DUE_SOON_WINDOW_DAYS * 86_400_000) flags.push('due_soon')
  }

  if (input.danglingDepartmentRefs || input.departmentRenamedSinceReview) flags.push('stale_role')

  return flags
}
```

### Owner backfill on SOP insert
```typescript
// Any create-SOP path (wizard, upload, ai-prompt, blank) should default owner
// to the creator at insert time (D28-01). Add to the shared insert payload:
{
  // ...existing fields
  owner_user_id: user.id,               // creator becomes owner by default
  review_due_at: computeInitialDueDate(categoryTag, orgCadences), // published_at ?? now() + cadence
}
```

### Backfill script skeleton (mirrors `scripts/backfill-section-layouts.ts` precedent)
```typescript
// scripts/backfill-owner-review.mjs
// ponytail-relevant: idempotent, only touches rows missing the value,
// logs per-row outcome, per-step failure must NOT null-clobber (2026-07-05 learning).
for (const sop of sopsWithoutOwnerOrDueDate) {
  const owner = sop.created_by_still_active
    ? sop.created_by
    : earliestAdminOrSafetyManagerForOrg(sop.organisation_id)
  const cadenceMonths = resolveCadenceMonths(sop.category_tag, orgCadenceOverrides)
  const dueAt = new Date(Math.max(
    new Date(sop.published_at ?? sop.updated_at).getTime(),
    new Date(sop.updated_at).getTime(),
  ))
  dueAt.setMonth(dueAt.getMonth() + cadenceMonths)

  const patch = {}
  if (!sop.owner_user_id && owner) patch.owner_user_id = owner
  if (!sop.review_due_at) patch.review_due_at = dueAt.toISOString()
  if (Object.keys(patch).length > 0) await admin.from('sops').update(patch).eq('id', sop.id)
}
```

## Runtime State Inventory

> This is NOT a rename/refactor phase — it is additive schema + new UI. Included per Nyquist rigor since a backfill migration runs against production data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `sops` rows have no `owner_user_id`/`review_due_at` — ALL published SOPs will need the backfill migration to compute values | Data migration (SQL `UPDATE` inside 00043, or a separate idempotent `.mjs` script per D28-03 backfill formula) |
| Live service config | None — no external service holds ownership/review state today | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars needed this phase | None |
| Build artifacts | `database.types.ts` needs manual extension for the 4 new `sops` columns (Pitfall 4) | Code edit, not a data migration |

**Nothing found in "Live service config" / "OS-registered state" / "Secrets" categories** — verified via grep across `src/actions`, `railway.json`, and `.env.local.example`; this phase is entirely within the Supabase schema + Next.js app boundary.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next migration slot is `00043` | Standard Stack / Migration filename | Low — trivially re-numbered at execution time if a parallel phase claims 00043 first (precedent: 13-03/13-04 renumbering already handled this exact collision gracefully) |
| A2 | The SOP publish gate (draft→published transition) lives in a locatable single route/action that CONTEXT.md's D28-04 "supersede resets review_due_at" can hook into | Pattern 4 | Medium — if publish logic is spread across multiple call sites (parse-pipeline auto-publish vs. manual publish button), the reset must be added to ALL of them. Planner should grep `status.*published` / `'published'` writes to `sops` before committing to one hook point. |
| A3 | `sop_assignments.role` values are drawn from `app_role` enum (admin/supervisor/worker/safety_manager), not a renamable custom vocab, so GQ-03 stale-role scope is correctly limited to departments only (Pitfall 3) | Common Pitfalls / GQ-03 scope | Low-Medium — if a future custom "role" vocab exists elsewhere the planner hasn't surfaced, GQ-03 would under-scope. Verified no `updateSubTrade`/rename action exists in `src/actions/sub-trades.ts` at research time. |

**If this table is empty:** N/A — see above; both assumptions are low-risk given direct source verification, flagged only because the planner should re-confirm A2 against the actual current publish code path before writing task-level steps.

## Open Questions

1. **Where exactly does the draft→published transition happen?**
   - What we know: Phase 6's "Publish gate computed as single derived boolean" and Phase 21's "publish route" (`400 unverified_blocks`) are both referenced in STATE.md/CLAUDE.md, implying a single route/action.
   - What's unclear: The exact file path wasn't re-verified in this research pass (out of the explicitly-listed read scope; grepping `src/app/api/sops` for a `publish` route or `src/actions/sops.ts` for a `publishSop` export is a 30-second check).
   - Recommendation: Planner's Wave 0 should grep `publish` across `src/actions/*.ts` and `src/app/api/sops/**` and confirm the single hook point before writing the "supersede resets review_due_at" task.

2. **What are the org's existing `category_tag` values, to seed sensible `sop_review_cadences` categories?**
   - What we know: `sops.category_tag` is a single free-text-ish column (Phase 13 D-Tax-03); `block_categories` has a 34-tag controlled vocab for hazard/PPE tagging, but SOP-level categories are a smaller, separate set.
   - What's unclear: Whether `sop_review_cadences.category` should key off `sops.category_tag` verbatim (including NULL) or a normalized smaller taxonomy.
   - Recommendation: Default to a single `category = 'default'` row (12 months) satisfying REV-01's "per-category default cadence" at the simplest useful granularity; per-category rows are additive later if Simon wants finer control — do not build a category-picker UI speculatively before category values are confirmed with real data.

## Environment Availability

Skipped — this phase has no new external tool/service dependency. All work is within the existing Supabase Postgres + Next.js/Railway stack already provisioned and verified working in Phase 27.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (test runner used for both unit-style and integration specs, per project convention) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase28-unit` |
| Full suite command | `npx playwright test --project=phase28-unit --project=phase28-stubs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OWN-01 | Backfill assigns owner correctly (creator-if-active, else earliest admin) | unit | `npx playwright test --project=phase28-unit -g "backfill owner"` | ❌ Wave 0 |
| OWN-02 | `setSopOwner` action self-enforces org scope (owner must be org member) | source-contract + test.fixme runtime | `npx playwright test --project=phase28-stubs -g "setSopOwner"` | ❌ Wave 0 |
| OWN-03 | `classifyGovernanceRow` flags `unowned` when owner null OR not active member | unit | `npx playwright test --project=phase28-unit -g "unowned"` | ❌ Wave 0 |
| OWN-04 | "Owned by me" filter query returns only caller's owned SOPs | source-contract | `npx playwright test --project=phase28-stubs -g "owner=me"` | ❌ Wave 0 |
| REV-01 | `resolveCadenceMonths` resolution order: per-SOP override > org category setting > 12-month default | unit | `npx playwright test --project=phase28-unit -g "cadence"` | ❌ Wave 0 |
| REV-02 | Overdue badge renders only in admin library; never blocks worker route | source-contract (grep worker route has no gate) | `npx playwright test --project=phase28-stubs -g "worker route no gate"` | ❌ Wave 0 |
| REV-03 | Worker OverviewTab renders "Current as of <date>" caption, NZ date format | source-contract | `npx playwright test --project=phase28-stubs -g "currency caption"` | ❌ Wave 0 |
| REV-04 | `confirmSopCurrent` writes `last_reviewed_at`/`review_due_at` + inserts `sop_review_events` row | source-contract + test.fixme runtime | `npx playwright test --project=phase28-stubs -g "confirmSopCurrent"` | ❌ Wave 0 |
| GQ-01 | Queue page renders due-soon/overdue/unowned/stale-role rows from one query | source-contract | `npx playwright test --project=phase28-stubs -g "governance queue renders"` | ❌ Wave 0 |
| GQ-02 | Each row has exactly one primary action wired (not an empty onClick — 2026-05-25/06-05 class) | source-contract (assert handler references real callback, not just prop name) | `npx playwright test --project=phase28-stubs -g "row action wired"` | ❌ Wave 0 |
| GQ-03 | `classifyGovernanceRow` flags `stale_role` for dangling/renamed department refs | unit | `npx playwright test --project=phase28-unit -g "stale_role"` | ❌ Wave 0 |
| GQ-04 | Dashboard widget counts match queue counts, deep-links carry correct filter param | source-contract | `npx playwright test --project=phase28-stubs -g "dashboard widget"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase28-unit`
- **Per wave merge:** `npx playwright test --project=phase28-unit --project=phase28-stubs` + `npx tsc --noEmit` + `npm run build` (touches `src/actions/*` ⇒ 2026-06-27 learning applies — full `next build`, not just `tsc`)
- **Phase gate:** Full suite green before `/gsd-verify-work`; live-DB `test.fixme` runtime assertions (cross-org write isolation for `setSopOwner`/`confirmSopCurrent`, per the Railway-only-testing convention) carried as documented UAT items exactly like `tests/phase27/ai-settings-org-scope.spec.ts`.

### Wave 0 Gaps
- [ ] `playwright.config.ts` — register `phase28` project (`testDir: '.'`, `testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/`) — broad regex per `phase26` precedent, single registration point for the whole phase
- [ ] `playwright.config.ts` — register `phase28-unit` project (`testDir: './src/lib/governance/__tests__'`, static `@/` imports resolve correctly, mirrors `phase27-unit`)
- [ ] `src/lib/governance/__tests__/classify.test.ts` — Wave 0 stub for the pure classification function
- [ ] `supabase/migrations/00043_ownership_review_governance.sql` — does not exist yet
- [ ] `database.types.ts` manual extension for the 4 new `sops` columns — not present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — existing Supabase session auth |
| V3 Session Management | No | Unaffected |
| V4 Access Control | Yes | Existing `admins_can_update_sops` RLS (role + org scope) for the 4 new columns; new RLS on `sop_review_cadences` (read: org-scoped; write: service-role self-enforced, no authenticated write policy — 00041 REVOKE-style posture) and `sop_review_events` (insert: authenticated + org + role + `reviewed_by = auth.uid()` check; append-only, no update/delete policy) |
| V5 Input Validation | Yes | Zod schema for `setSopOwner(sopId, userId)` and `confirmSopCurrent(sopId)` inputs — `userId` must validate as `z.string().uuid()`, and (per `setDepartmentOwner` precedent) the server action must re-verify the target `userId` is an `organisation_members` row in the CALLER's org before writing, never trust client input |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant owner assignment (assigning an SOP's owner to a user_id from a DIFFERENT org) | Tampering / Elevation of Privilege | Mirror `setDepartmentOwner` (`src/actions/departments.ts:296-332`): verify `userId` exists in `organisation_members` for `ctx.organisationId` BEFORE the write, exactly the T-25-03 pattern |
| Cross-tenant `sop_review_cadences` write (org A setting org B's cadence) | Tampering | Mirror `setAiModelSetting`: `organisation_id` sourced ONLY from `parseJwtPayload`, never a function parameter — same "no attack surface" source-contract test style as `tests/phase27/ai-settings-org-scope.spec.ts` |
| SECURITY DEFINER RPC exposing cross-org read (if any helper function is added for stale-role joins) | Information Disclosure | If a SQL helper function is added (mirroring `current_user_department_ids()`), it must derive identity from `auth.uid()` internally — NEVER accept an org id as a client-passed parameter without a REVOKE (00041 precedent) |
| Raw `atob` JWT decode reintroduced in new governance action code | Tampering (malformed token crash) | Use `parseJwtPayload` from `@/lib/supabase/jwt` exclusively — do not copy the still-present raw-`atob` pattern from `departments.ts`/`auth.ts` |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `C:\Development\SOPstart\supabase\migrations\00042_ai_model_settings.sql` — org-scoped settings RLS shape
- `C:\Development\SOPstart\supabase\migrations\00010_completion_schema.sql` — append-only audit table RLS shape
- `C:\Development\SOPstart\supabase\migrations\00003_sop_schema.sql` — existing `admins_can_update_sops`/`org_members_can_view_sops` policies on `sops`
- `C:\Development\SOPstart\supabase\migrations\00035_departments_schema.sql` — junction table recursion-avoidance pattern, `owner_user_id ON DELETE SET NULL` precedent
- `C:\Development\SOPstart\supabase\migrations\00041_match_rpc_lockdown.sql` — SECURITY DEFINER REVOKE posture
- `C:\Development\SOPstart\src\actions\ai-settings.ts` — settings-table server action pattern
- `C:\Development\SOPstart\src\actions\departments.ts` — `setDepartmentOwner` org-membership verification pattern, junction-write self-enforcement pattern
- `C:\Development\SOPstart\src\actions\versioning.ts` — supersede/clone flow, `computeNextVersionLineage` sync-helper-extraction precedent
- `C:\Development\SOPstart\src\actions\auth.ts` (lines 405-456) — `removeMember` hard-delete confirms no "deactivated" state
- `C:\Development\SOPstart\src\actions\sub-trades.ts` — confirms no rename/update export exists for sub-trades
- `C:\Development\SOPstart\src\types\sop.ts`, `src\types\database.types.ts` — current `Sop`/`sops` schema, confirms owner/review columns are absent pre-Phase-28
- `C:\Development\SOPstart\src\app\(protected)\admin\sops\page.tsx` — admin library row structure, existing action-icon-column pattern
- `C:\Development\SOPstart\src\lib\supabase\jwt.ts` — `parseJwtPayload` canonical implementation
- `C:\Development\SOPstart\playwright.config.ts` + `tests\phase27\ai-settings-org-scope.spec.ts` — spec-registration and test.fixme runtime-carry convention
- `C:\Development\SOPstart\.planning\phases\28-ownership-review-lifecycle-governance-queue\28-CONTEXT.md` — locked decisions D28-01..D28-10
- `C:\Development\SOPstart\.planning\REQUIREMENTS.md` (v6.0 section) — OWN/REV/GQ requirement text
- `C:\Development\SOPstart\CLAUDE.md` — Learnings log (2026-06-15, 2026-06-26, 2026-06-27, 2026-05-25, 2026-07-05)

### Secondary (MEDIUM confidence)
- None — no WebSearch/external sources were needed; this is a fully brownfield-internal research pass.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all patterns copied verbatim from live migrations/actions in this repo
- Architecture: HIGH — every read/write path traced to an existing RLS policy or an existing precedent action
- Pitfalls: HIGH — all six pitfalls are either directly observed in the codebase (raw atob, missing types) or are documented CLAUDE.md learnings with a clear recurrence risk in this exact phase's file shapes

**Research date:** 2026-07-12
**Valid until:** 30 days (stable brownfield codebase; re-verify migration slot number if Phase 29/30 planning starts first)
