# Phase 09 Deferred Items

Out-of-scope discoveries logged during plan execution. Not fixed — candidate work for future cleanup plans.

## From 09-04

### ReviewClient.tsx pre-existing lint issues

- `react-hooks/set-state-in-effect` error at line 43: `useEffect` calls `setApprovedCount` synchronously. Cascading-render anti-pattern per React 19 guidance. Pre-existing from Phase 02-03.
- Unused imports/vars: `MoreVertical`, `menuOpen`, `setMenuOpen`. Pre-existing from Phase 04 menu refactor.

Out of scope for 09-04 (purpose: add pipeline breadcrumb). Consider addressing in a ReviewClient cleanup plan.
