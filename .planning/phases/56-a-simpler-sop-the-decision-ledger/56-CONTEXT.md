# Phase 56: A Simpler SOP & the Decision Ledger - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-found the SOP on **sections → steps**, where every step has a kind from exactly four — `hazard · ppe · step · check` — and convert every existing SOP losslessly (a before/after count per SOP). Add **standards** (a plain label at SOP, section or step level, one org-wide list with a standalone manager panel reached from the admin SOP page). Give every SOP an explicit **placement** — one or more machines, or the whole site — with its department derived from its machine(s). Create the **decision ledger**: one append-only table the database itself protects, backfilled from the five tables that record decisions today, and written to by every existing approve / reject / sign-off / assign / publish / owner-change / observation / cleared-AI-finding path (agent decisions name the agent).

The old SOP page and the Phase 26 builder keep working over converted SOPs until Phase 58 replaces them. **No table or row is dropped.** No new screens beyond the standards panel; the Office ledger view (DEC-02) is Phase 59, the Workshop mount of the standards manager is Phase 61, the focus walk/editor over the new rows is Phase 58.

Requirements: SOP-01, SOP-02, SOP-03, DEC-01, DEC-03, DEC-04.

</domain>

<decisions>
## Implementation Decisions

### Conversion (SOP-01)
- **D-01 — New rows beside the old; `layout_data` untouched.** *(Amended at planning 2026-10-04 — see "Amendments" below.)* The converter writes converted steps as NEW rows in a NEW table (suggested name `sop_focus_steps`: `section_id`, `kind` `hazard | ppe | step | check`, `text`, `tip`, `photo_required`, `image_paths`, `sort_order`, `source_key`, `run_id`, org-scoped RLS), leaving every pre-existing `sop_sections` / `sop_steps` row and every `layout_data` JSON exactly as it is. The old builder (which renders exclusively from `layout_data`, per CLAUDE.md [2026-07-07]) and the old SOP page keep working unchanged **because nothing they read gains a row**. The conversion is **idempotent and re-runnable**: upsert by `(section_id, source_key)`, delete generated rows whose key is no longer produced, so it can be re-run at the Phase 58 cutover to pick up builder edits made in between without losing step-level standard attachments.
- **D-02 — Kind mapping for the 17 block types ("check = anything you verify").**
  - `HazardCard` → `hazard`; `PPECard` → `ppe`
  - `Step`, `StepWithPhotos` → `step` (a `StepWithPhotos` becomes a step that asks for a photo)
  - `Measurement`, `Inspect`, `Decision`, `SignOff` → `check` (text says what to confirm; measurement units/ranges/thresholds and decision branches folded into the step text)
  - `Callout`, `Text`, `Heading`, `Zone`, `Escalate`, `Model` → `step` (text)
  - `Photo`, `PhotoGrid` → `step` that asks for a photo (`photo_required`), image refs kept via `sop_images`
  - `VoiceNote` → `step` text from its transcript if any, else dropped with a count (voice was cut in Phase 55)
  - The plan writes this table out in full; the before/after count report is per SOP and per kind, and **hazard and PPE counts must be ≥ the source count** (a hazard/PPE card that yields nothing is a conversion failure, not a warning).
- **D-03 — `warning` / `caution` become a hazard step placed immediately before the parent step** (so the Phase 58 walk acknowledges it before the action, FOC-02). `tip` stays as a note on the step. These generated hazard steps count toward the hazard total in the before/after report.
- **D-04 — Section typing is preserved, not re-derived.** The converter reads the existing `section_type` + the shared classifier in `src/lib/sop/sections.ts` (single source of truth — never a private copy, per CLAUDE.md [2026-09-27]) only to decide default kinds for untyped content; it does not rename or merge sections.

### Decision ledger (DEC-01, DEC-03, DEC-04)
- **D-05 — One physical table (`decisions`), beside the existing tables, never replacing them.** `sop_approvals`, `sop_completion_signatures`, `sop_observations`, `sop_review_events`, `sop_block_update_decisions` stay and keep being written; every writer ALSO writes one ledger row through a single `recordDecision()` writer. (Resolves one-screen-site.md open question 5.)
- **D-06 — Backfill history.** One migration inserts a ledger row per existing row of those five tables, carrying the original timestamp and actor, flagged `source = 'backfill'`. The migration's assertion compares counts per source table, and the deployed eval proves the Office-less ledger is non-empty.
- **D-07 — Append-only enforced for EVERY role, including service role.** RLS grants `INSERT` + `SELECT` only (org-scoped `USING` and matching `WITH CHECK`, per `tests/lint/rls-org-scope.spec.ts`), AND a `BEFORE UPDATE OR DELETE` trigger raises unconditionally — the admin client, a migration and the dashboard SQL editor are all refused. A correction is a new decision that refers to the one it corrects (`supersedes_decision_id`). The eval/probe attempts an `UPDATE` and a `DELETE` as service role and asserts both are refused.
- **D-08 — Writers that must call `recordDecision()` in this phase:** `approveStep` (approve + send back), `signOffCompletion` (sign off + reject), `recordSignature`, the assignment writer(s) in `src/actions/assignments.ts`, the publish route (`src/app/api/sops/[sopId]/publish/route.ts` via `assertPublishGates` → publish), `setSopOwner`, `setReviewCadence` / review events, `recordObservation`, `verifyBlock` / `unverifyBlock` and the AI-finding clear path, and `requestAssessorReview` outcomes. The plan enumerates these by grepping every write to the five decision tables (data-keyed, not feature-keyed — CLAUDE.md [2026-07-29]).

