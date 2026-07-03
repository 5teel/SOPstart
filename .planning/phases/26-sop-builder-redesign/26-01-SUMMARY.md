---
phase: 26-sop-builder-redesign
plan: 01
subsystem: infra
tags: [dnd-kit, konva, react-konva, dependencies, supply-chain, drag-and-drop, canvas-annotation]

# Dependency graph
requires:
  - phase: 26-sop-builder-redesign (RESEARCH)
    provides: Package Legitimacy Audit ([ASSUMED] table + peer-dep sanity for the five deps)
provides:
  - "@dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/modifiers@9.0.0 installed (block reorder foundation, R2)"
  - "konva@10.3.0, react-konva@19.2.5 installed (admin-only diagram annotation foundation, R5)"
  - "package-lock.json pinned to exact versions; tsc green with React 19.2.4 / Next 16"
affects: [26-sop-builder-redesign waves 3+ (dnd-kit reorder), waves 7+ (konva Visual block)]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/modifiers", "konva", "react-konva"]
  patterns:
    - "Supply-chain gate: blocking human-verify before installing [ASSUMED] deps (never auto-approvable)"
    - "Exact version pinning in dependencies for supply-chain-sensitive packages (no caret)"
key-files:
  created: []
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Pinned all five to EXACT versions (no ^) — supply-chain safety; lockfile root spec now matches"
  - "Installed as regular dependencies, NOT optionalDependencies — cross-platform (the [2026-04-04] Windows-only-optional rule applies only to Tailwind/lightningcss native binaries)"
  - "No application file imports konva/react-konva yet — kept out of every bundle until the admin-only dynamic import lands in a later wave"

patterns-established:
  - "Package-legitimacy gate: [ASSUMED] deps require human confirmation of registry page + empty postinstall before install"

requirements-completed: [R2, R5]

# Metrics
duration: 6min
completed: 2026-07-03
---

# Phase 26 Plan 01: Bespoke-Editor Dependency Install Summary

**Installed and version-pinned the five foundation deps for the full-bespoke SOP editor — @dnd-kit (core/sortable/modifiers) for block reorder and konva/react-konva for admin-only diagram annotation — all postinstall-free and tsc-green with React 19.2.4.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-03T03:37:28Z
- **Completed:** 2026-07-03T03:43:00Z
- **Tasks:** 1 (Task 2; Task 1 pre-install legitimacy gate cleared in prior turn)
- **Files modified:** 2

## Accomplishments
- Installed the five [ASSUMED] deps at exact pinned versions after the blocking human-verify legitimacy gate was approved
- Confirmed empty `scripts.postinstall` for all five (supply-chain check per T-26-SC mitigation)
- Verified all five resolve at import and `npx tsc --noEmit` is clean (no peer/type break with React 19.2.4 / Next 16)
- Confirmed no application file under `src/` imports konva/react-konva yet — worker bundle untouched

## Task Commits

1. **Task 2: Install the five pinned dependencies** - `057ecd5` (chore)

**Plan metadata:** pending final docs commit (this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `package.json` - Added @dnd-kit/core@6.3.1, @dnd-kit/modifiers@9.0.0, @dnd-kit/sortable@10.0.0, konva@10.3.0, react-konva@19.2.5 to `dependencies` (exact-pinned)
- `package-lock.json` - Lockfile resolved + root spec pinned to exact versions (11 packages added incl. transitive deps)

## Decisions Made
- **Exact pins over caret ranges:** npm added `^` by default; changed to exact versions and re-ran `npm install` to reconcile the lockfile root spec — supply-chain-sensitive packages should not drift on future installs.
- **Regular dependencies, not optionalDependencies:** dnd-kit/konva are cross-platform; the [2026-04-04] Windows-only-optional rule is specific to the Tailwind/lightningcss native msvc binaries and does NOT apply here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Pinned exact versions instead of npm's default caret ranges**
- **Found during:** Task 2 (install)
- **Issue:** `npm install <pkg>@x.y.z` writes `^x.y.z` into package.json, allowing future minor/patch drift on a supply-chain-gated dependency set — contradicts the plan's version-pinning intent (`@6.3.1` etc. in the artifact spec).
- **Fix:** Edited package.json to exact versions (no `^`) and re-ran `npm install` to update the lockfile root spec.
- **Files modified:** package.json, package-lock.json
- **Verification:** `grep` confirmed exact pins in both files; `npx tsc --noEmit` re-green (resolved node_modules unchanged).
- **Committed in:** 057ecd5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / supply-chain hardening)
**Impact on plan:** Strengthens the plan's stated version-pinning goal. No scope creep, no new imports.

## Issues Encountered
None. `npm audit` reports 15 pre-existing vulnerabilities (1 low / 10 moderate / 4 high) — these predate this install and are out of scope (logged as project-wide, not introduced by these five deps).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- dnd-kit available for the reorder path (R2) starting Wave 3
- konva/react-konva available for the Visual/Konva annotation path (R5) starting Wave 7 — must be dynamic-imported (admin-only) so workers never download Konva
- No code imports the new deps yet; bundle unaffected

## Self-Check: PASSED

- Commit `057ecd5` present in git log
- `26-01-SUMMARY.md` exists
- package.json + package-lock.json pinned to exact versions (`react-konva": "19.2.5"` confirmed)

---
*Phase: 26-sop-builder-redesign*
*Completed: 2026-07-03*
