# Phase 56: A Simpler SOP & the Decision Ledger - Research

**Researched:** 2026-10-04
**Domain:** Postgres schema + data conversion (layout_data -> kinded steps), append-only audit table with trigger enforcement, Next.js 16 server actions, Supabase RLS
**Confidence:** HIGH on codebase facts (all read in this session); MEDIUM on two design recommendations flagged in Open Questions

## Summary

This phase is almost entirely codebase-grounded. No new npm packages are needed. The work splits into four independent seams: (1) schema additions (`sop_steps.kind` + conversion markers, `sops.placement`, `standards` + attachments, `decisions`), (2) a pure converter module plus a runner script, (3) a `recordDecision()` writer wired into ~12 call sites, and (4) a standards manager panel mounted beside the existing "Linked machines" modal in the builder Tools menu.

Three findings change how the CONTEXT decisions must be planned, and the planner must treat them as first-class tasks rather than details:

1. **D-01 as written duplicates content for every old reader.** Converted steps are NEW `sop_steps` rows in the SAME `sop_sections` (D-04 forbids new sections). Eight-plus readers embed `sop_steps(*)` (worker `useSopDetail`, `api/sops/[sopId]`, builder page, activity page, `NowCard`, agent synthesis, reviewer job E, version clone). Without a `converted_from is null` filter at each, the old SOP page shows every step twice, hazard sections turn into "jobs" (`procedureSections` counts sections with steps), and `resolveRenderFamily` flips `content` sections to `steps`. A filter-at-every-reader task plus a lint guard is mandatory.
2. **D-06's five backfill tables are not the whole decision history.** The sign-off/reject decision lives in `completion_sign_offs`, and assignments live in `sop_assignments`; neither is in the five. On the live DB the five tables hold exactly 1 row in total (`sop_completion_signatures` = 1; approvals/observations/review events/block decisions = 0), while `completion_sign_offs` = 1 and `sop_assignments` = 5. Backfilling only the five makes the ledger a single row.
3. **There is no server-side "AI finding cleared" write today, and no agent identity anywhere.** The reviewer flag is "acknowledged" implicitly by `verifyBlock` (no `flags_acknowledged` write exists), and agents authenticate as ordinary session users. DEC-04 therefore needs a deliberate design (Open Question 1), not just a column.

**Primary recommendation:** Build in this order: (a) Wave 0: dry-run converter against live data (read-only) + filter-guard spec + phase56 Playwright project; (b) migration 00069 (kinds, placement trigger, standards) and 00070 (decisions + trigger + grants + backfill incl. the two extra sources); (c) converter + runner + old-reader filters; (d) `recordDecision()` + writer hooks + data-keyed sweep spec; (e) standards panel + label rendering; (f) deployed eval with a service-role UPDATE/DELETE refusal probe.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Conversion (SOP-01)**
- **D-01 — New rows beside the old; `layout_data` untouched.** Add `kind` (`hazard | ppe | step | check`) to `sop_steps`. The converter writes converted steps as NEW `sop_steps` rows tagged with the conversion run (a run id / `converted_from` marker), leaving every pre-existing `sop_sections` / `sop_steps` row and every `layout_data` JSON exactly as it is. The old builder (which renders exclusively from `layout_data`, per CLAUDE.md [2026-07-07]) and the old SOP page keep working unchanged. The conversion is **idempotent and re-runnable**: running it again replaces only the rows it wrote last time, so it can be re-run at the Phase 58 cutover to pick up builder edits made in between.
- **D-02 — Kind mapping for the 17 block types ("check = anything you verify").**
  - `HazardCard` -> `hazard`; `PPECard` -> `ppe`
  - `Step`, `StepWithPhotos` -> `step` (a `StepWithPhotos` becomes a step that asks for a photo)
  - `Measurement`, `Inspect`, `Decision`, `SignOff` -> `check` (text says what to confirm; measurement units/ranges/thresholds and decision branches folded into the step text)
  - `Callout`, `Text`, `Heading`, `Zone`, `Escalate`, `Model` -> `step` (text)
  - `Photo`, `PhotoGrid` -> `step` that asks for a photo (`photo_required`), image refs kept via `sop_images`
  - `VoiceNote` -> `step` text from its transcript if any, else dropped with a count (voice was cut in Phase 55)
  - The plan writes this table out in full; the before/after count report is per SOP and per kind, and **hazard and PPE counts must be >= the source count** (a hazard/PPE card that yields nothing is a conversion failure, not a warning).
- **D-03 — `warning` / `caution` become a hazard step placed immediately before the parent step** (so the Phase 58 walk acknowledges it before the action, FOC-02). `tip` stays as a note on the step. These generated hazard steps count toward the hazard total in the before/after report.
- **D-04 — Section typing is preserved, not re-derived.** The converter reads the existing `section_type` + the shared classifier in `src/lib/sop/sections.ts` (single source of truth - never a private copy, per CLAUDE.md [2026-09-27]) only to decide default kinds for untyped content; it does not rename or merge sections.

**Decision ledger (DEC-01, DEC-03, DEC-04)**
- **D-05 — One physical table (`decisions`), beside the existing tables, never replacing them.** `sop_approvals`, `sop_completion_signatures`, `sop_observations`, `sop_review_events`, `sop_block_update_decisions` stay and keep being written; every writer ALSO writes one ledger row through a single `recordDecision()` writer. (Resolves one-screen-site.md open question 5.)
- **D-06 — Backfill history.** One migration inserts a ledger row per existing row of those five tables, carrying the original timestamp and actor, flagged `source = 'backfill'`. The migration's assertion compares counts per source table, and the deployed eval proves the Office-less ledger is non-empty.
- **D-07 — Append-only enforced for EVERY role, including service role.** RLS grants `INSERT` + `SELECT` only (org-scoped `USING` and matching `WITH CHECK`, per `tests/lint/rls-org-scope.spec.ts`), AND a `BEFORE UPDATE OR DELETE` trigger raises unconditionally - the admin client, a migration and the dashboard SQL editor are all refused. A correction is a new decision that refers to the one it corrects (`supersedes_decision_id`). The eval/probe attempts an `UPDATE` and a `DELETE` as service role and asserts both are refused.
- **D-08 — Writers that must call `recordDecision()` in this phase:** `approveStep` (approve + send back), `signOffCompletion` (sign off + reject), `recordSignature`, the assignment writer(s) in `src/actions/assignments.ts`, the publish route (`src/app/api/sops/[sopId]/publish/route.ts` via `assertPublishGates` -> publish), `setSopOwner`, `setReviewCadence` / review events, `recordObservation`, `verifyBlock` / `unverifyBlock` and the AI-finding clear path, and `requestAssessorReview` outcomes. The plan enumerates these by grepping every write to the five decision tables (data-keyed, not feature-keyed - CLAUDE.md [2026-07-29]).

**Placement & department (SOP-03)**
- **D-09 — Explicit `sops.placement` = `'machine' | 'site'`.** The conversion sets `'site'` for every SOP with zero `sop_machines` rows and `'machine'` otherwise. Placing a site SOP on a machine flips it to `'machine'`; removing its last machine flips it back to `'site'`. A SOP is never both.
- **D-10 — Department is derived for display only; access wiring is untouched.** Shown department(s) = the departments of the SOP's machines (site SOPs show none). `sop_departments`, `all_departments`, `access_grants` and every department-visibility RLS policy keep governing WHO CAN SEE a SOP exactly as today, so the access-wiring screen that Phase 59 keeps unchanged (OFF-06) still works. Nothing in RLS visibility changes this phase; the separate-department picker is simply no longer the thing an admin uses to say where a SOP lives.

**Standards (SOP-02)**
- **D-11 — Seeded starter list, visible to everyone.** Each org is seeded with an editable list - LOTO, Hot Work, Confined Space, Working at Height, Manual Handling, Electrical Isolation. The label is a quiet label (one-screen-site.md CSS note: never a chip competing with a badge) and renders wherever the SOP is shown, **including the worker walk rail** - a worker should know a step is under LOTO.
- **D-12 — Standards attach at three levels** (SOP, section, step) through one org-scoped `standards` table and an attachment table; add / rename / remove from one list. The manager is a standalone panel opened from the admin SOP page in this phase (Phase 61 mounts it in the Workshop). Renaming a standard renames it everywhere; removing one detaches it everywhere (no orphan labels).
- **D-13 — Old library content stays.** Blocks that were linked from the retired reusable library remain in the SOPs that used them (the block tables and `sop_section_blocks` junctions were kept in Phase 55); the converter treats them like any other block of their type.

### Claude's Discretion
- **Converter input.** Read `layout_data` where present (it is what the builder has been editing) and fall back to `sop_sections`/`sop_steps` rows for any section with no layout; the plan records the precedence and the before/after report shows which source each SOP came from.
- **Ledger column shape.** Suggested: `id`, `organisation_id`, `kind` (approve, reject, sign_off, assign, publish, owner_change, review, observation, ai_finding_cleared, ...), `actor_kind` (`person | agent`), `actor_id` (nullable for agents), `actor_name` (required when `actor_kind = 'agent'`, DEC-04), `subject_kind` + `subject_id` (what it was about), `summary` (one plain sentence), `details` jsonb, `source` (`live | backfill`), `supersedes_decision_id`, `created_at`. Final shape is the planner's.
- **Standards storage.** One `standards` table + one polymorphic `standard_attachments (standard_id, target_kind, target_id)` vs three junction tables - planner's call; RLS org-scoped either way.
- **Where the "... · logged in the decision ledger" copy appears** on existing screens this phase - optional; the contract wants it on every governance action eventually, but existing screens are retired in 58/59.
- **Re-run mechanics** (run id column vs a `converted_from_layout_hash`) - planner's call, as long as a second run on an unchanged SOP is a no-op and a run after a builder edit replaces only the generated rows.

