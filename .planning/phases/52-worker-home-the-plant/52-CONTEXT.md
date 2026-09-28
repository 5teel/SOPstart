# Phase 52: Worker Home — The Plant - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning
**Source:** Orchestrator-compiled from sketch 007 (winner "Plant"), the wrapped design contract `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md`, Phase 51's shipped data model (`51-0x-SUMMARY.md`, `51-VERIFICATION.md`), and Simon's decisions of 2026-09-28 ("Go ahead with 007", "Forget the shared terminal"). No discuss-phase question round was run.

<domain>
## Phase Boundary

The **worker's desktop home**. A worker at ≥1024px opens `/sops` and is standing above their site: the Phase 51 scene with its machines, an amber pin on every machine that has something due for them, one Now card with the single next procedure, an ask bar that highlights machines as they type. Clicking a machine flies to it and opens a panel listing its SOPs. The scope column and the Miller frame **do not render for workers**.

**In scope:** the scene renderer for the worker (read-only: pan, zoom, fly-to, hover labels, department chips), derived pins, the Now card, the machine panel (worker variant), the ask bar hookup, the no-scene fallback, the bundle gate, the deployed eval, `journeys.ts`.

**Out of scope:** the phone layout (53 — but nothing here may break the existing <1024px worker list, which stays as-is until 53), QR plates (53), the admin repaint / inbox / library table and the deletion of `AdminSopSurface` + lenses + `MillerPrimitives` + `SopWorkerBrowser` (54 — admins keep today's `/sops` this phase), the site editor (51, done).
</domain>

<decisions>
## Implementation Decisions

### Rendering model
- D-01: The worker home is a **client component tree loaded through `next/dynamic({ ssr:false })`** from `src/app/(protected)/sops/page.tsx`, rendered INSTEAD OF `SopsSection`'s Miller frame when `!isAdmin && viewport ≥ 1024px && org has a site layout`. Admins keep the current surface unchanged this phase (54 replaces it). Below 1024px the existing stacked worker list renders unchanged.
- D-02: **No Konva for the worker.** The read-only scene is an `<img>` at natural size inside a transformed `world` div with an SVG polygon overlay — exactly the sketch's approach (`.planning/sketches/007-plant-floor-navigation/index.html`). Konva stays admin-only (Phase 26/51 isolation gates). The bundle cost is the transform maths and one SVG.
- D-03: Scene image via the same signed-URL helper Phase 51 uses (`site-scenes` bucket, 3600 s TTL), fetched by a server action (`listSiteForOrg` already returns the layout + machines for admins — add or reuse a **worker-readable** variant that returns only what the worker needs: layout id, signed scene URL, width/height, machines `{id, name, department_id, polygon}`; RLS already allows same-org SELECT).
- D-04: **Fallback**: if the org has no layout, or the layout has zero machines, the worker sees today's list exactly as now (the frame with "Your SOPs / Library / By department"). Never a blank. The Now card may still render above the list when there is something due.

### Pins (HOM-02)
- D-05: Pins are **derived, never stored**. Source = the same data `useAssignedSops` / the worker list already computes per SOP (`isAssigned`, refresher-due, updated-since-read, never-done) joined to `sop_machines`. A source-contract test pins that no new table, store or column backs the count (grep: no `pin` column in migrations, no new Zustand store, no Dexie table).
- D-06: Pin = count of that machine's SOPs where `rel ∈ {due, never, new}` for the viewer (sketch vocabulary: `DUE` amber · `UPDATED` blue · `NEVER DONE` red · `DONE` outlined grey). Machines with a pin get the dashed amber polygon tint and show their label on world-hover; machines without a pin show label on hover only. Counts appear ONLY on pins — no decorative counts anywhere (contract § What to avoid).

### Camera (HOM-01)
- D-07: Fit = `min(W/sceneW, H/sceneH) × 1.02`, centred; **re-measure on every fit** (a stage built while hidden measures 0×0 — bug found in the sketch, twice). Wheel zoom toward cursor, clamp 0.35–2.4. Drag-pan on the world, ignoring drags that start on a polygon. Fly-to on machine click: scale 1.5, target point offset left so the 380 px panel never covers it (`targetX = (W − 380) / 2`). Department chips tint that department's polygons and fit the camera to their bounding box (`min((W−80)/bw, (H−120)/bh, 1.6)`). Transitions 350 ms ease; `prefers-reduced-motion` → no transition.
- D-08: Pan/zoom state is **`useState` + `window.history.replaceState`** if any URL sync is wanted (CLAUDE.md 2026-05-13: never `router.push` on a hot path). Default: no URL sync in this phase.
- D-09: Never derive first-render output from `window`/`navigator` (2026-06-08 hydration): the stage mounts with a neutral transform and fits in an effect.

### Now card (HOM-03)
- D-10: Bottom-left over the scene, 330 px, ink-900 border. `NEXT FOR YOU` + badge · title · mono meta (machine · department · ~min · last done) · **Walk it** (primary → the existing SOP page `/sops/[sopId]?tab=walk`) · **Show me** (fly to the machine and open its panel) · "Then:" up to two more lines. Ordering: due → never done → updated → nothing (card hidden, or shows "Nothing due — browse your machines"). The card's data is the same derived list as the pins.

### Machine panel — worker variant (HOM-04)
- D-11: Right, 380 px, slides in. Sprite (from `site_machines.sprite_path`, signed) or "no photo yet" · department name in its zone colour · machine name · SOP rows **to-do first** with the shared badge set · `Walk ›` per row (→ `/sops/[sopId]?tab=walk`; plain `Read` → `/sops/[sopId]`). Empty: "No procedures for this machine yet." Close → fit. No admin controls, no owner/rev lines (54 adds the admin variant).
- D-12: Zone colours from the department row's `colour` when set, else the contract's fallback triple (Forming `#ea580c` · General `#2563eb` · Engineering `#7c3aed`) — but expressed as tokens/inline `var()` per the design-token lint, never raw hex in component code.

### Ask bar (HOM-05)
- D-13: The existing toolbar search input becomes the ask bar on the plant view: as the worker types, machines whose name or any linked SOP title matches get the hover tint + label; the list inside an open panel narrows too. The mic button routes to the **existing** voice Q&A entry (find the current voice component/hook used on the SOP page — do not build a new voice path). If no voice entry exists at list level, the mic opens the SOP-level voice on the Now card's SOP; state that choice in the plan.

### Bundle (HOM-06)
- D-14: `scripts/check-bundle-size.ts` gates `/sops/page` at ±2 KB against `.bundle-baseline.json` (unchanged since 736f44a — **never recapture**; 2026-09-13). Everything new is inside the dynamic module; the page adds only the gate condition and the render slot. The scene `<img>` is `loading="lazy"` and `decoding="async"`.

### Testing & verification
- D-15: `tests/phase52/` project (register in `playwright.config.ts`, verify with `--list`). Source-contract specs: dynamic import + `ssr:false`; no Konva import anywhere under the worker home dir (extend `konva-worker-isolation.spec.ts` to forbid it there); no new store/table for pins; camera maths constants (1.02, 0.35, 2.4, 380) present; Now-card ordering pure function unit-tested under `src/lib/site/__tests__/` (phase15-unit style, static imports).
- D-16: Deployed eval `tests/evals/plant-home.eval.ts` as `eval-worker@sopstart.com` **in the eval-site org** (Phase 51's `eval-site-admin` org, fixture SOP linked to "EVAL Press") — assert: scene renders (img natural size known), at least one polygon, pin count on EVAL Press ≥ 1 once the fixture SOP is assigned to the eval worker, click → panel lists the fixture SOP with a badge, Walk it href is `/sops/<id>?tab=walk`, department chip fits camera (transform changes), no scope column (`worker-miller-scope` testid absent), no console errors; 1440×900 screenshots read by the orchestrator. Worker with NO site (the real SOPstart org's `eval-worker`) still sees the list — second test.

### Claude's Discretion
- Whether the derived-pin computation lives in a hook (`usePlantPins`) or a pure function fed by `useAssignedSops` — pure function preferred (unit-testable).
- Whether the dynamic module is one file or a small folder `src/components/sop/plant/`; keep Konva out either way.
- Exact label pill styling and pin animation (sketch: 26 px circle, 1.6 s bob) — tokens only.
</decisions>

<canonical_refs>
## Canonical References

### Design contract
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` — personas, renderer contract, pins vocabulary, Now card, panel, what to avoid
- `.planning/sketches/007-plant-floor-navigation/index.html` — the validated pan/zoom/fly-to/chip maths and the worker/admin repaint logic (`buildStage`, `paint`, `renderNow`, `open`)

### Phase 51 (the data)
- `.planning/phases/51-site-model-machine-editor/51-03-SUMMARY.md` (`src/actions/site.ts` exports and return shapes), `51-02-SUMMARY.md` (tables + RLS: same-org SELECT for all roles), `51-05-SUMMARY.md` (workspace/panel conventions), `51-07-SUMMARY.md` + `tests/evals/site-editor.eval.ts` (eval-site org fixture, session minting)
- `src/lib/site/scene.ts`, `src/lib/validators/site.ts`

### Codebase rules that bind this phase
- `CLAUDE.md` § Learnings — 2026-09-28 (empty-locator hangs; OTP budget), 2026-09-27 (shared section classifier; multi-procedure), 2026-09-13 (baseline is not a tuning knob; role-gated UI = separate lazy module), 2026-05-13 (no router.push on hot paths), 2026-06-08 (hydration), 2026-07-14 (undefined tokens), 2026-06-05 (source-contract ≠ wiring)
- `src/app/(protected)/sops/page.tsx` — the current worker page: `useAssignedSops`, `useSopSync`, `SopsSection`, `SCOPE_LABEL`, the mobile strip; the Phase 41 render-slot seam (`AdminSopSurface` children render-prop) is the pattern for slotting the plant view in
- `src/components/sop/SopWorkerBrowser.tsx` — badge/signal vocabulary already in use for worker rows (reuse, don't fork)
- `scripts/check-bundle-size.ts`, `.bundle-baseline.json`
- `tests/evals/lib/session.ts`, `scripts/eval-fixtures.mjs` (eval-site org from 51-07)
- `src/lib/journeys/journeys.ts` — update the worker `/sops` journey in the same change
</canonical_refs>

<specifics>
## Specific Ideas

- Sketch's worker paint: `pip.className = n ? 'pip due' : ''`, label pinned on hover when `n>0`, polygon `.due` dashed amber. Admin variant is NOT this phase.
- Now card "Show me" and a panel row share `open(machine)`; close → `fit()`.
- Real data today: one org (SOPstart) with departments General / Forming / Engineering, 33 SOPs, 4 published. The real org has NO site layout yet — the fallback path is what Simon will see until he draws one at `/admin/site`. The eval-site org has a scene + "EVAL Press" (Forming) + "EVAL Oven".
</specifics>

<deferred>
## Deferred Ideas

- Phone home + QR (53). Admin repaint, inbox, table, lens deletion (54). URL sync of camera state. Sprite generation per machine. Multi-site picker.
</deferred>

---

*Phase: 52-worker-home-the-plant*
*Context gathered: 2026-09-28 (orchestrator-compiled, no question round)*
