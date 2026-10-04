# Phase 58: The SOP Focus Screen — Walk & Edit - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Opening a SOP gives it the **whole screen**. The three panes of Phase 57 are removed (not shrunk, not dimmed); what remains is a slim top bar (Back + the SOP's title), the SOP's sections and steps down the left (300 px), and one centred column (max 820 px). **Walk**: the current step alone — hazard and PPE steps acknowledged before going on, a photo where a step asks for one, the last step leading to a review-and-confirm screen that records the completion and sends it for sign-off. **Edit**: the same frame with steps grouped under their sections, SOP-level details (version, machine, objective, standards) quietly in the left rail, the AI check's findings at the top, a tick on every step, and Publish only after every step is ticked and every finding cleared — no tick-all control. Nothing else from the site is on screen; Back or Esc returns to `/?place=…` with the originating place still selected. A SOP still being parsed from a document or a video opens in the editor saying what is happening and roughly how long it will take, never an empty page, and getting there never reloads the whole app.

**The model this re-homes onto:** the Phase 56 `sop_focus_steps` rows (kinds hazard · ppe · step · check; tip; photo_required; image_paths; standards attachments) become the ONE unit both surfaces read and write. The Phase 26 inline block editor's **frame** (document feel, click-text-to-edit, tick per unit, AI banner, publish bar) is re-homed; its **block machinery** (`layout_data`, 18 block types, field editors, inserter, `sop_section_blocks` junctions, per-block AI flags) is retired after one final converter run at cutover. The publish gate (`assertPublishGates`) and `recordDecision()` writes carry over untouched in semantics — their key changes from block to step.

**Deleted in this phase (with redirects + dropped-list entries):** the tabbed SOP page (`/sops/[sopId]` Read/Walk tabs, `ReadTab`, `SopTabNav`), the old walkthroughs (`MobileWalkthrough`, `DesktopWalkthrough`, `ImmersiveStepCard`, `WalkthroughSwitcher`, `ViewModeToggle`), the admin builder routes and builder-only chrome (`/admin/sops/builder/[sopId]`, `BuilderStageShell`, stage stepper, `ReviewStation`, `OrientationStrip`, `NavRow`, `SectionListSidebar`, `BuilderTreeRail`, `PublishStage`), the versions page (`/admin/sops/[sopId]/versions` — re-homed as a rail entry, D-14), and every link to them. `/admin/sops/[sopId]/assign` survives until Phase 60 turns assignments into requests.

Requirements: FOC-01, FOC-02, FOC-03, FOC-04, WRK-03, WRK-04, SOP-04. Desktop-first (57 D-21: always render the frame; collapse via CSS below 1024px — the focus screen is one column anyway).

</domain>

<decisions>
## Implementation Decisions

