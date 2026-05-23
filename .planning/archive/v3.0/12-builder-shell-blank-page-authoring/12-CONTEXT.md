# Phase 12: Builder Shell & Blank-Page Authoring - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Puck-based admin builder at `/admin/sops/builder/[sopId]` that produces `layout_data` JSONB on `sop_sections` (pinned to `layout_version = 1`), with 7 shared block components (Text, Heading, Photo, Callout, Step, HazardCard, PPECard) rendering identically in the admin editor and the worker walkthrough. Entry point is a blank-page wizard at `/admin/sops/new/blank`. Workers fall back to the existing linear renderer when `layout_data` is null or the version is unsupported.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `12-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `12-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- `@measured/puck` install + Next.js 16 integration (`'use client'` + `next/dynamic({ ssr: false })`)
- Admin builder route `/admin/sops/builder/[sopId]` with Puck editor
- 7 block components at `src/components/sop/blocks/` (Text, Heading, Photo, Callout, Step, HazardCard, PPECard)
- Migration `00020_section_layout_data.sql` — additive `layout_data JSONB` + `layout_version INT` on `sop_sections`
- Blank-page wizard at `/admin/sops/new/blank` (4 steps, canonical-kind checklist)
- `sops.source_type` column (enum `uploaded|blank|ai|template`)
- `reorderSections` server action
- Draft auto-save via reused Phase 3 sync-engine
- Worker branching in `SectionContent.tsx` for layout_data-backed sections + linear fallback
- `AUTHORED IN BUILDER` chip in admin library

**Out of scope (from SPEC.md):**
- AI-drafted SOPs — Phase 14
- NZ template library — Phase 15
- Reusable block library (save/browse hazards, PPE, steps) — Phase 13
- DiagramHotspotBlock + Konva annotation editor — Phase 16
- Collaborative/multi-admin editing — Phase 17
- Pipeline integration and bundle isolation — Phase 18
- Worker walkthrough redesign (immersive mobile step view, voice input) — separate future phase

</spec_lock>

<decisions>
## Implementation Decisions

### Builder chrome + preview
- **D-01:** Port the sketch's desktop/mobile preview toggle to the real builder as a **persistent top bar**. Reuses the CSS approach from `sketches/sop-blueprint/index.html` (commit `64f1bec`) — mobile view renders the canvas inside a 430px phone frame. Matches SPEC constraint that reflow is Tailwind-only; zero new design work.
- **D-02:** Section navigation uses a **left sidebar** with the section list. Click to switch between sections; drag handles on each row drive the `reorderSections` server action (SB-SECT-05). Consistent with the sketch's left-panel pattern.
- **D-03:** Save-state indicator is a **mono-font pill in the top-right chrome**. States: `SAVED 2s AGO` / `SAVING…` / `OFFLINE · QUEUED`. Visible at all times; does not steal canvas space.
- **D-04:** Publish is wired through the existing Phase 2 review flow. Builder has a primary `SEND TO REVIEW` button that navigates to `/admin/sops/[sopId]/review` — the existing page is the single source of truth for the publish workflow.

### Draft persistence + sync
- **D-05:** Dexie table **`draftLayouts` uses one row per section**, keyed by `section_id`. Matches the Supabase row shape 1:1, enables partial sync on flaky networks, and pairs naturally with the sync-engine's per-record flush.
- **D-06:** Auto-save cadence **confirms SPEC defaults**: 750ms debounce on Dexie writes, 3s flush to Supabase. Matches the Phase 3 sync-engine (`src/lib/offline/sync-engine.ts`) exactly.
- **D-07:** Reconnect conflict resolution is **last-write-wins by client timestamp**. Each Dexie row carries `updated_at`; on flush, it is written to Supabase and the server's `updated_at` is set to match. If the server row is newer (another admin edited), the local Dexie value is overwritten and the admin sees a quiet toast: `Updated by another admin`. No merge UI — proper collab is Phase 17.
- **D-08:** Dexie row **persists as an offline cache after successful server ack**; it is purged only when the SOP is published (at which point the row moves into the existing `sopCache` read path). Enables offline authoring across tab reloads; bounds Dexie storage growth.

### Block component API
- **D-09:** Zod prop schemas are **co-located** in each block's file. `src/components/sop/blocks/TextBlock.tsx` exports both `TextBlock` and `TextBlockPropsSchema`. The Puck config imports schemas from each block file; no central `validators/blocks.ts` registry.
- **D-10:** Block components are **environment-agnostic** — no mode detection (no context provider, no `mode` prop). Admin-only affordances (e.g. "click to upload photo") live in Puck Fields (admin) or are no-ops in the worker render path. Guarantees SPEC's "single component tree" grep assertion.
- **D-11:** Block export shape: **named function export + named schema**. `export function TextBlock(props)` and `export const TextBlockPropsSchema`. Matches the SPEC acceptance grep (`export (function|const) (Text|Heading|…)Block`); supports tree-shaking and IDE rename refactors.
- **D-12:** Block styling is **fully Tailwind, inside the block, no external className prop**. Blocks do not accept a `className` prop. Guarantees admin/worker HTML parity for the SPEC's "identical rendering" assertion.

