# Phase 13: Reusable Block Library — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning (after corpus pass)

<domain>
## Phase Boundary

Admin can save, browse, and re-use hazard / PPE / step blocks from an org-scoped library
alongside a read-only NZ global block set. The blank-page wizard surfaces matching blocks at
the right step with explicit pin-version vs follow-latest semantics. SOPs render their
snapshot content forever (offline-safe) regardless of later edits to the source block.

**In scope:** Block CRUD, NZ global seed, wizard picker, pin-vs-follow toggle, update badging
+ publish gate, super-admin UI for Summit to curate global blocks, "suggest for global"
queue, snapshot-on-add via `sop_section_blocks` junction.

**Out of scope (deferred or other phases):** Semantic / embedding-based block matching;
auto-promotion of org blocks to global based on usage thresholds; nested category hierarchy;
collaborative block editing (Phase 17 territory); image / diagram annotation in blocks
(Phase 16).

**Prerequisite:** Corpus analysis pass (see `13-CORPUS-ANALYSIS.md`, to be produced before
plans are written) — derives the controlled category vocab, NZ global seed list, picker
priority signals, and org-vs-global split heuristic from the user's existing 684-file SOP
corpus.

</domain>

<decisions>
## Implementation Decisions

### Corpus Analysis Pass (prerequisite)

- **D-Corpus-01:** A one-shot corpus analysis pass runs **before** Phase 13 plans are written.
  Output: `13-CORPUS-ANALYSIS.md` consumed by plans 13-02 (NZ seed) and 13-03 (picker).
- **D-Corpus-02:** Corpus location: `C:\Development\SOPstart\SOPstart - Raw SOPs` — 684 files
  (666 `.doc` legacy, 17 `.docx`, 1 `.pdf`, 1 `.xls`, plus a couple of jpg/dsstore to ignore).
  The filename schema (`EN-FOR-02-001 …`) encodes department/category and is itself a signal.
- **D-Corpus-03:** Pass output covers all four signals:
  1. Category taxonomy (flat controlled vocab, ~20-50 tags) derived from clustering
  2. Seed list of NZ global blocks (hazards / PPE / steps recurring across orgs/depts)
  3. Picker priority signals (which categories co-occur with which SOP types)
  4. Org-vs-global split heuristic (frequency + specificity scoring)
- **D-Corpus-04:** Tooling: `mammoth` cannot read `.doc` (binary, pre-2007). Pass needs
  LibreOffice headless conversion (`soffice --headless --convert-to docx`) or `antiword` /
  `textract` in the pipeline. ~666 of 684 files require this step.
- **D-Corpus-05:** Pass is a **one-shot** before plans. It is not part of the production app
  surface. The output document is reviewed by Simon, then plan 13-02 turns the seed list
  into a migration verbatim (per D-Global-03).

### Save-from-section UX

- **D-Save-01:** Trigger is the **three-dot (`⋯`) menu on the block in the builder**, with a
  "Save to library" item. Pattern matches Notion / Figma. Menu also exposes existing
  delete / duplicate / convert-to-section actions if/when they exist.
- **D-Save-02:** Save modal asks:
  - **Name** (required, free text)
  - **Categories** (optional, multi-select from controlled vocab + free-text tags allowed)
  - **Scope**: `My org only` (default) or `Suggest for global` (queues for Summit review —
    see D-Global-02)
  No description, no industry, no version notes — keep flow short. Block content is taken
  from the block as authored; it can be edited later in `/admin/blocks/[blockId]`.

### Category Taxonomy

- **D-Tax-01:** **Flat controlled list + free-text overlay.** Controlled list (~20-50 tags
  derived from corpus pass — D-Corpus-03) is filterable in the picker. Free-text tags are
  searchable but not faceted. Both stored on the block.
- **D-Tax-02:** Controlled vocab is **locked, version-controlled in a migration**. Adding a
  tag is a SafeStart release. Admins request new tags via Summit. This prevents tag-soup
  fragmentation and keeps picker filters stable across orgs.
- **D-Tax-03:** **Both SOP-level and block-level** categories. SOPs get a category tag at
  creation (default inferred from filename pattern when ingested, settable in builder); each
  block gets its own categories. The SOP's category is the picker's pre-filter input
  (see D-Pick-01).

### Picker Matching Logic

- **D-Pick-01:** Default query is **kind + SOP category**. E.g. clicking "Pick from library"
  at a hazards step in a `machinery-forming`-tagged SOP returns hazard blocks tagged
  `machinery-forming` (or the closest related tag). Falls back to all blocks of kind on zero
  matches (D-Pick-03). No embeddings / text-similarity in v1 — defer to a future phase if
  the picker proves weak in real use.
- **D-Pick-02:** **Compact list + side-preview pane**. Each row: name, category chips,
  last-updated, usage count ("used in 12 SOPs"). Click row → right-side preview shows the
  block rendered as a worker would see it. No card grid in v1.