### What the editor edits (FOC-02, WRK-04)
- **D-01 — Steps are the one model.** The editor reads and writes `sop_focus_steps` directly (text, kind, tip, photo-required, images, standards). `layout_data`, the 18 block types, the field editors, the inserter, `sop_section_blocks` and `block_provenance` are retired after **one final converter run at cutover** (`scripts/convert-sops-to-steps.ts`, re-runnable by `(section_id, source_key)` per 56 D-01) so any builder edit made since Phase 56 is captured. After cutover the converter is no longer a writer; `source_key`/`run_id` stay as provenance only. The worker walks exactly what the admin edits — no mapping layer survives.
- **D-02 — The AI check is re-pointed at steps.** The reviewer jobs read the SOP's focus steps and flag a **step**; clearing a finding is the existing verify path re-keyed to a step and still writes the ledger (56 A-04: resolve SOP/org server-side, never from a client parameter). Old per-block flag rows are dropped at cutover. The gate is unchanged in meaning: Publish is unavailable until every step is ticked and every open finding is cleared.
- **D-03 — Keep Konva annotation, re-homed onto step images.** *(Simon's call over the lighter "attach / remove only".)* An admin can add a photo to a step, remove one, and annotate it with the existing annotation tool (`src/components/admin/builder-v2/visual/`). The tool stays admin-only behind the lazy admin seam so it never enters the worker bundle.
- **D-04 — Full structure editing.** Add / rename / reorder / delete sections; add / reorder / delete steps; change a step's kind (hazard · PPE · step · check), tip, photo-required; standards at SOP / section / step (the Phase 56 `standard_attachments` model, same Tools-menu affordance re-homed into the rail). A blank SOP can be written from nothing in this editor — the four on-ramps (upload · AI · video · blank) all land here.

### Reading without walking (contract open question 4)
- **D-05 — Browse state inside the walk; no third mode.** "Show me" on the Now card, and any SOP row click that isn't explicitly Walk or Edit, opens the walk with **every step scrollable in the centred column and the rail clickable**; no completion exists until the worker presses **Start walking**. The old Read tab is deleted, not re-homed.
- **D-06 — Admins land per the row's action.** The 57 machine panel's Walk → browse state (as a worker sees it); Edit → the editor. The top bar carries a small **Walk ⇄ Edit switch for admins only**, so an admin can preview the worker view without going Back. Workers never see the switch.

### Walk mechanics (FOC-04)
- **D-07 — A walk covers the whole SOP, in order.** Hazard and PPE steps first (wherever they sit in the source), then every section's steps in sequence; **one completion per SOP**. Multi-procedure SOPs are split into separate SOPs by an admin if that bothers them (D-04 makes that possible); the Phase 57 `scopeSopToJob` section-as-job behaviour is retired with the old walkthrough.
- **D-08 — Rail: back-only by default, with a per-SOP admin toggle to allow forward jumps.** *(Simon, 2026-10-05: "Make the default = Back only; forward is locked, but add a toggle in the admin that allows this option to be relaxed so that forward jumps are allowed.")* Default: any done step can be revisited (and its photo retaken); steps ahead are listed but not clickable until reached; hazard/PPE acks cannot be skipped. The toggle lives in the editor's **"This SOP"** rail block (per-SOP, Claude's placement — Simon said "in the admin"; an org-wide default is deferred). When relaxed, any step is clickable but every hazard/PPE ack and every required photo must still be present before "Send for sign-off" is enabled.
- **D-09 — Server-side resume.** Each hazard/PPE ack, each step done and each photo writes to the **in-progress completion as it happens** (photos already upload per step via `useStepPhotos` → signed URL tagged to the completion id; this adds a step-progress write). Reopening a SOP with an in-progress completion offers **"Resume where you left off (step n of N)"** or start over. The in-memory `completionStore` becomes a cache of server state, never the only copy (CLAUDE.md [2026-10-03] — in-memory state keyed to its owner).
- **D-10 — Review-and-confirm before sending.** *(Simon's call over a bare done screen.)* After the last step: one centred review listing every step done (with acks) and every photo taken; **"Send for sign-off"** is the final press and the only thing that writes `submitCompletion` + the ledger row; then a one-line confirmation and **Back** to the originating `/?place=…`. Until Send, the completion is still `in_progress` and resumable (D-09).

### Versions & publish (SOP-04)
- **D-11 — Editing a published SOP edits a draft of the next version.** The first edit forks a draft version; workers keep walking the published one untouched; **Publish** replaces it as the latest and the old version stays on record. The rail says "Editing v4 — v3 is live". A SOP that has never been published edits in place (it is already a draft). The planner decides whether a version is a new `sops` row (today's `uploadNewVersion` / `cloneSopAsDraft` lineage via `src/lib/builder/version-lineage.ts`) or a version column on steps — but every version's steps must be readable on their own (D-14) and the publish decision is one ledger row.
- **D-12 — An in-flight walk finishes on its version, then a banner.** A worker mid-walk on v3 when v4 publishes keeps walking v3; the completion records v3. Next time they open the SOP they get v4 and a one-line **"Updated since you last walked it"** badge (the existing `RelBadge` "updated" state). No interruption mid-step.
- **D-13 — Workers always get the latest published version**; browse state and Walk resolve the SOP id to its latest published version server-side, never a draft (a worker cannot open a draft at all — the machine panel already lists published SOPs only for workers; admins see DRAFT-badged rows per 57 D-20).
- **D-14 — Earlier versions are a read-only rail entry.** "This SOP · v4 · 3 earlier versions" in the editor's left rail; clicking lists them and opens one in **browse state, read-only, clearly badged "v2 — superseded"**. No restore-as-new this phase; `/admin/sops/[sopId]/versions` is deleted and redirected to the SOP's edit address.

### Claude's Discretion
- **Addresses.** `/sops/[sopId]` for walk/browse and an edit address (`/sops/[sopId]/edit` or `?mode=edit`) — planner's call, but legacy `/sops/[sopId]?tab=walk|read` and `/admin/sops/builder/[sopId]` must 307 in the proxy to the new addresses (never a client effect — CLAUDE.md [2026-09-29]). The originating place for Back travels as `?from=<place-token>` (57 D-11 tokens) with `history.back()` only when the referrer is the one screen; Esc = Back.
- **Parse-in-progress display (WRK-03).** The editor mounts over the `parse_jobs` row: a stage line ("Reading the document · page 3 of 12", "Transcribing the video") plus a rough ETA; source of the ETA (page count / video length heuristics vs. a flat "about a minute") is the planner's; progress via the existing React Query poll, the finished steps swap in place without a route change. Nothing is editable until the job completes; a failed job shows the error and a Retry that re-queues it.
- **What a `check` step asks.** A tick ("Confirmed") by default; a typed value only if the step text carries a unit/range — planner decides from the converter's `check` output (56 D-02 folds measurements into text).
- **Progress bar + rail copy**, hazard/PPE button wording ("I understand — continue", "I'm wearing it — continue" per the contract), step-kind colours (`--accent-hazard`, `--accent-decision`, `--accent-step`, `--accent-measure`).
- **Autosave** in the editor (the existing `useBuilderAutosave` idiom re-keyed to steps) vs explicit Save — autosave with a quiet "Saved" pill is the obvious reuse.
- **Where AI ghost suggestions go** (`builder-v2/ghosts`) — keep only if they fit a step row in one line; otherwise retire with the block editor.
- **Deletion mechanics**: dropped-list entries, deletion-sweep + retirement-sweep guards (assert absence of REFERENCES), repoint inventory, journeys.ts, CAPABILITY-MATRIX — follow the Phase 57 idiom exactly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (governs)
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` — § "The focus rule (Simon, 2026-10-03) — non-negotiable" (the exact screen: top bar · 300 px rail · 820 px centred column; walking: kind chip, 28 px step text, one 60 px primary button, photo button, thin progress bar, hazard/PPE wording; editing: steps under sections, click text, tick per step, AI banner, bottom bar "Checked n of N" + Publish); § "CSS patterns" (`.app.focus`, `.workgrid`, `.wc`, step-kind colours); § "What to avoid" (nothing beside an open SOP); § "Open questions" 4 (resolved by D-05).
- `.claude/skills/sketch-findings-SOPstart/references/authoring-flow.md` — the not-yet-shipped authoring contract (new-SOP wizard → upload-parse review → inline editor; AI ghosts; read/walk/edit surface). Use for the editor's feel; where it conflicts with one-screen-site.md, the focus rule wins.
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — load via `Skill("sketch-findings-SOPstart")` before any UI work (CLAUDE.md auto-load rule).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — FOC-01..04 (~lines 1000–1003), SOP-04 (~1010), WRK-03, WRK-04 (~1016–1017).
- `.planning/ROADMAP.md` § "Phase 58" (goal, five success criteria, UI hint: yes); § "Phase 57" bundle-gate decisions block (the `/page` 831 KB worker gate this phase must keep within ±2 KB — the walk is worker code, the editor is admin code behind the lazy seam).

### Prior phase artefacts
- `.planning/phases/56-a-simpler-sop-the-decision-ledger/56-CONTEXT.md` — D-01..D-04 (focus steps, kind mapping, warnings → hazard steps before the action), A-01 (own table, zero old-reader changes — the readers this phase deletes), A-04 (`verifyBlock` as the AI-finding clear path, ledger hooks), A-05 (step-level standards reach the walk in 58), A-06 (`image_paths` verified against `sop_images`), D-09 placement, D-11/D-12 standards.
- `.planning/phases/56-a-simpler-sop-the-decision-ledger/56-10-SUMMARY.md` and `56-09-SUMMARY.md` — what shipped (converter, `sop_conversion_runs`, `StandardLabels`, `placement.ts`).
- `.planning/phases/57-the-one-screen-its-places/57-CONTEXT.md` — D-11 (`/?place=` tokens Back returns to), D-15 (`BackToSite` bar — the focus top bar replaces it on SOP routes), D-19 (`/admin/sops/new/blank?machine=`), D-20 (admins see DRAFT-badged rows), D-21 (phone: CSS only).
- `.planning/phases/57-the-one-screen-its-places/57-04-SUMMARY.md`, `57-08-SUMMARY.md` — the `OneScreen` / `WorkerShell` / lazy `AdminShell` seam, the bundle-gate fix and the retirement idiom (proxy redirect → repoint links → move guards → delete + dropped list + journeys in one commit).
- `supabase/migrations/00069_sop_kinds_placement_standards.sql` — `sop_focus_steps`, `standards`, `standard_attachments`, `sops.placement` schema.
- `scripts/convert-sops-to-steps.ts`, `src/lib/sop/convert.ts` — the converter (final run at cutover, D-01).
- `.planning/codebase/CAPABILITY-MATRIX.md` — must be updated for: walk/edit per role, admin Walk ⇄ Edit switch, forward-jump toggle (admin write), version browse (admin read).

### Project rules that bite here
- `CLAUDE.md` § Learnings — [2026-10-03] in-memory walk state must be keyed to its completion id and reset when it changes (D-09 makes the server authoritative); [2026-09-29] never navigate from a mount effect while mount-time server actions fire; [2026-05-13] hot-path step changes via `useState` + `history.replaceState`, never `router.push('?step=')`; [2026-09-27] section/kind classification lives in ONE module; `step_number` is section-scoped, never a global id; [2026-07-13] source-contract guards go stale-red when code moves — the publish-gate guards (`tests/builder/builder-review-flow.spec.ts`, `tests/phase26/spine-regression.spec.ts`) must be repointed in the commit that re-keys the gate; [2026-07-07] builder-canvas-renders-only-layout_data is RETIRED by D-01 — the trio rule (sections + steps + layout_data) collapses to sections + focus steps; [2026-09-13] admin editor + annotation behind the lazy seam, `/page` gate ±2 KB; [2026-08-04] deletion guards assert absence of REFERENCES.
- `## Pathways Map Maintenance`, `## Capability Matrix`, `## Deployed-site evals` — same-commit rules; `tests/evals/one-screen.eval.ts` (57) and `cut-features.eval.ts` (55) walk the eval-site fixture SOP through the OLD walkthrough today and must be re-pointed at the focus screen in this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(protected)/sops/[sopId]/page.tsx` + `src/components/sop/walkthrough/*` + `src/components/sop/SafetyAcknowledgement.tsx`, `StepProgress.tsx` — the walk today (hazard gate, step cards, photo capture via `src/hooks/useStepPhotos.ts`, `src/stores/completionStore.ts`); the focus walk re-homes the acknowledgement, photo and submit logic over focus steps and deletes the rest.
- `src/actions/completions.ts` (`submitCompletion`, `getPhotoUploadUrl`, `signOffCompletion`) — retry-safe photo-path validation to keep; D-09 adds an in-progress write path.
- `src/components/admin/builder-v2/EditableDocument.tsx`, `InlineText.tsx`, `BlockEditShell.tsx`, `visual/` (Konva annotation), `ghosts/` — the inline editor's frame and the annotation tool (D-03) to re-home; `fields/`, `inserter/`, `selection-bridge.ts` go with the block model.
- `src/app/(protected)/admin/sops/builder/[sopId]/ReviewStation.tsx`, `PublishStage.tsx`, `src/lib/governance/publish-core.ts` (`assertPublishGates`), `src/actions/sop-section-blocks.ts` (`verifyBlock`), `src/hooks/useBuilderAutosave.ts` — the tick / AI-flag / publish spine to re-key from block to step.
- `src/app/api/sops/[sopId]/ai-reviewer/`, `src/lib/verify/*` — the reviewer jobs to re-point at focus steps (D-02).
- `src/actions/versioning.ts` (`uploadNewVersion`, `cloneSopAsDraft`, `getVersionHistory`), `src/lib/builder/version-lineage.ts` — version lineage for D-11/D-14.
- `src/components/admin/ParseJobStatus.tsx`, `src/app/api/sops/[sopId]/parse-job/` — parse progress for WRK-03.
- `src/components/sop/StandardLabels.tsx`, `src/actions/standards.ts` — standards labels in the rail and on steps (56 A-05).
- `src/components/layout/BackToSite.tsx`, `src/lib/shell/place.ts` — the Back destination and tokens (57 D-11/D-15).
- `src/components/shell/OneScreen.tsx` / `AdminShell.tsx` — the lazy admin seam the editor must sit behind.

### Established Patterns
- Role-gated UI as one `next/dynamic({ ssr:false })` module; worker bundle gate on `/page` (831 KB ±2) and `/sops/[sopId]/page` (795 ±2) — the gate's route list changes if the SOP address changes (a baseline move is a recorded decision, see 57's ROADMAP block).
- React Query hooks over server actions; `getSessionContext()` / `requireAdminContext()` for every server entry; `recordDecision()` after every governance write.
- Design tokens only; radius vocabulary of four; `min-h-tap` / `tap-glove` targets (the 60 px primary button is `tap-glove`).
- Source-contract specs per phase in `tests/phase58/` registered in `playwright.config.ts`; deployed eval `tests/evals/sop-focus.eval.ts` (new) proving all five success criteria with the eval-site fixture SOP; repoint inventory + retirement sweep in the Phase 57 shape.
- Legacy-URL redirects in `src/lib/supabase/middleware.ts` / `next.config.ts`.

### Integration Points
- The 57 machine panel / Noticeboard rows (Walk · Edit · new SOP) and the Now card (Walk it · Show me) are the entry points; their hrefs repoint to the new addresses with `?from=`.
- `(protected)/layout.tsx` renders `BackToSite` for every route — the SOP focus routes must opt out and render their own top bar.
- `/admin/sops/new/*` wizards (upload · AI · video · blank) currently land on the builder; they land on the focus editor (parse-in-progress view for upload/AI/video).
- `scripts/dropped-features.json`, `tests/phase55/deletion-sweep.spec.ts`, `tests/phase57/retirement-sweep.spec.ts`, `tests/phase57/repoint-inventory.spec.ts` — extend for this phase's deletions.
- `src/lib/journeys/journeys.ts`, `src/lib/uat/tests.ts`, `.planning/codebase/CAPABILITY-MATRIX.md` — same-commit updates.
- Eval fixtures: the eval-site walk fixture SOP must be converted to focus steps (it is — Phase 56 converted every SOP) and the `cut-features.eval.ts` "walk with a photo" test re-pointed.

</code_context>

<specifics>
## Specific Ideas

- "Make the default = Back only; forward is locked, but add a toggle in the admin that allows this option to be relaxed so that forward jumps are allowed." — Simon, 2026-10-05 (D-08).
- Simon chose **keep Konva annotation** over the lighter attach/remove — image annotation on steps matters to him (D-03).
- Simon chose **confirm before sending** over a bare done screen — the worker reviews what they did before the record is written (D-10).
- Contract wording for the walk buttons: "I understand — continue" (hazard), "I'm wearing it — continue" (PPE); bottom bar in edit: "Checked n of N" + Publish.
- The focus screen must never show an inbox count, a notification or the map — a focus bar with a badge is a defect.

</specifics>

<deferred>
## Deferred Ideas

- **Org-wide default for the forward-jump toggle** (D-08 is per-SOP) — add in Phase 61 (Workshop · settings) if admins ask for it.
- **Restore an earlier version as a new draft** (D-14 is read-only) — Phase 61 Workshop · Drafts.
- **Section-as-job walks / skippable sections** (D-07 chose whole-SOP) — revisit only if a real site refuses to split multi-procedure SOPs.
- **Assignments → requests** (`/admin/sops/[sopId]/assign` survives) — Phase 60.
- **Worker notes / "flag a problem" mid-walk** — a request (Phase 60: "Ask for a change" from the Workshop); not in this walk.
- **Phone layout for the focus screen** — contract open question 1; the one-column focus screen collapses by CSS (57 D-21) and nothing more is designed.
- **Standards manager mount** (list CRUD) — Phase 61 Workshop; this phase only attaches/detaches existing standards from the rail.

</deferred>

---

*Phase: 58-the-sop-focus-screen-walk-edit*
*Context gathered: 2026-10-05*
