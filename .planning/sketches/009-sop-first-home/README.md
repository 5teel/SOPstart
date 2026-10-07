---
sketch: 009
name: sop-first-home
question: "If safe use of SOPs is the whole point, what is the home — and how does starting a SOP feel?"
winner: null
tags: [home, navigation, information-architecture, brand, motion, worker, phone]
---

# Sketch 009: SOP-first home

## Design Question
Simon, 2026-10-07: the product's attention must follow its objectives — (1) workers using SOPs safely
and competently, (2) record-keeping of sign-offs and training, (3) creating SOPs (rare, quiet, but
frictionless). The app manages SOPs, safety, training and records — **not** anyone's workflow or time.
So: no rooms, no "Next for you", no due queues, no machine-led "needs a SOP" prompts. The home is a
way to find a SOP, read it and start it. Starting fuses the **SOP** chip and the **Start** button into
the **SOPstart** wordmark, which becomes the header of the steps screen.

## How to View
Serve the sketches folder (the map image is a relative path) and open `009-sop-first-home/index.html`.
Toolbar: variant · Desktop/Phone · role (Worker / Supervisor / SOP admin) · start motion.

## Variants
- **A: Library + reader** — section menu · list (search, Recent, Most used, All SOPs) · the SOP read
  beside it. Read without losing your place in the list.
- **B: Search-first column** — one centred column, big search, Recent as cards; a SOP opens as its own
  page with "‹ My SOPs".

Both share: sections My SOPs · My record · Training + Sign-offs (supervisor up) · Manage SOPs (admin,
last, greyed, no count) · status as row information only · group All SOPs by Department or Type ·
"Find by place" as an optional map, never the frame · search miss → "Ask for one" (admin also "Write it").

## The start moment
Read view → **Start** → the page fades to paper while the SOP chip and the Start button fly to the
centre as solid black chips, turn into ink as they meet, lowercase to "SOPstart", a yellow underline
sweeps, then the wordmark rises into the steps-screen header. Motion: Auto = full (~1 s) the first
start each day, short (~0.3 s) after, cut under reduced-motion.

## Words
Read · Start · Stop · Next · Back a step · Done. Never "walk". An unfinished SOP still shows
**Start** ("Picks up at step 4 · or begin from step 1") — "Carry on" broke the fusion (SOP + Carry on
does not spell the brand), so the button word is fixed.

## What to Look For
- Does A's reader-beside-list or B's single column feel more like "I'm here to use a SOP"?
- Is the fusion delightful at full speed and invisible-cost at short speed? Try 5 starts in a row.
- On phone: is the bottom tab bar (SOPs · My record · …) the right place for sections?

## Build notes
- The sketch does the fusion with hand-rolled FLIP (Web Animations API) because the two pieces must
  meet at a mid-point; the real build can try View Transitions with a keyframed midpoint.
- Supersedes the room metaphor and the map-as-home in `sketch-findings-SOPstart/references/one-screen-site.md`
  and needs a new ADR superseding ADR-0003 (site presets pick rooms) if chosen.