- **D-Pick-03:** **Zero-matches behaviour: fallback to all blocks of kind, with dimmed
  banner**: "No blocks tagged for [SOP category]. Showing all [kind] blocks." Don't
  dead-end the admin or push them to Write New unnecessarily.

### Global Block Curation

- **D-Global-01:** **Summit team owns global blocks via a super-admin UI** at
  `/admin/global-blocks` (gated to a new `is_summit_admin` flag — implementation detail,
  Claude's discretion how it's encoded: column on `auth.users`, JWT claim, or a separate
  `summit_admins` table). Initial seed comes from the corpus pass migration (D-Global-03);
  ongoing curation happens via this UI without code releases.
- **D-Global-02:** **"Suggest for global" save scope writes to a `block_suggestions` table**
  visible only to Summit super-admins. Summit can **promote** (copy to global,
  `organisation_id = null`) or **reject** (leave as org-scoped, mark suggestion closed).
  Closes the loop on user feedback.
- **D-Global-03:** **Auto-seed the full corpus-derived list** — no human review pass before
  the seed migration. Speed over quality. Trade-off acknowledged: the global library will be
  noisy at launch; Summit cleans up post-launch via the super-admin UI (D-Global-01). This
  is coherent because there is a remediation path.

### Claude's Discretion

- Encoding of the Summit super-admin role (column / claim / table) — pick whichever is most
  consistent with existing role infrastructure from Phase 1. Document the choice in the
  plan.
- Schema for `block_suggestions` table — fields beyond the obvious (suggesting org, original
  block snapshot, status enum, decided_by, decided_at).
- Whether free-text tags are stored as a separate column / array / JSONB — implementation
  detail provided picker filtering and search both work.
- Exact category-relatedness logic when the SOP's category has zero exact matches but related
  tags exist (e.g. SOP tagged `machinery-forming` falling back to `machinery` parent before
  falling back to all). The "controlled vocab is flat" decision (D-Tax-01) means there's no
  formal parent — but the picker MAY group tags by prefix substring as a soft fallback. Plan
  this; don't ship without it for ergonomics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema foundation (Phase 11 — load-bearing for all of Phase 13)

- `supabase/migrations/00019_section_kinds_and_blocks.sql` — `section_kinds` catalog + `blocks`
  + `block_versions` + `sop_section_blocks` tables. Phase 13 plans extend / use these
  additively. Read this BEFORE planning any new migration.
- `src/lib/validators/blocks.ts` — Zod discriminated-union for `block_versions.content`
  (hazard / ppe / step / emergency / measurement / custom). Server actions writing to
  `block_versions` MUST `BlockContentSchema.parse()` before insert. Phase 13 server actions
  follow this contract.
- `src/types/sop.ts` — `Sop`, `SopSection`, `SopStep`, `SopImage` plus block-prop types.
  Phase 13 adds `Block`, `BlockVersion`, `SopSectionBlock`, `BlockSuggestion`,
  `BlockCategory` types here.

### Builder / wizard integration points (Phase 12 — UX context)

- `src/lib/builder/puck-config.tsx` — Puck `Config` registry mapping block kinds to
  components + prop schemas. Block library picker integrates by mapping `Block.kind` to a
  Puck block type when admin picks from library. Read this to understand kind ↔ component
  mapping.
- `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx` + `SectionListSidebar.tsx` — the
  builder shell into which the picker + three-dot menu integrate.
- `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` — wizard surface where
  "Pick from library (N matches)" tab is added alongside "Write new" at section steps.
- `src/actions/sections.ts` — `createSection`, `updateSectionLayout`, `reorderSections`. New
  Phase 13 server actions go in `src/actions/blocks.ts` and follow the same pattern
  (`createClient()` + RLS, `getAdminContext()` for org scope).
- `src/actions/introspection.ts` `describeSopSchema()` — Phase 14 AI-draft will need block
  catalog visibility. Phase 13 should consider whether to expose a similar
  `describeBlockLibrary()` for downstream AI access (mark deferred if so).

### Phase 11 / 12 prior decisions (carried forward — do not revisit)

- `.planning/phases/12-builder-shell-blank-page-authoring/12-CONTEXT.md` — D-09 (block prop
  schemas co-located with block components), D-12 (no className prop on blocks), D-13
  (unknown block → placeholder), D-14 (invalid props → empty state), D-16 (admin-side error
  surfacing).
- `.planning/phases/12.5-blueprint-redesign/12.5-CONTEXT.md` — paper/ink theme is route-
  scoped to `(protected)/sops`. Phase 13 admin UI lives in `(protected)/admin/*` so it
  retains the dark steel-900 admin theme; library picker rendered in the wizard inherits
  the admin theme, NOT paper/ink.

### Project & roadmap

- `.planning/PROJECT.md` "Key Decisions" — multi-tenant via RLS, AI auto-parse, PWA-first.
- `.planning/REQUIREMENTS.md` SB-BLOCK-01..06 — the six requirements Phase 13 closes.
- `.planning/ROADMAP.md` Phase 13 — plan stubs already drafted (13-01 CRUD, 13-02 NZ seed,
  13-03 wizard, 13-04 update badging). Plans MUST add corpus pass as preceding step.

