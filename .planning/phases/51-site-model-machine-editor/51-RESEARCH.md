# Phase 51: Site Model & Machine Editor - Research

**Researched:** 2026-09-28
**Domain:** Postgres/RLS schema design, Konva polygon editor, Supabase Storage signed-URL serving, Gemini image-generation REST call
**Confidence:** HIGH (schema/RLS/storage/Konva — all confirmed against live migrations, lint specs, and shipped code) / MEDIUM (Gemini image-output REST shape — no SDK or prior call in this codebase, confirmed from public API docs only, not exercised here)

## Summary

Phase 51 is a pure-admin, additive-schema phase: three new tables under RLS, one new private storage bucket, one new admin route, and one new field on an existing panel. Nothing here touches the worker bundle or any worker-visible surface — the risk is entirely in getting the RLS shape and the Konva bundle-isolation right, both of which the codebase already has a mechanically-enforced template for.

Two things in CONTEXT.md's assumptions turned out to be wrong and change the plan meaningfully. First, **there is no existing "builder SOP-level metadata panel"** for departments/category on an already-created SOP — `SopDepartmentEditor.tsx` (the component that looks like it should be it) has zero call sites anywhere in `src/` and is dead code left over from a Phase 25 follow-up. The only place departments/category are edited today is the pre-creation wizard dialog (`SopMetadataFields.tsx` + `SopMetadataDialog.tsx`, `localOnly` mode) and the pattern this phase should copy for the builder's Machines multi-select is instead the `BuilderStageShell.tsx` `ToolsMenu` + `BuilderFlowButton.tsx` portaled-modal idiom — a new "Manage machines" `ToolsMenu` row opening a modal, exactly like the existing "See the flow diagram" row does. Second, **`gemini-3.1-flash-image-preview` has zero footprint in this codebase** — no `@google/genai`/`@google-cloud` package, no `GEMINI_API_KEY` anywhere in `.env.local.example` or source. Generation must be a raw `fetch()` call to `generativelanguage.googleapis.com`.

The Konva polygon editor cannot simply drop a new component under `src/components/admin/site/` — `tests/phase26/konva-worker-isolation.spec.ts` hard-fails any static `react-konva`/`konva` import outside `src/components/admin/builder-v2/visual/`. The plan must either widen that allow-list (an explicit, mechanical edit to the spec's `ALLOWED_DIR` check, converting it to an array) or physically place the new editor inside `builder-v2/visual/` (wrong semantically — this isn't a builder concern). Widening the allow-list is the correct fix and is a one-line, low-risk change to a test file whose job is exactly "list the directories permitted to import Konva."

