---
phase: 28-ownership-review-lifecycle-governance-queue
verified: 2026-07-12T18:00:00Z
status: human_needed
score: 12/12 must-haves verified (1 warning noted below on REV-01 depth)
overrides_applied: 0
gaps: []
human_verification:
  - test: "Visual/UAT pass on sopstart.com: open /admin/governance, confirm filter chips + row actions render correctly and Confirm current / Assign owner / Fix assignment all resolve without error against live data"
    expected: "Queue renders classified rows, one action per row works end-to-end in the browser (not just source-contract)"
    why_human: "Real-time UI behavior, click-through UX, and live-Supabase interaction can't be fully proven by grep/unit tests alone — Railway-only-testing convention (this project never runs local Playwright browser E2E; UAT happens post-deploy)"
  - test: "Confirm the 3 carried test.fixme cross-org write-isolation cases (setSopOwner/confirmSopCurrent/setReviewCadence) against live Supabase with two seeded orgs, per the inline Steps docs in tests/phase28/governance-actions.spec.ts"
    expected: "Org A admin cannot write/read Org B governance data on any of the three actions"
    why_human: "Requires live two-org Supabase session per Railway-only-testing convention (phase27 precedent); accepted as documented deviation per verification rules"
---

# Phase 28: Ownership + Review Lifecycle + Governance Queue Verification Report

**Phase Goal:** Every SOP displays a single accountable owner and a review-due date — both auto-backfilled with zero admin data-entry — and admins get one unified governance queue (due-soon / overdue / unowned / stale-role) with one-click actions; worker read/walkthrough access is never blocked by ownership or review state.

