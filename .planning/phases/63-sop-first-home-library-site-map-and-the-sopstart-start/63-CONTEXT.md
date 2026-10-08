# Phase 63: SOP-first Home, Library Site Map and the SOPstart Start - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning
**Source:** Design conversation with Simon, 2026-10-07/08 (sketches 009 and 010, ADR-0004). Every decision under "Implementation Decisions" was stated or approved by Simon; "Claude's Discretion" items were not discussed.

<domain>
## Phase Boundary

Replace the room-based one-screen home (Phase 57: list · isometric site picture · detail, with Office / Smoko room / Workshop / Noticeboard rooms) with the approved SOP-first home (sketch 009 variant A), add a code-drawn isometric map of the library as the reader pane's resting view, put the chosen SOPstart wordmark (sketch 010) in the app chrome, and play the Start merge animation when a SOP is started into the existing focus screen (Phase 58). Retire the room metaphor and the word "walk" from every screen. Out of scope: changing what the focus screen does once a SOP is running, the editor, data-model changes beyond what the home needs.

</domain>

<decisions>
## Implementation Decisions

### Product ranking (ADR-0004 — binding)
- Attention follows: (1) safe, competent SOP use, for every role; (2) records — sign-off, training, competence; (3) creating/converting SOPs — quiet, last, never promoted on the home, but complete and easy once started.
- Information, not instructions: no "Next for you" card, no due queues, no countdowns, no to-do counts on the home. The app does not manage anyone's workflow or time. Status (signed off · updated since you last did it · waiting for sign-off · you stopped at step N) is information shown on the row/object it describes.
- No room metaphor anywhere on screen. Plain names only.
- The library is organised by the work (area and type), never by machine alone; the app never prompts "this machine needs a SOP".

### Layout — sketch 009 variant A (approved in shape)
- Desktop: three columns — section menu (≈220 px) · SOP list (≈400 px) · reader pane (rest).
- Section menu, in this order: **My SOPs** · **My record** · **Training** (supervisor and up) · **Sign-offs** (supervisor and up) · **Manage SOPs** (SOP admin only, last, visually quiet, no count). Wordmark at the top of the menu; user + org at the bottom.
- SOP list (My SOPs): search (titles, steps, tools) · **Recent** · **Most used** (with "done N×") · **All SOPs** grouped by **Area** or **Type** (segmented toggle). Each row: area colour swatch, title, `area · type · ~N min`, optional status line. Area group headers are clickable and open that area on the map.
- Search with no result: worker sees "No SOP for '…'" + **Ask for one** (raises a request); SOP admin also sees **Write it**.
- Reader pane: with a SOP open → **Read** view; with no SOP open → the **site map** (below).
- Read view: the SOP chip, title, `area · type · vN · owner · ~N min`, standards labels, status line, the **start** button, and "What you'll do" (numbered steps with kind chips hazard / PPE / step / check). An unfinished SOP still shows the same start button with "Picks up at step N of M · or begin from step 1".
- Phone: no side menu — a bottom tab bar of the sections; My SOPs has a **List | Site map** toggle; opening a SOP shows Read full width with a back link.

### Site map — the library drawn (approved)
- An isometric drawing generated in code (SVG), **not** a generated picture: every library **area** is a clearly outlined, coloured, raised floor plate with a name sign and its SOP count; hover lifts it; click zooms the map into it (animated viewBox, `--dur-map-zoom`) and filters the list to that area; breadcrumb / Esc returns to the whole site.
- **Every object drawn on an area is exactly one SOP** — the map always matches the library. Object kinds: machine-like box (machine SOPs), tank, conveyor, racking, forklift, lab bench, and a **noticeboard** for processes, orders of operation and emergencies (so non-machine SOPs are as visible as machines). Zoomed in, each object carries its SOP title + status; clicking it opens Read.
- Non-selected areas dim when one is open; clicking a dimmed area switches to it.
- Phone: whole-site view uses **numbered markers** on the areas plus a tappable two-column **key** of areas under the map (names are unreadable at phone width).
- Area colours come from `--area-1..8` (data palette, says *where*, never *wrong*).
- Reference implementation: `.planning/sketches/009-sop-first-home/index.html` (`AREAS`, `slots()`, `entity()`, `siteSvg()`, `animateMap()`).

