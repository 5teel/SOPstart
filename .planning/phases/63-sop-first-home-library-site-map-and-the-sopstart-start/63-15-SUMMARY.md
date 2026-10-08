---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 15
subsystem: brand-motion
tags: [fuse, waapi, autostart, resume, deployed-eval, bundle-gate]
requires: [63-11, 63-13]
provides:
  - src/lib/brand/fuse.ts (motionMode, slowFactor, captureSlowFlag, whenQueriesIdle, prefetchFuse, playFuse)
  - src/lib/brand/fuse-engine.ts (lazy WAAPI merge, run)
  - "#fuse-layer in the root layout; focusHref go / fresh; FocusWalker autostart"
  - tests/evals/start.eval.ts (five deployed cases, no test.fixme)
affects: [63-16, 63-17, 63-18, 63-21]
key-files:
  created:
    - src/lib/brand/fuse.ts
    - src/lib/brand/fuse-engine.ts
    - tests/phase63/fuse-wiring.spec.ts
  modified:
    - src/app/layout.tsx
    - src/components/layout/RouteTransition.tsx
    - src/components/home/ReadView.tsx
    - src/lib/sop/focus-path.ts
    - src/app/(protected)/sops/[sopId]/page.tsx
    - src/components/focus/FocusWalker.tsx
    - src/components/focus/ResumeCard.tsx
    - src/components/focus/BrowseDocument.tsx
    - scripts/check-bundle-size.ts
    - tests/phase58/frame-structure.spec.ts
    - tests/phase58/edit-rail.spec.ts
    - tests/evals/start.eval.ts
key-decisions:
  - "Navigate when the screen has faded to paper, not in the tap: playFuse resolves at the end of stage 1 and the push follows (3 s guard). Pushing in the tap swapped Read for the focus page's loading skeleton while the veil was ~20% in (seen in the first slow-motion frame)."
  - "The font-ready check reads the first family only (Saira 800 and 600 by name): document.fonts.check over the whole list is false for ever on the deploy because next/font adds an unloaded size-adjusted fallback face, so the merge silently never played there (it did locally)."
  - "The rise waits for the walker: the autostart placeholder carries data-fuse-hold and the engine keeps the veil up (max 2.5 s) until it is gone; on the deploy the page takes ~2 s and startWalk ~1.6 s more."
  - "Engine, store and layer: #fuse-layer is plain server markup (no JS in the root chunk); the engine is only reached through import('./fuse-engine'); slow motion is the sessionStorage flag set from ?fuse=slow."
requirements-completed: [FUSE-01, FUSE-02, HOME-03]
completed: 2026-10-08
---

# Phase 63 Plan 15: The Start Summary

**Tapping start on Read plays the merge (button body fades leaving "start", SOP chip drops into line, they slide together, hazard tape slides in from the left, the wordmark rises into the focus top bar) and lands in the running SOP at its current step; resume and begin-again speak the new words and keep the confirmation. Proven on https://sopstart.com: 5 of 5 cases green, every frame read.**

## Deployed sha tested

- Final run: `7753690f` (`/api/version` confirmed serving it before the run), 5/5 pass, all screenshots read.
- Earlier runs, each of which found something: `bd57f1c1` (merge never played on the deploy: font check, below) and `b01edff2` (case 2 absolute-time assertion, below). A local `next start` build on :4200 was used first to judge the motion frame by frame; the local server was stopped afterwards.

## Design as built

| Part | What it is |
|---|---|
| Timings | Read at run time from `--dur-fuse-fade 180 / drop 300 / shift 320 / tape 340 / hold 140 / rise 420` ms and `--ease-fuse`; x`--fuse-short-scale` (0.3) after the first start of the day; x4 with the slow flag; none under `prefers-reduced-motion` (no node is ever created) |
| Layer | `<div id="fuse-layer" aria-hidden class="pointer-events-none fixed inset-0 z-50">` after `{children}` in the root layout; every node the engine adds is `pointer-events:none` |
| Handler order (ReadView `onStart`) | ignore if already starting; build `focusHref(id, { from, go: true })`; `motionMode()`; if animating and the font is ready -> `playFuse(rects)` and, when it resolves (screen is paper), `go()`; otherwise `go()` at once. `go()` = push now unless a query or mutation is in flight, else push when they settle (<= 3 s). No `await`, no server action, no navigation from an effect (T-63-42) |
| Autostart guards | `?go=1` is `=== '1'` only, carried through both server redirects; FocusWalker starts once (`useRef`), only when the version is live, the SOP has steps and the page is in browse mode; strips `go` with `history.replaceState`; never touches the router. If the start fails, the browse page shows with its error (no loop) |
| begin again | `?fresh=1` strips itself the same way and opens ResumeCard's discard dialog (`initialAsking`); "Keep going" closes it and nothing is discarded (R6) |
| Words | primary `start` (Wordmark on ink, `aria-label="start"`) with "Picks up at step N of M"; secondary "or begin from step 1"; dialog "Your ticks and photos so far will be thrown away." / Keep going; browse "Updated since you last did it" |
| Bundle | `fuse engine (lazy, 63-15)` marker added to both gated routes; `/sops/[sopId]/page` 802 KB (baseline 802, +0), `/page` 832 KB (baseline 831, +1; tolerance 2). `.bundle-baseline.json` untouched |

