# One-Screen Site — the MVP shell

**Status: NOT SHIPPED. Design contract, decided 2026-10-02/03 (sketch 008, winner A + focus rule).**
This is the **simplification contract**: the app is cut to an MVP and collapses onto one
screen. Where it conflicts with an older reference in this skill, **this file wins** — see
"What this supersedes" below before reading any other reference.

Source: `sources/008-one-screen-site/index.html` (fully interactive; all three layouts,
admin/worker repaint). It reuses the sketch-007 scene from
`.planning/sketches/007-plant-floor-navigation/assets/`.

## The decision in one paragraph

There is **one navigable screen**: a list on the left, the isometric site in the middle, a
detail panel on the right. There is **no header navigation**. Everything is reached from the
site: the **Office** is governance, the **Smoko room** is training, the **Workshop** is where
SOPs are written and edited, the **Noticeboard** holds SOPs that belong to the whole site,
and each **machine** carries its own SOPs. The list on the left is the same places as a list
— a second way in, never a different set of destinations. The one exception to "one screen"
is deliberate: **opening a SOP takes the whole screen** (focus rule, below).

## Layout — three panes (winner A)

```
┌ list 256 ┬───────────── site (flex) ─────────────┬ detail 400 ┐
│ search   │  isometric scene, pan/zoom,           │ what is    │
│ Now card │  rooms always signposted,             │ selected   │
│ Rooms    │  machines labelled on hover,          │ (site      │
│ Depts ▸  │  pins = due (worker) / health (admin) │ overview   │
│ machines │                                       │ if nothing)│
└──────────┴───────────────────────────────────────┴────────────┘
```

- `grid-template-columns: 256px 1fr 400px`. The detail pane is **always present**; with
  nothing selected it shows the site overview (objectives, notifications, open requests).
- **Wide detail** for things that are tables: `256px 1fr minmax(560px, 58%)`. Used by the
  decision ledger, people & roles, access, and the training matrix. The map shrinks but
  stays live and re-centres on the selected place.
- Selecting a place (map click or list click — identical) highlights its shape, flies the
  camera to it, and fills the detail pane. Close/Esc returns to the overview and refits.
- Rejected: **B** (map full-bleed, floating list, rooms as sheets over a dimmed map) and
  **C** (step inside a room; map becomes a sidebar thumbnail). Both kept in the source file.

## The focus rule (Simon, 2026-10-03) — non-negotiable

> "Opening a SOP means that SOP must become the focus of that individual — the SOP and its
> contents are never shared with other elements of the site that could be distracting."

- Opening a SOP to **walk** it or to **edit** it **removes** the list and the map (not
  shrinks, not dims). `grid-template-columns: 1fr`.
- The focus screen is exactly: a slim top bar (back to the place you came from + the SOP
  title) · the SOP's **sections and steps** down the left (300 px) · **one centred column**
  (max 820 px) holding the current step (walking) or the steps (editing).
- Nothing else from the site appears: no map, no list, no inbox count, no notifications, no
  objectives card in the working column. SOP-level metadata (version, machine, objective,
  standards labels) sits quietly in the left rail under "This SOP".
- Walking: step type chip, step text at 28 px, one primary button (60 px tall), photo button
  where the step asks for one, a thin progress bar. Hazard and PPE steps have their own
  button wording ("I understand — continue", "I'm wearing it — continue").
- Editing: steps grouped under their section, click text to change it, a tick per step
  ("I have checked this"), the AI check banner at the top of the column, and a bottom bar
  with "Checked n of N" + Publish (disabled until every step is ticked and AI flags cleared).
- Back / Esc returns to the three panes with the originating place still selected.

## Places → what lives there

| Place | Admin tabs | Worker sees |
|---|---|---|
| **Office** (governance) | Inbox · Requests · Decisions · People & roles · Access | My requests · My sign-offs |
| **Smoko room** (training) | Training matrix · Observations · My record | My record · Observations of me |
| **Workshop** (write & edit) | New SOP · Drafts · Standards · AI | Ask for a change (raises a request) |
| **Noticeboard** | Site-wide SOPs | Site-wide SOPs |
| **Machine** | its SOPs (Walk · Edit), owner + review per SOP, "Write a SOP for this machine" | its SOPs (Walk), badges due / updated / never done |
| **Edit site** (map tool, admin) | departments + machines managed on the drawing | — |

