# Phase 34: Supervisor Observations - Research

**Researched:** 2026-07-20
**Domain:** Append-only audit-record table + RLS + two new UI entry points (org-model panel, activity row action) + worker profile read surface
**Confidence:** HIGH

## Summary

This phase is almost entirely a "copy the proven pattern" exercise, not new invention. The append-only/org-scoped/role-checked table shape has now been built three times in this codebase (`sop_completions`/`completion_sign_offs` in migration 00010, `sop_completion_signatures` in 00038, `sop_review_events` in 00043) and migration 00043 is the closest structural sibling: a simple `INSERT`-only table with a role-checked RLS policy (`current_user_role() in (...)`) and `<actor>_by = auth.uid()` — no service-role client needed for the write path at all. Phase 34 should follow 00043's shape exactly, widened to three roles (`supervisor`, `admin`, `safety_manager`) instead of two.

The two UI entry points (org-model person panel, /activity row action) both attach to **existing pages that currently have no click-to-detail affordance** — `OrgColumnsBoard`/`OrgChartCanvas` person-chips are inert today, and `CompletionSummaryCard` is a single full-card `<Link>` with no inner interactive elements. Both need new code, not a tweak to existing handlers. The recording modal is genuinely new UI (verdict buttons, SOP picker), but every visual primitive it needs (pill, frame, chip, verdict-style button) already exists in `blueprint-theme.css`, and the sketch (`sketches/supervisor-observations/index.html`) is pixel-exact reference — approved as-is for sections 01-04.

The one hazard is a real trap the project has hit twice already: the sketch's `.btn.yellow` uses `var(--brand-yellow)`, which is **not defined anywhere in `src/`** (same undefined-token class as the 2026-07-13/2026-07-14 Learnings entries and the 30-07 publish-CTA bug). Do not port that class literally — use `--accent-signoff` (already defined, "same hue as brand-yellow but semantically distinct," per the design-tokens skill) for the primary CTA instead.

**Primary recommendation:** One migration modeled directly on `00043_ownership_review_governance.sql` § "sop_review_events" (RLS-only insert, no admin client), one `src/actions/observations.ts` server action using `getSessionContext()` + a manual `['supervisor','admin','safety_manager'].includes(role)` check (mirrors `completions.ts::signOffCompletion`), one `src/lib/validators/observations.ts` Zod schema, one shared `RecordObservationModal` mounted from both entry points, and additive read sections on the worker `/profile` page and the new person panel.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Observation record creation (verdict + note + version stamp) | API / Backend (server action) | Database (RLS insert policy) | Follows `sop_review_events` — the INSERT itself is guarded by RLS role+org check; the server action only validates input shape and resolves `completion_id`/current SOP version before insert |
| Append-only enforcement | Database (RLS — no UPDATE/DELETE policy) | — | Enforced at the data layer, not the UI — matches COMP-07/D-15 precedent; UI merely doesn't render edit affordances |
| Org-label renaming for verdicts (D-02) | API / Backend (org settings read) | Database (`organisations` jsonb or a settings table) | Display-only transform; canonical `performed_to_sop`/`needs_support` values never leave the DB layer |
| Person panel (entry point A) | Frontend Server (SSR page) + Browser (client shell) | API / Backend (new `listObservationsForPerson` read) | `TeamViewShell`-style thin client wrapper over a server-fetched org tree; panel opens client-side, data fetched via a new server action |
| Activity row action (entry point B) | Browser (client component) | API / Backend (observation insert) | `SupervisorActivityView`/`CompletionSummaryCard` are already `'use client'`; row action is a local state + modal trigger, no new page |
| Worker "Observations about you" (OBS-02) | Frontend Server (SSR page) | Database (RLS select, self-scoped) | `/profile` is currently a server component; add a server-fetched read section, RLS naturally scopes to org (worker sees all org observations about themself via `observed_worker_id = auth.uid()` in addition to the org policy) |
| SOP version auto-stamp (D-10) | API / Backend (server action) | Database (denormalized `sop_version` column) | Stamped at insert time from the SOP's current `version` column, mirrors `sop_completions.sop_version` pattern from COMP-04 |

## Standard Stack

### Core

