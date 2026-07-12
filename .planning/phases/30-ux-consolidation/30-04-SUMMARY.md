---
phase: 30-ux-consolidation
plan: 04
subsystem: global-header
tags: [top-header, account-menu, dead-weight, ux-01, ux-02, ux-08, journeys]
requires:
  - 30-02 (roleHome(role) — the brand-link destination)
  - 30-03 (shared AdminNav — makes the one Admin link sufficient)
provides:
  - TopHeader consolidated — single account-menu "Admin" link → /admin/sops (isAdminRole-gated), no Dashboard nav item, brand link → roleHome(role), fake notifications bell deleted, Pathways/Feedback relocated to the account menu (TOOLING_LINKS)
  - dead-weight.spec.ts TopHeader assertions live (bell, pathways/uat placement, nav-model wiring)
  - 30-02 handoff fixme flipped (role-homes: TopHeader zero /dashboard) + 30-03 handoff fixme flipped (admin-nav: one Admin link)
  - UX-01 + UX-02 marked complete in REQUIREMENTS.md (deferred to this plan by 30-02/30-03)
affects:
  - 30-08 (final journeys sweep — remaining UX-08 fixmes: ModelTab, walkthrough route, dept filter)
tech-stack:
  added: []
  patterns:
    - "Account menu = the only door to admin + team tooling; primary nav stays a 2-item worker surface (SOPs · Activity)"
    - "Source-contract wiring assertions extract the BASE_LINKS/TOOLING_LINKS const blocks via regex instead of whole-file toContain (2026-06-05 presence-vs-wiring rule)"
key-files:
  created: []
  modified:
    - src/components/layout/TopHeader.tsx (ADMIN_LINKS→ADMIN_LINK, BASE_LINKS 5→2, brand→roleHome(role), bell block + NotificationBadge import deleted, TOOLING_LINKS menu block added, isActive /dashboard case dropped)
    - src/lib/journeys/journeys.ts (give-feedback reaches Pathways/Feedback via account menu; enter-admin-tools notes the one Admin link + brand→roleHome)
    - tests/phase30/dead-weight.spec.ts (2 fixmes flipped live + new nav-model wiring test)
    - tests/phase30/role-homes.spec.ts (30-02 handoff fixme live)
    - tests/phase30/admin-nav.spec.ts (30-03 handoff fixme live + tightened)
decisions:
  - "Pathways/Feedback account-menu items are ungated (everyone) — CONTEXT UX-08 says move, not gate; pages are team tooling kept for all roles"
  - "TOOLING_LINKS rendered as their own bordered menu group between Admin and Profile, reusing the existing menuitem markup verbatim"
  - "admin-nav flipped test tightened beyond the stub: also asserts '/admin/blocks' and '/admin/team' absent from TopHeader (the collapse is real, not just the ai-settings item gone)"
  - "UX-08 NOT marked complete — bell + pathways move done here, but ModelTab/walkthrough-route/shims/dept-filter remain fixme for the later sweep plan"
metrics:
  duration: ~15m
  completed: 2026-07-13
---

# Phase 30 Plan 04: Global Header Consolidation Summary

**One-liner:** TopHeader collapsed to the UX-01/02/08 contract — 2-item primary nav, brand→roleHome(role), one isAdminRole-gated "Admin" menu link to /admin/sops, fake bell deleted (badge stays in BottomTabBar), Pathways/Feedback in the account menu — with journeys updated same-commit and all three phase30 header fixmes flipped live.

## What was built

### Task 1 — TopHeader consolidation (commit `d9eacb6`)
- `ADMIN_LINKS` (Manage SOPs / Blocks / Team / AI Settings) → single `ADMIN_LINK = { label: 'Admin', href: '/admin/sops' }`, rendered inside the same `isAdmin` block (gate unchanged, T-30-04-01: visibility only — every admin page keeps its server guard).
- `BASE_LINKS` 5→2 (SOPs · Activity); Dashboard item and the `isActive` `/dashboard` special-case removed; brand link `href={roleHome(role)}`.
- Notifications bell block (fake — linked to /sops) and the `NotificationBadge` import deleted from TopHeader; BottomTabBar's legitimate badge usage untouched.
- New `TOOLING_LINKS` (Pathways · Feedback) rendered as an account-menu group using the existing menuitem markup.
- BottomTabBar verified free of `/dashboard` (tabs: /sops, /activity, /profile) — no change needed.

### Task 2 — journeys nav model + spec flips (commit `b1354f7`)
- `journeys.ts` (same-commit rule): `give-feedback` journey gains an "Open the account menu" step before /pathways//uat; `enter-admin-tools` summary + home-step detail note the single account-menu Admin link and brand→roleHome.
- `dead-weight.spec.ts`: bell test and pathways/uat test flipped live with wiring-level assertions (const-block extraction, `TOOLING_LINKS.map` rendered); new live test asserts zero `/dashboard`, `href={roleHome(role)}` import+usage, every `/admin/*` string === `/admin/sops`, `href={ADMIN_LINK.href}` wiring, `isAdminRole(role)` gate present.
- `role-homes.spec.ts` (30-02 handoff) + `admin-nav.spec.ts` (30-03 handoff) fixmes flipped live.

## Verification results

| Gate | Result |
|------|--------|
| `grep -rn "/dashboard" src/components/layout` | 0 hits |
| `grep -n 'aria-label="Notifications"' TopHeader` | 0 hits |
| `npx tsc --noEmit` | clean (both tasks) |
| `npx playwright test --project=phase30` | 15 passed / 24 skipped / 0 failed |

## Deviations from Plan

None - plan executed exactly as written. (The role-homes/admin-nav fixme flips were explicit prior-wave handoffs to this plan, noted in both summaries and the executor brief.)

## Requirements note

- **UX-01 + UX-02 marked complete** in REQUIREMENTS.md — both were fully delivered pending only this plan's nav/account-menu slice (per 30-02 and 30-03 summary handoffs).
- **UX-08 NOT marked** — this plan closes the bell + pathways/uat items; ModelTab, walkthrough route, legacy shims, and the no-op department filter remain (still fixme in dead-weight.spec.ts) for the later sweep plan.

## Known Stubs

None in production code. Remaining `test.fixme` entries in dead-weight.spec.ts are deliberate handoffs to the UX-05/UX-08 sweep plans (ModelTab, walkthrough route, dept filter, journeys removed-route grep).

## Threat Flags

None — no new endpoints or auth paths. T-30-04-01 mitigated as planned: the Admin link visibility gate (`isAdminRole`) is identical to the old ADMIN_LINKS gate and is spec-asserted; server-side page guards untouched.

## Commits

| Commit | Description |
|--------|-------------|
| `d9eacb6` | feat(30-04): consolidate TopHeader — one Admin link, no Dashboard nav, fake bell deleted, Pathways/UAT to account menu |
| `b1354f7` | test(30-04): journeys nav model + flip TopHeader assertions live |

## Self-Check: PASSED

TopHeader.tsx/journeys.ts/spec edits on disk; commits `d9eacb6` + `b1354f7` in git log; grep gates 0-hit; phase30 15 passed / 0 failed; tsc clean.
