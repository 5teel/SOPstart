# ADR-0023: Hazards show where they apply

- **Status:** Accepted
- **Date:** 2026-10-20
- **Decided by:** Simon ("do all 4", after the analogue SOP showed its pictograms as a long list)
- **Supersedes:** Phase 58 D-07 in part (every hazard and PPE step first)
- **Enforced by:** `tests/phase58/focus-model.spec.ts` FOC-03 · `tests/phase56/convert.spec.ts` · `tests/evals/hazard-pictograms.eval.ts`

## Context
D-07 put every hazard and PPE step at the top as "Before you start". A caution written in one step's row ("keep your hands behind the guard line" on the measuring step) was then read before the job began, far from the step it guards. A source's pictogram grid applies to the whole document and links no sign to a step, so the version as written cannot place signs on steps without inventing a link.

## Decision
1. **In the version as written, a hazard or PPE step inside a section of steps stays before the step it guards.** Only sections made of hazard and PPE steps alone (the Safety and PPE sections) form "Before you start" (`walkOrder`, `src/lib/sop/focus.ts`).
2. **A step-less hazard section's pictograms are one hazard row with the signs on it.** The parse attaches a section's `[IMG N]` pictograms to the section, and the converter folds a lead-in plus its bullets (or a one-line name list) into that row.
3. **The clear version shows the pictograms with its hazards, and Jev places signs on steps.** For each procedure, cleanup or emergency step, Jev is asked one yes/no question per sign ("is the worker directly exposed to Hot Surface while doing this step?"). Only answers at 0.9 or above count, and a sign that fits more than half the steps stays with the hazards only (`src/lib/parsers/clear-signs.ts`).
4. **Every placement is listed for the document owner** in the clear version's gaps list, and none reaches workers until an admin approves the clear version (ADR-0015).
5. **Text in a procedural table's comments column is a note (`tip`), not a caution**, unless the cell starts with WARNING, CAUTION or DANGER.

## Consequences
- "Before you start" is shorter. Step cautions appear in the job, just before their step.
- Sign placement adds one Jev call per clear step (fractions of a cent). If Jev fails, the signs stay with the hazards and the gaps list says so.
- The version as written never shows a sign on a step: it records only what the source links.

## How to comply
- Never move a step's own caution away from that step.
- Treat any sign-to-step link the source does not state as inferred: it belongs in the clear version only and is listed for approval.
