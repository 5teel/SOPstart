# Phase 63: SOP-first Home, Library Site Map and the SOPstart Start - Research

**Researched:** 2026-10-08
**Domain:** Next 16.2.1 (App Router, webpack) / React 19.2 client shell rebuild; code-drawn isometric SVG; WAAPI choreography across a route change; Supabase RLS reads from the browser client
**Confidence:** HIGH on the current code paths, data shape and gates (read directly, real org queried read-only); MEDIUM on the fuse-across-navigation design (reasoned from the code, not yet prototyped); LOW on nothing material, but every `[ASSUMED]` item in the log needs Simon's nod before it becomes locked.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Product ranking (ADR-0004 — binding)
- Attention follows: (1) safe, competent SOP use, for every role; (2) records — sign-off, training, competence; (3) creating/converting SOPs — quiet, last, never promoted on the home, but complete and easy once started.
- Information, not instructions: no "Next for you" card, no due queues, no countdowns, no to-do counts on the home. The app does not manage anyone's workflow or time. Status (signed off · updated since you last did it · waiting for sign-off · you stopped at step N) is information shown on the row/object it describes.
- No room metaphor anywhere on screen. Plain names only.
- The library is organised by the work (area and type), never by machine alone; the app never prompts "this machine needs a SOP".

#### Layout — sketch 009 variant A (approved in shape)
- Desktop: three columns — section menu (≈220 px) · SOP list (≈400 px) · reader pane (rest).
- Section menu, in this order: **My SOPs** · **My record** · **Training** (supervisor and up) · **Sign-offs** (supervisor and up) · **Manage SOPs** (SOP admin only, last, visually quiet, no count). Wordmark at the top of the menu; user + org at the bottom.
- SOP list (My SOPs): search (titles, steps, tools) · **Recent** · **Most used** (with "done N×") · **All SOPs** grouped by **Area** or **Type** (segmented toggle). Each row: area colour swatch, title, `area · type · ~N min`, optional status line. Area group headers are clickable and open that area on the map.
- Search with no result: worker sees "No SOP for '…'" + **Ask for one** (raises a request); SOP admin also sees **Write it**.
- Reader pane: with a SOP open → **Read** view; with no SOP open → the **site map** (below).
- Read view: the SOP chip, title, `area · type · vN · owner · ~N min`, standards labels, status line, the **start** button, and "What you'll do" (numbered steps with kind chips hazard / PPE / step / check). An unfinished SOP still shows the same start button with "Picks up at step N of M · or begin from step 1".
- Phone: no side menu — a bottom tab bar of the sections; My SOPs has a **List | Site map** toggle; opening a SOP shows Read full width with a back link.

#### Site map — the library drawn (approved)
- An isometric drawing generated in code (SVG), **not** a generated picture: every library **area** is a clearly outlined, coloured, raised floor plate with a name sign and its SOP count; hover lifts it; click zooms the map into it (animated viewBox, `--dur-map-zoom`) and filters the list to that area; breadcrumb / Esc returns to the whole site.
- **Every object drawn on an area is exactly one SOP** — the map always matches the library. Object kinds: machine-like box (machine SOPs), tank, conveyor, racking, forklift, lab bench, and a **noticeboard** for processes, orders of operation and emergencies (so non-machine SOPs are as visible as machines). Zoomed in, each object carries its SOP title + status; clicking it opens Read.
- Non-selected areas dim when one is open; clicking a dimmed area switches to it.
- Phone: whole-site view uses **numbered markers** on the areas plus a tappable two-column **key** of areas under the map (names are unreadable at phone width).
- Area colours come from `--area-1..8` (data palette, says *where*, never *wrong*).
- Reference implementation: `.planning/sketches/009-sop-first-home/index.html` (`AREAS`, `slots()`, `entity()`, `siteSvg()`, `animateMap()`).

#### Wordmark — sketch 010 winner (final)
- "6e Industrial continuous" in **Saira Semi Condensed**: "SOP" weight 800 in an ink chip (white text), "start" weight 600 beside it in ink, one strip of hazard tape (`--wm-tape`) running along the chip's foot and on under "start". On ink: chip inverts to white, tape uses `--wm-tape-on-ink`.
- Tokens already shipped in `src/styles/blueprint-theme.css`: `--wm-font`, `--wm-weight-sop`, `--wm-weight-start`, `--wm-ink`, `--wm-accent`, `--wm-tape`, `--wm-tape-on-ink`, `--wm-size-hero|merge|header|phone`. Guarded by `tests/lint/design-principles.spec.ts`.
- Replaces the text logo in the app chrome (section menu top, focus-screen top bar, welcome/login where the brand appears).
- Brand yellow and the tape belong to the wordmark only — never a status or warning (ADR-0004 rule 8).
- Reference implementation: `.planning/sketches/010-wordmark/logo.html` (CSS `.wm`, `.p1`, `.p2`, `::after`).

#### The Start merge (final — Simon's rule)
- Rule: **each piece starts in its final form, just separated.** The read view's SOP chip IS the logo's chip (same face, weight, padding, at `--wm-size-merge` 22 px), and the start button's label IS the logo's "start" (Saira 600, lowercase "start", white on the ink button).
- Sequence on tapping start: (1) the button's ink body fades, leaving the word "start" (white → ink) while the rest of the read screen fades to paper; (2) the SOP chip **drops vertically** into line with "start"; (3) the two **slide together** to meet (centred between where they began, on the button's row); (4) the **hazard tape slides in from the left edge** into place under the joined word; (5) the finished logo **rises into the focus screen's top bar** and the focus screen (Phase 58) is revealed.
- Timings (tokens): `--dur-fuse-fade` 180, `--dur-fuse-drop` 300, `--dur-fuse-shift` 320, `--dur-fuse-tape` 340, `--dur-fuse-hold` 140, `--dur-fuse-rise` 420 ms, `--ease-fuse`. Full version on the first start of the day; ×`--fuse-short-scale` (0.3) after; **no animation under `prefers-reduced-motion`** (direct cut). Input is never blocked; the focus screen must be usable the moment it appears.
- Reference implementation: `.planning/sketches/010-wordmark/logo.html` `play()`.

#### Words on screen
- Read · start · Stop · Next · Back a step · Done. "Walk" (and "Walk it", "walkthrough") never appears on screen; "Show me" → Read; completion → Done; resume → start ("Picks up at step N"). Internal identifiers (`useWalk`, `?mode=walk`) may stay.

#### ADR obligations
- ADR-0004 is binding (design principles). Principle-level conflicts stop and ask Simon.
- **ADR-0003 must be superseded** by a new ADR in the same change that retires rooms (site templates fixed room positions; rooms no longer exist and the home map is generated from the library).
- ADR-0002 (no scheduled jobs) applies to anything Recent/Most used needs.

### Claude's Discretion (not discussed with Simon — decide, then state the choice in the plan)
- **What an "area" is in data.** Recommended: an area = a department (Phase 25 model); SOPs with no department/machine fall in a "Site-wide" area. Confirm against the real org's data shape.
- **What an object's kind is.** No SOP "type" field may exist; derive (machine-linked → machine-like object; not machine-linked → noticeboard) or add a minimal type field — prefer deriving if it gives a truthful map.
- **Recent / Most used data source.** Most used = the user's completion count per SOP (existing completions). Recent = most recently opened; choose server-side (a small per-user record written on Read) vs per-device localStorage; must not need a scheduled job.
- **Where governance pages that are not in the five sections land** (inbox approvals/requests, decision ledger, people & roles, access wiring). Recommended: Sign-offs holds every inbox item (sign-offs, approvals, requests) plus the decision history; a **People** section (admin / safety manager) holds people & roles and the access wiring screen unchanged. Keep the menu short and plain.
- **Area layout on the map**: auto-pack the org's areas into an isometric grid (the sketch hand-places 8); must handle 1–12 areas and areas with 1–15 SOPs.
- **Object placement inside an area**: auto grid (`slots()` in the sketch) — no editor this phase.
- How the existing scene picture, machine polygons and the map editor are treated now that the home map is generated (recommended: no longer used by the home; leave the data; remove the room code; record in the new ADR).
- Font loading via `next/font/google` (Saira Semi Condensed 600/800) — watch the bundle gate.

### Deferred Ideas (OUT OF SCOPE)
- An editor for arranging areas / objects on the map (auto layout only in this phase).
- App icon / favicon from the wordmark (sketch 010 showed marks; not chosen yet).
- Re-recording the /welcome promo reel with the new wordmark (`/brag`).
- Phase 61/62 todo doc items that assume rooms (Workshop, Smoko room) are superseded where they conflict; non-room items stay in that doc.
</user_constraints>

<phase_requirements>
## Phase Requirements

No IDs were assigned. Proposed set (derived from CONTEXT.md; the planner should adopt or rename):

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-01 | Section menu + three columns on desktop, bottom tab bar on phone; sections role-gated per CONTEXT | §Current home, §Section map (Q7), pitfalls 8, 14 |
| HOME-02 | My SOPs list: search, Recent, Most used, All SOPs by Area/Type, row status, search-miss Ask/Write | §Library data (Q2), §Recent/Most used (Q3) |
| HOME-03 | Read pane: chip, meta, standards, status, start button, "What you'll do", resume wording | §Read pane data, §Focus screen (Q4) |
| HOME-04 | Section bodies: My record, Training, Sign-offs, People, Manage SOPs (+ site setup) with gates unchanged | §Section map (Q7) |
| HOME-05 | URL state + legacy address compatibility (`?place=`, stored notification places, BackToSite, focus `from`) | §URL state, Runtime State Inventory |
| MAP-01 | Pure derivation of area / type / object kind from existing data | §Library data (Q2) |
| MAP-02 | Isometric SVG generated in code; auto layout of 1–12 areas, 1–15 objects/area; tokens only | §Map implementation (Q9) |
| MAP-03 | Zoom/filter/dim/Esc/breadcrumb, keyboard + labels, reduced motion | §Map implementation (Q9) |
| MAP-04 | Phone: numbered markers + key, List \| Site map toggle | §Map implementation (Q9) |
| BRAND-01 | Wordmark component, Saira font, placed in menu, focus top bar, auth, welcome | §Font (Q6) |
| FUSE-01 | Start merge across the home → focus navigation; first-of-day full, short after, none when reduced | §Focus + merge (Q4) |
| FUSE-02 | Start lands in the running SOP (autostart on the focus page), resume wording | §Focus + merge (Q4) |
| WORD-01 | "Walk"/"Show me" removed from screens; server error strings and their client keys changed in lockstep | §Word sweep (Q5) |
| RET-01 | Retire rooms, stage, pins, Now card, OfficeCard; ADR-0005 supersedes ADR-0003; delete/repoint guards | §Rooms inventory (Q1) |
| GATE-01 | Bundle gate: lazy seams, marker list repaired, baselines only move down | §Bundle (Q6) |
| DOC-01 | `journeys.ts`, `uat/tests.ts`, CAPABILITY-MATRIX (if a gate moves), CLAUDE.md learnings, sketch skill refs | §Validation |
| EVAL-01 | Deployed eval for the new home + real-org screenshot; rewrite room evals | §Evals (Q8) |
</phase_requirements>

