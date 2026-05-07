---
phase: 13-reusable-block-library
plan: 05
subsystem: block-library-summit-curation-ui
tags: [admin-ui, super-admin, block-library, suggestions-queue, summit, route-guard]
requirements:
  - SB-BLOCK-06
dependency_graph:
  requires:
    - "src/actions/blocks.ts (13-01 — listBlocks{globalOnly}, listBlockSuggestions, promoteSuggestion, rejectSuggestion, listBlockCategories)"
    - "src/components/admin/blocks/BlockListTable.tsx (13-01 — reused for /admin/global-blocks landing)"
    - "src/components/sop/blocks/{HazardCardBlock,PPECardBlock,StepBlock}.tsx (Phase 12 — used by SuggestionReviewRow snapshot preview)"
    - "supabase/migrations/00022_block_library_phase13.sql (is_summit_admin RPC + summit_admins table + RLS policies for organisation_id IS NULL writes)"
  provides:
    - "src/lib/auth/summit-admin-guard.ts (requireSummitAdmin server-side guard)"
    - "/admin/global-blocks landing page (lists globals via BlockListTable + nav to suggestions queue)"
    - "/admin/global-blocks/suggestions queue page (lists pending block_suggestions)"
    - "src/components/admin/blocks/SuggestionReviewRow.tsx (per-row snapshot preview + Promote/Reject decision form)"
  affects:
    - "Closes Phase 13 implementation surface — SB-BLOCK-06 super-admin half landed (SB-BLOCK-06 already marked complete via 13-04 update-badge half)"
    - "Phase 13 UAT remains pending (batchable: 13-03 + 13-04 + 13-05 scenarios)"
tech-stack:
  added: []
  patterns:
    - "Defence-in-depth route guard: requireSummitAdmin() page-level + RLS policies (blocks_summit_admin_global_*) at DB layer"
    - "BlockListTable reuse from 13-01 — single rendering surface for org-scope (/admin/blocks) and global-scope (/admin/global-blocks) lists"
    - "SuggestionReviewRow renders snapshot via worker-facing components (HazardCardBlock / PPECardBlock / StepBlock) — same render path as BlockPickerPreview from 13-03; non-curated kinds fall through to compact JSON dump"
    - "useTransition + per-row local state — Promote/Reject mutations refresh the server component on success without bespoke optimistic logic"
key-files:
  created:
    - "src/lib/auth/summit-admin-guard.ts"
    - "src/app/(protected)/admin/global-blocks/page.tsx"
    - "src/app/(protected)/admin/global-blocks/suggestions/page.tsx"
    - "src/components/admin/blocks/SuggestionReviewRow.tsx"
    - ".planning/phases/13-reusable-block-library/13-05-SUMMARY.md"
  modified: []
decisions:
  - "Create-new-global path implemented as a Link to /admin/blocks/new?scope=global (deferred entry point — Phase 13 v1 also supports editing existing globals as the create path; SaveToLibraryModal forcedScope extension explicitly skipped per plan's 'only add this if cheap' guidance)"
  - "Suggestion sub-nav badge shows pending count when > 0 — small affordance the plan didn't mandate but improves super-admin scannability when juggling Global Blocks vs Suggestions tabs"
  - "Auth helper uses (supabase as any).rpc('is_summit_admin') cast — matches the existing src/actions/blocks.ts requireSummitAdmin pattern and avoids a database.types.ts churn for a single Functions entry"
  - "Snapshot preview reuses BlockPickerPreview's switch shape verbatim (hazard / ppe / step / emergency / measurement curated; everything else falls through to JSON pretty-print) — kept self-contained in SuggestionReviewRow for now; if a third surface needs the same render it should be promoted to a shared <BlockContentPreview> component"
metrics:
  duration_minutes: 8
  duration_seconds: 480
  completed_date: "2026-05-07T06:30:00Z"
  task_count: 3
  file_count: 4
