---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 04
subsystem: ui
tags: [brand, wordmark, next-font, focus-top-bar]
requires: [63-01]
provides:
  - src/components/brand/Wordmark.tsx (Wordmark: variant full | chip | start; onInk; size hero | merge | header | phone | bar; target; data-fuse)
  - .wm, .wm-sop, .wm-start, .wm-start-only, .wm-on-ink, .wm-notape, .wm-hero|merge|header|phone|bar classes in blueprint-theme.css
  - Saira Semi Condensed 600 / 800 as --font-saira on <html>
  - FocusTopBar wordmark target (data-wm-target) and backLabel Back | Stop
affects: [63-06, 63-11, 63-15]
key-files:
  created:
    - src/components/brand/Wordmark.tsx
    - tests/phase63/wordmark.spec.ts
  modified:
    - src/styles/blueprint-theme.css
    - src/app/layout.tsx
    - src/components/focus/FocusTopBar.tsx
    - src/components/focus/FocusFrame.tsx
    - src/app/(auth)/layout.tsx
    - src/components/welcome/PromoReel.tsx
key-decisions:
  - "Font route: next/font/google (the plan's first choice). The local build fetched it fine; Railway status is NOT yet confirmed because the push was held (see Blockers)"
  - "Chip text and on-ink chip fill use --paper (no literal white); the on-ink tape is the existing --wm-tape-on-ink"
  - "PromoReel: only the two plain brand labels (header chip and outro) became the Wordmark; scenes untouched"
requirements-completed: []
duration: 40min
completed: 2026-10-08
---

# Phase 63 Plan 04: Wordmark, Saira and chrome placements Summary

**One Wordmark component on the existing --wm-* tokens, in Saira Semi Condensed via next/font, heading the focus top bar (the merge's landing slot), the sign-in layout and the welcome reel; the leave control reads Stop while a SOP is running.**

## Commits

- `e8c3fb72` Wordmark component, `.wm` classes, Saira on `<html>`, wordmark spec (4 cases)
- `8ed7f611` chrome placements, Back / Stop, two more spec cases

## Component API

`<Wordmark variant="full|chip|start" onInk size="hero|merge|header|phone|bar" target className data-fuse />`. `full` is `role="img" aria-label="SOPstart"`; `chip` is the SOP half only; `start` is the lowercase word only (margin 0); both halves drop the tape. `size="bar"` is one rule: phone size below 64rem, header size from 64rem up. `target` renders `data-wm-target`. No directive, so server and client components can use it.

## Placements

- `FocusTopBar`: `<Wordmark size="bar" target />`, 1-px separator, title, chip, children, steps button, then the leave button (`data-testid="focus-back"`, `backLabel` default `Back`, `Stop` shows an X). `FocusFrame` passes `Stop` for `walk` and `review`, `Back` otherwise; same `goBack`.
- `(auth)/layout.tsx`: `<h1><Wordmark size="hero" /></h1>`, tagline margin raised to `mt-3` after the screenshot showed it touching the tape.
- `PromoReel`: header chip (`header` size) and outro brand line (`hero` size).

## Verification

- `npx tsc --noEmit` clean; phase63 `wordmark` 6/6; phase15-stubs `design-tokens`, `design-principles`, `no-undefined-css-tokens` 11/11 (run at task 1); phase58 `frame-structure` + `edit-rail` 41/41.
- No phase58 assertion needed repointing: the specs pin `onClick={onBack}`, `{title}`, `{children}` and the banned-word list, all still true.
- Looked at it: `next start` on a local build, screenshots of `/login` (1280 and 390 wide) and `/welcome` read from PNG. Saira loaded (`document.fonts.check('800 20px "Saira Semi Condensed"')` true, computed family leads with it), ink chip + 800 SOP, 600 start, hazard tape under both, matches sketch 010. The focus top bar itself was not screenshotted (needs an authed session); its structure is spec-pinned and it renders the same component.

## Bundle gate: RED on `/page` (+3 KB)

| Route | Measured | Baseline | Delta | Parent commit `7b6b9ec6` |
|---|---|---|---|---|
| `/sops/[sopId]/page` | 795 KB | 795 | 0 | 795 |
| `/page` | 837 KB (856,719 B = 836.6) | 834 | **+3 (tolerance 2)** | 836 |

`.bundle-baseline.json` untouched. Summed-file diff against a clean build of the parent (same 14-chunk set, hash names ignored):

| Chunk | Parent B | Now B | Delta |
|---|---|---|---|
| `app/layout-*.js` | 205 | 432 | **+227** |
| `webpack-*.js` | 5476 | 5490 | +14 |
| `app/page-*.js` | 47280 | 47285 | +5 |
| `next-dynamic-*.js` | 2753 | 2757 | +4 |
| `main-app-*.js` | 520 | 521 | +1 |

About +251 bytes in total, which pushes `/page` from 836.4 to 836.6 and across the rounding line. Cause: the font. A `next/font` import in the root layout puts the font style module (`{style:{fontFamily...},className,variable}`) into the layout's client entry chunk, charged to every route. It is the font itself, not the Wordmark (the Wordmark is not in any `/page` chunk). `/page` was already at the +2 edge on the untouched tree (63-BASELINE), so any byte there flips it. The plan predicted the font adds "CSS + media only"; it also adds this one JS module. Needs an orchestrator decision: re-baseline `/page` (836 would sit at tolerance edge again), or find ~150 bytes elsewhere on the root route.

## Deviations from Plan

**1. [Rule 3 - Blocker, process] Push held.** `npm run build` exits non-zero because the postbuild gate fails, and Railway runs the same build, so pushing would fail the deploy (CLAUDE.md 2026-10-06 healthcheck/deploy precedent). I did not push, did not touch the baseline. Two commits are local on master; the orchestrator pushes after deciding. The Railway-font-fetch check (T-63-09) therefore remains open.

**2. [Incident, recovered] node_modules wiped and restored.** To get the parent's exact chunk sizes I built it in a temporary git worktree with `node_modules` junctioned to the main checkout. `git worktree remove --force` followed the junction and emptied the main `node_modules`. Recovered with `npm ci` (package-lock unchanged, working tree clean of lock edits, 416 packages present; the `.next` build output survived). Lesson for Learnings: never junction `node_modules` into a worktree you will `git worktree remove`; delete the junction first (`rmdir`).

**3. Test scope.** Wordmark spec checks the yellow ban with comments stripped (a builder comment mentions `--brand-yellow`) and allows only `components/brand/` and `focus/admin/annotate/`.

## Known Stubs

None. `data-fuse` is a pass-through prop for 63-15.

## Self-Check: PASSED

Files exist (`Wordmark.tsx`, `wordmark.spec.ts`, this summary); commits `e8c3fb72` and `8ed7f611` are in `git log`.
