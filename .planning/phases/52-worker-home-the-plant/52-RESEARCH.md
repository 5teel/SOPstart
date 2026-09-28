# Phase 52: Worker Home — The Plant - Research

**Researched:** 2026-09-28
**Domain:** Next.js client-rendered canvas/SVG scene navigation, derived worker signal aggregation, bundle isolation
**Confidence:** HIGH (all claims verified against live source in this repo — no external library research needed; this phase composes existing Phase 51/15/26/41 infra)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: The worker home is a **client component tree loaded through `next/dynamic({ ssr:false })`** from `src/app/(protected)/sops/page.tsx`, rendered INSTEAD OF `SopsSection`'s Miller frame when `!isAdmin && viewport ≥ 1024px && org has a site layout`. Admins keep the current surface unchanged this phase (54 replaces it). Below 1024px the existing stacked worker list renders unchanged.
- D-02: **No Konva for the worker.** The read-only scene is an `<img>` at natural size inside a transformed `world` div with an SVG polygon overlay — exactly the sketch's approach (`.planning/sketches/007-plant-floor-navigation/index.html`). Konva stays admin-only (Phase 26/51 isolation gates). The bundle cost is the transform maths and one SVG.
- D-03: Scene image via the same signed-URL helper Phase 51 uses (`site-scenes` bucket, 3600 s TTL), fetched by a server action (`listSiteForOrg` already returns the layout + machines for admins — add or reuse a **worker-readable** variant that returns only what the worker needs: layout id, signed scene URL, width/height, machines `{id, name, department_id, polygon}`; RLS already allows same-org SELECT).
- D-04: **Fallback**: if the org has no layout, or the layout has zero machines, the worker sees today's list exactly as now (the frame with "Your SOPs / Library / By department"). Never a blank. The Now card may still render above the list when there is something due.
- D-05: Pins are **derived, never stored**. Source = the same data `useAssignedSops` / the worker list already computes per SOP (`isAssigned`, refresher-due, updated-since-read, never-done) joined to `sop_machines`. A source-contract test pins that no new table, store or column backs the count (grep: no `pin` column in migrations, no new Zustand store, no Dexie table).
- D-06: Pin = count of that machine's SOPs where `rel ∈ {due, never, new}` for the viewer (sketch vocabulary: `DUE` amber · `UPDATED` blue · `NEVER DONE` red · `DONE` outlined grey). Machines with a pin get the dashed amber polygon tint and show their label on world-hover; machines without a pin show label on hover only. Counts appear ONLY on pins — no decorative counts anywhere (contract "What to avoid").
- D-07: Fit = `min(W/sceneW, H/sceneH) x 1.02`, centred; **re-measure on every fit** (a stage built while hidden measures 0x0 — bug found in the sketch, twice). Wheel zoom toward cursor, clamp 0.35-2.4. Drag-pan on the world, ignoring drags that start on a polygon. Fly-to on machine click: scale 1.5, target point offset left so the 380 px panel never covers it (`targetX = (W - 380) / 2`). Department chips tint that department's polygons and fit the camera to their bounding box (`min((W-80)/bw, (H-120)/bh, 1.6)`). Transitions 350 ms ease; `prefers-reduced-motion` -> no transition.
- D-08: Pan/zoom state is **`useState` + `window.history.replaceState`** if any URL sync is wanted (CLAUDE.md 2026-05-13: never `router.push` on a hot path). Default: no URL sync in this phase.
- D-09: Never derive first-render output from `window`/`navigator` (2026-06-08 hydration): the stage mounts with a neutral transform and fits in an effect.
- D-10: Bottom-left over the scene, 330 px, ink-900 border. `NEXT FOR YOU` + badge, title, mono meta (machine, department, ~min, last done), **Walk it** (primary -> the existing SOP page `/sops/[sopId]?tab=walk`), **Show me** (fly to the machine and open its panel), "Then:" up to two more lines. Ordering: due -> never done -> updated -> nothing (card hidden, or shows "Nothing due -- browse your machines"). The card's data is the same derived list as the pins.
- D-11: Right, 380 px, slides in. Sprite (from `site_machines.sprite_path`, signed) or "no photo yet", department name in its zone colour, machine name, SOP rows **to-do first** with the shared badge set, `Walk >` per row (-> `/sops/[sopId]?tab=walk`; plain `Read` -> `/sops/[sopId]`). Empty: "No procedures for this machine yet." Close -> fit. No admin controls, no owner/rev lines (54 adds the admin variant).
- D-12: Zone colours from the department row's `colour` when set, else the contract's fallback triple (Forming `#ea580c`, General `#2563eb`, Engineering `#7c3aed`) — but expressed as tokens/inline `var()` per the design-token lint, never raw hex in component code.
- D-13: The existing toolbar search input becomes the ask bar on the plant view: as the worker types, machines whose name or any linked SOP title matches get the hover tint + label; the list inside an open panel narrows too. The mic button routes to the **existing** voice Q&A entry (find the current voice component/hook used on the SOP page — do not build a new voice path). If no voice entry exists at list level, the mic opens the SOP-level voice on the Now card's SOP; state that choice in the plan.
- D-14: `scripts/check-bundle-size.ts` gates `/sops/page` at +-2 KB against `.bundle-baseline.json` (unchanged since 736f44a — **never recapture**; 2026-09-13). Everything new is inside the dynamic module; the page adds only the gate condition and the render slot. The scene `<img>` is `loading="lazy"` and `decoding="async"`.
- D-15: `tests/phase52/` project (register in `playwright.config.ts`, verify with `--list`). Source-contract specs: dynamic import + `ssr:false`; no Konva import anywhere under the worker home dir (extend `konva-worker-isolation.spec.ts` to forbid it there); no new store/table for pins; camera maths constants (1.02, 0.35, 2.4, 380) present; Now-card ordering pure function unit-tested under `src/lib/site/__tests__/` (phase15-unit style, static imports).
- D-16: Deployed eval `tests/evals/plant-home.eval.ts` as `eval-worker@sopstart.com` **in the eval-site org** (Phase 51's `eval-site-admin` org, fixture SOP linked to "EVAL Press") — assert: scene renders (img natural size known), at least one polygon, pin count on EVAL Press >= 1 once the fixture SOP is assigned to the eval worker, click -> panel lists the fixture SOP with a badge, Walk it href is `/sops/<id>?tab=walk`, department chip fits camera (transform changes), no scope column (`worker-miller-scope` testid absent), no console errors; 1440x900 screenshots read by the orchestrator. Worker with NO site (the real SOPstart org's `eval-worker`) still sees the list — second test.