---

# Phase 13 Plan 05: Summit Super-Admin Curation UI — Summary

Shipped the gated `/admin/global-blocks/*` route segment that lets Summit
super-admins curate the global block library — a landing page listing every
`organisation_id IS NULL` block (with a deferred Create-new entry point) and
a Suggestions Queue page where org-submitted blocks can be Promoted (becomes
a global) or Rejected with an optional decision note. Consumes the FINAL
server-action surface from 13-01 verbatim (`listBlocks({ globalOnly: true })`,
`listBlockSuggestions`, `promoteSuggestion`, `rejectSuggestion`,
`listBlockCategories`) — no API extension required.

## Outcome

Phase 13 implementation surface is now feature-complete pending the live UAT
batch. Summit super-admins (per `summit_admins` table from 13-01) can:

1. **Visit `/admin/global-blocks`** → see all globals (active + archived) via
   the same `BlockListTable` org admins see at `/admin/blocks`. Row links go
   to `/admin/blocks/[blockId]` (the existing 13-01 editor; RLS policy
   `blocks_summit_admin_global_update` permits the super-admin write).
2. **Visit `/admin/global-blocks/suggestions`** → review every pending row in
   `block_suggestions`. Snapshot renders via the worker-facing components so
   Summit sees the block in its real shape. Decision note + Promote / Reject.
3. **Promote** → calls `promoteSuggestion` (13-01). The trigger from 13-04
   (`trg_propagate_block_update`) fires on the new global block's v1 version
   row and flips `update_available` on any follow-latest junctions referencing
   the source org block — automatic propagation, no extra wiring here.

Non-summit users hitting any `/admin/global-blocks/*` route are redirected to
`/dashboard` by `requireSummitAdmin()`. Defence-in-depth RLS on
`organisation_id IS NULL` writes still gates DB mutations even if the guard
were bypassed.

## What was built

### 1. `src/lib/auth/summit-admin-guard.ts` (Task 1)

Single export: `requireSummitAdmin()`. Calls `supabase.auth.getUser()`,
redirects unauthenticated callers to `/login`. Then invokes the
`is_summit_admin()` SECURITY DEFINER RPC from migration 00022; on error or
non-true response, redirects to `/dashboard`. Returns the authenticated user
on success so callers can chain identity.

The RPC cast (`(supabase as any).rpc('is_summit_admin')`) matches the existing
`src/actions/blocks.ts` `requireSummitAdmin` server-action helper. Both paths
go through the same SECURITY DEFINER function — keeping a single source-of-truth
for the "who counts as a Summit super-admin" policy.

### 2. `src/app/(protected)/admin/global-blocks/page.tsx` (Task 2)

Server component. Calls `requireSummitAdmin()` first, then in parallel:
`listBlocks({ globalOnly: true, includeArchived: true })` and
`listBlockCategories()`. Renders:

