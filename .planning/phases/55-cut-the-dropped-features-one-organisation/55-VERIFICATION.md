---
phase: 55-cut-the-dropped-features-one-organisation
verified: 2026-10-03T14:00:00Z
status: passed
score: 7/7 must-haves verified (deployed eval re-run at post-review HEAD 2d60b43: 28/0/1, screenshots read — orchestrator 2026-10-03)
overrides_applied: 0
re_verification: false
gaps: []
deferred:
  - truth: "uat/tests.ts still carries a shared-device roster-login feedback test (and 4 other roster/voice/offline/QR mentions)"
    addressed_in: "Phase 62"
    evidence: "CUT-05: the pathways map and the feedback (UAT) page are rebuilt to describe the one-screen app and show no screen that no longer exists"
  - truth: "IndexedDB residue (SopAssistantDB, tanstack-query) left on devices"
    addressed_in: "Phase 62"
    evidence: "Deliberate (D8): not deleted because a device may hold an unsent completion. public/sw.js comment: 'Phase 62 sweeps those databases'"
human_verification:
  - test: "Confirm the second deployed eval run (npm run eval -- --phase 55) is green against HEAD after the review fixes (a4b7a6f and later), and read the cut-walk-phone, cut-walk-signoff and cut-existing-completion screenshots"
    expected: "28 pass / 0 fail / 1 pre-existing skip, as at 04d493a. The walk with a photo, the submit with nothing queued and the admin sign-off row all still pass."
    why_human: "The only deployed eval on record (55-EVAL.md) is at ffd0cc4/04d493a. The review fixes (ec560bf..a4b7a6f) rewrote the photo, completion and signature path after it. The orchestrator is running the second eval, so I did not run it. Screenshots need a human or agent eye (CSS-token bugs are invisible to assertions)."
---

# Phase 55: Cut the Dropped Features & One Organisation - Verification Report

