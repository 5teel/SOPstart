---
phase: 57-the-one-screen-its-places
plan: 06
subsystem: shell / auth landing / retirement
tags: [header-removal, back-bar, role-home, dashboard-redirect, dropped-list, pathways]
requires: [57-05]
provides:
  - "BackToSite bar (data-testid back-to-site) on every protected page"
  - "roleHome -> / for all four roles, /pending otherwise"
  - "/dashboard as a fixed server redirect to /"
  - "dropped-list feature header-nav (3 files + /dashboard route)"
affects: [57-07, 57-08, 57-09, 57-10]
key-files:
  created:
    - src/components/layout/BackToSite.tsx
  modified:
    - "src/app/(protected)/layout.tsx"
    - "src/app/(protected)/pending/page.tsx"
    - src/lib/auth/role-home.ts
    - next.config.ts
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - scripts/dropped-features.json
  deleted:
    - src/components/layout/TopHeader.tsx
    - src/components/layout/NotificationBadge.tsx
    - src/components/layout/NavPendingSpinner.tsx
    - "src/app/(protected)/dashboard/page.tsx"
    - tests/phase30/admin-nav.spec.ts assertions (header ones; file kept for the settings guard and journeys mapping)
decisions:
  - "Back bar is a plain div, not header/nav, so the no-header structure guard stays simple"
  - "BackToSite renders nothing on /pending (placeForPath returns null); /pending gets its own sign-out form"
  - "Journeys: the role decision collapses to two branches (any role -> the one screen, no role -> pending)"
metrics:
  tasks: 3
  commits: 3
  completed: 2026-10-05
---

# Phase 57 Plan 06: The header is gone, everyone lands on / Summary

One plain "Back to the site" bar replaces the header on every protected page, sign-in lands all four roles on `/`, and `/dashboard` is a fixed server redirect to `/` with every page guard repointed.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 536b159 | BackToSite, layout rewrite onto ProtectedProviders, header trio deleted, /pending sign-out, header-reading specs repointed |
| 2 | 5580b37 | roleHome -> /, ARCHITECTURE.md, roles.ts, log-in journey, role-homes / route-truth specs, retirement-sweep roleHome half |
| 3 | 670477b | /dashboard page deleted + next.config redirect, 14 guards repointed, journeys cleaned, `header-nav` on the dropped list, inventory flipped live |

## What changed

- `BackToSite` uses `placeForPath(usePathname())`: Office pages -> `/?place=office`, `/activity` -> smoko, new-SOP pages -> workshop, everything else `/`, nothing on `/pending`.
- Layout keeps the `/login` redirect and `RouteTransition`; `userEmail` and the inline providers are gone.
- `/pending` has `<form action={signOut}>` with `pending-sign-out` (the header carried the only sign-out for a role-less user).
- The guards repointed from the dashboard to `/` are the twelve admin/activity pages, `governance/page.tsx` and `platform-admin-guard.ts`. Each keeps its role check; only the fallback destination changed.
- `/governance` is untouched: the page exists and no redirect has it as a source (asserted in retirement-sweep).
- Repoints: admin-nav (header assertions removed, settings/journeys kept), dead-weight, create-entry (now points at `room-workshop-new` in AdminRoomBodies), role-homes, nav-and-shim, reference-sweep, site-workspace-wiring (header Site entry only), sb-auth-builder, route-truth, governance-queue, governance-fold, agent-dashboard, org-chart-build, sb-builder-infrastructure (line 13 only), admin-departments (kept green until 57-07 deletes it), plus deletion-sweep (`header-nav` in FEATURES and LIVE_FEATURES, phase 55 or 57 accepted).

## Dashboard spelling sweep

Command: `grep -rnE "redirect[^\n]{0,12}/dashboard|/dashboard" tests --include=*.ts` plus `grep -rn "'/dashboard'" src` and a bare-word check on edited files.

