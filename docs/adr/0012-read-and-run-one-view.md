# ADR-0012: Reading and doing a SOP are one view; the start merge marks the first record

- **Status:** Accepted
- **Date:** 2026-10-12
- **Decided by:** Simon ("Reading and working through the steps should be accessible from the exact same place - they should be the same thing except the work through the steps is simply a checklist from which the user actively individually checks - they are in effect creating new records of their interaction with the SOP whereas the reading creates no logs"; the view lives in the home centre, steps tick in order, the phone uses the same list; the start animation stays, "more obvious and centred and larger", with a design contract for when it activates)
- **Supersedes:** ADR-0004 rule 6 (an open SOP's Start removing everything else) and the start-merge choreography of sketch 010 (merge at the button, then rise into the focus top bar). The one-step-at-a-time walk screen (Phase 58, D-07) is retired for live SOPs.
- **Enforced by:** `tests/evals/start.eval.ts` (RUN-01..03), `tests/phase63/fuse-wiring.spec.ts`

## Context
A SOP had two reading surfaces (Read on the home; the focus screen's browse page) and a third for doing
it (the focus screen's one-step walk). People could not tell which was which or why. Reading writes
nothing; doing writes a record with every press. That difference, not the screen, is what matters.

## Decision
1. **One view, two states.** The SOP opens in the home's centre pane (ADR-0011). *Reading* shows every
   step in order with its tip, pictures, hazard and PPE signs and the photo it will ask for. It writes
   nothing to the server.
2. **Running is the same list as a checklist.** Start (or Resume) turns each step into a row with a
   glove-sized tick (`tap-glove`). Each tick is written to the worker's run (`sop_walks`) before the
   row shows ticked. Steps tick in order (the next one is open, later ones wait) unless the SOP allows
   jumping ahead; a photo step takes its photo on its row first. Stop keeps the ticks and returns to
   reading; "Resume at step N" picks up. When every step is ticked, Send for sign-off sits at the
   foot of the list and writes the completion (ADR-0008 ledger row as before).
3. **The SOP's own page** (`/sops/[id]`) remains for editing and for draft or superseded versions. A
   live SOP opened there without `mode=edit` goes to the home view (server redirect).

## The start merge: design contract
The SOPstart wordmark is literally the SOP chip plus the start button. Across the app the two halves
carry one meaning:

| On a SOP | Means |
|---|---|
| The **SOP** chip alone | Reading. Nothing is recorded. |
| The whole **SOPstart** wordmark with its tape, in the run bar | A run is open. Every tick is saved to your record. |

The merge is the moment the first becomes the second, so:

**When it plays**
- Only when a run begins: Start (new run) or Resume (existing run). Never on opening a SOP, on a tick,
  on Stop, on Send, or anywhere else in the app.
- Full: the first start of the day. Short: every other start and every Resume. None: reduced motion
  (the run bar simply appears).
- The run is started on the server at the press, in parallel; the merge covers the wait. If the server
  refuses, the merge cuts to the end and the error shows under Start; nothing pretends to be recorded.

**Where and how big**
- Inside the SOP's pane only (the centre pane on a computer, the screen under the top bar on a phone),
  centred in it. The side panels and the rest of the app stay as they are.
- Hero size: the joined wordmark is `min(60% of the pane width, --fuse-hero-max)` wide
  (`--fuse-hero-max: 520px`); on a phone 70% of the width.

**Stages** (durations are tokens in `blueprint-theme.css`; short = x`--fuse-short-scale`, no caption, no hold)

| # | Stage | What moves | Token |
|---|---|---|---|
| 1 | Lift | The pane fades to paper under a veil; the start button's ink body fades, leaving the word *start* (paper to ink). The SOP chip and *start* stay where they were. | `--dur-fuse-fade` |
| 2 | Gather | Both travel to the pane's centre and grow to hero size, *SOP* on the left, *start* on the right, closing the gap as they arrive. | `--dur-fuse-gather` |
| 3 | Arm | The hazard tape sweeps in under the joined word, left to right. | `--dur-fuse-tape` |
| 4 | Say | Full only: one line fades in under it, "Every tick is saved to your record", and holds. | `--dur-fuse-hold` |
| 5 | Settle | The wordmark shrinks into the run bar's slot (`[data-wm-target]`) at the top of the pane while the veil lifts on the checklist, its next step marked and scrolled into view. | `--dur-fuse-rise` |

- Never blocks: a tap, click or key during the merge jumps straight to stage 5's end.
- Stop and Send play no merge: the run bar fades out (`--dur-fuse-fade`) and the SOP chip is back.
- The run bar holds the wordmark (bar size), "Step N of M" with its progress line, and Stop.

## Consequences
- One place to learn: the list you read is the list you tick.
- The walk screen's one-step cards, its review page and its browse page leave the worker path; the
  focus screen keeps only editing and non-live versions.
- The home now loads the run code lazily on Start (the gated home bundle does not grow with it).

## How to comply
- A new way into a SOP opens the home view (`/?sop=<id>`), never a separate reading page.
- Nothing written to the server on opening or reading a SOP; every tick is written before it shows.
- The merge plays only from the run's Start/Resume, per the table above. Change the stages here first.