- **Inbox**: one action per row (Assign owner · Sign off · Approve · Mark reviewed); the
  goal state is empty. Supervisor sign-off of completions is an inbox row, not its own page.
- **New SOP**: four ways to start — upload a document · describe it to AI · record a video ·
  start blank. Then title + where it lives (a machine, or site-wide). Department comes from
  the machine. Every way lands in the same focus editor.
- **Access** keeps the **current wiring screen as it is**, opened from the Office.
- **People & roles** live in the Office. Roles: Worker · Supervisor · SOP Admin · Safety Manager.
- **Departments and machines are part of the site drawing.** There is no departments screen.

## Data model this implies — eight types

| Type | Meaning in the MVP |
|---|---|
| **decisions** | One append-only ledger. Every approve, reject, sign-off, assign, publish, ownership change and cleared AI flag is a row: who · when · what · about. Approval chains, completion sign-offs and observations are all decisions. Never edited or deleted. |
| **objectives** | Metadata that sits beside any other type (site, department, machine, SOP, person). Settable and readable by people **and agents**. |
| **requests** | Anything one party asks another to do: change a SOP, assign a SOP, observe me, write a new SOP. People and agents both raise them. Accept/decline writes a decision. |
| **notifications** | What a user is told. |
| **SOP** | Sections → steps. Belongs to a machine or to the site. Versions are kept. |
| **steps** | The unit of work. Hazard and PPE are **kinds of step**, not kinds of section. Kinds seen in the sketch: hazard · PPE · step · check. A step may ask for a photo. |
| **standards** | A **label** attached at SOP, section or step level. Not a library and not its own surface. Replaces the reusable-content library. |
| **users** | People, with a role. Roles are managed under governance. |

Supporting structure the eight sit on (confirmed by Simon as in scope, not separate
"types"): the **site** drawing with its departments and machines; **completions** (the record
that a walkthrough was done — an entry that leads to a sign-off decision). Single
organisation (Visy) — no tenant switching, no sign-up-creates-an-org.

The foot of every panel in the sketch carries a `data:` line naming which types that screen
reads — use it as the per-surface data contract.

## Kept vs dropped

**Kept:** step-by-step walkthrough · completion record · supervisor sign-off · photo capture ·
search and the Now card (in the list) · site-wide SOPs · four on-ramps · AI check and
tick-each-step before publish · versions (new version) · AI extras (agent-readable
objectives, model settings) · owners and review dates · approval chains (as decisions) ·
floor health pins · the current access wiring · assignments (as requests) · training matrix ·
simple observations · my record · team, invites, roles · the map editor.

**Dropped — do not build, do not preserve UI for:** offline use · voice (Q&A, read-aloud,
voice-driven walkthrough, voice drafting) · phone and QR plates · video generation · flow
diagram and image annotation · refresher cadence · CSV export · version compare/restore ·
YouTube and photo-scan on-ramps · the reusable-content library as a surface · the
departments screen and org-chart views · shared-device login · multiple organisations ·
every header nav entry.

**Rebuild after the simplification build:** the pathways map and the UAT feedback page.

## What this supersedes in this skill

| Older reference | Status after 2026-10-02 |
|---|---|
| `plant-floor-navigation.md` | Scene renderer, pins, badges, machine panel, zone colours **still apply**. Superseded: phone/QR surface, the ask bar's voice half, the admin inbox as a separate page with the floor beside it, the library table as a destination. |
| `authoring-flow.md` | D-A1 (every on-ramp lands in one editor) and D-A8 (verify each imported step by hand) **still apply**. Superseded: five on-ramps → four (no template, no YouTube); D-A5 tier 3 reuse library → standards labels; D-A9 three modes of one URL → the focus rule above; D-A10 site/trade/sub-trade placement → machine or site-wide. D-A6 ghosts and D-A7 agent twin are not in the MVP shell (AI extras survive as objectives + model settings only). |
| `interaction-patterns.md` | Voice state machine and command palette are **dropped**. Immersive one-step walkthrough survives as the focus rule (now on desktop too). |
| `new-block-types.md` | A SOP is sections and steps; hazard and PPE are step kinds. Do not add block types from that list for the MVP. |
| `screen-inventory.md` | The tabbed SOP page (overview / tools / hazards / flow / model) is retired by the focus rule. |
| `org-model-views.md` | Org chart and column views are dropped; people and roles are a table in the Office. |
| `permission-wiring-views.md` | **Still the contract** for Access — Simon: "keep the current wiring". |

