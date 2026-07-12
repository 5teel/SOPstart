---
phase: 28-ownership-review-lifecycle-governance-queue
reviewed: 2026-07-12T00:00:00Z
depth: deep
files_reviewed: 20
files_reviewed_list:
  - supabase/migrations/00043_ownership_review_governance.sql
  - scripts/backfill-owner-review.mjs
  - src/types/database.types.ts
  - src/types/sop.ts
  - src/lib/governance/classify.ts
  - src/lib/governance/cadences.ts
  - src/actions/governance.ts
  - src/app/api/sops/[sopId]/publish/route.ts
  - src/app/(protected)/admin/governance/page.tsx
  - src/components/admin/governance/GovernanceFilterChips.tsx
  - src/components/admin/governance/GovernanceQueueRow.tsx
  - src/components/admin/governance/OwnerPicker.tsx
  - src/components/admin/governance/GovernanceWidget.tsx
  - src/app/(protected)/admin/sops/page.tsx
  - src/components/admin/sops/LibraryReviewCell.tsx
  - src/components/sop/tabs/OverviewTab.tsx
  - src/lib/journeys/journeys.ts
findings:
  critical: 0
  high: 1
  medium: 1
  low: 5
  total: 7
status: fixed
fixed_at: 2026-07-12
outcomes:
  HR-01: fixed        # migration 00044 (sop_review_cadences + ai_model_settings RLS -> current_organisation_id()); applied live + recorded in schema_migrations
  MR-01: fixed        # publish route short-circuits 409 when no draft row transitioned
  LR-01: fixed        # setSopOwner returns { error } on 0-row update
  LR-02: fixed        # computeReviewDueDate clamps end-of-month drift (UTC-deterministic) + unit cases
  LR-03: fixed        # unused now? param dropped
  LR-04: skipped      # intentional: setReviewCadence is the API surface for the deliberately-deferred cadence-config UI; action is correct, no caller by design
  LR-05: fixed        # governance page admin check now org-scoped via JWT org claim
---

# Phase 28: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** deep
**Files Reviewed:** 20
**Status:** fixed (2026-07-12 — HR-01/MR-01/LR-01/LR-02/LR-03/LR-05 fixed; LR-04 skipped as intentional)

## Summary

Reviewed the Phase 28 ownership + review-lifecycle + governance-queue change set against this project's recurring bug classes (cross-tenant holes, RLS posture, JWT handling, `'use server'` constraint, handler wiring, worker north-star, null/date math, backfill safety, trigger correctness).

**The good news on the priority lenses:**
- **Cross-tenant:** `setSopOwner`, `confirmSopCurrent`, and `setReviewCadence` all source org from JWT via `parseJwtPayload` (no raw `atob`), never a parameter. `setReviewCadence` uses service-role and self-enforces org. `sop_review_events` insert RLS enforces `organisation_id = current_organisation_id()` + role + `reviewed_by = auth.uid()`. No parameter-trusting exposed RPCs added (no `SECURITY DEFINER` functions accept an org param — the trigger derives from row data only).
- **Trigger:** `default_sop_owner` is BEFORE INSERT, only fires when `owner_user_id IS NULL`, never overrides an explicit owner, and does not break inserts when `uploaded_by` is null (owner just stays null). Correct.
- **North-star:** No worker route gates on `review_due_at`/ownership. `OverviewTab` shows "Current as of" as plain informational text; the only overdue badge lives in `LibraryReviewCell` (admin library). Confirmed via grep of `src/app/(protected)/sops`, `src/components/sop`, `src/hooks`.
- **Wiring:** Every affordance is really wired — `GovernanceQueueRow` → `confirmSopCurrent`, `OwnerPicker` → `setSopOwner`, `LibraryReviewCell` → `confirmSopCurrent`, filter chips deep-link with real routes. No empty `onClick` (the 2026-06-05 class).
- **Backfill:** Idempotent, per-row conditional patch, no null-clobber; reads cadences via service-role (bypasses the RLS bug below).

**The one that matters:** migration 00043 reintroduces the exact `app_metadata` JWT-path mistake that migration 00015 was written to fix, silently defeating org-configured review cadences on every session-client read path. Details below.

## High

### HR-01: `sop_review_cadences` SELECT policy uses the broken `app_metadata` JWT path — org cadences are silently ignored

**File:** `supabase/migrations/00043_ownership_review_governance.sql:70-72`
**Issue:** The read policy is:
```sql
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select
  using (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);
```
This project's custom access-token hook (`00001_foundation_schema.sql:85-95`) injects `organisation_id` at the **top level** of the JWT claims, **not** under `app_metadata`. Migration `00015_fix_video_gen_rls.sql` was written specifically to fix this exact pattern, and its header says: *"migration 00013 used `auth.jwt()->'app_metadata'->>'organisation_id'` which doesn't match the project's JWT shape (claims are at the top level via custom auth hook)."* Every other table uses `public.current_organisation_id()`.

Consequence: `app_metadata.organisation_id` is null for this project's JWTs, so the policy predicate is `organisation_id = NULL` → **never matches** → the policy returns zero rows for authenticated session-client reads. The two real readers both use the session client (`createClient()`), not service-role:
- `src/actions/governance.ts:69-87` `fetchOrgCadences()` — returns `{}` → `resolveCadenceMonths` always falls back to the 12-month default.
- `src/app/api/sops/[sopId]/publish/route.ts:135-144` — cadence read returns nothing → same 12-month default on every publish review-clock reset.

Net effect: any org that configures a non-default cadence via `setReviewCadence` (which writes fine via service-role) will have that setting **silently ignored** — every SOP resolves to 12 months. This is the reason `ai_model_settings` (00042) copied the same broken predicate without symptoms: it is only ever read/written via **service-role** (`createAdminClient`), which bypasses RLS. `sop_review_cadences` is read via the **session client**, so the bug bites.