### Claude's Discretion

- Whether the derived-pin computation lives in a hook (`usePlantPins`) or a pure function fed by `useAssignedSops` — pure function preferred (unit-testable).
- Whether the dynamic module is one file or a small folder `src/components/sop/plant/`; keep Konva out either way.
- Exact label pill styling and pin animation (sketch: 26 px circle, 1.6 s bob) — tokens only.

### Deferred Ideas (OUT OF SCOPE)

- Phone home + QR (53). Admin repaint, inbox, table, lens deletion (54). URL sync of camera state. Sprite generation per machine. Multi-site picker.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOM-01 | `/sops` for a worker on desktop renders the site scene with pan, zoom-to-cursor, department fly-to and tappable machines — no scope column, no Miller frame | Pattern 3 (render seam), `useViewport()` reuse, `src/lib/site/scene.ts` pan/zoom math already ported |
| HOM-02 | Each machine carries a derived pin: the count of that machine's SOPs due / never done / updated for the viewer; pins are computed, never stored | Pattern 2 (signal reuse) + Code Example (`derivePlantPins`/`plantRelState`) + Pitfall confirming no existing table/store to extend |
| HOM-03 | A Now card shows the single next procedure (due first), with Walk it and Show me (fly the camera to the machine and open its panel) | Pattern 2/3 + Architecture diagram (Now card sharing the same derived list as pins) |
| HOM-04 | Clicking a machine flies to it and opens a panel listing its SOPs to-do first with the shared badge vocabulary; Walk it opens the existing SOP page | `SopWorkerBrowser` badge vocabulary reuse (Pattern 2), `scene.ts` fly-to constants, Pitfall 5 (fit re-measure) |
| HOM-05 | The ask bar highlights machines and SOPs as the worker types and is the entry point for the existing voice Q&A | Open Question 1 (voice routing decision), confirmed no list-level voice entry exists — `WalkthroughVoiceModal` is SOP-scoped |
| HOM-06 | The worker route's First Load JS stays within the SB-LINE-06 budget — the scene renderer is a dynamic import and the scene image is lazy | Pitfall 4 (`/sops/page` bundle gate has no Konva marker group today — must be added), Validation Architecture Wave 0 gaps |
</phase_requirements>

## Summary

Phase 52 replaces the Miller-frame worker view at `/sops` (>=1024px, non-admin, org has a site layout) with a pan/zoom plant scene ported from the validated sketch 007 HTML prototype. Nearly everything needed already exists in the codebase: `src/actions/site.ts` (admin-gated, needs a worker-readable sibling), `src/lib/site/scene.ts` (pure `fitView`/`zoomAt`/`centroid` math already ported from the sketch, framework-agnostic), the `useViewport()` SSR-safe breakpoint hook (exact pattern for D-01/D-09), the `SopWorkerBrowser` badge/signal vocabulary (`topSignal`, `TONE`) to reuse rather than fork, and the Phase 41 `next/dynamic({ssr:false})` render-slot pattern already used for `AdminSopSurface`.

The two genuine gaps are: (1) no worker-readable server action exists yet — `listSiteForOrg` is `requireAdminContext()`-gated, but RLS SELECT policies on all three site tables are already org-scoped for every authenticated role, so a new thin worker action is a straightforward addition, not a schema change; (2) the eval fixture plan in CONTEXT.md D-16 assumes an `eval-worker@sopstart.com` account inside the isolated eval-site org, but no such account exists — `eval-worker@sopstart.com` is a member of the real SOPstart org only, and the eval-site org's only fixture SOP is a **draft**. Both must be fixed in `scripts/eval-fixtures.mjs` before the eval can pass.

**Primary recommendation:** Build the plant module as a client-only `next/dynamic({ssr:false})` tree under `src/components/sop/plant/`, import Konva-free (raw SVG polygons over an `<img>`, exactly like the sketch — Konva stays admin-only per D-02), reuse `src/lib/site/scene.ts`'s pure geometry functions and `SopWorkerBrowser`'s `topSignal`/`TONE` classifier verbatim, gate the render seam in `sops/page.tsx` with the existing `useViewport()` hook + a new worker-readable `listSiteForOrg` variant, and extend `check-bundle-size.ts`'s `/sops/page` forbidden-marker list with a Konva marker group (currently `/sops/page` has no Konva check at all — only `/sops/[sopId]/page` does).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scene render (pan/zoom/fly-to/polygons) | Browser / Client | — | Pure canvas-in-DOM transform math, no server round-trip after initial fetch; matches existing `SiteEditor`/Konva precedent of being entirely client-side |
| Pin/signal derivation (due/never/updated counts per machine) | Browser / Client | — | Derived, never stored (D-05) — same tier as today's `topSignal()`/`refresherState()` computed in `sops/page.tsx`, which already runs client-side over `useAssignedSops` + TanStack Query data |
| Site data fetch (scene URL, machines, polygons) | API / Backend (server action) | — | New worker-readable `src/actions/site.ts` export — session-client, RLS-gated, no admin check; mirrors `listSiteForOrg`'s existing shape minus the `requireAdminContext()` call |
| Now-card ordering (due -> never -> updated -> nothing) | Browser / Client | — | Pure function over the same derived list the pins use (D-10) — no new server logic |
| Scene image | CDN / Storage | — | Supabase Storage signed URL (`site-scenes` bucket, 3600s TTL) — unchanged from Phase 51's `listSiteForOrg` pattern |
| Voice Q&A entry (ask-bar mic) | Browser / Client | API (existing `/api/voice/query`) | Routes into the existing SOP-scoped voice modal (no new voice infra); the modal itself already calls the API |
| Bundle isolation | Build tooling | — | `check-bundle-size.ts` (postbuild gate) + `konva-worker-isolation.spec.ts` (source-contract) — both already exist, need extension not creation |