### Placement & department (SOP-03)
- **D-09 — Explicit `sops.placement` = `'machine' | 'site'`.** The conversion sets `'site'` for every SOP with zero `sop_machines` rows and `'machine'` otherwise. Placing a site SOP on a machine flips it to `'machine'`; removing its last machine flips it back to `'site'`. A SOP is never both.
- **D-10 — Department is derived for display only; access wiring is untouched.** Shown department(s) = the departments of the SOP's machines (site SOPs show none). `sop_departments`, `all_departments`, `access_grants` and every department-visibility RLS policy keep governing WHO CAN SEE a SOP exactly as today, so the access-wiring screen that Phase 59 keeps unchanged (OFF-06) still works. Nothing in RLS visibility changes this phase; the separate-department picker is simply no longer the thing an admin uses to say where a SOP lives.

### Standards (SOP-02)
- **D-11 — Seeded starter list, visible to everyone.** Each org is seeded with an editable list — LOTO, Hot Work, Confined Space, Working at Height, Manual Handling, Electrical Isolation. The label is a quiet label (one-screen-site.md CSS note: never a chip competing with a badge) and renders wherever the SOP is shown, **including the worker walk rail** — a worker should know a step is under LOTO.
- **D-12 — Standards attach at three levels** (SOP, section, step) through one org-scoped `standards` table and an attachment table; add / rename / remove from one list. The manager is a standalone panel opened from the admin SOP page in this phase (Phase 61 mounts it in the Workshop). Renaming a standard renames it everywhere; removing one detaches it everywhere (no orphan labels).
- **D-13 — Old library content stays.** Blocks that were linked from the retired reusable library remain in the SOPs that used them (the block tables and `sop_section_blocks` junctions were kept in Phase 55); the converter treats them like any other block of their type.

