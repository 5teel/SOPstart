---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 16
subsystem: words
tags: [copy, stale-walk, lint-guard, word-01]
requires: [63-11, 63-15]
provides:
  - "no walk word or Show me on a screen a person reads (Read | Edit, completion, start, finish)"
  - "STALE_WALK keys equal the server strings; walk-no-leak asserts it against the server files"
  - tests/lint/no-walk-words.spec.ts (registered in phase15-stubs, with a self-test)
affects: [63-17, 63-18, 63-20, 63-21]
key-files:
  created:
    - tests/lint/no-walk-words.spec.ts
  modified:
    - src/actions/walk.ts
    - src/actions/completions.ts
    - src/actions/office.ts
    - src/hooks/useWalk.ts
    - src/components/focus/FocusTopBar.tsx
    - src/components/office/SignOffPanel.tsx
    - src/components/home/sections/CompletionList.tsx
    - src/components/home/sections/MyRecordSection.tsx
    - src/components/welcome/PromoReel.tsx
    - src/components/focus/admin/StandardsButton.tsx
    - playwright.config.ts
    - tests/phase58/edit-rail.spec.ts
    - tests/phase58/walk-no-leak.spec.ts
    - tests/phase59/signoff-panel.spec.ts
    - tests/phase59/signoff-actions.spec.ts
    - tests/phase59/retirement-sweep.spec.ts
    - tests/phase63/record-training.spec.ts
key-decisions:
  - "Scanner skips template expressions and the first literal of a console call; both are code, not screen text. Fixing the two real hits in production strings would have changed nothing a person reads."
  - "The capability matrix still quotes the old 'own walk' server string and tests/phase59/capability-matrix.spec.ts pins that word in the matrix prose; matrix prose belongs to 63-17, so both are left for it."
requirements-completed: []
completed: 2026-10-08
---

# Phase 63 Plan 16: "walk" off every screen Summary

The worker verbs on screen are now Read, start, Stop, Next, Back a step and Done; the server error strings and the client map that recognises them moved together, and a registered guard fails the suite if a walk word returns to a component, route, action or hook.

## String table (old -> new)

| File | Old | New |
|---|---|---|
| actions/walk.ts, completions.ts (3 sites) | Start the walk again. | Start the SOP again. |
| actions/walk.ts (2 sites) | This SOP is not available to walk. | This SOP is not available to start. |
| actions/walk.ts | Could not start the walk. Please try again. | Could not start this SOP. Please try again. |
| actions/completions.ts, office.ts | You cannot sign off your own walk | You cannot sign off your own completion |
| actions/completions.ts (2) | This walk has already been decided. | This completion has already been decided. |
| actions/completions.ts | Sent a walk for sign-off (ledger summary, new rows only) | Sent a SOP for sign-off |
| actions/office.ts | X's walk of Y | X's completion of Y |
| hooks/useWalk.ts value | This walk was finished or started over somewhere else. | This SOP was finished or started again somewhere else. |
| FocusTopBar ModeSwitch label | Walk | Read (value stays `'walk'`) |
| SignOffPanel | This walk has already been / Reject this walk? / need to walk it again. / Reject walk | completion / Reject this completion? / need to do it again. / Reject |
| SignOffPanel link | `from: 'office'` | `homeFrom({ ...HOME, s: 'signoffs' })` |
| CompletionList empty state | Complete an SOP walkthrough to see your history here. + "Back to the site" -> `/` | Finish a SOP to see your record here. + "Find a SOP" (calls `onHome(HOME)`) |
| PromoReel | Tap a machine, walk the steps, send for sign-off. | Find a SOP, start it, send it for sign-off. |
| StandardsButton | "Workshop" (doc comment only; no visible text) | "Manage" |

Stored ledger and notification rows keep their old wording (history is not rewritten, T-63-46 accepted).

## Lockstep proof

- `STALE_WALK` keys are `'Start the SOP again.'` and `'That step is not part of this SOP.'`; `walk.ts` and `completions.ts` return exactly those strings.
- `tests/phase58/walk-no-leak.spec.ts` (WR-05) asserts the hook holds both keys and, new in this plan, that the two server files contain both strings, so renaming either end alone is red.

## Guard rules (`tests/lint/no-walk-words.spec.ts`)