### Deferred Ideas (OUT OF SCOPE)
- The Office ledger view, newest-first with kind filter - **Phase 59 (DEC-02)**.
- Mounting the standards manager in the Workshop - **Phase 61**.
- The focus walk/editor reading the new `kind` rows and retiring `layout_data` as the render source - **Phase 58**; this phase only guarantees the rows exist and are correct.
- Requests / assignments-as-requests (the assignment writer becomes a request in Phase 60) - the ledger hook on today's assignment path is still made here so Phase 60 inherits it.
- "... · logged in the decision ledger" copy on every governance action - lands with the rooms (59/60/61).
- Syncing `sop_departments` from machine placement (the "one source of truth" option declined in D-10) - revisit only if the access-wiring screen is retired after Phase 59.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOP-01 | A SOP is sections and steps; hazard/PPE/step/check are kinds of step; every existing SOP converted, none of its hazard/PPE lost | Block registry table (18 types), layout_data shape, converter design, live census (8 types in prod, 49 of 210 sections have NULL layout), old-reader filter list, idempotency via `source_key` |
| SOP-02 | Standard (plain label) on SOP / section / step; one list to manage; library content stays | `standards` + attachment-table design (FK-per-level), Tools-menu panel precedent (`BuilderMachinesButton`), seed migration, label rendering + bundle gate |
| SOP-03 | Every SOP is machine(s) or whole site; department from its machine | `sop_machines`/`site_machines.department_id`, `setSopMachines` is the single placement writer, trigger to keep `sops.placement` in sync, display readers listed |
| DEC-01 | Every approve/reject/sign-off/assign/publish/owner change/observation/cleared AI finding is one decision | Authoritative writer list (data-keyed) with file, function, client, actor scope; two extra backfill sources |
| DEC-03 | No one can change or delete a decision; enforced by DB | Trigger + `ENABLE ALWAYS` + TRUNCATE trigger + REVOKE; probe designs; FK/cascade pitfalls |
| DEC-04 | Agent decisions name the agent | Column CHECK + `recordDecision` actor union; Open Question 1 on the live agent path |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layout -> kinded-step conversion | API / Backend (pure TS module + service-role runner script) | Database (unique key for idempotent upsert) | Needs the whole `layout_data` + section rows; not a request-path feature. Pure module so Playwright can import it in-process |
| Report (before/after counts) | API / Backend (runner output) | Database (optional `sop_conversion_runs` row) | Hard gate runs where the data is read; DB row only if Phase 58 / eval must read it later |
| Hiding generated rows from old readers | API / Backend + Browser (query embeds) | - | Each old reader owns its own select; the filter is a query-string concern |
| Standards CRUD | API / Backend (server actions, `requireAdminContext`) | Database (RLS, FK cascade) | Admin-only writes; cascade guarantees "no orphan labels" |
| Standards label display | Browser / Client (tiny component) | Database (RLS read for all org members) | Worker walk rail is a gated client route |
| Placement flip | Database (trigger on `sop_machines`) | API (`setSopMachines` unchanged) | "Never both" and cascade deletes (machine delete removes links) can only be kept honest in the DB |
| Derived department display | API / Backend (reader joins) | Browser | Display-only (D-10); no RLS change |
| Decision ledger write | API / Backend (`recordDecision`, service role) | Database (trigger = real enforcement) | Writers live in server actions / route handlers; immutability must not depend on them |
| Append-only enforcement | Database (trigger, `ENABLE ALWAYS`, REVOKE) | - | Service role bypasses RLS; only a trigger refuses it |

## Standard Stack

### Core
No new libraries. Everything uses what is installed.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.3 [VERIFIED: package.json] | Reads/writes, service-role client for ledger + converter | Already the data layer |
| `zod` | installed [VERIFIED: used in `src/lib/validators/*`] | Validate standards/ledger inputs | Project convention: Zod in `src/lib/validators/` |
| `tsx` | 4.19.2 [VERIFIED: package.json] | Run the converter script (`npx tsx scripts/convert-sops-to-steps.ts`) | Precedent: `scripts/backfill-section-layouts.ts` |
| `@playwright/test` | installed [VERIFIED: node_modules/.bin] | Source-contract specs + deployed evals | Project test runner |
| `supabase` CLI | ^2.22.6 in `optionalDependencies` [VERIFIED: package.json:74; bin present] | `npx supabase db push` | Applier's first path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Generated rows in `sop_steps` (D-01, locked) | A separate `sop_step_rows` table | Zero old-reader filtering, but contradicts locked D-01 and `kind` on `sop_steps`. Only raise with the user if the reader-filter task proves too invasive (see Open Question 2) |
| Polymorphic `standard_attachments(target_kind, target_id)` | Three nullable FK columns (`sop_id`, `section_id`, `step_id`) with a CHECK "exactly one" | **Recommended: FK columns.** Polymorphic `target_id` has no FK, so deleting a step/section/SOP orphans labels - the exact thing D-12 forbids. FK columns cascade |
| New `decisions.organisation_id` FK to `organisations` | Plain uuid, no FK | **Recommended: no FK** on `organisation_id`, `actor_id`, `subject_id` (see Pitfall 5) |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase. **Packages removed due to slopcheck [SLOP] verdict:** none. **Packages flagged [SUS]:** none. (slopcheck not run - nothing to check.)

## The 18 Block Types, Exactly (task 1)

`BLOCK_COMPONENTS` in `src/lib/builder/block-registry.tsx` has **18 keys: 17 in `src/components/sop/blocks/*` + `VisualBlock`** [VERIFIED: read]. `UnsupportedBlockPlaceholder` is a render fallback, not a registered type (`sanitize-layout.ts`).

**D-02 vs registry:** D-02 names 17 types without the `Block` suffix. Every D-02 name exists. **Registry type NOT named in D-02: `VisualBlock`** (`items: [{ medium: 'photo'|'diagram'|'video', src, alt, caption, bakedSrc?, sopImageId?, annotationId? }]`). Recommendation: treat as `Photo`/`PhotoGrid` (`step`, `photo_required`); a `video` item has no meaning after Phase 55 (count and drop); a `diagram` item uses `bakedSrc ?? src`. **Live census: zero VisualBlocks in prod**, but the converter must still handle it or it will throw on a future builder-made SOP.

Content field names (the props the converter reads - `layout_data` items are `{ type, props }` with component props flat on `props`):