### Existing code patterns (reuse, do not reinvent)

- Org-scope RLS pattern: `00019_section_kinds_and_blocks.sql` already shows `organisation_id`
  + RLS policy for `blocks`. Repeat the exact pattern for any new tables.
- Soft-archive pattern: existing tables use a `status` enum with `archived` rather than
  hard-delete. `archiveBlock` follows this.

### External docs

- WorkSafe NZ machinery & chemical handling guidance — used by Summit when curating global
  blocks post-launch. Not consumed by code; influences corpus pass categorisation prompts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Block components** (`src/components/sop/blocks/*.tsx`, 15 total) — admin builder,
  worker walkthrough, AND the library picker preview pane all render through the same
  components. No new rendering paths.
- **`puck-config.tsx`** — already maps every kind to its component; library picker reuses
  this mapping when rendering preview thumbnails.
- **`createClient()` + `getAdminContext()`** pattern (Phase 1 + 12) — every new server
  action in `src/actions/blocks.ts` uses this for org-scoped reads/writes.
- **`createAdminClient()`** (Phase 1) — only the global-block super-admin route uses this
  to bypass org RLS when promoting suggestions to `organisation_id = null`.
- **`scripts/contract-check.ts`** — enforces Puck registry ↔ Zod validator parity. Phase 13
  may need to extend this to also enforce that every `Block.kind` matches a registered
  Puck component, OR explicitly note that org-saved blocks always serialize to a known
  kind (no new "library-only" kinds).

### Established Patterns

- **Versioning via `block_versions`** — block edits never mutate the existing version row;
  inserts a new `block_versions` row with incremented version number. Pin = SOP references
  a specific version row. Follow-latest = SOP references the block_id, picker hydrates
  current head version on read.
- **Snapshot-on-add via `sop_section_blocks` junction** — the snapshot lives on the
  junction row, not the SOP layout JSONB. Worker reads from the junction; offline cache
  syncs the junction rows alongside SOPs.
- **Soft-archive over hard-delete** — `archived_at` column; picker filters out archived
  blocks; existing SOPs keep their snapshot.

### Integration Points

- Wizard section steps — wizard already routes through `WizardClient.handleSubmitFinal →
  createSopFromWizard`. Adding "Pick from library" step is a new wizard branch, not a
  rewrite.
- Builder side panel — three-dot menu attaches to existing block selection state.
- Admin nav — `/admin/blocks` is a new top-level admin route alongside `/admin/sops`,
  `/admin/team`. Add to `src/components/layout/AdminNav.tsx` (or equivalent).
- Super-admin route — `/admin/global-blocks` is a new gated route. Middleware needs to
  check `is_summit_admin` flag.

</code_context>

<specifics>
## Specific Ideas

- **Save-to-library modal field order**: Name → Categories (controlled multi-select with
  type-ahead) → Free-text tags input → Scope radio (My org only / Suggest for global).
  Visual reference: matches Notion's "save as template" flow.
- **Picker preview pane**: render block via the same component the worker uses, with the
  paper/ink theme NOT applied (admin theme stays steel-900) so the admin sees the block in
  the editor's chrome — but the rendered content (text, severity colours, hazard styling)
  is identical to what the worker would see.
- **Update badge**: "update available" badge on the block usage in the SOP layout when
  follow-latest is on AND the source block_version has advanced. Small dot + tooltip,
  not a banner. Click → opens diff view ("Old hazard text" vs "New hazard text") + Accept
  / Decline buttons. Accept routes through the publish gate (existing flow from Phase 12).
- **Filename schema as category seed signal**: `EN-FOR-02-001` → `FOR` likely = Forming
  department. Corpus pass should treat the schema codes as a strong prior alongside content
  clustering.

</specifics>

<deferred>
## Deferred Ideas

- **Semantic / embedding-based picker matching** — kind+category gets us most of the way;
  revisit if usage data shows weak relevance. Likely a Phase 13.x or 18 enhancement.
- **Auto-promote based on usage threshold** — if 5+ orgs save the same hazard text,
  auto-flag for global review. Useful but requires text similarity infra. Defer to a future
  intelligence-layer phase.
- **Hierarchical category nesting** — re-evaluate after 12 months of real org usage if
  category-soup emerges. Schema-additive (parent_id column).
- **Collaborative block editing** — Phase 17 (Collaborative Editing) territory. Phase 13
  uses pessimistic single-admin edits.
- **Block-level diff view in update badge** — basic two-text-side-by-side is fine for v1.
  Rich diff (per-field, per-prop) deferred.
- **Bulk save from section list ("Library candidates" review screen)** — discussed in Area
  1, rejected for v1 in favour of inline three-dot save. Revisit if admins ask for it.

</deferred>

---

*Phase: 13-reusable-block-library*
*Context gathered: 2026-05-07*