## Standard Stack

No new packages. This phase composes:

| Module | Role in Phase 52 |
|--------|-------------------|
| `src/lib/site/scene.ts` | `fitView`, `zoomAt`, `centroid`, `clampPoint`, `polygonWithinScene` — pure, already ported from the sketch's pan/zoom math (lines 343-354 of `index.html`), framework-agnostic, directly reusable |
| `src/lib/validators/site.ts` | `SiteMachine`, `SiteLayout`, `SiteDepartment`, `Point`, `Polygon` types — reusable as-is for the worker read shape (subset of fields) |
| `src/hooks/useViewport.ts` | SSR-safe `'mobile' \| 'desktop'` breakpoint hook, exact pattern needed for D-01/D-09 (mounts neutral, corrects in effect — no hydration mismatch) |
| `src/components/sop/SopWorkerBrowser.tsx` (`topSignal`, `TONE`, `rowMeta`) | The shared badge/signal classifier (2026-09-27 rule: one classifier, not two) — import these functions directly rather than reimplementing rel-state logic |
| `next/dynamic({ssr:false})` (Next.js built-in) | The render-slot pattern already proven by `AdminSopSurface` (Phase 41) and `SiteEditorLoader` (Phase 51) |

**Installation:** none required.

**Version verification:** N/A — no new dependencies.

## Package Legitimacy Audit

Not applicable — this phase installs zero new packages. All work composes existing installed dependencies (React, Next.js, Supabase client, TanStack Query — all already in `package.json`).

## Architecture Patterns

### System Architecture Diagram

```
Worker opens /sops (>=1024px, !isAdmin)
        |
        v
useViewport() -> 'mobile' (SSR + first paint, matches server render)
        |  (client effect corrects after mount)
        v
'desktop' + !isAdmin + org-has-site-layout?
        |                              |
       YES                             NO
        |                              |
        v                              v
next/dynamic(PlantHome) mounts    existing SopsSection (Miller frame)
        |                         renders unchanged (fallback, D-04)
        v
listSitePlantForOrg() [new worker-readable server action]
  -> { layout, machines, departments, sops-link-map }
        v
useAssignedSops() + existing lastCompletionMap/sopMetaMap queries
  -> per-SOP { isRefresherDue, isRefresherOverdue, hasNewerVersion, lastCompletedAt }
  (reuse the SAME derivation already in sops/page.tsx SopsSection — do not refork)
        v
derivePlantPins(machines, sop_machines links, per-SOP signals)
  -> Map<machineId, { count, worstTone }>
        v
   +----+---------------------+-------------------+
   v                          v                    v
Scene renderer            Now card             Machine panel
(SVG polygons over        (due-first pick,     (on machine click,
 <img>, pan/zoom,          Walk it / Show me)   fly-to + SOP rows,
 dept chips, ask bar                             shared badge set)
 highlight)
        |
        v
Walk it / Read links -> existing /sops/[sopId]?tab=walk or /sops/[sopId]
Ask-bar mic -> existing WalkthroughVoiceModal, SOP-scoped to Now card's SOP
              (opened directly, NOT via the walkthrough page — see Open Questions)
```

### Recommended Project Structure

```
src/components/sop/plant/
├── PlantHome.tsx           # top-level client tree, next/dynamic entry point
├── PlantScene.tsx          # <img> + SVG polygon overlay, pan/zoom/fly-to (D-02, D-07)
├── PlantNowCard.tsx        # bottom-left Now card (D-10)
├── PlantMachinePanel.tsx   # right 380px panel (D-11)
├── PlantAskBar.tsx         # search input + mic routing (D-13)
├── pins.ts                 # pure derivePlantPins()/pickNowCard() — unit-testable (Claude's Discretion: pure fn preferred)
└── plant-fixtures.ts       # (if needed) shared constants: ZONE colours fallback, camera constants
```

Keep Konva out of all of the above — this directory is deliberately absent from `konva-worker-isolation.spec.ts`'s `ALLOWED_DIRS`, so any accidental `import ... from 'react-konva'` here already fails that spec today (allow-list semantics — see Common Pitfalls).

### Pattern 1: Worker-readable site action (new)

**What:** A new export in `src/actions/site.ts` (or a sibling file) that returns the subset of `SiteData` a worker needs, WITHOUT `requireAdminContext()`.
**When to use:** Called from the plant module on mount.
**Verified against live RLS in `supabase/migrations/00067_site_model.sql`:** all three site tables already have org-scoped SELECT policies for EVERY authenticated role (not admin-only) — e.g. `create policy "org_members_can_view_site_layouts" ... using (organisation_id = current_organisation_id())`. No `requireAdminContext()` is needed for the read — just a session client + org filter, matching the pattern `sops/page.tsx` already uses for `sop_departments`. Org id should resolve via the existing session-context pattern (`src/lib/auth/session-context.ts`'s `getSessionContext()`, `React.cache()`'d) rather than `parseJwtPayload`/`atob` (2026-06-26 learning).

