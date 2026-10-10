# Sketch 011: the design base (2026-10-10)

Simon picked the **Impeccable** review as the base for every later design pass. It is now in the app; the rules are in [ADR-0007](../../../docs/adr/0007-design-base.md).

| File | What it is |
|---|---|
| `review.md` | The Impeccable review: the 10 issues it found and the 12 changes it recommends |
| `impeccable-mockup.html` | The five phone screens with those changes (the target) |
| `before-mockup.html` | The same five screens as the app looked on 2026-10-09 |
| `alternatives/` | The other three reviews (Emil, taste-skill, ui-taste) and their mockups, kept as sources for later passes |

The mockups were drawn for a design canvas and load a `support.js` that is not included. Open them as source, or view them on the original canvas.

## How to build the next design pass on top of this

1. Change the shared classes and tokens in `src/styles/blueprint-theme.css` (`.section-heading`, `.seg`, `.chip`, `.tag`, `.tag-warn`, `.signal`, `.signal-strip`, `--area-*`, `--accent-*`, `--ai`). Every screen picks the change up.
2. Change a component only when the pass changes its structure.
3. A pass that breaks an ADR-0007 rule needs a new ADR that supersedes it.

## Applied (2026-10-10)

All 12 recommendations except no. 12 (isometric glyphs in list rows), which is left for a later pass. The older admin screens (org model, observations, wizard, settings) are not yet on the base.
