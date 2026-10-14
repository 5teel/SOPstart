# ADR-0013: Step kinds wear the AS 1319 safety sign colours and shapes

- **Status:** Accepted
- **Date:** 2026-10-14
- **Decided by:** Simon ("use the sign type and colour as per ANZ standards", after sketch 011)
- **Supersedes:** ADR-0007 rule 1 in part: "red belongs to hazards; amber to PPE". The rest of ADR-0007 stands (ordinary steps and checks in ink, admin chores in ink, overdue amber, no coloured left bars, muted area colours).
- **Enforced by:** `tests/lint/design-tokens.spec.ts` ("hazard is a warning sign and PPE a mandatory sign")

## Context
Workers on ANZ sites already read the AS 1319 sign system on the walls: a blue filled circle means "you must wear or do this", a yellow triangle with a black edge means "there is a hazard here", red means danger or prohibition, green means emergency information. The app showed PPE in amber, close to the warning yellow, so a PPE step looked like a hazard warning and nothing like the PPE sign on the machine. Sketch 011 proposed adopting the sign system.

## Decision
1. **A hazard step is a warning sign:** safety yellow (`--sign-warning`, about AS 2700 Y14), black triangle ▲, ink text.
2. **A PPE step is a mandatory sign:** blue (`--sign-mandatory`, about AS 2700 B23), circle ●, white text.
3. **Red** (`--accent-hazard`) stays for danger and for failures that block a worker (errors, send back). A step kind does not use it; there is no separate "danger" kind.
4. **Green** stays out of step kinds: in AS 1319 it means emergency information, not "done".
5. Each kind's colour and shape live in `src/components/focus/KindChip.tsx` (`KIND_CHIP`, `KIND_DOT`) and the `.signal-*` / `.sign-triangle` classes in `src/styles/blueprint-theme.css`. Meaning never rests on colour alone: the chip carries the word and the shape.

Not adopted from sketch 011: squared corners, Saira for titles or step text, the 15 × 1.25 type scale. ADR-0006 and the radius vocabulary stand.

## Consequences
- PPE and hazard look like the signs on the machine they belong to.
- Blue now means two things: the mandatory sign and the step/measure accent used for focus and links. The PPE blue is darker and always a filled chip with the ● shape; revisit if they are confused.
- The overdue / waiting amber (`--accent-decision`) sits near the warning yellow; it stays an outline tag, never a filled chip.

## How to comply
- Show a step's kind with `<KindChip kind={…} />`, a rail mark with `KIND_DOT[kind]`, a hazard or PPE callout with `.signal signal-hazard` / `.signal signal-ppe`. Never colour a hazard or PPE by hand.