No new dependencies. This phase is 100% existing-stack: Next.js Server Actions, Supabase Postgres + RLS, Zod, React (client components for the modal/panel), Tailwind + the existing blueprint-theme CSS custom properties.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | (already installed) | `ObservationSchema` input validation | Every server action in the codebase validates via a `src/lib/validators/*.ts` Zod schema before touching Supabase (completions.ts, org-model.ts, approvals.ts precedent) |
| @supabase/ssr | (already installed) | Session client for the RLS-gated insert | `getSessionContext()` wraps this; no admin client needed for the observation insert itself (RLS does the gating, per D-12) |

### Supporting

None. No new packages required — this is the "don't hand-roll, reuse the org's own proven pattern" case study.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RLS-only insert (session client, like `sop_review_events`) | Service-role admin client (like `completion_sign_offs`/`sop_completion_signatures`) | Admin-client path requires manual org-scope + role self-enforcement (the codebase's recurring write-hole class per 2026-06-15/2026-06-26 Learnings). RLS-only is strictly simpler and has zero cross-org-hole surface area *if* the policy is written correctly — prefer it per D-12's explicit instruction ("Append-only via the proven RLS pattern from `sop_review_events`") |
| Storing verdict as free text | Postgres `check` constraint on two literal values (`performed_to_sop`/`needs_support`) | `sop_review_events.action` already uses this exact `check (action in (...))` idiom — reuse it verbatim; a Zod enum on the client is not sufficient defense-in-depth alone |

**Installation:** None required.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

Not applicable — this phase adds zero new npm/pip/cargo packages. All work is new SQL migration + new TypeScript files using already-installed dependencies (`zod`, `@supabase/ssr`, `lucide-react` for icons).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐   ┌──────────────────────────┐
│  /admin/team (A)         │   │  /activity supervisor (B) │
│  OrgChartCanvas /        │   │  SupervisorActivityView /  │
│  OrgColumnsBoard         │   │  CompletionSummaryCard     │
│  [NEW] onClick person →  │   │  [NEW] onClick "I observed│
│  opens PersonPanel       │   │  this" row action          │
└────────────┬─────────────┘   └────────────┬───────────────┘
             │  worker pre-filled            │  worker + sop + completionId pre-filled
             ▼                               ▼
        ┌───────────────────────────────────────────┐
        │  [NEW] RecordObservationModal (shared)      │
        │  worker (locked) → SOP picker (required-    │
        │  first) → verdict buttons → optional note   │
        └───────────────────┬─────────────────────────┘
                             │ recordObservation(input)
                             ▼
        ┌───────────────────────────────────────────┐
        │  src/actions/observations.ts (server action)│
        │  1. getSessionContext() → role check         │
        │     (supervisor|admin|safety_manager)        │
        │  2. Zod validate                             │
        │  3. resolve current sop.version (auto-stamp) │
        │  4. session-scoped supabase.from(            │
        │     'sop_observations').insert({...})        │
        └───────────────────┬─────────────────────────┘
                             │ RLS: org-scoped + role-checked +
                             │ observed_by = auth.uid() (no admin client)
                             ▼
        ┌───────────────────────────────────────────┐
        │  sop_observations (Postgres, RLS)            │
        │  SELECT: org-scoped (read for admin/super-   │
        │  visor/safety_manager OR observed_worker_id  │
        │  = auth.uid() — worker self-read)             │
        │  INSERT: role-checked, observed_by=auth.uid() │
        │  NO UPDATE, NO DELETE policy                  │
        └───────────────────┬─────────────────────────┘
                             │ read
                             ▼
        ┌───────────────────────────────────────────┐
        │  /profile "Observations about you" (OBS-02)  │
        │  [NEW] server-fetched section + trust banner  │
        │  Person panel "Observation history" (entry A) │
        └───────────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/migrations/
└── 000XX_supervisor_observations.sql   # sop_observations table + RLS (models 00043)

src/actions/
└── observations.ts                     # recordObservation, listObservationsForPerson,
                                         # listObservationsForWorker (self)

src/lib/validators/
└── observations.ts                     # RecordObservationSchema (Zod)

src/components/observations/
├── RecordObservationModal.tsx          # shared modal, mounted from both entry points
├── VerdictButtons.tsx                  # two-button verdict picker (blueprint verdict-btn class)
└── ObservationRow.tsx                  # shared list-row renderer (person panel + /profile)

src/components/admin/org-model/
└── PersonPanel.tsx                     # [NEW] side panel — info + observation history + CTA
                                         # (OrgChartCanvas.tsx + OrgColumnsBoard.tsx gain onClick)

src/app/(protected)/profile/page.tsx    # + "Observations about you" section + trust banner

src/app/(protected)/activity/
└── SupervisorActivityView.tsx          # + header "Record observation" button
└── (CompletionSummaryCard.tsx gains an "I observed this" row-action slot,
     or a thin wrapper component to avoid the outer <Link> capturing the click)

tests/phase34/                          # Nyquist harness — broad regex registration
```

### Pattern 1: RLS-only append-only insert (no admin client)

**What:** Table has a `select` policy scoped by org (+ self for the worker), an `insert` policy scoped by org + role + `observed_by = auth.uid()`, and explicitly no `update`/`delete` policy.
**When to use:** Any new audit-evidence table where the actor recording it IS the authenticated session user (no cross-user/service-role write needed). This is the D-12-mandated pattern.
**Example:**
```sql
-- Source: supabase/migrations/00043_ownership_review_governance.sql (sop_review_events)
create table if not exists public.sop_observations (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations(id) on delete cascade,
  sop_id             uuid not null references public.sops(id) on delete cascade,
  sop_version        int not null,
  observed_worker_id uuid not null references auth.users(id) on delete cascade,
  observed_by        uuid references auth.users(id) on delete set null,
  verdict            text not null check (verdict in ('performed_to_sop', 'needs_support')),
  note               text,
  completion_id      uuid references public.sop_completions(id) on delete set null,
  created_at         timestamptz not null default now()
);

alter table public.sop_observations enable row level security;

create policy sop_observations_read_org on public.sop_observations
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    -- worker can always read observations about themself, even if their
    -- role changes later or the org-scope claim is stale (OBS-02 trust guarantee)
    or observed_worker_id = auth.uid()
  );

