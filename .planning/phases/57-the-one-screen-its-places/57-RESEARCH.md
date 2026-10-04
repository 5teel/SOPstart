# Phase 57: The One Screen & Its Places - Research

**Researched:** 2026-10-04
**Domain:** Next.js 16.2.1 App Router shell composition (client three-pane screen over existing Supabase server actions), isometric scene renderer extension, route retirement, bundle/eval/guard maintenance. No new packages, no migrations.
**Confidence:** HIGH on codebase facts (all read from source this session, line refs given); MEDIUM on the two product gaps flagged under Open Questions (they need a one-line owner call or a safe default).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** No room design or room configuration. Existing scene used as-is; four rooms are fixed hit-areas + signpost at coordinates Claude chooses. No admin UI to position/resize/restyle a room, no room table/column, no artwork. PLC-01's "admin can position each room's shape" clause is deliberately descoped by the owner (verifier must not treat it as a gap).
- **D-02** Rooms always signposted (counter-scale `--inv` pattern); machines label on hover. Room hit-area has a faint dashed outline at rest (`.hs.room`).
- **D-03** Workers see all four rooms with the contract's reduced view (Office: my requests / my sign-offs; Smoko: my record; Workshop: "Ask for a change"; Noticeboard: site SOPs). Where the data type does not exist yet (requests, Phase 60) the panel says so in one plain line; rooms never disappear for any role.
- **D-04** Empty detail pane = site summary (site name; counts of machines, published + draft SOPs; role-aware count; one hint line). One small component so Phase 60 swaps one file.
- **D-05** Admin "waiting in the Office" count = today's governance inbox rows exactly as the existing inbox counts them. Office pin shows the SAME number; one query feeds both.
- **D-06** Supervisors get the admin-style Office card (count = completions awaiting their sign-off). Workers keep the `NowCard`.
- **D-07** Department = name + colour; zone = hull of its machines (`site_machines.department_id`). No department polygon/table. Clicking a department in the list tints + frames its machines.
- **D-08** Department CRUD inline in the site editor's edit mode (strip: add / rename / recolour / delete, delete refused while any machine or SOP visibility rule references it, count shown). Machine form picks from the list and can create one in place. `/admin/departments` deleted + redirected.
- **D-09** `member_departments` editing moves to `/admin/team` unchanged (same picker, same server action). Access wiring (`access_grants`, department visibility RLS) untouched.
- **D-10** `/` is the one screen when signed in. Signed-out `/` keeps today's landing. Sign-in lands on `/`. Retired entry points 307-redirect in the proxy (`src/lib/supabase/middleware.ts`) or a server component, NEVER a client `useEffect` + `router.replace`: `/sops` (list), `/dashboard`, `/governance` (admin home + `?view=attention|library`), `/admin/departments`, `/admin/site` -> `/?place=edit`. `roleHome()` returns `/` for every role.
- **D-11** Every place has an address `/?place=<token>`: machine id, `office`, `smoko`, `workshop`, `noticeboard`, `dept:<id>`, `edit`. Selecting updates the URL with `history.replaceState` (no router push); loading a `?place=` URL selects it on mount. Phase 58's Back returns to `/?place=...`.
- **D-12** Bridges: Office panel summarises inbox counts and opens `/governance`; Smoko panel summarises my completions and opens `/activity`; Workshop panel lists the org's draft SOPs (title / state / open in builder) + "Write a new SOP" -> `/admin/sops/new`. Each bridged page loses the header and gains one plain "Back to the site" link (to `/?place=<room>`). A bridge is summary + one link, never a second navigation.
- **D-13** Admin library table retired without a replacement list: site SOPs on the Noticeboard, machine SOPs on machines, drafts in the Workshop bridge, search covers machine names + titles of placed SOPs. Workshop list = ALL drafts in the org.

### Claude's Discretion
- Exact room hit-area coordinates/sizes (constants or a JSON in `src/lib/site/`, no DB).
- Badge vocabulary on SOP rows (reuse `RelBadge` for workers; admin rows add draft / published / no owner / review overdue; minimal set, no new status model).
- How the three panes are composed from `PlantHome` / `PlantStage` / `MachinePanel` / `AdminMachinePanel` / `NowCard` / `SiteEditor`; how edit mode is entered from the map (a stage button is the obvious choice).
- Pane-resize behaviour (`ResizeObserver` -> refit on the selected place; guard 0x0).
- Keyboard: Esc clears selection and refits; nothing else required.
- Dropped-list entry shape for this phase's deletions.