**Phase Goal:** The app stops carrying what did not make the MVP and serves one organisation. Offline, voice, phone scan and QR plates, shared-device login, video generation, flow diagram, annotation, YouTube and photo-scan on-ramps, library pages and version compare/restore are deleted (routes, components, API endpoints, packages, scheduled jobs; DB rows stay). Sign-up stops creating organisations. The worker path keeps working against the server. Starts the dropped list. Bundle script updated, baseline moves down only.
**Verified:** 2026-10-03
**Status:** passed (all automated checks pass; deployed eval at post-review HEAD 2d60b43 green, 28/0/1 — cut-walk-phone + cut-walk-signoff screenshots read by the orchestrator)
**Re-verification:** No. Initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CUT-01: offline, voice, phone/QR, shared-device login are unreachable and unshipped | VERIFIED | The route tree (`find src/app -name page.tsx/route.ts`) has no `/m`, `/login/roster`, `/api/voice/*`, `/api/sops/youtube`, `generate-video*`, `recover-renders`. `src/lib/offline` is gone. `grep -ri` over `src/` for `@/lib/offline`, `/api/voice`, `'/m/`, `rosterWorkerId`, `jsqr`, `serwist`, `idb-keyval`, `from 'dexie'`, `deepgram-stream`, `useVoice`, `PhotoScanner` returns 0 hits. `tests/phase55` sweeps for voice-capture, voice, phone-qr, shared-device, offline are live and green. |
| 2 | CUT-02: video generation, flow diagram, annotation, YouTube and photo-scan on-ramps, library pages, version compare/restore are unreachable and unshipped | VERIFIED | `restoreVersionAsNew`, `getSopVersionForDiff`, `FlowDiagram`/`flow-diagram` have 0 hits in `src/`. There is no `versions/diff`, no `/admin/library`, no flow route. The on-ramps left are upload, `new/ai`, `new/blank` and record-video. Sweeps for youtube, photo-scan, video-generation, flow-diagram, annotation, version-compare and library are live and green. Remaining "youtube" hits are DB-row compatibility only (`INPUT_TYPES` enum, legacy source viewer fallback). They are not an on-ramp. `shotstack` appears only in generated DB types (rows stay, per the goal). |
| 3 | Eight packages uninstalled | VERIFIED | `package.json` has none of dexie, idb-keyval, serwist, @serwist/next, @tanstack/query-persist-client-core, jsqr, qrcode, @types/qrcode (checked by `node`). The package sweep test passes. The survivors (tesseract.js, react-konva, ffmpeg) are retained as designed. |
| 4 | ORG-01: sign-up creates no organisation, no switch, join by invitation | VERIFIED | `src/actions/auth.ts` exports no `signUpOrganisation`/`switchOrganisation` (0 hits in `src/`). `/sign-up` is a static "SOPstart is by invitation" page with no form. `auth.signUp(` has 0 hits in `src/`. The invitation channel (`inviteWorker`, `acceptInvite`, `joinWithInviteCode`, `/join`, `/invite/accept`) is intact. Supabase `disable_signup = true`, confirmed by my own read-only GET of the project auth config. |
| 5 | Worker path (pins, next-SOP card, walk, photo, completion) works and reads/writes the server directly | VERIFIED | `useWorkerSops` reads `getUserSopAssignments` plus the Supabase `library-sops` query, with error surfacing. `useStepPhotos` uploads straight through `getPhotoUploadUrl` with no queue. `MobileWalkthrough` calls `submitCompletion` with `uploadedPhotos`. The sops page has no sync/offline labels. The deployed eval at 04d493a passed the walk, photo, submit and admin sign-off rows (28/0/1). The post-review rerun at 2d60b43 also passed (28/0/1). |
| 6 | Dropped list started and enforced | VERIFIED | `scripts/dropped-features.json` has 127 entries (68 file, 11 route-page, 13 route-api, 6 dir, 13 symbol, 8 package, 6 ai-model-key, 2 job), 13 features. `npx playwright test --project=phase55`: **120 passed, 0 fixme/skip**. All 13 features and the packages block are live. The survivor list and not-vacuous assertions pass. The two `allow` entries (accent-voice token, inert VoiceNoteBlock) are justified. |
| 7 | Bundle script updated, baseline moved down only, recorded as a decision | VERIFIED | `scripts/check-bundle-size.ts` has no voice/phone marker group or voice-chunk assertion. `.bundle-baseline.json` is 817/817 against the pre-phase 1048/940, with a `history` entry for each route marked "pre-Phase 55" and a hand-edit note. `capture-bundle-baseline.ts` is unchanged. The decision is recorded in ROADMAP.md:1737 and STATE.md:578. My `npm run build` exits 0: 818 KB on both routes, Δ +1 KB, tolerance ±2, all isolation and marker checks OK. |

**Score:** 7/7 truths verified.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `scripts/dropped-features.json` | VERIFIED | 127 entries, read by the sweep spec (not vacuous) |
| `tests/phase55/{deletion-sweep,worker-path-contract,org-single}.spec.ts` | VERIFIED | All live, 120 pass |
| `public/sw.js` | VERIFIED | Kill-switch: `caches.delete`, `registration.unregister()`. `/sw.js` is exempted in `src/lib/supabase/middleware.ts`. The deployed eval confirmed it is served. |
| `src/app/(auth)/sign-up/page.tsx` | VERIFIED | Static invitation-only page |
| `.bundle-baseline.json` | VERIFIED | Moved down by hand, history retained |
| `55-EVAL.md` | VERIFIED (pre-fix HEAD) | 28 pass / 0 fail / 1 pre-existing skip at `04d493a` |

### Key Link / Data-Flow

| From | To | Status |
|------|----|--------|
| `useWorkerSops` | Supabase `sops` (RLS) and `getUserSopAssignments` | FLOWING (real queries, error not masked as empty) |
| `MobileWalkthrough` | `useStepPhotos` then `getPhotoUploadUrl`, then `submitCompletion` with `photoStoragePaths` | WIRED. The review fix scopes photos to the active completion. |
| `recordSignature` | session user only, supervisor role check | WIRED (CR-02 fix at `completions.ts:337-340`) |
| `journeys.ts` | real routes only | WIRED. `no-dead-internal-hrefs` passes, including "route docs name only routes that exist". |

