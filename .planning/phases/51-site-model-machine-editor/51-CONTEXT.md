# Phase 51: Site Model & Machine Editor - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning
**Source:** Orchestrator-compiled from sketch 007 (winner "Plant", decided 2026-09-28), the wrapped design contract `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md`, and Simon's two calls the same day ("Go ahead with 007", "Forget the shared terminal"). No discuss-phase question round was run — Simon asked to proceed directly.

<domain>
## Phase Boundary

The **data and the admin editor** for the plant-floor model, nothing the worker sees. An org describes its site once — a scene image (generated or uploaded) and the machines on it (name, department, polygon in scene-pixel space, short QR code) — and any SOP can say which machines it belongs to. Phases 52–54 draw pins on this; they cannot start without it.

**In scope:** three tables + RLS, storage bucket for scene assets, server-side scene generation (Gemini image model) with upload as the fallback, `/admin/site` editor (view scene, pan/zoom, draw/move/delete polygons, name + department), SOP↔machine linking from both the builder's SOP-level panel and the machine editor, a deployed eval.

**Out of scope:** the worker home (52), pins/badges (52), phone/QR scanning and printable plates (53 — but the short `code` column is created here), admin inbox and health repaint (54), multi-site picker UI (model allows many layouts; UI ships when a second site exists), sprite-per-machine generation (nice-to-have inside the generator, not required), Three.js.
</domain>

<decisions>
## Implementation Decisions

### Data model
- D-01: Three tables, org-scoped, admin-only writes:
  - `site_layouts(id, organisation_id, name, scene_path, scene_width int, scene_height int, created_at, updated_at)` — one row per site; v1 UI works with the org's first/only layout.
  - `site_machines(id, site_layout_id, organisation_id, name, department_id null, polygon jsonb [[x,y],…] in scene px, sprite_path null, code text unique short (for `/m/<code>`, Phase 53), sort int, created_at, updated_at)`.
  - `sop_machines(sop_id, machine_id, organisation_id, primary key (sop_id, machine_id))` — N:M; a SOP with no machine is valid.
