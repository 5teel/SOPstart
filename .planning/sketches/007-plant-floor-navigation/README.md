---
sketch: 007
name: plant-floor-navigation
question: "What if the plant itself is the navigation — no library, no scope column — and every persona reaches a procedure by standing above their site and pointing at a machine?"
winner: null
tags: [navigation, spatial, isometric, worker, kiosk, phone, admin, governance, generated-assets]
---

# Sketch 007: Plant Floor Navigation

## Design Question

Sketch 006 fixed the column. Simon's reply: *"The design still seems very similar to the
existing design."* Fair — it kept the Miller frame, a desk-worker catalogue pattern
(Finder, Mail, Linear) applied to operators who never wanted a catalogue. The products
actually used on factory floors (SwipeGuide, Dozuki, Poka, Tulip) reach a procedure by
**scanning the machine**, by a **"today" feed**, or by a **station app** — never by
browsing.

So this sketch throws the library away as the home and asks: **what if the site is the
map?** An isometric drawing of the plant, every machine a tappable object, pins where
something is due for you (worker) or where the library is sick (admin). Search and
voice sit on top; the list survives only inside a machine's panel and as an admin table.

## Assets

Generated with Nano Banana 2 (Gemini `gemini-3.1-flash-image-preview`), 2026-09-28,
5 generations, first-shot on every one:

| File | Prompt gist |
|---|---|
| `assets/plant.jpg` | 2K 16:9 cutaway isometric glass plant — furnace, 2 IS machines, lehr, cold-end inspection + palletiser, machine shop (tank, lathe, bench, gluer), warehouse (racking, forklift), office terminal |
| `assets/is-machine.jpg` | isolated IS forming machine, 8 sections |
| `assets/lehr.jpg` | isolated annealing lehr |
| `assets/cleaning-tank.jpg` | isolated alkaline cleaning tank |
| `assets/gluer.jpg` | isolated hot-melt gluer |

Hotspots are hand-placed SVG polygons over the scene (15 machines, 3 departments). SOP
titles are real (prod census, same morning); which machine each belongs to, worker
relationship (due / updated / never done), owners and review dates are illustrative.

## How to View

open .planning/sketches/007-plant-floor-navigation/index.html

Drag to pan, scroll to zoom, click any machine, type in the ask bar (try "hanger"), click
a department chip to fly to that zone. **View as: Worker / Admin** (top right) repaints
the pins on the Plant and Shared-terminal tabs.

## Tabs

- **Plant · desktop** — the worker home. Now card bottom-left (the one procedure due at your station, Walk it), ask/voice bar top, department chips fly the camera. Amber pins = something due for you on that machine. Click → zoom + right panel with the machine's sprite and its procedures. Admin repaints: red pin = a procedure with no owner, amber = review overdue, Now card becomes library health.
- **Shared terminal** — the Visy reality: a desktop beside the line, many operators per shift. Full-bleed floor, no header, no login. "Who are you?" avatar strip, PIN dots only for sign-off, 64px targets.
- **Phone** — the floor is a thumbnail here, not the navigation. Home = ask bar + Now card + floor thumbnail + "Scan a machine plate". Middle = camera on the QR plate riveted to IS Machine 1. Right = that machine's list, glove-sized.
- **Admin inbox** — the admin home is the work, not the list: Linear-style inbox (no owner · overdue · approve · stuck · nothing-at-all-for-this-machine), each row one action, goal is zero. Beside it the floor lit by health. Below, the library as a plain table with a pull-request-style checks row per SOP (owner · reviewed · approved · assigned · converted).

## What to Look For

- **Does the scene beat search?** For "I know the machine, not the SOP name" it's two clicks. For "I know the name" the ask bar is faster — and it highlights machines as you type. Do both belong on the home, or is the scene a second screen?
- **Pins as the worker's whole to-do.** No list of assignments anywhere on the desktop home — just the Now card and the pins. Is that enough, or does a worker need "all 7 things due" as a list?
- **Admin repaint.** Same floor, red where the library is sick. Is "the machine shop has no owner for anything" more actionable as a place than as a filter?
- **The hotspot cost.** Every site needs its scene drawn and its machines placed. In production that's either (a) a generated scene per site + an admin drags polygons, (b) generated sprites composed on a grid the admin edits, or (c) Three.js primitives. Which is the honest v1?
- **Kiosk identity.** Avatars + PIN-on-sign-off vs. today's per-user login. Visy said shared terminals and forgotten passwords are the friction. Is a PIN enough audit for a sign-off that could end up in front of WorkSafe?
- **Phone demotes the scene to a thumbnail.** Right call, or should the phone pan the same scene?
- **The library table's checks row.** Five green circles = nothing to do. Is that the whole admin library, or does the Miller detail pane still earn a place somewhere?
- **Machines with no procedures** (racking, lathe, workbench) show as an inbox item, not as empty hotspots. Good, or should the floor itself show "nothing here yet"?

## Production notes (if this wins)

- Scene: Konva (already installed) for pan/zoom/hotspots; polygons stored per-org in a
  `site_layouts` table; hotspot editor is drag-a-polygon over the image in the admin.
- Assets: per-org scene generated from a short questionnaire (industry, machines) and
  editable via the same image model; machine sprites generated on demand from the SOP's
  title + a style reference, cached in Supabase Storage.
- Phone: `getUserMedia` + a QR lib; plate = `sopstart.com/m/<machine-id>`.
- The Now card and the pins are one query: assignments × completions × review cadence,
  which `useAssignedSops` already computes.