- Scans `.ts` / `.tsx` under `src/components`, `src/app`, `src/actions`, `src/hooks` (>200 files asserted so it cannot scan nothing).
- Strips `//` and `/* */` comments, `${...}` template expressions and the first literal of a `console.*` call.
- Flags (a) JSX text with a walk word, (b) a quoted literal with whitespace and a walk word, (c) a literal that is exactly Walk / Walking / Walk it / Walkthrough, (d) "Show me" in JSX text or a literal.
- Not flagged: `useWalk`, `'walk'` mode value, `sop_walks`, `walk-*` test ids, `walk_id` (identifiers have no whitespace).
- Allowlist: `src/actions/introspection.ts`, `AiCheckBanner.tsx` ("Show me" jumps to an editor finding), and until 63-20 `src/components/shell/`, `src/components/sop/plant/`, `AdminMachinePanel.tsx` (a comment in the spec names 63-20 as the plan that removes these three).
- Non-vacuous: the first run against the tree flagged two real strings (a template key and a console line), proving the finder bites; the self-test feeds eight inline fixtures (positives and negatives); registered in the `phase15-stubs` regex and listed by `--list`.
- `src/lib/journeys` and `src/lib/uat` join the scan in 63-17.

## Verification

- `npx tsc --noEmit` clean.
- phase52 / 57 / 58 / 59 / 60 / 63 / phase15-stubs: 871 passed, 27 skipped (live probes), 0 failed.
- `npm run build`: bundle gate green, `/sops/[sopId]/page` 802 (baseline 802, delta 0), `/page` 832 (baseline 831, +1, tolerance +-2). Baseline file untouched.
- Pushed `c783dd30`; `https://sopstart.com/api/version` served it. A one-off worker session (eval-site worker, phone viewport) read the deployed Read view, the running SOP (first hazard step) and My record: visible text matched no `walk*` / "Show me" (the only hit was the fixture SOP's own title, "Eval walk fixture SOP", which is data). Screenshots read: `.planning/evals/latest/63-16-read.png`, `63-16-running.png`, `63-16-record.png`; the empty record shows "Finish a SOP to see your record here." with "Find a SOP". The throwaway eval file was deleted, not committed.

## Deviations from Plan

**1. [Rule 1 - Bug] Empty-state link went to the page it was on.** `CompletionList` "Back to the site" linked to `/` (observation from 63-12/63-14). Fixed as the lead's note asked: the button now calls `onHome(HOME)` (SOP list); `MyRecordSection` passes `onHome`; `retirement-sweep.spec.ts` and `record-training.spec.ts` repointed from `<CompletionList />`.

**2. [Rule 3 - Blocking] Extra spec repoints.** `tests/phase59/signoff-actions.spec.ts` pinned the old completion strings and was repointed in the same commit. Two repoints named in the plan, `StandardsButton` and `SignOffPanel` `from`, were cosmetic: Workshop was only in a doc comment, and `focusHref` already mapped `'office'` to `s=signoffs`.

**3. Scanner exclusions** (template expressions, console first literal) added after the first run; see key-decisions.

## Observations for later plans

- `src/actions/asks.ts`, `office.ts`, `requests.ts` still return "Office access required" to a screen; Office is not a section name any more. Not a walk word, out of scope here; candidate for 63-17/63-21.
- `tests/phase59/capability-matrix.spec.ts` + `CAPABILITY-MATRIX.md` still quote "own walk" (63-17 prose).
- `tests/evals/sop-focus.eval.ts` ~line 208 asserts "Resume where you left off (step 3 of 5)" (the 63-15 wording change) and `tests/evals/one-screen.eval.ts` carries Walk / Show me / Back to the site / Workshop assertions: both belong to 63-18, not edited here. The repoint inventory goes live for 63-11/13/14/15/16 in 63-18.
- Old `walk` / "Show me" strings remain in `src/lib/journeys` and `src/lib/uat` (63-17) and in the shell / plant / AdminMachinePanel files (deleted by 63-20).

## Known Stubs

None.

## Self-Check: PASSED

- `tests/lint/no-walk-words.spec.ts` FOUND; commits `191e760e` (copy and server strings) and `c783dd30` (guard) FOUND on master.
