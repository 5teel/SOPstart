# Phase 57: The One Screen & Its Places - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **shell every later phase mounts into**: after sign-in, every user lands on one screen — a list on the left (256 px), the isometric site in the middle, a detail panel on the right (400 px, always present) — and **no header navigation exists anywhere**. Four fixed rooms (Office, Smoko room, Workshop, Noticeboard) stand on the existing scene beside the machines, signposted by name at every zoom; any place is chosen from the map or from the list with identical results (highlight → camera → detail; Esc → overview + refit). A machine lists its SOPs with a status badge each (worker: Walk; admin: Walk · Edit · new SOP for this machine); the Noticeboard does the same for `placement = 'site'` SOPs. Pins show due counts (worker) or no-owner / overdue-review (admin) plus a count on the Office and Workshop. Search filters the list and lights matching shapes (machine names + the titles of the SOPs on them). The list leads with one "next for you" card. Admins switch the site into edit mode from the map to add / rename / reshape / remove machines and manage departments there.

**Retired in this phase (deleted + redirected, added to the dropped list):** the worker plant home as a separate page, the admin library table, the dashboard, the header navigation, the departments screen (`/admin/departments`). **Bridged, not re-homed:** Office (→ Phase 59), Smoko room and Workshop (→ Phase 61). **Untouched until Phase 58:** `/sops/[sopId]` (Read/Walk tabs) and `/admin/sops/builder/[sopId]` — the shell's Walk/Edit actions link to them.

Builds on the v10.0 scene renderer (`PlantStage`), pins, `MachinePanel`/`AdminMachinePanel`, `NowCard`, and `SiteEditor` — reused and re-homed, never rebuilt. Desktop-only (PROJECT.md anti-goal: no phone layout).