create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
  );

-- NO UPDATE policy — append-only
-- NO DELETE policy — append-only
```

### Pattern 2: Manual role-array check in the server action (mirrors `signOffCompletion`)

**What:** `getSessionContext()` first, then `if (!role || !['supervisor','admin','safety_manager'].includes(role)) return { error }`.
**When to use:** Whenever the allowed-role set is NOT `['admin','safety_manager']` (the `requireAdminContext()` shape) — `requireAdminContext()` cannot be reused as-is here because it excludes `supervisor` (D-04 explicitly includes supervisor). Do not widen `requireAdminContext()` itself (other callers depend on its admin-only semantics) — inline the check like `completions.ts` does.
**Example:**
```typescript
// Source: src/actions/completions.ts::signOffCompletion (pattern to mirror)
const { userId, role, organisationId } = await getSessionContext()
if (!userId) return { success: false, error: 'Not authenticated' }
if (!role || !['supervisor', 'admin', 'safety_manager'].includes(role)) {
  return { success: false, error: 'Only supervisors, admins and safety managers can record observations.' }
}
if (!organisationId) return { success: false, error: 'No organisation found' }
```

### Pattern 3: SOP version auto-stamp at write time (D-10)

**What:** Read `sops.version` (or the equivalent "current version" column) inside the server action immediately before insert and write it into `sop_observations.sop_version` — never trust a client-supplied version number.
**When to use:** Any record that must survive a later SOP supersede without silently pointing at stale content (same rationale as `sop_completions.sop_version`, COMP-04).
**Example:**
```typescript
// Server-side read of current version, not client input — same idiom as
// src/actions/completions.ts submitCompletion's sopVersion handling.
const { data: sop } = await supabase.from('sops').select('version').eq('id', sopId).single()
if (!sop) return { success: false, error: 'SOP not found' }
// insert with sop_version: sop.version
```

### Pattern 4: Session client (not admin client) for the write

**What:** Use the regular `supabase` client returned by `getSessionContext()` for the `sop_observations` insert — do NOT reach for `createAdminClient()`. Because the RLS insert policy already checks org + role + `observed_by = auth.uid()`, a session-scoped insert is automatically both correct and safe; wrapping it in an admin client would remove that protection and reintroduce the exact cross-org write-hole class flagged in the 2026-06-15/2026-06-26 Learnings.
**When to use:** This table, specifically — because (unlike `sop_completion_signatures`, which needs a roster/kiosk-account write path) every observation recorder IS a real logged-in session user with a real role claim.

### Anti-Patterns to Avoid

- **Using `createAdminClient()` for the insert "to be safe":** This is backwards — for this table the RLS policy IS the safety mechanism (D-12). Reaching for the admin client here is unnecessary and reopens the write-hole class the project has fixed three times already (2026-06-15, 2026-06-26, 2026-07-05 Learnings entries).
- **Reusing `requireAdminContext()` unmodified:** It hard-excludes `supervisor`. Do not edit its role list either (other call sites depend on admin-only semantics) — write the local role-array check instead.
- **Porting `.btn.yellow { background: var(--brand-yellow) }` from the sketch literally:** `--brand-yellow` is undefined in `src/` (see Common Pitfalls). Use `--accent-signoff` for the primary CTA.
- **Giving the worker a soft-delete or "acknowledge and hide" control on their own observations:** Contradicts D-08 ("nothing is hidden from you") and the append-only contract; there is no legitimate UI affordance to remove or dismiss an observation from the worker's own view.
- **Client-supplied `sop_version` or `created_at`:** Both must be server-resolved/DB-defaulted, not accepted from the browser (mirrors `sop_completion_signatures.signed_at` being a DB default, not client-supplied — 2026-06-26-era pattern).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|--------------|
| Append-only audit trail | A soft-delete flag + app-level "don't show deleted" filter | Postgres RLS with no UPDATE/DELETE policy — the DB physically cannot mutate the row (proven 3x already) |
| Org isolation on a service-role write | Custom "assert org matches" helper module | Prefer the RLS-only insert (Pattern 1) so there is no service-role write to self-enforce in the first place; if a future admin-client path is ever needed here, copy the exact `completion.organisation_id !== organisationId` guard from `signOffCompletion`, don't invent a new helper |
| Role-gate for supervisor+admin+safety_manager | A new generic `requireAnyRoleContext(roles[])` abstraction | A three-line inline check (Pattern 2) — this exact shape (`getSessionContext()` + array `.includes()`) already exists twice in the codebase (`completions.ts`, `escalation.ts`'s `authOrg()`); do not add a parameterized guard factory for a check this small (YAGNI — only `requireAdminContext()` earned its own module because it's called from ~10+ files) |
| Verdict label renaming per org (D-02) | A new generic "label override" table/engine | A single `organisations.observation_labels` jsonb column (`{ performed_to_sop: "...", needs_support: "..." }`) read at display time only, mirrors the lightness of `sop_review_cadences`' per-org settings shape but doesn't need its own table since it's org-singleton, not org+category keyed |

**Key insight:** every "hard" problem in this phase (immutability, tenancy, role-gating) already has a working, field-tested solution in this exact codebase. The only genuinely new code is the modal UI and the two click-to-open panel affordances.

## Common Pitfalls

### Pitfall 1: Porting `var(--brand-yellow)` from the sketch verbatim renders the CTA invisible

**What goes wrong:** The sketch's `.btn.yellow` class uses `background: var(--brand-yellow)`. Grepped across `src/` — `--brand-yellow` is **not declared in any stylesheet** (`blueprint-theme.css`, `globals.css`, or elsewhere). An undefined CSS custom property silently resolves to nothing; the button keeps its other declared styles (white text, dark border-color if present) but no fill — exactly the invisible-button failure class already logged twice in this project's Learnings (2026-07-13 six-token sweep, 2026-07-14 CI test `no-undefined-css-tokens.spec.ts`).
**Why it happens:** The sketch HTML defines its own standalone `:root` block (including `--brand-yellow: #fbbf24`) for preview purposes; that `:root` block is never ported into the app, only the individual component classes get copied.
**How to avoid:** Use `--accent-signoff` (declared in `blueprint-theme.css`, "same hue as brand-yellow but semantically distinct" per `references/design-tokens.md`) for the "＋ RECORD OBSERVATION" and "SAVE OBSERVATION" primary CTAs instead of `.btn.yellow`.
**Warning signs:** `grep -rn -- "--brand-yellow" src/styles src/app` returns zero declaration lines (only usage lines) — this repo's own CI guard (`tests/lint/no-undefined-css-tokens.spec.ts`) should catch a fallback-less reference at test time, but PLAN this correctly up front rather than relying on the guard to catch it after the fact.

