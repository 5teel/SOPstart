# ADR-0004: Design principles — attention follows the objectives

- **Status:** Accepted
- **Date:** 2026-10-07
- **Decided by:** Simon (sketch 009 approved in shape; "a global design variables file and ADR which will include design principles site wide")
- **Supersedes:** — (see "Relationship to ADR-0003" below)
- **Enforced by:** `tests/lint/design-principles.spec.ts` (the tokens below exist) · `tests/lint/design-tokens.spec.ts` (no raw colours, sizes or radii in components) · review for the rest

## Context
The one-screen home (Phase 57) gave the map, governance and authoring roughly equal weight, used
rooms (Office, Smoko room, Workshop, Noticeboard) as a metaphor for features, pushed a "Next for
you" card and counted to-dos. Simon set the product's ranked objectives on 2026-10-07:

1. Workers operate safely and competently. Using SOPs is the centre of the product.
2. Supporting records: sign-off, training, competence.
3. Creating and converting SOPs. Few people do it; it must not be promoted, but once started it
   must be as easy and completable as possible, because SOP quality drives everything above.

Sketch 009 (variant A, approved in shape) applied that ranking. These principles hold for every
surface built or rebuilt from now on.

## Decision

1. **Attention follows the ranking.** The most screen and the first position go to finding, reading
   and doing SOPs, for every role. Records come second. Authoring comes last: in the menu, quiet, no
   counts on the home.
2. **Information, not instructions.** SOPstart is a SOP, safety, training and record-keeping app. It
   does not manage people's work or time: no "next for you", no due queues, no countdowns, no
   nagging counts. Status (signed off, updated since you last did it, waiting for sign-off) is shown
   as information on the thing it describes.
3. **Plain names, no metaphors.** Things are named for what they are: My SOPs, My record, Training,
   Sign-offs, Manage SOPs. No rooms. The worker's verbs are **Read · Start · Stop · Next · Back a
   step · Done**; "walk" is not used on screen.
4. **The library is organised by the work.** SOPs are grouped by library area and by type (machine,
   process, order of operations, inspection, emergency). A machine is never the only way to find a
   SOP, and the app never prompts "this machine needs a SOP".
5. **Make SOPs visual.** The site map is a second view of the library. Each area is a clearly
   outlined, clickable floor area; each object on it is **one SOP** (a noticeboard for processes and
   emergencies), so the map always matches the library. Step photos and drawings are preferred to
   text alone.
6. **An open SOP owns the screen.** Starting a SOP removes everything else; only the SOP, its steps
   and its progress remain. Back or Esc returns to where you were.
7. **Authoring is quiet but complete.** Ways in come from a need: a change request, a draft you
   started, a search with no result, or Manage SOPs → New SOP. The editor opens at the next unchecked
   step and always shows what still blocks Publish.
8. **One design source.** Every colour, size, radius, duration and easing comes from
   `src/styles/blueprint-theme.css`. One semantic accent per meaning; colour is never decorative.
   **Brand yellow belongs to the wordmark** and never signals state. Area colours (`--area-1..8`)
   say *where* in the library, never whether something is wrong.
9. **Motion shows a change of state and never makes anyone wait.** It is used for the Start fusion
   (SOP + Start become the SOPstart wordmark, which becomes the steps header) and the map zoom. The
   full fusion plays on the first Start of the day, the short one after, none under reduced motion.
   Input is never blocked by an animation.
10. **Glove-ready on a phone.** Tap targets are `tap` 44 px, `tap-glove` 60 px for the primary action,
    `tap-row` 72 px for rows; worker text reads at `text-reading` or larger; every screen works at
    390 px wide with no sideways scroll.

## Consequences
- The home becomes search, Recent, Most used and All SOPs, with the site map in the reader pane
  (sketch 009 A). The room destinations, the Now card and to-do counts on the home are retired when
  the home is rebuilt.
- Screen text changes: "Walk it" → Start, "Show me" → Read, completion → Done.
- New tokens exist now (`--wm-*`, `--ease-fuse`, `--dur-*`, `--area-1..8`); nothing reads them yet.

## Relationship to ADR-0003
ADR-0003 fixes **room** positions per site template. Principle 3 retires rooms, and principle 5 puts
library areas on the map in their place. ADR-0003 stays in force for the code that ships today; the
phase that rebuilds the home must supersede it with an ADR covering how areas are placed on a
template, in the same commit as that change.

## How to comply
- New colour, size or timing: add a token to `blueprint-theme.css` (and its `--color-*` / `@theme`
  line if it is a utility); never write the literal at the call site.
- New screen: ask which objective it serves, and give it no more prominence than that rank allows.
- New status: show it on the row or object it describes; do not add it to a queue or a badge count
  on the home.
- New word on screen: say what the thing is; if it needs a metaphor to explain, rename it.
- New motion: name the state change it shows, use the `--dur-*` tokens, and check it under
  `prefers-reduced-motion`.
