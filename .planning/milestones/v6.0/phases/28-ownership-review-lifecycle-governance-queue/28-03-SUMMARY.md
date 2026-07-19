---
phase: 28-ownership-review-lifecycle-governance-queue
plan: 03
subsystem: backend
tags: [server-actions, governance, ownership, review-lifecycle, rls, publish-route]

# Dependency graph
requires:
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: "sops.owner_user_id/review_due_at/last_reviewed_at/last_reviewed_by columns + sop_review_cadences/sop_review_events tables (28-01)"
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: "classifyGovernanceRow/resolveCadenceMonths/computeReviewDueDate pure modules (28-02)"
provides:
  - "setSopOwner/confirmSopCurrent/setReviewCadence/listGovernanceQueue server actions (src/actions/governance.ts)"
  - "GovernanceRow type for the queue page + dashboard widget (28-04/28-05)"
  - "Publish-route review-clock reset + superseded event on version supersede"
affects: [28-04, 28-05, admin-governance-page, admin-sops-page, sop-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sops writes ride existing admins_can_update_sops RLS via the plain session client — service-role only for sop_review_cadences (no authenticated write policy by design)"
    - "Non-fatal post-publish side-effect block (try/catch, log-only) — mirrors the existing auto-queue/agent-synthesis fire-and-forget shape at the same call site"

key-files:
  created:
    - tests/phase28/governance-actions.spec.ts
  modified:
    - src/actions/governance.ts
    - src/app/api/sops/[sopId]/publish/route.ts

key-decisions:
  - "confirmSopCurrent/listGovernanceQueue/publish-route all resolve cadence from sops.category (not category_tag) — matches the field the existing admin library page already selects and displays"
  - "listGovernanceQueue reuses getOrgMembers() for owner labels rather than a second organisation_members query with role/email joins — email is always null in the current schema (no user_profiles table), so labels fall back to '{role} ({user_id prefix})'"

patterns-established:
  - "Post-publish non-fatal side-effect block placed between the publish UPDATE and the existing auto-queue/agent-synthesis calls, same try/catch-log shape"

requirements-completed: [OWN-02, OWN-03, REV-01, REV-04, GQ-01, GQ-02, GQ-03]

# Metrics
duration: 30min
completed: 2026-07-12
---

# Phase 28 Plan 03: Governance Server-Action Layer Summary

**src/actions/governance.ts (setSopOwner, confirmSopCurrent, setReviewCadence, listGovernanceQueue) built over the 28-01 schema and 28-02 pure logic, plus a non-fatal publish-route review-clock reset on version supersede — all source-contract specs green, tsc clean, full `next build` clean with bundle gate unchanged.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-12T07:10:00Z
- **Completed:** 2026-07-12T07:40:00Z
- **Tasks:** 3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `setSopOwner` verifies the target `userId` is an `organisation_members` row in the caller's org before writing, and writes `sops` with the plain session client (`admins_can_update_sops` RLS already gates it) — never the service-role client (RESEARCH Pitfall 1)
- `confirmSopCurrent` resolves cadence months from the org's `sop_review_cadences`, stamps `last_reviewed_at`/`review_due_at`/`last_reviewed_by`, and appends a `sop_review_events` `confirmed_current` row — append-only audit trail
- `setReviewCadence` upserts `sop_review_cadences` via the service-role client, `organisation_id` sourced only from `ctx.organisationId` (JWT-derived), never a function parameter
- `listGovernanceQueue` composes `sops` + `organisation_members` + `sop_departments` → `departments` in one read pass and maps every row through the pure `classifyGovernanceRow`, with the required `last_reviewed_at` null-guard on the renamed-since-review comparison (plan-checker WARNING-1) and no sub-trade join (Pitfall 3)
- Publish route (`/api/sops/[sopId]/publish`) resets the review clock after a successful publish and inserts a `superseded` `sop_review_events` row when `parent_sop_id` is set — wrapped in try/catch so a reset failure never fails the publish response
- `tests/phase28/governance-actions.spec.ts` — 12 wired source-contract assertions (real call sites, not bare token presence) + 3 `test.fixme` carried cross-org runtime cases, all registered under the existing `phase28` project
- Full gate green: `npx playwright test --project=phase28-unit --project=phase28` (24 passed, 3 fixme), `npx tsc --noEmit` clean, `npm run build` clean (bundle gate Δ0 KB, unaffected — this plan touches no client bundle)

## Task Commits

1. **Task 1: governance.ts — owner, confirm-current, cadence actions** - `3f8fa96` (feat)
2. **Task 2: listGovernanceQueue composed read + GovernanceRow type** - `f8ddcd8` (feat)
3. **Task 3: Publish-route review-clock reset + source-contract specs** - `989215c` (feat, includes inline Rule 3 comment-wording fix)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP) follows below._

