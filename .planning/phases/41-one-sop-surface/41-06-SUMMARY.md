---
phase: 41-one-sop-surface
plan: 06
subsystem: ui
tags: [nextjs, redirect-shim, rbac, nav, pathways, source-contract-tests]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 05
    provides: "/sops merged surface with the Admin scope group in AdminSopSurface.tsx (useIsAdmin()-gated, next/dynamic lenses), resolveAdminScope's exact param->scope mapping, and the confirmed navToUrl URL shapes the shim must reproduce"
provides:
  - "/admin/sops is a guard-first redirect() shim to /sops, preserving all seven legacy query params (view/status/owner/filter/departments/collection/sop) via URLSearchParams over a fixed /sops path"
  - "/admin/governance retargets its redirect to /sops?view=attention (legacy governance bookmark now resolves in one hop instead of two)"
  - "TopHeader has exactly one SOPs entry (/sops, in BASE_LINKS) for every role; ADMIN_LINKS drops Manage SOPs and gains Governance -> /sops?view=attention"
  - "roleHome('admin') returns /sops"
  - "journeys.ts maps the merged surface + one shim step; /pathways reports 0 not-mapped"
  - "tests/phase41/nav-and-shim.spec.ts is live (no fixme), mutation-proven; tests/phase30/admin-nav.spec.ts, governance-fold.spec.ts and role-homes.spec.ts repointed to the new destinations"
