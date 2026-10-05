---
phase: 59-the-office
plan: 03
subsystem: shell
tags: [shell, place-address, tabs, office, tailwind]
requires: [59-01]
provides:
  - room `tab` on Place; parsePlace(token, tab) / formatPlace (`/?place=office&tab=...`)
  - src/lib/shell/office-tabs.ts (OFFICE_TABS, OfficeTab, WIDE_TABS, tabsForRole, isWidePlace)
  - src/lib/shell/query-keys.ts (SHELL_KEY, OFFICE_INBOX_KEY)
  - ShellFrame officeTabs / initialTab props, wide detail pane, Esc guard
  - ShellProps.initialTab / initialSop threaded from page.tsx
affects: [59-09, 59-10, 59-11, 59-12, 59-13]
key-files:
  created:
    - src/lib/shell/office-tabs.ts
    - src/lib/shell/query-keys.ts
  modified:
    - src/lib/shell/place.ts
    - src/components/shell/ShellFrame.tsx
    - src/components/shell/WorkerShell.tsx
    - src/components/shell/AdminShell.tsx
    - src/app/page.tsx
    - tests/phase57/shell-structure.spec.ts
    - tests/phase57/one-query.spec.ts
    - tests/phase59/place-tab.spec.ts
    - tests/phase59/shell-wide.spec.ts
key-decisions:
  - "Tab resolution lives in resolvePlace (render time); select() stays the single place writer, so the camera re-flies once per tab change via placeKey"
  - "initialSop is accepted by the shells' props but not consumed yet; the Access tab (59-11) reads it"
requirements-completed: []
completed: 2026-10-05
---

# Phase 59 Plan 03: Office tab and wide pane Summary

**The Office place now carries a whitelisted, role-checked tab; Decisions, People and Access widen the detail pane to 58% (min 560 px) with the map live; Esc respects dialogs and lightboxes.**

SHL-06 is not ticked: the tabbed pane itself mounts in 59-12.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 10995750 | place tab, office-tabs module, query-keys module, place-tab spec (live) |
| 2 | d051b996 | ShellFrame wide class / role resolution / Esc guard, page + shell threading, 57 repoints, shell-wide spec (live) |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0.
- phase59 `place-tab` + `shell-wide`: 12 passed; whole phase59: 23 passed, 84 fixme/live-skip. phase57: 118 passed. phase15-stubs: 50 passed (incl. design-tokens, no-static-admin-lens-import). phase58 legacy-redirects: 6 passed.

## Bundle gate

```
check-bundle-size: /page = 832 KB (baseline 831 KB, Δ +1 KB, tolerance ±2 KB)
check-bundle-size: /sops/[sopId]/page = 793 KB (baseline 792 KB, Δ +1 KB, tolerance ±2 KB)
check-bundle-size: ✓ Bundle isolation OK
```
`git diff --stat -- .bundle-baseline.json` is empty (baseline untouched).

## Compiled CSS hits (`.next/static/css/*.css`)

```
.lg\:min-w-140{min-width:calc(var(--spacing) * 140)}
.lg\:w-\[58\%\]{width:58%}
.lg\:w-100{width:calc(var(--spacing) * 100)}
```

## Deviations from Plan

**1. [Rule 3 - Blocking] `tests/phase57/one-query.spec.ts` pinned the literal `['shell-admin']` inside AdminShell**
- Moving `SHELL_KEY` to `query-keys.ts` (required by the plan) turned it red. Repointed in the same commit: one definition in query-keys.ts, AdminShell imports it and no longer spells the key. Not in the plan's file list.
- **Commit:** d051b996

**2. [Minor] The "tab the role may not see falls back to the Inbox" case** lives in `shell-wide.spec.ts` (it greps ShellFrame, which Task 2 changes) rather than `place-tab.spec.ts`, so Task 1 committed green.

## Known Stubs

None. `initialSop` is threaded but intentionally unused until 59-11.

## Threat Flags

None. T-59-10/11/12 mitigations are in place (whitelist parse, resolvePlace tab check, no navigation added).

## Self-Check: PASSED

- Files exist: office-tabs.ts, query-keys.ts, 59-03-SUMMARY.md.
- Commits in git log: 10995750, d051b996.
