---
phase: 30-ux-consolidation
plan: 03
subsystem: admin-nav
tags: [admin-nav, settings-hub, ux-02, sub-nav-dedupe, journeys]
requires:
  - 30-01 (phase30 harness + admin-nav.spec.ts stub)
provides:
  - src/components/admin/AdminNav.tsx — the ONE shared admin sub-nav (SOPs · Governance · Blocks · Team · Settings), active via prop, presentation only
  - /admin/settings hub — groups AI Settings, Departments, and the agent layer; gives /admin/agent its first inbound link
  - 5 inline "Admin sections" sub-navs (3 styling idioms) deleted — grep 'aria-label="Admin sections"' src/app == 0
  - Governance nav item deep-links /admin/sops?view=attention (decision #1; folded view lands in 30-08)
affects:
  - 30-04 (TopHeader account-menu collapse — its fixme test flips there)
  - 30-08 (governance fold consumes ?view=attention; ApprovalChainPanel relocates to Settings then)
tech-stack:
  added: []
  patterns:
    - "AdminNav active-key prop for server-rendered pages (no client hooks; .tab data-active idiom)"
    - "Settings hub tile = the DashTile blueprint-frame link pattern"
key-files:
  created:
    - src/components/admin/AdminNav.tsx
    - src/app/(protected)/admin/settings/page.tsx
  modified:
    - src/app/(protected)/admin/sops/page.tsx (inline nav → <AdminNav active="sops" />)
    - src/app/(protected)/admin/governance/page.tsx (inline nav → active="sops"; Link import dropped)
    - src/app/(protected)/admin/blocks/page.tsx (inline nav → active="blocks")
    - src/app/(protected)/admin/team/page.tsx (inline nav → active="team"; /dashboard back-link preserved)
    - src/app/(protected)/admin/departments/page.tsx (60-line inline-style nav → active="settings"; Link import dropped)
    - src/lib/journeys/journeys.ts (enter-admin-tools decision mirrors AdminNav; /admin/settings screen mapped)
    - tests/phase30/admin-nav.spec.ts (flipped live: 4 live / 1 fixme)
decisions:
  - "Departments page passes active=\"settings\" — the Settings hub is its home (plan said 'their tab'; Departments has no own tab; CONTEXT UX-02 folds it under Settings, and the hub links to it)"
  - "Governance page passes active=\"sops\" per plan (Governance is a view of SOPs; the page itself dies in 30-08)"
  - "Live spec drops the stub's ApprovalChainEditor-in-settings assertion — plan explicitly defers the panel relocation to 30-08"
  - "AdminNav keeps aria-label=\"Admin sections\" (a11y); the must_have bans it only OUTSIDE AdminNav, and the acceptance grep scopes to src/app"
  - "UX-02 NOT marked complete in REQUIREMENTS.md — the requirement line includes the account-menu collapse, which is 30-04 scope (same handoff pattern as 30-02/UX-01)"
metrics:
  duration: ~20m
  completed: 2026-07-13
---

# Phase 30 Plan 03: One Admin Nav (UX-02) Summary

**One-liner:** Shared 5-item AdminNav (SOPs · Governance→?view=attention · Blocks · Team · Settings) mounted on all 5 admin pages replacing the 3-idiom copy-pasted sub-navs, plus a new /admin/settings hub that homes AI Settings, Departments, and the previously-orphaned /admin/agent — every per-page role guard untouched.

## What was built

### Task 1 — AdminNav + /admin/settings hub (commit `1f224ce`)
- `src/components/admin/AdminNav.tsx`: server component, 5 `.tab` Links from a typed `ITEMS` array, `data-active` from an `active: AdminNavKey` prop (simplest for server-rendered pages per plan). Governance item hrefs `/admin/sops?view=attention` (decision #1 interim wiring; harmless extra param until 30-08 reads it). CSS-var tokens only.
- `src/app/(protected)/admin/settings/page.tsx`: modelled on the ai-settings shell; `['admin', 'safety_manager']` guard copied verbatim (redirect('/dashboard') — the 30-02 shim forwards per decision #5). Renders `<AdminNav active="settings" />` + 3 blueprint-frame tiles linking `/admin/ai-settings`, `/admin/departments`, `/admin/agent`. ApprovalChainPanel NOT relocated (30-08 scope per plan).

### Task 2 — Sub-nav sweep + journeys + spec flip (commit `f0f48c5`)
- All 5 admin pages now import and render `<AdminNav active="…" />`: sops→`sops`, governance→`sops`, blocks→`blocks`, team→`team`, departments→`settings`. Net −171/+65 lines.
- Unused `Link` imports dropped where the nav was the only user (governance, departments); team's inline `/dashboard` back-link preserved verbatim (decision #5).
- `journeys.ts` (same commit as the nav change per CLAUDE.md pathways rule): enter-admin-tools decision rewritten to the AdminNav shape, `/admin/settings` mapped as a screen, `/admin/ai-settings` kept mapped (reached via the hub).
- `admin-nav.spec.ts` flipped live — 4 live tests: (1) 5 items + 5 canonical hrefs incl. the ?view=attention deep-link, (2) each page imports AND renders AdminNav + zero `aria-label="Admin sections"` + guard string survives (T-30-03-01 wiring-level assertions), (3) settings page guard + 3 links, (4) journeys maps /admin/settings. TopHeader account-menu test stays fixme for 30-04.

## Verification results

| Gate | Result |
|------|--------|
| `grep -rn 'aria-label="Admin sections"' src/app` | 0 hits |
| `npx playwright test --project=phase30` | 10 passed / 28 skipped / 0 failed |
| `npx playwright test --project=phase28 --project=phase29` | 122 passed / 3 skipped / 0 failed (governance page edit regression-checked) |
| `npx tsc --noEmit` | clean |
| `npm run build` + postbuild bundle gate | clean — 1057 KB, Δ 0 KB; all isolation checks OK |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Research said 5 `aria-label="Admin sections"` sites; only 3 existed**
- **Found during:** Task 2 pre-sweep grep
- **Issue:** blocks/page.tsx and team/page.tsx used their own nav idioms WITHOUT the aria-label (the "3 styling idioms"), so a label-only grep sweep would have missed them
- **Fix:** Swept all 5 by reading each page's nav block directly; the grep==0 criterion still holds and the spec asserts AdminNav rendering per-file rather than relying on the label grep alone
- **Commit:** `f0f48c5`

No other deviations — plan executed as written (spec content follows the plan's live-flip instruction, which superseded the Wave-0 stub's ApprovalChainEditor assertion).

## Requirements note

`requirements: [UX-02]` NOT marked complete in REQUIREMENTS.md: the UX-02 requirement includes "Account menu → one Admin link", which is explicitly 30-04 scope (the spec's remaining fixme). 30-04 marks it.

## Known Stubs

None in production code. The single remaining `test.fixme` in admin-nav.spec.ts (TopHeader collapse) is the deliberate 30-04 handoff. The Governance nav item's `?view=attention` param is inert until 30-08 reads it — intentional interim wiring per orchestrator decision #1, resolved by 30-08.

## Threat Flags

None — new /admin/settings route copies the ai-settings guard verbatim and fetches nothing beyond links (T-30-03-02); every existing admin page guard is byte-identical (T-30-03-01, spec-asserted); no package installs (T-30-03-SC).

## Commits

| Commit | Description |
|--------|-------------|
| `1f224ce` | feat(30-03): shared AdminNav component + /admin/settings hub |
| `f0f48c5` | feat(30-03): mount AdminNav on all 5 admin pages, delete inline sub-navs |

## Self-Check: PASSED

AdminNav.tsx + settings/page.tsx + SUMMARY exist on disk; commits `1f224ce` and `f0f48c5` in git log; grep==0, phase30/phase28/phase29/tsc/build all green.