**Fix:** Use the project-standard helper, matching 00015:
```sql
drop policy if exists sop_review_cadences_read_org on public.sop_review_cadences;
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
```
Ship as a follow-up migration (00044) since 00043 is already live. Also fix the identical predicate in `00042_ai_model_settings.sql` opportunistically to stop the copy-paste from spreading further.

## Medium

### MR-01: Publish route stamps review-clock + inserts a `superseded` audit event even when the publish was a no-op

**File:** `src/app/api/sops/[sopId]/publish/route.ts:108-171`
**Issue:** Step 3 publishes with `.eq('id', sopId).eq('status', 'draft')`. Updating 0 rows (e.g. the SOP is already `published`) is **not** a Postgres/PostgREST error, so `publishError` is null and execution falls through to step 3b unconditionally. Step 3b then:
1. Bumps `review_due_at` + `last_reviewed_at = now()` on the already-published row (resets the review clock without any actual review), and
2. If `parent_sop_id` is set, inserts a `sop_review_events` `'superseded'` audit row.

The route's own comment acknowledges a client "could still POST directly", so a duplicate/replayed publish POST corrupts the audit trail with a false `superseded` event and falsely marks the SOP as just-reviewed. Because `sop_review_events` is append-only (no delete policy), the bogus audit row is permanent.

**Fix:** Gate step 3b (and 4/5) on the publish actually having transitioned a draft. Add `.select('id')` to the step-3 update and short-circuit when nothing changed:
```ts
const { data: publishedRows, error: publishError } = await supabase
  .from('sops')
  .update({ status: 'published', published_at: ..., updated_at: ... })
  .eq('id', sopId)
  .eq('status', 'draft')
  .select('id')
if (publishError) return NextResponse.json({ error: 'Failed to publish SOP' }, { status: 500 })
if (!publishedRows || publishedRows.length === 0) {
  return NextResponse.json({ error: 'SOP is not a draft' }, { status: 409 })
}
// ...only now run 3b review-clock reset + superseded event
```

## Low

### LR-01: `setSopOwner` reports `success` on a no-op update (cross-org / missing SOP)

**File:** `src/actions/governance.ts:119-129`
**Issue:** The update `.eq('id', sopId)` has no `.select()` and no rowcount check. If `admins_can_update_sops` RLS filters the row out (SOP belongs to another org, or the id doesn't exist), the update touches 0 rows, returns `error: null`, and the action returns `{ success: true }`. RLS correctly prevents any cross-tenant write (no security hole), but the caller (`OwnerPicker`) then shows success and calls `router.refresh()`, misleading the admin into thinking ownership changed. Only reachable with a hand-crafted `sopId` the UI never sends, hence Low.
**Fix:** `.select('id')` on the update and return `{ error: 'SOP not found' }` when no row was updated.

### LR-02: `computeReviewDueDate` day-overflow drift on short target months

**File:** `src/lib/governance/cadences.ts:25-29`
**Issue:** `base.setMonth(base.getMonth() + months)` overflows when the target month has fewer days than the base day. Confirming a SOP on Aug 31 with a 6-month cadence yields Feb 31 → JS rolls forward to Mar 3, so the due date drifts +2/3 days (and lands in the wrong month). Harmless for the common 12-month cadence (day is preserved) but wrong for odd cadences off month-ends. No test covers this (`cadences.ts` has no unit test).
**Fix:** Clamp to end-of-month after the shift, or accept the drift with a `// ponytail:` note. Minimal clamp:
```ts
const base = new Date(baseIso)
const targetDay = base.getDate()
base.setDate(1)
base.setMonth(base.getMonth() + months)
base.setDate(Math.min(targetDay, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()))
```
Add one assert-based self-check (Aug 31 + 6mo stays in Feb).

### LR-03: `computeReviewDueDate` has an unused `now?` parameter

**File:** `src/lib/governance/cadences.ts:25`
**Issue:** `export function computeReviewDueDate(baseIso: string, months: number, now?: Date)` — `now` is never referenced in the body. Dead parameter (likely a copy of `classifyGovernanceRow`'s testability seam that isn't needed here).
**Fix:** Drop the `now?` parameter.

### LR-04: `setReviewCadence` is exported but has no caller / no UI

**File:** `src/actions/governance.ts:200-234`
**Issue:** `grep` finds no invocation of `setReviewCadence` anywhere in `src/` outside its definition — the cadence-settings UI isn't in this phase. The write path itself is correct (service-role, org from JWT, `1..120` validation), but combined with HR-01 the feature is doubly non-functional today (write works, session-client read can't see the result). Fine as a staged action if the cadence UI is a known follow-up; flagging so it isn't forgotten.
**Fix:** None required now; ensure the cadence-settings UI plan lands with HR-01 fixed, or mark the export deferred.

### LR-05: Governance page admin check uses `.maybeSingle()` without an org filter

**File:** `src/app/(protected)/admin/governance/page.tsx:23-31`
**Issue:** The role lookup filters `organisation_members` by `user_id` only and calls `.maybeSingle()`. For a user who is a member of more than one org, PostgREST returns multiple rows and `.maybeSingle()` errors → `member` is null → the admin is bounced to `/dashboard`. Consistent with the app's single-org-per-user assumption, so Low, but brittle if multi-org membership is ever introduced. (The real authorization gate is `requireAdmin()` inside `listGovernanceQueue`, which is JWT-based — this page-level check is belt-and-suspenders.)
**Fix:** Filter by the JWT org (or accept the single-org assumption explicitly with a comment).

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
