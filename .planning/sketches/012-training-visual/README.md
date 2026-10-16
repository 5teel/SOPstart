---
sketch: 012
name: training-visual
question: "How does the Training section show who is competent on what at a glance, instead of a text table of pills and sentences?"
winner: null
tags: [training, competency, records, admin, visual]
---

# Sketch 012: Training, made visual

## Design question
Training (admin and safety manager) answers "is everyone competent on the SOPs their work needs, and can we prove it?". Today it is a requests text list, a matrix of coloured pills with sentence rollups ("3/5 competent · 1 needs support…"), and a person drawer of text cards. What makes it visual without breaking ADR-0004 (information, not nagging counts), ADR-0013/0014 (colour is for safety signs) and ADR-0016 (framed, stepped lists)?

## How to view
Open `.planning/sketches/012-training-visual/index.html`. Use the Desktop / Phone 390 toggle.

## Variants
- **A: Glyph grid**: the matrix kept, each pill becomes an ink shape (· ○ ◐ ■, amber ◆ only for waiting), each rollup sentence becomes a stacked bar, and requests become cards that stay when empty. A cell opens the person's ladder drawer.
- **B: Training passports**: no matrix up front. Framed person rows with a shape strip and bar; step into a person for a Read → Observed → Signed off ladder per SOP, with the first-step photo. The matrix moves behind "Whole department".
- **C: By SOP**: SOP cards with photo, coverage bar and faces of who signed off; step into one to see its people in four columns.

## What to look for
- Do the ink shapes read without the key? Is amber-only-for-waiting enough signal?
- A (audit density) vs B (person story) vs C (procedure story): which question does an admin bring to this page first?
- The ladder (shared by all three): does Read → Observed → Signed off match how sign-off works on the floor?

## Data used (all exists today)
Cell state, needs support, outdated version and rollups from `src/lib/competency/matrix.ts`. Assessment requests from `worker_notifications`. The first-step photo would come from the SOP's first step.