**Decision for the plan:** put this in `src/actions/site.ts` alongside the admin actions (D-03 in CONTEXT.md leaves file location to discretion) OR a new `src/actions/site-worker.ts`. Recommend the **new file** — keeps the "every export in `site.ts` starts with `requireAdminContext()`" invariant that the existing source-contract spec (`site-actions-contract.spec.ts`) already asserts positionally; adding a non-admin export to `site.ts` would need that spec's assertion loosened, whereas a new file makes the non-admin-gating obvious from the filename and needs its own (simpler) contract spec.

### Pattern 2: Reusing the signal classifier (2026-09-27 rule)

**What:** `topSignal(sop: WorkerSop)` in `SopWorkerBrowser.tsx` returns `{ label, tone: 'bad'|'warn'|'info' }` from the same `isRefresherOverdue`/`hasNewerVersion`/`isRefresherDue`/`lastCompletedAt` fields `sops/page.tsx` already computes.
**When to use:** Pin/Now-card derivation MUST call this function (or a very thin wrapper over the same `WorkerSop` shape), never reimplement the due/never/updated logic. The CONTEXT.md D-05/D-06 vocabulary (`due`/`never`/`new`) maps directly:
  - `due` -> `isRefresherOverdue || isRefresherDue` -> tone `bad`/`warn`
  - `never` -> `!isAssigned` false + `lastCompletedAt === null` -> today's `topSignal` returns `'Not done yet'` (tone `info`) for this case, which is WEAKER than the sketch's `never` (tone `bad`-adjacent amber). **Reconcile at plan time**: either extend `topSignal`'s tone for the "never done" case, or the plant module can call the underlying booleans directly rather than the label wrapper. Recommend: export a second pure function alongside `topSignal` in the SAME file (`plantRelState(sop): 'due'|'never'|'new'|'done'|null`) that maps 1:1 to CONTEXT.md's `REL` vocabulary — keeps one source file, avoids a second classifier that drifts (the exact bug class the 2026-09-27 learning describes).
  - `new` (updated) -> `hasNewerVersion` -> tone `warn`
  - `done` -> assigned + `lastCompletedAt !== null` + no other flag

### Pattern 3: Render seam in `sops/page.tsx`

**What:** D-01 requires rendering the plant module INSTEAD OF `SopsSection`'s Miller frame when `!isAdmin && viewport >= 1024px && org has a site layout`.
**Verified current code (`src/app/(protected)/sops/page.tsx` lines 226-276):**

```tsx
{isAdmin ? (
  <AdminSopSurface nav={nav} onNavChange={setNav} filter={query}>
    {(admin) => admin.takeoverElement ?? <SopsSection {...sectionProps} admin={admin} />}
  </AdminSopSurface>
) : (
  <SopsSection {...sectionProps} admin={EMPTY_ADMIN} />
)}
```

The worker branch (`<SopsSection {...sectionProps} admin={EMPTY_ADMIN} />`) is the one to gate. Needs:
1. `const variant = useViewport()` (existing hook, import from `@/hooks/useViewport`)
2. A query for "does this org have a site layout" — the worker-readable action's `layout !== null` result, fetched via TanStack Query so it doesn't block first paint
3. `const showPlant = !isAdmin && variant === 'desktop' && hasSiteLayout` — `hasSiteLayout` defaults to `false`/`undefined` (loading) until the query resolves, so the fallback list renders first and swaps in only once we KNOW a layout exists (never a flash-then-hide of the Miller frame, matches D-04's "never a blank" spirit inverted — never a flash of the wrong surface either).
4. `{showPlant ? <PlantHome /> : <SopsSection {...sectionProps} admin={EMPTY_ADMIN} />}` — `PlantHome` is `next/dynamic({ssr:false})`, same treatment as `SopWorkerBrowser`/`AdminSopSurface` above it in the same file.

**Important:** `isAdmin` is resolved server-side in the protected layout (`RoleProvider`, passed via context) and is available synchronously on first client render — confirmed by the existing D-08 comment in `page.tsx` ("computed synchronously since isAdmin is already resolved server-side (CLAUDE.md 2026-06-08 hydration class)"). No hydration risk there. The viewport/layout-existence checks DO need the neutral-then-correct pattern (`useViewport` already does this).

### Anti-Patterns to Avoid

- **Forking the signal/badge classifier.** `SopWorkerBrowser.tsx`'s `topSignal`/`TONE` already IS the shared classifier (2026-09-27 rule); import and extend it, never recompute due/never/updated independently in the plant module.
- **Computing viewport from `window` at first render.** Use `useViewport()` as-is; do not add a second breakpoint hook.
- **Storing pins, counts, or "rel" state in a table/column.** D-05 requires a source-contract test proving no new table/store backs the count — see Common Pitfalls.
- **Using `router.push` for camera state or ask-bar text.** CLAUDE.md 2026-05-13: `useState` + `window.history.replaceState` only, and D-08 explicitly defaults to NO url sync this phase.
- **Reaching for Konva.** D-02 is explicit: raw `<img>` + SVG polygon overlay, exactly like the sketch. Konva stays admin-only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pan/zoom/fit/fly-to math | A new transform library or hand-rolled matrix math | `src/lib/site/scene.ts` (`fitView`, `zoomAt`, `centroid`) | Already ported from the validated sketch, already pure/unit-testable, already used by the admin `SiteEditor` (Konva canvas) for the identical camera behaviour — same constants (0.35-2.4 zoom clamp, 1.02 fit padding) |
| SSR-safe breakpoint detection | A new `matchMedia` hook or CSS-only reveal-hide of two full component trees | `useViewport()` | Exact pattern already proven by `WalkthroughSwitcher` for the identical mobile/desktop full-tree-swap problem |
| Due/never/updated/done classification | A new "plant rel" computation reading `sop_completions`/`sops` directly | `topSignal()`/the booleans already computed in `sops/page.tsx SopsSection` | One classifier, not two (2026-09-27) |
| Bundle isolation gate | A new bundle-size script for `/sops/page` | Extend `scripts/check-bundle-size.ts`'s existing `/sops/page` `GATED_ROUTES` entry with a Konva marker group | The route is already gated; only the forbidden-marker list needs a new group |
| Konva-import leak guard | A new lint spec | `tests/phase26/konva-worker-isolation.spec.ts`'s `ALLOWED_DIRS` allow-list ALREADY excludes any new `src/components/sop/plant/` directory by default (deny-by-default design) — D-15 asks to "extend" it, which in practice means adding an explicit assertion/comment for clarity, not new denial logic |

**Key insight:** This phase is almost entirely composition of Phase 15/26/41/51 infrastructure. The only genuinely new code is the plant rendering module itself (scene SVG, Now card, panel, ask bar) and the worker-readable data-fetch action.

## Common Pitfalls

### Pitfall 1: `listSiteForOrg` is admin-gated — copying it wholesale breaks for workers
**What goes wrong:** If the plant module calls `listSiteForOrg()` directly, every worker gets `{ error: 'Admin access required' }` (via `requireAdminContext()`) since workers aren't `admin`/`safety_manager`.
**Why it happens:** `listSiteForOrg` was built in Phase 51 for the ADMIN editor only; CONTEXT.md D-03 explicitly calls out that a new worker-readable variant is needed.
**How to avoid:** New action (Pattern 1 above), NOT a modification of `listSiteForOrg`'s gate — the admin action must stay admin-gated since its sibling actions (`upsertSiteMachine` etc.) share the file's invariant.
**Warning signs:** A source-contract test failing on "every export in site.ts starts with requireAdminContext()" if the new action lands in the same file without adjustment.

### Pitfall 2: Eval fixture assumes an account that doesn't exist
**What goes wrong:** CONTEXT.md D-16 says the plant-home eval runs "as `eval-worker@sopstart.com` **in the eval-site org**". Verified against `scripts/eval-fixtures.mjs` and `tests/evals/lib/session.ts`: `eval-worker@sopstart.com` is a member of the REAL `SOPstart` org only (`EVAL_ORG_ID`); the isolated `SOPstart Eval Site` org (Phase 51's `eval-site-admin@sopstart.com`'s org) has NO worker fixture at all.
**Why it happens:** D-16 was written assuming an account that would need to be created, but the wording reads as if it already exists.
**How to avoid:** Wave 0 (or the eval-authoring plan) must add a new fixture — e.g. `eval-site-worker@sopstart.com` — as a `role: 'worker'` member of the `SOPstart Eval Site` org in `scripts/eval-fixtures.mjs`, following the exact `eval_fixture: true` metadata guard pattern already used for `eval-site-admin`.
**Warning signs:** The eval's `beforeAll` failing to find a worker session for the eval-site org, or accidentally reusing the real-org `eval-worker` against the eval-site org (which would fail — RLS would return zero rows since that user isn't a member).