### Behavioral Spot-Checks and Gates

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean (no output) |
| `npx playwright test --project=phase55` | 120/120 pass, 0 fixme |
| `npx playwright test tests/lint/` | 33/33 pass (dead hrefs, design tokens, RLS org-scope, undefined CSS tokens, admin-lens imports) |
| `npm run build` | exit 0, bundle gate OK (Δ +1 KB vs the new 817 baseline) |
| Full suite (not re-run, per instruction) | 55-13 record: 1745 pass / 20 fail. 14 are pre-phase baseline rows, 6 are `verifyOtp` rate-limit, 0 new. This is consistent with `55-BASELINE-FAILURES.md`. |
| Probe execution (7c) | SKIPPED. The phase declares no `probe-*.sh`. |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| CUT-01 | 55-01..06, 09, 13, 14 | SATISFIED | Truths 1, 3, 6 |
| CUT-02 | 55-01, 07, 08, 10, 11, 13, 14 | SATISFIED | Truths 2, 3, 6 |
| ORG-01 | 55-01, 12, 14 | SATISFIED | Truth 4 |

No orphaned requirements. REQUIREMENTS.md maps only these three IDs to Phase 55, and all three appear in plan frontmatter. All 14 SUMMARY files exist.

### Anti-Patterns

No TBD/FIXME/XXX markers in phase-touched `src/`, `scripts/`, `tests/phase55`, `tests/evals`, `public` or `next.config.ts`. No stubs found in the worker-path hooks. The 55-REVIEW critical findings (CR-01 stale photos, CR-02 `recordSignature` authorization) and warnings WR-01..04 are fixed in code (`ec560bf..a4b7a6f`), with contract assertions in `worker-path-contract.spec.ts`.

### Warnings / Info (non-blocking)

| Item | Severity | Note |
|------|----------|------|
| `src/lib/uat/tests.ts` still has a shared-device roster-login test (around line 395-409) plus 4 other roster/voice/offline/QR mentions | Warning, deferred | The `/uat` page shows a test for a feature that no longer exists. CUT-05 / Phase 62 rebuilds this page, so it is not a Phase 55 gap. CLAUDE.md treats `tests.ts` updates as "when worth team review". |
| REQUIREMENTS.md traceability table still says CUT-01..02 "Pending" while the checkboxes are `[x]` (ORG-01 reads "Complete") | Info | Bookkeeping. Flip it at phase close. |
| 55-REVIEW IN-02 (kill-switch force-reloads controlled tabs; a mid-walk worker loses progress once on deploy day) and IN-03 (`joinWithInviteCode` still re-points `active_org_id`) | Info | Left open by the reviewer as out of scope. Neither blocks a success criterion. |
| `HEAD` (`bc525b9`, docs only) is one commit ahead of `origin/master` | Info | The review fixes are already on origin. |
| Decision deviation D2 (research: keep `cloneSopAsDraft`) | Info | Honoured. The survivor guard is live. |

## Human Verification Required

### 1. Post-review deployed eval

**Test:** Confirm the orchestrator's second `npm run eval -- --phase 55` run at the current HEAD finishes green. Read `cut-walk-phone.png`, `cut-walk-signoff.png` and `cut-existing-completion.png`.
**Expected:** 28 pass / 0 fail / 1 pre-existing skip (the walk with a photo, nothing queued, and the admin sign-off row with its photo).
**Why human:** The recorded eval (`55-EVAL.md`) predates the review fixes that rewrote the photo-path validation, the photo insert and `recordSignature`. Those paths are covered statically (contract specs, tsc, build) but not yet on the deployed site. Per CLAUDE.md, screenshots must be read before a pass is declared.

## Gaps Summary

No gaps. Every must-have resolves to VERIFIED. Every dropped route, component, endpoint and package is gone, all three requirement IDs are accounted for, sign-up is closed at both the app and Supabase layers, the D-07 baseline moved down only and is recorded, and typecheck, the phase55 sweep, the lint guards and a production build are all clean. The only open item is the pending deployed-eval rerun at the post-review HEAD, which the orchestrator already has in flight. If it is green, the phase can be marked passed.

---

_Verified: 2026-10-03_
_Verifier: Claude (gsd-verifier)_