### Pitfall 2: Person-chip click handlers don't exist yet — this is new wiring, not a tweak

**What goes wrong:** Assuming `OrgChartCanvas`/`OrgColumnsBoard` already have a "click person → do something" hook because the sketch shows it as if it's obviously there.
**Why it happens:** The org chart (Phase 32) was built for structure-editing (add role, add person, add department) — person-chips render as plain `<span>` elements with zero `onClick`.
**How to avoid:** Verified via direct grep — neither component has a person-chip click handler. Plan must add one explicitly (state lifted to `TeamViewShell` or a new panel-owning wrapper, following the exact "async Server Component can't hold client state" pattern that already forced `TeamViewShell.tsx` and `WiringPatchBayShell.tsx` into existence in Phase 32).
**Warning signs:** None — just don't assume; grep before wiring.

### Pitfall 3: `CompletionSummaryCard` wraps the entire row in one `<Link>` — a naive row-action button will trigger navigation

**What goes wrong:** Adding a button inside the existing `<Link href={...}><div>...</div></Link>` structure without `e.stopPropagation()` navigates to `/activity/[completionId]` on every click, including clicks meant for "I observed this."
**Why it happens:** The whole card is the click target by design (click row → detail page).
**How to avoid:** Follow the exact precedent already logged for this exact failure mode: `StepPhotoZone` click handlers call `e.stopPropagation()` to prevent the parent step-toggle from firing (see CLAUDE.md § Phase 04 Learnings). Apply the same to the new row action button, or restructure the row so the action sits outside the `<Link>` boundary (e.g. `<Link>` wraps only the text content, action button is a sibling).
**Warning signs:** Clicking "I observed this" navigates away instead of opening the modal.

