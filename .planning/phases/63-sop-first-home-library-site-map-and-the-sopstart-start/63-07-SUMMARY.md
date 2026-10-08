---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 07
subsystem: ui
tags: [office-pane, sections, role-gates, source-contract]
requires: [63-02]
provides:
  - src/components/home/sections/SignOffsSection.tsx (SignOffsSection)
  - src/components/home/sections/PeopleSection.tsx (PeopleSection)
  - OfficePane({ tab, tabs, onTab, initialSop })
affects: [63-11, 63-19, 63-20]
key-files:
  created:
    - src/components/home/sections/SignOffsSection.tsx
    - src/components/home/sections/PeopleSection.tsx
    - tests/phase63/sections-office.spec.ts
  modified:
    - src/components/office/OfficePane.tsx
    - src/components/shell/AdminShell.tsx
    - src/components/shell/WorkerShell.tsx
    - tests/phase59/office-pane-structure.spec.ts
key-decisions:
  - "The pane lost its own heading: each section now owns the heading, so the pane is a plain tabbed body. Its tablist label is 'Tabs' (was 'Office')"
  - "A requested tab not in `tabs` renders tabs[0] at render time (was a hard-coded inbox), so People opens on People & roles"
  - "HomeTab and OfficeTab are the same literal union, so sections pass tabsFor(...) and onTab straight through with no cast"
requirements-completed: []
duration: 25min
completed: 2026-10-08
---

# Phase 63 Plan 07: Sign-offs and People sections Summary

**The Office pane is now place-free (`tab`, `tabs`, `onTab`, `initialSop`), and two plain sections drive it: Sign-offs (Inbox, Requests, Decisions for admin / safety manager) and People (People & roles, Access, pinned by `pin`). Built unmounted; 63-11 mounts them.**

## New props and adapters

- `OfficePane` no longer imports `@/lib/shell/place` or `useRole`, and never calls `select`. The tab strip renders only `tabs` and calls `onTab(t)`.
- `AdminShell` and `WorkerShell` each pass `tab={place.tab ?? null} tabs={tabsForRole(role)} onTab={...ctx.select(room office)} initialSop`; the old home behaves as before until 63-20 deletes it.

## Words changed

- Pane `<h2>Office</h2>` removed (sections carry "Sign-offs" / "People"); tablist `aria-label` "Office" -> "Tabs"; the old shells' loading line "Opening the Office…" -> "Opening…". Every testid and bundle-gate marker literal is untouched. Code comments that name the Office were left alone.
- `tests/evals/office.eval.ts` still finds the tablist by name "Office" (lines 375, 480); the repoint inventory assigns that file to 63-18, which rewrites it. It self-skips without `EVAL_BASE_URL`.

## Spec

`tests/phase63/sections-office.spec.ts` (`office sections`, 4 cases): tabs come from `tabsFor('signoffs'|'people', role)` never a literal list; the pane is reached only via `dynamic(`; headings carry no number and no "Office"; `tabsFor` over both sections equals `tabsForRole` for admin, safety manager, supervisor, worker and null (R2: no gate widens). `tests/phase59/office-pane-structure.spec.ts` repointed in the same commit (asserts `onTab(`, no `@/lib/shell/place`, no `select(`, the shell adapters).

## Verification

- `npx tsc --noEmit` clean; eslint clean on the touched files.
- phase59 146 passed; phase63 office sections 4/4; `tests/lint` 42/42.
- phase60: 1 failure, `ask-do-sop.spec.ts:150` (`git diff --quiet f1b2ff93 -- src/hooks/useWorkerSops.ts`). Not caused by this plan: 63-05 (`edf20637`) extracted `libraryQueryFn` in `useWorkerSops.ts`, which this git-diff pin forbids. Left for the orchestrator (the pin should be repointed or the extraction reconsidered); it is not in `63-BASELINE.md` because it appeared after 63-05.
- `npm run build` postbuild gate green: `/page` 837 KB (baseline 837, delta 0), `/sops/[sopId]/page` 795 KB (baseline 795, delta 0). `.bundle-baseline.json` untouched.

## Deviations from Plan

**1. [Rule 3 - Blocking] Pane heading removed rather than renamed.** The plan said Office words become the section's name; the sections already render that heading, so keeping a second one in the pane would double it. Old shells lose the pane heading until deleted in 63-20.

Otherwise none; the capability gates are unchanged.

## Known Stubs

None. The sections are intentionally unmounted until 63-11.

## Self-Check: PASSED