## Results (last run of each case, deployed `7753690f`)

| # | Case | Result | Screenshots read (one-line reading) |
|---|---|---|---|
| 1 | FUSE-01 start plays the merge into the running SOP (slow-motion frames) | pass | `63-fuse-0-read` .. `63-fuse-8-running`, see frame readings below |
| 2 | FUSE-01 second start of the day is short; reduced motion cuts | pass | `63-fuse-reduced`: running hazard step, wordmark in the bar, nothing left in the layer; short start 2927 ms vs cut 1835 ms to the step (the page itself takes ~1.8 s on the deploy; difference asserted < 1.5 s) |
| 3 | FUSE-02 start lands on step 1, Stop returns to Read, second start works | pass | `63-fuse-landed`: hazard step 1 of 5, rail with the first row current and the rest locked, no browse page; `63-fuse-stopped-read`: Read of the same SOP, status "You stopped at step 1", "Picks up at step 1 of 5 · or begin from step 1", row in Recent |
| 4 | FUSE-02 stopped SOP picks up at step N; begin from step 1 asks first | pass | `63-fuse-resume-read`: "You stopped at step 3" in status, Recent row and button note "Picks up at step 3 of 5"; `63-fuse-begin-again`: focus page with the dialog already open over the browse document (Start over? / red Start over / Keep going); `63-fuse-kept-going`: dialog gone, resume card "Picks up at step 3 of 5" and "or begin from step 1", two steps still done in `sop_walks` |
| 5 | FUSE-01 the merge on a phone (390 px, slow motion) | pass | `63-fuse-phone-1..5`, `63-fuse-phone-running`; no sideways scroll |

## Frame-by-frame reading (slow motion x4, desktop 1440 x 900, deployed)

Stages of sketch 010: 1 the button fades leaving the word, 2 SOP drops into line, 3 they slide together, 4 tape slides in from the left, 5 the logo becomes the header.

| Frame | At | What the PNG shows | Stage |
|---|---|---|---|
| `63-fuse-0-read` | rest | Read of the walk fixture: chip, title, black `start` button, steps | before |
| `63-fuse-1` | 166 ms | Read still whole; the veil only a few percent in; button body barely paler | 1 begins |
| `63-fuse-2` | 650 ms | Read dissolved to ~90% paper; the button body is a pale grey with the word `start` already turning from white to ink; the SOP chip stays put in full black; no skeleton or other page visible | 1, almost done |
| `63-fuse-3` | 915 ms | Pure paper; the chip has started to drop (3 px), `start` sits alone in ink where the button was | 2 begins |
| `63-fuse-4` | 1806 ms | Chip has dropped onto the label's row and overlaps the "s" of `start` by a few px; the word has not moved yet | 2 done, 3 about to start |
| `63-fuse-5` | 2804 ms | The two are side by side, chip then `start`, centred where they began; no tape yet | 3 done |
| `63-fuse-6` | 4216 ms | Yellow/black tape part-way in, its right end under the chip, coming from the left | 4 |
| `63-fuse-7` | 6502 ms | The finished wordmark nearly at the top-left bar; the focus page (hazard step, rail) shows through the fading veil | 5 |
| `63-fuse-8-running` | rest | Wordmark in the bar with tape, title beside it, Step 1 of 5 hazard card, Stop; layer empty | done |

Phone (`63-fuse-phone-*`, 390 px, deployed): Read full width with a full-width `start` bar (1); chip left at the row above, `start` centred (2); chip and word sit together centred (3); tape under the wordmark (4); the bar with the wordmark, "Steps · 1 of 5" and Stop, hazard step below (5). Same sequence as desktop.

