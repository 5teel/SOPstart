# Plant Floor Navigation — the site is the map

**Status: NOT SHIPPED. Design contract, decided 2026-09-28 (sketch 007, winner "Plant").**
Supersedes sketch 006 (Miller-column reshape) and, once built, replaces the `/sops`
scope column that Phase 41 merged (Admin / Your SOPs / Library / By department).
Shared-terminal / kiosk variant was **dropped** by Simon the same day — do not build it.

Source: `sources/007-plant-floor-navigation/index.html` (fully interactive; pan/zoom,
hotspots, worker/admin repaint). Generated assets stay in
`.planning/sketches/007-plant-floor-navigation/assets/` (5 MB — not duplicated here).

## The decision in one paragraph

Workers never wanted a catalogue. Floor products (SwipeGuide, Poka, Tulip, Dozuki) reach
a procedure by scanning the machine, by a "today" feed, or by a station app — never by
browsing. So the worker home is **an isometric drawing of their site**: every machine a
tappable object, amber pins where something is due for *you*, one "Now" card with the
single next procedure, an ask/voice bar on top. The library is never the home. For the
admin the **same floor repaints as library health** (red = a procedure with no owner,
amber = review overdue) and the home is an **inbox of one-action rows**, with the library
demoted to a plain table with a pull-request-style checks row.

## Personas → surfaces

| Persona | Home | Reaches a procedure by |
|---|---|---|
| Worker, desktop | Plant scene + Now card + ask bar | click machine → panel; ask bar highlights machines as you type; department chips fly the camera |
| Worker, phone | Now card + ask bar + floor **thumbnail** (not the navigation) + "Scan a machine plate" | camera on the QR plate riveted to the machine; or ask |
| Admin, desktop | Inbox (one action per row, goal = zero) + floor lit by health + library table | inbox row → SOP; floor pin → machine panel (owner/rev per SOP, Edit); table row |
| Admin, phone | is a worker | — |

## Data model this implies (new)

```
site_layouts      id, organisation_id, name, scene_asset_path, scene_w, scene_h
site_machines     id, site_layout_id, name, department_id, polygon jsonb [[x,y],…] (scene px),
                  sprite_asset_path?, qr_code (short id for /m/<code>)
sop_machines      sop_id, machine_id            -- N:M; a SOP with no machine still lives in the table
```