### Wordmark — sketch 010 winner (final)
- "6e Industrial continuous" in **Saira Semi Condensed**: "SOP" weight 800 in an ink chip (white text), "start" weight 600 beside it in ink, one strip of hazard tape (`--wm-tape`) running along the chip's foot and on under "start". On ink: chip inverts to white, tape uses `--wm-tape-on-ink`.
- Tokens already shipped in `src/styles/blueprint-theme.css`: `--wm-font`, `--wm-weight-sop`, `--wm-weight-start`, `--wm-ink`, `--wm-accent`, `--wm-tape`, `--wm-tape-on-ink`, `--wm-size-hero|merge|header|phone`. Guarded by `tests/lint/design-principles.spec.ts`.
- Replaces the text logo in the app chrome (section menu top, focus-screen top bar, welcome/login where the brand appears).
- Brand yellow and the tape belong to the wordmark only — never a status or warning (ADR-0004 rule 8).
- Reference implementation: `.planning/sketches/010-wordmark/logo.html` (CSS `.wm`, `.p1`, `.p2`, `::after`).

### The Start merge (final — Simon's rule)
- Rule: **each piece starts in its final form, just separated.** The read view's SOP chip IS the logo's chip (same face, weight, padding, at `--wm-size-merge` 22 px), and the start button's label IS the logo's "start" (Saira 600, lowercase "start", white on the ink button).
- Sequence on tapping start: (1) the button's ink body fades, leaving the word "start" (white → ink) while the rest of the read screen fades to paper; (2) the SOP chip **drops vertically** into line with "start"; (3) the two **slide together** to meet (centred between where they began, on the button's row); (4) the **hazard tape slides in from the left edge** into place under the joined word; (5) the finished logo **rises into the focus screen's top bar** and the focus screen (Phase 58) is revealed.
- Timings (tokens): `--dur-fuse-fade` 180, `--dur-fuse-drop` 300, `--dur-fuse-shift` 320, `--dur-fuse-tape` 340, `--dur-fuse-hold` 140, `--dur-fuse-rise` 420 ms, `--ease-fuse`. Full version on the first start of the day; ×`--fuse-short-scale` (0.3) after; **no animation under `prefers-reduced-motion`** (direct cut). Input is never blocked; the focus screen must be usable the moment it appears.
- Reference implementation: `.planning/sketches/010-wordmark/logo.html` `play()`.

### Words on screen
- Read · start · Stop · Next · Back a step · Done. "Walk" (and "Walk it", "walkthrough") never appears on screen; "Show me" → Read; completion → Done; resume → start ("Picks up at step N"). Internal identifiers (`useWalk`, `?mode=walk`) may stay.

### ADR obligations
- ADR-0004 is binding (design principles). Principle-level conflicts stop and ask Simon.
- **ADR-0003 must be superseded** by a new ADR in the same change that retires rooms (site templates fixed room positions; rooms no longer exist and the home map is generated from the library).
- ADR-0002 (no scheduled jobs) applies to anything Recent/Most used needs.

### Resolved after research (2026-10-08, by the orchestrator under ADR-0004 and existing gates — report to Simon, he may overturn)
- **R1 Machine-coverage requests removed.** `reconcileMachineRequests` (agent raises "this machine has no SOPs yet") contradicts ADR-0004 rule 4 — remove the raise path and its callers' use of it; existing request rows stay as data.
- **R2 Gates do not change.** Section visibility follows CAPABILITY-MATRIX.md exactly: Training mounts for the roles that can read the training matrix today (admin, safety manager); supervisors get Sign-offs (and their own My record) — no capability is widened in this phase.
- **R3 Type = four derived values, no schema change:** Machine (machine-linked) · Inspection / Emergency (from `category_slug` where it says so) · Process (everything else). "Order of operations" is deferred until a `sop_type` field is decided.
- **R4 Owner hidden from workers** on the Read view (T-59-30 stands); shown to supervisor and up.
- **R5 Notifications bell stays, as a dot without a number** (information, not a nagging count — ADR-0004 rule 2).
- **R6 "or begin from step 1" keeps the existing discard confirmation** (it discards a stopped run).
- **R7 The site editor moves into Manage SOPs as "Site & departments"** — departments are areas, so admins still need it; it no longer appears on the home.
- **R8 Area = machine's department → else the SOP's `sop_departments` tag → else "Site-wide"**, drawing only areas that hold at least one SOP the viewer can see (per research §2).
- **R9 The merge crosses the navigation to `/sops/[sopId]`** via a client overlay host mounted in the root layout (WAAPI), started in the same click as `router.push`; no View Transitions (experimental), no server action in the start click (Next 16.2.1 action-queue hang).