### Pitfall 3: The eval-site fixture SOP is a draft, not published
**What goes wrong:** `scripts/eval-fixtures.mjs` creates `Eval site fixture SOP` with `status: 'draft'`. A worker's `useAssignedSops()` query (Dexie, synced from Supabase) only returns SOPs where `status === 'published'` (confirmed: `db.sops.where('status').equals('published')`). A draft SOP will NEVER appear in the pin/Now-card derivation regardless of assignment.
**Why it happens:** The Phase 51 eval only needed the SOP to exist for LINKING (admin-side `setSopMachines` test), not for a worker to see it as due.
**How to avoid:** Either publish the fixture SOP as part of the Phase 52 fixture setup (requires it to pass the publish gate — draft SOPs with no content may not be publishable; check `assertPublishGates`) or create a SECOND fixture SOP specifically for Phase 52 that IS published and has minimal valid content, then assign it to the new eval-site worker.
**Warning signs:** D-16's assertion "pin count on EVAL Press >= 1" failing even after correct assignment wiring — check `sops.status` first.

### Pitfall 4: `/sops/page`'s bundle gate has no Konva forbidden-marker group today
**What goes wrong:** Assuming the existing gate already protects `/sops/page` from a Konva leak. It does NOT — `scripts/check-bundle-size.ts`'s `GATED_ROUTES[1]` (`/sops/page`) currently lists only three marker groups (status lens, governance lens, access lens strings); there is no `konva`/`react-konva` group for this route (only `/sops/[sopId]/page` has one, guarding the walkthrough's annotation viewer).
**Why it happens:** `/sops/page`'s Konva risk didn't exist before Phase 52 — the worker list route never had any reason to import Konva.
**How to avoid:** Add a `{ label: 'konva (D-02)', markers: ['react-konva', 'konva'] }` group to the `/sops/page` entry in `GATED_ROUTES`, matching the existing `/sops/[sopId]/page` pattern exactly. The marker self-validation check (`collectSelfValidationCorpus`) will otherwise FAIL the build if this marker never appears anywhere in the build output — so this only works once Konva legitimately appears elsewhere in the build (which it already does, via `SiteEditor.tsx`/`AnnotationEditor.tsx`), confirmed safe.
**Warning signs:** `npm run build` passing with Konva accidentally statically imported into the plant module — this pitfall is exactly why D-14/D-15 call for both the lint spec AND the bundle gate.

### Pitfall 5: Camera `fit()` re-measure bug (already documented, already fixed in the ported code)
**What goes wrong:** A stage built while its container is hidden (e.g., during the `showPlant` loading-gate window, Pitfall described in Pattern 3 above) measures `0x0`.
**Why it happens:** `clientWidth`/`clientHeight` are 0 for a `display:none` or unmounted element.
**How to avoid:** `fitView()` in `scene.ts` already returns `null` when `!W || !H` (line 67: `if (!W || !H) return null`) — the caller (`PlantScene.tsx`) must handle the `null` case by re-attempting fit in a `ResizeObserver` or on next paint, exactly as the sketch's `fit()` comment documents ("re-measure on every fit — a stage built while hidden measures 0x0, bug found in the sketch, twice"). This is already solved in the ported pure function; just don't bypass it with direct DOM reads.
**Warning signs:** Scene renders at `scale: NaN` or fully zoomed-out/invisible on first load, especially if `PlantScene` mounts before its parent container has final layout dimensions (e.g., during a CSS transition).