affects: [41-07-reference-sweep, 41-08-spec-repoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redirect shim modelled byte-for-byte on the existing admin/governance shim: getSessionContext() -> redirect('/login') -> role gate -> destination redirect, guard always before the destination is built (T-41-03b)"
    - "Query-string remap via URLSearchParams over a fixed destination path string (never a template hole filled from request params) — open-redirect hygiene (T-41-03)"

key-files:
  created: []
  modified:
    - src/app/(protected)/admin/sops/page.tsx
    - src/app/(protected)/admin/governance/page.tsx
    - src/components/layout/TopHeader.tsx
    - src/lib/auth/role-home.ts
    - src/lib/journeys/journeys.ts
    - tests/lint/no-static-admin-lens-import.spec.ts
    - tests/phase30/admin-nav.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/phase30/role-homes.spec.ts
    - tests/phase41/nav-and-shim.spec.ts
  created-this-plan:
    - .planning/phases/41-one-sop-surface/deferred-items.md

key-decisions:
  - "governance-fold.spec.ts's scope-column reachability assertion could not be repointed 1:1 — the plan expected href=\"/sops?view=attention\"-style links, but 41-05's Deviation fix (see 41-05-SUMMARY.md) made the Admin scope column a client-side applyScope()/history.replaceState state machine in AdminSopSurface.tsx, not anchor hrefs. Repointed to assert the ADMIN_SCOPES entries and applyScope(sc.key) wiring instead — same reachability contract, correct shape for the actual (restructured) implementation."
  - "tests/phase30/role-homes.spec.ts was NOT in the plan's named expected-red list but went red after Task 2's roleHome('admin') change (it asserted the old '/admin/sops' value). Treated as a Rule 1 fix (stale source-contract guard, CLAUDE.md 2026-07-13) rather than deferred — repointed in Task 3 alongside the two named Phase 30 guards."
  - "admin-nav.spec.ts's 'Manage SOPs must never come back' check uses a targeted `not.toContain(\"label: 'Manage SOPs'\")` rather than a raw substring count — TopHeader.tsx's own explanatory comments legitimately still mention the old label name for context, and a raw count trips on those."

requirements-completed: [SUR-01, SUR-03, SUR-04, SUR-06]

# Metrics
duration: 55min
completed: 2026-09-13
---

# Phase 41 Plan 06: Close the Second SOP Door Summary

**`/admin/sops` is now a guard-first redirect shim to `/sops` preserving all seven legacy query params; TopHeader carries exactly one "SOPs" entry with Governance deep-linking the admin lens; `roleHome('admin')` lands on `/sops`; and `journeys.ts`/`/pathways` describe one merged surface plus one shim with zero not-mapped screens.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-13T01:25:00Z (approx)
- **Completed:** 2026-09-13T02:20:00Z (approx)
- **Tasks:** 3
- **Files modified:** 10 (across 3 task commits), plus 1 new file (deferred-items.md)

## Accomplishments

- **Task 1** — Replaced the 700-line `admin/sops/page.tsx` (Miller browser, wiring patch bay, governance queue — all capabilities confirmed already homed in `listAdminSopRows`/`listAdminAccessData`/`AdminStatusLens`/`AdminAttentionLens`/`AdminAccessLens` per 41-02/41-03/41-04) with a 46-line redirect shim: guard-first (`getSessionContext()` -> `/login` -> `['admin','safety_manager']` -> `/dashboard`), then a fixed `/sops` destination built via `URLSearchParams` over the seven legacy params. Retargeted `/admin/governance`'s redirect to `/sops?view=attention` (one hop instead of two). Repointed every `/admin/sops` destination step in `journeys.ts` to `/sops`/`/sops?view=attention`/`/sops?view=access`, dropped "SOP management"/"Admin SOP library" as destination names (D-05/SUR-06), and added one shim step so the route stays mapped for the 0-not-mapped pathways gate. Tightened `no-static-admin-lens-import.spec.ts`'s allowlist to the three lens files only (removed the 41-01 TEMPORARY entry).
- **Task 2** — `TopHeader.tsx`'s `ADMIN_LINKS` drops "Manage SOPs" (`/admin/sops`), gains "Governance" (`/sops?view=attention`) in its place; `BASE_LINKS`' single `SOPs -> /sops` entry is now the one door for every role. `activeHref`'s longest-prefix match ignores query strings, so the new Governance entry never falsely highlights. `roleHome('admin')` now returns `/sops`.
- **Task 3** — Repointed `tests/phase30/admin-nav.spec.ts` (header items/hrefs, attention-view-reachability assertion moved to `AdminSopSurface.tsx`'s `resolveAdminScope`, added a "no UI" assertion on the shim) and `tests/phase30/governance-fold.spec.ts` (needs-attention/access-map/scope-column assertions moved to `AdminSopSurface.tsx` + `AdminAttentionLens.tsx`, redirect-shim destination updated). Discovered and fixed `tests/phase30/role-homes.spec.ts` (stale-red after Task 2, not named in the plan's expected-red list — Rule 1 fix). Flipped `tests/phase41/nav-and-shim.spec.ts` live: SUR-03 header contract, shim guard-first/URLSearchParams/seven-params/fixed-path assertions, SUR-04 single-list->builder-chain assertion (`SopMillerBrowser` links to the builder, `SopWorkerBrowser` doesn't, and the SOP detail page's own "Edit in builder" link survives as the documented second destination, D-06). Ran and reverted two mutation-proofs (re-adding "Manage SOPs", moving the guard after the redirect) — both tripped the correct assertions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace /admin/sops with a redirect shim and update journeys.ts** - `71e5c56` (feat)
2. **Task 2: One SOPs entry in TopHeader; admin role-home lands on /sops** - `3121756` (feat)
3. **Task 3: Repoint the two Phase 30 nav/fold guards and flip the nav-and-shim spec live** - `d4b2d62` (test)

## Files Created/Modified

- `src/app/(protected)/admin/sops/page.tsx` — 700-line admin library replaced by a 46-line guard-first redirect shim
- `src/app/(protected)/admin/governance/page.tsx` — retargeted from `/admin/sops?view=attention` to `/sops?view=attention`
- `src/lib/journeys/journeys.ts` — every `/admin/sops` destination step repointed to `/sops`, "SOP management"/"Admin SOP library" dropped, one shim step added
- `tests/lint/no-static-admin-lens-import.spec.ts` — temporary `admin/sops/page.tsx` allowlist entry removed
- `src/components/layout/TopHeader.tsx` — `Manage SOPs` -> `Governance` (`/sops?view=attention`)
- `src/lib/auth/role-home.ts` — `case 'admin'` returns `/sops`
- `tests/phase30/admin-nav.spec.ts`, `tests/phase30/governance-fold.spec.ts`, `tests/phase30/role-homes.spec.ts` — repointed to the new destinations
- `tests/phase41/nav-and-shim.spec.ts` — flipped live, mutation-proven
- `.planning/phases/41-one-sop-surface/deferred-items.md` — new, logs 2 pre-existing out-of-scope failures found during full-suite verification

## Decisions Made

See frontmatter `key-decisions`. Headline: the governance-fold scope-column assertion had to target 41-05's restructured `AdminSopSurface.tsx` (client-side `applyScope()` state machine) rather than the plan's assumed href-based rail, since 41-05 replaced hrefs with in-frame scope switching as part of its bundle-budget fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale guard] `tests/phase30/role-homes.spec.ts` broke on Task 2's `roleHome('admin')` change but was not named in the plan's expected-red list**
- **Found during:** Task 3 verification (`npx playwright test --project=phase30`)
- **Issue:** The spec asserted `roleHome.ts` contains `'/admin/sops'` and that `roleHome` maps `admin -> /admin/sops`. Task 2 changed that mapping to `/sops`, so this guard went stale-red — but it wasn't in the plan's named expected-red set (`list-rows`, `create-entry`, phase28/29/32/33, `sb-auth-builder`), meaning it's a real break this plan introduced, not a deferred one.
- **Fix:** Updated the doc comment and the two assertions (`expect(src).not.toContain("'/admin/sops'")`, test title/expectations updated to `admin->/sops`).
- **Files modified:** `tests/phase30/role-homes.spec.ts`
- **Verification:** `npx playwright test --project=phase30` — full project green apart from the plan's named `list-rows.spec.ts` failures.
- **Committed in:** `d4b2d62` (Task 3 commit)