| Registry key (D-02 name) | Props read | D-02 kind | Notes |
|---|---|---|---|
| `HazardCardBlock` (HazardCard) | `title`, `body`, `severity: critical\|warning\|notice` | hazard | 1 card = 1 hazard step. Text = `body` (prefix `title` only if not the default "Hazard"/"Untitled hazard") |
| `PPECardBlock` (PPECard) | `title`, `items: string[]` | ppe | 1 card = 1 ppe step; `items` newline-joined in `text`. Items may arrive as `{item}` objects (see `puck-to-block-content.ts` PPE branch). Report both card count AND item count; assert every item string appears in the generated text |
| `StepBlock` (Step) | `number`, `text` (+ optional `warning`, `tip` when stamped from library `BlockContent`) | step | `StepBlockPropsSchema` has only `number,text`; `warning`/`tip` exist on `BlockContent` step and are read by `puckPropsToBlockContent` |
| `StepWithPhotosBlock` | `number`, `text`, `photos: [{src,alt,caption}]`, `layout` | step + `photo_required` | |
| `MeasurementBlock` | `label`, `unit`, `tolerance?{min,max,target}`, `voiceEnabled`, `hint?` | check | **The lenient `puckPropsToBlockContent` DROPS `tolerance`** - read props directly |
| `InspectBlock` | `title`, `items: [{label, requirePhoto}]` | check | 1 block = 1 check step, items as lines; any `requirePhoto` -> `photo_required` |
| `DecisionBlock` | `question`, `options: [{label, isEscalation?, nextStepId?}]` | check | Fold options into text ("If ...: ..."); flag escalation options |
| `SignOffBlock` | `title`, `requiredRole`, `acknowledgementText?` | check | |
| `CalloutBlock` | `title` (default `Note`), `body` | step (see D-03 rule below) | Parser emits callouts titled `Warning` / `Caution` / `Tip` for step warnings |
| `TextBlock` | `content` (markdown, may contain tables) | step | |
| `HeadingBlock` | `text`, `level` | step | Odd as a "step" but D-02 is locked; lossless beats pretty |
| `ZoneBlock` | `label`, `zoneType`, `notes?` | step | |
| `EscalateBlock` | `title`, `reason?`, `escalationMode`, `recipients?` | step | |
| `ModelBlock` | `assetUrl`, `hotspots[{id,label,position}]`, `defaultLayers` | step | Not in `BlockContentSchema`-via-junction path historically; count in report |
| `PhotoBlock` | `src\|null`, `alt`, `caption?` | step + `photo_required` | |
| `PhotoGridBlock` | `items[{src,alt,caption}]`, `columns` | step + `photo_required` | |
| `VoiceNoteBlock` | `prompt`, `language`, `maxDurationSec` | dropped w/ count | **There is no `transcript` field on this block** (D-02's "transcript if any" cannot be satisfied from layout props). Follow D-02 (drop + count); the `prompt` is recoverable if the planner wants it. Prod count: 0 |
| `VisualBlock` | `items[]` (above) | step + `photo_required` | Not in D-02 |

**Live census (read-only aggregate SELECTs against production, 2026-10-04)** [VERIFIED: Management API SQL]: 69 SOPs (61 draft, 6 published, 1 uploading, 1 parsing); 210 `sop_sections`, **161 with `layout_data`, 49 NULL**; item types actually present: `StepBlock` 322, `CalloutBlock` 175 (titles: Warning 83, Tip 54, Caution 37, Note 1), `HazardCardBlock` 164, `StepWithPhotosBlock` 89, `TextBlock` 79, `PPECardBlock` 16, `PhotoGridBlock` 4, `HeadingBlock` 4. No `zones` anywhere; every item has `props.id`; `layout_version` is never NULL when `layout_data` is set. `sop_steps`: 413 rows (83 with `warning`, 37 `caution`, 54 `tip`, 1 `photo_required`) - the warning/caution/tip counts equal the Callout counts, i.e. the layout path and the rows path describe the same content. 49 NULL-layout sections are almost all empty draft shells (33 `procedure`, 3 with steps, none with `content`). 27 `sop_machines` links over 14 machines. 785 `sop_section_blocks` junctions vs 853 layout items - **do not use junctions as the conversion source**.

## `layout_data` Shape and Accessors (task 2)

- Stored per section: `sop_sections.layout_data` (jsonb) + `layout_version` (int) (migration 00020). Shape `LayoutData = { root: { props: {} }, content: PuckItem[], zones?: ... }`, `PuckItem = { type: string, props: { id: string, ...componentProps, junctionId?, block_provenance? } }` [VERIFIED: `parsed-sop-to-layout-data.ts:46-56`, `layout-schema.ts` (permissive outer schema), `content-ops.ts` `LayoutItem`]. `zones` is typed but never written (0 in prod).
- `props.id` is always present (`content-ops.ts` inserts `crypto.randomUUID()`; parser uses `nextId`). **It is the stable key for idempotent re-runs.**
- Meta keys to strip before reading content: `id`, `junctionId`, `block_provenance` - `stripMeta()` in `block-registry.tsx` already does this.
- Junction relationship: each item gets one `blocks` + `block_versions` row (category `parsed_inline`) and one `sop_section_blocks` junction (`snapshot_content`, `block_provenance`, `verified_by_admin_id`); `props.junctionId` links them. The publish gate reads junctions, the builder reads `layout_data`. The converter reads **only `layout_data`** (D-13: library-linked blocks are ordinary items in the layout).
- Parser step pattern the converter must understand: for each parsed step the parser emits `StepBlock` / `StepWithPhotosBlock` **followed by** `CalloutBlock` titled `Warning`, then `Caution`, then `Tip` (`buildSectionContent`, lines 291-308). D-03 wants the hazard BEFORE the step, so the converter must re-order: a `Callout` titled `Warning`/`Caution` (case-insensitive, trimmed) that immediately follows a Step/StepWithPhotos becomes a `hazard` step inserted before that step; a `Tip` callout becomes `tip` on that step; any other callout is a plain `step`. **D-02 maps all Callouts to `step`; D-03 overrides for Warning/Caution - the plan must say so in the table.** Hazard sections (`section.type === 'hazards'`) are emitted one `HazardCardBlock` per line; PPE as one `PPECardBlock`.
- Existing accessors and which to reuse:
  - `PUCK_TYPE_TO_KIND` (private in `parsed-sop-to-layout-data.ts`) and `PUCK_TYPE_TO_BLOCK_KIND` (exported from `puck-to-block-content.ts`) - same map; **reuse the exported one** for "is this a known type".
  - There are **two functions named `puckPropsToBlockContent`**: the lenient one in `puck-to-block-content.ts` (returns `null`, drops `tolerance`/`recipients`/`nextStepId`) and the strict one in `parsed-sop-to-layout-data.ts` (Zod-validates and **throws** on shape mismatch, e.g. an empty hazard body). **The converter must use neither for content extraction** - a null return silently drops a hazard (violates "yields nothing is a failure"), a throw aborts a whole SOP. Read props with a small per-type reader that returns `{ text, kind, photoRequired, imagePaths }` and counts "unreadable" explicitly. Reuse only the PPE `items` normalisation idiom (`string | {item}`).
  - `src/lib/sop/sections.ts` (`isHazardSection`, `isPpeSection`, `isEmergencySection`, `isScopeSection`) takes a `Section` shaped like `SopWithSections['sop_sections'][number]` and reads `section_kind?.render_family`, `section_type`, `title`. Fallback-path and default-kind decisions MUST call these (never a private keyword list). The runner must therefore load `section_kind:section_kinds!section_kind_id(*)` like `useSopDetail` does. `import type` only - safe to import from a Playwright spec.
- Default kind for untyped content (D-04): `TextBlock`/`CalloutBlock` inside an `isHazardSection` -> `hazard`; inside `isPpeSection` -> `ppe`; otherwise `step`. This can only raise hazard/PPE counts, never lower them.
- Rows fallback (49 NULL-layout sections): for each `sop_steps` row (`text`, `warning`, `caution`, `tip`, `required_tools`, `time_estimate_minutes`, `photo_required`) emit `[hazard(warning)] [hazard(caution)] step`; for a `hazards`/`ppe`-typed section with only `content` text, mirror the parser: hazards one step per non-empty line, PPE one step with the lines.
- **Tools and time estimates live only on `sop_steps` rows, not in `layout_data`.** A layout-only conversion drops `required_tools` / `time_estimate_minutes` that the old Read/Walk show (`jobTools`, `NowCard.sopMinutes`). Recommend: for a layout section, zip layout step-type items against the section's ORIGINAL ordered `sop_steps` rows; if counts match copy tools/time per step, else put the union of tools on the first generated step and the sum of times on it. Not a SOP-01 hard gate, but record it in the report. [ASSUMED] that Phase 58 wants them.

## Current `sop_steps` / `sop_sections` / `sops` Columns (task 3)

`sop_steps` [VERIFIED: 00003 + 00010 + `database.types.ts`]: `id uuid`, `section_id uuid -> sop_sections ON DELETE CASCADE`, `step_number int`, `text`, `warning`, `caution`, `tip`, `required_tools text[]`, `time_estimate_minutes numeric(6,1)`, `photo_required boolean default false` (00010), `created_at`, `updated_at`. **No `sop_id`, no `organisation_id`** (RLS goes through the section -> sop; `admins_can_manage_steps` was recreated in 00066 with the sign-off-approver arm). **No unique constraint on `(section_id, step_number)`.**

`sop_sections`: `id`, `sop_id`, `section_type`, `title`, `content`, `sort_order`, `confidence`, `approved`, `section_kind_id`, `layout_data`, `layout_version`, timestamps.

`sop_images`: `id`, `sop_id`, `section_id`, `step_id -> sop_steps ON DELETE SET NULL`, `storage_path`, `content_type`, `alt_text`, `sort_order`.

`sops` (selected): `status`, `version`, `category_slug`, `owner_user_id`, `review_due_at`, `last_reviewed_at`, `approval_state`, `approval_snapshot`, `parent_sop_id`, `source_type` (exists but is missing from the `Row` type - code uses `as any`), `all_departments`, legacy free-text `department`. **No `placement` column yet.**

**Type files are hand-extended** ("type regen unavailable" comments in `database.types.ts`). Every new column/table must be added to `src/types/database.types.ts` (and `SopStep` in `src/types/sop.ts`) by hand or TypeScript will not see it.

### Recommended additions (migration 00069)

```sql
-- sop_steps: kind + conversion markers (all defaulted so every existing insert path keeps working)
alter table public.sop_steps
  add column if not exists kind text not null default 'step'
    check (kind in ('hazard','ppe','step','check')),
  add column if not exists converted_from uuid,     -- run id; NULL = original (hand/parser-written) row
  add column if not exists source_key text,         -- stable key: layout props.id [+ ':w'/':c' for generated hazards] or 'row:<old step id>'
  add column if not exists image_paths text[];      -- see Open Question 4
create unique index if not exists sop_steps_converted_key
  on public.sop_steps (section_id, source_key) where converted_from is not null;
create index if not exists sop_steps_converted_from_idx on public.sop_steps (converted_from) where converted_from is not null;

alter table public.sops add column if not exists placement text not null default 'site'
  check (placement in ('machine','site'));
update public.sops s set placement = 'machine'
  where exists (select 1 from public.sop_machines m where m.sop_id = s.id);
```

`default 'step'` means every original row (including hazard-section rows) reads `kind = 'step'`; **`converted_from is null` - not `kind` - is what distinguishes originals from generated rows.** Never infer provenance from `kind`.

Placement sync trigger (invoker, not definer - CLAUDE.md [2026-07-05]):

```sql
create or replace function public.sync_sop_placement() returns trigger language plpgsql as $$
declare v_sop uuid := coalesce(new.sop_id, old.sop_id);
begin
  update public.sops set placement =
    case when exists (select 1 from public.sop_machines where sop_id = v_sop) then 'machine' else 'site' end
  where id = v_sop and placement is distinct from
    case when exists (select 1 from public.sop_machines where sop_id = v_sop) then 'machine' else 'site' end;
  return null;
end $$;
create trigger sop_machines_sync_placement after insert or delete on public.sop_machines
  for each row execute function public.sync_sop_placement();
```

Why a trigger: `deleteSiteMachine` removes `sop_machines` rows by FK cascade (`site.ts:370`), `setSopMachines` does insert-then-prune, and `sops` delete cascades the links. Application code cannot see the cascade; the trigger can, and "a SOP is never both" (D-09) then holds by construction. The cascade-delete case updates a `sops` row that may itself be mid-delete - a harmless no-op. [ASSUMED: runs as the invoking admin/service role; verify an admin-session `setSopMachines` flips placement in the Wave 0 probe.] Do **not** rely on `setSopMachines` writing the column.

## The Decision Writers - authoritative, data-keyed (task 4)

Method: grep `src/`, `scripts/` and `supabase/migrations/` for every insert/update/delete into the five D-06 tables **plus** the two tables that carry the other halves of the same decisions. Verified call sites:

| # | Table written | File : line | Function | Client | Actor/subject in scope at that point | Ledger `kind` |
|---|---|---|---|---|---|---|
| 1 | `sop_approvals` (approved) | `src/actions/approvals.ts:186` | `approveStep` | session (`createClient()`) | `ctx.userId`, `ctx.role`, `ctx.organisationId`, `sopId`, `sop.version`, `nextIndex`, `comment` | `approve` |
| 2 | `sop_approvals` (changes_requested) | `approvals.ts:254` | `requestChanges` | session | same + required `comment` | `reject` ("send back") |
| 3 | `sops.status` -> published | `src/lib/governance/publish-core.ts:149-166` | `performPublish` (called by `api/sops/[sopId]/publish/route.ts:90` AND `approveStep` final step `approvals.ts:203`) | caller's session client | `userId`, `organisationId`, `sopId`, `approvalState` | `publish` - hook **inside `performPublish` after the successful flip, outside `assertPublishGates`** (gate body must stay byte-identical; `tests/builder/builder-review-flow.spec.ts`, `tests/phase26/spine-regression.spec.ts`, `tests/phase28/governance-actions.spec.ts`, `tests/phase29/*` pin this file) |
| 4 | `sop_review_events` ('superseded') | `publish-core.ts:203` | `performPublish` step 3b (non-fatal block) | session | `userId`, `organisationId`, `sopId` | `review` (or fold into the `publish` row's `details`) |
| 5 | `sop_review_events` ('confirmed_current') | `src/actions/governance.ts:254` | `confirmSopCurrent` | session | `ctx.userId`, `ctx.organisationId`, `sopId` | `review` |
| 6 | `sops.owner_user_id` | `governance.ts:147` | `setSopOwner` | session | `ctx.userId`, `sopId`, new `userId` (old owner is NOT read today - add a select if "from -> to" wanted) | `owner_change` |
| 7 | `sop_review_cadences` upsert | `governance.ts:294-310` | `setReviewCadence` | **admin** (no authenticated write policy by design) | `ctx.userId`, `ctx.organisationId`, `category`, `months` | `cadence_change` (subject_kind `category`). Not a DEC-01 verb but named in D-08 |
| 8 | `sop_completion_signatures` | `src/actions/completions.ts:364` | `recordSignature` | **admin** (no authenticated insert policy, 00038) | `userId` (session), `organisationId`, `completionId`, `role` worker\|supervisor | `countersign` / `sign_off` (worker self-sign vs supervisor counter-sign) |
| 9 | **`completion_sign_offs`** (approved/rejected) | `completions.ts:221` | `signOffCompletion` | admin | `userId`, `role`, `organisationId`, `completionId`, `decision`, `reason`, `isOverride`, `overrideReason`, `completion.worker_id`, `completion.sop_id` | `sign_off` / `reject`. **Not in D-06's five - this is the table that holds the sign-off decision** |
| 10 | `sop_observations` | `src/actions/observations.ts:112` | `recordObservation` | session (RLS is the write gate, Phase 34 D-12) | `userId` (observer), `workerId`, `sopId`, `sop.version`, `verdict`, `note`, `isOverride`, `overrideReasonToStamp` | `observation` |
| 11 | `sop_assignments` insert | `src/actions/assignments.ts:49` / `:85` | `assignSopToRole` / `assignSopToUser` | session | `user.id`, `organisationId`, `sopId`, role or `userId`, returned `id` | `assign` |
| 12 | `sop_assignments` delete | `assignments.ts:119` | `removeAssignment` | session | only `assignmentId` in scope - **must read the row first** to name sop/target | `unassign` |
| 13 | `sop_assignments` self | `assignments.ts:205` / `:228` | `selfAddSop` / `selfRemoveSop` | admin | worker acting on self | **Recommend: do not log** (a worker bookmarking a SOP is not a governance decision; it is noise). Allowlist with a reason |
| 14 | `sop_section_blocks.verified_by_admin_id` | `src/actions/sop-section-blocks.ts:75` / `:99` | `verifyBlock` / `unverifyBlock` | session | `user.id`, `blockId` only - **`sopId`/`organisationId` must be resolved by a join** (block -> section -> sop) | `ai_finding_cleared` when the block had reviewer flags, otherwise `verify`; `unverify` -> `verify_withdrawn` |
| 15 | `sop_block_update_decisions` | **SQL only**: `accept_block_update` / `decline_block_update` RPCs (00025:143, :187) | - | n/a | - | **No caller in `src/`** (Phase 55 removed the library). History is backfill-only. But the RPCs are still `grant execute ... to authenticated`: an admin could call `/rest/v1/rpc/accept_block_update` and bypass the ledger. Recommend `REVOKE EXECUTE ... FROM authenticated` in 00070 (they are dead code) |
| - | `worker_notifications` | `observations.ts` `requestAssessorReview` | - | admin | - | **D-08 lists `requestAssessorReview` "outcomes" - it has none**: it only inserts `worker_notifications`. A request is not a decision; Phase 60 turns it into a request whose accept/decline writes the decision. Recommend: allowlist, do not log |

Notes:
- `scripts/uat-seed-competency.mjs`, `scripts/uat-seed-cleanup.mjs` write/delete `sop_observations` directly - dev seeds; allowlist in the sweep spec.
- `versioning.ts:264` re-points `sop_assignments.sop_id` to a new version and `sops.ts:370` deletes assignments on SOP delete - housekeeping, not decisions; allowlist.
- `setApprovalChain` (`approvals.ts:102`) is policy configuration, not a decision; `departments.ts:314 setDepartmentOwner` writes `departments.owner_user_id`, not SOP ownership. Allowlist both with reasons.
- **AI-finding clear path (D-08):** there is none server-side. `useVerifyChecklist.ts` header: "There is no separate `flags_acknowledged` write - verification IS the acknowledgement." Flags live in `parse_jobs.ai_review_results` (`ReviewerRunEnvelope.flags[]`, each with optional `block_id`, `severity`, `kind`, `description`). To write `ai_finding_cleared`, `verifyBlock` must (a) resolve block -> section -> sop (session client; RLS org-scopes it), (b) read the SOP's latest `parse_jobs.ai_review_results` and filter `flags` by `block_id`, (c) write one decision with the flag descriptions in `details` when `flags.length > 0`. `ReviewerFlag.block_id` is typed optional; confirm it equals the `sop_section_blocks.id` that `verifyBlock(blockId)` receives (`useReviewerFlags` / `useVerifyChecklist` count flags per block, so it does) [ASSUMED - confirm in Wave 0].
- Phase 29 `performPublish` can also be reached by the chain-divert path that only sets `approval_state = 'pending'` (route lines 64-80). That is "submitted for approval", not a decision; do not log it as `publish`.

### Which D-06 backfill sources and their columns (task 5)

| Source | Actor col | Time col | Subject cols | Org col | Notes |
|---|---|---|---|---|---|
| `sop_approvals` | `approver_user_id` (nullable, SET NULL) | `created_at` | `sop_id`, `version`, `step_index`, `action in (approved, changes_requested)`, `comment` | `organisation_id` | live rows: 0 |
| `sop_completion_signatures` | `roster_user_id` | `signed_at` | `completion_id`, `role in (worker, supervisor)` | `organisation_id` | live rows: 1. No `sop_id` - join `sop_completions` |
| `sop_observations` | `observed_by` (nullable) | `created_at` | `sop_id`, `sop_version`, `observed_worker_id`, `verdict`, `note`, `completion_id`, plus `is_assessor_override`, `override_reason` | `organisation_id` | live rows: 0 |
| `sop_review_events` | `reviewed_by` (nullable) | `created_at` | `sop_id`, `action in (confirmed_current, superseded)` | `organisation_id` | live rows: 0 |
| `sop_block_update_decisions` | `decided_by` (nullable) | `decided_at` | `sop_section_block_id`, `block_version_id`, `decision in (accept, decline)`, `note` | **none** - derive via `sop_section_blocks -> sop_sections -> sops` | live rows: 0 |
| **`completion_sign_offs`** (add) | `supervisor_id` | `created_at` | `completion_id`, `decision in (approved, rejected)`, `reason`, `is_assessor_override`, `override_reason` | `organisation_id` | live rows: 1. No `sop_id` - join `sop_completions` |
| **`sop_assignments`** (add) | `assigned_by` | `created_at` | `sop_id`, `assignment_type`, `role`, `user_id` | `organisation_id` | live rows: 5 |

Backfill must be idempotent (the Management-API fallback re-runs whole files): add `legacy_table text` + `legacy_id uuid` columns with `create unique index ... on decisions (legacy_table, legacy_id) where legacy_id is not null`, and `insert ... on conflict do nothing`. The migration asserts `count(*) filter (where legacy_table = X)` equals `count(*)` of each source (join-resolvable rows only; report any row dropped because its SOP/completion no longer exists).

### Recommended ledger shape (planner's final call)

```sql
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,                 -- no FK (Pitfall 5)
  kind text not null check (kind in ('approve','reject','sign_off','countersign','assign','unassign','publish','owner_change','review','observation','ai_finding_cleared','verify','verify_withdrawn','cadence_change')),
  actor_kind text not null check (actor_kind in ('person','agent')),
  actor_id uuid,                                 -- no FK to auth.users
  actor_name text,                               -- person display snapshot; REQUIRED for agents
  subject_kind text not null,                    -- 'sop' | 'completion' | 'worker' | 'category' | 'block' ...
  subject_id uuid,
  sop_id uuid,                                   -- denormalised for the Phase 59 filter; no FK
  summary text not null,                         -- one plain sentence, written by recordDecision
  details jsonb not null default '{}'::jsonb,
  source text not null default 'live' check (source in ('live','backfill')),
  legacy_table text, legacy_id uuid,
  supersedes_decision_id uuid references public.decisions(id),   -- FK to self is fine: only INSERTs reference it
  created_at timestamptz not null default now(),
  constraint decisions_agent_named check (actor_kind <> 'agent' or (actor_name is not null and btrim(actor_name) <> '')),
  constraint decisions_person_has_id check (actor_kind <> 'person' or actor_id is not null or source = 'backfill')
);
```

Indexes: `(organisation_id, created_at desc)`, `(organisation_id, kind, created_at desc)`, `(sop_id)`, unique `(legacy_table, legacy_id) where legacy_id is not null`. `actor_name` for people is a display snapshot taken at write time (the Office view in Phase 59 must not need to join `auth.users`, which may be deleted).

## RLS, Trigger and Grant Patterns (task 6)

**Existing precedent:** `sop_completion_signatures` (00038) and `sop_review_events` (00043) are "append-only" **only by having no UPDATE/DELETE policy**; service role bypasses RLS, so they are not actually protected. The repo has **no `BEFORE UPDATE OR DELETE` raising trigger and no `REVOKE ... ON TABLE`** anywhere [VERIFIED: grep of `create trigger` (00025, 00032, 00043 only - verification clear + default owner) and `revoke` (function EXECUTE only)]. 00070's trigger is the first of its kind.

**Default privileges:** no migration issues table-level `GRANT`; the project relies on Supabase's default privileges (anon/authenticated/service_role get table privileges on new `public` tables) and RLS [VERIFIED: grep; CITED: supabase docs via search - service_role bypasses RLS; it is an ordinary role for GRANT/REVOKE]. Therefore:

```sql
create or replace function public.decisions_refuse_change() returns trigger language plpgsql as $$
begin
  raise exception 'decisions is append-only: % is not allowed (record a new decision that supersedes it)', tg_op
    using errcode = 'restrict_violation';          -- 23001
end $$;

create trigger decisions_no_update_delete before update or delete on public.decisions
  for each row execute function public.decisions_refuse_change();
create trigger decisions_no_truncate before truncate on public.decisions
  for each statement execute function public.decisions_refuse_change();   -- row triggers do not fire on TRUNCATE
alter table public.decisions enable always trigger decisions_no_update_delete;
alter table public.decisions enable always trigger decisions_no_truncate;

revoke update, delete, truncate on public.decisions from anon, authenticated, service_role;
revoke all on public.decisions from anon;
```

- A row-level `BEFORE UPDATE/DELETE` trigger fires for every role including `service_role` and `postgres`, and **also for rows hit by ON DELETE CASCADE / SET NULL referential actions** [CITED: postgresql.org/docs/current/sql-createtrigger.html]. `BEFORE TRUNCATE` is statement-level only [CITED: same]. `ENABLE ALWAYS` makes it fire even when `session_replication_role = replica`; `DISABLE TRIGGER` still works for the table owner/superuser, so the dashboard SQL editor is refused by default but a deliberate `ALTER TABLE ... DISABLE TRIGGER` by `postgres` is not preventable from inside the table [CITED: postgresql.org/docs/current/sql-altertable.html]. State this honestly in the plan; the REVOKE is belt-and-braces for the three app roles only.
- `errcode = 'restrict_violation'` (23001) is a valid PL/pgSQL condition name [ASSUMED from PL/pgSQL Appendix A; if the migration rejects it, use the default `P0001`]. The probe should not depend on the code, only on the message containing `append-only`.
- **Probe vacuity (critical):** a row trigger only fires for rows that exist. `UPDATE decisions SET ... WHERE id = '<nonexistent>'` succeeds with 0 rows and proves nothing. The probe MUST first select a real row id (the backfilled row guarantees one exists) and assert the refusal error, then assert the row is byte-unchanged.

**RLS for `decisions`** (parse-compatible with `tests/lint/rls-org-scope.spec.ts`):
- The lint parses only **double-quoted** policy names: `create policy "name" on public.decisions for select ...` and `drop policy if exists "name" on ...`. Unquoted names (as in 00043/00045/00052) are invisible to it. Use quoted names.
- It requires every policy on a table with an `organisation_id` column to mention `current_organisation_id`, `organisation_id`, `auth.uid()` or `is_platform_admin` in USING/CHECK; and any WITH CHECK on a policy whose USING has `current_organisation_id` must also contain it. A table is recognised as tenant-owned by `create table ... ( ... organisation_id ... \n);` - keep the closing `);` at line start.
- Recommended policies (exactly two):
  - SELECT `to authenticated` using `organisation_id = public.current_organisation_id() and public.current_user_role() in ('admin','safety_manager')`. (Workers/supervisors have no read need; Phase 59 is admin-only.) Record in CAPABILITY-MATRIX.
  - INSERT `to authenticated` with check `organisation_id = public.current_organisation_id() and actor_kind = 'person' and actor_id = auth.uid() and source = 'live'` - D-07 asks for INSERT+SELECT RLS; pinning the actor to `auth.uid()` stops any org member forging someone else's decision through PostgREST. No USING (insert-only).
  - **No UPDATE or DELETE policy.**
- `recordDecision()` itself should use the service-role client with `organisationId` and the person actor taken from `getSessionContext()` only (never a parameter from a client) - this is what lets agent rows and rows written from actions that today use session clients under restrictive RLS (e.g. a supervisor's `recordObservation`) share one path. The INSERT policy then exists as a pinned backstop. [ASSUMED: planner may prefer session-client writes for person actors; either satisfies D-07.]

## Applying Migrations Live (task 7)

Idiom: copy `scripts/apply-phase51-migration.mjs` -> `scripts/apply-phase56-migration.mjs` [VERIFIED: read]:
1. Load `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` - all set on this machine).
2. `execSync('npx supabase db push')` first (supabase CLI is in `optionalDependencies`, bin present); on failure fall back to `managementSql(readFileSync(file))` per file in `MIGRATION_FILES` order via `POST https://api.supabase.com/v1/projects/<ref>/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`.
3. Post-apply assertions through the Management API (bypasses PostgREST cache), e.g. `to_regclass`, `pg_class.relrowsecurity`, plus for this phase: `select tgname, tgenabled from pg_trigger where tgrelid = 'public.decisions'::regclass and not tgisinternal` (expect `tgenabled = 'A'` for both), per-source backfill counts, `has_table_privilege('service_role','public.decisions','UPDATE')` = false, and the in-DB refusal probe.
4. `NOTIFY pgrst, 'reload schema'` via `managementSql` (CLAUDE.md [2026-06-15] PGRST205).
5. `MIGRATION_FILES` MUST list 00069 and 00070 (and any later corrective file) in apply order (CLAUDE.md [2026-07-28]); assert the order by index in a spec.

Migration numbering: latest is `00068_blocks_read_own_org.sql` -> use **00069** (sop_steps kind/markers, `sops.placement` + trigger, `standards` + attachments + seed) and **00070** (`decisions`, triggers, grants, RPC revoke, backfill). Keep the backfill in the same file as the table so a re-run re-asserts it.

**The service-role refusal probe (no existing script uses `set local role` - none in `scripts/` or `tests/`; CLAUDE.md [2026-09-30] describes the idiom, so write one):** Management API runs as `postgres`; to test the three app roles:

```sql
do $$
declare v_id uuid := (select id from public.decisions order by created_at limit 1); refused boolean;
begin
  if v_id is null then raise exception 'no decision row to probe'; end if;
  set local role service_role;
  refused := false;
  begin update public.decisions set summary = summary where id = v_id; exception when others then refused := true; end;
  if not refused then raise exception 'service_role UPDATE was NOT refused'; end if;
  refused := false;
  begin delete from public.decisions where id = v_id; exception when others then refused := true; end;
  if not refused then raise exception 'service_role DELETE was NOT refused'; end if;
end $$;
```

Also (the stronger proof the eval uses): supabase-js with the real `SUPABASE_SERVICE_ROLE_KEY` -> `.from('decisions').update({summary:'x'}).eq('id', realId)` and `.delete().eq('id', realId)` must both return an `error` whose message contains `append-only`, and a re-select must show the row unchanged. This needs no minted session, so it does not draw on the shared OTP budget.

## Placement and Department Display (task 8)

- `sop_machines (sop_id, machine_id, organisation_id, created_at)` composite PK, FK to `site_machines(id, organisation_id)` (00067). `site_machines.department_id -> departments ON DELETE SET NULL`. Department of a SOP = `departments` of its machines, via `sop_machines -> site_machines.department_id -> departments(name, colour)`.
- **Single placement writer: `setSopMachines` (`src/actions/site.ts:395`)**, used by the builder modal (`BuilderMachinesButton`) and the `/admin/site` editor. `listSopMachines` (`site.ts:482`) feeds the modal with machines, departments and `linkedIds`.
- Readers that show department today (and what they read):
  - `MachinePanel.tsx:26-74` - takes `department: {name,colour}` prop from `listSiteForWorker` (machine -> `department_id`). Already machine-derived; no change except confirming site SOPs show none.
  - `useWorkerSops.ts:44` selects the **legacy free-text `sops.department`** - the SOP-level department source that D-10 retires for display.
  - `listAdminSopRows` (`src/actions/admin-sop-list.ts`) reads `sop_departments`/`all_departments` for the library table scope filters (the access channel - leave) and already selects `sop_machines` (line 161) for the machine chips.
  - `admin-health.ts` / `listSiteHealthForOrg` (`site.ts` ~540) for floor health.
  - Plan: add a pure helper `sopDepartments(sopId, links, machines, departments)` and use it for display; add `placement` to `SOP_SELECT` so the admin row can say "Whole site" vs the machine names. Do not touch `sop_departments`/RLS (D-10).
- The modal (`BuilderMachinesButton`) is the placement UI; add a "Whole site" row that clears all machines (= `setSopMachines({machineIds: []})`). The trigger flips `placement` either way.
- `versioning.ts` `cloneSopAsDraft`/`uploadNewVersion` never copy `sop_machines` today (grep: no `sop_machines` in `versioning.ts`), so a new version lands as `'site'` with no machines. Existing behaviour; note it so Phase 58 (SOP-04) is not surprised.

## Where the Standards Panel Lives (task 9)

- The admin SOP page is the builder: `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx`. Its "Tools for this SOP" menu (lines ~110-150) renders `<BuilderMachinesButton sopId={sopId} />` and `<BuilderCategoryButton .../>` after the link list. **Add `<BuilderStandardsButton sopId={sopId} />` on the next line**, copying `BuilderMachinesButton`: a menu row + `createPortal` modal, Escape/backdrop close, loading/error/saved states, `react-hooks/set-state-in-effect`-safe "adjust state during render" pattern. This is the project's modal precedent; `src/components/ui` has only `BlueprintCanvas, BlueprintFrame, EvidenceButton, Pill, TabNav` - **no Dialog/Sheet primitive exists**, so do not introduce one.
- Panel content: (1) list manager - add / rename / remove (confirm text states how many places it will be detached from); (2) "On this SOP": SOP-level toggle chips, one row per section with its chips, expandable to that section's **converted** steps (`converted_from is not null`) with chips. Step labels attach to converted rows only (see Pitfall 2).
- Server actions in a new `src/actions/standards.ts`: every one opens with `requireAdminContext()` (admin/safety_manager) and filters by `ctx.organisationId`; async exports only (CLAUDE.md [2026-06-27]); a pure `formatStandardLabel` etc. goes in `src/lib/`.
- `journeys.ts` entry shape (one example):

```ts
{ id: 'log-in', group: 'Getting started', persona: 'Everyone', title: 'Log in', summary: '...',
  steps: [ { id: 's', type: 'start', label: 'Has an account' },
           { id: 'login', type: 'screen', label: 'Login screen', route: '/login', detail: '...' }, ... ] }
```
  The panel adds **no route**, so the "All screens" coverage cannot flag it; per CLAUDE.md the same-commit edit is to the existing builder journey (id `build` area, ~line 347: its `detail` already lists the Tools menu contents) - add "Standards" and "Placement: machine or whole site" to that detail, and add a step to the 'Refine & publish' group journey. Also `src/lib/uat/tests.ts` only if worth team review.
- `CAPABILITY-MATRIX.md` rows to add in the same commit as the policies: "Read decision ledger" (admin, safety_manager - RLS `decisions` SELECT), "Write decision ledger" (system via `recordDecision` + pinned own-actor INSERT policy; **no role can UPDATE/DELETE - DB trigger**), "Manage standards" (admin, safety_manager - RLS + `requireAdminContext`), "View standards" (all org members), "Place SOP on machines/site-wide" (existing row "Link SOPs to machines" gains `sops.placement` + the sync trigger).

## Deployed-Eval Scaffolding (task 10)

- Run: `npm run eval -- --phase 56` -> `scripts/run-evals.mjs` waits for `/api/version` sha == `git rev-parse HEAD` (15 min cap), runs `npx playwright test --project=evals --workers=1`, writes `.planning/evals/latest/EVAL-REPORT.md` + screenshots, copies to `.planning/phases/56-.../56-EVAL.md`. Eval files: `tests/evals/<area>.eval.ts` (project `evals`, `timeout: 90_000`, `retries: 1`). **Claude must READ the screenshots before declaring a pass** (CLAUDE.md).
- Session: `tests/evals/lib/session.ts` -> `signInAs(context, role)` where role in `admin | worker | siteAdmin | siteWorker`; mints a magic-link session via the service key (`generateLink` -> `verifyOtp`) and installs the `sb-<ref>-auth-token` cookie. `EVAL_ENV_READY` gates `test.skip`. **Each `signInAs` spends OTP budget** (CLAUDE.md [2026-09-28]) - mint once per describe in `beforeAll`/shared context.
- Fixtures: `node scripts/eval-fixtures.mjs` is idempotent: real org `bd2c2b88-...` with `eval-admin@`/`eval-worker@`; isolated "SOPstart Eval Site" org with `eval-site-admin@`, `eval-site-worker@`, dept "Forming", fixture SOPs "Eval site fixture SOP" (draft), "Eval plant fixture SOP" (published, assigned, linked to machine "EVAL Press"), "Eval walk fixture SOP" (published, unassigned, no machine, step 2 asks for a photo). Creating a SOP in a fixture = `sb.from('sops').insert({organisation_id, title, source_file_name, source_file_type:'docx', source_file_path:'', uploaded_by, status, source_type:'blank'})` (see the script). `tests/evals/lib/plant-fixture.ts` exports `ensurePlantFixture`, `REAL_SOPSTART_ORG_ID`, `shot`, `watchConsole`.
- `const SLOW = { timeout: 25_000 }` is declared locally in `governance.eval.ts`; every `expect` after a fresh `page.goto` into a `next/dynamic` + `useQuery` surface needs it (CLAUDE.md [2026-09-29]). Hard-coded "exactly N" assertions on the shared eval-site org break sibling evals - assert by name.
- Phase 56 eval should: (a) run the converter on the eval-site org's fixture SOPs first (via the same runner, `--org <id>`), (b) assert per fixture SOP in the DB that `count(hazard kind) >= layout HazardCard count + Warning/Caution callouts`, (c) open the walk eval's SOP as eval-worker and assert the old page still shows the original step count (no duplicates), (d) open Tools -> Standards as eval-site-admin, add "EVAL LOTO", attach at SOP and section level, reload as eval-site-worker and see the quiet label, rename, remove -> label gone, (e) trigger `owner_change` through the existing governance inbox owner picker (Phase 54) and assert the matching `decisions` row via the service key, (f) the service-role UPDATE/DELETE refusal probe, (g) assert the ledger is non-empty (backfill rows exist).
- Fixture DB-side reads in an eval use `createClient(url, SERVICE_KEY)` directly (see `governance.eval.ts` `beforeAll`).

## Test Registration and Bundle Gate (tasks 11-12)

**Playwright projects** (`playwright.config.ts`): per-phase projects use `testDir: '.'` and a broad `testMatch`, e.g.

```ts
{ name: 'phase55', testDir: '.', testMatch: /tests\/phase55\/.*\.(spec|test)\.ts$/, use: { browserName: 'chromium' } },
```
Add an identical `phase56` entry (`/tests\/phase56\/.*\.(spec|test)\.ts$/`) in Wave 0, and verify with `npx playwright test --list --project=phase56` (CLAUDE.md [2026-05-25]). Lint guards in `tests/lint/` are registered by **filename inside the `phase15-stubs` regex** (line 40 currently ends `...|use-viewport|walkthrough-store-ack|no-dead-internal-hrefs)\.spec\.ts$`) - any new `tests/lint/*.spec.ts` (e.g. `no-unfiltered-step-reads`) must be appended to that alternation and listed. `rls-org-scope` is already in it, so the new tables are linted automatically.

**Bundle gate** (`scripts/check-bundle-size.ts`, `.bundle-baseline.json`): two routes, `/sops/[sopId]/page` and `/sops/page`, **both baseline 817 KB, tolerance +2 KB**, baseline moved down by hand in Phase 55 (D-07). Never re-capture. The standards label on the worker walk rail touches `/sops/[sopId]`: keep it to (a) one embedded select `standard_attachments(standards(name))` added to `useSopDetail`'s existing query, (b) one ~20-line `StandardLabels` component using the `--accent-inspect` token (`.tg` pattern in one-screen-site.md), no icon import not already in the chunk. The panel (`BuilderStandardsButton`) is admin-only and already reached through the builder bundle; do not import it from any `/sops` worker file. Run `npm run build` in the plan's own verification (CLAUDE.md [2026-09-29]) - a new shared helper can scatter webpack chunks and move the gate with no code change on the route.

## Architecture Patterns

### System Flow

```
 layout_data (per section)  ──┐                                    ┌─> sop_steps (original rows, converted_from NULL) ── old readers (filtered)
 sop_steps rows (fallback) ───┼─> convertSop() [pure] ─> plan ─────┤
 sections.ts classifier ──────┘    │ per-kind rows + report        └─> sop_steps (generated rows, converted_from=run, source_key) ── Phase 58
                                   └─> hard gate: hazard>=, ppe>= per SOP (fail = no write for that SOP)
 runner script (service role) ── dry-run default ── --apply upserts by (section_id, source_key), deletes stale generated rows
                                   └─> sets sops.placement (via trigger/backfill), writes sop_conversion_runs (optional)

 server action / route handler ──(after primary write)──> recordDecision({actor, kind, subject, summary, details})
        approve · reject · sign_off · assign · publish · owner_change · review · observation · ai_finding_cleared
                                   └─> decisions (service role insert) ──> BEFORE UPDATE/DELETE/TRUNCATE trigger refuses everyone

 Builder Tools menu ─> BuilderStandardsButton (portal modal) ─> standards actions (requireAdminContext) ─> standards / standard_attachments
 Worker /sops/[sopId] ─> useSopDetail (+ standard_attachments embed) ─> StandardLabels (quiet label)
```

### Recommended Structure
```
supabase/migrations/00069_sop_kinds_placement_standards.sql
supabase/migrations/00070_decisions_ledger.sql
src/lib/sop/convert/            # pure: types.ts, block-to-step.ts (per-type readers), plan.ts (idempotent diff), report.ts
src/lib/decisions/record.ts     # plain module: recordDecision(), actor types, AGENT constants (NOT 'use server')
src/actions/standards.ts        # 'use server', async only
scripts/convert-sops-to-steps.ts   # runner: --dry-run (default) | --apply | --org | --sop
scripts/apply-phase56-migration.mjs
scripts/probe-decisions-immutable.mjs
tests/phase56/*.spec.ts  tests/lint/no-unfiltered-step-reads.spec.ts  tests/evals/sop-ledger.eval.ts
```

### Pattern 1: Idempotent re-run by stable key (resolves D-01's "replace only what it wrote")
Recompute the full desired generated row set for a SOP; upsert on `(section_id, source_key)`; delete generated rows (`converted_from is not null`) in that SOP's sections whose key is no longer produced. `source_key` = layout `props.id` (+ `:w` / `:c` suffix for a generated warning/caution hazard) or `row:<original sop_steps.id>` on the fallback path. Consequences: (1) re-run on an unchanged SOP updates nothing (compare content; skip when a stored layout hash matches) - a no-op; (2) a builder text edit updates the row in place, so a **step-level standard attachment survives**; (3) a deleted block deletes its generated row and (by FK cascade) its labels. A "delete all generated rows and re-insert" implementation would silently wipe every step-level standard on each re-run - the main reason not to take the simple route. Never match originals by `sort_order`/`step_number` (CLAUDE.md [2026-06-26]/[2026-09-27]).

### Pattern 2: Hard gate before write
Per SOP compute `before` (counts from the source) and `after` (counts of the rows about to be written) per kind, then assert `after.hazard >= before.hazardCards + before.warningCaution` and `after.ppe >= before.ppeCards` and every PPE item string present. A SOP failing the gate writes nothing and is listed; the runner exits non-zero. Unknown block type, thrown reader, or a Hazard/PPE card yielding empty text = failure. Default to `--dry-run`; the first production run is a dry run reviewed by Simon-facing report.

### Pattern 3: `recordDecision()` after the primary write, awaited, loud on failure
There is no cross-statement transaction in supabase-js. Call `recordDecision` **after** the primary write succeeds and **await** it; on ledger failure `console.error('[recordDecision] FAILED', ...)` and return the action's success but with a distinct log tag the sweep and a reconcile query can find (fail-soft keeps a signed-off completion from erroring on a ledger hiccup; the alternative, failing the action after the primary write, leaves a mutated row with an "error" toast). Recommend fail-soft + a `scripts/` reconcile that lists decision-table rows lacking a ledger row. [ASSUMED - confirm with the user if audit completeness must beat availability; an in-DB RPC doing both writes atomically is the only fully atomic option and is a much larger change.]

### Anti-Patterns to Avoid
- **Inferring "generated" from `kind`** - use `converted_from`.
- **Using the strict or lenient `puckPropsToBlockContent` for extraction** (throws / silently drops).
- **A private hazard/PPE keyword list** in the converter (CLAUDE.md [2026-09-27]).
- **Quoting forbidden literals in comments** that a grep guard scans (CLAUDE.md [2026-09-28]): say "no elevated-privilege function", not the literal.
- **`on delete cascade` / `set null` FKs on `decisions`** (Pitfall 5).
- **Editing the bundle baseline** to make the gate green (CLAUDE.md [2026-09-13]).
- **Declaring conversion done from a green build** - read the dry-run report and the deployed screenshots.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Is this a hazard/PPE section | Keyword list | `isHazardSection` / `isPpeSection` in `src/lib/sop/sections.ts` | Single classifier; two copies already drifted once |
| Admin auth in actions | Role checks inline | `requireAdminContext()` (`src/lib/auth/guards.ts`) / `getSessionContext()` | Org/actor come from the session only |
| Stripping layout metadata | Own key list | `stripMeta()` from `block-registry.tsx` | `id`, `junctionId`, `block_provenance` |
| Modal | A new Dialog primitive | `BuilderMachinesButton` portal pattern | No Dialog exists; this is the precedent |
| Migration apply + cache reload | New applier | Copy `apply-phase51-migration.mjs` | Handles `db push` fallback, assertions, `NOTIFY pgrst` |
| Immutability | App-level "don't update" checks | DB trigger + `ENABLE ALWAYS` | Service role bypasses RLS; only a trigger refuses it |
| Source-contract wiring check | Presence-of-token grep | Assert the writer **calls** `recordDecision(` after its insert (CLAUDE.md [2026-06-05]) + a data-keyed sweep over every table write | A token in a comment passes a presence grep |
| Org member display names | New query | `getOrgMembers()` (`assignments.ts`) | Already reused three times |

## Runtime State Inventory

This is a data-migration phase (not a rename), but the "what outlives the code edit" questions apply:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 69 SOPs / 210 sections / 413 `sop_steps` rows hold the old shape; 27 `sop_machines` links; `sops.placement` does not exist | Data migration: converter run (`--apply`) + placement backfill `update` in 00069; ledger backfill in 00070 |
| Live service config | Supabase DB only (no n8n/Datadog in this repo). PostgREST schema cache | `NOTIFY pgrst, 'reload schema'` after DDL |
| OS-registered state | None - verified: no scheduled job or PM2 entry touches these tables (Railway deploy only) | None |
| Secrets/env vars | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` present in `.env.local`; Railway has the service key | None; the runner/applier read `.env.local` |
| Build artifacts | `src/types/database.types.ts` is hand-maintained - will not know the new columns/tables | Hand-edit types in the same plan |

## Common Pitfalls

### Pitfall 1: Old readers show every step twice
**What goes wrong:** the old worker page, builder page, activity page, NowCard minutes and the walkthrough all embed `sop_steps(*)`; generated rows join them. Hazard sections gain steps, so `procedureSections()` presents "Hazards" as a job and `resolveRenderFamily` flips them to `steps`; `NowCard` doubles the time estimate.
**How to avoid:** add `converted_from is null` to every old read. Verified sites: `src/hooks/useSopDetail.ts:20` (embedded: `.is('sop_sections.sop_steps.converted_from', null)` - nested-embed filters are supported and do not drop parent rows without `!inner` [CITED: docs.postgrest.org resource embedding]), `src/app/api/sops/[sopId]/route.ts:18`, `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx:36`, `src/app/(protected)/activity/[completionId]/page.tsx:119`, `src/components/sop/plant/NowCard.tsx:25`, `src/lib/agent-layer/synthesis.ts:71` (+ `sop-pack.ts:20` consumes it), `src/lib/parsers/ai-reviewer/jobs/job-e-terminology.ts:131`, `src/actions/versioning.ts:459` (**clone must not copy generated rows**). `sections/[sectionId]/route.ts:99` updates by id and is safe. Add a lint spec `tests/lint/no-unfiltered-step-reads.spec.ts` that fails on any `sop_steps` select in `src/` that neither references `converted_from` nor is on a reasoned allowlist (the Phase 58 reader is the only legitimate unfiltered consumer).
**Warning signs:** a job chooser listing "Hazards"; "Step 1 of 80" on a 40-step SOP; doubled minutes.

### Pitfall 2: Step-level labels cannot reach the OLD walk rail
Generated rows are not rendered by the old walkthrough (it renders original rows), so a standard attached to a generated step is invisible there. SOP-level and section-level labels DO render (sections are shared rows). D-11's "walk rail shows LOTO" is therefore satisfiable now for SOP and section level; step level is visible in the panel and becomes visible on the walk in Phase 58. State this in the plan; do not build a generated->original step mapping unless the user asks (Open Question 3).

### Pitfall 3: Re-run wipes step-level standards
See Pattern 1. Use upsert-by-key; test "attach, edit text in layout, re-run, label still attached".

### Pitfall 4: A row trigger probe that matches zero rows
See section 6. Probe a real id.

### Pitfall 5: FKs and cascades on an immutable table
`sop_approvals.sop_id`, `sop_observations.observed_worker_id` etc. use `ON DELETE CASCADE`/`SET NULL`; an FK from `decisions` with either action would make a SOP/user/org deletion raise through the trigger (row triggers fire for referential actions). `deleteSop`, org merges (memory: prod org merge 2026-09-12) and eval cleanup would break. Use plain uuid columns without FKs for `organisation_id`, `actor_id`, `subject_id`, `sop_id`. Only `supersedes_decision_id -> decisions(id)` is safe (insert-only reference).

### Pitfall 6: `completion_sign_offs` and `sop_assignments` missing from the backfill
See Summary. Add both; otherwise the ledger holds one row on production.

### Pitfall 7: `verifyBlock` has no SOP in scope
It receives only `blockId`. A decision needs `sop_id`/`organisation_id`: resolve via the junction -> section -> sop join with the session client (RLS-scoped). Do not accept a `sopId` parameter from the client (client-trusted parameter class, CLAUDE.md [2026-10-03]).

### Pitfall 8: Source-contract guards that quote their own forbidden literals
The sweep spec and lint guards scan comments. Describe patterns in words (CLAUDE.md [2026-09-28]).

### Pitfall 9: `'use server'` file with a sync export
`src/actions/standards.ts` may export only async functions; label formatting and the `recordDecision` actor constants live in plain modules (CLAUDE.md [2026-06-27]). Run `npm run build`, not just `tsc`.

### Pitfall 10: Unquoted policy names bypass the RLS lint
Use `create policy "..."`; the lint's regex requires double quotes. A quoted-name miss is a vacuous pass.

### Pitfall 11: Seed per org vs. 39 orgs
Production has 39 `organisations` rows (the "one organisation" cut in Phase 55 stopped sign-up creating more; it did not delete the rest). A seed `insert ... select ... from organisations cross join (values ...) on conflict do nothing` creates 234 rows; harmless, but index `(organisation_id, lower(name))` unique so reruns are no-ops. Do not hard-code the SOPstart org id (the eval-site org needs the list too).

### Pitfall 12: Agent decisions have no live producer
See Open Question 1; do not mark DEC-04 done on a column alone.

## Code Examples

### Reader that returns an explicit failure instead of null
```ts
// src/lib/sop/convert/block-to-step.ts  (pure; imports types only)
export type ConvertedStep = { kind: 'hazard'|'ppe'|'step'|'check'; text: string; photoRequired: boolean;
  tip?: string; imagePaths: string[]; sourceKey: string }
export type ReadResult = { steps: ConvertedStep[]; dropped?: 'voice' | 'video'; unreadable?: string }

export function readItem(item: { type: string; props: Record<string, unknown> & { id: string } }): ReadResult {
  const p = item.props
  switch (item.type) {
    case 'HazardCardBlock': {
      const body = String(p.body ?? '').trim()
      if (!body) return { steps: [], unreadable: 'hazard card has no text' }   // gate counts this as a FAILURE
      return { steps: [{ kind: 'hazard', text: body, photoRequired: false, imagePaths: [], sourceKey: p.id }] }
    }
    // ... one case per registry key; default => { steps: [], unreadable: `unknown block type ${item.type}` }
  }
}
```

### Idempotent apply for one SOP
```ts
// desired: ConvertedStep[] per section (already ordered, with sourceKey)
// 1. upsert on (section_id, source_key): converted_from = runId, kind, text, tip, photo_required, step_number = index+1
// 2. delete from sop_steps where section_id = any($sections) and converted_from is not null and source_key <> all($keys)
// 3. never touch rows where converted_from is null
```

### `recordDecision` signature
```ts
export type DecisionActor =
  | { kind: 'person'; id: string; name: string }
  | { kind: 'agent'; name: string }               // name mandatory by type AND by the DB CHECK
export async function recordDecision(input: {
  organisationId: string; actor: DecisionActor; kind: DecisionKind
  subject: { kind: string; id: string }; sopId?: string; summary: string; details?: Record<string, unknown>
  supersedes?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| "Append-only" = no UPDATE/DELETE policy (00038, 00043) | RLS + `BEFORE` trigger + `ENABLE ALWAYS` + REVOKE | Service role is also refused |
| Hazard/PPE as section types | Hazard/PPE as step kinds | Phase 58 focus rule acknowledges them step-by-step |
| Departments picked per SOP | Derived from machine | Display only this phase |

**Deprecated/outdated:** `accept_block_update` / `decline_block_update` RPCs (no `src/` caller since Phase 55) - revoke; `refresher_interval_months` (refresher cadence dropped in the MVP; `setRefresherInterval` is not a ledger writer).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fail-soft ledger write (log + reconcile) is acceptable over atomic/blocking | Pattern 3 | If audit completeness must beat availability, a decision could be missing after a successful action; needs an RPC-based design |
| A2 | The placement trigger runs correctly as invoker for admin-session `setSopMachines` and for FK-cascade deletes | Placement | Placement could drift after machine deletion; verify in Wave 0 probe, else use SECURITY DEFINER locked per [2026-07-05] |
| A3 | `ReviewerFlag.block_id` equals the `sop_section_blocks.id` passed to `verifyBlock` | Writers (AI clear) | `ai_finding_cleared` would never trigger; confirm in Wave 0 |
| A4 | `restrict_violation` is accepted as an `errcode` in `RAISE ... USING` | RLS/trigger | Migration error at apply; fall back to default `P0001` |
| A5 | Phase 58 wants `required_tools` / `time_estimate_minutes` carried onto generated steps | Layout section | If not, the zip logic is wasted effort (small) |
| A6 | Workers/supervisors should NOT be able to read the ledger | RLS | If Phase 59/60 expects supervisor read, add a role to the SELECT policy later (additive) |
| A7 | Self-add/remove assignment and `requestAssessorReview` are not ledger decisions | Writers | If the user wants every assignment logged, add two more hooks |

## Open Questions

1. **What is an "AI agent" in this codebase for DEC-04, and who produces an agent decision today?**
   - Known: agents authenticate as normal session users (`/api/ai-fields/write` uses `getSessionContext()`); `applyAiWrite`, `acceptProposal`, `rejectProposal` (`src/actions/ai-fields.ts`) are the only agent-adjacent write paths; the AI reviewer raises flags but never decides.
   - Unclear: whether any action in this phase is made BY an agent.
   - Recommendation: deliver DEC-04 as (a) `actor_kind='agent'` + DB CHECK requiring `actor_name`, (b) `recordDecision` actor union that cannot be called with an unnamed agent, (c) hook `applyAiWrite` (auto-applied agent write) with `actor = { kind:'agent', name: <caller-supplied agent label, e.g. header/body field validated against an allowlist> }` as kind `ai_field_write`, (d) the eval inserts an agent row via the service key and asserts both the named row and the CHECK refusal of an unnamed one. Confirm with the user before planning (c).
2. **Is the per-reader `converted_from is null` filter acceptable, or should generated rows live in their own table?** D-01 is locked, so plan the filter (8 readers + lint guard). If the plan-checker judges this too invasive, escalate - the alternative changes D-01.
3. **Step-level standard labels on the OLD walk rail.** Not satisfiable without a generated->original step mapping. Recommend: SOP+section labels now, step labels in the panel and Phase 58. Confirm.
4. **Where do photo refs of generated steps live?** D-02 says "kept via `sop_images`", but `sop_images.step_id` points at original steps and re-pointing would modify original rows (violates D-01); copying rows would show images twice in old readers. Recommendation: `sop_steps.image_paths text[]` holding the storage paths, each verified at conversion time to equal an existing `sop_images.storage_path` for the same SOP (counted in the report). Confirm.
5. **Report persistence.** Recommend a small `sop_conversion_runs` table (run id, sop_id, org, source `layout|rows`, `layout_hash`, before/after jsonb, ok) so the eval and Phase 58 can read it and "no-op when hash unchanged" has somewhere to live. Alternative: runner stdout only. Planner's call.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | scripts, tests | yes | v22.16.0 | - |
| `tsx` | converter runner | yes | 4.19.2 | - |
| `supabase` CLI | `db push` | yes (optionalDependency, bin present) | ^2.22.6 | Management API raw SQL (applier fallback) |
| `SUPABASE_ACCESS_TOKEN` | applier, probe, census | yes (`.env.local`) | - | SQL editor paste |
| `SUPABASE_SERVICE_ROLE_KEY` | runner, evals, probe | yes | - | - |
| Railway deploy of HEAD | `npm run eval` | yes (`/api/version` poll) | - | `--no-wait` |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright Test (specs + evals) |
| Config file | `playwright.config.ts` (add project `phase56`; append lint spec names to `phase15-stubs` regex) |
| Quick run command | `npx playwright test --project=phase56` |
| Full suite command | `npx playwright test` **once per gate only** (shared OTP budget; compare against recorded baseline, never loop) |
| Deployed eval | `npm run eval -- --phase 56` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOP-01 | Every registry type (18) maps per D-02/D-03; unknown type, empty hazard/PPE = failure | unit (pure, static imports) | `npx playwright test --project=phase56 convert-kinds` | Wave 0 |
| SOP-01 | hazard >= (HazardCards + Warning/Caution), ppe >= PPE cards, every PPE item present, per SOP | unit + live read-only | `... convert-gate` ; runner `--dry-run` report over production | Wave 0 |
| SOP-01 | Re-run on unchanged SOP = no-op; after a layout edit only generated rows change; originals untouched | unit (plan diff) | `... convert-idempotent` | Wave 0 |
| SOP-01 | No old reader sees generated rows; clone skips them | lint (source) | `npx playwright test --project=phase15-stubs no-unfiltered-step-reads` | Wave 0 |
| SOP-01 | Old SOP page + builder unchanged on a converted SOP | deployed eval | `npm run eval -- --phase 56` (`sop-ledger.eval.ts`, walk fixture) | Wave 0 |
| SOP-02 | Add/rename/remove; rename propagates; remove detaches everywhere (FK cascade); step label survives re-run | live DB spec (service key) + eval | `... standards-model` ; eval | Wave 0 |
| SOP-02 | RLS: org members read, only admin/safety_manager write; new tables pass lint | lint | `phase15-stubs rls-org-scope` | exists |
| SOP-02 | Label shows for worker (SOP + section); bundle gate holds at 817 KB +2 | eval + build | eval; `npm run build` (postbuild gate) | Wave 0 |
| SOP-03 | placement flips with `sop_machines` insert/delete incl. FK cascade; never both | live DB spec | `... placement-sync` | Wave 0 |
| SOP-03 | Department shown = machine departments; site SOP shows none | unit + eval screenshot | `... sop-departments` ; eval | Wave 0 |
| DEC-01 | Every write to the 7 decision tables is in a file that calls `recordDecision(` or is allowlisted with a reason (data-keyed) | source sweep | `... decision-writers-sweep` | Wave 0 |
| DEC-01 | Each hooked writer calls `recordDecision(` AFTER its insert and awaits it | source contract | `... decision-writer-wiring` | Wave 0 |
| DEC-01 | A real action produces a row (owner change via governance inbox; sign-off from /activity) | deployed eval | eval | Wave 0 |
| DEC-01 | Backfill: per-source counts equal; ledger non-empty | migration assertion + eval | applier assertions; eval | Wave 0 |
| DEC-03 | UPDATE and DELETE on an EXISTING row refused as service role (and row unchanged); TRUNCATE refused; trigger `tgenabled='A'`; no UPDATE/DELETE/TRUNCATE grant | live probe | `node scripts/probe-decisions-immutable.mjs` (Management API `set local role service_role` DO block) + supabase-js service-key attempt inside the eval | Wave 0 |
| DEC-04 | Unnamed agent rejected by type, by `recordDecision`, and by DB CHECK; named agent row stored | unit + live | `... decision-agent` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase56` (+ `npx tsc --noEmit`; `npm run build` for any task touching `src/actions/*`, routes or the `/sops` chunk).
- **Per wave merge:** `npm run build` (postbuild bundle gate) + the lint project once.
- **Phase gate:** full suite once, then `npm run eval -- --phase 56` against the pushed HEAD; read screenshots; non-live failures compared to the Phase 55 baseline (`55-BASELINE-FAILURES.md`).

### Wave 0 Gaps
- [ ] `playwright.config.ts` - `phase56` project + extend `phase15-stubs` regex for `no-unfiltered-step-reads`
- [ ] `tests/phase56/` - convert-kinds, convert-gate, convert-idempotent, standards-model, placement-sync, sop-departments, decision-writers-sweep, decision-writer-wiring, decision-agent
- [ ] `scripts/convert-sops-to-steps.ts` dry-run against production (read-only) BEFORE any write - this is the riskiest-change de-risk
- [ ] `scripts/probe-decisions-immutable.mjs`, `scripts/apply-phase56-migration.mjs`
- [ ] `tests/evals/sop-ledger.eval.ts` (+ extend `scripts/eval-fixtures.mjs` with a fixture SOP that has hazard, PPE, warning/caution and a photo step if the existing ones lack them)
- [ ] Confirm A2 and A3 with two small probes

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no new auth) | existing Supabase session |
| V3 Session Management | no | - |
| V4 Access Control | **yes** | `requireAdminContext()` on every standards action; RLS two-policy pattern; ledger SELECT admin-only; INSERT pinned to `auth.uid()`; no UPDATE/DELETE anywhere |
| V5 Input Validation | yes | Zod in `src/lib/validators/` for standards names (trim, 1-60 chars, unique per org case-insensitive) and attach targets; target must belong to the session org |
| V6 Cryptography | no | - |
| V7 Logging/Audit | **yes** | the ledger itself; immutability by trigger |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged ledger rows via PostgREST by any org member | Spoofing/Tampering | INSERT policy `actor_id = auth.uid() and actor_kind='person' and source='live'`; agents/system only via service role |
| Edit/delete a decision via service role, SQL editor or migration | Tampering/Repudiation | BEFORE UPDATE/DELETE row trigger + BEFORE TRUNCATE statement trigger, `ENABLE ALWAYS`, REVOKE on app roles |
| Cross-tenant standards attach (attach org A's standard to org B's SOP) | Tampering/Info disclosure | Attachment table carries `organisation_id` and composite FKs `(standard_id, organisation_id)` and a check that the target SOP/section/step belongs to the same org (action self-enforces; RLS conjoins org predicate in USING and WITH CHECK, CLAUDE.md [2026-08-04]) |
| Client-supplied `sopId`/`organisationId` into `recordDecision` | Spoofing | Org and actor from `getSessionContext()` only; resolve `sop_id` server-side (CLAUDE.md [2026-10-03]) |
| Parameter-trusting SECURITY DEFINER function | Info disclosure | Placement trigger is invoker; if definer is needed, lock to service role ([2026-07-05]); revoke `accept_block_update`/`decline_block_update` from `authenticated` |
| Converter run against the wrong org | Tampering | Runner takes `--org`/`--sop`, defaults to dry-run, refuses `--apply` without an explicit scope flag |
| Formula/markup injection in `summary`/`details` surfaced later | Tampering | `summary` is composed by `recordDecision` from ids/enums, not raw user text; free text (comments, reasons) goes in `details` only |

## Sources

### Primary (HIGH confidence)
- Codebase reads this session: `block-registry.tsx`, `puck-to-block-content.ts`, `parsed-sop-to-layout-data.ts`, `layout-schema.ts`, `content-ops.ts`, `src/lib/sop/sections.ts`, `src/lib/validators/blocks.ts`, `src/components/sop/blocks/*` prop schemas, migrations 00003/00007/00010/00025/00038/00043/00045/00052/00067, `src/actions/{approvals,governance,completions,observations,assignments,site,sop-section-blocks,versioning}.ts`, `publish-core.ts`, publish route, `useVerifyChecklist.ts`, `useSopDetail.ts`, `BuilderStageShell.tsx`, `BuilderMachinesButton.tsx`, `tests/lint/rls-org-scope.spec.ts`, `scripts/apply-phase51-migration.mjs`, `scripts/run-evals.mjs`, `tests/evals/lib/session.ts`, `governance.eval.ts`, `playwright.config.ts`, `check-bundle-size.ts`, `.bundle-baseline.json`, `CAPABILITY-MATRIX.md`, `one-screen-site.md`
- Live production census: read-only aggregate SELECTs via the Supabase Management API (counts and type names only; no content read, nothing written)
- https://www.postgresql.org/docs/current/sql-createtrigger.html - row triggers fire for cascading referential actions; TRUNCATE triggers are statement-level only
- https://www.postgresql.org/docs/current/sql-altertable.html - `ENABLE ALWAYS TRIGGER`, `session_replication_role`, owner/superuser rights
- https://docs.postgrest.org/en/stable/references/api/resource_embedding.html - nested embedded filters; parent rows kept without `!inner`

### Secondary (MEDIUM confidence)
- Web search (Supabase docs/blog summaries): `service_role` is a predefined Postgres role that bypasses RLS and is governed by normal GRANT/REVOKE

### Tertiary (LOW confidence)
- `restrict_violation` as a `RAISE ... USING errcode` name (A4); invoker-trigger behaviour on FK-cascade placement updates (A2); `ReviewerFlag.block_id` == junction id (A3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new
- Architecture: HIGH for conversion/ledger/trigger mechanics (verified in code + Postgres docs); MEDIUM for fail-soft ledger writes, agent identity, and step-level label visibility (three design questions flagged)
- Pitfalls: HIGH - each traced to a specific file/line or a live count

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (30 days; invalidated early if Phase 57-58 plans change the reader set or if production gains new block types)
