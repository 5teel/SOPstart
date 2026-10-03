---
phase: 55-cut-the-dropped-features-one-organisation
plan: 09
subsystem: offline-layer
tags: [deletion, offline, dexie, serwist, service-worker, kill-switch, middleware, sweep]
requires:
  - phase: 55-02
    provides: worker path off Dexie
  - phase: 55-03
    provides: builder path off Dexie, direct photo upload
provides:
  - offline layer (lib/offline, sync/photo/draft hooks, network store, banner, install prompt, dead photo-list chain) deleted
  - Serwist worker retired; committed self-unregistering public/sw.js, served to signed-out browsers
  - offline sweep and worker-path (55-09) contract live and mutation-proven
affects: [55-13, 55-14]
key-files:
  created:
    - public/sw.js
  modified:
    - next.config.ts
    - .gitignore
    - src/lib/supabase/middleware.ts
    - src/app/(protected)/layout.tsx
    - src/components/providers/QueryProvider.tsx
    - src/hooks/useCompletions.ts
    - src/components/admin/builder-v2/EditableDocument.tsx
    - src/lib/journeys/journeys.ts
    - playwright.config.ts
    - package.json
    - tests/phase55/deletion-sweep.spec.ts
    - tests/phase55/worker-path-contract.spec.ts
  deleted:
    - src/lib/offline/, src/stores/network.ts, src/app/sw.ts, src/app/~offline/
    - src/hooks/{useSopSync,usePhotoQueue,useDraftLayoutSync,useOnlineStatus,useAssignedSops}.ts
    - src/components/layout/{InstallPrompt,OnlineStatusBanner}.tsx
    - src/components/sop/{WalkthroughList,StepItem,StepPhotoZone,PhotoThumbnail}.tsx
    - tests/offline-sync.test.ts, tests/offline-indicator.test.ts
decisions:
  - public/sw.js kill-switch never touches IndexedDB (T-55-05 accepted residue until Phase 62)
  - /sw.js exempted in session middleware by exact-path match
  - bundle gate went DOWN (926 / 818 KB vs baseline 1048 / 940); baseline NOT recaptured (55-13 owns that)
metrics:
  commits: 3 task commits
  completed: 2026-10-03
---

# Phase 55 Plan 09: Offline layer and service worker retired Summary

Dexie/sync/photo-queue/banner/install-prompt code is gone, and the Serwist worker is replaced by a committed `public/sw.js` that clears Cache Storage, unregisters itself and reloads open tabs; `/sw.js` is exempt from the session middleware so signed-out update checks reach it.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1 Delete offline layer, banners, install prompt, photo-list chain | d0fd8eb | Only deleted-chain files and layout.tsx referenced them; tsc clean |
| 2 Retire Serwist, commit kill-switch, exempt /sw.js | d79a97e | next.config plain export, nextDynamic cacheGroup and 3 redirects kept; build green; `public/sw.js` byte-identical after build |
| 3 Specs, config, journeys, flip sweep + contract | 9c22d67 | offline sweep and 55-09 contract live; no fixme left in worker-path-contract |

## Verification

- `npx tsc --noEmit` clean; `npm run build` clean.
- Bundle gate: `/sops/[sopId]` 926 KB, `/sops` 818 KB (baseline 1048 / 940, delta -122 KB each); isolation, source-viewer, Konva and marker checks OK. Baseline file untouched.
- `phase55 phase52 phase30 phase26 phase3-stubs phase15-stubs`: 433 passed, 50 skipped, 0 failed. `phase11-stubs`: only the 8 pre-existing 55-BASELINE-FAILURES rows fail.
- Dead-href lint: 4 passed.
- Mutation proofs: planted `import { db } from '@/lib/offline/db'` in `src/lib/auth/guards.ts` turned the `offline` sweep red; re-adding `/public/sw.js` to `.gitignore` turned the service-worker contract red; both reverted to green (phase55: 86 passed, 29 skipped).
- Deployed `/sw.js` check: NOT done in this run (orchestrator pushes at phase end). After deploy: `curl -s https://sopstart.com/sw.js` must return the kill-switch body (contains `unregister()`), not the login page; 55-14 asserts zero registrations.

## Deviations from Plan

**1. [Rule 3 - Blocking] `package.json` `test:e2e` script removed.** It pointed at the deleted `e2e` Playwright project and would error. Not in the plan's file list.

**2. [Rule 3 - Blocking] Additional stale guards repointed.** `tests/sb-layout-editor.test.ts` (SB-LAYOUT-D08-purge test read deleted `draftLayouts-purge.ts`/`sync-engine.ts`/`useSopSync.ts`; test removed, the already-red baseline tests in that file left alone) and `tests/phase30/dead-weight.spec.ts:70` (negative assertion naming `useAssignedSops`, tripped the offline sweep; line removed).

**3. [Rule 1] `tests/phase52/plant-pins-no-storage.spec.ts` (d):** besides deleting (c) as planned, dropped the now-meaningless `@/lib/offline/db` value-import assertion.

**4.** The plan's `.gitignore` note said the stale `public/sw.js` was build output; it was untracked-ignored, so the new file is the first tracked version. No `sw.js.map` or `swe-worker-*` artifacts existed.

## Known Stubs

None.

## Threat Flags

None. `/sw.js` public exemption is T-55-09-01 (accepted, exact path, static script).

## Self-Check: PASSED

Commits d0fd8eb, d79a97e, 9c22d67 exist; `public/sw.js` tracked; deleted paths absent.