- D-02: **Polygons are stored in scene-pixel space** (the image's natural width/height, recorded on the layout). Renderers scale; nothing ever stores viewport coordinates.
- D-03: RLS follows the 2026-08-04 learnings exactly: every policy on all three tables conjoins `organisation_id = current_organisation_id()`; write policies for admin/safety_manager only; **any `WITH CHECK` restates the full `USING` predicate**. `tests/lint/rls-org-scope.spec.ts` must pass unchanged. `organisation_id` is denormalised onto `site_machines` and `sop_machines` so no policy needs a cross-table subquery (00031 recursion class).
- D-04: Server actions in `src/actions/site.ts` use the session client + `requireAdminContext()`; if a junction write needs the service-role client (as Phase 25's `assign*Departments` did), the action must self-enforce org scope on the parent rows (2026-06-15 learning).

### Scene assets
- D-05: New **private** storage bucket `site-scenes` (JPG/PNG, ≤ 15 MB); scenes are served via signed URLs the same way SOP images are today. Path convention `<organisation_id>/<layout_id>/scene.<ext>`.
- D-06: **Generate** = a server action/route that calls the Gemini image model (`gemini-3.1-flash-image-preview`, the model the sketch used through the `nano-banana-2` MCP) with the validated style prompt from `.planning/sketches/007-plant-floor-navigation/README.md` § Assets, prefixed by the admin's one-paragraph description; 16:9, 2K. Requires `GEMINI_API_KEY` on Railway — **absent key → the Generate control is hidden and only Upload shows**, never a broken button (2026-06-02 model-rot class: surface the failure, don't fail open). Add the key to `.env.example` and the Railway checklist.
- D-07: **Upload** = the existing shared file-intake component from Phase 40 where it fits, otherwise a plain input; HEIC not needed here. Record natural width/height on the layout row at upload/generation time (server-side probe, e.g. `sharp` if present, else read from the client `Image` and pass through).

### Machine editor (`/admin/site`)
- D-08: Route `src/app/(protected)/admin/site/page.tsx`, admin-gated by the shared `requireAdminContext()` (server) + lazy client editor (`next/dynamic({ ssr:false })`) so Konva never enters any worker bundle. Header gets a "Site" entry in `ADMIN_LINKS` (Team · Site · Settings order is fine); `journeys.ts` updated in the same change.
- D-09: Editor built on **Konva / react-konva** (already installed for Phase 26 annotation; reuse its stage/pan-zoom idiom if one exists — check `src/components/sop/annotation/*` first). Interactions: pan (drag empty), wheel zoom-to-cursor, **Draw machine** mode (click to add vertices, click first vertex or double-click to close), select a machine (fill + vertex handles), drag a vertex, delete (button + `Delete` key), rename inline, department select, save is per-change (debounced server action) with a small "Saved ✓" state.
- D-10: The machine list sits in a right panel (name · department · linked-SOP count · "Show SOPs" → the SOP list for that machine with unlink). Sketch 007's panel styling (paper/ink tokens, mono labels) applies; use the token utilities, never raw palette classes (`tests/lint/design-tokens.spec.ts`).
- D-11: Empty state when the org has no layout: two large choices — **Generate from a description** (textarea + Generate) and **Upload an image**. After either, the editor opens on the scene.

### SOP ↔ machine linking
- D-12: The builder gets a **Machines** multi-select (org-scoped, grouped by department, searchable) that writes `sop_machines` through the same server action the editor uses. **Research correction (2026-09-28):** there is no SOP-level metadata panel — `SopDepartmentEditor.tsx` has zero call sites. The picker is a new row in `BuilderStageShell.tsx`'s `ToolsMenu`, opened as a portaled modal exactly like `BuilderFlowButton.tsx`.
- D-13: Deleting a machine cascades `sop_machines`; deleting a SOP cascades `sop_machines` (FK `on delete cascade`); a department delete sets `department_id` null (never deletes machines).

### Testing & verification
- D-14: Source-contract specs for: the RLS shape (extend the existing lint spec's table list if it enumerates tables), the admin-only route guard, the dynamic import of the editor, the Gemini-key gate. Runtime: one integration spec that inserts a layout + machine + link as the eval admin and reads it back through RLS as the eval worker (must be visible) and as a foreign-org session (must be empty) — the 2026-07-20 (role × own/other × same/cross-org) matrix, at least the cross-org and worker-read cells.
- D-15: Deployed eval `tests/evals/site-editor.eval.ts`: upload a fixture PNG (generation is not exercised on prod in the eval — no paid call in CI), draw two polygons, name them, link the fixture SOP, reload, assert all three persist; screenshot at 1440px read by the orchestrator. Fixture accounts per `tests/evals/lib/session.ts`.

### Claude's Discretion
- Exact column types for `polygon` validation (Zod: array of ≥3 `[number, number]`), debounce interval, vertex-handle size, whether `code` is generated as base32 6-char or nanoid — pick and state in the plan.
- Whether generation runs in a server action or an API route (prefer an API route if the call can exceed the action timeout on Railway).
- Whether to store the scene's natural size by probing server-side or from the client — either, as long as it is recorded before the first polygon is drawn.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` — the decision, data model, renderer contract, pins vocabulary, assets/prompt, what to avoid
- `.planning/sketches/007-plant-floor-navigation/README.md` — asset prompts, open questions, production notes
- `.planning/sketches/007-plant-floor-navigation/index.html` — pan/zoom/hotspot maths (fit, zoom-to-cursor, fly-to with panel offset), polygon coordinates on a 2000×1116 scene

### Codebase rules that bind this phase
- `CLAUDE.md` § Learnings — 2026-08-04 (RLS OR-combination, `WITH CHECK` restates `USING`), 2026-06-15 (junction writes + service-role self-scoping), 2026-07-05 (SECURITY DEFINER / RPC exposure), 2026-09-28 (`@theme` import), 2026-07-14 (undefined CSS tokens)
- `tests/lint/rls-org-scope.spec.ts`, `tests/lint/design-tokens.spec.ts`, `tests/lint/no-static-admin-lens-import.spec.ts` — must stay green
- `src/lib/auth/guards.ts` (`requireAdminContext`), `src/lib/auth/session-context.ts`
- `src/actions/departments.ts` / `assignSopDepartments` — the junction-write idiom to mirror
- `supabase/migrations/00062_*.sql`, `00061_*.sql` — the current RLS shape to copy
- `.planning/codebase/CAPABILITY-MATRIX.md` — add the new capability rows (site layout read: all roles in org; write: admin, safety_manager)
- `src/lib/journeys/journeys.ts` — add the `/admin/site` route in the same change
- `tests/evals/lib/session.ts`, `scripts/eval-fixtures.mjs` — eval session minting
</canonical_refs>

<specifics>
## Specific Ideas

- The sketch's hotspot polygons for a 2752×1536 scene were authored in a 2000×1116 display space; production stores natural-pixel coordinates, so the editor must convert pointer → scene px through the current stage transform (Konva `getRelativePointerPosition()` does this).
- Generation prompt shape (validated 2026-09-28, first shot): *"Clean isometric 3D illustration of a {industry} plant floor, 30° isometric, cutaway building, no roof, low walls. Crisp vector-isometric render, soft studio lighting, muted industrial palette (concrete grey floor with subtle 1 m grid, steel-blue and safety-yellow machines, warm orange glow only at {hot zone}) on plain #fafafa. No people, no text, no labels, no logos. Layout left→right with clear walkway gaps between every machine group so each is a distinct clickable object: …"* — the admin's paragraph replaces the numbered layout list.
- Backgrounds from the model are opaque `#fafafa`; the editor canvas background should be the same token so the scene edge is invisible.
- Prod org `bd2c2b88…` has departments General, Forming, Engineering — the department select is those rows, not a hardcoded list.
</specifics>

<deferred>
## Deferred Ideas

- Sprite-per-machine generation (button on a machine → Gemini "single {name}, isolated on #fafafa") — 54 or later.
- Multi-site picker; site-level access (Visy: ~100 sites) — needs the v9.0 site-overlay model first.
- Admin bulk "auto-detect machines" from the generated image (vision model proposes polygons) — a spike, not a phase task.
- Printable QR plates — Phase 53 (the `code` column is created here so plates can be printed later without a migration).
</deferred>

---

*Phase: 51-site-model-machine-editor*
*Context gathered: 2026-09-28 (orchestrator-compiled, no question round)*
