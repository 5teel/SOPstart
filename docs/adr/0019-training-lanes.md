# ADR-0019: Training is shown as lanes, not a matrix of pills

- **Status:** Accepted
- **Date:** 2026-10-16
- **Decided by:** Simon (sketch 012, variant F: "I like D: Lanes … it will also need a Lanes view focussed on an individual … the SOP column will need some level of grouping"; glyph grid rejected: "requires users to learn a new glyph language")
- **Supersedes:** the Phase 35 training matrix (state pills, sentence rollups, axis swap, compact dots)
- **Enforced by:** `tests/phase63/training-lanes.spec.ts`, `tests/phase36/no-refresher-gate.spec.ts`, `tests/evals/home.eval.ts` HOME-04

## Context
The Training section showed a people × SOPs table of coloured pills with sentence rollups ("3/5 competent · 1 needs support · …") and a 12 px coloured-dot compact mode. Reading it meant decoding a colour vocabulary that also clashed with the sign colours (ADR-0013/0014). A replacement glyph grid was rejected because it is a new symbol language to learn.

## Decision
1. **Position is the state.** Five lanes run left to right in training order: Not started · Read it · Observed · Waiting for you · Signed off. Where a person sits is how far they have got. The rule lives once in `src/lib/competency/lanes.ts`.
2. **Waiting for you is an open assessment request** for that person and SOP; Assess sits in the lane. Signed off wins over a request.
3. **Two views over one department cut:** By SOP (rows are SOPs, faces in lanes) and By person (rows are that person's SOPs, a track running to their lane and ending in words).
4. **SOPs are grouped by library area or type**, the home's All SOPs grouping (ADR-0016). A closed group shows a count and a fill per lane. Small cuts open; large ones start closed; By person opens only the groups with something short of signed off.
5. **Everything else is words**: needs support, old version, refresher due or overdue. No symbol needs a key. Amber is used only for the Waiting lane (ADR-0014: waiting for sign-off keeps its colour).
6. Competency stays information, never a gate (CMP-04): nothing is disabled or hidden on a state, and flags never move anyone between lanes.

## Consequences
- `TrainingMatrixView` and its axis swap and compact mode are gone. The CSV export (department or one person, with a date range) and the person record panel stay.
- The lane, face and track classes live in `blueprint-theme.css`; a later pass restyles them there.
- Under 768 px a row stacks and each lane names itself; empty lanes drop out.

## How to comply
- Show a person's training state on a SOP by placing them in a lane via `laneFor()`, not with a pill, dot or icon.
- Add a new flag as words on the face or the track label, never as a new lane or colour.