## Files Created/Modified
- `src/actions/governance.ts` - `setSopOwner`, `confirmSopCurrent`, `setReviewCadence`, `listGovernanceQueue`, `GovernanceRow` type, private `requireAdmin`/`fetchOrgCadences` helpers
- `src/app/api/sops/[sopId]/publish/route.ts` - extended step-2b select (`category, parent_sop_id`), added non-fatal review-clock reset + superseded event insert after the publish UPDATE
- `tests/phase28/governance-actions.spec.ts` - wired source-contract coverage for all four actions + publish-route hook, plus 3 `test.fixme` cross-org write-isolation carries

## Decisions Made
- Used `sops.category` (not `category_tag`) as the cadence-resolution key everywhere in this plan, matching the field the existing `/admin/sops` library page already selects and displays to admins.
- `listGovernanceQueue`'s owner label reuses `getOrgMembers()` (assignments.ts) instead of hand-rolling a second member/role/email query — since `email`/`full_name` are always `null` in the current schema (no `user_profiles` table), labels fall back to `"{role} ({user_id prefix})"`, same display-limitation as the rest of the codebase (Phase 4 learning: "Worker display names use abbreviated user_id").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comment text false-matched the spec's own `not.toContain('createAdminClient')` assertion**
- **Found during:** Task 3, running the plan's verify command (`npx playwright test --project=phase28 -g "governance-actions|..."`)
- **Issue:** `setSopOwner`'s inline comment read "Do NOT use createAdminClient here (Pitfall 1)" — the literal substring `createAdminClient` in the comment made the new spec's `expect(body).not.toContain('createAdminClient')` assertion fail, even though the function body genuinely never calls `createAdminClient()`. Same class of false-negative as 28-02's `'use server'` comment-text deviation.
- **Fix:** Reworded the comment to "Do NOT use the service-role client here (Pitfall 1)" — no functional change, matches the plan's intent, spec now passes.
- **Files modified:** `src/actions/governance.ts`
- **Verification:** `npx playwright test --project=phase28 -g "setSopOwner"` green (2/2); full `phase28`/`phase28-unit` suite green (24 passed, 3 fixme).
- **Committed in:** `989215c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking, self-inflicted comment/assertion false-negative, no scope creep)
**Impact on plan:** Caught and fixed within Task 3 before commit; zero functional change to the governance actions themselves.

## Issues Encountered
None beyond the auto-fixed item above.

## User Setup Required
None - no external service configuration required. All writes ride existing RLS or the already-provisioned service-role client.

## Next Phase Readiness
- `src/actions/governance.ts` (`setSopOwner`, `confirmSopCurrent`, `setReviewCadence`, `listGovernanceQueue`, `GovernanceRow`) is ready for Plan 28-04 (owner reassignment UI, review cadence settings UI) and Plan 28-05 (`/admin/governance` queue page + dashboard widget) to import directly.
- The publish route now self-maintains the review clock on every publish/supersede — no further wiring needed at other create/publish call sites.
- `tests/phase28/governance-actions.spec.ts` carries 3 `test.fixme` cross-org write-isolation cases (setSopOwner, confirmSopCurrent, setReviewCadence) per the Railway-only-testing convention — same precedent as `tests/phase27/ai-settings-org-scope.spec.ts`; execute as live-Supabase UAT when convenient.
- No blockers.

---
*Phase: 28-ownership-review-lifecycle-governance-queue*
*Completed: 2026-07-12*

## Self-Check: PASSED

All created/modified files verified present; all task commit hashes (`3f8fa96`, `f8ddcd8`, `989215c`) verified in git log.
