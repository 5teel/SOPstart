---
phase: 30-ux-consolidation
plan: 06
subsystem: worker-sop-detail
tags: [ux-05, ux-08, ux-04, tab-merge, dead-weight, bundle-baseline, dept-filter]
requires:
  - 30-01 (phase30 harness + bundle baseline 1057 KB)
  - 30-05 (create-entry consolidation — this plan removes the last create entry, the worker tab)
provides:
  - 3-tab worker SOP detail (Read · Walk it · Flow) with legacy ?tab= mapping (overview|tools|hazards|model→read, walkthrough→walk) accepted forever
  - merged ReadTab (Overview+Tools+Hazards) — ONE isPpeSection, equipment once, "Current as of" caption, no governance gate (D28-07)
  - worker dept filter FIXED (real sop_departments junction fetch), Create SOP tab removed
  - deletions: ModelTab, WalkthroughTab shim, OverviewTab/ToolsTab/HazardsTab, /sops/[sopId]/walkthrough route+layout
  - re-baselined worker bundle (1056 KB)
affects:
  - 30-07/30-08 (final gate: phase28/29/30 all green at this point; journeys walkthrough entries resolved)
tech-stack:
  added: []
  patterns:
    - "Legacy-param choke point: LEGACY_TAB_MAP applied before isSopTabId in one resolver — old deep-links work everywhere forever"
    - "Live RLS policy verification via Supabase Management API before adding a client-side junction read (decision #3 protocol)"
key-files:
  created:
    - src/components/sop/tabs/ReadTab.tsx
  modified:
    - src/components/sop/SopTabNav.tsx
    - src/components/sop/tabs/index.ts
    - src/app/(protected)/sops/[sopId]/page.tsx
    - src/app/(protected)/sops/page.tsx
    - src/lib/journeys/journeys.ts
    - tests/phase28/library-and-worker.spec.ts
    - tests/phase30/tab-merge.spec.ts
    - tests/phase30/dead-weight.spec.ts
    - .bundle-baseline.json
  deleted:
    - src/components/sop/tabs/ModelTab.tsx
    - src/components/sop/tabs/WalkthroughTab.tsx
    - src/components/sop/tabs/OverviewTab.tsx
    - src/components/sop/tabs/ToolsTab.tsx
    - src/components/sop/tabs/HazardsTab.tsx
    - src/app/(protected)/sops/[sopId]/walkthrough/page.tsx
    - src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx
decisions:
  - "Decision #3 resolved as FIX: sop_departments SELECT policy live-verified via Management API pg_policies query — using(true) for authenticated — so the placebo filter became a real client-side junction fetch (sopDeptMap) instead of being removed"
  - "OverviewTab/ToolsTab/HazardsTab deleted alongside Model/Walkthrough (tab-merge spec contract requires their absence; nothing imports them after the merge)"
  - "Bundle re-baselined 1057 → 1056 KB via capture script (merge REDUCED First Load JS by 1 KB, as predicted)"
metrics:
  duration: ~25m
  completed: 2026-07-12
requirements-completed: [UX-05, UX-08, UX-04]
---

# Phase 30 Plan 06: Worker 3-Tab Merge + Dead-Weight Sweep Summary

**One-liner:** Worker SOP detail collapsed 6 tabs → Read · Walk it · Flow with a permanent legacy ?tab= map, merged ReadTab rendering PPE/equipment once with the D28-07 caption-no-gate contract intact, walkthrough route + Model/Walkthrough/Overview/Tools/Hazards tabs deleted, worker Create-SOP tab removed, dept filter made real (live-verified RLS read), bundle re-baselined at 1056 KB (−1 KB).

## What was built

### Task 1 — 3-tab registry + legacy map + merged ReadTab (commit `6daa738`)
- `SOP_TABS = ['read','walk','flow']`; `TAB_DEFS` = Read / Walk it / Flow.
- `LEGACY_TAB_MAP` (overview|tools|hazards|model → read, walkthrough → walk) applied in a single `resolveTab()` BEFORE the `isSopTabId` guard — used by both `useActiveTab` and `SopTabNav`, default `'read'`. Old QR/bookmark deep-links land forever; the existing `router.push('?tab=…', {scroll:false})` handler shape kept.
- `ReadTab.tsx`: Overview + Tools + Hazards concatenated into one scrollable brief — title/pills, SOP Details table (**"Current as of" caption preserved**), Equipment once (was Overview AND Tools), Tools-by-Step, Certifications, PPE once with ONE `isPpeSection` (was copy-pasted in ToolsTab + HazardsTab), Hazards, step-level alerts, section map. Zero `review_due_at`/`owner_user_id` references, zero governance-action imports, zero static imports from `components/sop/walkthrough/`.
- Render switch on `sops/[sopId]/page.tsx` → Read/Walk/Flow; Walk mounts ONLY `WalkthroughSwitcher` (bundle trap avoided); skeleton tab bar 6 → 3.