- Polygons are in **scene pixel space** (the generated image's natural size); the
  renderer scales. Never store viewport coords.
- Pins are **derived, not stored**: worker pin = count of that machine's SOPs where
  `rel ∈ {due, never, new}` for the viewer (from the existing assignments × completions ×
  cadence query that `useAssignedSops` already computes); admin pin = worst of
  `no owner` (red) › `review overdue` (amber) › ok (green dot) across the machine's SOPs.
- "Machines with no procedures" is an **inbox item** ("Racking, Lathe, Workbench — 3
  machines with no procedures"), not an empty hotspot state.

## Scene renderer contract

- One raster scene per site (2K, 16:9, generated — see Assets). Hotspots = SVG polygons
  laid over the image at the image's natural size; the whole `world` div is transformed
  (`translate(x,y) scale(s)`), never the image alone.
- **Pan** = pointer drag on the world (ignore drags that start on a polygon). **Zoom** =
  wheel toward the cursor, clamp 0.35–2.4. **Fit** = `min(W/sceneW, H/sceneH)*1.02`,
  centred; **re-measure on every fit** — a stage built while its tab is hidden measures
  0×0 (bug found in the sketch).
- **Click a machine** → polygon gets `.on`, camera flies to its centroid at ×1.5 with the
  target point offset left so the 380 px right panel doesn't cover it (`targetX = (W-380)/2`),
  panel slides in. Close → fit.
- **Department chip** → tints that department's polygons and fits the camera to their
  bounding box (`min((W-80)/bw, (H-120)/bh, 1.6)`).
- **Ask bar** → as the user types, machines whose name or any SOP title matches get
  `.hover` + their label shown. Same input feeds voice.
- Labels: mono, white pill, hidden until hover / match / selection; **pinned** machines
  (anything with a pin) show their label on world hover.
- Production renderer: **Konva** (already installed) rather than raw SVG, for hit-testing
  and the admin's polygon editor. The sketch's SVG approach is fine for a first slice.

## Pins & badges — the whole visual vocabulary

| Pin | Worker meaning | Admin meaning |
|---|---|---|
| amber circle with count, bobbing | *n* procedures due / never done / updated for you on this machine | review overdue on ≥1 SOP here |
| red circle `!` | — | ≥1 SOP here has **no owner** |
| small green dot | — | all SOPs here healthy |
| dashed polygon tint (amber/red) | machine has something for you | machine has a problem |

Row badges (mono, 10 px, uppercase): `DUE` amber · `UPDATED` blue · `NEVER DONE` red ·
`DONE` outlined grey · admin: `NO OWNER` red · `REVIEW DUE` amber · `OK` green · `DRAFT` grey.
Same badge set on desktop panel rows, phone rows, inbox, and table — one vocabulary.

## Now card

Bottom-left over the scene, 330 px, ink-900 border, drop shadow. Content: `NEXT FOR YOU` +
badge · title · mono meta (machine · department · ~min · last done) · **Walk it** (primary)
+ **Show me** (flies the camera to that machine and opens its panel) · "Then:" two more
lines. Admin variant: `LIBRARY HEALTH` · "3 machines have procedures nobody owns" ·
machine list · **Open inbox · n**.

## Machine panel (right, 380 px)

Sprite (or "no photo yet") with a round close button · department in its zone colour ·
machine name (20 px) · SOP rows sorted to-do first, each `title · badge · Walk ›`
(admin: `Open ›`) · admin-only block listing owner + rev per SOP · worker-only
"Ask about {machine}" voice prompt. Empty state: "No procedures for this machine yet"
(+ **Add one** for admins).

## Admin inbox

Rows: `● {title} / {machine · state · reason}   {age}   [Action]`. Dot colour = severity
(red no-owner/stuck, amber overdue, blue approve-me, grey housekeeping). Filter chips with
counts across the top (All · No owner · Overdue · Approve · Stuck). Actions are the one
verb that clears the row: Assign owner · Review · Approve · Retry · Finish · Add.
Empty inbox is the goal state.

## Library table (admin)

Columns: SOP · Machine (mono) · Status (`LIVE` / `DRAFT`) · Owner · **Checks** · Review.
Checks = five 18 px circles, left to right: owner · reviewed within 12 months · approved ·
assigned to someone · converted cleanly; green ✓, amber !, red ×. Five greens = nothing to
do. Chips: Where · Status · Owner · Checks. No Miller frame, no detail pane.

## Zone colours (departments)

Forming `#ea580c` · General `#2563eb` · Engineering `#7c3aed` — used only for the chip
dot, the department label in the panel, and the polygon tint. These are the three real
departments in prod; a fourth department picks the next unused accent from the theme.

## Assets & generation

Nano Banana 2 (`gemini-3.1-flash-image-preview` via the `nano-banana-2` MCP), 2026-09-28,
five first-shot generations. Prompt shape that worked for the scene:

> Clean isometric 3D illustration of a {industry} plant floor, 30° isometric, cutaway
> building, no roof, low walls. Crisp vector-isometric render, soft studio lighting, muted
> industrial palette (concrete grey floor with subtle 1 m grid, steel-blue and
> safety-yellow machines, warm orange glow only at {hot zone}) on plain #fafafa. No
> people, no text, no labels, no logos. Layout left→right with clear walkway gaps between
> every machine group so each is a distinct clickable object: 1. … 2. … 3. … 4. …

Sprites: "single {machine}, isolated on plain #fafafa, same style, no floor, soft contact
shadow", 4:3, 1K. Production: generate the scene from a per-org questionnaire, let the
admin draw polygons over it (Konva), generate sprites on demand from the SOP/machine name
and cache in Supabase Storage. Backgrounds are not transparent — design around `#fafafa`.

## What to avoid

- **Miller columns / scope column for workers** (sketches 005 → 006). Desk-catalogue
  idiom; operators don't browse.
- **Role groups in one column** ("Admin / Your SOPs / Library / By department") — four
  kinds of thing in one row style read as sub-menus (Simon, 2026-09-28).
- **The floor as the phone navigation.** Thumbnail + camera + ask on a 6-inch screen.
- **Kiosk / shared terminal mode** — dropped. No avatar strip, no PIN-on-sign-off.
- **Empty hotspots as the "nothing here" state** — put it in the inbox.
- **Decorative counts.** A number appears only where it is a to-do.

## Open questions (resolve at spec time)

1. Both the scene and the ask bar are on the home. Is the scene the home and search a
   control, or is search the home and the scene a second screen?
2. Worker desktop has no assignment *list* — Now card + pins only. Enough?
3. Site-scene production route: generated scene + admin polygon editor (v1 pick) vs
   sprites-on-grid vs Three.js primitives.
4. Multi-site orgs (Visy: ~100 sites): one layout per site, site picker where the
   department chips are.
5. Governance route: does the inbox live at `/governance` (existing header entry) with
   the floor beside it, and does the table stay on `/sops` for admins?

## Origin

Synthesized from sketch 007 (winner: Plant). Sketch 006 superseded; sketches 004/005
shipped as Phase 41 / 2026-08-04 (code is source of truth).