## CSS patterns

```css
/* three panes; the detail pane widens for tables, the map never leaves */
.app            { display: grid; grid-template-columns: 256px 1fr 400px; height: 100vh; }
.app.wide       { grid-template-columns: 256px 1fr minmax(560px, 58%); }
/* focus: an open SOP owns the screen */
.app.focus      { grid-template-columns: 1fr; }
.app.focus .nav, .app.focus .stage { display: none; }
.app.focus .workgrid { display: grid; grid-template-columns: 300px minmax(0, 1fr); }
.app.focus .wc  { padding: 36px 40px; display: flex; flex-direction: column; align-items: center; }
.app.focus .wc > * { width: 100%; max-width: 820px; }

/* map labels stay screen-sized at any zoom: counter-scale by 1/zoom */
.tag { transform: translate(-50%, -100%) scale(var(--inv, 1)); transform-origin: 50% 100%; }
/* renderer sets  world.style.setProperty('--inv', Math.min(2.4, 1 / view.s))  on every pan/zoom */

/* rooms are navigation, so they are always signposted (machines label on hover) */
.tag .sign { font-family: var(--mono); background: var(--ink-900); color: #fff; border-radius: 5px; padding: 4px 10px; }
.tag .sign i { background: var(--brand-yellow); color: var(--ink-900); border-radius: 999px; }  /* count that is a to-do */
.hs.room  { stroke: rgba(9,9,11,.4); stroke-dasharray: 2 5; }   /* faint outline even at rest */

/* standards are a quiet label, never a chip that competes with a badge */
.tg { font-family: var(--mono); font-size: 10px; color: var(--accent-inspect); background: rgba(124,58,237,.08); border-radius: 3px; padding: 1px 5px; }
/* objectives read as metadata, not as content */
.obj { border: 1px dashed var(--ink-300); border-radius: 8px; padding: 7px 10px; font-size: 12.5px; }
```

Step kind colours (left border of the step card and the kind chip): hazard
`--accent-hazard`, PPE `--accent-decision`, step `--accent-step`, check `--accent-measure`.

## Behaviour notes found while building the sketch

- The map must **re-centre on the selected place whenever its pane resizes** (wide ↔ narrow);
  a `ResizeObserver` on the stage is enough. A hidden stage measures 0×0 — guard the fit.
- Search filters the list **and** highlights matching shapes on the map; it matches machine
  names and the titles of the SOPs on them.
- Clicking a department in the list tints that department's machines and frames them.
- Every action that changes governance state says so: "… · logged in the decision ledger".
- Worker walking a SOP to the end creates a sign-off row in the Office inbox.

## What to avoid

- **Anything beside an open SOP.** No split view with the map, no notification toasts over
  a step, no inbox badge in the focus bar.
- **A header nav, or a second set of destinations in the list.** The list is the map as text.
- **A separate page for governance, training or authoring.** They are rooms.
- **A reusable-content library, a departments screen, an org chart.** Labels and the drawing
  replace them.
- **Reintroducing a dropped feature because its code still exists.** The cut list is a
  product decision; dead code is removed, not hidden behind a flag.
- **Sheets over the map (B) or stepping inside a room (C)** for ordinary work — chosen
  against. Only the SOP gets the whole screen.

## Open questions (resolve at spec time)

1. **Phone.** Phone/QR was dropped with the rest, which leaves no phone experience. The focus
   screen would translate directly; the three panes would not. Is the MVP desktop-only?
2. **Room artwork.** The smoko room, workshop and noticeboard are vector placeholders drawn
   onto the 007 scene. A real site scene needs those rooms in the generated image, and the
   map editor needs to let an admin place the four fixed rooms.
3. **Worker access to rooms.** Sketch lets a worker enter every room with a reduced view.
   Should the Workshop simply be closed to workers?
4. **Reading without walking.** The sketch offers Walk and Edit only. Is there a read-only
   view of a SOP, and is it also a focus screen?
5. **Where an existing table maps to.** Completions, sign-offs, approvals and observations
   all become decisions — one physical table, or a ledger view over the existing ones?
6. **Objectives.** Free text only, or do they carry a target and a date an agent can act on?

## Origin

Synthesized from sketch 008 (winner: A + focus rule). Decisions recorded verbatim in
`.planning/sketches/MANIFEST.md` (2026-10-02 and 2026-10-03 entries).