## Summary

The current home (`src/app/page.tsx` → `OneScreen` → `WorkerShell` | lazy `AdminShell` → `ShellFrame`) is a three-pane frame driven by one `Place` state (`overview | edit | room | machine | dept`), a Konva-free but heavy `PlantStage` picture, four fixed-fraction rooms (`src/lib/site/rooms.ts`, `presets.ts`) and a detail pane that switches between room bodies, machine panels and a "site overview" (objectives, notifications, my requests). Everything the new home needs already exists as data: published SOPs under RLS (`library-sops` query), departments, machines, `sop_machines` links, `sop_departments`, completions, in-progress walks. **No schema change is needed.** The real org (SOPstart, `bd2c2b88`) is small: 4 published SOPs, 3 departments that hold SOPs (Forming 2 / Engineering 1 / General 1 by the rule below), 13 machines, 28 drafts, 4 completions by one worker. The eval-site org has 20 junk "EVAL Zone …" departments that hold no SOPs, so **an area must be a department that has at least one published SOP, never "every department"**.

The focus screen is a separate server-rendered route (`/sops/[sopId]`, with a `loading.tsx`), so the Start merge **must cross a navigation**. View Transitions are unsuitable (experimental flag, Next's own docs advise against production, and they cannot hold a mid-point meet). Recommended: reproduce the sketch's WAAPI overlay (veil + real wordmark DOM) in a tiny client host mounted in the **root layout** so it survives the route change, start `router.push` from the click handler at t=0, and let the host wait for a `[data-wm-target]` in the focus top bar before the rise. The focus page gains an autostart flag so "start" lands directly in the running SOP.

**Primary recommendation:** Build one new `HomeShell` (single component tree, role only changes which sections mount and which section bodies are lazy), keep Read as a compact outline in the reader pane read via the browser Supabase client (no server action, no owner name for workers), derive area/type/object-kind in one pure module, draw the map as React-rendered SVG from pure geometry (lazy chunk), run the Start merge from a persistent root-layout host, and retire rooms in the same change as ADR-0005. Measure the bundle in Wave 0 and keep the map, the section bodies and the fuse engine behind `next/dynamic` — `/page` is already at +2 KB of tolerance.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Section/URL state (`s`, `sop`, `area`, `tab`) | Browser (client state + `history.replaceState`) | Frontend Server (`page.tsx` parses initial props, legacy `?place=` redirect) | Existing idiom (ShellFrame `select()`); never `router.push` for in-page state |
| Library list, search, Recent/Most used | Browser (React Query over browser Supabase client, RLS) | — | `useWorkerSops` already does this; no server action keeps the 2026-09-29 action-queue trap away |
| Area / type / object-kind derivation | Browser (pure module) | — | Plain module imported by list, map and Read; one classifier (CLAUDE.md 2026-09-27) |
| Isometric map geometry + render | Browser (lazy chunk) | — | Pure geometry module + React SVG; no I/O |
| Read pane steps / standards | Browser (RLS reads of `sop_focus_steps`, `sop_sections`, standards) | — | `loadFocusSop` imports the admin client via `userLabels` and cannot ship to the client; `getFocusSop` is edit-gated |
| Starting a SOP (walk row) | API / Backend (`startWalk` server action, session-scoped) | Browser (autostart effect on the focus page) | Server row is the truth (Phase 58 D-09) |
| Start merge animation | Browser (root-layout host, WAAPI) | Frontend Server (focus page renders the target) | Pure presentation; must outlive the home page component |
| Sign-offs / People / Manage bodies | Browser (existing lazy `OfficePane` etc.) | API / Backend (existing guards, unchanged) | Gates are server guards + RLS; `tabsForRole` only decides what mounts |
| Wordmark + font | CDN / Static (self-hosted font via `next/font`) | Browser (CSS) | No JS cost |
| Legacy address compatibility | Frontend Server (`page.tsx` `redirect()`), proxy for path-based ones | Browser (`placeTarget` for stored notification places) | Server-side redirects only (CLAUDE.md 2026-09-29) |

## 1. Current home render path (Q1)

**Entry.** `src/app/page.tsx:15-44`: server component. `getSessionContext()` → `redirect('/welcome')` if signed out, `redirect('/pending')` if no role. Reads org name, awaits `searchParams` (`place`, `tab`, `sop` — `sop` UUID-gated, L13/L40), renders `<ProtectedProviders><OneScreen …/></ProtectedProviders>`.

**Fork.** `src/components/shell/OneScreen.tsx:19-27`: `useIsAdmin()` (admin or safety_manager) → `AdminShell` via `next/dynamic({ssr:false})`, else `WorkerShell` (static import so the `/` gate measures the worker's real first download). Supervisors get `WorkerShell` with `isSupervisor` branches.

**WorkerShell** (`WorkerShell.tsx`): feeds `ShellFrame` from
- `listSiteForWorker()` (server action, `['site-worker']`, staleTime 30 min) — returns `layout: null, machines: [], links: [], departments: []` when there is no layout/scene OR no machines (`site-worker.ts:43-46, 78-85`). **Departments are therefore unavailable from this action whenever a site has no machines — do not reuse it for areas.**
- `useWorkerSops()` (`src/hooks/useWorkerSops.ts`): `['user-sop-assignments']` (server action `getUserSopAssignments`), `['library-sops']` (browser client: `sops` where `status='published'`, selecting `id,title,sop_number,category_slug,department,published_at,placement,version,parent_sop_id,status`, latest version per lineage), `['worker-last-completions']` (browser client: own non-rejected `sop_completions`, newest first, map sop_id→submitted_at), `['sop-refresher-intervals']` (all visible `sops`: `parent_sop_id`, `refresher_interval_months`). Output `WorkerSop` (`worker-signal.ts:33-51`): `lastCompletedAt`, `isRefresherDue/Overdue`, `hasNewerVersion`, `isAssigned`, `raw`.
- Supervisor only: `getOfficeInbox()` (`['office-inbox']`) for the Office pin.
- Derived and **to be retired**: `derivePlantPins`, `pickNowQueue`, `compareToDoFirst`, `dueTotal`, `noticeboardDue`, `roomPins`, `NowCard` — these are exactly the "to-do counts / Next for you" ADR-0004 bans.

**AdminShell** (`AdminShell.tsx`): `getAdminShell()` (`shell.ts`; `requireAdminContext()`; **calls `ensureReviewDueNotifications` and `reconcileMachineRequests`** then `loadInbox()`), room pins, `OfficeCard`, `AdminWorkshopBody`, `AdminNoticeboardBody`, `AdminMachineBody`, and `SiteEditSurface` (L59-109: `DepartmentsStrip` + `SiteWorkspace` over `listSiteForOrg()`; place `edit`).

**ShellFrame** (`ShellFrame.tsx`): one `place` state (`useState(parsePlace(initialPlace, initialTab))`, L115); `select(p)` = `setPlace` + `window.history.replaceState(null,'',formatPlace(p))` (L128-131; no router, user events only). Esc → overview (L135-148; ignores typing targets and `[aria-modal="true"]`). `resolvePlace` (L73-89) turns unknown ids / unauthorised edit / disallowed Office tab into the overview or Inbox at render time (T-57-04/07, T-59-11). Left pane: search, bell slot, `renderCard`, Rooms / Departments / Machines lists, `account` footer. Middle: `PlantStage` (picture + polygons + rooms). Right: detail pane (`lg:w-100`, wide `58%` for table tabs).

**Detail bodies by place.** Room `office` → `OfficePane` (lazy; tabs inbox/requests/decisions/people/access via `tabsForRole`, `src/lib/shell/office-tabs.ts:9-20`) for supervisor+ or `OfficeWorkerBody` (status counts + link to `/activity`); `smoko` → `SmokoBody` (completion count + link `/activity`; admin adds link `/admin/training`); `workshop` → `WorkshopWorkerBody` (placeholder "arrives in a later update") or `AdminWorkshopBody` (drafts + new SOP); `noticeboard` → site-wide SOP rows; machine → `MachineBody`/`AdminMachineBody`; overview → `SiteSummary` + `SiteOverview` (objectives, notifications, my requests, Office link; `SiteOverview.tsx` is ~580 lines and **reads notifications through the browser Supabase client on purpose — no server action on that path**).

**Room-dependent modules (retire or rewrite):**
- `src/lib/site/rooms.ts` (ROOMS, ROOM_IDS, `roomPolygon`, `roomMatches`), `src/lib/site/presets.ts` (`PRESET_ROOMS`, `roomsFor`, `presetRooms`; the **template pictures/departments/machines in the same file stay** — `SiteEmptyState`, `applySitePreset` use them).
- `src/lib/validators/site.ts:8,120` (`Room` type, `WorkerSiteLayout.rooms`), `src/actions/site.ts:55,591` and `src/actions/site-worker.ts:20,80,138` (`rooms: roomsFor(layout.preset)`), `src/components/welcome/PromoReel.tsx:18,31` (`PRESET_ROOMS.bottling` Office rect — **/welcome will not compile if `presets.ts` loses it**).
- `src/lib/shell/place.ts` (imports `ROOM_IDS`), `office-tabs.ts` (imports `Place`), `overview-focus.ts`, `query-keys.ts`; `src/lib/notifications/places.ts` (`notificationPlace()` writes `/?place=office`, `placeTarget()` parses stored ones); `src/lib/sop/focus-path.ts` (`backHref`, `focusHref` `from` whitelist go through `parsePlace`); `src/components/layout/BackToSite.tsx` → `placeForPath()` (`/activity`, `/admin/training` → `/?place=smoko`; `/admin/sops/new*` → `/?place=workshop`; `/admin/settings` → `/?place=office`); `src/lib/supabase/middleware.ts:6` (`officeRedirectFor`); `next.config.ts` redirects `/admin/departments` and `/admin/site` → `/?place=edit`.
- Components: `ShellFrame`, `WorkerShell`, `AdminShell`, `RoomBodies`, `AdminRoomBodies`, `SiteSummary`, `OfficeCard`, `WorkerObjective`, `sop/plant/{PlantStage,MachinePanel,NowCard,RelBadge}`, `admin/governance/AdminMachinePanel` (no importer other than the shell). `SiteOverview` is split, not deleted (see §7). `lib/site/scene.ts` stays (admin `SiteWorkspace`/`SiteEditor` import it).
- `src/actions/shell.ts` (`getAdminShell`) has no other consumer once `AdminShell` goes.

**Tests / evals / guards that reference rooms or the shell** (grep: `site/rooms|site/presets|shell/place|office-tabs|roomsFor|ROOM_IDS|shell-room-row|room-body|place=…|OneScreen|ShellFrame|WorkerShell|AdminShell|RoomBodies`): 53 files. Groupings:
- **Retire with the code** (ADR-0003's guard and the shell's own structure specs): `tests/phase57/{rooms,stage,pins,noticeboard,machine-body,search,shell-structure,one-query,place,retirement-sweep,repoint-inventory}.spec.ts`; `tests/phase52/{plant-now-card,plant-panel}.spec.ts`; `tests/phase59/{shell-wide,place-tab}.spec.ts`; `tests/phase60/{bell-structure,overview-structure,objective-meta,office-requests,request-surfaces}.spec.ts` where they grep the shell files; `tests/phase51/site-workspace-wiring.spec.ts` only if it greps `AdminShell`.
- **Repoint** (they test code that survives under a new address): `tests/phase58/{focus-path,frame-structure,edit-rail,walk-no-leak,legacy-redirects}.spec.ts`, `tests/phase59/{office-pane-structure,signoff-panel,legacy-redirects,capability-matrix,owner-review-meta}.spec.ts`, `tests/phase60/notification-places.spec.ts`, `tests/phase55/worker-path-contract.spec.ts`, `tests/lint/no-static-admin-lens-import.spec.ts`, `tests/phase41/*`, `tests/phase43/route-truth.spec.ts`.
- **Evals to rewrite** (not delete silently): `tests/evals/one-screen.eval.ts` (512 lines: rooms, machine click, Now card, pins, Workshop, Esc), `office.eval.ts` (966; `?place=office&tab=…`, Smoko link to the training bridge), `requests.eval.ts` (715), `cut-features.eval.ts` (294), `sop-focus.eval.ts` (625; "Start walking", "Resume where you left off (step 3 of 5)", Back), `sop-ledger.eval.ts`, `site-templates.eval.ts`, `tests/evals/lib/walk.ts`.
- Run the **inventory first**: Wave 0 should add `tests/phase63/repoint-inventory.spec.ts` in the style of the 57/58/59/60 inventories, built from `grep -rlE "<module paths>" tests`, so every red spec after the change is already classed retire / repoint.

**URL state today.** `?place=` (`overview` none, `edit`, room name, machine UUID, `dept:<UUID>`), `?tab=` (Office tabs, Office room only), `?sop=` (UUID; only pins the Access tab). New params must not reuse `sop` for a different meaning without mapping old links (see §URL state below).

## 2. Data for the library map (Q2)

**Real org, queried read-only 2026-10-08 (Management API, org `bd2c2b88`)** [VERIFIED: live query]:

| Fact | Value |
|---|---|
| Departments (not archived) | Engineering (7 machines), Forming (6), General (0 machines) |
| Machines | Alkaline cleaning tank, Annealing lehr, Cold-end inspection line, Forklift, Furnace & forehearth, Hot-melt gluer, IS Machine 1, IS Machine 2, Lathe, Office terminal, Palletiser, Racking, Workbench |
| Published SOPs | 4 (3 `placement='machine'`, 1 `'site'`); drafts 27 + 2 reading |
| Published SOP → machine@dept / `sop_departments` / category | OTG Probe Maintenance → Annealing lehr@Forming / General, Forming / `maintenance`; Automated Sample Challenge Recording → Cold-end inspection line@Forming / General / `machine-operation`; Alkaline Cleaning Tank Operation → Alkaline cleaning tank@Engineering / General / `manufacturing`; Dog Bathing and Grooming → none / General / null |
| Steps (`sop_focus_steps`) | 45 / 24 / 42 / 26 |
| Completions | 4 total, 1 worker; standards attachments 0 |
| Layout | preset null, scene 2752×1536 (not needed by the new home) |

**Important:** `sop_departments` carries **General on all four** published SOPs (it is a visibility tag, Phase 25, and a SOP may carry several). Taking "first sop_department" alone would put the whole library in "General". The machine's department is the more specific signal.

**Recommended area rule (pure, one module, `src/lib/library/areas.ts`):**
1. SOP linked to ≥1 machine → the department of its first linked machine (order by `site_machines.sort`, then name) when that department exists and is not archived.
2. else the first of its `sop_departments` (non-archived; order by name).
3. else the literal area `site-wide` ("Site-wide").
Areas = only departments (or Site-wide) that **hold at least one published SOP the viewer can read**. Empty departments never draw (this also prevents the "machine needs a SOP" prompt, ADR-0004 rule 4, and the 20 junk eval departments). Area id = department UUID or `site-wide`. Applied to the real org this yields **3 areas: Forming (2 SOPs), Engineering (1), General (1)** — truthful, no schema change. [ASSUMED A1 — refines CONTEXT's "area = department" with the machine-first precedence; needs Simon's nod because it changes which area a multi-department SOP lands in.]

**Reads (all browser client under RLS, no server action):** `departments` (`departments_org_read`), `site_machines` (`org_members_can_view_site_machines`), `sop_machines` (`org_members_can_view_sop_machines`), `sop_departments` (`sop_departments_read_all_auth`, a `using(true)` junction — always filter `.in('sop_id', visibleIds)`). All verified by `pg_policies` [VERIFIED: live query]. Add them as one `useLibraryAreas()` hook beside `useWorkerSops` (CLAUDE.md 2026-09-27: one place builds the per-SOP list). Do **not** gate on `site_layouts`/scene.

**Object kind (map glyph).** `placement==='machine'` → pick a glyph from the first linked machine's name with a small keyword table (tank|vat|silo → tank; conveyor|lehr|line|belt → conveyor; forklift|truck → forklift; rack|shelv → rack; bench|lab → bench; else machine box); everything else → noticeboard. Cosmetic only — each object is still exactly one SOP, so the map cannot disagree with the library. On the real org: tank, conveyor, conveyor, noticeboard. [ASSUMED A3]

**Type (list grouping).** `sops.category_slug` exists (Phase 40, 15-value fixed vocabulary in `src/lib/sop-categories.ts`; editable in `ThisSopBlock`; real org: `maintenance`, `machine-operation`, `manufacturing`, null). It does **not** contain machine/process/inspection/emergency/order-of-operations. Minimal honest derivation with no schema change, in `src/lib/library/sop-type.ts`: `emergency` slug → **Emergency**; `quality` slug → **Inspection**; `placement==='machine'` → **Machine**; else **Process**. **"Order of operations" cannot be derived truthfully** and should not be faked; ADR-0004 lists five types, so either ship four and name the gap in ADR-0005, or add a nullable `sops.sop_type` + editor field (a migration plus an editor change — out of this phase's boundary). Recommendation: four types now, the fifth when an authored field exists. [ASSUMED A2 — Simon decides.]

## 3. Recent / Most used (Q3)

Data that exists: `sop_completions` (own rows by RLS `workers_see_own_completions`; columns `sop_id, sop_version, status, submitted_at, completion_type…`), `sop_walks` (own rows by `workers_can_view_own_sop_walks`; `status in_progress|…`, `done`, `current_step_id`, `started_at`, `updated_at`, `submitted_at`). **"Opened" is not recorded anywhere.**

- **Most used = completions per lineage root, own, non-rejected**, shown as "done N×". `useWorkerSops` already fetches every own non-rejected completion (`worker-last-completions`, L72-94) and discards all but the newest per `sop_id`. Extend that query (add `status`, keep all rows) to also return counts per lineage root (`rootOf` via `sop-refresher-intervals`, L124) — one query, one derivation. Top 3.
- **Recent = hybrid, no table, no job.** (a) Per-device `localStorage` list `sopstart-recent:<userId>` of `{root, t}` (max ~10) written in the click handler that opens Read; (b) merged with server recency from the same data already loaded: `sop_walks.updated_at` (in-progress), `sop_completions.submitted_at`. Sort by the latest time per lineage root, top 4, resolve root → current published id. The hybrid means a new device is not blank and a read-only SOP still appears on the device that read it. Read `localStorage` through `useSyncExternalStore` (server snapshot `[]`) so first render matches SSR (CLAUDE.md 2026-06-08). Validate every stored id with the UUID regex and cap length (treat as untrusted input). [ASSUMED A4]
- Rejected alternative: a `sop_opens` table written by a server action on Read. It adds an RLS surface and, worse, a server action fired on the same user gesture sequence as the start navigation — the exact Next 16.2.1 action-queue hazard (CLAUDE.md 2026-09-29). ADR-0002 is satisfied by either; the hybrid is cheaper and safer.
- **Status line (information on the row):** signed off (latest non-rejected completion `signed_off`) · waiting for sign-off (`pending_sign_off`) · updated since you last did it (`hasNewerVersion`, already derived) · you stopped at step N (an `in_progress` walk; add a `['worker-walks']` browser query of own in-progress walks; N for a list row = done-count + 1 as an approximation, exact `currentIndex(walkOrder(...))` in Read). Do **not** show approver names (resolving a name needs `userLabels`, an admin-client module). `plantRelState`'s `due/never` states are the retired to-do vocabulary — do not carry them into rows.

## 4. The focus screen and the merge (Q4)

**Where start lives today.** The focus screen is **its own route** `src/app/(protected)/sops/[sopId]/page.tsx` (server component; resolves the version, in-progress walk, completions; `loading.tsx` skeleton exists) rendering `FocusWalker` (`'use client'`): `useWalk` holds `phase browse|walk|review|sent`; browse = `BrowseDocument` with the sticky **"Start walking"** button (`BrowseDocument.tsx:152-164`, testid `focus-start-walking`) calling `w.start()` (`useWalk.ts:138-…`: `walk ? {walk} : await startWalk({sopId})`, then `goStep`). Resume = `ResumeCard` (`walk-resume-button` "Resume where you left off (step N of M)", `walk-start-over` with a confirm dialog that says progress "will be thrown away"). The top bar (`FocusTopBar.tsx`) is `Back` · title · chip · slot · "Steps · n of N"; **it has no wordmark**. `Back`/Esc = `useFocusBack` → `router.push(backHref(from))`, `from` being a whitelisted place token. `?mode=edit` opens the editor; `?mode=walk` **does not exist** (the only `walk` mode strings are `FocusMode`/`ModeSwitch` values).

**Consequence.** The home's Read pane and the focus route's `BrowseDocument` are two Read surfaces. Recommended split: the home reader pane is the **compact Read outline** (numbered steps + kind chips + start); `BrowseDocument` remains for deep links and notifications (`focusHref` callers: `SiteOverview`, `places.ts`, `MachinePanel`) with its button text changed to **start**. Do not try to mount `FocusWalker` inside the home: its data comes from a server page (`resolveFocusTarget`, in-progress version rules, superseded redirects) and `loadFocusSop` cannot be imported client-side (it imports `userLabels` → `createAdminClient`). `getFocusSop` is `requireSopEditAccess`-gated (admin editor only).

**Read pane data (worker-safe, browser client + RLS, key `['read-sop', id]`):** `sops` row (`title, version, category_slug, placement, allow_forward_jump, status, parent_sop_id`), `sop_sections` (`id,title,sort_order`), `sop_focus_steps` (`id, section_id, kind, text, time_estimate_minutes, photo_required, sort_order`), `standards` + `standard_attachments` (SOP-level labels), own `sop_walks` in-progress. Order and indexes come from the existing plain `walkOrder`/`currentIndex` (`src/lib/sop/focus.ts`); chips from `KindChip`; labels from `StandardLabels`. Minutes = sum of `time_estimate_minutes` (same as `totalMinutes`). **Owner:** the sketch shows `owner Ana Tupou`, but Phase 59 T-59-30 ("the owner's name only goes to people who can open the editor — never browse or walk", `[sopId]/page.tsx:112-120`) forbids resolving it for workers. Recommendation: omit owner for workers/supervisors, show it for admin/safety manager only through the existing server path. Needs Simon's confirmation (the meta line in CONTEXT lists owner). [ASSUMED A8]

**Merge design — three options evaluated.**

| Option | Verdict |
|---|---|
| React `<ViewTransition>` / `experimental.viewTransition` | **Reject.** `node_modules/next/dist/docs/.../viewTransition.md`: flag is `experimental`; "for now, we strongly advise against using this feature in production". The vendored React exports `ViewTransition` (`next/dist/compiled/react`), but stable `react@19.2.4` does not, and a view transition cannot keyframe a mid-point where two elements meet (sketch 009 README says the same). [VERIFIED: Next 16.2.1 docs in node_modules] |
| Mount focus in place inside the home | **Reject.** See above (server-resolved data, edit gating, 795 KB route gate). |
| **Persistent overlay host + navigate at t=0** | **Recommend.** |

**Recommended mechanism.**
1. A `Wordmark` React component (variants: `full`, `chip`, `startLabel`; `onInk`) with its CSS in `blueprint-theme.css` (`.wm`, `.wm-sop`, `.wm-start`, `::after` tape) — the single definition used by the menu, focus top bar, auth layout, Read chip, start button and the host.
2. The Read pane renders the chip and the start button's label with the same classes at `--wm-size-merge`, each with a `data-fuse="sop|start|button"` hook.
3. On tap (click handler, never an effect): read `prefers-reduced-motion` (→ plain `router.push(focusHref(id,{from, go:1}))`, no overlay) and the first-of-day flag (`localStorage 'sopstart-fuse-day' === new Date().toDateString()` → short ×`--fuse-short-scale`); measure the three rects; call `fuse.play({rects, scale})` on a tiny module-level store; **call `router.push` in the same handler**.
4. `FuseHost` (client, mounted once in `src/app/layout.tsx` so it survives the route change; renders `null` until triggered; the choreography engine is `import()`ed on first Read open so the shared chunk stays ~0.3 KB) draws the veil (`position:fixed`, paper, `pointer-events:none`), the fading button body, and a real `Wordmark` DOM positioned over the sources, and runs the five stages with WAAPI using the token durations (`getComputedStyle(document.documentElement).getPropertyValue('--dur-fuse-fade')` etc., so the CSS file stays the single source). Originals get `visibility:hidden` while the clones animate.
5. Stage 5 (rise): the host polls (rAF, ≤ ~2.5 s) for `[data-wm-target]` — the wordmark slot in `FocusTopBar` — then animates translate+scale to its rect, fades the veil, removes itself and un-hides the target. On timeout or a navigation error: fade the veil out and restore the originals.
6. The overlay is `pointer-events:none`; the focus screen underneath is interactive as soon as it mounts. A re-entrancy guard ignores a second start while playing.
7. Dev slow-mo: `?fuse=slow` read inside the handler (multiplier 4), not a UI control.

Why navigate at t=0 rather than after stage 4: `loading.tsx` makes the route commit the skeleton immediately, so a home component that waits would be unmounted underneath its own animation anyway; the host, being in the root layout, is not. It also overlaps server render time with the animation, which matters for the short (~0.4 s) version.

**Start must land in the running SOP.** Add an autostart flag, e.g. `?go=1` (name is the planner's): `FocusWalker` calls `w.start()` once in a mount effect when the flag is present, `canWalk`, steps exist and no error, then strips the flag with `history.replaceState` (same idiom as `syncUrl`). Guards: a ref against the StrictMode double effect; while `autostart` is pending render a blank paper column instead of `BrowseDocument` (otherwise the full browse document flashes under the rising logo). `w.start()` already resumes an existing walk (`walk ? {walk}`), so "Picks up at step N" costs nothing. **Pitfalls found:** `[sopId]/page.tsx:107` `redirect(focusHref(target.id,{from}))` (an in-progress walk on an older version) drops query params — carry `go` through; `RouteTransition` (`(protected)/layout.tsx`) replays a 180 ms `page-shell-enter` fade-up on every pathname change and will fight the rise reveal — suppress it while the host is active (data attribute) or accept; `startWalk` is a server action fired from a mount effect on the new page — safe, because no navigation is in flight at that moment (the nav that mounted the page has committed). [ASSUMED A6/A7]

"**or begin from step 1**": today the discard path is `ResumeCard` → confirm dialog → `startOver()` (`useWalk`), which ends with a `router.push`. Silent discard of ticks and photos from a link would be a regression of a deliberate safeguard; recommend the link navigates to the focus browse (which shows `ResumeCard`) or reuses that confirm in Read. Needs Simon's nod. [Open Q6]

**Words on the focus screen.** `Stop` is the worker verb for leaving a running SOP: `FocusTopBar` shows `Back` in browse and `Stop` while walking (same `goBack`). The admin `ModeSwitch` labels `Walk | Edit` (`FocusTopBar.tsx:30`, pinned by `tests/phase58/edit-rail.spec.ts:146`) become `Read | Edit`.

**Next 16.2.1 action-queue hazard (CLAUDE.md 2026-09-29).** Still live in the pinned `next@16.2.1`; `npm view next` reports **16.4.0** as latest (the upstream fix is in 16.3). The recommended design keeps the home free of server actions at the moment of navigation: library, Read, Recent, status all use the browser client; the only home server actions are mount-time (`getUserSopAssignments`, `getOfficeInbox` when Sign-offs is open) and long settled before anyone can tap start. Upgrading Next is out of scope here but is the structural fix; note it in the plan as a follow-up, not a task.

## 5. The "walk" word sweep (Q5)

Search method: `grep -rniE "walk"` over `src`, then user-visible filtering. **Must change (visible to a person):**

| Where | Text |
|---|---|
| `components/focus/BrowseDocument.tsx:77` | "Updated since you last walked it" → "Updated since you last did it" |
| `BrowseDocument.tsx:161` | "Start walking" → "start" |
| `components/focus/ResumeCard.tsx:36,48,63` | "Resume where you left off (step N of M)" → "Picks up at step N of M" wording; "…from this walk will be thrown away"; "Keep walking" |
| `components/focus/FocusTopBar.tsx:30` | `Walk` switch label → `Read` |
| `components/office/SignOffPanel.tsx:316,389-392` | "This walk has already been…", "Reject this walk?", "…need to walk it again.", "Reject walk" |
| `app/(protected)/activity/WorkerActivityView.tsx:31` | "Complete an SOP walkthrough to see your history here." |
| `components/welcome/PromoReel.tsx:501` | "Tap a machine, walk the steps, send for sign-off." (the reel re-record is deferred; this one line is copy on a live route) |
| Server error strings that reach the screen | `actions/walk.ts:58,87,117,194,203,211` ("Start the walk again.", "…not available to walk.", "Could not start the walk…"); `actions/completions.ts:46,49,245,248,310,418,485` ("You cannot sign off your own walk", "This walk has already been decided.", ledger summary "Sent a walk for sign-off"); `actions/office.ts:137,286` ("…'s walk of …") |
| `lib/journeys/journeys.ts` (27 hits), `lib/uat/tests.ts` (12), `lib/journeys/roles.ts:61,181` | rendered on `/pathways` and `/uat` |
| Retired with their files (no edit) | `MachinePanel.tsx:66`/`AdminMachinePanel.tsx:66` "Walk ›", `NowCard.tsx:76,83` "Walk it"/"Show me", `RoomBodies.tsx:66-67`, `WorkerShell.tsx:185` |

**Lockstep trap.** `useWalk.ts:32-35` `STALE_WALK` is keyed by the **exact server strings** `'Start the walk again.'` and `'That step is not part of this SOP.'`, pinned by `tests/phase58/walk-no-leak.spec.ts:51`. Renaming `walk.ts:117,194` without the map silently turns a stale-walk recovery into a generic error. Change both ends and the spec in one commit (`completions.ts:46,49,418` use the same string).

**Stay (internal):** `useWalk`, `WalkStep`, `FocusWalker`, `FocusMode 'walk'`, `sop_walks`, `startWalk`/`recordWalkStep`/`startOverWalk`, `walkOrder`, testids `walk-*` and `focus-start-walking`, `agent` descriptions in `actions/introspection.ts:48,53,102` (not shown to a worker; low priority). **Ambiguous, leave unless Simon says otherwise:** `components/focus/admin/AiCheckBanner.tsx:102` "Show me" (admin editor: jump to a finding, pinned by `tests/phase58/parse-progress-ui.spec.ts:113`) — a different control from the retired Now-card "Show me". Existing ledger/notification rows in the database keep their old wording (history is not rewritten).

**Source-contract specs that pin the old strings** (repoint in the same commit): `tests/phase58/frame-structure.spec.ts:140-145`, `edit-rail.spec.ts:146`, `walk-no-leak.spec.ts:51`, `tests/phase59/signoff-panel.spec.ts`, `tests/evals/sop-focus.eval.ts` (`:208`), `tests/evals/lib/walk.ts:26`. Add a **new sweep guard** (`tests/lint/no-walk-words.spec.ts`, registered in a project): scan `src/components`, `src/app`, user-facing action strings for `/\b[Ww]alk(s|ed|ing|through)?\b/` inside string literals / JSX text, with an allowlist for the internal identifiers above and for `introspection.ts`.

## 6. Font and bundle (Q6)

**Font.** The app currently loads **no web font at all** (no `next/font`, no `@font-face`, no `@import`; `'Inter'`/`'JetBrains Mono'` are CSS names that fall back to system fonts). Saira Semi Condensed is therefore the first font. [VERIFIED: grep of `src`] `next/font/google` knows the family with weights 100–900 and subsets latin/latin-ext/vietnamese [VERIFIED: `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`, Next 16.2.1]. Use in `src/app/layout.tsx`:

```tsx
import { Saira_Semi_Condensed } from 'next/font/google'
const saira = Saira_Semi_Condensed({ weight: ['600', '800'], subsets: ['latin'], display: 'swap', variable: '--font-saira' })
// <html lang="en" className={saira.variable}>
```
and change the token to `--wm-font: var(--font-saira), 'Arial Narrow', system-ui, sans-serif;` (the lint only requires the token to exist). Fonts are self-hosted woff2 under `.next/static/media`; CSS lands in the CSS chunk. The bundle gate sums **`.js` chunks only** (`check-bundle-size.ts`), so the font adds nothing to the gate. Build-time fetch from Google succeeded from this machine (HTTP 200); the Railway build precedent of a network-fetching install timing out (CLAUDE.md 2026-07-07) is the risk — contingency is `next/font/local` with the two woff2 files committed (OFL). [ASSUMED A11]
**Measure only after the font is ready.** The merge reads `getBoundingClientRect()` of the chip and the label; with `display:swap` a late font changes widths. Await `document.fonts.load('800 22px "Saira Semi Condensed"')`-equivalent (or `document.fonts.ready`) when the Read pane first renders, and skip the animation (direct cut) if it has not resolved.

**Bundle gate** (`scripts/check-bundle-size.ts`, `.bundle-baseline.json`). Gated routes: `/sops/[sopId]/page` (baseline 795) and `/page` (baseline 834). **A fresh run on the existing `.next` reads `/page` = 836 KB, Δ +2 (at the tolerance edge)** and `/sops/[sopId]/page` = 795. [VERIFIED: ran the script] Rules from CLAUDE.md that bind this phase: baselines move **down** by hand; **up requires a signed-off decision**; never re-capture to go green; the root `app/layout-*.js` chunk is charged to **both** gated routes (ancestor segment), so anything in the root layout costs twice — keep `FuseHost` to a subscribe stub and `import()` the engine.
- Savings: deleting `ShellFrame`, `PlantStage`, rooms, `WorkerShell` branches, `NowCard`, panels, `SiteSummary`, `OfficeCard` will free a meaningful part of the 47 KB root `app/page-*.js` chunk [VERIFIED: size of `.next/static/chunks/app/page-*.js` = 47 285 B]. Spend it on the list + Read + menu (static) and put these behind `next/dynamic({ssr:false})`: the **map** (iso geometry + SVG components), each **section body** (record, training, sign-offs, people, manage), the **fuse engine**, request composer / ask picker (already lazy; their forbidden markers stay).
- **Forbidden-marker list must be repaired when modules are deleted.** `/sops/[sopId]/page` marker `'No procedures for this machine yet.'` (MachineBody) and `/page` markers `'Draw machine'` (site editor — stays if `SiteWorkspace` stays), `'Nothing needs you'` / `'Nothing here can be edited or deleted'` / `'No requests waiting.'` (Office pane — stays), `'Nothing unread.'` (SiteOverview — moves with the notifications panel). The gate's **self-validation fails the build** if a marker no longer appears anywhere in the output. Re-derive each from a surviving string literal in the same plan that deletes its module; add new markers for the lazy seams you create (map: a literal only the map carries; sections: their empty states).
- Wave 0 task: run `npm run build` on the unchanged tree and record the numbers; run it again in every plan that adds a lazy consumer (CLAUDE.md 2026-10-06: the first lazy module that imports a stylesheet costs ~1.4 KB of mini-css runtime in the shared chunk — **put all new CSS in `blueprint-theme.css`/`globals.css`, never a CSS import inside a lazy module**; the existing note in `SiteOverview.tsx` says the same).

## 7. Governance surfaces → sections (Q7)

Gates do not move; this phase only re-homes mounts. `tabsForRole` is a convenience; the real gates are the server guards and RLS (`CAPABILITY-MATRIX.md` rows 38-54, 83-87).

| Today | Lands in | Role mount | Notes |
|---|---|---|---|
| Office → Inbox, Requests | **Sign-offs** (tabs Inbox · Requests) | supervisor, admin, safety_manager | `OfficePane` gets a `tabs` subset prop; supervisors keep Inbox+Requests exactly as `tabsForRole` |
| Office → Decisions | **Sign-offs** (third tab) | admin, safety_manager | `listDecisions()` guard unchanged |
| Office → People & roles, Access | **People** section (new, quiet) | admin, safety_manager | `PeopleTab`, `AdminAccessLens` unchanged; Access pin `?sop=` becomes e.g. `pin=` |
| Smoko → my record link; `/activity` page | **My record** | everyone | embed `WorkerActivityView`'s list (`useWorkerCompletions`, `CompletionHistoryCard`) in the pane; rows still link `/activity/[completionId]` |
| Smoko (admin) → `/admin/training` bridge | **Training** | admin, safety_manager (matrix: `requireAdminContext()`) | **Conflict:** CONTEXT shows Training to "supervisor and up", but the matrix row 54 gives supervisors no training screen (`/admin/training` is admin/safety-only; `listAssessmentRequests` returns `[]` for supervisors). Gates must not change. Options: mount Training for admin/safety_manager only (matches code); or add supervisor content that already exists server-side — `recordObservation` is supervisor-allowed (observations.ts:49) but the supervisor entry point was lost in Phase 59-15 (matrix row 41) and `listWorkerSopsForPicker` is RLS-thin for supervisors (CLAUDE.md 2026-07-20). **Ask Simon** [Open Q2]. Default: admin/safety_manager mount the existing page body; supervisors see no Training entry until Phase 61's observation entry point lands. |
| Workshop → New SOP, drafts, `AdminWorkshopBody` | **Manage SOPs** (admin, safety_manager) | `requireAdminContext()` | New SOP → `/admin/sops/new` (BackToSite → `/?s=manage`); drafts list = the `getAdminShell().drafts` read, extracted into its own `requireAdminContext()` action (no inbox work attached); change requests = `RequestsTab` content |
| Admin machine panel → **Edit** per SOP | Read pane, admin only, quiet "Edit" link → `focusHref(id,{mode:'edit'})` | admin, safety_manager | Otherwise the per-SOP Edit entry disappears from the product |
| "Edit site" (`?place=edit`: `DepartmentsStrip` + `SiteWorkspace`, the only UI that creates departments and links SOPs to machines) | **Manage SOPs → Site & departments** (lazy, extracted from `AdminShell.tsx:59-109` as `SiteEditSurface`) | admin, safety_manager | **Areas are departments**; if this screen is dropped, nobody can create one. `next.config.ts` redirects `/admin/departments`, `/admin/site` → the new address |
| Notification bell, `SiteOverview` (objectives, notifications, my requests, Office line) | Notifications + My requests render in **My record**; objectives stay on Read (`BrowseDocument` already shows the SOP objective) and drop from the home; bell stays beside search | everyone | Reuse `SiteOverview`'s data code by splitting it into `NotificationsPanel` and `MyRequestsPanel`; it must keep reading notifications through the browser client (no server action). **ADR-0004 tension:** an unread count on the bell is a count on the home — default keep the bell without a numeric badge? needs Simon [Open Q5] |
| Standards / AI settings | unchanged (builder Tools menu, `/admin/settings`) | — | `/admin/settings` BackToSite → `/?s=manage` |

**ADR-0004 conflict found in shipped code (stop-and-ask item).** `getOfficeInbox()` (`office.ts:39`), `getAdminShell()` (`shell.ts:49`) and `site.ts:369,483` call `reconcileMachineRequests()`, which makes the agent raise **"this machine has no SOPs yet"** requests. ADR-0004 rule 4 and CONTEXT say the app never prompts that. With Sign-offs holding "every inbox item", those requests would keep appearing in Requests. Recommend removing the raise path (keep the withdraw path; `admin-health.machinesWithoutSops` and its tests go with it) and hiding open ones; this is principle-level so the planner should put it to Simon before building. [Open Q1]

**Menu rules.** No numeric badges in the section menu (ADR-0004 rules 1-2; Manage SOPs explicitly "no count"). That also removes the home-level `getOfficeInbox` fetch for supervisors — it runs only when Sign-offs is open.

## Standard Stack

### Core
| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| next | 16.2.1 (pinned; `webpack` builds) | App Router, `next/font`, `next/dynamic` | already the stack |
| react / react-dom | 19.2.4 | UI | already |
| @tanstack/react-query | ^5.95 | list/Read/status queries (browser client) | already used by `useWorkerSops` |
| @supabase/supabase-js / @supabase/ssr | ^2.99 / ^0.6.1 | RLS reads from the browser | existing pattern (`library-sops`, notifications) |
| lucide-react | ^1.0.1 | icons | already |
| Tailwind 4 + `blueprint-theme.css` tokens | ^4 | all colours/sizes/durations | ADR-0004 rule 8 |

### Supporting
| Item | Purpose | When |
|------|---------|------|
| Web Animations API (`element.animate`) | the merge and (optionally) the map zoom | native; no library (sketch 010 uses it) |
| `next/font/google` (`Saira_Semi_Condensed`) | wordmark face | built into Next; contingency `next/font/local` |
| Playwright `phase63` project | specs + evals | new project registration required (CLAUDE.md 2026-05-25) |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled WAAPI choreography | React `ViewTransition` | experimental, cannot hold the midpoint |
| Browser-client reads for Read | server action `getReadSop` | action-queue hazard on the start path; no benefit |
| String SVG + `innerHTML` (sketch) | React-rendered SVG | React escapes SOP titles (XSS) and gives per-node a11y; innerHTML needs manual escaping |
| framer-motion / any animation lib | WAAPI | new dependency for ~40 lines; bundle-gate cost |

**Installation:** none. **Version verification:** `npm view next version` → 16.4.0 latest; the repo pins 16.2.1 and this phase does not change it.

## Package Legitimacy Audit

No external package is added by this phase (font via built-in `next/font`; animation via the platform). slopcheck not run — nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 browser URL  /?s=sops&sop=<id>&area=<id>      (legacy /?place=… , stored notification places)
      |
      v
 app/page.tsx (server) -- session, role, org name; legacy ?place= -> server redirect() to new address
      |  props: siteName, userEmail, initialS, initialSop, initialArea, initialTab
      v
 ProtectedProviders (role, React Query)
      |
      v
 HomeShell (client)  -- ONE state: {s, sop, area, tab}; select() = setState + history.replaceState
   |-- SectionMenu (desktop) / TabBar (phone, CSS-switched, no first-render branching)
   |      Wordmark ; My SOPs | My record | Training* | Sign-offs* | People* | Manage SOPs*   (* role-mounted)
   |-- MySops
   |     |-- SopList: search -> Recent -> Most used -> All SOPs (Area|Type) ; row status
   |     |      data: useWorkerSops (+ completions counts, walks) + useLibraryAreas  [browser client, RLS]
   |     |      miss -> RequestComposerTrigger(new_sop) [lazy] / Write it -> /admin/sops/new
   |     `-- ReaderPane
   |            no sop  -> SiteMap [lazy]  <- areas.ts / sop-type.ts / iso.ts (pure)
   |            sop     -> ReadView (chip, meta, standards, status, start, steps)  [browser client]
   |                         start tap -> fuse.play(rects) + router.push(/sops/<id>?go=1)   (same handler)
   `-- Section bodies [each next/dynamic]: MyRecord | Training | SignOffs(OfficePane tabs) | People(OfficePane tabs) | Manage(+SiteEditSurface)

 root layout:  <FuseHost/>  (survives navigation)  -- veil + wordmark clone, WAAPI stages 1-4,
                    waits for [data-wm-target] -> stage 5 rise -> removes itself
      |
      v   router.push
 /sops/[sopId] (server page; loading.tsx) -> FocusWalker -> FocusFrame -> FocusTopBar(<Wordmark data-wm-target/>)
      |   ?go=1 -> mount effect w.start() (server action startWalk, session-scoped) -> phase 'walk'
      `-- Stop/Back -> router.push(backHref(from))  -> /?s=sops&sop=<id>   (Read reopens)
```

### Recommended Project Structure
```
src/
├── app/layout.tsx                      # + Saira font var, <FuseHost/>
├── app/page.tsx                        # parse s/sop/area/tab/pin; legacy ?place= -> redirect
├── components/home/                    # NEW (replaces components/shell/*)
│   ├── HomeShell.tsx  SectionMenu.tsx  TabBar.tsx
│   ├── SopList.tsx  SopRow.tsx  ReadView.tsx
│   ├── sections/ (MyRecord, SignOffs, People, Training, Manage — each lazy)
│   └── map/ (SiteMap.tsx lazy, AreaPlate.tsx, ObjectGlyph.tsx, MapKey.tsx)
├── components/brand/Wordmark.tsx  FuseHost.tsx  fuse-engine.ts (lazy)
├── hooks/useLibraryAreas.ts  useRecentSops.ts  (+ extend useWorkerSops)
└── lib/
    ├── library/areas.ts  sop-type.ts  object-kind.ts   # pure, unit-tested
    ├── library/iso.ts  iso-layout.ts                   # pure geometry + auto layout
    └── shell/home-state.ts                              # s/sop/area parse+format+legacy map (whitelists)
```

### Pattern 1: one whitelisted address module
`src/lib/shell/home-state.ts` (plain module, no directive) replaces `place.ts`: `parseHome(search)`, `formatHome(state)`, `legacyToHome(placeToken, tab)`. Every token is whitelisted (sections enum, UUID-tested `sop`, `area` = UUID | `site-wide`); the raw token is never carried into the result (same discipline as `parsePlace`, T-57-01). Old `?place=` mapping: `office`→`s=signoffs` (`tab` inbox/requests/decisions) or `s=people` (`tab` people/access, `sop`→`pin`); `smoko`→`s=record`; `workshop`→`s=manage`; `noticeboard`→`s=sops`; machine UUID→`/`; `dept:<uuid>`→`area=<uuid>`; `edit`→`s=manage&view=site`. **Keep the legacy parser alive**: `notifications.place` rows already in the database hold `/?place=office` etc. (`places.ts` `SAFE` regexp accepts `[\w=&%.:-]*`, so new addresses pass it too). The focus `from` token becomes `sops:<uuid>` / section names through the same whitelist so `backHref(from)` returns to `/?s=sops&sop=<id>` (ADR-0004 rule 6: Back returns to where you were). `placeForPath()` updated (`/activity`→`s=record`, `/admin/training`→`s=training`, `/admin/sops/new*`, `/admin/settings`→`s=manage`).

### Pattern 2: area/type/kind as one classifier
```ts
// src/lib/library/areas.ts  (plain module) -- [ASSUMED A1]
export const SITE_WIDE = 'site-wide'
export function areaOf(sopId: string, d: {
  machinesBySop: ReadonlyMap<string, string[]>          // sop -> machine ids, sort/name ordered
  machineDept: ReadonlyMap<string, string | null>
  deptsBySop: ReadonlyMap<string, string[]>              // name ordered, non-archived only
  activeDepts: ReadonlySet<string>
}): string {
  for (const m of d.machinesBySop.get(sopId) ?? []) {
    const dept = d.machineDept.get(m)
    if (dept && d.activeDepts.has(dept)) return dept
  }
  return d.deptsBySop.get(sopId)?.[0] ?? SITE_WIDE
}
```
List, map, Read and key all import this; a second copy is a future disagreement (CLAUDE.md 2026-09-27).

### Pattern 3: the map as pure geometry + React SVG
Port `P()`, `box()`, `cyl()`, `entity()` from the sketch into `iso.ts` returning descriptors (`{k:'poly'|'ellipse'|'line', pts, role}`) where `role` is a token name (`'floor'`, `'edge'`, `'steel-top'`, `'area-top'`, …); the component maps roles to `style={{ fill: 'color-mix(in srgb, var(--area-3) 14%, var(--paper-1))' }}`. Reasons: (a) `tests/lint/design-tokens.spec.ts` bans bare 6-digit hex in component code (the sketch is full of them) — either use tokens/`color-mix` (preferred, no guard edit) or add a narrow allowlist entry; (b) React escapes SOP titles; (c) `<title>`/`aria-label` per node.
Auto layout (`iso-layout.ts`): per area, footprint from its SOP count `n`: `cols = ceil(sqrt(n·aspect))`, cell ≈ 2.8×2.4 units, margin 0.8 (the sketch's `slots()` formula); then shelf-pack areas by descending footprint into rows whose target width ≈ `sqrt(Σ area · 1.5)`; ground = bounding box + 1 unit; `viewFor(null|areaId)` as the sketch. Draw order by `(x+y)` for areas and objects (painter's algorithm). Handles 1 area (centred) to 12; 1–15 objects per area (4×4 cells max).

### Anti-Patterns to Avoid
- **`router.push`/`router.replace` from a mount effect** for any home state (legacy redirects belong in `page.tsx`/proxy).
- **A server action on the Read/start path** (selection, "opened" tracking, or start-from-home).
- **Branching first render on `window`/`matchMedia`/`localStorage`**: the section menu vs tab bar and the map's name signs vs numbered markers switch with Tailwind `lg:` classes (the existing D-21 idiom); `useViewport` returns `'mobile'` first and flashes.
- **String-built SVG with `dangerouslySetInnerHTML`** from SOP titles.
- **Deriving "area" in more than one place**, or reading `site_layouts` to decide whether the map exists.
- **A CSS import inside any lazy module** (shared-chunk mini-css cost).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Step order, current step, hazards-first | a new ordering for the Read outline | `walkOrder`, `currentIndex` (`src/lib/sop/focus.ts`) | Read and the walk must agree on "step N" |
| Kind chips / standards | new chips | `KindChip`, `StandardLabels` | one visual vocabulary |
| Sign-offs / People / decisions UI | rewrite | `OfficePane` + its tabs (add a `tabs` prop) | gates and receipts already tested |
| Notifications / my requests | rewrite | split `SiteOverview` | browser-client reads, ledger receipts exist |
| Request raise ("Ask for one") | custom form | `RequestComposerTrigger` kinds `['new_sop']` (+ prefill `note`) | server action, schema and ledger exist |
| Lineage root / latest version | custom | `latestPublished`, `lineageRoot` | flat lineage rules (Phase 58) |
| Camera maths for the admin editor | — | leave `lib/site/scene.ts` | the home map does not use a camera; its zoom is a viewBox tween |
| Reduced-motion / first-of-day | scattered checks | one `motionMode()` helper in the fuse module | sketch 009 `motionMode()` is the reference |
| Fonts | `<link>` to Google | `next/font` | self-hosting, preload, fallback metrics |

**Key insight:** this phase is mostly re-composition. The only genuinely new code is the pure library classifier, the isometric engine, the wordmark/fuse module and the shell frame; everything role-gated already exists behind unchanged guards.

## Runtime State Inventory

(Rename/retire phase: rooms and the word "walk".)

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | `notifications.place` holds fixed templates such as `/?place=office` (written by `notificationPlace()`); `decisions`/`sop_walks`/completion summaries contain "walk" wording (e.g. ledger summary "Sent a walk for sign-off", `completions.ts:485`); `site_layouts.preset` stays | **Code edit** (new notifications write the new address) **plus keep the legacy `?place=` parser** so stored rows still resolve. No data migration; history keeps its old words. `site_layouts.preset` untouched (still stamped by `applySitePreset`) |
| Live service config | None found — no external service keys on room names (verified by grep of `src`; Supabase RLS policies reference no room concept) | none |
| OS-registered state | None — no scheduled tasks (ADR-0002; `tests/lint/no-scheduled-jobs.spec.ts` guards) | none |
| Secrets / env vars | None reference rooms or walk | none |
| Build artifacts | `.next/` (stale from Oct 6), `.bundle-baseline.json` (edit by hand only, down only), `public/sw.js` kill-switch (unrelated); `tests/evals/.../site-scene.png` fixture stays | rebuild; baselines per §6 |
| Stored client state | Per-device `localStorage` is new (`sopstart-recent:<uid>`, `sopstart-fuse-day`); no old key to migrate | none |

## Common Pitfalls

### Pitfall 1: `loading.tsx` commits the focus route instantly
**What goes wrong:** a home-resident animation is unmounted by the skeleton commit ~50 ms after `router.push`.
**Avoid:** host in the root layout; push at t=0; the host owns the veil until the target exists.
**Warning signs:** the animation stops at stage 1 or the home flashes back.

### Pitfall 2: server action on the start path (Next 16.2.1 queue orphan)
**What goes wrong:** a server action in flight when navigation starts, then another action → the next one never runs and the router waits forever (CLAUDE.md 2026-09-29).
**Avoid:** browser-client reads on the home; autostart `startWalk` runs on the *new* page after the nav committed; legacy redirects server-side. Eval: start a SOP twice in a row and a second SOP from Back.

### Pitfall 3: autostart double-fires or flashes browse
**What goes wrong:** StrictMode double effect starts twice; browse document flashes under the rising logo.
**Avoid:** ref guard, strip the flag, render a paper column while pending, carry `go` through the version redirect (`page.tsx:107`).

### Pitfall 4: STALE_WALK keys vs server strings
Rename in lockstep (§5), or stale-walk recovery silently degrades.

### Pitfall 5: ownerless area / empty-area noise
The eval-site org has 20 leftover "EVAL Zone" departments; the real org's General is a visibility tag on every SOP. Machine-first precedence and "only areas that hold a published SOP" prevent both.

### Pitfall 6: deleting a view orphans a feature for another role (CLAUDE.md 2026-10-06)
Before deleting `AdminMachinePanel`, `AdminWorkshopBody`, `OfficeWorkerBody`, `SmokoBody`: per role, name the remaining entry point. Found: per-SOP **Edit** (→ Read pane), **Site & departments** editor and SOP↔machine links (→ Manage SOPs), drafts list (→ Manage), **Record observation** supervisor entry (already lost; stays a Phase 61 gap), training bridge link (→ Training section).

### Pitfall 7: guards that go stale on deletion
Bundle-gate markers (§6); `tests/phase57/rooms.spec.ts` is ADR-0003's named guard; `docs/adr/README.md` index row 0003 must be set to "Superseded by ADR-0005" (rule 3 — status only, never edit the decision); `CLAUDE.md` ADR line and the `sketch-findings` skill reference (`one-screen-site.md`) get a superseded banner; a comment that quotes a forbidden literal trips grep guards (CLAUDE.md 2026-09-28) — describe the removed thing in words.

### Pitfall 8: hydration
Never read `localStorage`/`matchMedia`/`Date` in render. Recent list via `useSyncExternalStore` with `[]` server snapshot; first-of-day and reduced-motion read only in the click handler; the phone/desktop switch is CSS-only (hidden duplicates are cheap).

### Pitfall 9: map performance and re-render storms
~100 objects × ~10 nodes ≈ 1 000 SVG nodes. Memoise each object's geometry; drive hover with CSS transform/`:hover` (no React state); tween the `viewBox` attribute on a ref in rAF (never React state); `React.memo` the plates; collapse to `<title>` instead of per-node tooltips.

### Pitfall 10: geometry judged by assertions (CLAUDE.md 2026-10-05, 2026-07-14)
Layout bugs (overlap, clipped signs, unreadable at 390 px) are invisible to specs. The eval must screenshot the **real org** (3 areas, 4 objects — sparse by design), a synthetic many-area fixture, and 390 px, and Claude must read them.

### Pitfall 11: shared eval-site fixture
Adding departments/SOP links to the eval-site org changes sibling evals that assert counts (CLAUDE.md 2026-09-29). Grep consumers first; assert by name.

### Pitfall 12: OTP budget
Eval re-runs burn the shared magic-link budget (CLAUDE.md 2026-09-28, 2026-10-05). Author one case at a time against a deploy; run the full suite once.

## Code Examples

### Legacy address → new address (server, `page.tsx`)
```ts
// Source: pattern of officeRedirectFor (src/lib/shell/place.ts:87) -- fixed templates only
const { place, tab, sop } = await searchParams
if (typeof place === 'string') redirect(legacyToHome(place, typeof tab === 'string' ? tab : null, typeof sop === 'string' ? sop : null))
```

### Autostart on the focus page
```tsx
// FocusWalker.tsx -- [ASSUMED A7]
const started = useRef(false)
useEffect(() => {
  if (!autostart || started.current || !canWalk || order.length === 0) return
  started.current = true
  window.history.replaceState(window.history.state, '', window.location.pathname) // strip ?go
  void w.start()
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

### Click handler order (start)
```ts
// ReadView: one handler, no await before push
function onStart() {
  const mode = fuse.mode()                // 'off' (reduced) | 'short' | 'full' -- reads storage here, not in render
  if (mode !== 'off') fuse.play({ rects: fuse.measure(chipEl, labelEl, buttonEl), mode })
  router.push(focusHref(sop.id, { from: `sops:${sop.id}`, go: true }))
}
```

## State of the Art

| Old | Current | When | Impact |
|-----|---------|------|--------|
| Rooms on a generated picture (Phase 57, ADR-0003) | generated code-drawn library map (ADR-0004/0005) | 2026-10-07 | rooms, `PlantStage`, template room tables go |
| Machine-led pins and a Now card | status as information on rows | ADR-0004 | `derivePlantPins`, `pickNowQueue`, `roomPins` retire |
| `Walk it` / `Show me` | `start` / Read | 2026-10-07 | §5 sweep |
| View Transitions for route animations | still experimental in Next 16.2.1 | — | use WAAPI overlay |

**Deprecated/outdated:** `components/shell/*` room modules, `lib/site/rooms.ts`, `PRESET_ROOMS`/`roomsFor`, `getAdminShell`, `place.ts` as the address module (kept only as the legacy parser).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Area = machine's department → first `sop_departments` → Site-wide; only areas holding a published SOP draw | §2 | wrong grouping for multi-department SOPs; map and list disagree with how the org thinks of "areas" |
| A2 | Type derived from `category_slug` + placement; "Order of operations" omitted | §2 | Simon expects five types; list grouping looks thin |
| A3 | Object glyph chosen by machine-name keywords; non-machine = noticeboard | §2 | cosmetic mismatch (a "tank" drawn as a box) |
| A4 | Recent = per-device localStorage + server walk/completion recency; Most used = own completion count per lineage | §3 | Recent differs across devices; "opened but never started" not shared across devices |
| A5 | Notifications + My requests render under My record; bell kept | §7 | features unreachable or home gets a count ADR-0004 dislikes |
| A6 | A root-layout `FuseHost` persisting across the navigation, engine lazily imported | §4 | extra root-chunk bytes charged to both gated routes; animation timing under slow networks |
| A7 | Autostart via a URL flag consumed by a mount effect on the focus page | §4 | double start, or a flash of browse; alternative is a start-on-home server action (rejected) |
| A8 | Owner is not shown to workers on Read (T-59-30) | §4 | CONTEXT's Read meta line lists owner; Simon may want it for supervisors |
| A9 | Training section mounted for admin/safety_manager only; supervisors none | §7 | CONTEXT says "supervisor and up" |
| A10 | Next stays 16.2.1; the action-queue hazard is mitigated by design, not upgrade | §4 | latent hang if a server action fires near a navigation |
| A11 | `next/font/google` works in the Railway build | §6 | failed deploy; switch to `next/font/local` |
| A12 | `reconcileMachineRequests` raise path is removed | §7 | machine-without-SOP prompts keep appearing in Requests |
| A13 | WAAPI `animate(..., {pseudoElement:'::after'})` for the tape (sketch fallback: tape simply present) | §4 | old browsers show the tape without the slide |

## Open Questions

1. **Machine-without-SOP agent requests vs ADR-0004 rule 4.** What we know: `getOfficeInbox`/`getAdminShell`/`site.ts` raise them. Unclear: whether Simon wants them gone entirely. Recommendation: remove the raise path in this phase (stop-and-ask per ADR rules).
2. **Training for supervisors.** CONTEXT says supervisor and up; the matrix gives supervisors no training screen. Recommendation: admin/safety_manager mount only; supervisor observation entry stays a Phase 61 item.
3. **"Order of operations" type.** Not derivable. Ship four types now, or add `sops.sop_type` (migration + editor field)?
4. **Owner on Read.** Show for admin/safety only (T-59-30) or also supervisors?
5. **Bell unread count.** Keep a numeric badge on the home? ADR-0004 says no counts; notifications are information, not a to-do queue.
6. **"or begin from step 1".** Confirm-before-discard (reuse the Start-over dialog) or a plain link?
7. **AiCheckBanner "Show me".** Leave (admin editor control) — default.
8. **Area colours past eight.** Cycle `--area-1..8` (default) or add `--area-9..12` tokens.
9. **Next upgrade (16.2.1 → 16.4.0).** Out of scope; worth a follow-up because it removes the action-queue hazard.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tsx scripts | ✓ | v22.16.0 (engines ≥20) | — |
| `npm run build` + `check-bundle-size` | GATE-01 | ✓ (ran the script on the Oct 6 `.next`) | — | — |
| Google Fonts reachability (build) | `next/font/google` | ✓ (HTTP 200 from this machine) | — | `next/font/local` |
| Supabase Management API (read-only census, RLS probes) | data checks | ✓ (used) | — | — |
| Playwright + deployed evals (`npm run eval -- --phase 63`) | EVAL-01 | ✓ (existing project `evals`) | — | — |
| Eval accounts (`eval-admin`, `eval-worker`, `eval-site-worker`, `eval-site-supervisor`, `eval-site-admin`, `eval-site-safety`) | evals | ✓ (auth users exist) | — | `node scripts/eval-fixtures.mjs` |
| Railway deploy | evals run against sopstart.com | ✓ — healthcheck path must stay `/api/version` | — | — |

**Missing with no fallback:** none. **Eval fixture gap:** the eval-site org has one department with a SOP (Forming) and 20 empty "EVAL Zone" departments; a multi-area fixture (≥3 departments each with a published SOP, one machine-linked, plus site-wide) must be added, idempotent and org-guarded like `ensurePlantFixture` (never the real org id `bd2c2b88…`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` ^1.58 (unit/source-contract specs via per-phase projects; deployed evals via project `evals`) |
| Config file | `playwright.config.ts` (new `phase63` project required) |
| Quick run command | `npx playwright test --project=phase63` |
| Full suite command | `npm run test` (once per gate; OTP budget) |
| Deployed eval | `npm run eval -- --phase 63` (waits for Railway HEAD; writes `63-EVAL.md`) |
| Build gate | `npm run build` (postbuild runs `check-bundle-size`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | `areaOf` precedence, empty areas drop, real-org table → 3 areas; `sopType`; `objectKind` | unit | `npx playwright test --project=phase63 -g "library classifier"` | ❌ Wave 0 `tests/phase63/library.spec.ts` |
| MAP-02 | layout for 1, 3, 8, 12 areas × 1/6/15 objects: no overlap, inside ground, deterministic; geometry uses only token roles | unit | `-g "iso layout"` | ❌ `tests/phase63/iso-layout.spec.ts` |
| HOME-05 | `legacyToHome`/`parseHome` whitelist, no raw token carried, every `notifications.place` template still resolves, `backHref` | unit | `-g "home state"` | ❌ `tests/phase63/home-state.spec.ts` |
| HOME-02 | Recent merge/sort/cap, UUID validation of stored ids, Most-used counts by lineage | unit | `-g "recent"` | ❌ `tests/phase63/recent.spec.ts` |
| WORD-01 | no `walk`/`Show me` user strings (allowlist), server strings and `STALE_WALK` keys equal | source-contract | `npx playwright test --project=phase63 tests/lint/no-walk-words.spec.ts` | ❌ register the lint spec in a project |
| RET-01 | `rooms.ts`, `ROOM_IDS`, `PRESET_ROOMS`, `roomsFor`, `components/shell/ShellFrame` absent; ADR-0005 exists, ADR-0003 marked superseded, README index updated | source-contract | `-g "rooms retired"` | ❌ `tests/lint/no-rooms.spec.ts` (ADR-0005's `Enforced by`) |
| BRAND-01 | `--wm-*` tokens used by `Wordmark`; no raw hex/px in new components (existing lints); font var wired | lint | `npx playwright test tests/lint/design-tokens.spec.ts tests/lint/design-principles.spec.ts` | ✅ exist |
| FUSE-01 | durations read from tokens (no literals); reduced-motion path skips the host; handler calls `router.push` with no preceding `await`; host mounted in root layout | source-contract | `-g "fuse wiring"` | ❌ `tests/phase63/fuse-wiring.spec.ts` |
| FUSE-01/02 | merge plays full then short; lands in the running SOP; Back returns to Read; second start works | **deployed eval** | `npm run eval -- --phase 63` | ❌ `tests/evals/home.eval.ts` |
| MAP-03/04 | zoom, filter, Esc, dim/switch, keyboard, 390 px markers+key, real-org screenshot | **deployed eval + screenshots read by Claude** | same | ❌ |
| HOME-01/04 | section visibility per role (worker/supervisor/admin/safety), gates unchanged, Sign-offs/People tabs | eval + existing capability spec | `npx playwright test tests/phase59/capability-matrix.spec.ts` | ✅ (repoint) |
| GATE-01 | `/page` and `/sops/[sopId]/page` ≤ baseline+2, markers present | build | `npm run build` | ✅ (update markers) |
| DOC-01 | every new route/state in `journeys.ts`; `/pathways` 0 unmapped | eval case (existing) | eval | ✅ pattern in one-screen eval |

Manual-only: none required; the merge is judged from eval screenshots at the slow-mo flag (`?fuse=slow`) plus frame-by-frame reads, per Simon's "evals, not click-paths".

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase63` (pure modules, < 30 s) + `npx tsc --noEmit` for any `src/actions` edit.
- **Per wave merge:** `npm run build` (gate + `tsc`), the phase 52/57/58/59/60 projects once to compare against the Wave 0 inventory.
- **Phase gate:** full suite once, `npm run eval -- --phase 63`, screenshots read, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Register `phase63` in `playwright.config.ts` (broad `tests/phase63/**` regex, like 57-60) and register every new `tests/lint/*.spec.ts` (verify with `--list`).
- [ ] `tests/phase63/repoint-inventory.spec.ts` — classify the 53 referencing specs (retire / repoint) before code moves.
- [ ] Baseline: `npm run build` numbers and `npx playwright test --project=phase57 --project=phase58 --project=phase59 --project=phase60 --project=phase52` failure list on the untouched tree.
- [ ] Eval fixture for ≥3 areas in the eval-site org (+ cleanup rules); `tests/evals/lib/` helper.
- [ ] ADR-0005 draft (supersedes 0003) and `tests/lint/no-rooms.spec.ts`.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | existing `getSessionContext()` / proxy |
| V3 Session Management | no change | existing cookies; no new session state |
| V4 Access Control | **yes** | section mounts are convenience; every body keeps its server guard + RLS (`requireAdminContext`, `getOfficeInbox`, `listDecisions`, `startWalk`). No new action, no new table. Update `CAPABILITY-MATRIX.md` only if a gate moves (none planned) |
| V5 Input Validation | **yes** | URL params (`s`, `sop`, `area`, `tab`, `pin`, `from`, `go`, legacy `place`) whitelisted/UUID-tested, raw value never reflected; `localStorage` ids UUID-validated and length-capped |
| V6 Cryptography | no | none |
| V8 Data Protection | **yes** | owner name not resolved for workers (T-59-30); no approver names on rows; `sop_departments` read always filtered to visible SOP ids |
| V12/V14 Output & config | **yes** | SOP titles rendered by React only (no `innerHTML` in the SVG); no new env var |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via SOP title in SVG `<title>`/`<text>` | Tampering | React-rendered nodes, never string SVG |
| Open redirect via legacy `?place=` / stored `notifications.place` | Spoofing | fixed-template mapping; `isSafePlace` regexp stays; unknown → `/` |
| IDOR via `?sop=<uuid>` | Information disclosure | Read uses RLS reads; unknown/foreign id = "not found" state, no data |
| Role mount bypass (forged `?s=people`) | Elevation | `resolve` at render: a section the role may not open renders My SOPs; the data is gated server-side regardless |
| Poisoned `localStorage` Recent list | Tampering | validate to UUID + cap; ignore unknown ids |
| `?go=1` autostart abuse | Tampering | `startWalk` is session-scoped and checks published status server-side; flag only causes a normal start |
| Cross-tenant read through `sop_departments` (`using(true)`) | Information disclosure | always `.in('sop_id', visibleIds)`; do not render department names for ids outside the org's `departments` read |

## Sources

### Primary (HIGH confidence)
- Repo code read in full or in the cited ranges: `src/app/page.tsx`, `src/components/shell/*`, `src/components/focus/*`, `src/hooks/{useWorkerSops,useWalk,useFocusBack,useFocusSop}.ts`, `src/lib/{site/rooms,site/presets,shell/place,shell/office-tabs,sop/focus-path,sop/focus-read,sop/worker-signal,notifications/places,supabase/middleware}.ts`, `src/app/(protected)/sops/[sopId]/page.tsx`, `src/actions/{site-worker,shell,observations,walk}.ts`, `scripts/check-bundle-size.ts`, `.bundle-baseline.json`, `next.config.ts`, `playwright.config.ts`, `railway.json`.
- ADRs 0002/0003/0004 and `docs/adr/README.md`; `.planning/codebase/CAPABILITY-MATRIX.md`; CLAUDE.md Learnings.
- Sketches 009 and 010 (`index.html`, `logo.html`, READMEs) — reference JS.
- Live read-only queries via the Supabase Management API on 2026-10-08: org data shape, policies (`pg_policies`), eval-site contents.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/viewTransition.md`; `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`.
- `npm view next` (16.4.0 latest); ran `npx tsx scripts/check-bundle-size.ts` (836/834, 795/795).

### Secondary (MEDIUM confidence)
- Reasoning about router/`loading.tsx` commit timing and root-layout persistence (standard App Router semantics, not prototyped here).

### Tertiary (LOW confidence)
- WAAPI `pseudoElement` browser coverage (sketch ships a try/catch fallback).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; everything already in repo.
- Architecture: MEDIUM — the persistent-host merge is sound on paper and matches the sketch's WAAPI approach, but is the one piece that needs an early prototype (Wave 1 spike with `?fuse=slow` on a deploy).
- Data derivation: HIGH for what exists (verified live); the area/type rules are decisions awaiting Simon.
- Pitfalls: HIGH — each is grounded in a file/line or a CLAUDE.md learning.

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (stable stack; re-check if Next is upgraded or the real org's departments change shape)

## Project Constraints (from CLAUDE.md)

- Follow ADR-0002/0003/0004; accepted ADRs are binding; a contradiction stops and asks Simon. New structural choice = new ADR in the same commit with an `Enforced by` guard under `tests/lint/`.
- Design tokens only: no raw palette classes, bare hex, `[Npx]` sizes in components (`tests/lint/design-tokens.spec.ts`); new colour/size/duration = token in `blueprint-theme.css` plus its `--color-*`/`@theme` line; `no-undefined-css-tokens` fails on undeclared `var(--x)`.
- Online-only app; do not reintroduce Serwist/Dexie/idb-keyval.
- Never navigate from a mount effect; legacy redirects are server-side; avoid server actions near navigation (Next 16.2.1 queue orphan).
- No `window`/`navigator`/`Date` in first render; no Date/class instances across server/client boundaries.
- `'use server'` files export only async functions; run a real `npm run build` as the final gate for any phase touching `src/actions/*`.
- Session-client writes end with `.select('id')` and treat empty as failure; new tables need org-scoped RLS (none planned).
- `journeys.ts` (`/pathways`) and `uat/tests.ts` updated in the same change as any route/flow change; `/pathways` must show 0 unmapped; CAPABILITY-MATRIX only if a gate moves.
- Deployed evals replace human checkpoints: extend `tests/evals/*.eval.ts`, run `npm run eval -- --phase 63`, **read the screenshots**; evals self-skip without `EVAL_BASE_URL`; mind the shared OTP budget; `/api/version` is the Railway healthcheck and must remain 2xx.
- Bundle gate: baselines are decision artefacts, move down only, never re-captured by an executor; new CSS lives in the global stylesheets, not in lazy modules.
- Comments must not quote a forbidden literal (grep guards scan comments).
- Spec files and lint guards must be registered in a Playwright project regex or they never run; verify with `--list`.
- Shell commands handed to Simon: PowerShell one-liners, exact working directory; `git push origin master` after commits.
- Plain words on screen: "section", never "block"; NZ metric only for generated worker-facing text; no Cmd+K; no manual UAT checklists.
