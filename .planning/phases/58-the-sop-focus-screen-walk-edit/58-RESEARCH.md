# Phase 58: The SOP Focus Screen — Walk & Edit - Research

**Researched:** 2026-10-05
**Domain:** Next.js 16 App Router (React 19) + Supabase (RLS, service-role actions) re-homing of an existing walkthrough and block editor onto the Phase 56 `sop_focus_steps` model; deletion of the tabbed SOP page, old walkthroughs and admin builder
**Confidence:** HIGH on code-state findings (all read from the repo this session); MEDIUM on recommended designs (they are proposals, tagged where they need a decision)

> Tags: `[VERIFIED: codebase]` = read or grepped in this session. `[CITED: path]` = taken from a named planning doc. `[ASSUMED]` = my inference, needs confirmation. No external web research was needed: this is an internal re-homing phase and adds no packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**What the editor edits (FOC-02, WRK-04)**
- **D-01 — Steps are the one model.** The editor reads and writes `sop_focus_steps` directly (text, kind, tip, photo-required, images, standards). `layout_data`, the 18 block types, the field editors, the inserter, `sop_section_blocks` and `block_provenance` are retired after **one final converter run at cutover** (`scripts/convert-sops-to-steps.ts`, re-runnable by `(section_id, source_key)` per 56 D-01) so any builder edit made since Phase 56 is captured. After cutover the converter is no longer a writer; `source_key`/`run_id` stay as provenance only. The worker walks exactly what the admin edits — no mapping layer survives.
- **D-02 — The AI check is re-pointed at steps.** The reviewer jobs read the SOP's focus steps and flag a **step**; clearing a finding is the existing verify path re-keyed to a step and still writes the ledger (56 A-04: resolve SOP/org server-side, never from a client parameter). Old per-block flag rows are dropped at cutover. The gate is unchanged in meaning: Publish is unavailable until every step is ticked and every open finding is cleared.
- **D-03 — Keep Konva annotation, re-homed onto step images.** *(Simon's call over the lighter "attach / remove only".)* An admin can add a photo to a step, remove one, and annotate it with the existing annotation tool (`src/components/admin/builder-v2/visual/`). The tool stays admin-only behind the lazy admin seam so it never enters the worker bundle.
- **D-04 — Full structure editing.** Add / rename / reorder / delete sections; add / reorder / delete steps; change a step's kind (hazard · PPE · step · check), tip, photo-required; standards at SOP / section / step (the Phase 56 `standard_attachments` model, same Tools-menu affordance re-homed into the rail). A blank SOP can be written from nothing in this editor — the four on-ramps (upload · AI · video · blank) all land here.

**Reading without walking (contract open question 4)**
- **D-05 — Browse state inside the walk; no third mode.** "Show me" on the Now card, and any SOP row click that isn't explicitly Walk or Edit, opens the walk with **every step scrollable in the centred column and the rail clickable**; no completion exists until the worker presses **Start walking**. The old Read tab is deleted, not re-homed.
- **D-06 — Admins land per the row's action.** The 57 machine panel's Walk → browse state (as a worker sees it); Edit → the editor. The top bar carries a small **Walk ⇄ Edit switch for admins only**, so an admin can preview the worker view without going Back. Workers never see the switch.

**Walk mechanics (FOC-04)**
- **D-07 — A walk covers the whole SOP, in order.** Hazard and PPE steps first (wherever they sit in the source), then every section's steps in sequence; **one completion per SOP**. Multi-procedure SOPs are split into separate SOPs by an admin if that bothers them (D-04 makes that possible); the Phase 57 `scopeSopToJob` section-as-job behaviour is retired with the old walkthrough.
- **D-08 — Rail: back-only by default, with a per-SOP admin toggle to allow forward jumps.** *(Simon, 2026-10-05: "Make the default = Back only; forward is locked, but add a toggle in the admin that allows this option to be relaxed so that forward jumps are allowed.")* Default: any done step can be revisited (and its photo retaken); steps ahead are listed but not clickable until reached; hazard/PPE acks cannot be skipped. The toggle lives in the editor's **"This SOP"** rail block (per-SOP, Claude's placement — Simon said "in the admin"; an org-wide default is deferred). When relaxed, any step is clickable but every hazard/PPE ack and every required photo must still be present before "Send for sign-off" is enabled.
- **D-09 — Server-side resume.** Each hazard/PPE ack, each step done and each photo writes to the **in-progress completion as it happens** (photos already upload per step via `useStepPhotos` → signed URL tagged to the completion id; this adds a step-progress write). Reopening a SOP with an in-progress completion offers **"Resume where you left off (step n of N)"** or start over. The in-memory `completionStore` becomes a cache of server state, never the only copy (CLAUDE.md [2026-10-03] — in-memory state keyed to its owner).
- **D-10 — Review-and-confirm before sending.** *(Simon's call over a bare done screen.)* After the last step: one centred review listing every step done (with acks) and every photo taken; **"Send for sign-off"** is the final press and the only thing that writes `submitCompletion` + the ledger row; then a one-line confirmation and **Back** to the originating `/?place=…`. Until Send, the completion is still `in_progress` and resumable (D-09).

**Versions & publish (SOP-04)**
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

### Deferred Ideas (OUT OF SCOPE)
- **Org-wide default for the forward-jump toggle** (D-08 is per-SOP) — add in Phase 61 (Workshop · settings) if admins ask for it.
- **Restore an earlier version as a new draft** (D-14 is read-only) — Phase 61 Workshop · Drafts.
- **Section-as-job walks / skippable sections** (D-07 chose whole-SOP) — revisit only if a real site refuses to split multi-procedure SOPs.
- **Assignments → requests** (`/admin/sops/[sopId]/assign` survives) — Phase 60.
- **Worker notes / "flag a problem" mid-walk** — a request (Phase 60: "Ask for a change" from the Workshop); not in this walk.
- **Phone layout for the focus screen** — contract open question 1; the one-column focus screen collapses by CSS (57 D-21) and nothing more is designed.
- **Standards manager mount** (list CRUD) — Phase 61 Workshop; this phase only attaches/detaches existing standards from the rail.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOC-01 | Opening a SOP to walk removes list + site; slim top bar, sections/steps down the left, current step in one centred column | `(protected)/layout.tsx` + `BackToSite`/`placeForPath` opt-out (§Navigation); frame/rail/column per UI-SPEC; page as server component resolver; walk order module (§Architecture) |
| FOC-02 | Opening to edit removes list + site; steps grouped under sections in one column; version/machine/objective/standards in left rail | Editor behind lazy admin seam; "This SOP" rail block needs `sops.objective` (no storage exists — Finding F7), machine via `setSopMachines`, standards via `setStandardAttachment` (already supports `step` target), version list from lineage |
| FOC-03 | Nothing else from the site is on screen; Back/Esc returns to the one screen with the place still selected | `?from=` whitelist through `parsePlace`/`formatPlace`; entry-point repoint inventory (§Repoint); `document.referrer` caveat (F13); eval asserts `/?place=` |
| FOC-04 | One step at a time; hazard/PPE acknowledged; photo where asked; last step records completion and sends for sign-off | New in-progress walk table (F2: `sop_completions` is append-only and has no in-progress status); server-verified acks/photos; `submitCompletion` re-used and hardened; `recordSignature` is orphaned (F9) |
| WRK-03 | SOP still being parsed opens in the editor with what/how long, never empty; no full reload | Parse routes do not write focus steps today and the document route never writes `current_stage` (F6); `UploadDropzone.tsx:573` does a full-page `window.location.href`; ETA heuristic recommended |
| WRK-04 | Editor shows what the AI check found; admin ticks every step and clears every finding before Publish | Reviewer receives only SOURCE text today, never the draft (F4); findings need a keyed store; `assertPublishGates` is hash-pinned and keyed to blocks (F3) |
| SOP-04 | Publish new version; workers always get latest published; earlier versions kept | No `superseded` status; `superseded_by` is set at upload time, not publish, so it cannot be a visibility filter (F5); clone copies none of the Phase 56 associations; worker reads at 3 sites need a lineage-latest resolver |
</phase_requirements>

## Summary

The phase is mostly a re-homing of working code, but reading the repo against CONTEXT.md exposes **thirteen findings** where a locked decision or the UI contract assumes something that is not true of the code today. Seven of them change the plan's shape and need an orchestrator or Simon decision before planning (F1, F2, F3, F4, F5, F7, F10). They are listed first because a planner who has not seen them will write plans that cannot be executed as written.

The model work is the critical path. `sop_focus_steps` today has **no write path at all** (its own migration says only the service-role converter writes it), no tick column, and `NOT NULL source_key/run_id`. The in-progress walk (D-09) cannot live in `sop_completions` (append-only, no UPDATE policy, enum has no `in_progress`). The AI reviewer (D-02) never sees the draft. The publish gate (hash-pinned) checks `sop_section_blocks`. Versioning (D-11/SOP-04) copies none of the machine links, standards or focus steps, and workers have no "latest of lineage" rule — publishing a clone leaves both versions `status='published'`. Each of these is a bounded task, and none needs a new package.

**Primary recommendation:** Plan it as seven ordered waves — (0) Nyquist harness, inventories, pure modules, eval fixtures; (1) one additive migration (00071) applied live; (2) server layer in parallel: step-edit actions, walk actions, publish-gate re-key + supersede, reviewer re-point, parse pipelines writing steps; (3) frame + walk UI in the worker bundle with the proxy redirects and entry-point repoints; (4) editor UI behind the lazy admin seam; (5) cutover: final converter run, reader audit, one deletion commit with guards, dropped list, journeys, matrix; (6) deployed eval. Make annotation (D-03) an isolated optional last wave because its premise is false (F1).

## Findings that need a decision before planning

Numbered F1–F13; the planner should treat each as a mandatory task or an explicit Open Question (see §Open Questions).

| # | Finding | Evidence | Consequence / recommendation |
|---|---------|----------|------------------------------|
| **F1** | **D-03's premise is false: the Konva annotation tool no longer exists.** Phase 55-10 (commit `6eb04d2d`) deleted `AnnotationEditor(+Loader)`, `DiagramAnnotateModal`, `DiagramHotspotBlock`, `annotation-tools.ts`, `bake-on-publish.ts`, `src/actions/annotations.ts`, `baked-path.ts` (~1,700 lines). `builder-v2/visual/` now holds only `media-adapter.ts`, `MediaGrid.tsx`, `VisualBlock.tsx`; `VisualBlock.tsx` says "there is no annotation editor any more, and no Konva import here". `scripts/dropped-features.json` carries live `annotation` entries and `tests/phase55/deletion-sweep.spec.ts` lists `annotation` in `LIVE_FEATURES` (mutation-proven); `one-screen-site.md` lists "flow diagram and image annotation" under *Dropped — do not build*. Konva survives only in `components/admin/site/*` (map editor). The table `sop_image_annotations` (migration 00039) still exists. `[VERIFIED: codebase]` | D-03 means *rebuilding* a deleted subsystem against the product's own cut list. Plan it as **one isolated final wave** (wave 6) that nothing else depends on: rebuild from git history (`52b40a6f` editor, `6eb04d2d^` for the rest), remove the `annotation` block from `dropped-features.json` + `LIVE_FEATURES`, widen the Konva allow-list in `tests/phase26/konva-worker-isolation.spec.ts`, keep it behind the lazy seam. Ask the orchestrator to confirm with Simon that he knew it was deleted; if not confirmed, ship attach/remove only (D-03's own fallback wording) and drop wave 6. Everything else works without it. |
| **F2** | **`sop_completions` cannot hold an in-progress walk.** `completion_status` enum = `pending_sign_off \| signed_off \| rejected`; the table has no UPDATE policy ("append-only COMP-07, D-15"); `completion_photos.completion_id` is a FK to `sop_completions(id)`. `walkthrough_progress` (00021) has a FK `step_id → sop_steps(id)` and one row per (sop,user), so it cannot carry focus-step ids or acks/photos. `[VERIFIED: codebase]` | D-09 needs a **new table** (recommended `sop_walks`: `id uuid pk` = the future completion id, `organisation_id`, `sop_id`, `sop_version`, `worker_id`, `status in_progress/submitted/abandoned`, `acks jsonb`, `done jsonb`, `photos jsonb`, `current_step_id`, timestamps; partial unique index `(worker_id, sop_id) where status='in_progress'`; own-row RLS with the org conjunct restated in `WITH CHECK`). Writes through server actions. On "Send", `submitCompletion` reads the walk row (server truth), validates, inserts `sop_completions` + `completion_photos` with `id = walk.id`, and marks the walk `submitted`. |
| **F3** | **The publish gate is hash-pinned and keyed to blocks.** `assertPublishGates` checks `sop_sections.approved=false` and `sop_section_blocks.verified_by_admin_id is null`, and **bypasses** the block check for `source_type='ai_prompt'` or no `source_file_path`. `tests/phase56/publish-gate-pin.spec.ts` pins its sha256 and says repoint "only with a signed-off decision". `getPublishGateStatus` (client chip) mirrors it. `[VERIFIED: codebase]` | D-01/D-02 move the key from block to step, so the body **must** change. CONTEXT is the sign-off for a re-key; record it explicitly in the plan and in the spec header, then re-pin once. **Recommend** the new gate: ≥1 focus step; no focus step with `verified_by_admin_id is null`; no open (uncleared) AI finding; drop the section-`approved` check (the new editor has no section-approval UI) and **drop the ai_prompt/no-source bypass** (WRK-04 and roadmap criterion 3 are unconditional; a blank SOP must also be ticked). Keep `performPublish`'s "gate before first write" order (also pinned). Mirror in `getPublishGateStatus` so the bottom bar and the server agree. Repoint `tests/builder/builder-review-flow.spec.ts`, `tests/phase26/spine-regression.spec.ts`, `tests/phase29/publish-core-extraction.spec.ts`, `tests/phase29/publish-chain-gate.spec.ts`, `tests/phase40/spine-freeze.spec.ts`, `tests/integration/scp-verify-checklist.test.ts`, `src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts`, `tests/phase56/decision-writers-sweep.spec.ts` in the same commit (CLAUDE.md 2026-07-13). |
| **F4** | **The AI reviewer never sees the draft.** `runReviewerJobs` builds one user message from `buildSourceContentBlock` (parse job `transcript_text`/`prompt_text`) and sends only that to all five jobs. Flags carry a `block_id` only if the model invents one, so `findingsFor(blockId)` rarely matches. Findings live in `parse_jobs.ai_review_results` (jsonb envelope), `GET`/`POST /api/sops/[sopId]/ai-reviewer` need a parse job (`no_parse_job` 404 otherwise), so **a blank SOP cannot be reviewed**. Today ticking a block *is* the clear ("verification IS the acknowledgement", `useVerifyChecklist`). `[VERIFIED: codebase]` | D-02 ("flag a step", separate "Clear" per finding in UI-SPEC) is a real change, not a re-key: (a) send the draft as a second, non-cached user block `[{step_id, section, kind, text}]` and require `step_id` in each job's JSON (edit the five job prompts + `parseResponse`s: `block_id` → `step_id`); (b) persist findings as rows — recommended table `sop_ai_findings(id, organisation_id, sop_id, run_id, job, kind, severity, step_id nullable, description, extras jsonb, cleared_by, cleared_at)` so the gate can count `cleared_at is null` (jsonb per-flag state cannot be indexed or constrained); (c) `clearFinding(findingId)` action: `requireAdminContext`, resolve SOP/org server-side, `recordDecision({kind:'ai_finding_cleared', subject:{kind:'ai_finding', id}})`; (d) SOP-level findings (no step) still get a Clear button and still gate; (e) no parse job (blank SOP): run jobs D and E only against the draft (clarity/terminology; A/B/C need a source) — planner confirm; (f) keep per-day cap and org spend cap unchanged. Ticking a step must **not** auto-clear its findings (UI-SPEC requires both). Note `triggerReviewerOnParseCompletion` already auto-runs the check when parsing finishes, so the banner is populated on first open. |
| **F5** | **SOP-04 is not implemented by publish today.** `sop_status` = `uploading\|parsing\|draft\|published` (no superseded). `performPublish` flips only the target row; `cloneSopAsDraft` explicitly never sets `superseded_by`; `uploadNewVersion` sets `superseded_by` on the OLD row **at upload time** (line ~128/168) while the old row stays `published`. Worker reads select every `status='published'` row: `useWorkerSops` library query, `listSiteForWorker` (`site-worker.ts` ~114), `observations.ts:317`. `src/lib/competency/lineage.ts` documents "currency is never derived from `superseded_by` — it comes from the monotonic `version` across the lineage's PUBLISHED members". `notifyAssignedWorkers` (re-point assignments + notify) is called **only** from the versions page being deleted. `[VERIFIED: codebase]` | Publishing a forked v4 leaves v3 and v4 both visible to workers. Do **not** filter on `superseded_by` (it would hide v3 the moment a replacement document is uploaded, before v4 is published). Add **one plain module** (`src/lib/sop/lineage-current.ts`) — "latest published of a lineage = max `version` among `status='published'` rows sharing `parent_sop_id ?? id`" — and use it in: the SOP page resolver (D-13), `useWorkerSops`, `listSiteForWorker`, and any list that must show one row per SOP. Carry `notifyAssignedWorkers(old, new)` into the publish path when the SOP has a lineage predecessor (it is a duty of the deleted page that would otherwise silently vanish). |
| **F6** | **No parse pipeline writes focus steps, and the document route reports no stage.** The five section-inserting routes (`api/sops/parse`, `ai-prompt`, `restructure`, `transcribe`, and the blank wizard `createSopFromWizard`) write `sop_sections` + `layout_data` + `sop_section_blocks` junctions; none writes `sop_focus_steps` (only the Phase 56 script does). `api/sops/parse` never writes `parse_jobs.current_stage` (only `status`: queued→processing→completed/failed); `ai-prompt`, `transcribe`, `restructure` do. There are no page/progress columns, so "Reading page 3 of 12" is not available. `[VERIFIED: codebase]` | After cutover every on-ramp must land steps the editor can read. **Recommend**: keep the pure `convertSop()` as a library — each pipeline builds in-memory `Section[]` from its `ParsedSop` using the real inserted section ids, calls `convertSop`, and inserts the resulting drafts with `source_key = 'new:'||uuid` (so a later converter run can recognise and skip native steps, see F10). Stop writing `layout_data`/junctions (and delete `parsedSopToPerSectionLayoutData`, 833 lines, plus `section-blocks-core`). ETA: no schema change; derive from `input_type` + `status`/`current_stage` + elapsed since `created_at` with flat rounded-up estimates ("About a minute left" document; "About 2 minutes left" video; "Less than a minute left" AI). Drop "page n of m" unless Simon wants new columns (state as deferred). |
| **F7** | **"Objective" has no storage.** No `objective` column or table exists; objectives are OBJ-01..03 in Phase 60. FOC-02 and UI-SPEC require an editable Objective in the rail. `[VERIFIED: codebase]` | Add one nullable `sops.objective text` (check ≤ 500 chars) in 00071, written by an action with `requireSopEditAccess`; Phase 60 migrates it into the objectives type. Flag in the Assumptions Log. |
| **F8** | **"Show me" is a button, not a link.** `NowCard`'s `plant-now-show` calls `onShowMe(machineId)` — it selects the machine on the map (Phase 57, eval-pinned). D-05 says "Show me … opens the walk (browse)". CONTEXT's "hrefs repoint" list treats it as an href. `[VERIFIED: codebase]` | **Recommend** keep Show me = locate on map (Phase 57's shipped, evaluated contract) and satisfy D-05 through the SOP title link in every row (already a link to `/sops/[id]`). Needs one-line orchestrator confirmation. |
| **F9** | **`recordSignature` is orphaned and `submitCompletion` writes no ledger row.** `recordSignature` has no caller in `src/` (the shared-device flow that used it was deleted in 55-06). `submitCompletion` inserts the completion and photos only; the only completion decisions are written by `signOffCompletion`. D-10 says Send writes "`submitCompletion` + the ledger row". `[VERIFIED: codebase]` | **Recommend**: after a successful submit, call `recordSignature({completionId, role:'worker'})` (writes `sop_completion_signatures` + a `sign_off` decision "Signed their completion"; org and signer come from the session). Add the call site to `scripts/decision-writers.json` expectations. Assumption A3. |
| **F10** | **Converter re-runs delete and overwrite editor work.** `planFocusStepWrites` updates changed rows by `(section_id, source_key)` and **deletes** rows whose key the converter no longer produces — including every step an admin adds or rewrites in the new editor, and everything native (pipeline-created) steps hold. `[VERIFIED: codebase]` | Sequence the cutover so the final `--apply --all` run happens **before** the deploy that retires the old builder (accept: old-builder edits in that gap are lost — single org, announce a freeze), then ship in the same commit a hard refusal (`scripts/convert-sops-to-steps.ts --apply` exits 1 with "converter retired in Phase 58") pinned by a spec. Add a `--missing` mode used once post-deploy that converts only SOPs with **zero** focus steps (covers SOPs created in the gap by the old pipeline). Native steps (`source_key` prefix `new:`/`edit:`) must never be touched by any converter mode. |
| **F11** | **Builder Tools-menu items have no new home.** `ToolsMenu` offers Assign (`/admin/sops/[id]/assign`, survives to Phase 60), See earlier versions, Delete draft, Pick machines, Change category (cadence/approval-chain keyed), Standards. The rail design covers version, machine, standards, objective, jump-ahead only. The source-document viewer (`components/admin/source-viewer`, `/api/sops/[id]/source-url`, `download-url`) and `uploadNewVersion` also lose their mount. `[VERIFIED: codebase]` | Decide explicitly (Open Questions Q4): recommend rail gets **Assign this SOP** (link), **Delete draft** (existing `DeleteSopButton`, drafts only), **Category** (relocate `BuilderCategoryButton`), and an **Open original document** link (existing `download-url` route, no split pane); `uploadNewVersion` is left in place but unreferenced and registered as Phase 61 residue (not silently orphaned). Relocate `BuilderMachinesButton`/`BuilderStandardsButton`/`BuilderCategoryButton` out of `admin/sops/builder/[sopId]/` before that directory is deleted. |
| **F12** | **Publish may divert to an approval chain; UI-SPEC does not show it.** `POST /api/sops/[id]/publish` returns `{success:true, pendingApproval:true}` when the SOP's category has an `approval_chains` row (and `alreadyPending`). The old `PublishStage` rendered the pending-chain panel via `getApprovalStatus`. `[VERIFIED: codebase]` | The publish dialog/bottom bar needs a "Sent for approval" state (reuse `getApprovalStatus`) and the bar must not offer Publish again while `approval_state='pending'`. Add to the UI work items; copy "Sent to {approver} for approval — it publishes when they approve." |
| **F13** | **`document.referrer` cannot drive "history.back() only when the referrer is the one screen".** Client-side (soft) navigation does not change `document.referrer` — it describes the document load, not the last in-app page. `[ASSUMED: standard browser behaviour; not re-tested here]` | Make Back deterministic: `router.push(formatPlace(parsePlace(from)))` (the `from` token passes through the existing whitelist, never carried raw); accept one extra history entry; assert `/?place=…` in the eval instead of history semantics. Back runs from a user event only (never an effect) and waits up to 3 s for a pending save to flush (UI-SPEC). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Open a SOP: resolve id → latest published, role check, draft refusal for workers (D-13) | Frontend Server (server component page) | API/Backend (lineage module) | A server `redirect()`/`notFound()` is the allowed place for resolution (CLAUDE.md 2026-09-29); RLS lets any org member SELECT draft rows today, so the page is the enforcement point |
| Legacy URL redirects (`?tab=`, builder, versions) | Frontend Server (proxy `src/lib/supabase/middleware.ts`) | `next.config.ts` redirects | Never a client effect; proxy block gated by the UUID regex, fixed destinations, cookies copied (Phase 57-08 idiom) |
| Frame, rail, browse, walk, review UI | Browser / Client | — | Worker bundle; must hold `/sops/[sopId]/page` within ±2 KB |
| Walk state (acks, done, photos, resume) | API/Backend (server actions) + Database (`sop_walks`) | Browser (React Query cache) | D-09: server is authoritative; client is a cache keyed to the walk id |
| Photo upload | Browser → Storage (signed URL) | API (path signing) | Existing `getPhotoUploadUrl`; path shape validated again at submit |
| Step/section editing, ticks, standards, objective, jump-ahead flag | API/Backend (service-role actions, self-enforced org scope) | Database (tick-clearing trigger) | `sop_focus_steps` has no authenticated write policy by design; all writes through actions (CLAUDE.md 2026-06-15) |
| Editor UI + parse-progress UI | Browser, **lazy admin chunk** | — | `next/dynamic({ssr:false})` seam; keeps editor/Konva/pdfjs out of the worker route |
| AI check run + findings + clear | API/Backend (route + actions) | Database (`sop_ai_findings`) | Anthropic call, cost guard, ledger write |
| Publish gate + supersede + ledger | API/Backend (`performPublish`, `assertPublishGates`) | Database | One place that flips `status`; hash-pinned body re-pinned once |
| Version fork + association copy | API/Backend (service-role, session-org scoped) | Database | Must copy every table keyed on `sop_id` (data-keyed census) |
| Back/Esc | Browser | — | User-event handler; target from whitelisted `?from` |

## Standard Stack

No new libraries. Everything below is already installed `[VERIFIED: package.json]`.

### Core
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| next | 16.2.1 | App Router, server component page, proxy | Already the framework; note 16.2.1 server-action-queue defect (CLAUDE.md 2026-09-29) |
| react | 19.2.4 | UI | — |
| @tanstack/react-query | ^5.95.2 | Server-state cache for focus data + walk (replaces `completionStore` as the cache) | Project standard |
| @supabase/supabase-js | ^2.99.3 | Reads under RLS; service-role in actions | Project standard |
| zod | ^4.3.6 | Action input validation | Project standard |
| zustand | ^5.0.12 | Only for UI-local state if needed (editor save pill) | Existing; `completionStore`/`walkthrough` stores are candidates for deletion |
| lucide-react | ^1.0.1 | Icons (UI-SPEC lists them) | — |
| @playwright/test | ^1.58.2 | Specs and deployed evals | Project standard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `sop_walks` table (F2) | Extend `sop_completions` with `in_progress` + UPDATE policy | Breaks the append-only guarantee other readers (inbox, competency, sign-off) rely on; rejected |
| Separate route `/sops/[sopId]/edit` | `?mode=edit` in one route + lazy editor | Separate route isolates the editor bundle by route but makes Walk⇄Edit a router navigation (hits the Next 16.2.1 action-queue risk) — **recommend single route + `?mode=edit` + `history.replaceState` switch + lazy chunk**, as the AdminShell seam already proves |
| Per-flag state in `ai_review_results` jsonb | `sop_ai_findings` table | jsonb cannot be counted by the gate cheaply or constrained; table recommended |

**Installation:** none. **Version verification:** `npm view` not run — no package is added. `[VERIFIED: package.json]` for the versions above.

## Package Legitimacy Audit

No external packages are installed by this phase; slopcheck not applicable. **Packages removed:** none. **Flagged:** none. (Konva/react-konva are already in `package.json` and are needed only if F1's annotation wave is confirmed.)

## Architecture Patterns

### System Architecture Diagram

```
Entry points (the one screen at /)                    Legacy URLs
 MachinePanel rows ─┐  NowCard "Walk it" ─┐           /sops/<id>?tab=walk|read ─┐
 Admin panel rows ──┤  Workshop drafts ───┤           /admin/sops/builder/<id> ─┤ 307 in proxy
 Wizard/Upload ─────┘  (focusHref+?from=) │           /admin/sops/<id>/versions ┘ (UUID-gated, fixed dest)
                                          ▼
              /sops/[sopId]   (server component page)
              ├─ getSessionContext(): role, org
              ├─ resolve lineage → latest published (workers) | exact row (admins)
              ├─ worker + draft/unknown → notFound(); worker superseded → redirect to latest
              ├─ admin + published + ?mode=edit + no open draft → "Start a new version" button (user event → forkDraft)
              └─ render <FocusFrame mode=… role=…>  (opts out of BackToSite)
                   │
   ┌───────────────┼────────────────────────────────────────────────┐
   ▼               ▼                                                ▼
 BROWSE/WALK/REVIEW (worker bundle)            EDIT (lazy admin chunk, ssr:false)        PARSING (lazy)
 useFocusSop → server-read steps               EditDocument/StepCard/AiCheckBanner       ParseProgress over
 startWalk ─► sop_walks row (in_progress)      PublishBar/Dialog/ThisSopBlock            parse_jobs poll
 recordWalkStep(ack|done|photo) ─► row         step actions ─► service-role writes       (status/current_stage/
 photo ─► getPhotoUploadUrl ─► Storage          tick ─► verified_* ─► ledger              elapsed ⇒ stage + ETA)
 Send ─► submitCompletion(reads walk row)       trigger clears tick on content edit       done ⇒ steps swap in place
        ─► sop_completions + photos            AI check ─► reviewer(draft+source) ─► sop_ai_findings
        ─► recordSignature (ledger)            Publish ─► assertPublishGates ─► performPublish
                                                          ─► supersede/notifyAssignedWorkers ─► ledger
 Back/Esc ─► router.push(formatPlace(parsePlace(from)))  ── lands on /?place=… (selection restored)
```

### Recommended Project Structure
```
src/app/(protected)/sops/[sopId]/page.tsx        # server component: resolve, gate, render frame
src/app/(protected)/sops/[sopId]/loading.tsx     # keep: frame-shaped skeleton (UI-SPEC "frame renders instantly")
src/components/focus/                            # worker bundle: FocusFrame, FocusTopBar, FocusRail, BrowseDocument, WalkStep, ReviewAndSend, ThisSopSummary
src/components/focus/admin/                      # lazy chunk: EditDocument, StepCard, AiCheckBanner, PublishBar, PublishDialog, ThisSopBlock, ParseProgress, MachinesButton/StandardsButton/CategoryButton (relocated)
src/hooks/useFocusSop.ts, useWalk.ts             # React Query over server actions
src/lib/sop/focus.ts                             # PURE: walk order, unlock rules, review missing-list, kind labels (single classifier, CLAUDE.md 2026-09-27)
src/lib/sop/focus-path.ts                        # PURE: focusHref(), backHref(from), legacy-redirect mapping
src/lib/sop/lineage-current.ts                   # PURE: latest published of a lineage
src/lib/sop/focus-write.ts                       # plain module: write convertSop() drafts for a new SOP (pipelines)
src/actions/focus-steps.ts, walk.ts, findings.ts, versions.ts   # 'use server' — async exports only
supabase/migrations/00071_focus_editor_walk.sql
tests/phase58/*.spec.ts, tests/evals/sop-focus.eval.ts
```

### Pattern 1: Server-component resolver (D-13) — no client redirect
Resolve in `page.tsx` with `getSessionContext()`; `redirect()`/`notFound()` there. The client never navigates from a mount effect (CLAUDE.md 2026-09-29: Next 16.2.1 orphans a server action dispatched while a navigation discards another).

### Pattern 2: Service-role write action with self-enforced scope
Every write in `focus-steps.ts`/`walk.ts`: `requireSopEditAccess({sopId})` (extend `SopEditTarget` with `{ stepId }` resolving step → section → SOP through the **session org**, never the row's) or `requireAdminContext()` for tick/untick/clear/publish; `createAdminClient()` writes carry `.eq('organisation_id', ctx.organisationId)`; one `recordDecision()` after governance writes. This keeps CAP-02 semantics: chain approvers may edit content, only admin/safety_manager may tick and publish. Because `sop_focus_steps` keeps **no authenticated write policy**, an approver cannot set the tick columns by PostgREST (the equivalent hole exists today on `sop_section_blocks` via `ssb_admin_manage_own_org`). `[VERIFIED: codebase]` (00066, 00069).

### Pattern 3: Tick clears itself in the database
Mirror migration 00032's `clear_block_verification_on_content_change`: a trigger on `sop_focus_steps` that, when `text`, `kind`, `tip`, `photo_required` or `image_paths` change, nulls `verified_by_admin_id`/`verified_at` and sets `needs_recheck = true` if it was ticked (the UI's "Edited — check it again"); reorder and standards changes do not fire it (UI-SPEC). A trigger fires for service-role updates too, so no action can forget it.

### Pattern 4: Walk progress is server-first, the client is a cache
`startWalk(sopId)` returns the existing `in_progress` walk or creates one (the walk id is the future completion id, so photo paths `{org}/completions/{walkId}/{photoId}.jpg` keep their validated shape). `recordWalkStep({walkId, stepId, kind})` verifies: walk belongs to session user+org, step belongs to the walk's SOP, acks only for hazard/ppe kinds, order rule honoured unless `sops.allow_forward_jump`. `useStepPhotos(walk.id)` stays keyed to the owner id; the 2026-10-03 leak rule is satisfied because state is keyed to `walk.id` and re-fetched when it changes. The eval must walk **twice in one session**. Send: `submitCompletion` loads the walk row and recomputes `stepData`, `contentHash` (over focus steps in walk order) and the photo list **server-side** (today they are client-supplied and the ack trace is "evidence, not a gate"); it refuses to submit if any hazard/ppe ack or required photo is missing, regardless of the jump-ahead flag.

### Pattern 5: Fork a draft by data, not by feature list
`forkDraft(publishedId)`: reuse an existing open draft of the lineage if present, else insert the next-version `sops` row (`computeNextVersionLineage`) and copy **every** table keyed on `sop_id` (census from migrations): `sop_sections` (new ids), `sop_focus_steps` (new ids, copy tick state for unchanged steps — see A2), `sop_images` (by path), `standard_attachments` at sop/section/step levels (remap ids), `sop_machines` (placement is trigger-synced), `sop_departments`, `sops_sub_trades`, owner/review/cadence/category/refresher fields, `objective`. `cloneSopAsDraft` copies none of the Phase 56 associations today (CLAUDE.md 2026-07-29: the miss is always the sibling nobody listed). Pin it with a spec that enumerates every `references public.sops(id)` table in `supabase/migrations` and fails if one is neither copied nor on a reasoned allow-list. Called from a user event (button), never a mount effect.

### Anti-Patterns to Avoid
- **Navigating or mutating on mount** (fork, start walk, redirect) — breaks CLAUDE.md 2026-09-29 and makes GET have side effects.
- **`router.push('?step=')`** for step changes — `useState` + `history.replaceState` (CLAUDE.md 2026-05-13, UI-SPEC).
- **Filtering workers' lists on `superseded_by`** (F5).
- **Re-running the converter after cutover** (F10).
- **A second copy of the hazard/PPE classifier** — walk order and kind labels live in `src/lib/sop/focus.ts` only (CLAUDE.md 2026-09-27); `step_number` is section-scoped, never a global id.
- **Quoting a forbidden literal in a comment** next to the guard that forbids it (CLAUDE.md 2026-09-28) — describe retired routes in words.
- **Raising a bundle baseline** — move DOWN by hand with a history note, or fix the code (CLAUDE.md 2026-09-13).
- **Reintroducing a dropped feature because its code existed** — see F1; annotation needs an explicit un-drop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step conversion for new SOPs | New ParsedSop→step mapper | `convertSop()` (pure, `src/lib/sop/convert.ts`) over in-memory `Section[]` | Already handles hazard-before-action ordering, PPE, checks, photo-required, image-path verification |
| Standards at step level | New attach UI/actions | `setStandardAttachment({target:{kind:'step'}})`, `getSopStandardsPanel`, `StandardLabels` | Already supports sop/section/step with org checks |
| Machine placement | New link action | `setSopMachines` (`src/actions/site.ts`) + trigger-synced `sops.placement` | Used by the site editor eval |
| Section create/rename/reorder | New RPCs | `createSection`, `updateSectionTitle`, `reorderSections` (RPC `reorder_sections`, 00020) | Guarded by `requireSopEditAccess`; note `createSection` writes `approved:false` and needs a `sectionKindId` — default to the canonical "procedure" kind and set `approved:true` (or stop reading it) |
| Ledger writes | Direct inserts | `recordDecision()` | Org/actor from session; agent rows must name the agent |
| Parse progress engine | New poller | The `ParseJobStatus` effect (realtime + 3-timer polling watchdog, `shouldStartPolling`, `PLAIN_STAGES`/`STAGE_SETS` in `src/lib/admin/job-stages.ts`) re-skinned | Behavior and unmount-cancel guard already proven (CLAUDE.md 2026-06 parse-status learnings) |
| Back target | Raw `from` in a URL | `parsePlace` → `formatPlace` (`src/lib/shell/place.ts`) | Whitelist; raw token never reaches the result (T-57-01) |
| Latest-version rule | Per-call-site SQL | One lineage module following `competency/lineage.ts` | Three read sites would otherwise drift |
| Photo upload | New upload path | `useStepPhotos` + `getPhotoUploadUrl` + `compressPhoto` | Retry-safe, path-validated |
| Autosave | Custom debouncer | Re-key `useBuilderAutosave` idiom (750 ms debounce, retry ×3, flush on pagehide) to step actions; "Saved/Saving…/Not saved" pill from the same store | UI-SPEC pill states match the existing store |
| Step images for admins | New storage plumbing | Existing `sop-images` bucket + `sop_images` rows; `image_paths` must equal an existing `sop_images.storage_path` (56 A-06) | No step-image *upload* exists in the old builder (`MediaGrid` only displayed); add a signed-upload action modelled on `getPhotoUploadUrl` that writes the `sop_images` row and appends the path |

**Key insight:** the risky code in this phase is not UI; it is the seams where an old contract is silently re-keyed (gate, reviewer, completion, clone). Each seam already has a pinning spec; change the pin and the code in the same commit.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sop_focus_steps` rows converted in Phase 56 (a snapshot — builder edits since then are not in it); `sop_section_blocks.verified_by_admin_id` ticks (old key); `parse_jobs.ai_review_results` flags keyed by `block_id`; `walkthrough_progress` rows (FK to `sop_steps`, orphaned after cutover); old `sop_completions.step_data` and `completion_photos.step_id` keyed to `sop_steps` ids; `sop_image_annotations` table (kept) | Final converter run (data migration) then retire; decide whether the final run also carries `verified_by_admin_id` onto steps whose source junction was verified (recommend yes, for **draft** SOPs only, so admins mid-review do not re-tick — optional, planner); drop old flags at cutover (D-02); activity page must read **both** key spaces (see Reader audit); `walkthrough_progress` left unused, listed as Phase 62 residue |
| Live service config | Supabase Realtime publication on `parse_jobs` (exists, reused); Storage buckets `sop-images`, `completion-photos` unchanged; Supabase migration history can be stale (CLAUDE.md 2026-10-04: check `supabase migration list` before `db push`) | Apply 00071 through the applier-script idiom; extend the applier file list for any later corrective migration (CLAUDE.md 2026-07-28) |
| OS-registered state | None — verified: no task scheduler/pm2 items for this feature; `public/sw.js` is the committed kill-switch, nothing new | None |
| Secrets / env vars | `ANTHROPIC` key (reviewer), service-role key, Supabase URL unchanged; no env var is renamed | None |
| Build artifacts | `.bundle-baseline.json` (`/sops/[sopId]/page` 795, `/page` 831); `.next` webpack cache (clear after any node_modules experiment); `tests/phase58` must be registered in `playwright.config.ts`; `scripts/dropped-features.json` + `LIVE_FEATURES` in `tests/phase55/deletion-sweep.spec.ts` | Update by hand per the idioms; run `npx playwright test --list --project=phase58` (CLAUDE.md 2026-05-25) |

## Repoint Inventory (every reference to a route or component this phase deletes)

`[VERIFIED: codebase]` — `rg` over `src/`; the planner must re-run the grep in Wave 0 and write the result into `tests/phase58/repoint-inventory.spec.ts` (Phase 57 shape: `RETIRED` tokens with owning plan, `INVENTORY` of files with `delete|repoint`, `LIVE_PLANS`).

**Production code (`src/`)**
| File : line | Today | Becomes |
|-------------|-------|---------|
| `components/sop/plant/MachinePanel.tsx:40,45` | `/sops/${id}`, `/sops/${id}?tab=walk` | `focusHref(id,{from})` browse; Walk keeps browse (see Q1) |
| `components/sop/plant/NowCard.tsx:81` | `/sops/${id}?tab=walk` | `focusHref(id,{from})` |
| `components/admin/governance/AdminMachinePanel.tsx:49,61,69` | `/sops/${id}`, `?tab=walk`, `/admin/sops/builder/${id}` | browse, browse, `focusHref(id,{mode:'edit',from})` |
| `components/shell/AdminRoomBodies.tsx:83` | builder link (Workshop drafts) | edit href |
| `components/admin/governance/GovernanceQueueRow.tsx:95` | builder link | edit href (`:126` assign link survives) |
| `lib/governance/inbox.ts:117` | Retry → builder | edit href (parsing view) |
| `components/admin/UploadDropzone.tsx:528` (`router.push` builder) and **`:573` (`window.location.href` — a full reload, violates WRK-03)** | builder | `router.push` edit href immediately (parse-in-progress view) |
| `app/(protected)/admin/sops/new/ai/PromptClient.tsx:117` | waits for `onCompleted` then pushes builder | push edit href as soon as `sopId` exists (do not wait for the draft) |
| `app/(protected)/admin/sops/new/blank/WizardClient.tsx:103` | builder | edit href |
| `app/(protected)/admin/sops/[sopId]/assign/page.tsx:216,225` | back to builder, link to versions | edit href; drop versions link |
| `actions/ai-fields.ts:228-229` | `revalidatePath` of admin/builder paths | `/sops/${id}` |
| `components/profile/CompetencySection.tsx:41` | `/sops/${id}` | unchanged address (still valid) |
| `next.config.ts` | `/admin/sops/:sopId/review` → builder (permanent) | retarget to the edit href or let the proxy chain it |
| `src/lib/supabase/middleware.ts` | no SOP-route block | add block (below) |
| `lib/journeys/journeys.ts` (~lines 126, 131, 142, 284, 299, 314, 328, 342, 361, 365, 408, 414, 427, 524, 540, 562) and `lib/uat/tests.ts` (4 refs) | tabbed page, builder, versions, Tools menu | new journeys (browse/walk/review, edit, parsing, versions rail) with real `route:` values; CLAUDE.md maintenance rule — same commit |
| `components/layout/BackToSite.tsx` / `lib/shell/place.ts` `placeForPath` | returns `/` for `/sops/*` (bar shows) | return `null` for `/sops/*` so the focus frame owns the top bar (same mechanism as `/pending`) |

**Proxy block to add** (`updateSession`, next to the existing `/sops` block; Phase 57-08 idiom): match `/sops/<uuid>` with `tab` ∈ {walk, read} → `/sops/<uuid>`; `/admin/sops/builder/<uuid>` and `/admin/sops/<uuid>/versions` → `/sops/<uuid>?mode=edit`; destinations are template strings over a UUID-regex-validated id only; copy refreshed cookies onto the redirect; 307. Pure mapping function lives in `focus-path.ts` and is unit-tested; a retirement-sweep spec asserts no client `router.replace` of these.

**Components/files deleted** (CONTEXT list plus consumers found): `app/(protected)/sops/[sopId]/page.tsx` (rewritten), `components/sop/tabs/ReadTab.tsx` + `tabs/index.ts`, `SopTabNav.tsx`, `WorkerPreviewToggle.tsx`, `walkthrough/{MobileWalkthrough,DesktopWalkthrough,ImmersiveStepCard,WalkthroughSwitcher,ViewModeToggle}.tsx`, `SafetyAcknowledgement.tsx`, `StepProgress.tsx`, `stores/{walkthrough,walkthroughMode,preview}.ts` (+ `completionStore` unless kept as the cache), `app/(protected)/admin/sops/builder/[sopId]/*` (after relocating the three tool buttons), `admin/sops/[sopId]/versions/page.tsx`, `components/admin/builder/*`, `components/admin/builder-v2/{BlockEditShell,EditableDocument,selection-bridge,agent,fields,inserter,ghosts}` (+ `InlineText` re-homed), `components/admin/verify-checklist/*`, `components/admin/ai-reviewer/*` (re-skinned into `AiCheckBanner`), `SectionEditor.tsx`, `lib/sop/sections.ts` (`procedureSections`/`scopeSopToJob`; `isHazardSection` etc. may survive for the converter), `useSopDetail.ts`, `hooks/useBuilderAutosave.ts` (re-keyed). **Block machinery** (`components/sop/blocks/*`, `LayoutRenderer`, `SectionContent`, `SopBlockContext`, `lib/builder/{block-registry,content-ops,layout-schema,sanitize-layout,puck-to-block-content,sign-layout-data-images,section-blocks-core,block-findings}`, `lib/validators/blocks.ts`, `lib/parsers/parsed-sop-to-layout-data.ts`, `actions/sop-section-blocks.ts`): D-01 retires it; delete each module only when `rg` shows no remaining consumer, and where a consumer survives (agent layer, `/api/schema`, ai-fields) re-point it or record it as explicit Phase 62 residue — do not delete blind.

## Reader Audit — what still reads the old model (must be repointed or consciously frozen)

`[VERIFIED: codebase]` (`rg "sop_steps|sop_section_blocks|layout_data"` outside deleted files)

| Reader | Reads | Action |
|--------|-------|--------|
| `app/(protected)/activity/[completionId]/page.tsx:119-144` | `sop_steps` by `step_data` keys for supervisor sign-off review | **Breaks for every new completion** (keys are now focus-step ids). Read `sop_focus_steps` first, fall back to `sop_steps` for pre-cutover completions. Phase 59 deletes this page later; Phase 58 must not leave it blank |
| `components/sop/plant/NowCard.tsx:25-30` | `sop_steps.time_estimate_minutes` | read `sop_focus_steps.time_estimate_minutes` |
| `lib/agent-layer/{synthesis,sop-pack,signals}.ts`, `actions/agent-layer.ts` | steps + `sop_section_blocks` junction ids | re-point to focus steps (junction-keyed metadata ends); `triggerAgentSynthesis` runs on every publish |
| `lib/parsers/ai-reviewer/jobs/job-e-terminology.ts:131` | `sop_steps` vocabulary | focus steps |
| `app/api/sops/[sopId]/route.ts` (GET nested select), `api/sops/[sopId]/sections/[sectionId]/route.ts` (legacy PATCH, CAPABILITY-MATRIX gap 1), `api/schema/route.ts` | steps/blocks | re-point or delete with the legacy PATCH; keep matrix honest |
| `hooks/useCompletions.ts` / "my record" | completions | verify no join to `sop_steps` |
| Cloning (`cloneSopAsDraft`, `uploadNewVersion`) | steps/blocks/images | replaced by `forkDraft` |

## Common Pitfalls

### Pitfall 1: "Carry over untouched" collides with the hash pin
**What goes wrong:** An executor edits `assertPublishGates`, the pin spec goes red, and "fixes" it by recomputing the hash with no record.
**Why:** CONTEXT says untouched in meaning; the pin says untouched in bytes.
**Avoid:** Plan a single named task "re-key the gate and re-pin" with the decision recorded in the spec header and the plan; run the pin spec in the same commit; never repoint the hash anywhere else.
**Warning signs:** `publish-gate-pin.spec.ts` red; a gate body that still mentions `sop_section_blocks`.

### Pitfall 2: Per-plan self-checks green while sibling projects are red
**What goes wrong:** Re-keying the gate or deleting builder files breaks specs in projects the plan never ran (CLAUDE.md 2026-10-04).
**Avoid:** Each plan's verify runs `npx tsc --noEmit` plus **every project that greps its files** — use the Spec Repoint list below. Run the full suite **once** at the phase gate, never in a loop (shared OTP budget, CLAUDE.md 2026-09-28).

### Pitfall 3: Wiring a server-only module into a path scripts load
`recordDecision` imports `server-only`; `scripts/verify-gate-check.tsx` loads the real publish route and stubs collaborators in `Module._load`. Any new import in `publish-core.ts` (lineage module is fine — plain; `notifyAssignedWorkers` is a server action) must be added to that stub list or the harness crashes. Also grep `scripts/*-check.tsx` for deleted builder files (`selection-sync-check`, `field-panel-check`, `render-parity-check`, `autosave-rewire-check`, `ai-overlay-check`, `agent-panel-check` and their phase26 specs) — they are the builder's harnesses and go with it.

### Pitfall 4: The 60 px button, 28 px text and tokens are invisible to assertions
Per CLAUDE.md 2026-07-14/2026-09-28, token and sizing bugs pass every gate. Add `--text-step: 28px` (+ line-height) to the `@theme` block **and** to the token loop in `tests/lint/design-tokens.spec.ts`; after the first build grep `.next/static/css/*.css` for `text-step`, `max-w-205`, `w-75`, `bg-accent-signoff`; read every eval screenshot. Do not use `bg-[--tint-ai-bg]`; use the real utility or `style={{ background: 'var(--tint-ai-bg)' }}` (lint trips on arbitrary syntax).

### Pitfall 5: Eval fixture changes ripple to sibling evals
The eval-site org is shared (CLAUDE.md 2026-09-29). `scripts/eval-fixtures.mjs` writes the walk fixture only to `sop_sections`/`sop_steps`; it must also upsert focus steps (hazard, ppe, step, photo-required step, check) and new fixtures for: a draft with mixed ticks and open findings, a blank SOP, a v3-published/v4-draft lineage, an in-flight `parse_jobs` row (`processing`, `input_type` upload and video), and a failed job. Assert by name, not count; use `SLOW` on every first-navigation `expect`; locator `count()` before raising timeouts.

### Pitfall 6: A completed walk leaves state that a second walk inherits
Walk the fixture twice in one eval session; test "Start over" and "Resume"; reset client state when `walk.id` changes (CLAUDE.md 2026-10-03). Clean up eval completions with `tests/evals/lib/completion-cleanup.ts`.

### Pitfall 7: Drafts are readable org-wide by RLS today
`org_members_can_view_sops` is org-scoped only; there is no draft/published distinction in SELECT policies. D-13 ("a worker cannot open a draft") is therefore enforced by the **server page**, not RLS. State this in CAPABILITY-MATRIX as a known pre-existing residual; do not claim RLS enforcement.

### Pitfall 8: `step_number` is not a step id
Rail numbering is per section ("Mirror Cleaning · 3"); "Step 7 of 24" is a walk index computed from the walk order list. Never key anything on `step_number`.

### Pitfall 9: Publishing and the approval chain
`performPublish` re-runs the gate; the route diverts to `approval_state='pending'` first (F12). A publish that "does nothing visible" is usually the diverted case.

## Code Examples

### Pure lineage rule (new module, mirrors `competency/lineage.ts`)
```ts
// Source: src/lib/competency/lineage.ts convention [VERIFIED: codebase]
export interface LineageRow { id: string; version: number; parent_sop_id: string | null; status: string }
export const lineageRoot = (r: Pick<LineageRow, 'id' | 'parent_sop_id'>) => r.parent_sop_id ?? r.id
/** Latest published member per lineage; one row per SOP for worker lists. */
export function latestPublished<T extends LineageRow>(rows: T[]): T[] {
  const best = new Map<string, T>()
  for (const r of rows) {
    if (r.status !== 'published') continue
    const k = lineageRoot(r)
    const cur = best.get(k)
    if (!cur || r.version > cur.version) best.set(k, r)
  }
  return [...best.values()]
}
```

### Back target through the existing whitelist
```ts
// Source: src/lib/shell/place.ts [VERIFIED: codebase]
import { formatPlace, parsePlace } from '@/lib/shell/place'
export const backHref = (from: string | null | undefined) => formatPlace(parsePlace(from)) // unknown token -> '/'
// Add placeToken(place) (inverse of parsePlace) so entry points can emit ?from=<token>
```

### Proxy block shape (add beside the existing `/sops` block)
```ts
// Source: src/lib/supabase/middleware.ts Phase 57-08 idiom [VERIFIED: codebase]
const m = path.match(/^\/sops\/([0-9a-f-]{36})$/i) // then SOP_ID.test(id)
if (m && SOP_ID.test(m[1]) && ['walk', 'read'].includes(request.nextUrl.searchParams.get('tab') ?? '')) {
  const redirect = NextResponse.redirect(new URL(`/sops/${m[1]}`, request.url)) // 307
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
```

### Migration 00071 outline (idempotent, org conjunct restated, no elevated-privilege function)
```sql
-- sop_focus_steps: tick + provenance relax + edit-time provenance
alter table public.sop_focus_steps
  add column if not exists verified_by_admin_id uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists needs_recheck boolean not null default false,
  alter column run_id drop not null,
  alter column source_key set default ('edit:' || gen_random_uuid()::text);
-- trigger clear_focus_step_tick (text/kind/tip/photo_required/image_paths changed => clear + needs_recheck)
-- sops.allow_forward_jump boolean not null default false; sops.objective text check (char_length(objective) <= 500)
-- sop_walks (F2) + RLS own-row (org AND worker_id = auth.uid(); WITH CHECK restates both)
-- sop_ai_findings (F4) + RLS admin/safety_manager read, no authenticated write
-- NO write policy on sop_focus_steps (writes via service-role actions)
```
Per CLAUDE.md: reload the PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`) before asserting; verify existence with `to_regclass` through the Management API, and read `PGRST205` as "stale cache", not "missing".

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Block editor over `layout_data` + junction verify | Steps as the one unit; tick per step | Phase 58 (this) | One model, no mapping layer |
| In-memory walk, evidence-only ack trace | Server walk row, server-verified acks/photos | Phase 58 | Resume works; gate is real |
| `?tab=` tabbed SOP page, three walk screens | One frame, browse/walk/review states | Phase 58 | Smaller worker bundle (block renderers leave the route) |
| `superseded_by` as currency | lineage max-version | Phase 58 | v3 never shown beside v4 |

**Deprecated/outdated:** Puck-era artefacts; `useViewport`-driven layout (CSS only per 57 D-21); `router.push` step navigation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chosen design: single route `/sops/[sopId]` with `?mode=edit`, in-place switch via `history.replaceState`, lazy admin chunk | Alternatives | If Simon wants a distinct edit URL, add `/sops/[sopId]/edit` (bundle then isolated by route; switch becomes a router navigation) |
| A2 | Forking a draft copies tick state for unchanged steps; edits clear their own tick (trigger) | Pattern 5 | If ticks must all be redone on every new version, 48-step SOPs need 48 ticks for a one-word fix; if ticks are carried, confirm that is an acceptable reading of "tick every step" |
| A3 | `recordSignature(worker)` after submit is the D-10 "ledger row" | F9 | A different row/kind wanted (or none); adjust `decision-writers.json` |
| A4 | New gate drops the ai_prompt/no-source bypass and the section-approved check | F3 | Existing AI-prompt SOPs' next versions need ticks (intended); if the bypass must stay, the "tick every step" rule has an exception |
| A5 | Blank-SOP AI check runs jobs D+E on the draft only | F4 | Job set may need adjusting |
| A6 | `document.referrer` unchanged by SPA navigation | F13 | If wrong, `history.back()` could be used as CONTEXT describes |
| A7 | Walk ETA is heuristic from input type + elapsed; "page n of m" not delivered | F6 | If page counts are required, new `parse_jobs` columns and pipeline writes are needed |
| A8 | "Walk it" lands on browse (Resume/Start walking one tap away) and never starts a walk on mount | Q1 | If Walk should start immediately, a user-event or a `?start=1` handler is needed — still not a mount-time write |
| A9 | `sops.objective` as a stopgap column until Phase 60 | F7 | Phase 60 migration must carry it |
| A10 | Final converter run before deploy, converter refusal in the deploy commit, `--missing` sweep after | F10 | Edits in the old builder during the gap are lost |

## Open Questions

1. **Does "Walk it" skip browse?** D-05/D-06 imply Walk ≠ row click, but also "no completion exists until Start walking". *Recommendation:* Walk it and the row title both land on browse; "Start walking" (or "Resume") is the single primary. (A8)
2. **Is D-03 (annotation) still wanted now that it is known to be deleted?** (F1) *Recommendation:* ask; plan wave 6 as optional and isolated; default to attach/remove only.
3. **"Show me" semantics** (F8). *Recommendation:* keep locate-on-map.
4. **Where do Assign, Delete draft, Category, source document and "upload a new version" live?** (F11) *Recommendation:* rail links as listed; `uploadNewVersion` left unreferenced and recorded as Phase 61 residue.
5. **Carry tick state across a fork and across the final converter run?** (A2, Runtime State) *Recommendation:* yes for unchanged steps of a fork; for the cutover run carry `verified_by_admin_id` onto drafts only.
6. **What does the AI banner say for a blank SOP / SOP with no parse job?** (A5)
7. **Does Send write a ledger row, and which?** (A3)
8. **Admin Walk⇄Edit switch while a fork prompt is pending / on a superseded version** — superseded versions are browse-only (no switch to edit); confirm.
9. **Block-machinery deletion depth** — delete every module with no remaining consumer this phase, or only the CONTEXT-listed ones and leave the rest to Phase 62? *Recommendation:* delete by consumer-graph check; record survivors.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, scripts, specs | ✓ | v22.16.0 | — |
| Supabase CLI (`npx supabase`) | applying 00071 | ✓ | 2.83.0 (update notice only) | Management API applier (`scripts/apply-phase56-migration.mjs` idiom, needs `SUPABASE_ACCESS_TOKEN`) |
| `tsx`, `playwright` | scripts, specs | ✓ (node_modules/.bin) | — | — |
| `.env` / `.env.local` | live probes, evals, applier | ✓ files present (contents not read) | — | Live specs self-skip without `PHASE58_LIVE=1`; evals self-skip without `EVAL_BASE_URL` |
| Anthropic API key + spend cap | reviewer re-point runtime | assumed configured on Railway (reviewer already runs in prod) | — | Reviewer fails open with synthetic warning flags; never treat as "no findings" |
| Railway deploy + `/api/version` | deployed eval | ✓ via `npm run eval -- --phase 58` | — | — |

**Missing with no fallback:** none. Railway-only testing applies: no local dev or localhost instructions to Simon.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` ^1.58.2 (source-contract, pure-module unit with static `@/` imports, live-DB probes, deployed evals) |
| Config file | `playwright.config.ts` — add project `phase58` (`testMatch: /tests\/phase58\/.*\.(spec\|test)\.ts$/`), modelled on `phase56`/`phase57` |
| Quick run command | `npx tsc --noEmit && npx playwright test --project=phase58` |
| Per-plan extras | the sibling projects named in the Spec Repoint list (phase56, 57, 55, 41, 26, 29, 30, 52, 54, 15-stubs, 11-stubs, 21-*, evals --list) |
| Full suite command | `npm run test` **once** per gate; `npm run build` (runs the bundle gate) as the final gate (CLAUDE.md 2026-06-27) |
| Deployed eval | `npm run eval -- --phase 58` (new `tests/evals/sop-focus.eval.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOC-01 | Frame structure: top bar Back+title only, 300 px rail, 820 px column, layout opts out of `BackToSite`, no shell testids | source-contract + eval | `playwright test --project=phase58 frame-structure` | ❌ Wave 0 |
| FOC-02 | Edit frame, rail "This SOP" block (version, machine, objective, standards, jump-ahead); objective action guarded | source-contract + live | `... edit-rail` | ❌ Wave 0 |
| FOC-03 | `?from` whitelist, Esc order, Back = `router.push(backHref)`, legacy redirects in proxy only, `placeForPath` null for `/sops/*` | pure unit + source-contract | `... focus-path legacy-redirects` | ❌ Wave 0 |
| FOC-04 | Walk order (hazard/ppe first), unlock/jump rules, review missing-list, server walk actions (org scope, step-in-SOP, ack kinds, photo path), submit recomputes from walk row, second-walk no-leak | pure unit + source-contract + live probe | `... focus-model walk-actions walk-no-leak` | ❌ Wave 0 |
| WRK-03 | Pipelines write focus steps with `new:` keys, none writes `layout_data`; parse-progress stage/ETA pure fn and states; editor mounts over parse job; no `window.location` navigation into the editor | source-contract + unit + eval | `... parse-pipelines parse-progress` | ❌ Wave 0 |
| WRK-04 | Re-keyed gate (hash re-pinned with decision), `getPublishGateStatus` parity, reviewer sends draft + `step_id`, findings table, `clearFinding` ledger, tick trigger, no tick-all (`no-bulk-verify-ui` stays green), decision-writers.json updated | source-contract + live + lint | `... publish-gate reviewer-steps edit-actions` + `--project=phase15-stubs` | ❌ Wave 0 (+ ✅ `tests/lint/no-bulk-verify-ui.spec.ts`) |
| SOP-04 | Lineage-latest module and its 3 read sites, fork copies every `sop_id`-keyed table (census), supersede/notify on publish, worker redirect to latest, earlier versions browse-only | pure unit + census spec + eval | `... lineage-current fork-draft` | ❌ Wave 0 |
| (cross) | Retirement: dropped-list entries, deletion sweep + retirement sweep assert absence of REFERENCES; repoint inventory; converter refuses `--apply`; capability matrix rows present | source-contract | `... retirement-sweep repoint-inventory cutover-converter-retired capability-matrix` | ❌ Wave 0 |
| (cross) | Bundle gate: `/sops/[sopId]/page` ≤ baseline +2 KB (baseline moved DOWN by hand with history), editor markers absent from the worker route, Konva/pdfjs/mammoth absent | build gate + spec | `npm run build`; `tests/phase41/bundle-gate.spec.ts` | ✅ edit |
| (cross) | Design tokens: `--text-step` declared and pinned; no raw palette/px | lint | `playwright test --project=phase15-stubs design-tokens` | ✅ edit |

### Spec Repoint list (will go red or pass vacuously when routes/components are deleted)
`[VERIFIED: codebase]` by `rg` of `tests/` for the retired tokens; disposition is a first guess for the Wave-0 inventory.

- **Delete with their subject:** `tests/builder/builder-edit-stage.spec.ts`, `tests/builder/builder-review-flow.spec.ts` (gate halves repoint to `phase58`), `tests/sb-layout-editor.test.ts`, `tests/sb-section-schema.test.ts`, `tests/sb-auth-builder.test.ts` (auth halves repoint), `tests/sb-builder-infrastructure.test.ts` (repoint), `tests/integration/{desktop-walkthrough-layout,sequential-ack,walkthrough-store-ack,scp-source-viewer,scp-parse-pipeline,scp-verify-checklist}.*`, `tests/lint/no-static-desktop-import.spec.ts`, `tests/phase22/visual-layer.spec.ts`, `tests/phase26/{ghosts,inserter,reorder,visual-block,field-map,field-inline-patterns,autosave-rewire,ai-overlay}.spec.ts`, `tests/phase26.5/agent-panel-readonly.spec.ts`, `tests/phase30/{tab-merge,list-rows,plain-language}.spec.ts`, `tests/phase29/publish-stage-approval.spec.ts`, `tests/phase33/{wayfinder-header,plain-language-access}.spec.ts`, `tests/phase32/wire-up-mode.spec.ts` (builder halves), `tests/phase36/version-breakdown-panel.spec.ts`, `tests/phase23/version-supersede.spec.ts`, `src/components/admin/verify-checklist/__tests__/*`, `src/lib/parsers/__tests__/parser-creates-junctions.test.ts`, `scripts/*-check.tsx` builder harnesses.
- **Repoint (survivor assertions move to the new files):** `tests/phase26/spine-regression.spec.ts`, `tests/phase29/{publish-core-extraction,publish-chain-gate,phase-gate}.spec.ts`, `tests/phase40/{spine-freeze,dup04-page-shell,parse-status-no-navigate-after-unmount}.spec.ts`, `tests/phase41/{nav-and-shim,reference-sweep,bundle-gate}.spec.ts`, `tests/phase43/{route-truth,dead-controls}.spec.ts`, `tests/phase51/builder-machines-row.spec.ts` (machines select moves to the rail), `tests/phase52/{plant-panel,plant-now-card}.spec.ts`, `tests/phase53/login-next-redirect.spec.ts`, `tests/phase54/{admin-machine-panel,governance-inbox,inbox-reuses-governance-gating,library-table}.spec.ts`, `tests/phase55/{deletion-sweep,worker-path-contract}.spec.ts`, `tests/phase56/{placement,standards-actions,decision-writers-sweep,publish-gate-pin}.spec.ts`, `tests/phase57/{machine-body,place,retirement-sweep,repoint-inventory}.spec.ts`, `tests/phase28/library-and-worker.spec.ts`, `tests/phase30/{dead-weight,governance-fold}.spec.ts`, `tests/phase35/no-competency-gate.spec.ts`, `tests/phase36/no-refresher-gate.spec.ts`, `tests/phase37/no-competency-gate-worker.spec.ts`, `tests/sb-ux-blueprint.test.ts`, `tests/sb-ux-walkthrough.test.ts`, `tests/lint/{no-bulk-verify-ui,no-dead-internal-hrefs}.spec.ts` (allow-list stays; new code must not use the banned phrases).
- **Evals:** `tests/evals/cut-features.eval.ts` (walk-with-photo test → focus screen; builder/versions probes), `one-screen.eval.ts` (lines asserting `?tab=walk` hrefs and the builder href, `/sops/${id}?tab=walk` URL regex), `governance.eval.ts` (line 176 edit href), `site-editor.eval.ts` (step 6 links a machine from the builder Tools menu → rail Machine select), `sop-ledger.eval.ts` (case B "old SOP page and builder render the converted fixture"), `sop-detail.eval.ts` (real-org read page + "Edit in builder"; replace with the focus eval).

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + `npx playwright test --project=phase58` (+ any sibling project the task's files appear in).
- **Per wave merge:** `phase58`, `phase57`, `phase56`, `phase55`, `phase41`, `phase15-stubs` (lints), `phase26`, `phase29`, `phase30`, `phase52`, `phase54`.
- **Phase gate:** `npm run build` (bundle gate) + full `npm run test` once, then `npm run eval -- --phase 58`; read every screenshot in UI-SPEC's list; full suite green (live probes that fail only with `verifyOtp … rate limit` are an environment limit, not a regression).

### Wave 0 Gaps
- [ ] `playwright.config.ts` — register `phase58`; verify with `--list`
- [ ] `tests/phase58/repoint-inventory.spec.ts` + `retirement-sweep.spec.ts` (Phase 57 idiom, fixme until owning plan lands)
- [ ] Requirement spec stubs listed in the map above
- [ ] `scripts/eval-fixtures.mjs` — focus-step fixtures, lineage fixture, parse-job fixtures
- [ ] `tests/evals/sop-focus.eval.ts` skeleton (self-skips without `EVAL_BASE_URL`); screenshots per UI-SPEC; no-reload marker (`window.__nav` survives the click into the editor); walk twice; computed `min-height` ≥ 60, rail 300, column max-width 820, rail hidden < 1024; compiled CSS contains `text-step`, `max-w-205`, `w-75`, `bg-accent-signoff`
- [ ] `--text-step` token + lint pin
- [ ] Pure modules `focus.ts`, `focus-path.ts`, `lineage-current.ts` with unit specs first

## Security Domain

`security_enforcement` is not disabled in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | Supabase Auth, `getSessionContext()` |
| V3 Session Management | no change | proxy `getClaims()` |
| V4 Access Control | **yes** | Role from session only; `requireAdminContext` (tick, clear, publish, fork), `requireSopEditAccess` (content edit incl. chain approvers); every service-role write filtered by **session** org; worker draft refusal in the server page; RLS on `sop_walks` own-row; matrix updated |
| V5 Input Validation | **yes** | Zod on every action; UUID checks on ids; storage paths validated against `{org}/completions/{walkId}/{photoId}.{jpg|png}`; text length caps |
| V6 Cryptography | no | `contentHash` (SHA-256) recomputed server-side |
| V12 Files/Resources | yes | Signed upload URLs only; content-type allow-list jpeg/png; size cap via `compressPhoto`; step-image upload action must validate type/size and org prefix |
| V13 API | yes | Reviewer route keeps per-day and per-org spend caps; 429 handling |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `walkId`/`stepId`/`findingId`/`sopId` (service-role bypasses RLS) | Tampering / Info disclosure | Resolve the SOP and org from the session-org-filtered row, never the fetched row's own org (CLAUDE.md 2026-07-28); step must belong to the walk's SOP |
| Client-supplied trust flags on a server action (the `createBlock` `serviceRole` class) | Elevation | No `organisationId`/`userId`/`agent` parameters on any new action; verify the first client importer of each action (CLAUDE.md 2026-09-30) |
| Open redirect via `?from=` | Tampering | `parsePlace` whitelist → fixed `formatPlace` output |
| Proxy redirect steering | Tampering | UUID-gated id, fixed destination templates, cookies copied |
| Skipping hazard/PPE ack by direct action call | Tampering | Server verifies acks and required photos at submit from the walk row; jump-ahead never relaxes them |
| Tick/clear forged by a chain approver | Elevation | No authenticated write policy on `sop_focus_steps`/`sop_ai_findings`; verify/clear actions admin-only |
| Stored XSS in step text/tips | Tampering | React text rendering only; no `dangerouslySetInnerHTML`; inline editor writes plain text |
| Cross-org clone / fork leak | Info disclosure | Fork copies only from a row filtered by session org; census spec |
| Prompt injection via source text into the reviewer | Tampering | Findings are advisory; a finding can only block (never auto-clear or auto-publish); output parsed as JSON and length-capped |
| A "ledger row" claimed but not written | Repudiation | `decision-writers.json` entries + sweep for every new governance writer |

## Recommended Wave / Plan Shape (coarse granularity)

0. **Harness & inventories:** `phase58` project, repoint inventory, requirement stubs, eval skeleton + fixtures, pure modules (`focus`, `focus-path`, `lineage-current`), `--text-step`, gate-pin decision recorded.
1. **Migration 00071** (+ applier script, `[BLOCKING]` live apply, assertions that bypass the schema cache, live RLS spec), types regenerated, CAPABILITY-MATRIX rows.
2. **Server layer (parallelisable, disjoint files):** (a) `focus-steps.ts` edit/tick/standards/objective/jump-ahead/image-upload + `SopEditTarget {stepId}` + decision-writers; (b) `walk.ts` + hardened `submitCompletion` + `recordSignature` call; (c) gate re-key + hash re-pin + supersede/notify in `performPublish` + `getPublishGateStatus`; (d) reviewer re-point + `sop_ai_findings` + `clearFinding`; (e) pipelines write steps (`focus-write.ts`), blank wizard, restructure/transcribe/ai-prompt/parse; (f) `forkDraft` + census spec.
3. **Frame + walk UI (worker bundle):** `FocusFrame`, rail, browse, walk, review, sent; server page resolver; `placeForPath` opt-out; proxy redirects; entry-point repoints (worker side) with `?from=`; bundle measurement.
4. **Editor UI (lazy admin):** `EditDocument`, `StepCard`, banner, bottom bar, publish dialog (incl. `pendingApproval`), `ThisSopBlock` with relocated tool buttons, `ParseProgress`, wizard landings via `router.push`; admin-side entry-point repoints.
5. **Cutover:** `[BLOCKING]` final converter apply → converter refusal committed → deploy-commit deletions (all of §Repoint, guards moved, dropped-list entries, retirement + deletion sweeps, journeys, UAT, matrix, bundle baseline moved DOWN by hand with history note) → `--missing` sweep → reader audit repoints (activity page, NowCard, agent layer).
6. **Annotation (optional, only if confirmed):** rebuild behind the lazy seam, un-drop the `annotation` feature in the dropped list and sweep, widen the Konva isolation spec.
7. **Eval & sign-off:** deploy, `npm run eval -- --phase 58`, read screenshots, full suite once, validation signed off. `autonomous: false` human-verify tasks are replaced by the eval (CLAUDE.md).

Guardrails the plans must carry: tick-only-at-plan-close for REQUIREMENTS ids; never recapture the bundle baseline; `[BLOCKING]` markers on the migration apply and the converter run; each plan runs the sibling projects that grep its files.

## Project Constraints (from CLAUDE.md)

- Next.js 16 / React 19 / TS 5 / Tailwind 4 / Supabase; **online-only** (no Serwist/Dexie/idb-keyval); Konva only behind the lazy admin seam.
- **Design tokens only** (`blueprint-theme.css`; lint bans raw palette classes, bare hex, `[Npx]`; radius vocabulary of four; tap targets `min-h-tap`/`tap-glove` 60/`tap-row` 72).
- **Evals replace human-verify checkpoints**; Railway-only testing — no localhost/dev instructions to Simon; read the screenshots.
- **Pathways map** (`journeys.ts`) and `src/lib/uat/tests.ts` updated in the **same commit** as any route/flow change; `/pathways` "All screens" must show 0 not-mapped for new routes.
- **Capability matrix** updated in the same commit as any RLS policy, `require*` guard or role-check change (rows needed: walk/browse per role, Walk⇄Edit switch, jump-ahead write, version browse read, tick/clear/publish, fork, step edit by approvers).
- Server actions in `src/actions/` for mutations; Zod for all input; `getSessionContext()`/`requireAdminContext()` for every server entry; `'use server'` files export **async functions only**; plain modules for pure helpers.
- Migrations numbered sequentially (next is **00071**); RLS: org conjunct on every arm, `WITH CHECK` restates `USING`, double-quoted policy names; no security-definer functions taking a tenant id parameter.
- Learnings that bite here: 2026-10-03 (state keyed to owner; second iteration in evals; delete the *parameter* that only a deleted feature supplied), 2026-09-29 (no navigation from mount effects; `SLOW` timeouts; shared fixtures), 2026-09-28 (don't quote forbidden literals; compiled-CSS check), 2026-09-27 (single classifier module), 2026-09-13/2026-10-05 (bundle baseline is a decision artefact; print the summed file list before touching a baseline), 2026-08-04 (deletion guards assert absence of references; RLS OR-combines), 2026-07-13 (guards go stale-red when code moves — repoint in the same commit), 2026-07-29 (data-keyed sweeps, extending an idiom copies its bug), 2026-05-13 (`useState` + `replaceState` on hot paths), 2026-06-27 (run a real `npm run build`).

## Sources

### Primary (HIGH confidence — read this session)
- `58-CONTEXT.md`, `58-UI-SPEC.md`, `.planning/ROADMAP.md` (Phase 56/57/58 blocks), `.planning/REQUIREMENTS.md` (FOC/SOP/WRK lines), `one-screen-site.md`, `authoring-flow.md`, sketch-findings SKILL.md, `57-04-SUMMARY.md`, `57-08-SUMMARY.md`, `CAPABILITY-MATRIX.md`
- Code: `src/app/(protected)/{layout.tsx,sops/[sopId]/page.tsx,admin/sops/builder/[sopId]/page.tsx,activity/[completionId]/page.tsx}`, `src/app/page.tsx`, `src/lib/supabase/middleware.ts`, `next.config.ts`, `src/lib/shell/place.ts`, `src/components/{layout/BackToSite,shell/OneScreen,sop/plant/{MachinePanel,NowCard},admin/governance/AdminMachinePanel,admin/ParseJobStatus,admin/UploadDropzone}.tsx`, `src/actions/{completions,versioning,sop-section-blocks,sections,standards,site-worker}.ts`, `src/lib/governance/publish-core.ts`, `src/app/api/sops/{[sopId]/publish,[sopId]/ai-reviewer,[sopId]/parse-job,parse}/route.ts`, `src/lib/parsers/ai-reviewer/*`, `src/lib/sop/{convert,sections}.ts`, `scripts/{convert-sops-to-steps.ts,dropped-features.json,decision-writers.json,check-bundle-size.ts,eval-fixtures.mjs,run-evals.mjs}`, `.bundle-baseline.json`, `playwright.config.ts`, `tests/phase56/publish-gate-pin.spec.ts`, `tests/phase57/repoint-inventory.spec.ts`, `tests/phase55/deletion-sweep.spec.ts`, `tests/lint/{no-bulk-verify-ui,no-dead-internal-hrefs,design-tokens}.spec.ts`, `tests/phase41/bundle-gate.spec.ts`
- Migrations: `00008`, `00010`, `00013`, `00021`, `00032`, `00038`, `00039`, `00061`, `00063`, `00066`, `00069`, `00070`
- Git history: commit `6eb04d2d` (annotation deletion), `52b40a6f` (original editor)

### Secondary / Tertiary
- None. (`document.referrer` behaviour is `[ASSUMED]`, A6.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions from `package.json`
- Architecture/recommended designs: MEDIUM — grounded in code, but F2/F3/F4/F5 designs are proposals needing sign-off
- Pitfalls: HIGH — each traces to a read file or a CLAUDE.md learning
- Spec/eval inventory: MEDIUM-HIGH — token grep, dispositions are first guesses to be fixed by the Wave-0 inventory

**Research date:** 2026-10-05
**Valid until:** ~2026-10-19 (fast-moving: Phase 59–61 and the converter/cutover sequencing change what is safe to delete)