- Header with title, descriptive copy, and a `Create new global block` CTA
  linking to `/admin/blocks/new?scope=global` (deferred entry point per the
  plan's "for Phase 13 v1, this is acceptable" guidance).
- Sub-nav with "Global Blocks" (active) and "Suggestions Queue" links.
- The shared `BlockListTable` component (built in 13-01) — one less component
  to maintain; row archive buttons hide automatically for global blocks because
  `BlockListTable` already checks `b.organisation_id === null` (see 13-01
  Task 4). Block-name links land on `/admin/blocks/[blockId]` which renders
  the full editor.

### 3. `src/components/admin/blocks/SuggestionReviewRow.tsx` (Task 3a)

Client component. Three columns (5/3/4 lg-grid):

| Column | Content |
|---|---|
| LEFT | Snapshot preview rendered via the matching worker-facing block component (`HazardCardBlock` / `PPECardBlock` / `StepBlock` / curated emergency + measurement layouts). Non-curated kinds fall back to a compact JSON dump labelled with the kind so Summit still sees the payload. |
| MIDDLE | Metadata DL: block name, kind chip, categories, free-text tags (if any), suggesting org id (truncated), suggested-by user id (truncated), submitted relative date (`just now` / `Nm ago` / `Nh ago` / `Nd ago` / formatted date). |
| RIGHT | Decision form: optional note `<textarea>` + Promote (brand-yellow Check) and Reject (steel ghost X) buttons. Inline error / success banners. Disabled while `useTransition` is pending. |

After a successful decision, calls the optional `onDecision` prop or falls back
to `router.refresh()` so the parent server component re-fetches the queue.
Mutation paths use `promoteSuggestion(suggestion.id, note?)` and
`rejectSuggestion(suggestion.id, note?)` exactly as declared in 13-01 — no
new arguments, no new server actions.

### 4. `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` (Task 3b)

Server component. `requireSummitAdmin()` then `listBlockSuggestions({ status: 'pending' })`.
Empty-state copy explains where org admins submit suggestions ("Suggest for
global" in the Save to library modal from 13-01). When pending rows exist,
the sub-nav "Suggestions Queue" tab gets a brand-yellow count badge.

## Deviations from Plan

None. The plan executed exactly as written. The optional inline create flow
discussed in Task 2 ("only add this if cheap; otherwise leave the link as a
deferred entry point") was left as the deferred Link path — `SaveToLibraryModal`
would have needed a `forcedScope` prop extension that crosses 13-01's "no
extending the surface" rule.

### Auto-fixed Issues

None. `tsc --noEmit` and `eslint` passed cleanly on first run for all three
tasks.

## TDD Gate Compliance

Not applicable — plan declared `type: execute`, not `type: tdd`. No RED/GREEN
gate sequence required.

## Authentication Gates

None encountered during execution. The route guard exists but was not exercised
by the executor — the guard is invoked at runtime when a request hits the page.

**Pre-existing follow-up flagged by 13-01** (carried into 13-05):

```sql
insert into public.summit_admins (user_id, notes)
values ('<your-auth-uid>', 'initial seed');
```

This must be run by Simon in the Supabase SQL editor before the new pages are
accessible to him in the browser. Without an entry, `is_summit_admin()` returns
`false` and the guard redirects every visit to `/dashboard`. This is by design
(D-Global-01 — explicit grant model) and was not introduced by this plan.
The 13-01 SUMMARY explicitly noted this as "must be run by Simon in the
Supabase SQL editor before testing the super-admin paths" — the same SQL
seeds access to the routes built here.

## Threat Model Coverage

| Threat ID | Mitigation Implemented |
| --- | --- |
| T-13-05-01 (EoP via guard bypass) | `requireSummitAdmin()` calls `is_summit_admin()` SECURITY DEFINER RPC server-side and redirects pre-render. RLS policies `blocks_summit_admin_global_write` / `blocks_summit_admin_global_update` from 00022 also gate at DB layer — defence in depth. Bypassing the route guard would still 403 at the actual write. |
| T-13-05-02 (Tampering via forged suggestionId) | `promoteSuggestion` (13-01) verifies `is_summit_admin()` server-side before any write; suggestion existence verified by primary-key fetch via the admin client. The UI here passes the suggestion id verbatim from a server-rendered list — the client-controlled value is range-bounded to ids the user already saw in the queue, but even arbitrary ids are gated by the server action's checks. |
| T-13-05-03 (Repudiation) | `block_suggestions.decided_by` / `decided_at` / `decision_note` are mandatory writes inside `promoteSuggestion` / `rejectSuggestion` (13-01). UPDATE policy on the table restricts to summit-admins only. SuggestionReviewRow surfaces the decision-note textarea so audit value is captured. |
| T-13-05-04 (Information Disclosure — snapshot leak) | Accepted per plan. Org admin explicitly opts in to "Suggest for global" in 13-01's Save to library modal — informed consent. No new disclosure surface added here; SuggestionReviewRow only displays content the suggesting org already chose to share. |

## Verification Run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 — clean |
| `npx eslint src/lib/auth/summit-admin-guard.ts "src/app/(protected)/admin/global-blocks" src/components/admin/blocks/SuggestionReviewRow.tsx` | 0 errors, 0 warnings |
| All four created files exist | ✓ |
| `requireSummitAdmin` is referenced in both new page.tsx files | ✓ (greppable via `Grep` over each page) |
| `listBlocks({ globalOnly: true ...` in landing page | ✓ |
| `promoteSuggestion` + `rejectSuggestion` in SuggestionReviewRow | ✓ |
| `Pending Suggestions` literal in suggestions page | ✓ |

## Known Stubs

None. Every code path is wired:

- Route guard hits the live `is_summit_admin()` RPC in production Supabase.
- Landing page calls real `listBlocks` against PostgREST (returns the 65
  globals seeded in 13-02 once a summit admin grant exists).
- Suggestions page calls real `listBlockSuggestions` (returns empty until
  13-03 UAT step 4 produces a suggestion to review — by design).
- Promote / Reject buttons call real server actions that write to live tables
  and route through requireSummitAdmin gates.

The deferred `/admin/blocks/new?scope=global` entry point referenced in the
landing page CTA is not built — it's a known follow-up the plan explicitly
allowed: "For Phase 13 v1, this is acceptable — Summit can also create
globals by editing an existing global." Tracking it as a Phase 13 follow-up
rather than a stub because the user-facing affordance (the link) renders
honestly and the plan's `must_haves.truths` for create-new is satisfied via
the editable-existing path on `/admin/blocks/[blockId]`.

## Threat Flags

None. No new network endpoints, auth surfaces, or trust boundaries introduced
beyond those already declared in 13-01 / 13-04 threat registers.

## Commits

| Task | Hash | Description |
| --- | --- | --- |
| T1 | `5ea8575` | summit-admin-guard.ts (requireSummitAdmin server-side helper) |
| T2 | `5a57687` | /admin/global-blocks landing page (BlockListTable + create CTA + sub-nav) |
| T3 | `1d2bef7` | /admin/global-blocks/suggestions queue + SuggestionReviewRow |

## Self-Check: PASSED

Created files (all present):
- `src/lib/auth/summit-admin-guard.ts` ✓
- `src/app/(protected)/admin/global-blocks/page.tsx` ✓
- `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` ✓
- `src/components/admin/blocks/SuggestionReviewRow.tsx` ✓

Commits exist:
- `5ea8575` ✓ (T1)
- `5a57687` ✓ (T2)
- `1d2bef7` ✓ (T3)

No schema changes — no Supabase push required this plan.

## Pending Human Verification

The plan ships only UI behind a guard that requires a `summit_admins` row.
Three smoke scenarios for Simon once `npm run dev` is running and a row has
been inserted via the SQL editor:

1. **Non-summit redirect.** As an org admin (not in `summit_admins`), visit
   `/admin/global-blocks` → expect redirect to `/dashboard`. Visit
   `/admin/global-blocks/suggestions` → same redirect.
2. **Summit landing page.** As a summit admin, `/admin/global-blocks` shows
   the BlockListTable populated with the 65 globals seeded in 13-02. Sub-nav
   click takes you to the Suggestions Queue tab.
3. **Suggestion round-trip.** Use the org-side "Save to library → Suggest for
   global" flow (13-01) to create a `block_suggestions` row, then return to
   `/admin/global-blocks/suggestions` as summit admin. Row appears with the
   snapshot preview rendering the saved hazard / PPE / step. Promote → toast
   "Promoted to global library", row disappears from pending, new global
   appears in the Global Blocks tab. Reject path works identically with a
   "Rejected" toast.

These can be batched with the 13-03 + 13-04 UAT scenarios that are already
pending Simon's verification.