**Verified:** 2026-07-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every SOP has an owner, auto-backfilled with zero admin entry | ✓ VERIFIED | Live prod query: `total=23, owned=23`. `default_sop_owner()` trigger confirmed live via `pg_proc.prosrc` — sets `owner_user_id := uploaded_by` on every insert. |
| 2 | Every published SOP has a review-due date, auto-backfilled | ✓ VERIFIED | Live prod query: `total_published=5, review_due_published=5`. Backfill script executed 23/23 first run, 0/23 re-run (idempotent). |
| 3 | Governance queue classifies overdue/due_soon/unowned/stale_role correctly | ✓ VERIFIED | `classifyGovernanceRow` (`src/lib/governance/classify.ts`) implements all 4 branches; 10/10 unit tests green incl. co-occurring flags, null-guard on `departmentRenamedSinceReview`. |
| 4 | Admin gets ONE unified queue at `/admin/governance` with filter chips + one-click actions | ✓ VERIFIED | `src/app/(protected)/admin/governance/page.tsx` calls `listGovernanceQueue()`; `GovernanceFilterChips` (5 chips); `GovernanceQueueRow` renders exactly one wired primary action selected by flag priority (unowned→OwnerPicker, stale_role→Fix assignment link, else→real `confirmSopCurrent(row.id)` call). |
| 5 | Owner reassignment is ≤2 clicks and org-scoped | ✓ VERIFIED | `OwnerPicker.tsx`: click 1 opens popover (fetches `getOrgMembers()`), click 2 picks member → `setSopOwner`. `setSopOwner` verifies target `userId` is an `organisation_members` row in caller's org before writing; returns `{error}` on 0-row update (LR-01 fix confirmed in code). |
| 6 | Confirm-current is one click, audited, org-scoped | ✓ VERIFIED | `confirmSopCurrent` sets `last_reviewed_at`/`review_due_at`/`last_reviewed_by`, inserts `sop_review_events` `confirmed_current` row. Wired from both `GovernanceQueueRow` and `LibraryReviewCell`. |
| 7 | Worker routes NEVER gate on ownership/review state — one passive caption only | ✓ VERIFIED | `OverviewTab.tsx` renders exactly one `MetaRow label="Current as of"` — no conditional, no import of governance actions. Grep of `src/app/(protected)/sops/**` and `src/components/sop/**` for `review_due_at`/`owner_user_id` found zero gating hits (one unrelated `owner_user_id` hit is the Phase-25 **departments** table select, not sops). Source-contract spec asserts zero gate in worker walkthrough + detail routes. |
| 8 | Admin library shows owner + overdue badge + confirm-current + "Owned by me" filter | ✓ VERIFIED | `admin/sops/page.tsx` selects `owner_user_id, review_due_at`; `?owner=me` → real `.eq('owner_user_id', user.id)`; `LibraryReviewCell` renders owner label + `isOverdue` guard + wired `confirmSopCurrent`. |
| 9 | Dashboard widget shows overdue/unowned/due-soon counts, deep-links to queue | ✓ VERIFIED | `GovernanceWidget.tsx` counts from `listGovernanceQueue()`, deep-links `/admin/governance?filter=overdue\|unowned\|due_soon`, mounted on `/admin/sops` header. |
| 10 | Stale-role detection on dangling department references (+ renamed-since-review) | ✓ VERIFIED | `listGovernanceQueue` LEFT-JOIN-style composition of `sop_departments`→`departments`; `danglingDepartmentRefs` (dept id not in org's dept map) and `departmentRenamedSinceReview` (guarded by `last_reviewed_at` null-check, closing plan-checker WARNING-1) both feed `classifyGovernanceRow`. Sub-trades correctly descoped per RESEARCH Pitfall 3. |
| 11 | `/admin/governance` mapped in journeys.ts (pathways coverage) | ✓ VERIFIED | `src/lib/journeys/journeys.ts:460` — `route: '/admin/governance'` present with description. |
| 12 | Review cadence resolves: per-SOP override > org category > 12-month default | ⚠️ PARTIAL (see warning below) | `resolveCadenceMonths` correctly implements the 3-tier precedence and is unit-tested (4/4 cases). **However**: no `sops` column stores a per-SOP override, no UI sets one, and `setReviewCadence` (the org-category-cadence writer) has zero callers anywhere in `src/` — so in the shipped product, every SOP resolves to the hardcoded 12-month default. The "per-category default cadence, overridable per SOP" wording in REQUIREMENTS.md REV-01 is not reachable by any admin today. This was flagged by the phase's own code review (LR-04) and marked "skipped: intentional" as a staged action for a future cadence-settings UI — but that is the reviewer's own judgment, not a signed-off human override in this VERIFICATION.md's `overrides:` sense. |

**Score:** 12/12 core truths verified; 1 (REV-01) verified at the code-correctness level but flagged for a human decision on whether "cadence configuration UI" was intentionally out of scope for this phase or should be a closure item.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00043_ownership_review_governance.sql` | 4 sops columns + trigger + 2 tables + RLS | ✓ VERIFIED | Confirmed live on prod via Management API (`schema_migrations` contains `00043`). |
| `supabase/migrations/00044_fix_cadence_rls_org_claim.sql` | Fixes HR-01 app_metadata JWT-path RLS bug | ✓ VERIFIED | Confirmed live on prod (`schema_migrations` contains `00044`); live `pg_policies` query shows both `sop_review_cadences_read_org` and `ai_model_settings_read_org` now use `current_organisation_id()`. |
| `scripts/backfill-owner-review.mjs` | Idempotent owner/review backfill | ✓ VERIFIED | Executed against prod; 23/23 first run, 0/23 re-run, confirmed via live count query. |
| `src/types/database.types.ts` | sops Row/Insert/Update extended | ✓ VERIFIED | 4 new columns present in all three shapes. |
| `src/lib/governance/classify.ts` | Pure classifier | ✓ VERIFIED | All 4 flags implemented, no server directive, unit-tested. |
| `src/lib/governance/cadences.ts` | Pure cadence resolver + due-date math | ✓ VERIFIED | LR-02 end-of-month clamp fix present (UTC-deterministic); LR-03 unused `now?` param dropped. |
| `src/actions/governance.ts` | 4 async server actions | ✓ VERIFIED | `setSopOwner`, `confirmSopCurrent`, `setReviewCadence`, `listGovernanceQueue` all present, async, JWT-scoped (`parseJwtPayload`, never raw atob). |
| `src/app/api/sops/[sopId]/publish/route.ts` | Review-clock reset + superseded event on supersede | ✓ VERIFIED | MR-01 fix confirmed: `.select('id')` + 0-row 409 short-circuit before the review-clock reset / superseded-event block runs. |
| `src/app/(protected)/admin/governance/page.tsx` | RSC queue page | ✓ VERIFIED | Auth+role guard (LR-05 org-scoped fix present), `?filter=` read, calls `listGovernanceQueue`. |
| `GovernanceFilterChips.tsx` / `GovernanceQueueRow.tsx` / `OwnerPicker.tsx` | Chips/row/picker | ✓ VERIFIED | All wired to real actions, no empty handlers. |
| `LibraryReviewCell.tsx` / `GovernanceWidget.tsx` | Admin library cell + dashboard widget | ✓ VERIFIED | Both wired; overdue guard admin-only. |
| `src/components/sop/tabs/OverviewTab.tsx` | Worker passive caption | ✓ VERIFIED | Exactly one `MetaRow`, no gating logic, no governance import. |
| `src/lib/journeys/journeys.ts` | `/admin/governance` mapped | ✓ VERIFIED | Present with `route: '/admin/governance'`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `public.sops` (insert) | `default_sop_owner()` | BEFORE INSERT trigger | ✓ WIRED | Live trigger body confirmed via `pg_proc.prosrc` on prod. |
| `GovernanceQueueRow` | `confirmSopCurrent` | `onClick` → real import call | ✓ WIRED | `handleConfirmCurrent` calls `confirmSopCurrent(row.id)` inside `useTransition`, surfaces error, `router.refresh()`. |
| `OwnerPicker` | `setSopOwner` | member select → action call | ✓ WIRED | Confirmed via source read + spec assertion. |
| `LibraryReviewCell` | `confirmSopCurrent` | `onClick` → real import call | ✓ WIRED | Same handler shape as queue row. |
| `GovernanceWidget` | `/admin/governance?filter=` | deep link | ✓ WIRED | 3 `<Link>`s, one per flag. |
| `admin/sops/page.tsx` | `owner_user_id` filter | `?owner=me` → `.eq(...)` | ✓ WIRED | Confirmed at `page.tsx:82`. |
| `publish/route.ts` | `sop_review_events` | insert `superseded` guarded by `parent_sop_id` + actual publish transition | ✓ WIRED | MR-01 fix confirmed — gated on `publishedRows.length > 0`. |
| `setReviewCadence` | `sop_review_cadences` | service-role upsert, org from JWT only | ⚠️ ORPHANED (by design, unresolved) | Action itself is correct and org-scoped, but has **zero callers** anywhere in `src/` — no settings UI exists to invoke it. Flagged as LR-04 in code review, "skipped: intentional." |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `/admin/governance` rows | `GovernanceRow[]` | `listGovernanceQueue()` → real `sops`/`organisation_members`/`sop_departments`/`departments` selects | Yes | ✓ FLOWING |
| `GovernanceWidget` counts | `counts.{overdue,unowned,due_soon}` | Same `listGovernanceQueue()` read, reduced client-side in the server component | Yes | ✓ FLOWING |
| `LibraryReviewCell` owner/overdue | `owner_user_id`, `review_due_at` | `admin/sops/page.tsx` real select | Yes | ✓ FLOWING |
| `OverviewTab` "Current as of" | `sop.last_reviewed_at ?? sop.published_at` | Real SOP row via `SopWithSections` | Yes | ✓ FLOWING |
| `sop_review_cadences` category cadences | `orgCadences` map in `fetchOrgCadences` | Real table read, but table has **zero rows written via any UI path** (only `setReviewCadence`, which is uncalled) | No (empty table in practice) | ⚠️ STATIC — resolves to hardcoded 12-month fallback for every org/category |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase28 suite green | `npx playwright test --project=phase28-unit --project=phase28` | 49 passed, 3 skipped (fixme) | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| Production build clean, bundle gate green | `npm run build` | Build succeeded; `check-bundle-size` postbuild: `/sops/[sopId]/page = 1057 KB (baseline 1057 KB, Δ 0 KB)` | ✓ PASS |
| Migrations 00043/00044 live on prod | Management API query on `schema_migrations` | `[{"version":"00043"},{"version":"00044"}]` | ✓ PASS |
| Live RLS predicate fixed (HR-01) | Management API query on `pg_policies` | Both `sop_review_cadences_read_org` and `ai_model_settings_read_org` use `current_organisation_id()` | ✓ PASS |
| Live backfill counts | Management API query on `public.sops` | `total=23, owned=23`; `total_published=5, review_due_published=5` | ✓ PASS |
| Live trigger body correct (Rule-1 fix) | Management API query on `pg_proc` | `new.owner_user_id := new.uploaded_by` | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist for this phase and none are declared in PLAN/SUMMARY. Step 7c: SKIPPED (no probes declared or found for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| OWN-01 | 28-01, 28-05 | Every SOP owned, auto-backfilled | ✓ SATISFIED | Live backfill 23/23 + trigger. |
| OWN-02 | 28-03, 28-04 | Reassign ≤2 clicks, org-scoped | ✓ SATISFIED | `OwnerPicker` + `setSopOwner` membership check. |
| OWN-03 | 28-02, 28-03 | Unowned = owner missing/deactivated, auto-surfaces | ✓ SATISFIED | `classifyGovernanceRow` unowned branch, unit-tested. |
| OWN-04 | 28-05 | "My SOPs" = owner filter, no new page | ✓ SATISFIED | `?owner=me` chip on `/admin/sops`. |
| REV-01 | 28-01, 28-02, 28-03 | Review-due date, per-category cadence, overridable per SOP | ⚠️ PARTIALLY SATISFIED | Auto-backfill + 12-month default fully works; per-category cadence config and per-SOP override are unreachable (no UI/no column) — see truth #12 above. |
| REV-02 | 28-05 | Overdue badge admin-only, worker never blocked | ✓ SATISFIED | `LibraryReviewCell` admin-only guard; worker routes grepped clean. |
| REV-03 | 28-05 | Worker passive "current as of" caption | ✓ SATISFIED | `OverviewTab.tsx` single MetaRow. |
| REV-04 | 28-01, 28-03 | Confirm-current one-click + audit event; supersede resets clock | ✓ SATISFIED | `confirmSopCurrent` + publish-route hook (MR-01-fixed). |
| GQ-01 | 28-02, 28-03, 28-04 | One unified queue, 4 buckets | ✓ SATISFIED | `/admin/governance` + `listGovernanceQueue`. |
| GQ-02 | 28-04 | One-click primary action per row | ✓ SATISFIED | Flag-priority single-action rendering, all wired. |
| GQ-03 | 28-02, 28-03 | Stale-role on renamed/removed dept/role refs | ✓ SATISFIED | Dangling + renamed-since-review both implemented (sub-trades correctly descoped). |
| GQ-04 | 28-05 | Dashboard widget, counts + deep links | ✓ SATISFIED | `GovernanceWidget` mounted on `/admin/sops`. |

No orphaned requirements — all 12 phase-28 IDs (OWN-01..04, REV-01..04, GQ-01..04) appear in REQUIREMENTS.md v6.0 traceability table mapped to Phase 28, and all 12 are claimed across the 6 plans' `requirements:` frontmatter.

### Anti-Patterns Found

None blocking. Two prior source-contract false-negatives (both already fixed by the executors themselves, documented in SUMMARYs): comment text matching `not.toContain('use server')`/`not.toContain('createAdminClient')`/`not.toContain('review_due_at')` assertions — reworded, no functional impact. No `TBD`/`FIXME`/`XXX` markers found in phase-28 files. No placeholder/"coming soon" strings. No empty `onClick` handlers (verified by direct source read of every wired component, not just grep).

One design-level finding (not a code anti-pattern, a scope-completeness finding): `setReviewCadence` is a fully-correct, fully-tested server action with **zero callers** — this is the "wired handler exists but the surface that would call it doesn't exist" class, but on the *config* path rather than the primary user flow (owner/review-date/queue all work without it, since they fall back to 12 months).

### Human Verification Required

#### 1. Live UAT of `/admin/governance` on sopstart.com

**Test:** Open `/admin/governance` post-deploy, click through each filter chip, and exercise Confirm current / Assign owner / Fix assignment on real data.
**Expected:** Rows render, filters narrow correctly, and each action completes without error and reflects in the row after `router.refresh()`.
**Why human:** This project's convention is Railway-only testing (no local Playwright browser E2E) — source-contract specs prove wiring but not live-render correctness or click-through UX feel.

#### 2. Live cross-org write-isolation runtime cases

**Test:** Execute the 3 `test.fixme` cases in `tests/phase28/governance-actions.spec.ts` (setSopOwner/confirmSopCurrent/setReviewCadence cross-org isolation) against live Supabase with two seeded orgs, per their inline Steps docs.
**Expected:** Org A admin cannot read/write Org B governance data on any of the three actions.
**Why human:** Requires a live two-org Supabase session; accepted as a documented deviation per this project's Railway-only-testing convention (phase27 `ai-settings-org-scope.spec.ts` precedent) — carried forward, not newly introduced by this verification.

#### 3. Decision needed: is the cadence-configuration gap (REV-01) a phase-28 closure item or a deliberate deferral?

**Test:** Simon should decide whether "per-category cadence config UI" + "per-SOP cadence override" (part of REV-01's literal wording) is in-scope for Phase 28 closure or explicitly deferred to a future phase.
**Expected:** Either (a) accept as an intentional deferral (matching the code reviewer's LR-04 judgment) via a documented override, or (b) open a small closure plan to add a minimal cadence-settings UI that calls the already-correct `setReviewCadence` action.
**Why human:** This is a product-scope decision, not a code-correctness question — the underlying mechanism (`resolveCadenceMonths`, `setReviewCadence`, RLS) is all correct and tested; only the "surface to configure it" is missing, and REQUIREMENTS.md's literal wording checked this off as `[x]` complete.

### Gaps Summary

No blocking gaps. Every phase-28 north-star truth (owner display, review-due date, unified governance queue, one-click actions, worker-never-gated) is verified live on prod with real data (23/23 SOPs owned, 5/5 published SOPs have review dates, migrations 00043+00044 confirmed live, RLS fix confirmed live, trigger confirmed live). All 6 plans' SUMMARY claims check out against actual code — no stubs, no dead handlers, no placeholder text found anywhere in the 20 files the code review touched or the additional files this verification independently re-read.

The one open item is a scope-completeness question, not a functional defect: the "per-category cadence" and "per-SOP override" tiers of REV-01's cadence-resolution model are correctly coded and unit-tested but have no reachable UI, so every SOP today resolves to the hardcoded 12-month default. This was already caught and reasoned about by the phase's own code review (LR-04) as an intentional staged deferral, but it lacks a formal human-signed override — routed to human verification item #3 above for a scope decision rather than silently accepted or hard-failed.

---

_Verified: 2026-07-12_
_Verifier: Claude (gsd-verifier)_