**Primary recommendation:** Follow the 00061/00062 RLS pattern verbatim (every policy `organisation_id = current_organisation_id() AND (...)`, any `WITH CHECK` restates the full `USING`), denormalise `organisation_id` onto all three tables exactly as CONTEXT.md's D-03 specifies, mirror `assignMemberDepartments` (not the newer grants-materialization `assignSopDepartments`) for the `sop_machines` junction write, put the Konva editor behind its own `next/dynamic({ssr:false})` loader in a new allow-listed directory, and call Gemini via a plain authenticated `fetch` from an API route (not a server action, to avoid Railway's action timeout on a multi-second image generation call).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Site/machine schema + RLS | Database / Storage | — | Postgres tables + policies; no app logic needed to enforce tenant isolation |
| Scene image storage | Database / Storage (Supabase Storage) | API/Backend (signed URL minting) | Private bucket, signed URLs only — mirrors `sop-images`/`sop-videos` |
| Scene generation (Gemini) | API/Backend | — | Must run server-side (API key secrecy); Next.js API route, not server action (timeout risk) |
| Machine editor UI (`/admin/site`) | Browser/Client (admin only) | Frontend Server (SSR shell) | Konva polygon editing is inherently client-side canvas work; server component fetches initial data, client component (dynamic, ssr:false) owns the canvas |
| SOP↔machine linking | API/Backend | Browser/Client (multi-select UI) | Junction write via server action, self-enforcing org scope (service-role client) |
| Department lookup for machine/SOP forms | API/Backend | — | Existing `listDepartments()` reused, no new capability |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: Three tables, org-scoped, admin-only writes — `site_layouts(id, organisation_id, name, scene_path, scene_width int, scene_height int, created_at, updated_at)`, `site_machines(id, site_layout_id, organisation_id, name, department_id null, polygon jsonb [[x,y],…], sprite_path null, code text unique short, sort int, created_at, updated_at)`, `sop_machines(sop_id, machine_id, organisation_id, primary key (sop_id, machine_id))`.
- D-02: Polygons stored in scene-pixel space (image's natural width/height, recorded on the layout). Renderers scale; never store viewport coordinates.
- D-03: RLS follows the 2026-08-04 learnings exactly — every policy conjoins `organisation_id = current_organisation_id()`; write policies admin/safety_manager only; any `WITH CHECK` restates the full `USING`. `tests/lint/rls-org-scope.spec.ts` must pass unchanged. `organisation_id` denormalised onto `site_machines`/`sop_machines` so no policy needs a cross-table subquery.
- D-04: Server actions in `src/actions/site.ts` use the session client + `requireAdminContext()`; if a junction write needs the service-role client, self-enforce org scope on the parent rows (2026-06-15 learning).
- D-05: New **private** storage bucket `site-scenes` (JPG/PNG, ≤15MB); scenes served via signed URLs like SOP images. Path convention `<organisation_id>/<layout_id>/scene.<ext>`.
- D-06: **Generate** = server action/route calling Gemini (`gemini-3.1-flash-image-preview`) with validated style prompt + admin's one-paragraph description; 16:9, 2K. Requires `GEMINI_API_KEY` on Railway — absent key → Generate control hidden, Upload-only shown, never a broken button. Add key to `.env.example` and Railway checklist.
- D-07: **Upload** = existing Phase 40 shared file-intake component where it fits, otherwise a plain input; HEIC not needed. Record natural width/height on the layout row at upload/generation time (server-side probe via `sharp` if present, else client `Image`).
- D-08: Route `src/app/(protected)/admin/site/page.tsx`, admin-gated by `requireAdminContext()` (server) + lazy client editor (`next/dynamic({ssr:false})`). Header gets "Site" entry in `ADMIN_LINKS`; `journeys.ts` updated same change.
- D-09: Editor built on Konva/react-konva (already installed). Interactions: pan (drag empty), wheel zoom-to-cursor, Draw machine mode (click vertices, close on first-vertex-click or dblclick), select machine (fill + vertex handles), drag vertex, delete (button + Delete key), rename inline, department select, per-change debounced server action save + "Saved ✓" state.
- D-10: Machine list in right panel (name · department · linked-SOP count · "Show SOPs" → list with unlink). Token utilities only, never raw palette classes.
- D-11: Empty state (no layout): two large choices — Generate from description (textarea + Generate) and Upload. After either, editor opens on the scene.
- D-12: Builder's SOP-level metadata panel gets a Machines multi-select (org-scoped, grouped by department, searchable); writes `sop_machines` through the same server action the editor uses. Find the actual panel by grepping for the `assignSopDepartments` call site — do not guess.
- D-13: Deleting a machine cascades `sop_machines`; deleting a SOP cascades `sop_machines` (FK `on delete cascade`); deleting a department sets `department_id` null (never deletes machines).
- D-14: Source-contract specs for RLS shape, admin-only route guard, dynamic import of editor, Gemini-key gate. Runtime: one integration spec inserting layout+machine+link as eval admin, reading back as eval worker (visible) and foreign-org session (empty) — cross-org + worker-read cells minimum.
- D-15: Deployed eval `tests/evals/site-editor.eval.ts`: upload fixture PNG (no paid generation call in CI), draw two polygons, name them, link fixture SOP, reload, assert all three persist; screenshot at 1440px.

### Claude's Discretion

- Exact column types for `polygon` validation (Zod: array of ≥3 `[number, number]`), debounce interval, vertex-handle size, whether `code` is base32 6-char or nanoid — pick and state in the plan.
- Whether generation runs in a server action or API route (prefer API route if the call can exceed the action timeout on Railway).
- Whether to store the scene's natural size by probing server-side or client-side — either, as long as recorded before the first polygon is drawn.

### Deferred Ideas (OUT OF SCOPE)

- Sprite-per-machine generation — Phase 54 or later.
- Multi-site picker; site-level access (Visy ~100 sites) — needs v9.0 site-overlay model first.
- Admin bulk "auto-detect machines" from the generated image (vision model proposes polygons) — a spike, not a phase task.
- Printable QR plates — Phase 53 (the `code` column is created here so plates can be printed later without a migration).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIT-01 | `site_layouts`/`site_machines`/`sop_machines` exist with org-scoped RLS, admin-only writes, `WITH CHECK` restating every `USING`; `tests/lint/rls-org-scope.spec.ts` passes unchanged | § RLS Idiom to Copy — exact migration shape + how the lint spec parses it |
| SIT-02 | Admin at `/admin/site` can generate (Gemini) or upload a scene, rendered at natural size with pan/zoom | § Gemini REST Call, § Storage, § Konva Pan/Zoom Math |
| SIT-03 | Admin can draw/name/department-tag/move-vertex/delete a polygon, persisted in scene-pixel space | § Konva Editor Pattern to Reuse/Diverge From |
| SIT-04 | SOP builder metadata panel offers a machine picker; machine editor lists linked SOPs; both write `sop_machines` | § Builder SOP-Level Metadata Panel — Corrected Finding |
| (eval) | Deployed eval: generate-or-upload → draw two polygons → link a SOP → reload shows all three | § Validation Architecture |

## Project Constraints (from CLAUDE.md)

- **RLS shape (2026-08-04 ×2):** Every SELECT/write policy on a tenant-owned table must conjoin `organisation_id = current_organisation_id()`; Postgres OR-combines permissive policies, so a single unscoped arm on any of the three new tables makes every other arm decorative. Any `WITH CHECK` present must restate the full `USING` predicate (an admin-role-only check with no org clause is a cross-tenant rewrite hole).
- **Junction writes (2026-06-15):** A table with no authenticated write policy by design must be written via the service-role client in the server action, and the action must self-enforce org-scope on the parent rows before writing (confirm parent row's `organisation_id` matches caller's org; filter any id list to the caller's org).
- **SECURITY DEFINER / RPC exposure (2026-07-05):** Do not add a Postgres RPC that takes an org id as a parameter — every function is auto-exposed at `POST /rest/v1/rpc/<name>` to any authenticated user. Not directly relevant here (no RPC planned) but binds if a helper function is added for polygon validation server-side.
- **CSS tokens (2026-07-14, 2026-09-28):** Any new admin UI must use `src/styles/blueprint-theme.css` tokens/utilities, never raw Tailwind palette classes or bare hex — enforced by `tests/lint/design-tokens.spec.ts`. If a new CSS custom property is introduced, it must be declared in the `@theme` block that is `@import`ed from `globals.css` AFTER `@import "tailwindcss"` — a `@theme` block imported any other way is silently inert.
- **`'use server'` files export only async functions (2026-06-27):** Any pure/sync helper (e.g. a polygon-area or centroid calculator) must live in a plain module, not inside `src/actions/site.ts`.
- **Internal links not type-checked (2026-06-08):** When adding the `/admin/site` route, any `href`/`Link` added elsewhere must be grepped for correctness — not applicable to removal here since this is a net-new route, but the header/journeys additions must use the real path.
- **Plain words, no "block" (project memory):** UI copy for machines/SOPs should avoid builder-internal jargon; "machine," "site," "department" are fine, "block" is not applicable here anyway.
- **Evals, not click-paths (project memory / CLAUDE.md):** No manual UAT checklist — `tests/evals/site-editor.eval.ts` is the verification artifact, run via `npm run eval -- --phase 51` post-deploy, screenshots read by the orchestrator.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `konva` | 10.3.0 [VERIFIED: package.json] | Canvas scene graph | Already installed (Phase 26 annotation); no new dependency |
| `react-konva` | 19.2.5 [VERIFIED: package.json] | React bindings for Konva | Already installed; same isolation pattern as `AnnotationEditor.tsx` |
| `sharp` | ^0.34.5 [VERIFIED: package.json] | Server-side natural image dimension probe | Already installed (`serverExternalPackages`, Phase 5); used for D-07's server-side size probe |
| `zod` | ^4.3.6 [VERIFIED: package.json] | Polygon/input validation | Already the project's sole validation library |
| `next` | 16.2.1 [VERIFIED: package.json] | App Router, dynamic imports | Existing framework version |

### Supporting

None new. No package needs installing for this phase — Gemini is called via raw `fetch`, not an SDK (see below).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` to Gemini REST endpoint | `@google/genai` npm SDK | SDK is a new dependency for a single call-site; codebase has zero prior Gemini integration and no established provider-adapter slot for it (unlike `src/lib/ai/registry.ts`/`llm.ts` which covers Anthropic/OpenAI/OpenRouter, not Google). A raw authenticated `fetch()` matches D-06's "server action/route calls the Gemini image model" framing with zero new attack surface from an unverified package. **[ASSUMED — see Assumptions Log A2]** if a future phase needs more Gemini surface (e.g. Phase 54 sprite generation), revisit whether a thin adapter module is worth adding then. |
| `assignSopDepartments`'s access-grants materialization pattern for `sop_machines` | `assignMemberDepartments`'s plain replace-semantics junction pattern | `assignSopDepartments` is now entangled with Phase 32/33's `access_grants` resolver/materializer — copying it would wire `sop_machines` into an unrelated permissions system. `assignMemberDepartments` (service-role + org self-scope + delete-then-insert) is the correct, much simpler template for a pure N:M junction with no derived-visibility concern. |

**Installation:** None — no new packages.

**Version verification:** `konva`, `react-konva`, `sharp`, `zod`, `next` versions above read directly from `package.json` (2026-09-28); no registry lookup needed since nothing new is installed.

## Package Legitimacy Audit

No external packages are being installed in this phase — Gemini is called via `fetch()` (no SDK), and all other dependencies (`konva`, `react-konva`, `sharp`, `zod`) are already installed and were audited in prior phases (26, 5). This section is not applicable; the gate is satisfied by "zero new packages."

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages evaluated — none proposed)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Admin browser (/admin/site)
   │
   ├─ 1. Page load: server component page.tsx
   │      → requireAdminContext() [guards.ts]
   │      → fetch site_layouts row + site_machines rows (session client, RLS-scoped)
   │      → sign scene_path via supabase.storage.from('site-scenes').createSignedUrl()
   │      → pass initial data as props to client editor
   │
   ├─ 2. next/dynamic({ssr:false}) loads SiteEditorLoader → SiteEditor.tsx (Konva Stage)
   │      → renders scene <img> (or Konva Image) at natural size inside a
   │        world <Group> that is panned/zoomed via Stage transform
   │      → polygon draw / vertex drag / select / delete — local state first,
   │        then debounced server action commit
   │
   ├─ 3a. Empty state: no site_layouts row
   │      → "Generate" textarea → POST /api/admin/site/generate (API route)
   │            → builds prompt (style prefix + admin paragraph)
   │            → fetch() to generativelanguage.googleapis.com generateContent
   │              (responseModalities:["IMAGE"]) with GEMINI_API_KEY
   │            → decode base64 inlineData → upload to site-scenes bucket
   │            → insert site_layouts row (scene_path, scene_width, scene_height)
   │      → OR "Upload" <input type=file> → validate (image/jpeg|png, ≤15MB)
   │            → client Image() probes naturalWidth/naturalHeight (or server sharp probe)
   │            → direct-to-storage upload (signed upload URL, mirrors sop-images path)
   │            → insert site_layouts row
   │
   ├─ 3b. Draw machine → POST src/actions/site.ts createSiteMachine/updateSiteMachinePolygon
   │      (session client + requireAdminContext(); polygon array validated by Zod)
   │
   └─ 4. Right panel: machine list → "Show SOPs" → listSopsForMachine(machineId)
          → link/unlink SOP → src/actions/site.ts setSopMachines(sopId, machineIds)
          (service-role client, self-enforces org scope on parent sop + machine rows —
           mirrors assignMemberDepartments, NOT assignSopDepartments's grants layer)

Builder (/admin/sops/builder/[sopId]) — separate entry point into the SAME action
   │
   └─ BuilderStageShell.tsx ToolsMenu → new "Manage machines" row (mirrors
      BuilderFlowButton.tsx's portaled-modal pattern) → modal renders Machines
      multi-select (org-scoped, grouped by department) → setSopMachines(sopId, ids)
```

### Recommended Project Structure

```
src/app/(protected)/admin/site/
├── page.tsx                     # server component: requireAdminContext, fetch layout+machines, sign scene URL
├── SiteEditorLoader.tsx         # 'use client', next/dynamic(() => import('./SiteEditor'), {ssr:false})
├── SiteEditor.tsx               # the Konva Stage/editor — MUST live in the Konva allow-list dir (see Pitfall 1)
└── site-empty-state.tsx         # Generate-or-Upload empty state (no layout yet)

src/app/api/admin/site/generate/route.ts   # Gemini call (API route, not server action — see D-06 discretion)

src/actions/site.ts               # createSiteLayout, uploadSiteLayoutImage, createSiteMachine,
                                   # updateSiteMachine (name/department/polygon/sort), deleteSiteMachine,
                                   # setSopMachines(sopId, machineIds), listMachinesForOrg, listSopsForMachine

src/components/admin/builder-v2/visual/site/   # <- OR wherever the allow-list is widened to (see Pitfall 1)
└── (Konva editor lives inside the allow-listed dir; page.tsx above only hosts
    the route and imports the loader)

src/components/admin/sop/SopMachinePicker.tsx  # new ToolsMenu modal content, mirrors BuilderFlowButton.tsx shape

supabase/migrations/
└── 00067_site_model.sql          # tables + RLS + storage bucket + storage RLS (next available number)
```

Note on the Konva directory placement: the cleanest resolution to Pitfall 1 (below) is to widen `tests/phase26/konva-worker-isolation.spec.ts`'s `ALLOWED_DIR` check from a single string to an array including both `src/components/admin/builder-v2/visual` and a new `src/components/admin/site` directory. Keep `SiteEditor.tsx` under `src/components/admin/site/` (not nested inside `builder-v2/visual/`, which is semantically a builder concept) and update the spec accordingly — this is the intended, low-risk use of that lint file (it exists to enumerate permitted directories, not to hardcode exactly one).

### Pattern 1: Konva pan/zoom-to-cursor over a fixed-size world

**What:** The Stage container has a fixed pixel size (viewport); a `world` transform (`x`, `y`, `scale`) is applied via a `<Group x={view.x} y={view.y} scaleX={view.s} scaleY={view.s}>` wrapping the scene image and polygons. Panning drags the group; wheel zoom rescales toward the cursor position.

**When to use:** The site scene editor and (later, Phase 52) the worker home renderer — this is the shared math, validated in the sketch.

**Example (ported from the sketch's vanilla-DOM math to Konva idiom — the arithmetic is identical, only the apply-transform call changes):**
```typescript
// Source: .planning/sketches/007-plant-floor-navigation/index.html lines 343-354
// (fit/apply/pan/zoom — re-implement the same arithmetic against a Konva Stage
// instead of a CSS transform string)
const fit = () => {
  const W = containerEl.clientWidth, H = containerEl.clientHeight
  if (!W) return // re-measure on every fit — a stage built while hidden measures 0×0
  const s = Math.min(W / sceneWidth, H / sceneHeight) * 1.02
  const x = (W - sceneWidth * s) / 2
  const y = (H - sceneHeight * s) / 2
  setView({ x, y, s })
}

// Zoom to cursor: on Konva, use stage.getPointerPosition() (already in stage-local
// coordinates) rather than manually subtracting getBoundingClientRect() as the
// sketch does for a raw <div>.
function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  e.evt.preventDefault()
  const stage = e.target.getStage()!
  const pointer = stage.getPointerPosition()!
  const oldScale = view.s
  const factor = e.evt.deltaY < 0 ? 1.12 : 1 / 1.12
  const newScale = Math.min(2.4, Math.max(0.35, oldScale * factor))
  const mousePointTo = {
    x: (pointer.x - view.x) / oldScale,
    y: (pointer.y - view.y) / oldScale,
  }
  setView({
    s: newScale,
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  })
}
```

### Pattern 2: Pointer → scene-pixel-space conversion for polygon drawing

**What:** `Konva.Stage.getRelativePointerPosition()` returns the pointer position already converted through the current stage/layer transform into the coordinate space of the node it's called on — this is exactly what CONTEXT.md's `<specifics>` section calls out as the mechanism to use, and it is the correct Konva API for this (confirmed against Konva's documented behaviour: it accounts for any ancestor transforms, unlike `getPointerPosition()` which returns raw stage-local pixels).

**When to use:** Every vertex placed while in "Draw machine" mode, and every vertex drag — call it on the `Layer` (or a `Group` positioned at the scene's origin) so the returned `{x, y}` is directly in scene-pixel space and can be stored as-is in the `polygon` column.

```typescript
// Source: Konva official docs (getRelativePointerPosition) — [CITED: konvajs.org]
function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
  const layer = layerRef.current
  if (!layer) return
  const pos = layer.getRelativePointerPosition() // already in scene-px, transform-aware
  if (!pos) return
  addVertex([pos.x, pos.y])
}
```

### Pattern 3: Admin-only Konva dynamic loader (copy verbatim)

**What:** `AnnotationEditorLoader.tsx` is the sanctioned template for keeping Konva out of any bundle that doesn't need it — `next/dynamic(() => import('./SiteEditor'), { ssr: false })`.

**Example:**
```typescript
// Source: src/components/admin/builder-v2/visual/AnnotationEditorLoader.tsx (verbatim pattern)
'use client'
import dynamic from 'next/dynamic'

export const SiteEditorLoader = dynamic(
  () => import('./SiteEditor'),
  { ssr: false, loading: () => <div>Loading site editor…</div> }
)
export default SiteEditorLoader
```

### Anti-Patterns to Avoid

- **Copying `assignSopDepartments`'s access-grants materialization for `sop_machines`:** That function now writes `access_grants` rows and calls `materializeSopAccess()` — a Phase 32/33 permissions-resolver concern with no relevance to machine linking. Copy `assignMemberDepartments` instead (plain service-role delete-then-insert, self-scoped).
- **Building a second "is this Konva-allowed here?" check:** Don't hand-roll a new lint file — extend the existing `tests/phase26/konva-worker-isolation.spec.ts` allow-list array. One check, one file, per the project's own "same classifier in one place" learning (2026-09-27 CLAUDE.md entry).
- **Assuming a builder metadata panel exists:** It does not (see Corrected Finding below). Do not write a plan task that says "add Machines field to the existing panel" — the task is "add a new ToolsMenu row + modal," full stop.
- **Storing polygon vertices in viewport/display coordinates:** Every render call must scale from scene-px → viewport-px via the current Stage transform, never store the scaled value.

## Corrected Finding: No Builder SOP-Level Metadata Panel Exists

CONTEXT.md D-12 instructs: *"Find the actual panel by grepping the builder for where category/department are edited (`assignSopDepartments` call site) — do not guess the file."* Following that instruction precisely:

- `grep -rn "assignSopDepartments" src` returns exactly three call sites: `src/actions/sops.ts:602` (wizard-time `createSopFromWizard`), `src/components/admin/departments/DepartmentPicker.tsx:133/166` (the picker component itself), and `src/components/admin/sop/SopDepartmentEditor.tsx` (a wrapper around `DepartmentPicker`).
- `grep -rn "SopDepartmentEditor" src` finds **only its own definition file** — it is imported nowhere. It is dead code from a Phase 25 follow-up (its own docstring says it was meant to live "on /admin/sops," but that route's per-SOP department editing was superseded by later Phase 32/33 access-grant UI).
- The builder (`src/app/(protected)/admin/sops/builder/[sopId]/*.tsx`) has **zero references** to `assignSopDepartments`, `SopDepartmentEditor`, `category_slug`, or `SOP_CATEGORIES`. There is no category/department editing surface inside the builder today.

**Implication for planning:** D-12's "Machines multi-select" cannot be added to an existing panel — none exists. The correct home, following the codebase's own established idiom for "a builder-scoped tool that needs a modal," is `BuilderStageShell.tsx`'s `ToolsMenu` (the "Tools for this SOP ▾" popover at line ~81), adding a new row alongside "Assign this SOP to workers" / "See earlier versions" / etc. For a row that needs a rich in-page interaction (not a route navigation), `BuilderFlowButton.tsx`'s portaled-modal pattern (`createPortal` to `document.body`, `Escape` to close, backdrop click to close) is the exact template — copy its shape for a new `SopMachinePicker.tsx` (or similarly named) modal rendering the Machines multi-select, grouped by department, writing through `setSopMachines()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pointer → scene-pixel coordinate conversion | Manual `getBoundingClientRect()` + transform-inverse math | `Konva.Layer.getRelativePointerPosition()` | Konva already tracks the full transform chain; a hand-rolled inverse is exactly the class of Konva pitfall the codebase's own comments warn about (natural-image-space coordinate bugs, `annotation-tools.ts` docstring) |
| Signed URL serving for the scene image | A new signing helper | `supabase.storage.from('site-scenes').createSignedUrl(path, 3600)` — same call shape as `sign-layout-data-images.ts` | One TTL constant, one call pattern, already proven across `sop-images`/`sop-videos` |
| Org-scope enforcement on the `sop_machines` write | A bespoke per-call check | Mirror `assignMemberDepartments`'s `callerOrgId()` + `orgScopedDeptIds()`-style helpers (rename for machines) | Already-audited pattern; reinventing it risks reintroducing the exact class of hole the 2026-06-15/2026-08-04 learnings closed |
| Natural image dimension probing | A new library | `sharp` (already a dependency, `serverExternalPackages`) server-side, or `new Image()` + `naturalWidth`/`naturalHeight` client-side (already used in `page-order-detect.ts`, `quality-checks.ts`) | Both idioms exist and are proven; no new work needed |

**Key insight:** Every primitive this phase needs (signed URLs, org-scoped junction writes, Konva isolation, natural-size probing) already has exactly one established implementation elsewhere in the codebase. This phase is composition, not invention — the only genuinely new code is the polygon-editor UI itself and the Gemini call.

## Common Pitfalls

### Pitfall 1: Konva static-import lint gate will hard-fail on a naive file placement
**What goes wrong:** Creating `SiteEditor.tsx` anywhere outside `src/components/admin/builder-v2/visual/` and statically importing `react-konva`/`konva` fails `tests/phase26/konva-worker-isolation.spec.ts` (registered under the `phase26` Playwright project, so it runs in the normal suite).
**Why it happens:** The spec's `ALLOWED_DIR` is currently a single hardcoded path string (`src/components/admin/builder-v2/visual`), written when Konva had exactly one legitimate use.
**How to avoid:** In the same migration/plan wave that adds the Konva editor, edit the spec to accept an array of allowed directories (add `src/components/admin/site`) and update its violation-filtering logic accordingly. Keep the spec's intent (a real, git-diffable allow-list) — do not delete or weaken the check.
**Warning signs:** `npm run test` (or the `phase26` project specifically) fails with `react-konva static-import leak violations` naming the new file.

### Pitfall 2: `GEMINI_API_KEY` absence must hide the control, not error at click-time
**What goes wrong:** If the Generate button is always rendered and only fails server-side when the key is missing, that's the exact "fail open, surface nothing" class CLAUDE.md's 2026-06-02 model-rot learning warns about (a broken feature that "runs" and shows nothing useful).
**Why it happens:** Easiest implementation is "render both buttons, let the server 500."
**How to avoid:** The page/server component checks `process.env.GEMINI_API_KEY` presence and passes a boolean to the client empty-state component; when false, only Upload renders. A source-contract spec should assert this branch exists (D-14 requires a "Gemini-key gate" source-contract spec).

### Pitfall 3: Zod validation for `polygon` must reject self-intersecting/degenerate shapes only at the UX layer, not block valid data
**What goes wrong:** Over-validating (e.g. requiring convexity) will reject legitimate concave machine outlines (an L-shaped machine footprint is normal).
**Why it happens:** Temptation to add geometric correctness checks beyond "is this well-formed data."
**How to avoid:** Zod schema should only assert shape (`z.array(z.tuple([z.number(), z.number()])).min(3)`), not geometric validity. Any "looks self-intersecting" warning belongs in the UI as a soft hint, never a hard save-blocker — this matches the project's north star (ease of use beats process).

### Pitfall 4: `sop_machines` FK cascade direction must be verified in both directions per D-13
**What goes wrong:** Getting the `ON DELETE` clause backwards on one side (e.g. `ON DELETE CASCADE` on `sop_id` but `ON DELETE SET NULL` accidentally applied where `ON DELETE CASCADE` was intended on `machine_id`, or vice versa) silently leaves orphaned or wrongly-null junction rows.
**Why it happens:** Two FKs on one junction table, easy to transpose the two cascade clauses when writing the migration quickly.
**How to avoid:** Write both FK clauses explicitly and name them in a comment referencing D-13 verbatim: `sop_id → sops(id) ON DELETE CASCADE`, `machine_id → site_machines(id) ON DELETE CASCADE`. Departments use `ON DELETE SET NULL` on `site_machines.department_id`, never cascading the machine's deletion.

### Pitfall 5: A stage built while its container is hidden measures 0×0
**What goes wrong:** If the editor mounts inside a tab/panel that starts hidden (e.g. behind the empty-state toggle), `containerEl.clientWidth` reads 0 at first `fit()` call, producing a scale of 0 or `NaN`.
**Why it happens:** Exactly the bug the sketch's own comment calls out (`index.html` line 343: "a stage built while its tab is hidden measures 0×0 — re-measure on every fit").
**How to avoid:** Re-run `fit()` on a `ResizeObserver` of the container, not just once on mount; also re-run it after any state transition that shows/hides the editor (e.g. after the empty-state → editor swap).

## Code Examples

### RLS migration shape to copy (verbatim structure, new tables)

```sql
-- Source: pattern from supabase/migrations/00061_sops_select_org_scope.sql
-- and 00062_org_members_update_check_org_scope.sql (both [VERIFIED: migration files])
create table public.site_layouts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  name text not null default 'Site',
  scene_path text,
  scene_width int,
  scene_height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_layouts enable row level security;

create policy "org_members_can_view_site_layouts"
  on public.site_layouts for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy "admins_can_write_site_layouts"
  on public.site_layouts for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );
-- Repeat the same two-policy shape for site_machines and sop_machines, each with
-- organisation_id denormalised onto the row (D-03) so no policy needs a subquery
-- into site_layouts/sops (avoids the 42P17 recursion class from migrations 00030/00031).
```

### Storage bucket + org-scoped storage RLS (copy `00059_sop_videos_storage_scope.sql`'s shape)

```sql
-- Source: supabase/migrations/00059_sop_videos_storage_scope.sql [VERIFIED: migration file]
insert into storage.buckets (id, name, public) values ('site-scenes', 'site-scenes', false)
  on conflict (id) do nothing;

create policy "admins_can_upload_site_scenes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-scenes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and public.current_user_role() in ('admin', 'safety_manager')
  );

create policy "org_members_can_read_site_scenes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-scenes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );
```

### Gemini image generation — REST shape (no SDK in this codebase)

```typescript
// [CITED: ai.google.dev/gemini-api/docs/image-generation — public API docs, NOT
// verified via a live call in this session; MEDIUM confidence, flagged in
// Assumptions Log A1]
// src/app/api/admin/site/generate/route.ts
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image-preview'

async function generateScene(prompt: string): Promise<Buffer> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini generateContent failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  // Response shape: candidates[0].content.parts[] contains one part with
  // inlineData: { mimeType, data (base64) } for the image output.
  const part = json.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)
  const b64 = part?.inlineData?.data
  if (!b64) throw new Error('Gemini response contained no image data')
  return Buffer.from(b64, 'base64')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is a net-new capability | — | — | — |

No prior version of this feature exists to supersede; this section is not applicable.

**Deprecated/outdated:** None.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini `generateContent` REST request/response shape (endpoint path, `x-goog-api-key` header, `responseModalities: ["IMAGE"]`, `candidates[0].content.parts[].inlineData.data` base64 field) for `gemini-3.1-flash-image-preview` | Code Examples § Gemini | If the actual shape differs (e.g. different header name, different response nesting, or the model name has since changed/gone GA under a different string), the generate route will 4xx or silently return no image. Low blast radius — Upload is the fallback path and D-06 already requires hiding Generate when the key/call fails, but the plan should have the executor do a live smoke-test call against the real API key before considering SIT-02's generate path done. |
| A2 | No `@google/genai` (or similar) npm SDK should be added; a raw `fetch()` is sufficient and preferred | Standard Stack § Alternatives Considered | If Google's REST API requires more ceremony than a bearer/API-key header (e.g. OAuth service-account flow rather than a simple API key for this specific model), a raw fetch won't suffice and an SDK becomes the pragmatic choice. Low risk — Gemini's `generativelanguage.googleapis.com` API-key auth is the documented consumer-key path for this model family. |
| A3 | `gemini-3.1-flash-image-preview` is a real, currently-available model string (not renamed/retired) | User Constraints (copied from CONTEXT.md, itself sourced from the sketch's live 2026-09-28 generations via the `nano-banana-2` MCP) | If Google renames or retires the preview model, the hardcoded string 404s. Mitigate with an env override (`GEMINI_IMAGE_MODEL`) exactly as the codebase already does for `VERIFY_MODEL`/`TTS_MODEL` (CLAUDE.md 2026-06-02 model-rot learning) — reflected in the Code Example above. |

**If this table is empty:** N/A — see rows above. Everything else in this research (schema, RLS, Konva, storage, builder panel finding) is VERIFIED or CITED against files read directly in this session.

## Open Questions

1. **Where exactly should `SiteEditor.tsx` live once the Konva allow-list is widened?**
   - What we know: it must be inside whatever directory `konva-worker-isolation.spec.ts` allows.
   - What's unclear: whether to nest it under a new top-level `src/components/admin/site/` (semantically clean) or under `builder-v2/visual/site/` (keeps all Konva code physically together, but wrongly implies it's a builder concern).
   - Recommendation: `src/components/admin/site/` as its own allow-listed directory — it is not a builder-editor concept, and CONTEXT.md never mentions the builder in relation to the polygon editor itself (only the SOP-linking side touches the builder).

2. **Does the empty-state Upload path reuse any UI from `UploadDropzone.tsx`, or is a plain `<input type="file">` correct?**
   - What we know: D-07 says "the existing shared file-intake component from Phase 40 where it fits, otherwise a plain input." `UploadDropzone.tsx` is tightly coupled to SOP creation sessions (`createUploadSession`, TUS thresholds, multi-format accept list, YouTube/video modes) — none of which apply to a single JPG/PNG scene upload.
   - What's unclear: whether "where it fits" means reusing the `ACCEPT_ATTR`/`validateIntakeFile` validation helpers from `src/lib/upload/file-intake.ts` (which do fit — they're plain, format-agnostic functions) versus the full dropzone component (which doesn't).
   - Recommendation: reuse `file-intake.ts`'s validation primitives (or a narrower `image/jpeg,image/png` accept list, since HEIC is explicitly not needed per D-07) inside a small purpose-built upload control for this page; don't pull in `UploadDropzone.tsx` wholesale.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `GEMINI_API_KEY` (Railway env var) | SIT-02 Generate path | ✗ (not present in `.env.local.example` or any env reference found) | — | Upload-only mode (D-06 mandates this exact fallback — control hidden, not broken) |
| Supabase Storage (existing project) | Scene asset storage | ✓ | live project (same as `sop-images`/`sop-videos`) | — |
| `sharp` native binary | Server-side natural-size probe | ✓ [VERIFIED: package.json, `serverExternalPackages`] | ^0.34.5 | Client-side `new Image()` probe (already proven elsewhere) |
| Konva/react-konva | Polygon editor | ✓ [VERIFIED: package.json] | 10.3.0 / 19.2.5 | — |

**Missing dependencies with no fallback:**
- `GEMINI_API_KEY` is genuinely absent today. This does not block the phase (D-06's fallback design means Upload-only ships correctly with the key absent), but SIT-02's generate half cannot be verified end-to-end without Simon adding the key to Railway and `.env.local`. Flag as a `checkpoint:human-verify` (or at minimum a note) in the plan: "confirm `GEMINI_API_KEY` is set on Railway before the generate-path eval step can pass; otherwise the eval's generate assertions must be skipped/gated the same way `EVAL_ENV_READY` skips when `EVAL_BASE_URL` is unset."

**Missing dependencies with fallback:** none beyond the above.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`) — source-contract + runtime specs under `tests/phaseNN/`, deployed evals under `tests/evals/` |
| Config file | `playwright.config.ts` (project-based `testMatch` regex per phase) |
| Quick run command | `npx playwright test --project=phase51` (once registered) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIT-01 | RLS shape: org-scoped, `WITH CHECK` restates `USING`, no policy disagreement | source-contract (existing spec, unchanged) | `npx playwright test tests/lint/rls-org-scope.spec.ts` | ✅ (spec is generic over all migrations — new tables covered automatically, no edit needed) |
| SIT-01 | Runtime cross-org + worker-read isolation on the three new tables | integration (new) | `npx playwright test --project=phase51` | ❌ Wave 0 — `tests/phase51/site-model-rls-runtime.spec.ts` |
| SIT-02 | Admin-only route guard on `/admin/site` | source-contract (new) | `npx playwright test --project=phase51` | ❌ Wave 0 |
| SIT-02 | Editor is dynamically imported (`ssr:false`), never in worker bundle | source-contract (new, extend `konva-worker-isolation.spec.ts` allow-list) | `npx playwright test --project=phase26` | ❌ edit existing file |
| SIT-02 | `GEMINI_API_KEY` absence hides Generate control | source-contract (new) | `npx playwright test --project=phase51` | ❌ Wave 0 |
| SIT-03 | Polygon CRUD (draw/name/department/move-vertex/delete) persists | integration (new, exercised at DB level via server action) | `npx playwright test --project=phase51` | ❌ Wave 0 |
| SIT-04 | `setSopMachines` writes `sop_machines`, org-self-enforced | integration (new) | `npx playwright test --project=phase51` | ❌ Wave 0 |
| SIT-02/03/04 (end-to-end) | Deployed eval: upload → draw two polygons → name → link SOP → reload → all three persist | deployed eval | `npm run eval -- --phase 51` | ❌ Wave 0 — `tests/evals/site-editor.eval.ts` (auto-registered by the existing broad `evals` project regex `tests/evals/*.eval.ts` — no config edit needed) |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase51` (once the project exists) + `npx tsc --noEmit`
- **Per wave merge:** `npm run test` (full suite) + `npm run build` (bundle gate is not directly relevant to `/admin/site` but a full build catches any accidental worker-bundle leak)
- **Phase gate:** Full suite green + `npm run eval -- --phase 51` against the deployed site before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Register `phase51` Playwright project in `playwright.config.ts` — copy the `phase40`/`phase41`/`phase46` broad-testMatch pattern verbatim: `testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/`. Verify with `npx playwright test --list --project=phase51` before writing any spec (CLAUDE.md 2026-05-25: an unregistered spec never runs).
- [ ] `tests/phase51/` directory + Wave-0 stub specs (RLS runtime, admin-route guard, dynamic-import assertion, Gemini-key gate, polygon CRUD, `setSopMachines`).
- [ ] Extend `tests/phase26/konva-worker-isolation.spec.ts`'s `ALLOWED_DIR` to an array including the new site-editor directory — this is an edit to an existing gate, not a new file, but it must land in the same wave that introduces the new Konva import site or the phase26 project goes red.
- [ ] `tests/evals/site-editor.eval.ts` — no config edit needed (existing `evals` project regex covers any `*.eval.ts` file), but the fixture SOP/account setup should confirm `scripts/eval-fixtures.mjs` doesn't need a new fixture (existing `eval-admin@sopstart.com` should suffice; no new fixture identified as required).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (new capability, no auth changes) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `requireAdminContext()` on the route + all `src/actions/site.ts` writes; RLS on all three new tables (org-scoped, admin/safety_manager write-only) |
| V5 Input Validation | yes | Zod schema for polygon (`z.array(z.tuple([z.number(), z.number()])).min(3)`), machine name length, department id UUID, image MIME/size checks on upload |
| V6 Cryptography | no | No new crypto surface (signed URLs use Supabase's existing signing, not hand-rolled) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant read/write via unscoped RLS policy (this codebase's #1 recurring class — 00061, 00062, and multiple CLAUDE.md entries) | Elevation of Privilege / Information Disclosure | Every policy on the three new tables conjoins `organisation_id = current_organisation_id()`; `WITH CHECK` restates `USING` fully; `tests/lint/rls-org-scope.spec.ts` runs against every migration automatically |
| Service-role junction write without self-enforced org scope (2026-06-15 class) | Elevation of Privilege | `setSopMachines`/`createSiteMachine` etc. verify parent-row org membership before writing, mirroring `assignMemberDepartments` |
| Storage object path traversal / cross-org read via predictable path | Information Disclosure | `site-scenes` bucket RLS scopes on `(storage.foldername(name))[1] = current_organisation_id()::text`, identical to the `sop-videos` fix in migration 00059 |
| SSRF / injection via admin-supplied generation prompt text passed to an external API | Tampering | The admin's paragraph is concatenated into a text prompt sent to Gemini, not executed or interpolated into any SQL/shell/file-path context — no injection surface beyond "Gemini generates an undesired image," which is a content-moderation concern, not a security one |
| Gemini API key exposure to the client | Information Disclosure | Key stays server-side only (API route env var), never passed to the browser — mirrors every other provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) in this codebase |

## Sources

### Primary (HIGH confidence)

- `C:\Development\SOPstart\supabase\migrations\00061_sops_select_org_scope.sql` — RLS OR-combination fix, exact policy shape
- `C:\Development\SOPstart\supabase\migrations\00062_org_members_update_check_org_scope.sql` — `WITH CHECK` restating `USING`
- `C:\Development\SOPstart\supabase\migrations\00059_sop_videos_storage_scope.sql` — org-scoped storage RLS pattern
- `C:\Development\SOPstart\tests\lint\rls-org-scope.spec.ts` — exact mechanics of the RLS gate this phase must pass
- `C:\Development\SOPstart\tests\phase26\konva-worker-isolation.spec.ts` — Konva allow-list gate, exact `ALLOWED_DIR` mechanism
- `C:\Development\SOPstart\src\components\admin\builder-v2\visual\AnnotationEditor.tsx` / `AnnotationEditorLoader.tsx` — Konva dynamic-loader pattern, Stage/Layer/Transformer idiom
- `C:\Development\SOPstart\src\actions\departments.ts` — `assignMemberDepartments`/`assignSopDepartments`/`orgScopedDeptIds`/`callerOrgId` junction-write idioms
- `C:\Development\SOPstart\src\lib\auth\guards.ts` — `requireAdminContext()`
- `C:\Development\SOPstart\src\lib\builder\sign-layout-data-images.ts` — signed-URL serving pattern (`createSignedUrl`, TTL)
- `C:\Development\SOPstart\src\app\(protected)\admin\sops\builder\[sopId]\BuilderStageShell.tsx` / `BuilderFlowButton.tsx` — ToolsMenu + portaled-modal pattern (the corrected home for the Machines picker)
- `C:\Development\SOPstart\src\components\layout\TopHeader.tsx` — `ADMIN_LINKS` array shape
- `C:\Development\SOPstart\src\lib\journeys\journeys.ts` — journey registration format
- `C:\Development\SOPstart\tests\evals\lib\session.ts` / `tests\evals\sop-surface.eval.ts` — eval session minting + screenshot pattern
- `C:\Development\SOPstart\playwright.config.ts` — `evals` project regex, `phaseNN` broad-testMatch convention
- `C:\Development\SOPstart\scripts\check-bundle-size.ts` — confirms `GATED_ROUTES` covers only `/sops/[sopId]/page` and `/sops/page` (not `/admin/site`)
- `C:\Development\SOPstart\.planning\sketches\007-plant-floor-navigation\index.html` — pan/zoom/fit/zoom-to-cursor arithmetic (lines 343-354)
- `.claude\skills\sketch-findings-SOPstart\references\plant-floor-navigation.md` — design contract
- `C:\Development\SOPstart\package.json` — verified installed versions (`konva` 10.3.0, `react-konva` 19.2.5, `sharp` ^0.34.5, `zod` ^4.3.6, `next` 16.2.1); absence of any Google/Gemini package
- `C:\Development\SOPstart\.env.local.example` — absence of `GEMINI_API_KEY`

### Secondary (MEDIUM confidence)

- Gemini `generateContent` REST request/response shape (Code Examples section) — public API documentation knowledge, not verified via a live call in this session (Assumptions Log A1)

### Tertiary (LOW confidence)

- None — no unverified WebSearch-only claims were used; all findings are either read directly from the codebase or explicitly flagged in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all versions read directly from `package.json`
- Architecture (schema/RLS/storage/Konva isolation): HIGH — every pattern copied from a live, currently-passing migration or component in this codebase
- Architecture (builder metadata panel): HIGH — corrected via direct grep; the CONTEXT.md assumption was wrong and this research documents the actual finding
- Gemini integration: MEDIUM — no prior integration exists in this codebase to verify against; REST shape is from training knowledge / public docs, not exercised here
- Pitfalls: HIGH — five of five are traceable to either a passing test file's stated purpose or the sketch's own documented bug

**Research date:** 2026-09-28
**Valid until:** 30 days for the schema/RLS/Konva findings (stable, internal); 7 days for the Gemini model-name/REST-shape claim (fast-moving preview model — re-verify against a live call before relying on it in execution)