Two things seen and left alone: at the end of stage 2 the chip overlaps the "s" of `start` for a moment on desktop (the button is narrower than the chip plus word, so the pieces start overlapped; it resolves as they slide) and the tape runs a little past the chip's left edge while it slides in (unclipped, as in the approved sketch).

## Deviations from Plan

1. **[Rule 1 - Bug] Navigation at the tap showed the loading skeleton through the veil.** First slow-motion frame (local) showed Read replaced by the focus page's skeleton at ~20% veil. `playFuse` now returns a promise that resolves when stage 1 ends and the push follows (always resolves; 3 s guard). `d3c064fc`.
2. **[Rule 1 - Bug] The merge never played on the deployed site.** `document.fonts.check()` over the whole `font-family` list is false for ever on production (next/font's unloaded fallback face); it passed locally. Found by a deployed run with zero layer nodes at every frame and a probe printing `check: false` plus the font list. Now checks Saira 800 and 600 by first family. `b01edff2`.
3. **[Rule 1 - Bug] The logo rose onto a blank placeholder.** On the deploy the page takes ~2 s and `startWalk` ~1.6 s more, so the rise finished before the first step. Placeholder carries `data-fuse-hold`, the engine waits for it (max 2.5 s). `7753690f`.
4. **[Eval defect] Case 2 asserted an absolute time under 2.5 s**, which the deploy's own page load exceeds; it now compares the short merge with the reduced-motion cut. Case 4's row locator hit both the Recent and the area row (strict mode): `.first()`.
5. **Extra frames and shots** beyond the plan's six: `63-fuse-0-read`, a 650 ms frame (fade nearly done), `63-fuse-8-running`, five phone frames, and one shot per resume step.
6. **Scope:** `tests/phase58/edit-rail.spec.ts` repointed alongside `frame-structure.spec.ts` (both pin the exact `redirect(focusHref(...))` strings the plan changes). `tests/evals/lib/walk.ts` needed no change (`startWalking` already used the testid). `tests/evals/sop-focus.eval.ts` still asserts the old resume sentence; it belongs to 63-18 (inventory, `LIVE_PLANS`).

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0; gates 802 / 802 and 832 / 831 (+1), markers OK |
| phase52/57/58/59/60/63 + phase15-stubs (`--grep-invert "live\|probe"`) | 844 passed, 3 skipped, 0 failed |
| deployed `start.eval.ts` at `7753690f` | 5 passed |

## Requirements

Ticked: FUSE-01, FUSE-02 (full, short, reduced, resume, second start proven on the deploy), HOME-03 (63-06 Read + this plan's resume wording and begin-again, proven). Not ticked: HOME-05 (63-14 owes the literal sweep and address eval), GATE-01 (63-20 / 63-21), EVAL-01 (63-18 / 63-21).

## Known Stubs

None.

## Threat Flags

None. T-63-41 (`?go=1`): the page resolves the version from the session first and `startWalk` is the normal session-scoped start; the flag only triggers it. T-63-42: no server action in the click, push waits for in-flight queries (<= 3 s). T-63-43: every overlay node ignores the pointer (asserted at frame 2), and the target wait is bounded. T-63-44: storage values only choose animation length.

## For the owning plans

| Finding | Owner |
|---|---|
| On the deploy the focus page takes ~1.8 s to render and a first `startWalk` ~1.6 s more (a start with no walk waits ~3.5 s for step 1; the merge covers it). A server-side start in the page would remove the second wait; not done here (a write on page load) | later phase, if the wait is felt |
| `tests/evals/sop-focus.eval.ts` still reads "Resume where you left off" | 63-18 |

## Commits

- `4e3a6701` fuse store, lazy merge engine and the empty fuse layer
- `d6e57d7a` start plays the merge and lands in the running SOP
- `d3c064fc` navigate once the screen has faded to paper
- `bd57f1c1` the start eval, judged frame by frame
- `b01edff2` font-ready check reads the first family only
- `7753690f` the rise waits for the walker to start the walk

## Self-Check: PASSED

Files exist: `src/lib/brand/fuse.ts`, `src/lib/brand/fuse-engine.ts`, `tests/phase63/fuse-wiring.spec.ts`, `tests/evals/start.eval.ts` (no `test.fixme`, nine `63-fuse-` names). All six commits are on origin/master. `.bundle-baseline.json` unmodified. Local server on :4200 stopped.