### Pitfall 6: Hydration mismatch if site-layout-existence gates first render
**What goes wrong:** If `hasSiteLayout` is read synchronously (e.g., from a prop threaded through SSR) rather than fetched client-side, and the org's site-layout status differs between server-render time and client-hydration time (unlikely but structurally risky), React throws #418 (2026-06-08 learning class).
**Why it happens:** `sops/page.tsx` is `'use client'` with NO server-rendered data props today (everything is TanStack Query / Dexie) — this is actually SAFE by default, since there is no server-injected value to mismatch. Confirm the plan does NOT introduce a server component wrapper that passes `hasSiteLayout` as an SSR prop; keep it a client `useQuery`, matching every other data source on this page.
**Warning signs:** None currently, since the page has no SSR data props — flagging this so the planner does not introduce one.

## Code Examples

### Deriving pins (pure function, matches D-05/D-06)

```ts
// Source: ported from .planning/sketches/007-plant-floor-navigation/index.html
// lines 316 (todo) and 362 (paint), generalised to real data shapes.
export type PlantRel = 'due' | 'never' | 'new' | 'done' | null

export function plantRelState(sop: WorkerSop): PlantRel {
  if (!sop.isAssigned) return null // unassigned SOPs don't pin (D-06: pins are for viewer's own to-dos)
  if (sop.isRefresherOverdue || sop.isRefresherDue) return 'due'
  if (sop.hasNewerVersion) return 'new'
  if (!sop.lastCompletedAt) return 'never'
  return 'done'
}

export function derivePlantPins(
  machines: SiteMachine[],
  links: SopMachineLink[], // sop_id, machine_id
  sopsById: Map<string, WorkerSop>
): Map<string, number> {
  const pins = new Map<string, number>()
  for (const m of machines) {
    const sopIds = links.filter((l) => l.machine_id === m.id).map((l) => l.sop_id)
    const count = sopIds.filter((id) => {
      const rel = plantRelState(sopsById.get(id) as WorkerSop)
      return rel === 'due' || rel === 'never' || rel === 'new'
    }).length
    if (count > 0) pins.set(m.id, count)
  }
  return pins
}
```

### Fit-on-mount with re-measure guard (ports `scene.ts`'s `fitView`)