**Total deviations:** 1 auto-fixed (stale guard repointed same-session). No scope creep — this is exactly the CLAUDE.md 2026-07-13 "repoint stale source-contract guards in the same commit" rule applied to a guard the plan's authoring didn't anticipate would break.

## Specs left red for 41-08 (named, by design — do not fix in this plan)

Confirmed via a full `npx playwright test` run (1460 passed, 46 failed, 212 skipped):

- `tests/phase28/governance-queue.spec.ts` (4 tests) — reads `admin/sops/page.tsx` for the queue/role-guard contract
- `tests/phase28/library-and-worker.spec.ts` (6 tests) — reads `admin/sops/page.tsx` for owner/flag columns and header chips
- `tests/phase29/queue-approve-action.spec.ts` (1 test) — reads `admin/sops/page.tsx`'s attention view
- `tests/phase30/list-rows.spec.ts` (3 tests) — reads `admin/sops/page.tsx` for one-line row rendering
- `tests/phase32/library-filter-deeplink.spec.ts` (1 test) — reads `admin/sops/page.tsx` for `?departments=`/`?collection=` server-filtering
- `tests/phase32/wire-up-mode.spec.ts` (1 test) — reads `admin/sops/page.tsx` for `ensureSopCollections`
- `tests/phase33/sop-drilldown.spec.ts` (1 test) — reads `admin/sops/page.tsx` for the `sopsByCollection` join read
- `tests/sb-auth-builder.test.ts` (2 tests, `phase11-stubs` project) — reads `admin/sops/page.tsx`

Note: `tests/phase30/create-entry.spec.ts` was also named in the plan's expected-red list but is currently GREEN (its assertions don't happen to touch the removed page content) — extra green, not a gap.

### Pre-existing / unrelated (not caused by this plan; logged in `deferred-items.md`)

- ~26 legacy `phase3-stubs`/`phase11-stubs`/`phase12.5-stubs` failures (unrelated stub gaps, confirmed pre-existing per project notes)
- `tests/phase36/worker-library-chip.spec.ts` (1 test) — pre-existing, confirmed unrelated per project notes
- `tests/integration/wizard-sop-dept.spec.ts` (`phase25-integration` project, 1 test) — reads `SopMetadataFields.tsx` for a `__new__` sentinel that isn't there; last touched by unrelated Phase-40-era commits, not Phase 41
- `tests/phase46/sop-edit-owner-access.spec.ts` (1 test) — `verifyOtp failed: Request rate limit reached`, a live Supabase Auth rate-limit hit during the run, not a code regression

## Bundle deltas (both gated routes, unchanged from 41-05's restored baseline)

- `/sops/[sopId]/page` = 1049 KB (baseline 1048 KB, Δ +1 KB, tolerance ±2 KB) — PASS
- `/sops/page` = 941 KB (baseline 940 KB, Δ +1 KB, tolerance ±2 KB) — PASS

## Issues Encountered

None beyond the stale-guard deviation above. The 41-05-SUMMARY.md "Deviation fix" section (AdminSopSurface.tsx / MillerPrimitives.tsx / sops-nav-types.ts extraction) was read and accounted for before writing the shim and repointing the Phase 30 guards — no rework needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The second SOP door is closed: `/admin/sops` renders nothing, `/admin/governance` resolves in one hop, and no nav surface anywhere links to a second SOP list destination.
- 41-07 (reference sweep) can now sweep any remaining internal `/admin/sops?...` links (other than the builder-chain paths, which are unaffected — `/admin/sops/new`, `/admin/sops/builder/[sopId]`, etc. all survive unchanged) to go straight to `/sops` rather than bouncing through the shim.
- 41-08 (spec repoint) has an exact, verified list of 8 legacy specs to repoint (19 individual test cases) — see "Specs left red for 41-08" above.
- No blockers.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 11 modified/created artifact files confirmed present on disk; all 3 task commit hashes (`71e5c56`, `3121756`, `d4b2d62`) confirmed in `git log --oneline --all`.