### Error resilience
- **D-13:** Unknown block type (layout_data references a type not in the Puck config) → **skip the single unknown block, render the rest**. The unknown block position shows a small grey placeholder: "This block isn't supported in your app version — update required." A single warning is logged per page load.
- **D-14:** Invalid or missing props on a known block → **render the block with a visible empty-state**. `PhotoBlock` with no `src` shows a dashed placeholder labelled "Photo missing"; `HazardCardBlock` with no title shows "Untitled hazard". Worker still sees the section structure; warning logged once per page.
- **D-15:** Structurally broken `layout_data` (fails Zod parsing of the outer shape) → **full fallback to the legacy linear renderer for that section**. Other sections of the same SOP render normally. Matches SPEC's fallback intent (SB-LAYOUT-06); logs `[layout] parse failed for section {id}, fell back to linear`.
- **D-16:** Admin-side error surfacing inside the builder: **inline red-outline per block with prop-level hint** (e.g. "Missing: src") + **section-level toast** for corrupt layout_data ("This section has broken layout data — revert to last save?"). Errors are visible during authoring, not deferred to publish time.

### Claude's Discretion
- **Wizard flow (client vs server per step)**: not discussed — default to a client-only stepper that assembles all 4 steps in local state and commits the SOP + sections in one `createSopFromWizard` server action on final submit. Cleaner rollback; resumable via local state only for the current tab session.
- **Puck version pin**: researcher picks the latest stable `@measured/puck` version at the time of planning. Pin exact version in `package.json` (not caret). Flag the pick in CONTEXT or RESEARCH if version risk is non-trivial.
- **`reorderSections` atomicity**: default to a single Supabase transaction that rewrites `sort_order` for all affected rows. If Supabase JS SDK lacks transaction support for this shape, the planner may adopt the "sequence bump + unique deferred index" pattern.
- **Block inline editor UX**: default to Puck's standard side-panel (admin clicks block → props appear in the right sidebar). Do not invent a custom editor surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 specification
- `.planning/phases/12-builder-shell-blank-page-authoring/12-SPEC.md` — Locked requirements, boundaries, acceptance criteria. MUST read before planning.

### Project-level
- `.planning/REQUIREMENTS.md` §SB-AUTH-01, §SB-AUTH-04, §SB-AUTH-05, §SB-SECT-05, §SB-LAYOUT-01..04, §SB-LAYOUT-06 — Requirement specifications for this phase.
- `.planning/PROJECT.md` — Project vision, validated capabilities (Phases 1–11), non-negotiables.
- `.planning/ROADMAP.md` §"Phase 12: Builder Shell & Blank-Page Authoring" — Phase goal and success criteria.

### Phase 11 foundation (read-only dependency)
- `supabase/migrations/00019_section_kinds_and_blocks.sql` — `section_kinds` catalog, `sop_sections.section_kind_id` FK, `blocks` + `sop_section_blocks` + `block_versions` tables. Phase 12 builds on top of this additively.
- `src/components/sop/SectionContent.tsx` — Current linear renderer. Phase 12 adds a single branch to this file for the Puck-rendered path.
- `src/types/sop.ts` — Existing `Sop`, `SopSection`, `SopStep`, `SopImage` types. Phase 12 extends `SopSection` with `layout_data` + `layout_version` and adds block prop interfaces.

### Phase 3 offline infrastructure (reused pattern)
- `src/lib/offline/sync-engine.ts` — Sync pattern this phase must reuse. Debounced Dexie writes + background Supabase flush + last-write-wins reconciliation.
- `src/lib/offline/db.ts` — Existing Dexie schema. Phase 12 adds a `draftLayouts` table via schema version bump.
- `src/hooks/useSopSync.ts` — Existing sync hook pattern to model `useDraftLayoutSync` on.

### Phase 2 publish gate (wiring target)
- `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` — Existing admin review page. Phase 12's builder navigates here via `SEND TO REVIEW`.
- `src/actions/sops/publish.ts` — Existing server action called from review. Both upload and builder paths MUST call this same action (SPEC requirement SB-AUTH-05).

### Sketch reference (design DNA)
- `sketches/sop-blueprint/index.html` — Standalone HTML sketch introducing the desktop/mobile preview toggle pattern (commit `64f1bec`) and the tab-based artifact switcher aesthetic. Phase 12's builder chrome ports the preview toggle CSS; the sketch is throwaway reference material, not production code.