Requirements: SHL-01, SHL-02, SHL-04, SHL-05, PLC-01, PLC-02, PLC-03, PLC-04, PLC-05. (SHL-03 overview content and SHL-06 wide-detail are Phases 60/59; SHL-07 address certification is Phase 62 — but every place gets a `?place=` address here so Phase 58's Back works.)

</domain>

<decisions>
## Implementation Decisions

### Rooms on the drawing (PLC-01)
- **D-01 — No room design or room configuration this phase.** *(Simon, 2026-10-04: "Leave room design and config out of this build. We will use the existing design and allow you to decide the clickbox areas as you see fit.")* The existing site scene (the v10.0 `site_layouts.scene_path` image, or the sketch-007 scene where an org has none) is used as-is; the four rooms are **fixed hit-areas with a signpost** whose positions Claude chooses over sensible spots on the current scene. There is **no admin UI to position, resize or restyle a room**, no room table/column, and no room artwork work. The roadmap/PLC-01 clause "an admin can position each room's shape in the site editor" is **deferred** (see Deferred Ideas) — the verifier must treat it as deliberately descoped by the owner, not as a gap.
- **D-02 — Rooms are always signposted; machines label on hover** (contract). Signposts counter-scale with zoom (`--inv` pattern in one-screen-site.md § CSS). A room's hit-area carries a faint dashed outline at rest (`.hs.room` pattern) so it is discoverable without artwork.
- **D-03 — Workers see all four rooms and can open each with the contract's reduced view** (Office: my requests · my sign-offs; Smoko room: my record; Workshop: "Ask for a change"; Noticeboard: site SOPs). Where the reduced view's data type does not exist yet (requests — Phase 60), the panel says so in one plain line; rooms never disappear from the map for any role. *(Claude's call; contract Q3 resolved toward the contract table.)*

### Detail pane with nothing selected + the Now card (SHL-05, PLC-04)
- **D-04 — Empty detail pane = site summary.** Site name; counts of machines, published and draft SOPs; the role-aware count (worker: SOPs due for me; admin/supervisor: no-owner + overdue-review + waiting sign-offs); one hint line ("Select a place on the site or in the list"). Phase 60 replaces this with the real overview (objectives · notifications · requests) — build it as one small component so the swap is a one-file change.
- **D-05 — The admin "things waiting in the Office" count = today's governance inbox rows, exactly as the existing inbox counts them** (SOPs with no owner, overdue reviews, pending approvals, completions awaiting sign-off, machines with no procedures — `admin-health.ts` / the Phase 54 inbox source). The Office pin shows the **same number**; one query feeds both.
- **D-06 — Supervisors get the admin-style Office card**, where the count is the completions awaiting their sign-off (and nothing else they cannot act on). Workers keep the existing `NowCard` (next SOP due, Walk it · Show me).

### Departments as zones only (PLC-05)
- **D-07 — A department stays a name + colour; its zone is the hull of the machines assigned to it** (today's model — `site_machines.department_id` → `departments`, tinted by `zoneColour`). **No department polygon, no new geometry, no new table.** Clicking a department in the list tints and frames its machines (contract behaviour note).
- **D-08 — Department CRUD lives inline in the site editor's edit mode**: a small "Departments" strip to add · rename · recolour · delete (delete refused while any machine or SOP visibility rule still references it, with the count shown). The machine form picks from that list (and can create one in place). `/admin/departments` is deleted and redirected.
- **D-09 — Per-person department membership (`member_departments`) moves to `/admin/team` unchanged** (the same picker, same server action), because it feeds access visibility that must keep working; Phase 59 re-homes the team page into Office → People & roles. Access wiring (`access_grants`, department visibility RLS) is untouched, as in 56 D-10.

### Bridges + retired URLs (SHL-01, bridges rule)
- **D-10 — `/` is the one screen for a signed-in user.** Signed-out `/` keeps today's landing (Log In). Sign-in lands on `/`. Every retired entry point 307-redirects there **in the proxy (`src/lib/supabase/middleware.ts`) or a server component — never a client `useEffect` + `router.replace`** (CLAUDE.md [2026-09-29] Next 16.2.1 action-queue freeze): `/sops` (list), `/dashboard`, `/governance` (admin home + `?view=attention|library`), `/admin/departments`, `/admin/site` → `/?place=edit` (opens edit mode). `roleHome()` in the middleware returns `/` for every role.
- **D-11 — Every place has an address: `/?place=<token>`** where token is a machine id, `office`, `smoko`, `workshop`, `noticeboard`, `dept:<id>` or `edit`. Selecting from map or list updates the URL with `history.replaceState` (no router push — CLAUDE.md [2026-05-13] hot-path rule); loading a `?place=` URL selects it on mount. Phase 58's Back returns to `/?place=…`.
- **D-12 — Bridges this phase:** the Office detail panel summarises inbox counts and opens `/governance` (the inbox page survives until Phase 59); the Smoko room panel summarises my completions and opens `/activity`; the Workshop panel lists this org's **draft SOPs** (title · state · open in builder — the "Drafts" tab Phase 61 formalises) plus a "Write a new SOP" button that opens `/admin/sops/new`. Each bridged page loses the header and gains one plain **"Back to the site"** link (to `/?place=<room>`). A bridge is summary + one link — never a second navigation.
- **D-13 — The admin library table is retired without a replacement list**: site SOPs are on the Noticeboard, machine SOPs on their machines, drafts in the Workshop bridge, and search covers machine names + titles of placed SOPs. A draft that is neither placed nor in the Workshop list is unreachable by design only if it does not exist — the Workshop list is *all* drafts in the org.

### Decided at planning from research findings (orchestrator, 2026-10-04 — 57-RESEARCH.md Pitfalls 1–3, 6, 7, 9, 14 + Open Questions)
- **D-14 — Access wiring gets a thin bridge, not deletion.** `AdminAccessLens` is mounted only by the retired library table. Add `src/app/(protected)/admin/access/page.tsx` (`requireAdminContext`, mounts `AdminAccessLens` with `pinnedSopId` from `?sop=`); the proxy maps `/sops?view=access[&sop=]` to it; the builder's three in-app hrefs repoint; the Office panel links "Access". Phase 59 re-homes it.
- **D-15 — What replaces the header.** (a) ONE `BackToSite` bar rendered by `(protected)/layout.tsx` for every wrapped route, destination from a pure `placeForPath(pathname)` (`/governance`, `/admin/team`, `/admin/access`, `/admin/settings` → `office`; `/activity*` → `smoko`; `/admin/sops/new*`, `/admin/sops/upload` → `workshop`; everything else → `/`); Phase 58's focus bar replaces it. (b) A quiet account control at the foot of the list pane: email · Profile · Sign out (admins also get Pathways / Feedback there). (c) The Office panel body links People & roles (`/admin/team`), Access (`/admin/access`), Settings (`/admin/settings`). An account control is not navigation; the "no header nav" rule stands.
- **D-16 — Office number = `deriveInbox(...).length`**, identical to `/governance`'s "N open" via one shared `loadInbox()`; the Office pin and card read the same value. Completions awaiting sign-off are a SEPARATE line in the Office panel linking `/activity`, never inside the pin number. Supervisor (D-06) number = their pending-sign-off count only. This refines D-05's row list to what the code has.
- **D-17 — `/governance` survives as the Office bridge page** (D-12 wins over D-10's literal list). Only its legacy entry points redirect: `/governance?view=library` → `/`; `/sops?view=attention` → `/governance` (existing rule kept); `/sops?view=access` → `/admin/access` (D-14); bare `/sops` → `/`.
- **D-18 — Rooms render above machines.** The real org's "Office terminal" machine sits where the Office room goes; the room wins the click, the machine stays selectable from the list, and the owner may remove it in edit mode. No data migration.
- **D-19 — "New SOP for this machine"** links `/admin/sops/new/blank?machine=<id>`; the blank wizard reads `?machine=` and calls the existing `setSopMachines` after creation. Nothing more this phase.
- **D-20 — Noticeboard content**: published `placement='site'` SOPs for every role; admins additionally see a DRAFT-badged tail. The Workshop bridge list remains ALL drafts in the org (D-12/D-13). `useWorkerSops` adds `placement` to its select.
- **D-21 — Phone: no design work.** Always render the three-pane grid (never branch first render on `useViewport`); below 1024px collapse via CSS only (stage hidden, list then detail).
- **D-22 — Department "Remove" = refusal-checked archive.** Before archiving, count non-archived `site_machines` and `sop_departments` rows for that department (session org id only); refuse with `{machines, sops}` when either > 0 and show the counts. `code` is derived from the name inside the action (uppercase initials, de-dup suffix); colour comes from the existing 8-value enum. Archive semantics kept.

### Claude's Discretion
- Exact room hit-area coordinates and sizes on the existing scene (D-01); whether they are stored as constants or a JSON file in `src/lib/site/` (no DB).
- Badge vocabulary on SOP rows: reuse `RelBadge` for workers (due · updated · never done); admin rows add draft / published / no owner / review overdue — the planner picks the minimal set that satisfies PLC-02 without inventing a status model.
- How the three panes are composed from the existing `PlantHome` / `PlantStage` / `MachinePanel` / `AdminMachinePanel` / `NowCard` / `SiteEditor` (what moves, what is wrapped) and how edit mode is entered from the map (a button on the stage is the obvious choice).
- The exact pane-resize behaviour (`ResizeObserver` → refit on the selected place; guard the 0×0 hidden stage).
- Keyboard: Esc clears selection and refits; nothing else is required.
- What the dropped-list entries look like for this phase's deletions (follow `scripts/dropped-features.json` from Phase 55).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (governs)
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` — the MVP shell contract: § "Layout — three panes (winner A)", § "Places → what lives there" (room tabs per role — the reduced worker views in D-03), § "CSS patterns" (grid columns, `--inv` counter-scaled signposts, `.hs.room` outline, standards as quiet label), § "Behaviour notes" (refit on resize, search lights shapes, department click frames machines), § "What to avoid" (no header nav, no second set of destinations, no sheets over the map). § "The focus rule" is Phase 58 — do not build it here, but leave the `/?place=` address it returns to.
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` — still the contract for the scene renderer, pins, badges, machine panel and zone colours (per the supersession table in one-screen-site.md). Superseded parts (phone/QR, voice ask bar, inbox as a separate page, library table) are NOT built.
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — load via `Skill("sketch-findings-SOPstart")` before any UI work (CLAUDE.md auto-load rule); read `references/one-screen-site.md` first.
- `.planning/sketches/MANIFEST.md` — 2026-10-02 / 2026-10-03 entries record the winner-A decision verbatim.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` § v11.0 — SHL-01, SHL-02, SHL-04, SHL-05, PLC-01..05 (lines ~982–996); the "Regenerating the site artwork" out-of-scope row (~1079) that backs D-01.
- `.planning/ROADMAP.md` § "Phase 57" (goal, five success criteria, UI hint: yes) and § "Bridges" / "Placement notes" under the v11.0 sequencing rationale (why SHL-03/06/07 are elsewhere, what a bridge is).

### Prior phase artefacts
- `.planning/phases/56-a-simpler-sop-the-decision-ledger/56-CONTEXT.md` — D-09 `sops.placement`, D-10 department derived for display only, D-11/D-12 standards labels (render as quiet labels on SOP rows where shown).
- `.planning/phases/56-a-simpler-sop-the-decision-ledger/56-09-SUMMARY.md` — `src/lib/sop/placement.ts` + `StandardLabels` + "Whole site" control in `BuilderMachinesButton`; the `useSopDetail` embeds for placement.
- `.planning/phases/54-admin-inbox-floor-health-library-table/54-CONTEXT.md` — the inbox row model D-05 counts; the library table being retired.
- `.planning/phases/55-cut-the-dropped-features-one-organisation/55-REVIEW.md` — post-cut state; `scripts/dropped-features.json` is the model for this phase's dropped-list entries.
- `.planning/codebase/CAPABILITY-MATRIX.md` — must be updated for: department CRUD moving into the site editor, member-department editing moving to the team page, the Workshop drafts list (admin-only), room panels per role.

### Project rules that bite here
- `CLAUDE.md` § Learnings — [2026-09-29] never navigate from a mount effect while mount-time server actions fire (redirects go in the proxy / server component — D-10); [2026-05-13] `history.replaceState` for hot-path URL state (D-11); [2026-09-13] role-gated UI is a separate `next/dynamic` module from day one, worker bundle gate ±2 KB on `/sops` and `/sops/[sopId]` (**the gate's route list must be re-pointed when `/sops` becomes a redirect — a baseline change is a decision artefact, recorded, never re-captured to hide growth**); [2026-09-29] shared eval-site org — assert by name/id, never "exactly N"; [2026-09-29] `useLinkStatus` / loading.tsx expectations; [2026-08-04] a deletion guard asserts absence of REFERENCES, not just the file — grep every `href`/`router.push` to a retired route.
- `## Pathways Map Maintenance` — `src/lib/journeys/journeys.ts` rewritten for the one screen in the same change; `/pathways` must show 0 not-mapped.
- `## Deployed-site evals` — `tests/evals/plant-home.eval.ts` (Phase 52) and `governance.eval.ts` (Phase 54) read the eval-site org this phase re-homes; extend/replace them rather than leaving them asserting a dead page.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/sop/plant/PlantStage.tsx` (371 lines) — the isometric renderer: fit / zoom-to-cursor / fly-to / department-chip fit, pins, hover labels; `src/lib/site/scene.ts` — `fitView`, `flyToView`, `fitBoxView`, `zoneColour`, `ZOOM_MIN/MAX`, `PLANT_PANEL_WIDTH`, `CAMERA_MS`. The middle pane is this component with a room layer added.
- `src/components/sop/plant/PlantHome.tsx` + `NowCard.tsx` + `RelBadge.tsx` + `MachinePanel.tsx` — the worker home today (`/sops`); the list pane and the worker detail pane come from here.
- `src/components/admin/governance/AdminMachinePanel.tsx` — admin machine detail (owner, review, Walk/Edit); `src/lib/.../admin-health.ts` — the inbox/health counts D-05 reuses.
- `src/components/admin/site/SiteEditor.tsx` / `SiteWorkspace.tsx` / `SiteEmptyState.tsx` — the Konva polygon editor and machine form; edit mode re-homes these into the middle pane (D-08 adds the departments strip).
- `src/actions/site.ts`, `src/actions/site-worker.ts` (`listSiteForWorker`), `src/lib/validators/site.ts` (`SiteDepartment`), `src/app/api/admin/site/*` — the site data layer; `departments` (00035, has `colour`) + `member_departments`.
- `src/lib/sop/placement.ts`, `src/components/sop/StandardLabels.tsx` (Phase 56) — placement line and standards labels for SOP rows.
- `src/components/layout/TopHeader.tsx`, `PageShell.tsx`, `NotificationBadge.tsx`, `NavPendingSpinner.tsx` — the header to delete; `(protected)/layout.tsx` mounts it.
- `src/lib/supabase/middleware.ts` — `roleHome(role)`, the existing `/sops?view=attention → /governance` proxy redirect (the idiom for D-10).
- `scripts/dropped-features.json` + its sweep spec (Phase 55) — add this phase's deletions there.

### Established Patterns
- Role gating via `useIsAdmin()` + a single `next/dynamic({ ssr:false })` admin module (`AdminSopSurface` precedent) — the admin-only parts of the shell (edit mode, drafts list, health pins) follow it.
- React Query hooks over server actions (`useWorkerSops`, `['site-worker']`); one query per concern, invalidate on write.
- Design tokens only (`blueprint-theme.css`); `text-accent-*`, `bg-paper`, `border-ink-200`; radius vocabulary of four; `min-h-tap` targets.
- Source-contract specs per phase in `tests/phase<N>/` registered in `playwright.config.ts`; deployed eval per UI phase in `tests/evals/`.
- Legacy-URL redirects live in the proxy (`middleware.ts`) or a server component.

### Integration Points
- `(protected)/layout.tsx` — drops `TopHeader`; the one screen is `src/app/(protected)/page.tsx` or `src/app/page.tsx` branching on session (D-10: signed-out `/` keeps the landing).
- `/sops/[sopId]?tab=walk|read` and `/admin/sops/builder/[sopId]` — targets of Walk / Edit on SOP rows (unchanged until 58); `/admin/sops/new` — Workshop bridge's "Write a new SOP" and the machine panel's "new SOP for this machine" (pass `?machine=<id>` so placement is pre-filled where the wizard supports it, otherwise plain).
- `/governance`, `/activity`, `/admin/sops/new`, `/admin/team` — bridged pages: header removed, "Back to the site" link added, otherwise untouched.
- Eval fixtures: eval-site org has one layout, two machines (incl. "EVAL Oven"), the convert fixture SOP (site-wide) and the walk fixture SOP; `tests/evals/plant-home.eval.ts`, `governance.eval.ts`, `sop-ledger.eval.ts` read them.
- `src/lib/journeys/journeys.ts` (70 routes today) — rewrite around the one screen; `src/lib/uat/tests.ts` updated for anything worth team review.
- `scripts/check-bundle-size.ts` + `.bundle-baseline.json` — route list changes when `/sops` becomes a redirect (see CLAUDE.md rule in canonical refs).

</code_context>

<specifics>
## Specific Ideas

- "Leave room design and config out of this build. We will use the existing design and allow you to decide the clickbox areas as you see fit." — Simon, 2026-10-04. Rooms are click targets on the existing scene, nothing more, this phase.
- The Office pin and the Office Now card must show the **same number** from one query — a pin that disagrees with the card is a bug.
- A bridge is "summary + one plain link + Back to the site" — never a second navigation, never a header.
- Every place has a URL (`/?place=…`) so Phase 58's focus screen can come back to it with the place still selected.

</specifics>

<deferred>
## Deferred Ideas

- **Admin positioning of room shapes in the site editor** (PLC-01 clause, contract Q2) — deferred by Simon's D-01 call; revisit when the scene is regenerated with rooms drawn in (needs image-generation credit) or when a real site asks for it. Rooms are fixed hit-areas until then.
- **Site overview in the empty detail pane** (objectives · notifications · requests, SHL-03) — Phase 60; D-04's site summary is the placeholder.
- **Wide detail pane for tables** (SHL-06) — Phase 59 (ledger, people & roles, access).
- **Office tabs, inbox-as-panel, decision ledger view** — Phase 59; this phase bridges to `/governance`.
- **Workshop four on-ramps, Drafts tab proper, Standards manager mount, AI model settings** — Phase 61; this phase lists drafts in the bridge and links to `/admin/sops/new`.
- **Smoko room (training matrix, observations, my record)** — Phase 61; this phase bridges to `/activity`.
- **Focus rule / Back from an open SOP** — Phase 58; this phase only provides the `?place=` address.
- **"… · logged in the decision ledger" copy on governance actions** — lands with the rooms (59/60/61).
- **Department as its own drawn polygon** — declined (D-07); revisit only if hull-of-machines proves unreadable on a real site.
- **Certifying every old address redirects + the dropped-feature build guard** — Phase 62; this phase adds its deletions to the dropped list and redirects its own retired routes.

</deferred>

---

*Phase: 57-the-one-screen-its-places*
*Context gathered: 2026-10-04*
