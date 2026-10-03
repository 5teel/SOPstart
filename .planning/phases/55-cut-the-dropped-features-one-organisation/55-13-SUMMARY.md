---
phase: 55-cut-the-dropped-features-one-organisation
plan: 13
subsystem: build-hygiene
tags: [deletion, packages, bundle-baseline, d-07, docs]
requires:
  - phase: 55-12
    provides: invitation-only sign-up; all 13 feature sweeps live
provides:
  - eight dropped packages uninstalled, lockfile updated
  - package sweep live and mutation-proven; every dropped feature live
  - env template and codebase docs describing the shipped app
  - bundle baseline moved down by hand (D-07)
affects: [55-14]
key-files:
  modified:
    - package.json
    - package-lock.json
    - tests/phase55/deletion-sweep.spec.ts
    - tests/phase37/gap-org-guards.spec.ts
    - .env.local.example
    - .planning/codebase/STACK.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STRUCTURE.md
    - .bundle-baseline.json
    - .planning/ROADMAP.md
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-VALIDATION.md
decisions:
  - "[Phase 55] D-07: bundle baseline moved down by hand: /sops/[sopId]/page 1048 -> 817 KB, /sops/page 940 -> 817 KB; capture script not run"
metrics:
  commits: 4
  completed: 2026-10-03
---

# Phase 55 Plan 13: Close out the deletion

**The eight dropped packages are gone, the whole dropped list is enforced, the docs match the app, and the bundle gate now measures from the smaller post-cut app (1048 -> 817 KB and 940 -> 817 KB, edited by hand).**

## Tasks

| Task | Commit | Result |
|---|---|---|
| 1 Uninstall packages, make list live | 21a812e | 8 packages removed, `PACKAGES_LIVE = true`, phase55 115 passed, 0 fixme |
| 2 Env template and codebase docs | 2b86ac8 | Shotstack block and Deepgram "voice capture" wording gone; STACK/INTEGRATIONS/ARCHITECTURE/STRUCTURE rewritten |
| 3 D-07 baseline + decision records | 8e11d49 | baseline hand-edited, ROADMAP + VALIDATION updated |
| (fix) | c25019b | see Deviations |

## Task 1 evidence

Importer grep (`from`/`require`/`import()`/subpath, over `src scripts tests next.config.ts`): **0 hits** for each of dexie, idb-keyval, serwist, @serwist/next, @tanstack/query-persist-client-core, jsqr, qrcode, @types/qrcode.

`git diff package.json` removes exactly those eight entries (7 dependencies, 1 devDependency). optionalDependencies (win32 oxide, lightningcss, `supabase`) untouched; `build` still `next build --webpack`. konva, react-konva, tesseract.js, tus-js-client, openai, heic2any, ffmpeg-static, @ffmpeg/* confirmed present. Lockfile diff is removals plus npm re-flagging transitive packages `"dev": true` / `"optional": true`; no new package fetched.

Mutation proof: added `"jsqr": "1.4.0"` to package.json dependencies (no install), `phase55 -g "no dropped package"` went RED ("Still installed: jsqr"); reverted, phase55 115 passed.

`scripts/dropped-features.json` already listed all eight packages and all 13 features (offline, voice-capture, voice, phone-qr, shared-device, youtube, photo-scan, video-generation, flow-diagram, annotation, version-compare, library, org-signup); nothing to add.

## Task 3: bundle (D-07)

| Route | Pre-phase measured | Old baseline | Post-cut measured | New baseline |
|---|---|---|---|---|
| `/sops/[sopId]/page` | 1045 KB | 1048 KB | 817 KB | 817 KB |
| `/sops/page` | 936 KB | 940 KB | 817 KB | 817 KB |

Both routes smaller than before the phase. Rebuild after the edit: both routes Delta 0 KB, all isolation and marker checks OK. Move-down-only node check printed `baseline moved down only`. `history` array added to `.bundle-baseline.json` (old 1048/940 kept; the 2026-07-29 `previousBaseline` entry kept). **`scripts/capture-bundle-baseline.ts` was not run** and no Phase 55 commit touches it. phase41 bundle-gate (4) and phase30 tab-merge (7) specs pass. Decision recorded in the ROADMAP Phase 55 section and the commit message; STATE.md decision added via the state tool.

The known `%5BsopId%5D` blind spot in `check-bundle-size.ts` was left alone, per instructions.

## Full suite (run once, after the discovery fix below)

1745 passed, 172 skipped, 20 failed. Compared with `55-BASELINE-FAILURES.md`:

| Class | Baseline | Now | Verdict |
|---|---|---|---|
| Non-live | 16 | 14 | all 14 are in the baseline list; SB-LAYOUT-04 and SB-LAYOUT-D08 (baseline #4, #9) no longer fail |
| Live probes (phase46 `verifyOtp` rate limit) | 8 | 6 | environment, not code |
| New failures | - | 0 | none |

The 14: sb-auth-builder (1), sb-layout-editor (6: 01, 02, D01-preview, 06, 13-unknown, 16), sb-section-schema SB-SECT-05, sb-ux-blocks (4), sb-ux-blueprint SB-UX-01, wizard-sop-dept A4. The 6 phase46 failures carry `verifyOtp failed: Request rate limit reached`.

## Deviations from Plan

**1. [Rule 1 - Bug] `tests/phase37/gap-org-guards.spec.ts` read `admin/sops/[sopId]/video/page.tsx` at module load.** Phase 55-08 deleted that page, so the first full-suite attempt died at test discovery (`ENOENT`, 0 tests run, no results). Removed the dead `VIDEO_PAGE` read and its "video versions page org-scope guard" describe (the page it guarded no longer exists). Then ran the full suite once for real. Commit c25019b. Discovery now lists 1937 tests.

## Package-registry / external checks

Nothing fetched or installed; uninstall only (T-55-SC). `npm run build` green after uninstall.

## Stale project CLAUDE.md (flag for Simon, not edited)

`CLAUDE.md` still describes Dexie, Serwist, idb-keyval and tesseract in the Technology Stack; lists `~offline/`, the offline hooks (`useAssignedSops`, `usePhotoQueue`, `useSopSync`, `useOnlineStatus`), the `network` store and `src/lib/offline/` under Architecture; and has an "Offline Strategy" section. All now false. Update when logging this phase's Learnings. `.planning/codebase/CONCERNS.md` also still mentions Dexie/Serwist.

## Push note

Not pushed (orchestrator pushes at phase end). Railway runs `npm ci` with the new lockfile on that push; confirm the deploy before 55-14's eval.

## Known Stubs

None.

## Threat Flags

None. T-55-SC and T-55-13-02 mitigated (diff limited to eight removals); T-55-13-01 mitigated (move-down-only check against both snapshots, capture script not run, decision recorded).

## Self-Check: PASSED

Commits 21a812e, 2b86ac8, 8e11d49, c25019b exist; none of the eight packages in package.json; `.bundle-baseline.json` routes 817/817.