### Claude's Discretion (not discussed with Simon — decide, then state the choice in the plan)
- **What an "area" is in data.** Recommended: an area = a department (Phase 25 model); SOPs with no department/machine fall in a "Site-wide" area. Confirm against the real org's data shape.
- **What an object's kind is.** No SOP "type" field may exist; derive (machine-linked → machine-like object; not machine-linked → noticeboard) or add a minimal type field — prefer deriving if it gives a truthful map.
- **Recent / Most used data source.** Most used = the user's completion count per SOP (existing completions). Recent = most recently opened; choose server-side (a small per-user record written on Read) vs per-device localStorage; must not need a scheduled job.
- **Where governance pages that are not in the five sections land** (inbox approvals/requests, decision ledger, people & roles, access wiring). Recommended: Sign-offs holds every inbox item (sign-offs, approvals, requests) plus the decision history; a **People** section (admin / safety manager) holds people & roles and the access wiring screen unchanged. Keep the menu short and plain.
- **Area layout on the map**: auto-pack the org's areas into an isometric grid (the sketch hand-places 8); must handle 1–12 areas and areas with 1–15 SOPs.
- **Object placement inside an area**: auto grid (`slots()` in the sketch) — no editor this phase.
- How the existing scene picture, machine polygons and the map editor are treated now that the home map is generated (recommended: no longer used by the home; leave the data; remove the room code; record in the new ADR).
- Font loading via `next/font/google` (Saira Semi Condensed 600/800) — watch the bundle gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisions and principles
- `docs/adr/0004-design-principles.md` — the ten binding design principles for this phase
- `docs/adr/0003-site-templates.md` — the ADR this phase must supersede (rooms)
- `docs/adr/0002-no-scheduled-jobs.md` — no cron for Recent/Most used
- `docs/adr/README.md` — ADR rules (supersede, never edit)

### Design contracts (approved)
- `.planning/sketches/009-sop-first-home/index.html` + `README.md` — the home, section menu, list, Read view, site map (variant A is the winner)
- `.planning/sketches/010-wordmark/logo.html` + `README.md` — the wordmark and the Start merge (final)
- `.planning/sketches/MANIFEST.md` — 2026-10-07 decision entry
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` — the contract being replaced (read its focus rule, which still holds)
- `src/styles/blueprint-theme.css` — tokens (`--wm-*`, `--dur-fuse-*`, `--area-*`, type/tap tokens)

### Code being replaced or reused
- `src/app/page.tsx`, `src/components/shell/*` (OneScreen, WorkerShell, AdminShell, RoomBodies, AdminRoomBodies, SiteSummary, SiteOverview, OfficeCard) — the current home
- `src/lib/site/rooms.ts`, `src/lib/site/presets.ts` — rooms (to retire)
- `src/components/focus/*` — Phase 58 focus screen (Read/Walk/Edit), where the merge lands; `FocusTopBar.tsx` gets the wordmark
- `src/lib/journeys/journeys.ts`, `src/lib/uat/tests.ts` — must be updated in the same change
- `.planning/codebase/CAPABILITY-MATRIX.md` — update only if a gate changes
- `tests/evals/*.eval.ts` — existing one-screen / focus evals that assert rooms must be rewritten, not deleted silently

</canonical_refs>

<specifics>
## Specific Ideas

- Sketch 009's example org (Kauri Springs Bottling, 8 areas, 25 SOPs) is illustration only; the real org (SOPstart, id bd2c2b88) is the data that must look right — read its departments/machines/SOP counts before fixing the area layout, and screenshot the real org in the eval (CLAUDE.md 2026-10-05 learning on geometry).
- The merge must be judged in slow motion: keep a way to slow it in development (e.g. a query flag) — not shipped UI.
- The sketch 010 comparison page (https://claude.ai/artifact/WxeZykiefpJr4XDyPgfbrz) and the shareable logo page (https://claude.ai/artifact/Peh4t3Z2yNYVip4R6eLqU9) show the intended look and motion.

</specifics>

<deferred>
## Deferred Ideas

- An editor for arranging areas / objects on the map (auto layout only in this phase).
- App icon / favicon from the wordmark (sketch 010 showed marks; not chosen yet).
- Re-recording the /welcome promo reel with the new wordmark (`/brag`).
- Phase 61/62 todo doc items that assume rooms (Workshop, Smoko room) are superseded where they conflict; non-room items stay in that doc.

</deferred>

---

*Phase: 63-sop-first-home-library-site-map-and-the-sopstart-start*
*Context gathered: 2026-10-08 from the sketch 009/010 design conversation*