### Phase 11 stub tests (to be flipped from test.fixme)
- `tests/sb-layout-editor.test.ts` — SB-LAYOUT-01..06 assertions.
- `tests/sb-builder-infrastructure.test.ts` — Builder setup + Puck integration assertions.
- `tests/sb-section-schema.test.ts` — Section schema assertions (already passing for Phase 11 scope; verify no regression).

### External documentation
- `@measured/puck` — React drag-and-drop page builder. Planner to fetch via Context7 or read official docs when specifying integration shape. Pin exact version.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/offline/sync-engine.ts`**: Existing debounced Dexie + Supabase sync with LWW. Phase 12's `draftLayouts` table plugs in as a new record type, reusing the debounce/flush cadence exactly (D-06).
- **`src/lib/offline/db.ts`**: Existing Dexie database — add `draftLayouts` in a schema version bump. Same pattern used for `photoQueue`, `sopCache`, `completionQueue`.
- **`src/actions/sections.ts`**: Existing server actions for section CRUD. Add `reorderSections` and `updateSectionLayout` here.
- **`src/actions/sops/publish.ts`**: Existing publish action. Do not duplicate — both upload and builder paths must call it (SPEC SB-AUTH-05).
- **`src/components/sop/SectionContent.tsx`**: Current linear renderer. Add the Puck `<Render>` branch to this file; preserve the legacy path byte-identical for SOPs with `layout_data = null`.
- **Tailwind config**: `md:` = 768px, `lg:` = 1024px (defaults). Phase 12 preview toggle uses these exact breakpoints — no custom values needed.
- **`next-themes`**: Dark mode default is already configured project-wide. Block components inherit this.

### Established Patterns
- **Server actions in `src/actions/`**: All mutations. Next.js 16 App Router, `'use server'` directive, Zod validation inline.
- **Zod validators in `src/lib/validators/`**: Shared validation schemas. Phase 12 deviates: block prop schemas live with the block (D-09), but the broader SOP schemas remain in `validators/`.
- **Supabase RLS**: All `sop_sections` reads/writes are org-scoped. Phase 12's `layout_data` column inherits the existing RLS policies — no new policies needed, verify during planning.
- **Playwright test projects**: `phase12-stubs` project to be added to playwright.config.ts matching `tests/sb-*.test.ts` — consistent with `phase2-stubs` / `phase6-stubs` convention.
- **Client-side Puck via `next/dynamic({ ssr: false })`**: matches the existing pattern for other client-only heavy components (zoom plugin, walkthrough store).

### Integration Points
- **Admin navigation**: Add "New SOP → From scratch" entry point alongside existing "From document" under `/admin/sops/page.tsx`. Wizard lives at `/admin/sops/new/blank`; builder at `/admin/sops/builder/[sopId]`.
- **Worker walkthrough**: Single branching check inside `SectionContent.tsx`. No changes to walkthrough routing, store, or offline cache.
- **SOP library listing**: `/admin/sops/page.tsx` renders the list; add `AUTHORED IN BUILDER` chip when `source_type != 'uploaded'`.
- **Dexie schema migration**: Bump the Dexie version number when adding `draftLayouts` — verify no conflict with the offline DB version bumped in Phase 5.

</code_context>

<specifics>
## Specific Ideas

- Admin-side error treatment mirrors VS Code's inline diagnostics: red outline on the offending block + hover hint. No intrusive modals during active editing. (From discussion on Area 4.)
- The `SEND TO REVIEW` button should feel like a commit gate, not a silent save. One explicit click from admin → transitions SOP status from `draft` to `review`. No auto-transition on any other action.
- Sketch's `JetBrains Mono` aesthetic is a design DNA cue, not a mandate. Builder uses existing project fonts unless the designer explicitly requests the mono treatment on chrome labels. Planner flags font choice only if it surfaces during design review.

</specifics>

<deferred>
## Deferred Ideas

- **Wizard resumability across tab close** — current decision (D-16 in Claude's Discretion) keeps wizard state in local React state only. A resumable cross-tab wizard would use sessionStorage or the Dexie `draftWizards` table. Deferred until usage tells us wizards are getting abandoned mid-flow.
- **Block inline comments for admins** — a future Phase 17 feature. Not in scope here.
- **Puck's "auto-generated preview from fields"** — Puck supports auto-deriving a preview from field definitions. Out of scope for Phase 12; each block renders its own preview identical to worker render (D-10, D-12).
- **Custom admin tokens / theming** — the builder uses the same theme as the rest of the admin UI. Per-org theming is a larger Phase 99.x concern.

### Reviewed Todos (not folded)
None — todo.match-phase returned no matches for Phase 12.

</deferred>

---

*Phase: 12-builder-shell-blank-page-authoring*
*Context gathered: 2026-04-24*