Hits (all repointed in the Task 3 commit): `tests/phase26.5/agent-dashboard.spec.ts:25`, `tests/phase32/org-chart-build.spec.ts:132`, `tests/sb-auth-builder.test.ts:22`, `tests/sb-builder-infrastructure.test.ts:13`, `tests/phase28/governance-queue.spec.ts:14,69`, `tests/phase30/governance-fold.spec.ts:75`, `tests/phase30/role-homes.spec.ts` (negatives moved to retirement-sweep), `tests/e2e/admin-departments.spec.ts:7,141-143` (bare word). `tests/integration/departments-rls.spec.ts:148` is prose inside a fixme and matches no token; left alone. No hit used a double-quote, template-string or regex-escaped spelling beyond those listed. Final `grep -rnE "redirect\(\s*['\"\`]/dashboard" src tests | grep -v tests/phase57/` returns nothing.

## Supabase Auth allow-list (RESEARCH A1)

Read with the management token: `uri_allow_list = https://sopstart.com/**, https://sopstart.co.nz/, https://www.sopstart.co.nz/, https://app.sopstart.co.nz/`. It names neither `/sops` nor `/dashboard`; no change needed. `site_url` is still `http://localhost:3000` (pre-existing, not touched).

## Verification

- `npx tsc --noEmit`: clean (after `npm run build` regenerated `.next/types`; before that, stale generated types referenced the deleted dashboard page).
- `npm run build`: exit 0, postbuild bundle gate passed. `/` = 566 KB (baseline 792 KB, -226 KB); `/sops` = 811 KB (baseline 817 KB, -6 KB); `/sops/[sopId]` = 811 KB (baseline 817 KB, -6 KB). `.bundle-baseline.json` untouched.
- Playwright, each project run once: phase57 102 passed; phase55 125 passed; phase30 46; phase41 54; phase51 79 (live RLS probes included, no rate-limit hit); phase43 9; phase53 11; phase26.5 42; phase28 41; phase32 52; phase25-e2e (admin-departments) 20; phase15-stubs 80 (design-tokens, no-dead-internal-hrefs included).
- phase11-stubs: 8 failed / 19 passed. All 8 are pre-existing and unrelated: SB-AUTH-01 asserts the wizard uses `useForm` (removed in 40-08, commit 4feff6f), plus seven sb-layout-editor / sb-section-schema assertions on code this plan does not touch. The SB-AUTH-05 and sb-builder-infrastructure tests this plan edited pass. Not in the required list beyond the two files named by the plan; reported, not fixed.
- sb-auth-builder and sb-builder-infrastructure run under phase11-stubs (no separate projects).

## Residue (grep dashboard in src)

Remaining hits are the agent dashboard (`/admin/agent`, AgentPanel, synthesis, proposals), a prose comment in `/pending` and `PageShell`, and historic UAT prose in `src/lib/uat/tests.ts`. No `/dashboard` string, `TopHeader`, `NotificationBadge` or `NavPendingSpinner` remains in src; tests outside tests/phase57 hold none either.

## Deviations from Plan

**1. [Rule 1 - Bug] phase43 dead-controls spec red from 57-05**
- Found during: Task 2 verification (phase43 project).
- Issue: `tests/phase43/dead-controls.spec.ts` pinned `<WizardClient departments={departments} />`; 57-05 added the `machineId` prop.
- Fix: repointed the literal to include `machineId={machineId}`. Committed with Task 2 (5580b37).

**2. [Rule 3] `src/lib/uat/tests.ts` prose mentioned the old header by component name**
- The acceptance grep for the header names across src demanded zero hits; reworded two historic lines to "the old header". Task 1 commit.

**3. Orphan CSS left in place**: `.nav-pending-in` in `globals.css` served the deleted spinner and now has no user. Left (not in plan, harmless); a later cleanup can drop it.

## Known Stubs

None.

## Threat Flags

None. The `/dashboard` redirect destination is a fixed string (T-57-24); guards keep their role checks (T-57-25); redirects are server-side only (T-57-26).

## Self-Check: PASSED

Created/deleted files verified on disk; commits 536b159, 5580b37, 670477b present. STATE.md and ROADMAP.md not modified; nothing pushed.
