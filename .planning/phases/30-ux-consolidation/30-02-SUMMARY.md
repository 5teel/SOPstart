---
phase: 30-ux-consolidation
plan: 02
subsystem: auth-routing
tags: [role-home, redirect-shim, pending, not-found, journeys, ux-01]
requires:
  - 30-01 (phase30 Playwright harness + role-homes.spec.ts stub)
provides:
  - roleHome(role) in src/lib/auth/role-home.ts — the single role→home decision function (worker→/sops, supervisor/safety_manager→/activity, admin→/admin/sops, absent/unknown→/pending)
  - /dashboard reduced to a redirect-only shim (AdminDashboard tiles + inline PendingDashboard deleted)
  - /pending page (relocated pending-user holding screen)
  - app-level src/app/not-found.tsx boundary (stale links now render a navigable page)
  - middleware + auth actions + roster/activity fallthroughs dispatch via roleHome
  - journeys.ts + roles.ts carry zero '/dashboard' landing points; /pending covered by the login journey
affects:
  - 30-04 (TopHeader/BottomTabBar dashboard nav removal — its role-homes fixme test flips there)
  - 30-08 (final journeys sweep / pathways 0-not-mapped gate)
tech-stack:
  added: []
  patterns:
    - "roleHome(role) single-source dispatch — never per-callsite role ternaries"
    - "Middleware role read via JWT user_role claim + parseJwtPayload (no DB call, no atob)"
key-files:
  created:
    - src/lib/auth/role-home.ts
    - src/app/(protected)/pending/page.tsx
    - src/app/not-found.tsx
  modified:
    - src/app/(protected)/dashboard/page.tsx (127 ln → 27 ln redirect shim)
    - src/lib/supabase/middleware.ts (auth-route redirect → roleHome via JWT claim)
    - src/actions/auth.ts (signIn/join/acceptInvite redirect via roleHome)
    - src/app/(auth)/login/roster/page.tsx (escalation-guard redirect → roleHome)
    - src/app/(protected)/activity/page.tsx (admin/no-role fallthrough → roleHome)
    - src/lib/journeys/journeys.ts (5 landing entries + roster prose)
    - src/lib/journeys/roles.ts (pending + admin landsOn)
    - tests/phase30/role-homes.spec.ts (flipped live, 5 live / 1 fixme)
decisions:
  - "auth.ts uses roleHome directly (not the shim): role is in hand at all 3 redirects — signIn parses the fresh session JWT user_role claim via parseJwtPayload; join-by-code is always worker; acceptInvite has invitedRole. Direct dispatch skips a redirect hop"
  - "roleHome fallback is /pending (plan must_haves), not /sops (stale stub-header text) — pending users get a truthful holding screen instead of a misleading empty SOP library"
  - "Internal admin guards keep redirect('/dashboard') per decision #5 — the shim forwards them; phase26.5 agent-dashboard + phase25 admin-departments guard specs stay green unchanged"
  - "TopHeader test in role-homes.spec.ts stays fixme — nav repoint is 30-04 scope per plan objective"
  - "Login journey rewritten as a 4-branch role decision so /pending gets journey coverage (pathways screen map auto-derives from route tree; a new page with no journey step = flagged screen)"
metrics:
  duration: ~25m
  completed: 2026-07-13
---

# Phase 30 Plan 02: One Home Per Role (UX-01) Summary

**One-liner:** roleHome(role) single-source dispatch wired through middleware/auth/roster/activity; /dashboard is now a 27-line redirect shim, pending users get /pending, stale links get a real not-found page, and no journeys/roles entry lands on /dashboard.

## What was built

### Task 1 — roleHome + shim + /pending + not-found (commit `2e946fa`)
- `src/lib/auth/role-home.ts`: plain module (no server-action directive — sync export would break `next build`, 2026-06-27 learning). Switch over 4 roles; default `/pending`.
- `dashboard/page.tsx`: member-role lookup → `redirect(roleHome(role))`. AdminDashboard, 6 DashTiles, inline PendingDashboard all deleted (DashTile pattern gets lifted into the 30-05 method picker from git history).
- `pending/page.tsx`: PendingDashboard blueprint-frame JSX relocated verbatim under the (protected) layout.
- `src/app/not-found.tsx`: navigable fallback (CSS-var tokens, Link to `/`) — closes RESEARCH Pitfall 1 / the 2026-06-08 dead-href learning's standing recommendation.

### Task 2 — dispatch repoint + journeys/roles + spec flip (commit `0082ff8`)
- `middleware.ts`: authed user on an auth route now redirects via `roleHome(parseJwtPayload(access_token)['user_role'])` — no DB call, no atob, absent claim → /pending.
- `auth.ts`: all three `redirect('/dashboard')` replaced with roleHome dispatch (see decisions).
- `roster/page.tsx` escalation guard + `activity/page.tsx` fallthrough → `roleHome(role)`.
- `journeys.ts`: login journey branches to all four homes (covers /pending); sign-up lands `/admin/sops`; join-team lands `/sops`; worker find-SOP journey's redundant dashboard step removed; enter-admin-tools lands `/admin/sops` with summary updated.
- `roles.ts`: pending landsOn `/pending`; admin landsOn `/admin/sops`.
- `role-homes.spec.ts` flipped live: 5 live assertions (mapping incl. all 5 cases + no-'use server', middleware roleHome+parseJwtPayload+no-atob, auth.ts no-/dashboard, shim contract, /pending + not-found exist + journeys grep-0). TopHeader assertion stays fixme for 30-04.

## Verification results

| Gate | Result |
|------|--------|
| `npm run build` + postbuild bundle gate | clean, 1057 KB Δ 0 KB (both tasks) |
| `npx playwright test --project=phase30 --project=phase26.5` | 51 passed / 38 skipped / 0 failed |
| `npx playwright test --project=phase25-e2e` | 20 passed / 2 skipped / 0 failed (guard specs green — guards untouched per decision #5) |
| `npx tsc --noEmit` | clean |
| `grep -rn "'/dashboard'" src/lib/journeys` | 0 hits |
| `grep "redirect('/dashboard')" src/actions/auth.ts` | 0 hits |

## Deviations from Plan

None substantive — plan executed as written. One in-flight self-correction: my new doc comments in `role-home.ts` and the dashboard shim initially contained the literal tokens the spec's negative assertions ban (`'use server'`, `AdminDashboard`); reworded in the Task 2 commit. Not a plan deviation, just comment wording.

## Requirements note

`requirements: [UX-01]` NOT marked complete in REQUIREMENTS.md: the UX-01 line includes "no nav item points at Dashboard", and TopHeader/BottomTabBar nav repointing is explicitly 30-04 scope (plan objective). 30-04 marks it when the nav sweep lands.

## Known Stubs

None in production code. The single remaining `test.fixme` in role-homes.spec.ts (TopHeader zero-/dashboard) is the deliberate 30-04 handoff.

## Threat Flags

None — no new endpoints, no auth-path changes beyond redirect targets (T-30-02-01: middleware redirect remains a landing decision, every admin page guard unchanged; T-30-02-02: JWT read via shared parseJwtPayload, absent claim → /pending).

## Commits

| Commit | Description |
|--------|-------------|
| `2e946fa` | feat(30-02): roleHome helper, dashboard redirect shim, /pending, not-found boundary |
| `0082ff8` | feat(30-02): route login/middleware/activity dispatch via roleHome; journeys land on real homes |

## Self-Check: PASSED

role-home.ts, /pending page, not-found.tsx, and SUMMARY exist on disk; commits `2e946fa` + `0082ff8` in git log; phase30/phase26.5/phase25-e2e/tsc/build all green.