### Pitfall 4: `current_user_role()`/`current_organisation_id()` read from JWT claims, not live DB state

**What goes wrong:** If a supervisor's role is changed mid-session (e.g. demoted), the RLS insert policy still sees their OLD role until they get a fresh JWT (next login or refresh-token rotation) — because both helper functions read `auth.jwt() ->> 'user_role'` / `'organisation_id'`, not `organisation_members` live.
**Why it happens:** By design (documented in `00001_foundation_schema.sql`) — this is the standard custom-access-token-hook pattern, not a bug, and every other append-only table in this codebase (`sop_review_events`, `sop_completions`) already accepts this same staleness window.
**How to avoid:** No action needed for this phase — this is pre-existing, accepted, project-wide behavior, not a new risk introduced by observations. Just don't be surprised if a manual test right after a role change behaves unexpectedly; document it as "expected, same as every other RLS-gated table" if it comes up in verification.

### Pitfall 5: `requireAdminContext()` looks reusable but silently excludes supervisors

**What goes wrong:** A planner/executor sees `requireAdminContext()` already exists and reaches for it in `observations.ts`, then discovers supervisors (D-04's primary intended recorder) get "Admin access required" errors.
**Why it happens:** `requireAdminContext()` hardcodes `['admin', 'safety_manager']` — it was built for admin-only surfaces and has ~8+ existing callers depending on that exact exclusion.
**How to avoid:** Do not touch `requireAdminContext()`. Use Pattern 2 (inline `getSessionContext()` + local role array) exactly as `signOffCompletion` and `escalation.ts::authOrg()` already do for supervisor-inclusive actions.

## Code Examples

### Full server action shape (mirrors `signOffCompletion` + `sop_review_events` RLS)

```typescript
// Source: pattern composed from src/actions/completions.ts (role check + org guard)
// and supabase/migrations/00043_ownership_review_governance.sql (RLS insert shape)
'use server'
import { getSessionContext } from '@/lib/auth/session-context'
import { RecordObservationSchema } from '@/lib/validators/observations'

export async function recordObservation(rawInput: unknown) {
  const parsed = RecordObservationSchema.safeParse(rawInput)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!role || !['supervisor', 'admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'Only supervisors, admins and safety managers can record observations.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const { workerId, sopId, verdict, note, completionId } = parsed.data

  // Server-resolved SOP version — never client-supplied (D-10)
  const { data: sop, error: sopError } = await supabase
    .from('sops').select('version').eq('id', sopId).single()
  if (sopError || !sop) return { success: false, error: 'SOP not found.' }

  // Session client — RLS policy (org + role + observed_by=auth.uid()) is the
  // safety mechanism here, no admin client / manual org-scope check needed (D-12).
  const { error } = await supabase.from('sop_observations').insert({
    organisation_id: organisationId,
    sop_id: sopId,
    sop_version: sop.version,
    observed_worker_id: workerId,
    observed_by: userId,
    verdict,
    note: note ?? null,
    completion_id: completionId ?? null,
  })

  if (error) {
    console.error('recordObservation insert error:', error)
    return { success: false, error: 'Failed to record observation.' }
  }
  return { success: true as const }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Worker-initiated evidence only (walkthrough completion = self-attested) | Supervisor-initiated evidence (observation = witness-attested) | Phase 34 (this phase) | Directly closes Visy's #1 named pain (shared/fraudulent sign-offs) — the first record type in SOPstart that cannot be faked by two workers sharing a device |
| Two-state competency (read / not-read) | Three-state signal feeding a future four-state competency machine (Phase 35) | Phase 34 lays the data; Phase 35 derives state | Observations become the "missing middle" evidence between read and signed-off |

**Deprecated/outdated:** None — this is additive infrastructure, nothing in the existing schema or UI is replaced or removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Table name `sop_observations` and column names (`observed_worker_id`, `observed_by`, `verdict`, `sop_version`, `completion_id`) are Claude's-discretion naming, not locked by CONTEXT.md | Architecture Patterns, Code Examples | Low — CONTEXT.md explicitly delegates "table/column naming, exact migration shape" to Claude's discretion; any reasonable naming satisfies the requirement, but the planner should pick one name and use it consistently across migration/action/component files |
| A2 | `organisations.observation_labels` (jsonb) is the right shape for D-02's per-org renamable verdict labels, versus a dedicated settings table | Don't Hand-Roll | Low-medium — CONTEXT.md explicitly says "org verdict labels live on organisations or a settings table" is Claude's discretion; jsonb column is the lighter option and matches the org-singleton nature of the data (not per-category like `sop_review_cadences`), but a planner could reasonably choose the settings-table route instead |
| A3 | Worker self-read via `observed_worker_id = auth.uid()` OR-branch in the SELECT policy is necessary in addition to the org-scope branch | Pattern 1 | Low — without this OR-branch, a worker's `current_user_role()` JWT claim would need to already grant read access, which it doesn't for a plain `worker` role under the org-scope-only policies used by `sop_review_events` (that table is never read by workers). This is a genuinely new requirement (OBS-02) not present in any of the three precedent tables, so it is reasoned from first principles rather than copied — flag for planner confirmation that the policy correctly covers "worker reads about themself" without also allowing a worker to read a *different* worker's observations under the `observed_worker_id` branch (which it does not — the OR only matches when the row's own worker id equals the caller) |

## Open Questions

1. **Where does the SOP picker's "worker's required SOPs listed first" (D-06) source its required-SOPs list from?**
   - What we know: The codebase has at least two overlapping "what SOPs does this worker need" data sources — the legacy `sop_assignments` table (`src/actions/assignments.ts`, used by `useAssignedSops` on the worker side) and the newer Phase 32 `access_grants`/materialized `sop_departments` model (which Phase 35's MTX-02 requirement explicitly says is the intended source-of-truth: "Matrix derives requirements from access grants (materialized junctions)").
   - What's unclear: Whether Phase 34's SOP picker should query `sop_assignments` (simpler, already has a `getUserSopAssignments()`-style helper) or `access_grants`/`sop_departments` (architecturally consistent with where Phase 35 is heading, avoids building a second "required SOPs" query that Phase 35 would then have to reconcile against).
   - Recommendation: Use the same query the worker's own `/sops` library page already uses to determine "assigned to me" — whichever table that reads from is de facto correct today. Grep `src/hooks/useAssignedSops.ts` and `src/actions/assignments.ts` at plan time to confirm the current source of truth before choosing; do not introduce a third data source. This is a low-risk, easily-answered question deferred to planning rather than blocking research.

## Environment Availability

Skipped — no external dependencies (CLI tools, services, runtimes) are introduced by this phase. Everything runs on the already-configured Next.js + Supabase stack.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (source-contract + runtime specs), per project convention |
| Config file | `playwright.config.ts` — needs a new `phase34` project entry |
| Quick run command | `npx playwright test --project=phase34` |
| Full suite command | `npm run test` |

### Phase Requirement → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| OBS-01 | Supervisor/admin/safety_manager can record an observation (verdict + optional note) against a worker + SOP; role outside that set is rejected | source-contract + runtime (role gate) | `npx playwright test tests/phase34/record-observation.spec.ts` | ❌ Wave 0 |
| OBS-01 | Recorded observation is append-only — no UPDATE/DELETE path exists (RLS-level, not just UI-level) | source-contract (grep migration for absence of update/delete policy) + runtime (attempt update as authenticated, expect RLS denial) | `npx playwright test tests/phase34/observation-immutability.spec.ts` | ❌ Wave 0 |
| OBS-02 | Worker sees every observation about them (verdict, note, observer name, date, SOP version) on `/profile` | runtime (authenticated worker session reads own observations) | `npx playwright test tests/phase34/worker-observation-visibility.spec.ts` | ❌ Wave 0 |
| OBS-03 | Observation is linked to the worker's profile and stamped with `sop_version` at record time | runtime (insert then assert `sop_version` matches SOP's current version, not a stale/client value) | `npx playwright test tests/phase34/sop-version-stamp.spec.ts` | ❌ Wave 0 |
| Success Criterion 4 | Cross-org write/read isolation — an org-B supervisor cannot write an observation about an org-A worker; an org-B session cannot read org-A observations | runtime (two ephemeral orgs, cross-org write attempt expects RLS denial, cross-org read returns empty) | `npx playwright test tests/phase34/observation-cross-org-isolation.spec.ts` | ❌ Wave 0 |

**Runtime cross-org isolation test pattern:** Follow the exact precedent set in Phase 32-05 (`the [Phase 32-05] real runtime tests for cross-tenant write isolation ... use ephemeral throwaway orgs since createGrant/materializeSopAccess cannot be invoked directly outside a Next.js request scope and no UI wires grants.ts yet` — CLAUDE.md decision log) — spin up two throwaway orgs + two auth sessions (magic-link cookie install per the 2026-04-24 Learning), attempt the cross-org insert/read, assert RLS denial/empty-result rather than a 500. This is the only way to prove success criterion 4 at runtime given the RLS-only (no admin client) design in Pattern 1.

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase34`
- **Per wave merge:** `npm run test` (full suite, catches cross-phase regressions e.g. `/profile` page changes, org-model panel changes)
- **Phase gate:** Full suite green + a real `npm run build` (next build) before `/gsd-verify-work`, per the 2026-06-27 Learning that `tsc --noEmit` alone does not catch `next build`-only failures

### Wave 0 Gaps

- [ ] `tests/phase34/record-observation.spec.ts` — covers OBS-01 (role gate + happy path)
- [ ] `tests/phase34/observation-immutability.spec.ts` — covers OBS-01 (append-only)
- [ ] `tests/phase34/worker-observation-visibility.spec.ts` — covers OBS-02
- [ ] `tests/phase34/sop-version-stamp.spec.ts` — covers OBS-03 / D-10
- [ ] `tests/phase34/observation-cross-org-isolation.spec.ts` — covers success criterion 4 (the codebase's recurring write-hole class)
- [ ] `playwright.config.ts` — add `phase34` project with broad `testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/` registration (mirrors phase32/phase33 exactly; verify with `npx playwright test --list --project=phase34` before declaring Wave 0 done, per the 2026-05-25 Learning about unregistered specs never running)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | Yes (indirect) | `getSessionContext()` — locally-verified ES256 JWT (`getClaims()`), no new auth surface introduced |
| V3 Session Management | No | No session changes in this phase |
| V4 Access Control | Yes | RLS insert policy role-check (`current_user_role() in ('admin','safety_manager','supervisor')`) + `observed_by = auth.uid()` binding — this IS the primary control this phase must get right |
| V5 Input Validation | Yes | Zod schema (`RecordObservationSchema`) validates verdict enum, UUID shapes, note length cap before the insert; Postgres `check` constraint on `verdict` is defense-in-depth |
| V6 Cryptography | No | No new crypto surface |
| V13 API and Web Service | Yes (indirect) | Server action pattern, not a public REST route — no new attack surface beyond existing `'use server'` conventions |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Cross-tenant write (org-B supervisor writes an observation into org-A) | Tampering / Elevation of Privilege | RLS `with check (organisation_id = current_organisation_id())` — this is exactly the class of bug the codebase's own Learnings log 4+ times (2026-06-15, 2026-06-26 ×2, 2026-07-05); Pattern 1's RLS-only design removes the service-role bypass vector entirely for this table |
| Role spoofing at the client (a worker calls `recordObservation` directly bypassing UI) | Elevation of Privilege | Server-side role check in the action (belt) + RLS role check in the insert policy (suspenders) — both layers required; the RLS layer is the one that actually matters since a determined caller can skip the server action's check by hitting Supabase directly, but cannot forge a JWT role claim |
| Worker reads another worker's observations | Information Disclosure | SELECT policy's `observed_worker_id = auth.uid()` OR-branch only matches the caller's OWN id — verify at plan/test time this does not accidentally become `observed_worker_id = ANY(...)` or similarly widened |
| Note field XSS/injection (free-text note visible to the worker) | Tampering | Standard React JSX auto-escaping on render (no `dangerouslySetInnerHTML`); no special handling needed beyond not introducing raw HTML rendering for the note field |
| Immutability bypass via a future "edit" feature request | Repudiation | No UPDATE/DELETE RLS policy is a hard DB-level guarantee — any future edit/delete UI would require a new migration explicitly adding a policy, making the trade-off visible and reviewable rather than silently possible |

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/00043_ownership_review_governance.sql` — direct read of the exact append-only RLS pattern to copy (§ sop_review_events)
- `supabase/migrations/00001_foundation_schema.sql` — `current_organisation_id()`/`current_user_role()` helper function definitions (JWT-claim-based, security definer)
- `src/actions/completions.ts` — direct read of `signOffCompletion` (role-array check pattern) and `recordSignature` (admin-client + manual org-scope self-enforcement pattern, used here as the "what NOT to need" contrast)
- `src/actions/escalation.ts` — `authOrg()` helper, confirms the `getSessionContext()` + inline check idiom is an established (not one-off) pattern
- `src/lib/auth/session-context.ts`, `src/lib/auth/guards.ts` — direct read confirming `requireAdminContext()` excludes `supervisor` and cannot be reused unmodified
- `src/components/admin/org-model/OrgColumnsBoard.tsx`, `.../OrgChartCanvas.tsx` (grep) — confirmed no existing person-chip click handler
- `src/components/activity/CompletionSummaryCard.tsx` — confirmed the whole card is one `<Link>`, no inner interactive slot
- `src/app/(protected)/profile/page.tsx`, `src/app/(protected)/admin/team/page.tsx` — confirmed current server-component shape both new sections attach to
- `sketches/supervisor-observations/index.html` — approved design reference (sections 01-04 locked per CONTEXT.md canonical_refs)
- `.claude/skills/sketch-findings-SOPstart/references/design-tokens.md`, `.../layout-primitives.md`, `.../org-model-views.md` — token/primitive verification
- `src/styles/blueprint-theme.css`, `src/app/globals.css` (grep) — confirmed which sketch CSS custom properties ARE and are NOT defined in the app (caught the `--brand-yellow` gap directly)
- `.planning/phases/34-supervisor-observations/34-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked decisions and requirement IDs
- `playwright.config.ts` (grep) — confirmed the `tests/phaseNN/**` broad-regex registration convention used by phase28-33

### Secondary (MEDIUM confidence)

- `src/actions/assignments.ts`, `src/hooks/useAssignedSops.ts` (grep only, not fully read) — confirms `sop_assignments` exists as a candidate data source for the SOP-picker's "required SOPs first" ordering; full reconciliation against the Phase 32 `access_grants` model left as an Open Question for planning

### Tertiary (LOW confidence)

None — every claim in this research is either directly read from the codebase or cited from an in-repo CONTEXT.md/skill document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, entirely composed from already-verified existing patterns
- Architecture: HIGH — three working precedent tables read directly, exact SQL/TS patterns extracted
- Pitfalls: HIGH — all five pitfalls verified by direct grep/read against the live codebase (not inferred), including one genuinely new finding (undefined `--brand-yellow` in the sketch)

**Research date:** 2026-07-20
**Valid until:** 2026-08-19 (30 days — stable internal-pattern research, no external API/library surface to go stale)