```ts
// Source: src/lib/site/scene.ts (already in repo) + sketch index.html:344
const containerRef = useRef<HTMLDivElement>(null)
const [view, setView] = useState<View | null>(null)

useEffect(() => {
  const el = containerRef.current
  if (!el) return
  const doFit = () => {
    const v = fitView(el.clientWidth, el.clientHeight, sceneWidth, sceneHeight)
    if (v) setView(v) // null on 0x0 — try again on next observed resize
  }
  doFit()
  const ro = new ResizeObserver(doFit)
  ro.observe(el)
  return () => ro.disconnect()
}, [sceneWidth, sceneHeight])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Miller scope column + list + detail (sketch 005 variant C) | Plant scene + Now card + ask bar (sketch 007) | Decided 2026-09-28 | Phase 52 replaces the WORKER side of the Phase 41 merge only; admin keeps the Miller frame until Phase 54 |
| Kiosk/shared-terminal variant of sketch 007 | Dropped entirely | 2026-09-28 (Simon) | Do not build any kiosk/PIN/avatar-strip code — not in scope, not deferred, simply excluded |

**Deprecated/outdated:** None — this is a net-new UI atop existing data.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The worker-readable site action should live in a NEW file (`src/actions/site-worker.ts`) rather than added to `src/actions/site.ts` | Pattern 1 | Low — either works; if planner prefers the same file, the existing `site-actions-contract.spec.ts` positional assertion (`requireAdminContext()` precedes first query, per-export) needs an explicit exemption for the new export, which is more fragile than a separate file. This is a recommendation, not a verified requirement. |
| A2 | `plantRelState`'s "never" tone (amber, matching sketch's `.badge.never` = red-ish `--accent-hazard`) should be a NEW export alongside `topSignal` in `SopWorkerBrowser.tsx`, not a modification of `topSignal` itself | Pattern 2 | Medium — if the planner instead extends `topSignal`'s own return shape, existing SopWorkerBrowser row rendering (which relies on `topSignal`'s current 3-tone `bad`/`warn`/`info` set) must be re-verified to not regress today's badge appearance for `library`/`not-added` rows. Adding a sibling function is lower-risk. |
| A3 | The fixture-account fix (Pitfall 2/3) belongs in `scripts/eval-fixtures.mjs` as part of THIS phase's Wave 0 or eval-authoring plan, not a prerequisite fixed elsewhere first | Pitfall 2/3 | Low — confirmed by reading the actual fixture script; this is a factual gap, not a guess, but the RIGHT PLACE to fix it (which plan/wave) is a planning decision. |

## Open Questions (RESOLVED 2026-09-28 — Q1: mic opens WalkthroughVoiceModal via next/dynamic inside the plant module; Q2: new file src/actions/site-worker.ts)

1. **Does the ask-bar mic open the voice modal directly, or navigate to the Now-card SOP's walkthrough page first?**
   - What we know: `WalkthroughVoiceModal` requires `sopId` and is currently mounted ONLY inside `WalkthroughSwitcher` (i.e., only reachable once already on `/sops/[sopId]`). There is no SOP-agnostic or list-level voice entry anywhere in the codebase (`src/lib/voice/*`, `src/components/sop/voice/*` both confirmed SOP-scoped).
   - What's unclear: CONTEXT.md D-13 says "the mic opens the SOP-level voice on the Now card's SOP" but doesn't specify whether that means (a) importing `WalkthroughVoiceModal` directly into the plant module (adding it to the worker bundle a second time, redundantly, since it's already dynamic-loaded from the walkthrough route) or (b) navigating to `/sops/[sopId]?tab=walk` and auto-opening the modal there via a query param.
   - Recommendation: (a) is simpler and keeps voice logic in one component; since `WalkthroughVoiceModal` is ALREADY `next/dynamic({ssr:false})`-loaded only on click (not on page load), importing it a second time from the plant module (also dynamic-loaded, also on click) adds a second lazy chunk reference to the same underlying component — Next.js dedupes this to one physical chunk, so there's no meaningful bundle cost. Recommend (a); the plan should state this choice explicitly per D-13's own instruction ("state that choice in the plan").

2. **Worker-readable action: separate file or same file?**
   - What we know: `src/actions/site.ts`'s docstring and its source-contract spec assert EVERY export begins with `requireAdminContext()`. A non-gated worker export breaks that invariant if added to the same file.
   - What's unclear: whether Claude's Discretion in CONTEXT.md ("D-03 ... add or reuse a worker-readable variant") intends file-sharing or a new file.
   - Recommendation: new file (`src/actions/site-worker.ts` or similar) — see Assumption A1.

3. **Sprite images for machines with no `sprite_path` set** — D-11 says "no photo yet" fallback. Verified: `site_machines.sprite_path` is nullable in the schema (`supabase/migrations/00067_site_model.sql`), and NO admin UI currently sets it (Phase 51's `SiteWorkspace.tsx` has no sprite upload — confirmed absent from the 51-05 summary's accomplishments list). Every machine will show "no photo yet" until a future phase adds sprite generation (explicitly deferred, CONTEXT.md Deferred Ideas: "Sprite generation per machine"). This is expected, not a gap — flagging so the plan doesn't attempt to build sprite upload as unrequested scope.

## Environment Availability

No new external dependencies. Existing Supabase Storage (`site-scenes` bucket, live since Phase 51), Supabase Postgres (RLS already live), and the existing Gemini-generation route (admin-only, irrelevant to this phase) are all already provisioned. Skipping the full Environment Availability table — no new tool/service/runtime is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`), project-per-phase pattern |
| Config file | `playwright.config.ts` — needs a NEW `phase52` project entry (mirrors `phase51`'s broad `testMatch: /tests\/phase52\/.*\.(spec\|test)\.ts$/` registration, per CLAUDE.md 2026-05-25 requirement that new spec files be registered or they silently never run) |
| Quick run command | `npx playwright test --project=phase52` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOM-01 | `/sops` worker >=1024px renders plant scene, no scope column, no Miller frame | source-contract + eval | `npx playwright test --project=phase52 tests/phase52/plant-render-seam.spec.ts` | No — Wave 0 |
| HOM-02 | Pins derived, never stored — no new table/store/column | source-contract (grep-based, mirrors `site-actions-contract.spec.ts`'s style) | `npx playwright test --project=phase52 tests/phase52/plant-pins-no-storage.spec.ts` | No — Wave 0 |
| HOM-02 | `plantRelState`/`derivePlantPins` correctness (due/never/updated/done ordering) | unit | `npx playwright test --project=phase15-unit src/components/sop/plant/__tests__/pins.test.ts` (mirrors `phase15-unit`'s static-`@/`-import pattern) | No — Wave 0 |
| HOM-03 | Now card shows due-first next procedure; Walk it / Show me wired | source-contract (handler-wiring style per 2026-06-05 discipline — extract each button's `onClick` body, assert real navigation/callback inside it, not just string presence) | `npx playwright test --project=phase52 tests/phase52/plant-now-card.spec.ts` | No — Wave 0 |
| HOM-03 | Fallback: org with no scene -> existing list renders, never blank | source-contract + eval (second eval test, real-org `eval-worker`, no site) | `npx playwright test --project=phase52` + `npm run eval -- --phase 52` | No — Wave 0 |
| HOM-04 | Click machine -> fly-to (target offset for 380px panel) + panel opens | unit (camera math) + eval (visual) | `npx playwright test --project=phase15-unit` (camera constants) + eval screenshot | No — Wave 0 |
| HOM-05 | Ask bar highlights matching machines/SOPs; mic -> existing voice entry | source-contract (handler wiring) | `npx playwright test --project=phase52 tests/phase52/plant-ask-bar.spec.ts` | No — Wave 0 |
| HOM-06 | Bundle gate: `/sops/page` within SB-LINE-06 budget, dynamic import, lazy image | build-time gate (already exists, needs marker-group extension) | `npm run build` (runs `postbuild` -> `check-bundle-size.ts`) | Yes, exists — needs Konva marker group added |
| HOM-06 | Konva isolation for the new plant directory | source-contract (extend existing spec) | `npx playwright test --project=phase26 tests/phase26/konva-worker-isolation.spec.ts` | Yes, exists (deny-by-default already covers new dirs; D-15 asks for explicit assertion) |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase52` + `npx tsc --noEmit`
- **Per wave merge:** full suite + `npm run build` (bundle gate is build-time, cannot be skipped at wave boundaries)
- **Phase gate:** Full suite green + deployed eval (`npm run eval -- --phase 52`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `playwright.config.ts` — register `phase52` project (broad `tests/phase52/**` testMatch, per D-15/CLAUDE.md 2026-05-25)
- [ ] `tests/phase52/` directory + stub specs for HOM-01..06 (test.fixme pattern per existing phase convention)
- [ ] `src/components/sop/plant/__tests__/pins.test.ts` — needs `phase15-unit`-style static-import test dir, OR add a new small project entry if `pins.ts`'s directory isn't already covered by `phase15-unit`'s broad `testMatch: /.*\.test\.ts$/` (verify via `npx playwright test --list --project=phase15-unit` once the file exists)
- [ ] `scripts/eval-fixtures.mjs` — add `eval-site-worker@sopstart.com` fixture (Pitfall 2) + a PUBLISHED fixture SOP assigned to it (Pitfall 3) — see Common Pitfalls
- [ ] `tests/evals/plant-home.eval.ts` — new eval file (D-16), needs the fixture fix above as a precondition
- [ ] `scripts/check-bundle-size.ts` — add Konva forbidden-marker group to the `/sops/page` `GATED_ROUTES` entry (Pitfall 4)

## Security Domain

`security_enforcement` is absent from `.planning/config.json` -> treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — existing session auth |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | New worker-readable action must filter every query by the SESSION org id (never a client-supplied or fetched-row org id, per the 2026-07-28 learning) — mirror `listSiteForOrg`'s existing `.eq('organisation_id', orgId)` pattern using `orgId` from session context, not from any input |
| V5 Input Validation | No new input surface | The plant module is read-mostly; the only "input" is the ask-bar search string, which is client-side filtering only (no query sent) |
| V6 Cryptography | No | Unchanged — signed URLs use the existing Supabase Storage signing (Phase 51), no new crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant read via a new server action that forgets the org filter (this codebase's #1 recurring bug class per CLAUDE.md Learnings — 2026-08-04 x2, 2026-07-28, 2026-07-20, 2026-06-15) | Information Disclosure | The new worker-readable action MUST `.eq('organisation_id', sessionOrgId)` on every query, exactly mirroring `listSiteForOrg`'s existing pattern (lines 59, 92, 105, 115 of `src/actions/site.ts`) — since RLS ALSO enforces this at the DB layer (migration 00067's SELECT policies), this is belt-and-braces, not the sole control, but the pattern must not regress |
| Sibling-function drift (a second, uncoordinated classifier for the same due/never/updated logic) | Tampering (data-integrity class, not classic STRIDE-security, but this codebase's own named recurring bug class — 2026-09-27) | Reuse `topSignal`/a sibling export in the SAME file, per Pattern 2 above — not a security vulnerability per se, but the project's own Learnings log treats this class of bug (worker-visible incorrect state) with security-incident-level severity given it previously caused visible safety-adjacent walkthrough gating bugs |

RLS is already the primary control (verified live and lint-pinned by `tests/lint/rls-org-scope.spec.ts`, unchanged since Phase 51 per its own verification report) — Phase 52 introduces no new tables, no new RLS policies, and no new write paths. The only new attack surface is the worker-readable READ action, and it inherits the same-org guarantee from RLS regardless of the action's own filter (defense in depth, not the sole gate).

## Sources

### Primary (HIGH confidence — all verified by direct file read in this repository during this research session)
- `src/app/(protected)/sops/page.tsx` — current render seam, `isAdmin` resolution, dynamic-import pattern
- `src/components/sop/SopWorkerBrowser.tsx` — `topSignal`, `TONE`, `rowMeta` badge vocabulary
- `src/actions/site.ts` — all 7 existing site actions, admin gating, org-scoping pattern
- `src/lib/site/scene.ts` — pure camera/geometry math already ported from the sketch
- `src/lib/validators/site.ts` — `SiteData`/`SiteLayout`/`SiteMachine` types, RLS-aligned shapes
- `supabase/migrations/00067_site_model.sql` — live RLS policies (SELECT is org-wide for all authenticated roles, writes admin/safety_manager only)
- `scripts/check-bundle-size.ts` + `.bundle-baseline.json` — exact gate mechanics, current `/sops/page` = 940 KB baseline, no Konva marker group yet
- `src/hooks/useViewport.ts` + `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` — the exact SSR-safe breakpoint + dynamic-swap pattern to reuse
- `src/components/sop/voice/WalkthroughVoiceModal.tsx` + `WalkthroughVoiceButton.tsx` — confirmed SOP-scoped, no list-level voice entry exists
- `tests/phase26/konva-worker-isolation.spec.ts` — allow-list mechanics (deny-by-default)
- `scripts/eval-fixtures.mjs` + `tests/evals/lib/session.ts` — confirmed fixture gap (Pitfalls 2/3)
- `.planning/phases/51-site-model-machine-editor/51-03-SUMMARY.md`, `51-05-SUMMARY.md`, `51-07-SUMMARY.md`, `51-VERIFICATION.md` — Phase 51's exact shipped exports and their verification status
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` + `.planning/sketches/007-plant-floor-navigation/index.html` — the design contract and validated interactive prototype (pan/zoom math, pin/badge vocabulary, panel/Now-card layout all copied from here)
- `.planning/codebase/CAPABILITY-MATRIX.md` — confirms worker read access to site tables is already RLS-granted, documented as "no worker-facing surface exists until Phase 52"
- `.planning/phases/52-worker-home-the-plant/52-CONTEXT.md` — locked decisions (D-01..D-16)
- `.planning/REQUIREMENTS.md` (HOM-01..06), `.planning/ROADMAP.md` (Phase 52 goal/success criteria), `.planning/STATE.md` (current milestone position)

No Context7/WebSearch/WebFetch tools were needed — this phase is 100% internal composition of already-verified, already-shipped codebase infrastructure. No external library documentation lookups were required.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all reused modules read directly from source
- Architecture: HIGH — render seam, dynamic-import pattern, and worker-readable action design all verified against live code, not inferred
- Pitfalls: HIGH — all six pitfalls found by direct inspection (fixture gap, draft-SOP gap, missing bundle marker group) rather than speculation

**Research date:** 2026-09-28
**Valid until:** 30 days (stable internal codebase, no external API/library drift risk) — but re-verify the eval-fixture gap (Pitfalls 2/3) is still unfixed before planning, in case another phase touches `eval-fixtures.mjs` in the meantime