### Task 2 — Deletions + worker create tab + real dept filter + phase28 repoint (commit `ec24b6d`)
- Deleted: `ModelTab.tsx`, `WalkthroughTab.tsx` shim, `OverviewTab.tsx`, `ToolsTab.tsx`, `HazardsTab.tsx`, `/sops/[sopId]/walkthrough/{page,layout}.tsx`. `tabs/index.ts` exports only ReadTab + FlowTab.
- Dead-href sweep: only remaining `/sops/[sopId]/walkthrough` strings were journeys.ts entries (repointed in Task 3); no code hrefs existed (matches 30-RESEARCH Inventory B).
- Worker `/sops`: "Create SOP" tab removed (UX-04 final entry) along with its now-dead `userRole` query + `Upload` icon import.
- Dept filter (decision #3): **live-verified** `sop_departments` SELECT policy via Management API (`pg_policies`: `sop_departments_read_all_auth`, cmd SELECT, roles {authenticated}, qual `true`) → FIXED the filter: client-side `sop_departments` fetch builds `sopDeptMap` (sop_id → dept ids); selected departments filter assigned SOPs by junction intersection. Placebo `return true` + TODO gone.
- `tests/phase28/library-and-worker.spec.ts` repointed: OverviewTab constants/describe → ReadTab; deleted-walkthrough-route no-gate assertion dropped (invariant now asserted on ReadTab + the detail route).

### Task 3 — Re-baseline + journeys + specs live (commit `59e57d5`)
- `npm run build` clean; postbuild gate: **1056 KB vs 1057 baseline (Δ −1 KB)**, DesktopWalkthrough + WalkthroughVoiceModal both present as separate dynamic chunks, pdfjs/mammoth/konva isolation OK.
- `.bundle-baseline.json` regenerated via `scripts/capture-bundle-baseline.ts` (1056 KB, 19 chunks) — **justification: intentional UX-05 chunk shift; the merge reduced First Load JS**, never hand-edited.
- `journeys.ts`: all 5 walkthrough-route entries repointed to `/sops/[sopId]` with "Walk it tab (?tab=walk)" labels/details; tab-list description now "Tabs: read, walk, flow". Zero `/sops/[sopId]/walkthrough` strings remain.
- `tab-merge.spec.ts` flipped live + extended: legacy-map target assertions, PPE-once (single `isPpeSection` count), bundle-trap source contracts (no walkthrough import in ReadTab; page mounts walkthrough only via WalkthroughSwitcher), baseline-file sanity.
- `dead-weight.spec.ts`: ModelTab/WalkthroughTab (+ barrel), walkthrough route, dept-filter-wired (junction fetch + `sopDeptMap` usage + no Create SOP), journeys-clean assertions all flipped live.

## Verification results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean |
| `npm run build` + postbuild bundle gate | clean — 1056 KB, Δ −1 KB vs old baseline; both walkthrough chunks separate |
| `npx playwright test --project=phase30 --project=phase28` | 66 passed / 16 skipped (remaining fixmes for later plans + live-DB skips), 0 failed |
| `npx playwright test --project=phase29 --project=phase21-stubs` | 111 passed, 0 failed |
| `grep "sops/\[sopId\]/walkthrough" src` | 0 hits; route dir deleted |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Render switch updated in Task 1, not Task 2**
- **Found during:** Task 1 tsc gate
- **Issue:** Plan slated `sops/[sopId]/page.tsx` for Task 2, but Task 1's `tsc --noEmit` acceptance cannot pass with `active === 'overview'` comparisons against the shrunk `SopTabId` union
- **Fix:** Render switch + imports moved into the Task 1 commit; Task 2 kept the deletions
- **Commit:** `6daa738`

**2. [Rule 3 - Blocking] Stale `.next/types` referenced the deleted walkthrough route**
- **Found during:** Task 2 tsc gate
- **Issue:** Generated `.next/types` stubs (from the previous build) imported the deleted route files, failing `tsc --noEmit`
- **Fix:** Removed `.next/types` (generated artifact; regenerated clean by Task 3's `npm run build`)
- **Commit:** n/a (untracked build artifact)

**3. [Rule 1 - Bug] Two spec-flip iterations**
- **Found during:** Task 3 first spec run
- **Issue:** (a) my own UX-04 comment in `sops/page.tsx` contained the literal "Create SOP", tripping the dead-weight `not.toContain` assertion; (b) the stub's quoted-string loop (`'overview'`) didn't match the unquoted `LEGACY_TAB_MAP` keys
- **Fix:** Reworded the comment; replaced the loop with explicit per-key mapping regexes (stronger assertion — checks targets, not just token presence)
- **Commit:** `59e57d5`

## Requirements completion (ownership notes)

- **UX-05** — complete here (3-tab merge, legacy mapping, PPE/equipment once, bundle gates).
- **UX-08** — final item closed here (dept filter + Model/Walkthrough/route deletions); earlier items landed in 30-01 (BuilderWithSourceViewer), 30-02 (dashboard), 30-04 (bell, pathways/uat links).
- **UX-04** — final item closed here (worker Create-SOP tab); the method picker + admin button collapse landed in 30-05 (per its handoff note).

## Known Stubs

None — ReadTab is fully wired to real SOP data; the dept filter performs a real junction fetch; no placeholder/empty-value stubs introduced.

## Threat Flags

None new. T-30-06-01 mitigated: the `sop_departments` SELECT policy was verified live (Management API pg_policies) BEFORE adding the worker client read — the read crosses no RLS boundary it isn't granted. T-30-06-02 mitigated: ReadTab carries no review/owner gate, asserted by the repointed phase28 spec + tab-merge spec.

## Commits

| Commit | Description |
|--------|-------------|
| `6daa738` | feat(30-06): 3-tab worker registry + legacy param map + merged ReadTab |
| `ec24b6d` | feat(30-06): delete Model/Walkthrough tabs + walkthrough route; worker create tab gone; real dept filter |
| `59e57d5` | test(30-06): re-baseline bundle (1057→1056 KB), repoint journeys Walk-tab, flip tab-merge + dead-weight specs live |

## Self-Check: PASSED

ReadTab.tsx + SUMMARY exist; walkthrough route dir confirmed deleted; commits `6daa738`, `ec24b6d`, `59e57d5` in git log; tsc + build (bundle gate Δ −1 KB) + phase28/29/30/21-stubs all green.
