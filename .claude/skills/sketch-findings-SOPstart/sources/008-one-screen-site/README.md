---
sketch: 008
name: one-screen-site
question: "If the whole app is one screen — the isometric site plus a sidebar — where does the real work (inbox, training matrix, SOP editor, walkthrough) render?"
winner: "A"
tags: [mvp, simplification, navigation, spatial, isometric, one-screen, governance, training, authoring, data-model]
---

# Sketch 008: One screen — the site is the app

## Design Question

Simon, 2026-10-02: cut the app to an MVP. **One** navigable screen: the isometric site map,
a sidebar panel that supports it with detail, and a second sidebar as an alternate way to
navigate. Everything is reached from the map:

| Place on the map | What lives there |
|---|---|
| **Office** | Governance: inbox (owners, review dates, sign-offs, approvals), requests, the decision ledger, people & roles, access wiring |
| **Smoko room** | Training: training matrix, simple observations, my record |
| **Workshop** | Write and edit SOPs: four ways to start (document, describe to AI, record a video, blank), drafts, standards (labels), AI settings |
| **Noticeboard** | SOPs that belong to the whole site, not one machine |
| **Each machine** | Its SOPs: walk them (worker) or edit them (admin) |

The three variants answer one question: **where does the big work render** when the map is
supposed to stay the screen?

## How to View

open .planning/sketches/008-one-screen-site/index.html

Drag to pan, scroll to zoom, click a room or a machine, or use the list on the left (both do
the same thing). **View as: Admin / Worker** (top right) repaints pins and changes what each
room offers. Things that work: inbox actions (each one writes a row to the decision ledger),
accept/decline a request, the four-way New SOP flow into the editor, tick-each-step then
Publish, the full walkthrough with photo and hazard acknowledgement, record an observation,
Edit site, search (try "hanger").

## Variants

- **A: Three panes** — list left · map centre · detail right, all docked. The right panel is
  always there (site overview when nothing is selected). Small things stay narrow; big things
  (decision ledger, training matrix, walkthrough, editor) widen the right panel to ~58% and the
  map shrinks but never leaves.
- **B: Map + sheets** — the map is the whole screen. The list floats on the left. A machine
  opens a floating card on the right. A room, or any big piece of work, rises as a sheet over
  the map with the map dimmed behind it.
- **C: Step inside** — click a place and the camera flies into it; the place becomes the
  screen. The map shrinks to a thumbnail at the top of the sidebar (click it, or any shape on
  it, to jump elsewhere). Most room for work, least map.

## Winner — A, with a focus rule (Simon, 2026-10-03)

**Three panes is the app. An open SOP is the exception: it takes the whole screen.**

> "Opening a SOP means that SOP must become the focus of that individual — the SOP and its
> contents are never shared with other elements of the site that could be distracting."

- Browsing, governance, training and the Workshop's lists all live in the three panes
  (list · map · detail; the detail pane widens for big tables).
- The moment a SOP is opened — to **walk** it or to **edit** it — the list and the map are
  removed, not shrunk. The screen is: a slim top bar (back to where you came from + the SOP
  title), the SOP's sections and steps down the left, and the current step (walking) or the
  steps (editing) in a single centred column. Nothing else from the site is on screen: no map,
  no notifications, no inbox count, no objectives card in the working column.
- Back / Esc returns to the three panes with the place you came from still selected.
- Built in variant A only (`.app.focus`); B and C are kept as they were for the record.

## What to Look For

- **Does the map stay useful while you work?** In A it is always live beside you. In B it is
  there but dimmed. In C it is a thumbnail.
- **Is 400 px enough for the everyday panel?** (A: machine SOP list, inbox, New SOP.) If most
  things need the wide panel anyway, A is really "map as a strip".
- **The second sidebar.** In A and C it is docked and always visible; in B it floats over the
  map. Does a list of rooms + departments + machines earn its permanent space?
- **Nothing selected.** A shows a site overview (objectives, notifications, requests). B and C
  show only the map. Is the overview worth a permanent column?
- **Worker view.** Office → my requests and sign-offs. Smoko room → my record. Workshop → ask
  for a change. Is it right that workers can walk into every room, or should some be closed?
- **The data line** at the foot of every panel names which of the eight data types that screen
  reads (decisions · objectives · requests · notifications · sop · steps · standards · users).

## What changed from the shipped app (the simplification this sketch assumes)

- A SOP is sections and steps. Hazards and PPE are kinds of step, not separate sections.
- Standards are labels on a SOP, a section or a step. No separate reusable-content library.
- Decisions are one append-only ledger: every approve, reject, sign-off, assign and publish.
- Objectives sit beside SOPs, machines and people; people and agents can both set them.
- Departments and machines are part of the site drawing; no separate departments screen.
- Single organisation (Visy). No header navigation at all.
- Dropped: offline, voice, phone/QR plates, video generation, flow diagram, image annotation,
  refresher cadence, CSV export, shared-device login.

## Assets

The scene is the sketch 007 plant (`../007-plant-floor-navigation/assets/plant.jpg`). The
smoko room, workshop and noticeboard are **drawn in SVG** onto the empty corner of that image,
because the image generator was out of credit on 2026-10-03. They are placeholders: a real
build regenerates the scene with those rooms in it. The office is the existing cubicle.
