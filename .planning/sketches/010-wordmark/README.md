---
sketch: 010
name: wordmark
question: "What should the SOPstart wordmark look like, given it is assembled live from the SOP chip and the Start button?"
winner: "6e in Saira Semi Condensed"
tags: [brand, wordmark, motion, icon]
---

# Sketch 010: SOPstart wordmark

## Winner (Simon, 2026-10-08)
**6e "Industrial continuous" in Saira Semi Condensed**: SOP in an ink chip (800), "start" beside it
(600), one strip of hazard tape along the chip's foot running on under "start". Archivo 88% was
rejected because its r crowded the t. Values are in `src/styles/blueprint-theme.css` (`--wm-*`,
`--dur-fuse-*`).

**The merge (Simon's rule: the pieces start in their final form, just apart):** the read screen shows
the SOP chip and a lowercase "start" button in the logo face → the button body fades, leaving the
word → SOP drops straight down into line → they slide together → the tape slides in from the left →
the logo rises into the steps header. ~1.7 s full, ×0.3 short, none under reduced motion.

- `logo.html` — the shareable showcase (also published as an Artifact).
- `index.html` — the round-4 comparison (6e in seven typefaces, slow-motion playback).
  Round 1 (A–D) is in git history; rounds 2–3 (tape variations, Industrial/Tape-chip variations) are
  earlier versions of the comparison Artifact https://claude.ai/artifact/WxeZykiefpJr4XDyPgfbrz.

## Design Question
Sketch 009 makes the brand out of the interaction: tapping Start flies the **SOP** chip and the
**Start** button to the centre, they merge into the wordmark, and the wordmark rises into the
steps-screen header. The wordmark has to be designed for that: two parts that each stand alone (a
chip, a button label), a join, one accent, legible from 17 px (phone header) to 52 px (the merge),
plus a mark for the favicon / app icon.

## How to View
The sketch links the app's real tokens (`src/styles/blueprint-theme.css`), so serve from the repo root:
`python -m http.server 8765 --directory C:\Development\SOPstart` then open
`http://127.0.0.1:8765/.planning/sketches/010-wordmark/`.

## Variants
- **A: Chip + word** — the SOP chip survives inside the logo, "start" in plain type, yellow chip edge.
- **B: Seam** — one wide industrial word (Archivo), a skewed yellow seam where the halves met; the seam is the icon.
- **C: Stencil** — safety-label stencil caps (Big Shoulders Stencil) over a hazard-stripe rule; the button already says START, so no case change.
- **D: Underline** — plain Inter, the yellow underline draws as they meet; quietest at 17 px.

Each variant shows: hero on paper, on ink, both header sizes in a header bar, the mark at 64/32/16,
and a live Start stage (Full / Short / Reduced motion) driven by the `--dur-fuse-*` and `--ease-fuse` tokens.

## What to Look For
- Does the merge *mean* something in this direction, or is it just motion?
- Header bars: which one still reads at 17 px next to a SOP title?
- Marks at 16 px: which survives as a favicon?
- The capital-S → lowercase-s switch at the merge (A, B, D): does it bother you? C avoids it.

## Outputs alongside this sketch
- Tokens: `src/styles/blueprint-theme.css` → "Brand, motion and library areas" (`--wm-*`, `--ease-fuse`, `--dur-*`, `--area-1..8`).
- Principles: `docs/adr/0004-design-principles.md` (guarded by `tests/lint/design-principles.spec.ts`).