### Deferred Ideas (OUT OF SCOPE)
- Admin positioning of room shapes (PLC-01 clause).
- Site overview content in the empty detail pane (SHL-03) -> Phase 60.
- Wide detail pane (SHL-06) -> Phase 59.
- Office tabs / inbox-as-panel / decision ledger view -> Phase 59.
- Workshop four on-ramps / Drafts tab proper / Standards manager / AI settings -> Phase 61.
- Smoko room (matrix, observations, my record) -> Phase 61.
- Focus rule / Back from an open SOP -> Phase 58 (only provide the `?place=` address here).
- "... logged in the decision ledger" copy -> 59/60/61.
- Department as a drawn polygon -> declined.
- Certifying every old address + the dropped-feature build guard -> Phase 62.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHL-01 | Land on one three-pane screen; no header nav anywhere | `src/app/page.tsx` session branch + extracted providers; delete `TopHeader` from `(protected)/layout.tsx`; `roleHome` -> `/`; account affordance + back-link gap (Open Q1, Pitfalls 1/2) |
| SHL-02 | Map click and list click identical (highlight -> camera -> detail) | One `selection` state (token) driving stage `selected`, `flyTo`, detail pane; stage gets a room layer + `flyInset` prop (Architecture, Stage changes) |
| SHL-04 | Search filters list + lights shapes; matches machine names + titles of SOPs on them | Reuse `askMatches` / `narrowForAsk` (`worker-signal.ts`); extend to rooms; admin rows need the same match over governance rows |
| SHL-05 | One "next for you" card leads the list | Worker: `pickNowQueue` + `NowCard` re-homed (drop `absolute` overlay classes); admin/supervisor Office card from the one inbox query |
| PLC-01 | Four fixed rooms signposted at every zoom | Fractional room polygons (scene size varies: real org 2752x1536, eval org 1600x900), room layer in `PlantStage`, counter-scale signposts |
| PLC-02 | Machine lists its SOPs with badge; worker Walk; admin Walk/Edit/new SOP | `MachinePanel`/`AdminMachinePanel` bodies re-homed; `?machine=` not supported by wizard today (Open Q4) |
| PLC-03 | Noticeboard lists `placement='site'` SOPs with same badges/actions | `sops.placement` (migration 00069) must be added to the worker library select; admin needs it from a new read |
| PLC-04 | Pins: worker due counts; admin no-owner/overdue; Office + Workshop counts | `derivePlantPins` + `machineHealth` exist; Office/Workshop/Noticeboard pins are NEW stage props; Office count = `deriveInbox(...).length` |
| PLC-05 | Edit mode from the map; add/rename/reshape/remove machines + departments; no departments screen | `SiteWorkspace` re-homed behind `SiteEditorLoader`; department actions exist but delete-refusal does not (Don't Hand-Roll, Pitfall 6) |
</phase_requirements>

## Summary

The phase is composition, not invention: nearly every piece exists. `PlantStage` (a raw `<img>` + SVG polygon renderer, 371 lines) already does fit / zoom-to-cursor / fly-to / box-fit; `MachinePanel` / `AdminMachinePanel` / `NowCard` / `RelBadge` already render the contents the detail and list panes need; `deriveInbox` + `machineHealth` + `machinePanelSops` already classify admin health; `SiteWorkspace` + `SiteEditorLoader` already give edit mode. The work is (a) a new `OneScreen` client composition with ONE selection state keyed by the D-11 token, (b) a room layer added to `PlantStage`, (c) a `getSessionContext`-branching `src/app/page.tsx`, (d) removing the header and retiring five routes, and (e) the unglamorous maintenance cost: ~25 existing spec files, 7 evals, the bundle gate script + baseline, `journeys.ts`, the capability matrix and the dropped list all point at things this phase deletes.

Three findings change the plan and are NOT in CONTEXT.md. (1) **The Access wiring screen (`AdminAccessLens`, `?view=access`) is mounted only inside `AdminLibraryTable`**, which D-13 retires; the builder's "Choose who sees it" links `/sops?view=access&sop=...`. Deleting the table without a bridge removes the only way to edit who sees a SOP until Phase 59. (2) **The header currently holds Sign out, Profile, Settings, Team, Pathways, Feedback and the notification badge**; "no header navigation anywhere" leaves sign-out and `/admin/team` (D-09) homeless. (3) **D-05 lists "completions awaiting sign-off" as an inbox row; `deriveInbox` has no such row** (rows are: owner, overdue, approve, stuck, machines). Sign-off lives on `/activity`. Parity ("pin == card == what `/governance` shows as N open") is only achievable if the count is `deriveInbox(...).length`; sign-offs must be a separate line.

Second-order facts the planner needs: the real org's scene is **2752x1536** and already has a machine named "Office terminal" drawn exactly where the sketch placed the Office room; the eval org's scene is 1600x900 - so room coordinates must be **fractions of scene size**, not pixels. The bundle gate hard-codes `(protected)/sops/page` paths and will fail the build the moment `sops/page.tsx` is deleted. `PLANT_PANEL_WIDTH` (380) offsets every `flyTo` for an overlay panel that no longer overlays the stage - the shell must pass an inset of 0.

**Primary recommendation:** Build `OneScreen` as one client module mounted from a session-branching `src/app/page.tsx` (providers extracted, not duplicated), driven by a single `place` token state mirrored to `?place=` with `history.replaceState`; add a room layer + `flyInset`/focus-replay to `PlantStage`; feed admin pins, the Office card and the Workshop count from ONE server action that wraps the exact `deriveInbox` call `/governance` makes; retire routes with `next.config.ts` redirects (static) + the proxy (query-conditional), and budget a dedicated "repoint the old guards" plan up front (precedent: `tests/phase41/spec-repoint-inventory.spec.ts`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signed-in vs signed-out `/` branch | Frontend Server (RSC `page.tsx`) | Proxy (`/` stays public) | `getSessionContext()` is per-request cached; landing stays static-looking markup |
| Retired-URL redirects | Proxy + `next.config.ts redirects()` | — | CLAUDE.md 2026-09-29: never client `useEffect` + `router.replace` |
| Selection state, `?place=` mirror | Browser / Client | — | `useState` + `history.replaceState` (CLAUDE.md 2026-05-13) |
| Scene render, camera, rooms, pins | Browser / Client (`PlantStage`) | — | Pure presentation; takes classified data as props |
| Worker data (site, SOPs, due state) | API / server actions (`listSiteForWorker`) + client React Query | Database RLS | Existing, session-scoped, RLS primary |
| Admin health + inbox + drafts | API / server action (new composed read) | Database RLS + `requireAdminContext` | Admin-gated; one read feeds pin + card + Workshop (D-05) |
| Department CRUD + delete refusal | API / server actions | Database | Refusal count must be server-side (RLS-scoped counts), not client |
| Edit mode (Konva) | Browser (lazy `SiteEditorLoader`) | — | Must stay out of the worker bundle (konva isolation guard) |
| Role gating of shell parts | Client `useIsAdmin()`/`useRole()` (mount only) | Server guards (real gate) | Mount-time gating is UX; `requireAdminContext` is the access control (matrix note) |

## Standard Stack

No new libraries. Everything below is already installed. [VERIFIED: package.json]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | App Router; `src/proxy.ts` is the proxy | Pinned; has the action-queue freeze bug (CLAUDE.md 2026-09-29) |
| react | 19.2.4 | UI | `ref` as prop already used by `PlantStage` |
| @tanstack/react-query | ^5.95.2 | Server-state hooks | Existing pattern (`['site-worker']`, `useWorkerSops`) |
| konva / react-konva | 10.3.0 / 19.2.5 | Site editor canvas ONLY | Must stay behind `SiteEditorLoader` |
| lucide-react | ^1.0.1 | Icons | Existing |
| tailwindcss | ^4 | Tokens via `blueprint-theme.css` | Token lint bites on raw palette/hex/`h-[56px]` |
| @playwright/test | ^1.58.2 | Source-contract specs + deployed evals | Existing projects `phaseNN`, `evals` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `history.replaceState` for `?place=` | `router.replace` / `nuqs` | Rejected: CLAUDE.md 2026-05-13 (RSC fetch on every search-param change) + 2026-09-29 (queue orphan) |
| Rooms as DB rows | Constants in `src/lib/site/rooms.ts` | D-01 forbids DB; constants it is |
| Duplicate providers in `page.tsx` | Extract a `ProtectedProviders` server component used by layout AND page | Extract - one place to change |

**Installation:** none. **Slopcheck / Package Legitimacy Audit:** not applicable - this phase installs no external packages (verified: no dependency additions required by any item below).

## Architecture Patterns

### System Architecture Diagram

```
 browser GET /?place=<token>
        |
        v
 src/proxy.ts (updateSession)  -- getClaims() local verify, refresh cookies
   |  `/` public -> pass            |  retired paths -> 307 (query-conditional ones here)
   v
 next.config.ts redirects()  (static: /dashboard, /admin/departments, /admin/site -> /?place=edit, /admin/sops -> /)
   v
 src/app/page.tsx  (RSC)  -- getSessionContext()
   |-- no userId ---------------------------> <Landing/> (today's markup, Log In)
   |-- userId, no role ----------------------> redirect('/pending')
   '-- userId + role ------------------------> <QueryProvider><RoleProvider> <OneScreen/>
                                                       |
            +------------------------------------------+------------------------------+
            |                                          |                              |
     LIST PANE (256)                         STAGE PANE (1fr)                  DETAIL PANE (400)
     search · Now/Office card                PlantStage (+room layer)          DetailPane switch(place):
     Rooms(4) · Depts · Machines             pins, signposts, hover labels       none -> SiteSummary
            \                                  or, place=edit (admin):           machine -> machine body
             \____ one `place` token state ___ SiteWorkspace via SiteEditorLoader  room -> room body
                   (map click == list click)                                        dept -> framed machines
                         |  replaceState(?place=)  |  stageRef.flyTo/fit/fitMachines
                         v
   DATA (React Query, one key per concern)
     worker/supervisor: ['site-worker'] listSiteForWorker · useWorkerSops() (+placement) · supervisor sign-off count
     admin:             ['shell-admin']  NEW getAdminShell(): floor + governance rows + deriveInbox items + placement  (D-05: pin == card)
     edit mode:         listSiteForOrg (+ departments actions)
   bridges: Office -> /governance · Smoko -> /activity · Workshop -> /admin/sops/new + builder links
            each bridged page renders "Back to the site" (layout-level BackToSite)
```

### Recommended Project Structure
```
src/
├── app/page.tsx                         # RSC: landing | one screen (replaces today's landing-only page)
├── components/shell/                    # NEW - the one screen
│   ├── OneScreen.tsx                    # grid 256px 1fr 400px; owns `place` state + ?place= mirror
│   ├── ListPane.tsx                     # search, card, rooms, departments, machines
│   ├── DetailPane.tsx                   # switch on place kind
│   ├── SiteSummary.tsx                  # D-04 (one small file; Phase 60 swaps it)
│   ├── MachineBody.tsx / RoomBody.tsx   # bodies lifted out of MachinePanel/AdminMachinePanel (no overlay chrome)
│   └── AdminShellModule.tsx             # the ONE next/dynamic({ssr:false}) admin module (edit mode, health, drafts)
├── lib/site/rooms.ts                    # fractional room polygons + tokens (plain module, no directive)
├── lib/shell/place.ts                   # parsePlace/formatPlace/placeForPath (plain, unit-testable)
├── actions/shell.ts                     # getAdminShell() (admin-gated, composes existing reads)
└── components/layout/BackToSite.tsx     # one back link for every remaining protected page
```

### Pattern 1: One `place` token drives everything (SHL-02)
**What:** `type Place = {kind:'overview'} | {kind:'machine',id} | {kind:'room',id} | {kind:'dept',id} | {kind:'edit'}`; `parsePlace(search)` / `formatPlace(place)` in a plain module. Map click and list click both call `select(place)`, which sets state, calls `stageRef.flyTo/fitMachines/fit`, and `history.replaceState(null,'', formatPlace(place))`. Initial state is seeded from `useSearchParams()` on mount; a `searchParams.toString()` effect re-syncs on Back/forward (precedent: 2026-05-13 learning, `applyWorkerScope` at `sops/page.tsx:118-121`).
**When:** every selection. Validate the token: UUID regex for `machine`/`dept`, whitelist for rooms; an unknown or foreign id falls back to overview (never throws, never reflects raw input). `edit` for a non-admin -> overview.

### Pattern 2: Room layer in `PlantStage` (PLC-01)
Add optional props, default empty so the existing admin floor card keeps working unchanged:
```tsx
// PlantStage.tsx additions (sketch)
export interface PlantStageRoom { id: string; name: string; polygon: Point[]; pin?: number; selected: boolean; highlighted: boolean }
// props: rooms?: PlantStageRoom[]; onRoomClick?(id: string): void; flyInset?: number
```
- Render `<polygon data-testid="plant-room" data-room-id=...>` in the SAME `<svg>` (line 272-311) with a dashed rest outline (`strokeDasharray: '2 5'`, `stroke: color-mix(in srgb, var(--ink-900) 40%, transparent)` - tokens only). `handlePointerDown` (line 218) already ignores `tagName === 'polygon'` so room clicks do not start a pan.
- Signposts: a second `.map` beside the label block (line 312-367) that is ALWAYS visible (`labelVisible` logic not applied), counter-scaled. The existing code uses `scale(${1/view.s})` uncapped (line 322); the contract caps it: use `Math.min(2.4, 1 / view.s)` or signposts balloon at overview zoom (fit scale is ~0.4-0.7).
- `flyTo(id)` currently searches `machines` only (line 161); generalise to machines ∪ rooms. Draw rooms AFTER machines so a room wins an overlap (see Open Q2 - Office terminal).
- **`flyInset` (REQUIRED):** `flyTo` calls `flyToView(W,H,point)` whose default `panelWidth = PLANT_PANEL_WIDTH = 380` (`scene.ts:166,176-188`) shifts the target left to clear the old overlay panel. In the shell the detail pane is a separate grid column, so pass `flyInset={0}`. Keep the default so `tests/phase52/plant-stage.spec.ts` / `plant-panel.spec.ts` (assert 380 / `w-95`) stay valid until those specs are retired with `MachinePanel`'s overlay chrome.
- **Resize replay (REQUIRED):** the `ResizeObserver` (lines 191-199) only refits when `followFitRef.current` is true, which `flyTo`/`fitMachines`/pan all clear. With a place selected, a window resize leaves the camera stale. Store `focusRef = {kind:'fit'|'machine'|'box', ...}` and have the observer replay it; keep the existing 0x0 guard (`fitView` returns null on 0 dims, line 66-67).

### Pattern 3: Room geometry as fractions (D-01 discretion)
Scene size is per-org: real org `ea50b23d...` 2752x1536 `scene.jpg`; eval-site org 1600x900 `scene.png`. [VERIFIED: live query of `site_layouts`, 2026-10-04]. Store room polygons as 0-1 fractions and multiply by `layout.sceneWidth/Height` at render. Starting point = the sketch-008 placements (sketch space 2000x1116, same aspect as the real image), converted:

| Room | Fractional polygon (x,y) | Notes |
|------|-------------------------|-------|
| Office | (0.716,0.697) (0.820,0.697) (0.820,0.865) (0.716,0.865) | The existing office alcove at bottom-right of plant.jpg |
| Smoko room | (0.010,0.762) (0.010,0.699) (0.092,0.614) (0.192,0.717) (0.192,0.780) (0.110,0.865) | Sketch drew a room on the blank paper bottom-left |
| Workshop | (0.127,0.883) (0.127,0.820) (0.209,0.735) (0.309,0.838) (0.309,0.901) (0.227,0.986) | Blank paper bottom-left; overlaps IS Machine 1's bbox (x .199-.452, y .466-.811) at its top corner only - check visually |
| Noticeboard | (0.554,0.606) (0.593,0.606) (0.593,0.710) (0.554,0.710) | Walkway floor between lines; sketch drew a board here. Consider a wall position instead |

These were computed from `.planning/sketches/008-one-screen-site/index.html` (rooms `ROOMS`, `foot()`; viewBox 2000x1116). **Without the sketch's vector art, the Smoko/Workshop/Noticeboard hit-areas sit on bare paper outside the building walls.** That is acceptable under D-01 (signpost + dashed outline carry discoverability) but the executor MUST look at a screenshot of the real-org scene and eval-site scene (CLAUDE.md 2026-07-14) and adjust. Keep the table in `src/lib/site/rooms.ts` as the one place to tune.

### Pattern 4: Pins (PLC-04) - three producers, one stage prop
`PlantStageMachine.pin` (worker count) and `.health` (admin `'bad'|'due'|'ok'`) already render (lines 340-363). New: `PlantStageRoom.pin`. Producers:
- Worker machine pins: `derivePlantPins(machines, links, sopsById)` (`worker-signal.ts:~91`). Worker Noticeboard pin: count of `placement==='site'` SOPs with rel due/never/new (rel via `plantRelState`).
- Admin machine pins: `machineHealth(machines, links, flagsBySop)` (`admin-health.ts:27-44`). Admin Office pin = `deriveInbox(...).length`; Workshop pin = count of non-published SOPs (same drafts list the Workshop panel shows).
- Supervisor Office pin = pending-sign-off count (D-06).

### Pattern 5: One query for pin + card (D-05)
`/governance/page.tsx:22-47` runs `Promise.all([listGovernanceQueue(), listAdminSopRows({}), listSiteHealthForOrg()])` then `deriveInbox({governance, library, machines, links})`. Extract that into one plain server-side function `loadInbox()` used by BOTH the `/governance` page and a new admin-gated server action `getAdminShell()`; the action returns `{ floor, governance: GovernanceRow[], inboxCount, drafts, placementBySop }`. The shell derives pins, Office card number, machine health and Workshop list from that single React Query entry (`['shell-admin']`). `/governance`'s "N open" and the Office pin/card are then the same number by construction. Add a source-contract spec asserting both import the same function (CLAUDE.md 2026-09-27: a classification in two places drifts).

### Anti-Patterns to Avoid
- **Client redirect for a retired URL** (2026-09-29): the page fires mount-time server actions; navigating from an effect orphans the next action and the router hangs. Use proxy / `next.config.ts` / server component.
- **`router.push` for `?place=`** (2026-05-13).
- **Statically importing the admin module** into the `/` worker path (2026-09-13): admin edit/health/drafts = one `next/dynamic({ssr:false})` module gated on `useIsAdmin()`, bundle-gated.
- **Importing konva/`SiteEditor`/`SiteEditorLoader` from `src/components/sop/plant/`** - `tests/phase26/konva-worker-isolation.spec.ts:115` forbids it. Edit mode swaps the middle pane to `SiteWorkspace` (in `admin/site/`), it does not live in `PlantStage`.
- **Static import of `PlantStage` outside `components/sop/plant/`** is policed by `tests/phase52/plant-render-seam.spec.ts` (written for `AdminFloorHealth`'s dynamic import). `OneScreen` lives in `components/shell/`: either import via `next/dynamic` or consciously update that spec in the same plan.
- **Quoting forbidden literals in comments** (2026-09-28): describe patterns in words in new specs/comments.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera maths | New pan/zoom | `fitView`, `flyToView`, `fitBoxView`, `zoomAt`, `zoneColour` in `src/lib/site/scene.ts` | Ported + spec'd (D-07 of Phase 52) |
| Worker rel state / due ordering / pins / search | New classifier | `plantRelState`, `pickNowQueue`, `derivePlantPins`, `machineSops`, `askMatches`, `narrowForAsk` (`worker-signal.ts`) | CLAUDE.md 2026-09-27: one classifier |
| Admin health badges / pins | New flag logic | `adminSopBadge`, `machineHealth`, `machinePanelSops`, `machinesWithoutSops` (`admin-health.ts`) | READS governance flags, never re-derives |
| Inbox rows/counts | New count | `deriveInbox`, `inboxCounts` (`governance/inbox.ts`) | D-05 parity |
| Edit mode canvas + machine form | New editor | `SiteWorkspace` + `SiteEditorLoader` + `SiteEmptyState` | Keep Konva isolation |
| Department create/rename/recolour | New actions | `createDepartment` / `updateDepartment` in `src/actions/departments.ts` (gaps: see Pitfall 6) | Existing zod + admin guard; colour is a fixed 8-hex enum, `code` required 1-6 chars, unique per org |
| Member department picker | New picker | `DepartmentPicker mode='member'` already used by `RoleAssignmentTable` on `/admin/team` | D-09 is already satisfied in code - verify, don't rebuild |
| Standards / placement labels | New label code | `placementSummary`/`placementLabel`/`standardNames` (`lib/sop/placement.ts`), `StandardLabels` | Phase 56 |
| Dead-link / reference guards | Ad hoc grep | `tests/lint/no-dead-internal-hrefs.spec.ts` (folds in `next.config` redirect sources as valid targets) | Already repo-wide |

**Key insight:** every "new" surface is a recomposition of a classified-data-in, markup-out component. Anything that computes a count or badge inside `components/shell/` is a bug against 2026-09-27.

## Runtime State Inventory

Retirement/rename aspects of this phase (routes + header + roleHome):

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None - verified: no table or column is renamed; D-01 forbids new room storage; `departments`/`member_departments` unchanged | none |
| Live service config | Supabase Auth redirect/site URL config may list `/sops` or role homes as allowed redirect targets - not inspectable from code | Executor: check Supabase Auth URL allow-list for any `/sops`/`/dashboard` entry [ASSUMED none] |
| OS-registered state | None - verified: no cron/task references these routes (only `/api/agent-layer/synthesis-sweep` is cron) | none |
| Secrets/env vars | None | none |
| Build artifacts | `.next` chunk graph changes; `public/sw.js` kill-switch (committed) still unregisters old workers that may have cached `/sops` | Verify kill-switch still ships; bundle baseline - see Pitfall 4 |
| Browser state (bookmarks, PWA installs) | Old bookmarks to `/sops`, `/governance?...`, `/admin/site`; `manifest.ts` `start_url` may point at `/sops` | Check `src/app/manifest.ts` `start_url`; redirects cover bookmarks |

## Common Pitfalls

### Pitfall 1: The Access wiring screen is orphaned by D-13
**What goes wrong:** `AdminAccessLens` (-> `WiringPatchBayShell`, "keep the current wiring") is dynamically imported only by `AdminLibraryTable` (`AdminLibraryTable.tsx:45-46,153-154`, button at :246). Builder `BuilderStageShell.tsx:492` links `/sops?view=access&sop=${sopId}`; `PublishStage` and `WiringPatchBay.tsx:620-621` link `/sops?departments=` / `?collection=`. Retiring `/sops` + the table leaves admins unable to edit access until Phase 59.
**How to avoid:** Add a thin bridge page (e.g. `src/app/(protected)/admin/access/page.tsx`, server guard `requireAdminContext`, mounts `AdminAccessLens` with `pinnedSopId` from `?sop=`), map `/sops?view=access[&sop=]` to it in the proxy, repoint the three in-app hrefs, and have the Office panel link "Access" to it. Phase 59 re-homes it. Surface to the owner in the plan summary - it is a scope addition CONTEXT did not decide. [VERIFIED: grep]
**Warning sign:** Planner lists "delete `AdminLibraryTable`" with no task touching `AdminAccessLens`.

### Pitfall 2: No header = no sign-out, profile, team, settings, tooling, and no way back
**What goes wrong:** `TopHeader.tsx` is the only mount of Sign out (`signOut` form, line ~296), Profile, Team (`/admin/team`), Settings (`/admin/settings`), Pathways, Feedback, Create New SOP and `NotificationBadge`. Also, once the layout drops `TopHeader`, every still-live protected page (`/sops/[sopId]`, builder, `/admin/*`) has no way home except browser Back - and CONTEXT only adds "Back to the site" to the four bridged pages.
**How to avoid:** (a) ONE `BackToSite` bar rendered by `(protected)/layout.tsx` for every wrapped route, destination from a pure `placeForPath(pathname)` (`/governance`,`/admin/team`,`/admin/access` -> `office`; `/activity`,`/activity/*` -> `smoko`; `/admin/sops/new*`,`/admin/sops/upload` -> `workshop`; machine/SOP pages -> `/` ); Phase 58 replaces it with the focus bar. (b) A quiet account control at the foot of the list pane (email, Profile, Sign out, and for admins the tooling/settings entries as links inside the Office/Workshop bridges) - it is an account menu, not navigation. (c) `/admin/team` and `/admin/settings` must be reachable: link from the Office panel body (People & roles -> `/admin/team`, Access -> bridge, Settings). Flag (a)-(c) as discretion decisions the plan states explicitly. [VERIFIED: TopHeader.tsx:130-160, 270-300]

### Pitfall 3: D-05 vs the code - "completions awaiting sign-off" is not an inbox row
**What goes wrong:** CONTEXT D-05 enumerates five row kinds including completions awaiting sign-off. `deriveInbox` (`inbox.ts:75-136`) emits only `gov` rows (chips owner / overdue / approve / stale-role grey), `stuck`, and `machines`. Sign-off is `status === 'pending_sign_off'` on `sop_completions` (`SupervisorActivityView.tsx:~63`), read by `useSupervisorCompletions` (RLS-scoped; supervisors see their workers, safety_manager all).
**How to avoid:** Admin Office number = `deriveInbox(...).length` (== "N open" on `/governance`; satisfies the locked parity rule). Show awaiting sign-offs as a SEPARATE line in the Office panel linking `/activity`, not inside the pin number. Supervisor (D-06) number = pending-sign-off count only. Record this reading in the plan so the verifier checks the right thing. [VERIFIED: source]

### Pitfall 4: The bundle gate fails the build when `sops/page.tsx` goes
**What goes wrong:** `scripts/check-bundle-size.ts` (postbuild) hard-codes `.next/server/app/(protected)/sops/page*` for the `/sops/page` entry (lines 88-92), reads the RSC manifest under key `/(protected)${route}` (line 161), and its marker self-validation (lines 304+) requires every forbidden marker to exist somewhere in the build - the library-table markers (`'Reviewed within 12 months'`, `'No SOPs match these filters.'`), `'Owner role gone'` and the access-lens markers vanish or move. `.bundle-baseline.json` holds `/sops/page: 817` and `/sops/[sopId]/page: 817`.
**How to avoid:** One dedicated plan: remove the `/sops/page` entry; drop markers for deleted components (keep ones still in the build; `GovernanceQueueRow` survives on `/governance`); keep `/sops/[sopId]/page` gated (its chunk set shrinks - a decrease passes, record the new measured value as a DECREASE by hand, same as Phase 55's note); add a gate for the new `/` page whose manifest lives at `.next/server/app/page...` (NOT under `(protected)`), so the script's `/(protected)` key assumption needs a per-entry override; give `/page` forbidden markers `react-konva`/`konva`, `pdfjs-dist`, `mammoth`, and an admin-editor literal (e.g. SiteWorkspace's `'Draw machine'`) so the worker path provably excludes the editor; capture the `/page` baseline once at the end as a recorded decision artefact. NEVER re-capture to hide growth (2026-09-13). Run a real `npm run build` as each wave's gate (2026-06-27).

### Pitfall 5: ~25 existing guards and 7 evals assert things this phase deletes
**What goes wrong:** Specs that read `src/app/(protected)/sops/page.tsx`, `TopHeader`, `AdminLibraryTable`, `PlantHome`, `AdminFloorHealth`, `roleHome` mappings will go stale-red (2026-07-13). Found by grep: `tests/phase28/library-and-worker`, `phase30/{admin-nav,create-entry,dead-weight,governance-fold,list-rows,role-homes}`, `phase32/{library-filter-deeplink,wire-up-mode}`, `phase33/sop-drilldown`, `phase40/dup04-page-shell`, `phase41/{bundle-gate,merged-surface,nav-and-shim,reference-sweep,spec-repoint-inventory,admin-sop-list-action}`, `phase51/{site-workspace-wiring,builder-machines-row}`, `phase52/plant-render-seam` (+ `plant-ask-bar`), `phase54/{admin-machine-panel,deletion-sweep,library-table}`, `phase55/worker-path-contract`, `tests/lint/{no-static-admin-lens-import,no-global-blocks-in-journeys}`, `tests/sb-auth-builder.test.ts`; evals `cut-features`, `dead-surface`, `governance`, `plant-home`, `site-editor`, `sop-surface`, `sop-ledger`.
**How to avoid:** Plan 1 (Wave 0) = an inventory spec modelled on `tests/phase41/spec-repoint-inventory.spec.ts`: enumerate each stale guard with its disposition (repoint to the new module / delete with the feature / keep). Repoint in the SAME commit that moves the code. Run the affected projects each plan, not just `phase57` (2026-10-04 learning: per-plan self-checks missed cross-project breakage for five plans).

### Pitfall 6: Department "delete" has no refusal check, and the FK silently orphans
**What goes wrong:** `archiveDepartment` (`departments.ts:261-282`) just sets `archived=true` ("flag only, never DELETE", REQ-6). `site_machines.department_id` is `on delete set null` (00067:56) - and an archived department is filtered from every read (`listSiteForOrg`/`listSiteForWorker` `.eq('archived', false)`), so machines of an archived department silently show "no department" and lose their zone. `createDepartment` requires `code` (1-6 chars, uppercased, `unique(organisation_id, code)` per 00035:40) and `colour` from a fixed 8-hex enum (V5 anti-CSS-injection) - the inline "add" strip cannot just take a name.
**How to avoid:** Extend (or wrap) the action: before archiving count non-archived `site_machines` with that `department_id` and `sop_departments` rows; return `{error, machines, sops}` and refuse when either > 0 (D-08 "count shown"). Derive `code` from the name (first letters, uppercase, de-dup suffix on collision) in the action, not the UI; colour picker offers exactly the enum. Org-scope every count with the SESSION org id (2026-07-28). Keep archive semantics; label it "Remove". [VERIFIED: source]

### Pitfall 7: The real org already has a machine where the Office room goes
**What goes wrong:** Real-org machine "Office terminal" bbox x 0.720-0.811, y 0.717-0.862 equals the sketch's Office room (0.716-0.820, 0.697-0.865). [VERIFIED: live query] If rooms render under machines, Office is unclickable; if over, the machine is unreachable on the map. The same org has 13 machines with bbox x 0.085-0.952 / y 0.134-0.862 (all in the building), leaving the blank paper bottom-left free for Smoko/Workshop.
**How to avoid:** Render rooms above machines (room wins); keep "Office terminal" selectable from the list; surface to the owner that it is redundant and can be removed in edit mode (no data migration by this phase). Add a spec asserting `ROOMS` fractional polygons are within [0,1] and pairwise non-overlapping, and a deployed-eval screenshot check on the eval org.

### Pitfall 8: Eval fixtures and shared-org assertions
`site-editor.eval` resets the eval-site org's layout every run (current state: 1 machine "EVAL Press"; the "EVAL Oven" from the Phase 54 eval is not persistent). Assert by NAME/id, never exact counts (2026-09-29); use the shared `SLOW` timeout after any `next/dynamic` + first `useQuery`; any check that every row has X must scope to rows predating the operation (2026-10-04). A walk/second-record test cannot be proved by one iteration (2026-10-03): select machine A, then Office, then machine B and assert the detail pane never leaks the previous place.

### Pitfall 9: Worker library select lacks `placement`
`useWorkerSops` selects `id, title, sop_number, category_slug, department, published_at` (`useWorkerSops.ts:~45`). Noticeboard (PLC-03) and the worker Noticeboard pin need `placement`. Add it to the select and `WorkerSopRow` (additive; `sops.placement` exists since 00069, default `'site'`, CHECK in ('machine','site'), kept in sync by the `sop_machines` trigger). Note real-org data: 14 draft + 1 uploading + 1 parsing + 1 published SOP are `placement='site'` (most drafts have no machine), 3 published + 13 draft are `'machine'`. So an admin Noticeboard that lists drafts shows ~16 rows of mostly drafts: recommend Noticeboard = published `site` SOPs plus a DRAFT-badged tail only for admins, and rely on the Workshop list for the rest (see Open Q5).

### Pitfall 10: `/` is a static public route today
`src/app/page.tsx` is a static landing; `/` is in the proxy's public list (`middleware.ts:45`). Calling `getSessionContext()` there makes it dynamic (cost accepted). Root layout (`src/app/layout.tsx`) has NO providers - they live in `(protected)/layout.tsx` (`QueryProvider`, `RoleProvider`), so a `page.tsx` outside `(protected)` must supply them. A route group cannot also own `/` (conflict). Extract providers; do not duplicate.

### Pitfall 11: `roleHome` consumers
`roleHome` is used by `middleware.ts:78`, `actions/auth.ts:59,124,231`, `activity/page.tsx:22`, `dashboard/page.tsx:17`, `TopHeader`. Change it to return `/` for worker/supervisor/safety_manager/admin and keep `/pending` default; `tests/phase30/role-homes.spec.ts` pins the old mapping (repoint). Role-less user hitting `/` -> `redirect('/pending')` in the RSC (no loop: `/pending` is static and does not redirect).

### Pitfall 12: Next 16.2.1 action-queue freeze, again
The shell fires several mount-time server actions (`listSiteForWorker`, assignments, admin read). Anything that navigates (e.g. a deep link `?place=` resolved by `router.replace`, or the bridge links) during that window can orphan an action. Only `history.replaceState` and `<Link>` clicks by the user; no navigation from effects. The `?place=edit` -> non-admin fallback must be a state change, not a redirect.

### Pitfall 13: `PLANT_PANEL_WIDTH`/overlay specs
`MachinePanel` is an absolute right overlay `w-95` with `translate-x-full` (MachinePanel.tsx:20-42) and `tests/phase52/plant-panel.spec.ts:55-58` assert `w-95` + 380. Do not retrofit the overlay into the detail pane: lift the body (sprite, dept label, SOP rows) into `MachineBody` and delete or rewrite the overlay + its spec together. Same for `AdminMachinePanel` (card chrome, `data-testid="admin-panel"`). `data-testid`s used by evals (`plant-panel-row`, `plant-panel-walk`, `plant-now-walk`, `plant-pin`, `plant-label`, `admin-panel-*`) - keep stable ids on the lifted bodies so the rewritten evals reuse them.

### Pitfall 14: Hydration and `useViewport`
`useViewport()` returns `'mobile'` on first render then flips (`useViewport.ts:12-30`). CONTEXT: desktop-only. Do not branch the shell's first render on it (2026-06-08). Recommend: always render the three-pane grid; below 1024px collapse via CSS only (`grid-cols-1`, stage hidden, list then detail) - cheapest honest fallback for a worker who opens a link on a phone (see Open Q6).

## Code Examples

### `?place=` parse/format (plain module, unit-testable)
```ts
// src/lib/shell/place.ts  (sketch - no directive)
const ROOM_IDS = ['office', 'smoko', 'workshop', 'noticeboard'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type Place =
  | { kind: 'overview' } | { kind: 'edit' }
  | { kind: 'room'; id: (typeof ROOM_IDS)[number] }
  | { kind: 'machine'; id: string } | { kind: 'dept'; id: string }
export function parsePlace(token: string | null): Place {
  if (!token) return { kind: 'overview' }
  if (token === 'edit') return { kind: 'edit' }
  if ((ROOM_IDS as readonly string[]).includes(token)) return { kind: 'room', id: token as never }
  if (token.startsWith('dept:') && UUID.test(token.slice(5))) return { kind: 'dept', id: token.slice(5) }
  if (UUID.test(token)) return { kind: 'machine', id: token }
  return { kind: 'overview' }
}
export function formatPlace(p: Place): string {
  switch (p.kind) {
    case 'overview': return '/'
    case 'edit': return '/?place=edit'
    case 'room': return `/?place=${p.id}`
    case 'dept': return `/?place=dept:${p.id}`
    case 'machine': return `/?place=${p.id}`
  }
}
```

### Selecting (map and list share it)
```tsx
// Source: pattern from sops/page.tsx:118-121 (CLAUDE.md 2026-05-13) + PlantHome.open/close
function select(p: Place) {
  setPlace(p)
  window.history.replaceState(null, '', formatPlace(p))   // never router.push
  if (p.kind === 'machine' || p.kind === 'room') stageRef.current?.flyTo(p.id)
  else if (p.kind === 'dept') stageRef.current?.fitMachines(machineIdsIn(p.id))
  else stageRef.current?.fit()                              // overview / Esc
}
// Esc: window keydown -> select({ kind: 'overview' }); ignore when typing in an input
```

### Session-branching root page
```tsx
// src/app/page.tsx (sketch)
export default async function Home() {
  const { userId, role } = await getSessionContext()
  if (!userId) return <Landing />            // today's markup moved verbatim
  if (!role) redirect('/pending')
  return (
    <QueryProvider><RoleProvider role={role as AppRole}><OneScreen /></RoleProvider></QueryProvider>
  )
}
```

### Retirement redirects
```ts
// next.config.ts redirects() additions (static; runs before the proxy)
{ source: '/dashboard',         destination: '/',                permanent: false },
{ source: '/admin/departments', destination: '/?place=edit',     permanent: false },
{ source: '/admin/site',        destination: '/?place=edit',     permanent: false },
{ source: '/admin/sops',        destination: '/',                permanent: false },   // was '/sops'
// proxy (query-conditional, copies refreshed cookies like middleware.ts:66-68):
//   /sops?view=attention -> /?place=office ; /sops?view=access[&sop=] -> /admin/access[?sop=] ; /sops (any other) -> /
```
`next.config` redirect sources count as valid targets for `no-dead-internal-hrefs`; verify any new internal href target exists in the route set or a redirect source.

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| `/sops` list page branching worker/admin + plant | `/` one screen, `/sops` gone | Phase 57 | `sops/page.tsx` 6 KB of branching deleted |
| Header nav (`TopHeader`) | Rooms on the map | Phase 57 | Account/tooling need a home (Pitfall 2) |
| Admin library table + floor card on `/governance` | Machine panels + Workshop list + Office card | Phase 57 | Table deleted; `AdminFloorHealth` card on `/governance` can stay for the bridge or be dropped (decide) |
| Overlay machine panel w/ 380 fly offset | Separate detail column, `flyInset=0` | Phase 57 | Spec churn (Pitfall 13) |

**Deprecated/outdated by this phase:** `TopHeader`, `NotificationBadge`, `NavPendingSpinner` (only importers: TopHeader + specs), `PlantHome` (superseded by `OneScreen`), `AdminLibraryTable`, `src/app/(protected)/sops/page.tsx` + `sops/loading.tsx`, `dashboard/page.tsx`, `admin/departments/*` + `components/admin/departments/{DepartmentGrid,DepartmentCard,DepartmentFormModal}` (keep `DepartmentPicker`, used by team/SOP editors), `admin/site/page.tsx`. `PageShell` stays (`DesktopWalkthrough.tsx:11`). `AdminPageShell` stays (many admin pages).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase Auth URL allow-list has no `/sops`/`/dashboard` entry | Runtime State | Login redirect to a retired path (self-heals via redirects) |
| A2 | `src/app/manifest.ts` `start_url` points at a retired path | Runtime State | PWA launches via an extra redirect; low |
| A3 | Admin Office pin = `deriveInbox().length` (excludes sign-offs) is the intended reading of D-05 | Pitfall 3 | Owner expected sign-offs inside the number; would break `/governance` parity |
| A4 | Rooms render above machines; Office terminal machine left in place | Pitfall 7 | Owner may prefer deleting the machine or moving the Office room |
| A5 | Below 1024px the grid collapses to a single column rather than a "use a larger screen" notice | Pitfall 14 | UX on phones; CONTEXT says desktop-only so either is defensible |
| A6 | Admin Noticeboard shows published `site` SOPs plus a DRAFT-badged tail | Pitfall 9 | Noise vs. missing drafts; Workshop list is the safety net |

## Open Questions

1. **Account/tooling home with no header (needs an owner nod or the stated default).**
   - Known: header held Sign out, Profile, Team, Settings, Pathways, Feedback, Create New SOP, notification badge.
   - Unclear: where each lives. Recommendation: footer account control in the list pane (email, Profile, Sign out; Pathways/Feedback as small text links there for team tooling); Team/Settings/Access as links in the Office panel; Create New SOP in the Workshop panel. Document it in the plan.
2. **Office room vs the existing "Office terminal" machine** (Pitfall 7). Recommendation: room above machine; owner can delete the machine in edit mode.
3. **`/governance` appears in D-10's redirect list but D-12 says the Office bridge opens `/governance`.**
   - Reading: the PAGE survives until Phase 59 (D-12 wins, header removed + back link); only the legacy `?view=attention|library` entry points (currently via `/sops`) redirect. Recommendation: do NOT redirect `/governance`; the verifier checks "no header, Back to the site present". Confirm in the plan summary.
4. **"New SOP for this machine" (PLC-02):** `/admin/sops/new` and `/new/blank` ignore any machine param (`WizardClient` calls `createSopFromWizard` then `router.push` to the builder; no `machine`). Minimal honest wiring: forward `?machine=<id>` from the method picker to the blank wizard and call the existing `setSopMachines({sopId, machineIds:[id]})` after create. Other on-ramps stay plain until Phase 61. Decide scope in plan.
5. **Admin Noticeboard contents** (A6).
6. **Phone behaviour** (A5).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/tests | yes | 22.16.0 | — |
| Supabase (prod project, service role in `.env.local`) | eval fixtures, live reads | yes (queried this session) | — | — |
| Railway deploy of HEAD (`/api/version`) | `npm run eval -- --phase 57` | assumed per project workflow | — | — |
| Gemini image key | scene generation in `SiteEmptyState` | not needed this phase | — | — |

No blocking missing dependencies. Eval fixtures: `node scripts/eval-fixtures.mjs` provisions `eval-admin`, `eval-worker`, `eval-site-admin`, `eval-site-worker` (eval-site org has a published "Eval plant fixture SOP" on "EVAL Press"; ensure via `tests/evals/lib/plant-fixture.ts` `ensurePlantFixture`). Supervisor role: NO fixture exists - D-06 needs either a new `EVAL_USERS.supervisor` fixture (additive in `scripts/eval-fixtures.mjs` + `tests/evals/lib/session.ts`) or a source-contract-only proof.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58 (source-contract/unit specs + deployed evals) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase57` |
| Full suite command | `npm run test` (run ONCE per gate; live probes rate-limit, 2026-09-28) |
| Eval | `npm run eval -- --phase 57` (needs `EVAL_BASE_URL`; self-skips otherwise) |
| Build gate | `npm run build` (runs `postbuild` bundle check) + `npx tsc --noEmit` |

Register `phase57`: `testDir: '.'`, `testMatch: /tests\/phase57\/.*\.(spec|test)\.ts$/` (broad, like phase54-56 at `playwright.config.ts:611-696`), verify with `npx playwright test --list --project=phase57`. Any new `tests/lint/*.spec.ts` must ALSO be added to a project regex (2026-05-25). Pure modules (`place.ts`, `rooms.ts`) get static-import unit specs under `tests/phase57/` (precedent `tests/phase55/sop-pack.spec.ts`); no dynamic `import('@/...')`.

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| SHL-01 | `page.tsx` branches on session; layout has no TopHeader; no `<header role="banner">`/nav links in shell; `roleHome` returns `/`; deployed: signed-in `/` shows three panes, signed-out shows landing | source-contract + eval | `npx playwright test --project=phase57 -g SHL-01` | Wave 0: `tests/phase57/shell-structure.spec.ts`, `tests/evals/one-screen.eval.ts` |
| SHL-02 | Map click and list click both call one `select()`; selected shape + detail match; Esc -> overview + refit; `parsePlace/formatPlace` round-trip + bad token fallback | unit + eval (second-iteration: place A then B then Office) | `-g SHL-02` | `tests/phase57/place.spec.ts` ; eval |
| SHL-04 | search matches machine names + SOP titles; rooms matched by name; highlights shapes (`data-highlighted`) | unit (pure fn) + eval | `-g SHL-04` | `tests/phase57/search.spec.ts` ; eval |
| SHL-05 | worker card = `pickNowQueue()[0]`; admin/supervisor card number = pin number from the same source | source-contract + eval | `-g SHL-05` | `tests/phase57/one-query.spec.ts` ; eval |
| PLC-01 | four rooms, fractional polygons in [0,1], non-overlapping; signposts present at overview and zoomed (eval screenshots); no room DB/UI (absence guard); no `room` table in migrations | unit + source-contract + eval | `-g PLC-01` | `tests/phase57/rooms.spec.ts` ; eval |
| PLC-02 | machine body lists SOPs with badge; worker Walk link; admin Walk/Edit/new-SOP links with machine param | source-contract + eval | `-g PLC-02` | `tests/phase57/machine-body.spec.ts` ; eval |
| PLC-03 | Noticeboard filters `placement==='site'`; `placement` in worker select | source-contract + eval (convert fixture SOP is site-wide + published) | `-g PLC-03` | `tests/phase57/noticeboard.spec.ts` ; eval |
| PLC-04 | pins: worker due, admin bad/due, Office/Workshop counts; Office pin == `/governance` "N open" by shared function | source-contract + eval (compare numbers on screen) | `-g PLC-04` | `tests/phase57/pins.spec.ts` ; eval |
| PLC-05 | edit mode enters via button + `?place=edit`; departments strip actions; delete refused with counts (live probe, `PHASE57_LIVE=1`); `/admin/departments` + `/admin/site` redirect | source-contract + live probe + eval | `-g PLC-05` | `tests/phase57/departments.spec.ts` ; eval |
| Retirement | no `href`/`push`/`redirect` to retired routes anywhere in `src/` (comment-stripped); dropped list updated; sweep enumerates entries | source-contract | `-g retire` | `tests/phase57/retirement-sweep.spec.ts` (+ extend `scripts/dropped-features.json`) |

Eval shape (`tests/evals/one-screen.eval.ts`, Playwright project `evals`): sign in via `signInAs(context,'siteAdmin'|'siteWorker')`; assert by NAME (`EVAL Press`, `Eval plant fixture SOP`), never exact counts; `SLOW` timeout on every assertion after `page.goto('/')` (dynamic chunk + first query); Claude READS screenshots (rooms visible, signposts at overview, edit mode) before declaring a pass; include the second-iteration leak check; supervisor path needs a fixture (see Environment).

### Sampling Rate
- Per task commit: `npx playwright test --project=phase57` + `npx tsc --noEmit`
- Per wave merge: phase57 + every project in the repoint inventory (phase30, 41, 51, 52, 54, 55, 56, `phase15-stubs`) + `npm run build`
- Phase gate: ONE full-suite run, compare non-live failures to a recorded baseline; deployed eval after push.

### Wave 0 Gaps
- [ ] `playwright.config.ts` — `phase57` project
- [ ] `tests/phase57/repoint-inventory.spec.ts` — every stale guard listed with disposition (Pitfall 5)
- [ ] `tests/phase57/*.spec.ts` stubs per row above
- [ ] `tests/evals/one-screen.eval.ts` + supervisor fixture decision
- [ ] Rewrite/retire `plant-home`, `governance` (line 220), `site-editor` (lines 166-168, 368-369), `sop-surface`, `dead-surface`, `cut-features` evals' retired-URL assertions
- [ ] Bundle gate script change plan (Pitfall 4)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getSessionContext()`/`getClaims()`; proxy gate unchanged |
| V3 Session Management | yes | Supabase cookies; redirects copy refreshed cookies (`middleware.ts:66-68` idiom) |
| V4 Access Control | yes | `requireAdminContext()` in every admin action; RLS primary; client `useIsAdmin()` is mount-only UX; new `getAdminShell()` self-guards; capability matrix updated |
| V5 Input Validation | yes | `?place=` token parsed against UUID/whitelist; departments via existing zod (colour enum, code); no raw reflection |
| V6 Cryptography | no | none |
| V13 API/redirects | yes | redirect destinations are fixed strings (T-43-02); `safeNextPath` for `?next=` unchanged |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org read via client-supplied id (`?place=<machineId>` of another org) | Info disclosure | place resolves only against rows already loaded under RLS/session org; unknown id -> overview |
| Org scope from a fetched row (2026-07-28) | Elevation | every new count/read uses the SESSION `organisationId` |
| Service-role in new actions (2026-06-15/07-29) | Elevation | session client only (matches `site.ts`); no `createAdminClient` in `actions/shell.ts` (CR-01 guard) |
| Open redirect via proxy rule | Tampering | fixed destinations; never built from request input |
| Admin module in worker bundle | Info disclosure | lazy module + bundle markers |
| Department delete orphaning visibility rules | Tampering | server-side refusal with counts (Pitfall 6) |
| Client-trusted parameters on a re-homed action (2026-10-03) | Elevation | do not add org/role params to `getAdminShell`; derive from session |

Capability matrix rows to touch (`.planning/codebase/CAPABILITY-MATRIX.md`; keep existing row LABELS - `tests/phase46/capability-matrix-doc.spec.ts` pins them literally): "Manage departments" (line 51: now in the site editor edit mode; delete refusal; remove the `/sops?view=access` wording, point at the access bridge); "Governance queue" (line 47: also reachable as the Office panel summary); "View site map" (line 57: feeds the `/` shell, not "/sops plant home"); "Edit site map" (line 58: edit mode from the map; departments strip); "Library health data" (line 61: now `getAdminShell`); add a Workshop drafts-list row (admin-only, derived from the governance read) and a rooms-per-role note (all roles see all four rooms; content gated by server actions); rewrite the Phase 41/54 route note (line 72) since `/sops` and the library table no longer exist. Update in the same commit as each gate/guard change.

## Maintenance Checklist (the unglamorous half)

| Artefact | Required change |
|----------|-----------------|
| `src/lib/journeys/journeys.ts` (594 lines, `JOURNEYS` array line 50; `/pathways` flags unmapped routes) | Rewrite worker + admin journeys around the one screen; add bridge routes `/governance`, `/activity`, `/admin/team`, access bridge; remove steps with `route: '/sops'`, `/dashboard`, `/admin/departments`, `/admin/site` (lines ~62, 103, 256-266); `/pathways` must show 0 not-mapped; `tests/lint/no-global-blocks-in-journeys.spec.ts` and `tests/phase51/site-workspace-wiring.spec.ts:152` read it |
| `src/lib/uat/tests.ts` (1099 lines) | Update items that reference header nav / `/sops` list |
| `scripts/dropped-features.json` | Add entries (`feature`, `phase: 57`, `kind`): `file` for `TopHeader.tsx`, `NotificationBadge.tsx`, `NavPendingSpinner.tsx`, `AdminLibraryTable.tsx`, `PlantHome.tsx`, `DepartmentGrid/Card/FormModal`; `route-page` for `/dashboard` (dir `src/app/(protected)/dashboard`, ref `/dashboard`), `/admin/departments`, `/admin/site` (dir `src/app/(protected)/admin/site`), `/sops` list (the page file only; `[sopId]` stays - mind that the `route-page` sweep keys on `dir`, so use a `file` entry for `sops/page.tsx`). Entry shape confirmed at `scripts/dropped-features.json` lines 84-89, 270-290. `tests/phase55/deletion-sweep.spec.ts` has a hard-coded `FEATURES`/`LIVE_FEATURES` list - a new feature key needs adding there |
| In-app hrefs to retired routes | `/dashboard` (14 `redirect('/dashboard')` guards in pages: activity/[completionId], admin/{agent,ai-settings,departments,settings,team}, admin/sops/{builder/[sopId],new,new/ai,new/blank,upload}, governance; plus `platform-admin-guard.ts:24`) -> `/`. `/sops` (bare): `WorkerActivityView.tsx:35`, `admin/site/page.tsx:25`, builder `BuilderStageShell.tsx:147,392`, builder `page.tsx:46`, `sops/[sopId]/page.tsx:78,97`, `ParseJobStatus.tsx:241`, `UploadDropzone.tsx:536` (`/sops?status=draft` -> `/?place=workshop`), `lib/sop-list/admin-rows.ts:197` (`libraryNavToUrl`), `WiringPatchBay.tsx:620-621`, `BuilderStageShell.tsx:492`, `actions/ai-fields.ts:231,287` (`revalidatePath('/sops')` -> `'/'`). `/admin/site`: `BuilderMachinesButton.tsx:179`, `AdminFloorHealth.tsx:82`. `/admin/departments`: `admin/settings/page.tsx:38`. All found by grep this session; the sweep spec must assert absence of references, not just files (2026-08-04). `tests/lint/no-dead-internal-hrefs.spec.ts` will catch stragglers |
| `.planning/codebase/CONVENTIONS.md` | Pathways rule unchanged; mention shell |
| Phase 59/61 forward notes | Bridges carry a comment-free marker in prose docs only (no quoted literals in guarded files) |

## Sources

### Primary (HIGH confidence) - all read from this repo, 2026-10-04
- `src/components/sop/plant/{PlantStage,PlantHome,MachinePanel,NowCard,RelBadge,PlantAskBar}.tsx`; `src/lib/site/scene.ts`
- `src/components/admin/governance/{AdminFloorHealth,AdminMachinePanel,GovernanceInbox}.tsx`; `src/lib/sop/admin-health.ts`; `src/lib/governance/inbox.ts`; `src/app/(protected)/governance/page.tsx`
- `src/components/admin/site/{SiteWorkspace,SiteEditorLoader,SiteEmptyState}.tsx`; `src/actions/{site,site-worker,departments,governance,admin-sop-list}.ts`; `src/lib/validators/site.ts`
- `src/proxy.ts`, `src/lib/supabase/middleware.ts`, `src/lib/auth/role-home.ts`, `src/lib/auth/session-context.ts`, `src/app/{page,layout}.tsx`, `src/app/(protected)/{layout,loading,dashboard,pending,sops,activity,admin/*}`; `next.config.ts` (redirects at lines 50-68)
- `src/components/layout/TopHeader.tsx`, `src/hooks/{useWorkerSops,useViewport,useCompletions}.ts`, `src/lib/sop/{worker-signal,placement}.ts`
- `scripts/check-bundle-size.ts`, `.bundle-baseline.json`, `scripts/dropped-features.json`, `scripts/eval-fixtures.mjs`, `playwright.config.ts`, `tests/evals/*`, `tests/phase26/konva-worker-isolation.spec.ts`, `tests/phase52/plant-render-seam.spec.ts`, `tests/lint/no-dead-internal-hrefs.spec.ts`
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md`; `.planning/sketches/008-one-screen-site/index.html` (room geometry); `.planning/sketches/007-plant-floor-navigation/assets/plant.jpg` (2752x1536)
- Live read-only queries against the project Supabase (service role): `site_layouts` (real org 2752x1536 `scene.jpg`, 13 machines incl. "Office terminal"; eval-site org 1600x900 `scene.png`, 1 machine), `departments` (real org: General, Forming, Engineering), `sops` status/placement counts.
- `.planning/codebase/CAPABILITY-MATRIX.md`

### Secondary (MEDIUM)
- Next.js proxy/redirect ordering (headers -> `next.config` redirects -> proxy) from prior knowledge of Next 15/16 docs [ASSUMED for 16.2.1 exactly; the repo's own Phase 43 note at `next.config.ts:38-47` documents the `/admin/sops` -> `/sops` -> proxy chain working]

### Tertiary (LOW)
- none relied upon

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new; versions from package.json
- Architecture: HIGH for stage/data/redirect mechanics (read from source); MEDIUM for room coordinates (need a screenshot pass) 
- Pitfalls: HIGH - each tied to a file/line or a live query; Pitfalls 1-3 are scope findings contradicting or extending CONTEXT and need a plan-level decision

**Research date:** 2026-10-04
**Valid until:** ~2026-10-18 (fast-moving repo; Phases 58+ will touch the same files)