### Amendments at planning (2026-10-04, from 56-RESEARCH.md — orchestrator judgment calls, Simon to redirect if wrong)
- **A-01 (changes D-01's mechanics, not its intent).** Generated rows live in their OWN table, not in `sop_steps`. Research found ~8 old readers embed `sop_steps(*)` (`useSopDetail`, `api/sops/[sopId]`, builder page, activity page, `NowCard`, agent synthesis, reviewer job E, version clone); putting generated rows in the same table would double every step on the old page, turn hazard sections into "jobs", double time estimates and require a filter + lint guard at every reader. A separate table needs zero reader changes and keeps the old surfaces byte-identical. Phase 58 reads the new table.
- **A-02 (D-02 corrections).** The registry has **18** block types: `VisualBlock` → `step` carrying its image. `VoiceNoteBlock` has no transcript field → dropped with a count. Warning/Caution are emitted by the parser as `CalloutBlock` titled "Warning"/"Caution" placed AFTER their step; the converter maps those two titles to a `hazard` step placed BEFORE the preceding step (D-03 overrides D-02's Callout→step for them). Never use the strict/lenient `puckPropsToBlockContent` for extraction (throws / drops fields) — the converter has its own per-type readers that return an explicit failure.
- **A-03 (D-06 correction, data-keyed).** Backfill sources are **seven** tables: the five named plus `completion_sign_offs` (sign-off/reject lives there) and `sop_assignments`. The five alone hold one row on production.
- **A-04 (D-08 corrections).** `requestAssessorReview` writes only `worker_notifications` — not a decision, dropped from the list. The AI-finding clear path is `verifyBlock` when the block has open reviewer flags (resolve SOP/org server-side from the junction → section → SOP, never from a client parameter). The orphan `accept_block_update` / `decline_block_update` RPCs (no `src/` caller) get `REVOKE EXECUTE` from `authenticated`. `applyAiWrite` (`src/actions/ai-fields.ts`) is the one live agent-authored write and is hooked as `actor_kind='agent'` with a validated agent name — DEC-04 is a column + CHECK + one real producer + an eval probe, never a column alone.
- **A-05 (Q3).** SOP- and section-level standard labels render on the old walk rail now; step-level labels show in the standards panel and reach the walk in Phase 58 (the old walk renders original rows; no generated→original mapping is built).
- **A-06 (Q4).** Image refs for generated steps are `image_paths text[]` on the new table, each verified at conversion to equal an existing `sop_images.storage_path` for that SOP and counted in the report. `sop_images` rows are not re-pointed or copied.
- **A-07 (Q5).** One small `sop_conversion_runs` table (run id, sop_id, org, source `layout|rows`, `layout_hash`, before/after jsonb, ok) so re-runs no-op on an unchanged hash and the deployed eval reads the before/after counts.
- **A-08 (ledger write mode).** `recordDecision()` is awaited AFTER the primary write, fail-soft (distinct `[recordDecision] FAILED` log tag) plus a `scripts/` reconcile that lists decision-table rows lacking a ledger row. No `decisions` FK carries `ON DELETE CASCADE`/`SET NULL` (row triggers fire on referential actions and would block SOP/user/org deletion); only `supersedes_decision_id → decisions(id)` is an FK.

### Claude's Discretion
- **Converter input.** Read `layout_data` where present (it is what the builder has been editing) and fall back to `sop_sections`/`sop_steps` rows for any section with no layout; the plan records the precedence and the before/after report shows which source each SOP came from.
- **Ledger column shape.** Suggested: `id`, `organisation_id`, `kind` (approve, reject, sign_off, assign, publish, owner_change, review, observation, ai_finding_cleared, …), `actor_kind` (`person | agent`), `actor_id` (nullable for agents), `actor_name` (required when `actor_kind = 'agent'`, DEC-04), `subject_kind` + `subject_id` (what it was about), `summary` (one plain sentence), `details` jsonb, `source` (`live | backfill`), `supersedes_decision_id`, `created_at`. Final shape is the planner's.
- **Standards storage.** One `standards` table + one polymorphic `standard_attachments (standard_id, target_kind, target_id)` vs three junction tables — planner's call; RLS org-scoped either way.
- **Where the "… · logged in the decision ledger" copy appears** on existing screens this phase — optional; the contract wants it on every governance action eventually, but existing screens are retired in 58/59.
- **Re-run mechanics** (run id column vs a `converted_from_layout_hash`) — planner's call, as long as a second run on an unchanged SOP is a no-op and a run after a builder edit replaces only the generated rows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (governs)
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` — the 2026-10-02/03 MVP contract. § "Data model this implies — eight types" (steps kinds hazard · PPE · step · check; standards as a label; decisions as one append-only ledger), § "The focus rule" (hazard/PPE steps acknowledged before continuing — why D-03), § "CSS patterns" (standards are a quiet label; step-kind colours `--accent-hazard` / `--accent-decision` / `--accent-step` / `--accent-measure`), § "Open questions" item 5 (resolved here by D-05).
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — load via `Skill("sketch-findings-SOPstart")` before touching the SOP model (CLAUDE.md auto-load rule).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` § v11.0 — SOP-01..03, DEC-01, DEC-03, DEC-04 (and SOP-04, DEC-02 for what is explicitly NOT this phase).
- `.planning/ROADMAP.md` § "Phase 56" — goal, five success criteria, and the standing v11.0 constraints (plain words, deployed eval, journeys + capability matrix in the same commit, no table dropped, RLS on every new table, publish gate untouched).

### Prior phase artefacts
- `.planning/phases/55-cut-the-dropped-features-one-organisation/55-REVIEW.md` and `55-VERIFICATION.md` — the post-55 code state; CR-02 made `recordSignature` session-only (a writer this phase hooks).
- `.planning/codebase/CAPABILITY-MATRIX.md` — must gain rows for the ledger (insert-only by role) and standards management.

### Project rules that bite here
- `CLAUDE.md` § Learnings — [2026-07-07] builder renders exclusively from `layout_data`; [2026-09-27] section classifier lives in `src/lib/sop/sections.ts` only; [2026-08-04] `WITH CHECK` must restate every `USING` predicate; [2026-07-05] SECURITY DEFINER / parameter-trusting functions must be locked to service role; [2026-07-29] enumerate writers by DATA not by feature list; [2026-06-15] PGRST205 schema-cache staleness after DDL; [2026-07-28] a migration-applier must apply every later corrective migration.
- `tests/lint/rls-org-scope.spec.ts` — parses every migration; new tables must pass it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/sop/sections.ts` — `isHazardSection` / `isPpeSection` / `isEmergencySection` / `isScopeSection`: the one classifier; the converter uses it for default kinds (D-04).
- `src/lib/builder/block-registry.tsx` (`BLOCK_COMPONENTS`) + `src/lib/builder/puck-to-block-content.ts` — the 17 block types and their content converters; the kind-mapping table (D-02) is keyed on these type names.
- `src/lib/parsers/parsed-sop-to-layout-data.ts` — the parser already materialises sections + steps + layout together; the converter is its inverse and should share its content accessors.
- `src/lib/auth/session-context.ts` (`getSessionContext`) / `src/lib/auth/guards.ts` (`requireAdminContext`) — every new server action resolves org and actor through these.
- `scripts/eval-fixtures.mjs`, `tests/evals/lib/session.ts`, `tests/evals/lib/completion-cleanup.ts` — deployed-eval scaffolding; the walk fixture SOP ("Eval walk fixture SOP") exists in the eval-site org.
- Management-API SQL idiom (CLAUDE.md [2026-09-30]) for proving RLS/trigger behaviour directly against the live DB.

### Established Patterns
- Migrations numbered sequentially in `supabase/migrations/` (latest is 00068); each new table carries `organisation_id` with org-scoped `USING` and a matching `WITH CHECK`.
- Server actions in `src/actions/*` (`'use server'`, async exports only); service-role writes self-enforce `organisation_id` from the session.
- Source-contract specs per phase under `tests/phase<N>/` registered in `playwright.config.ts`; lint guards under `tests/lint/`; a deletion/presence sweep driven by a JSON list (`scripts/dropped-features.json` from Phase 55 is the model).
- Deployed eval per UI-touching phase in `tests/evals/<area>.eval.ts`, run with `npm run eval -- --phase 56`, screenshots read before pass.
- Design tokens only; "section"/"step" in UI copy, never "block".

### Integration Points
- **Ledger writers** (D-08): `src/actions/approvals.ts` (`approveStep`), `src/actions/completions.ts` (`signOffCompletion`, `recordSignature`), `src/actions/assignments.ts`, `src/actions/governance.ts` (`setSopOwner`, `setReviewCadence`), `src/actions/observations.ts` (`recordObservation`, `requestAssessorReview`), `src/actions/sop-section-blocks.ts` (`verifyBlock`, `unverifyBlock`), `src/app/api/sops/[sopId]/publish/route.ts` + `src/lib/governance/publish-core.ts` (publish — the gate body `assertPublishGates` must stay byte-identical; `tests/builder/builder-review-flow.spec.ts` and `tests/phase26/spine-regression.spec.ts` pin it), the AI reviewer flag-clear path.
- **Backfill sources** (D-06): `sop_approvals`, `sop_completion_signatures`, `sop_observations`, `sop_review_events`, `sop_block_update_decisions`.
- **Placement**: `sop_machines` (00067) is the machine link; `sops.all_departments` + `sop_departments` + `access_grants` are the untouched access channel (D-10). `listAdminSopRows` / `useWorkerSops` / the machine panel (`MachinePanel.tsx`, `admin-health.ts`) are where derived department and placement surface for display.
- **Standards panel entry**: the admin SOP page / builder shell (`BuilderStageShell.tsx` / `AdminPageShell.tsx`) is where the standalone manager opens from; `journeys.ts` gains the route/flow in the same commit.
- **Old surfaces stay**: `src/app/(protected)/sops/[sopId]/page.tsx` (Read/Walk tabs) and `admin/sops/builder/[sopId]` keep reading `layout_data`; nothing in this phase changes what they render.

</code_context>

<specifics>
## Specific Ideas

- "A hazard/PPE card that yields nothing is a conversion failure, not a warning" — the before/after report must be a hard gate on hazard ≥ and PPE ≥ source counts, per SOP.
- "A correction is a new decision that refers to the old one" — no edit path, ever; `supersedes_decision_id`.
- The eval must try to mutate a decision as service role and show the database refusing.
- Standards seed: LOTO, Hot Work, Confined Space, Working at Height, Manual Handling, Electrical Isolation (NZ/AU industrial vocabulary).
- "A worker should know a step is under LOTO" — the label reaches the walk rail, quietly.

</specifics>

<deferred>
## Deferred Ideas

- The Office ledger view, newest-first with kind filter — **Phase 59 (DEC-02)**.
- Mounting the standards manager in the Workshop — **Phase 61**.
- The focus walk/editor reading the new `kind` rows and retiring `layout_data` as the render source — **Phase 58**; this phase only guarantees the rows exist and are correct.
- Requests / assignments-as-requests (the assignment writer becomes a request in Phase 60) — the ledger hook on today's assignment path is still made here so Phase 60 inherits it.
- "… · logged in the decision ledger" copy on every governance action — lands with the rooms (59/60/61).
- Syncing `sop_departments` from machine placement (the "one source of truth" option declined in D-10) — revisit only if the access-wiring screen is retired after Phase 59.

</deferred>

---

*Phase: 56-a-simpler-sop-the-decision-ledger*
*Context gathered: 2026-10-04*
