---
phase: 58-the-sop-focus-screen-walk-edit
reviewed: 2026-10-05T12:00:00Z
depth: standard
files_reviewed: 118
files_reviewed_list:
  - src/actions/walk.ts
  - src/actions/completions.ts
  - src/actions/focus-steps.ts
  - src/actions/findings.ts
  - src/actions/versions.ts
  - src/actions/publish-gate.ts
  - src/actions/sections.ts
  - src/actions/site-worker.ts
  - src/actions/observations.ts
  - src/actions/sops.ts
  - src/actions/versioning.ts
  - src/actions/ai-fields.ts
  - src/actions/agent-layer.ts
  - src/actions/introspection.ts
  - src/lib/auth/guards.ts
  - src/lib/sop/editable.ts
  - src/lib/sop/focus-read.ts
  - src/lib/sop/focus-write.ts
  - src/lib/sop/walk-read.ts
  - src/lib/sop/lineage-current.ts
  - src/lib/sop/focus.ts
  - src/lib/sop/focus-path.ts
  - src/lib/sop/convert.ts
  - src/lib/governance/publish-core.ts
  - src/lib/governance/inbox.ts
  - src/lib/supabase/middleware.ts
  - src/app/(protected)/sops/[sopId]/page.tsx
  - src/app/(protected)/activity/[completionId]/page.tsx
  - src/app/(protected)/admin/sops/[sopId]/assign/page.tsx
  - src/app/api/sops/[sopId]/ai-reviewer/route.ts
  - src/app/api/sops/[sopId]/publish/route.ts
  - src/app/api/sops/[sopId]/route.ts
  - src/app/api/sops/parse/route.ts
  - src/app/api/sops/ai-prompt/route.ts
  - src/app/api/sops/restructure/route.ts
  - src/app/api/sops/transcribe/route.ts
  - src/app/api/schema/route.ts
  - src/lib/parsers/ai-reviewer/orchestrator.ts
  - src/lib/parsers/ai-reviewer/index.ts
  - src/lib/parsers/ai-reviewer/source-content.ts
  - src/lib/parsers/ai-reviewer/types.ts
  - src/lib/parsers/ai-reviewer/jobs/job-a-hallucination.ts
  - src/lib/parsers/ai-reviewer/jobs/job-b-omission.ts
  - src/lib/parsers/ai-reviewer/jobs/job-c-anchoring.ts
  - src/lib/parsers/ai-reviewer/jobs/job-d-table-fidelity.ts
  - src/lib/parsers/ai-reviewer/jobs/job-e-terminology.ts
  - src/lib/agent-layer/signals.ts
  - src/lib/agent-layer/sop-pack.ts
  - src/lib/agent-layer/synthesis.ts
  - supabase/migrations/00071_focus_editor_walk.sql
  - scripts/apply-phase58-migration.mjs
  - scripts/convert-sops-to-steps.ts
  - scripts/eval-fixtures.mjs
  - scripts/verify-gate-check.tsx
  - scripts/check-bundle-size.ts
  - src/components/focus/FocusWalker.tsx
  - src/components/focus/FocusFrame.tsx
  - src/components/focus/FocusRail.tsx
  - src/components/focus/FocusTopBar.tsx
  - src/components/focus/BrowseDocument.tsx
  - src/components/focus/WalkStep.tsx
  - src/components/focus/ReviewAndSend.tsx
  - src/components/focus/SentPanel.tsx
  - src/components/focus/ResumeCard.tsx
  - src/components/focus/KindChip.tsx
  - src/components/focus/EditorSkeleton.tsx
  - src/components/focus/admin/FocusEditor.tsx
  - src/components/focus/admin/EditDocument.tsx
  - src/components/focus/admin/EditRail.tsx
  - src/components/focus/admin/StepCard.tsx
  - src/components/focus/admin/ThisSopBlock.tsx
  - src/components/focus/admin/PublishBar.tsx
  - src/components/focus/admin/PublishDialog.tsx
  - src/components/focus/admin/AiCheckBanner.tsx
  - src/components/focus/admin/ParseProgress.tsx
  - src/components/focus/admin/annotate/AnnotationEditor.tsx
  - src/components/focus/admin/annotate/annotation-tools.ts
  - src/hooks/useWalk.ts
  - src/hooks/useStepPhotos.ts
  - src/hooks/useFocusSop.ts
  - src/hooks/useFocusAutosave.ts
  - src/hooks/useFocusBack.ts
  - src/hooks/useFindings.ts
  - src/hooks/useParseJob.ts
  - src/hooks/useWorkerSops.ts
  - src/components/admin/UploadDropzone.tsx
  - src/components/admin/ParseJobStatus.tsx
  - src/components/admin/DeleteSopButton.tsx
  - src/components/admin/governance/AdminMachinePanel.tsx
  - src/components/admin/governance/GovernanceQueueRow.tsx
  - src/components/shell/WorkerShell.tsx
  - src/components/shell/RoomBodies.tsx
  - src/components/shell/AdminRoomBodies.tsx
  - src/components/sop/plant/MachinePanel.tsx
  - src/components/sop/plant/NowCard.tsx
  - src/app/(protected)/admin/sops/new/ai/PromptClient.tsx
  - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
  - src/lib/shell/place.ts
  - src/lib/sop/parse-progress.ts
  - src/styles/blueprint-theme.css
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-10-05
**Depth:** standard
**Files Reviewed:** 118
**Status:** issues_found

## Summary

Phase 58 replaces the tabbed SOP page, both walkthroughs and the builder with one focus screen over `sop_focus_steps`, adds `sop_walks` and `sop_ai_findings` (00071), re-keys the publish gate onto steps, forks drafts from published versions and deletes ~220 files. The server surface is, on the whole, well-scoped: every action in `focus-steps.ts`, `findings.ts`, `versions.ts` and `walk.ts` derives org and actor from the session, filters every service-role read and write by the session `organisation_id` and the guard-resolved `sop_id`, and never trusts a fetched row's own org. The 00071 policies restate every `USING` predicate in `WITH CHECK`, there is no sibling SELECT policy without an org conjunct, `sop_focus_steps` and `sop_ai_findings` still have no authenticated write policy, and `resolveFocusTarget` keeps drafts invisible to workers. The AI reviewer nulls model-invented `step_id`s, inserts before it retires, and turns job errors into open findings. The client walk/photo state is keyed to the walk id, `legacyRedirectFor` is UUID-gated and `from` is whitelisted, no mount effect navigates, and the focus components use only declared tokens with no "block" in worker-facing copy.

The verification checklist items below did not hold as stated, and that is where the findings sit:

- **Item 1/4 (server gate, "nothing the client says is read")** -- `sop_walks` carries authenticated INSERT and UPDATE policies on every column, so a worker can write `done` / `acks` / `photos` straight through PostgREST and `submitCompletion` will trust the row. The D-08 sequencing and photo gates are bypassable (CR-01).
- **Item 1 (`recordSignature`)** -- the `role: 'worker'` branch never checks that the completion belongs to the caller; any org member can append a worker signature and a ledger row to a peer's completion (CR-02).
- **Item 3 (`forkDraft` copies every column)** -- six `sops` columns are dropped on the fork, and `sop_image_annotations` (keyed through `sop_images`, invisible to the table census) is not copied (WR-01, WR-02).
- **Item 6 (reviewer)** -- a partial-job run retires every open finding from earlier runs, including findings from jobs that did not run, with no ledger row (WR-03).
- **`editableSop` sibling miss** -- `reparseSop` / `restructureSop` still delete a published SOP's sections (and so its focus steps, by cascade) (WR-04).

## Critical Issues

### CR-01: Workers can write `sop_walks.acks` / `done` / `photos` directly, so the server walk gate and the submit validation are bypassable

**File:** `supabase/migrations/00071_focus_editor_walk.sql:121-149`, `src/actions/walk.ts:13-15`, `src/actions/completions.ts:38-81`
**Issue:** The walk design (D-08/D-09, and the `walk.ts` header: "The server is the gate") routes every acknowledgement, step and photo through `recordWalkStep`, which refuses a step ahead of the current one, refuses a photo-required step without a photo, and only lets hazard/PPE steps carry an ack. `submitCompletion` then says "nothing the client says about steps, hash or photos is read" and builds `step_data`, `step_ack_trace` and `completion_photos` from the walk row. But 00071 grants `authenticated` an INSERT policy and an UPDATE policy on `sop_walks` whose `USING`/`WITH CHECK` only constrain `organisation_id`, `worker_id` and `sop_id` -- every other column (`acks`, `done`, `photos`, `current_step_id`, `sop_version`, `status`) is writable by the row's own worker via the anon key: `PATCH /rest/v1/sop_walks?id=eq.<walkId>` with `{"done": {...every step...}, "acks": {...}, "photos": [{"localId": "<uuid>", "stepId": ..., "storagePath": "<org>/completions/<walkId>/<uuid>.jpg"}]}`. `submitCompletion` then passes: `reviewMissing` and the done check read the forged maps, the photo-path check is a string-shape check (`completions.ts:76-81`) and nothing confirms the object exists in `completion-photos`, so `completion_photos` rows are written for files that were never uploaded. The walk row is also forged with client-chosen timestamps. The pre-58 path already treated client step data as evidence rather than a gate (T-15-02-01); Phase 58 promised to close that and did not. The trust-boundary comment in `walk.ts` and the D-15 note "own-row RLS" describe the row as owned, not as a gate -- these are not the same thing.
**Fix:** Make `sop_walks` server-written only, which the actions already support (every query carries `organisation_id` + `worker_id` filters):
```sql
-- 00072: sop_walks is written only by the server
drop policy if exists "workers_can_start_own_sop_walks" on public.sop_walks;
drop policy if exists "workers_can_update_own_sop_walks" on public.sop_walks;
-- keep "workers_can_view_own_sop_walks" (select) as is
```
```ts
// src/actions/walk.ts -- openWalk / recordWalkStep / startOverWalk: write with the
// service client; the existing .eq('organisation_id', organisationId).eq('worker_id', userId)
// filters stay as the self-enforced scope.
const admin = createAdminClient()
// ...and in the photo branch, confirm the object landed before recording it:
const dir = `${organisationId}/completions/${walkId}`
const { data: listed } = await admin.storage.from('completion-photos').list(dir, { search: `${photo.localId}.${ext}` })
if (!(listed ?? []).some((o) => o.name === `${photo.localId}.${ext}`)) return { error: 'That photo did not finish uploading.' }
```
`getPhotoUploadUrl` can keep its session-client read (SELECT stays). If D-15's "own-row RLS" is to be kept literally, the minimum alternative is column-level: `revoke update on public.sop_walks from authenticated;` with no re-grant (PostgREST updates then fail for workers while the service role is unaffected) -- but dropping the two write policies is the smaller, clearer change. Add a live probe to `tests/phase58/` that mints a worker session and asserts the PATCH is refused.

### CR-02: `recordSignature({ role: 'worker' })` lets any org member sign another worker's completion

**File:** `src/actions/completions.ts:395-454`
**Issue:** `recordSignature` is a `'use server'` export imported by a client component (`CompletionDetailClient.tsx:9`), so it is a POST-reachable endpoint for every signed-in user. The supervisor branch is role-gated, but the worker branch only checks `completion.organisation_id === organisationId` (line 425); it never checks `completion.worker_id === userId`. Any org member can call it with any completion id in the org and append an immutable `sop_completion_signatures` row (`role: 'worker'`, `roster_user_id: <caller>`) plus a `sign_off` decision-ledger row "Signed their completion" against a completion they did not perform. Phase 55 removed the client-supplied `rosterUserId` (CLAUDE.md 2026-10-03) but left the target unchecked. Phase 58 moved the only legitimate worker self-sign server-side (`submitCompletion:160`), so the client no longer has any reason to call this with `role: 'worker'` at all.
**Fix:**
```ts
const { data: completion, error: fetchError } = await admin
  .from('sop_completions')
  .select('id, organisation_id, sop_id, worker_id')
  .eq('id', completionId)
  .single()
// ...
if (completion.organisation_id !== organisationId) return { success: false, error: 'Completion does not belong to your organisation.' }
if (role === 'worker' && completion.worker_id !== userId) {
  return { success: false, error: 'Only the worker who did this walk can sign it.' }
}
```
Better still, since `submitCompletion` is now the only legitimate worker-sign path: move the insert into a plain helper in `src/lib/completions/signature.ts`, have `submitCompletion` call that, and narrow the exported action's schema to `role: z.literal('supervisor')`.

## Warnings

### WR-01: `forkDraft` drops six `sops` columns on the new version

**File:** `src/actions/versions.ts:72-100`
**Issue:** The insert is an explicit field list (the same shape that bit `uploadNewVersion` in Phase 36/40). Comparing it against every `alter table public.sops add column` in `supabase/migrations/`, the fork does not carry: `source_type` (00020 -- the library chip and `FocusSopMeta.source_type`; an `ai` or `blank` SOP's v2 reads as an upload), `all_departments` (00035 -- the visibility flag; a SOP in the overridden state `all_departments=true` with `sop_departments` rows becomes department-restricted on v2, and the library chip changes for every org-wide SOP), `all_departments_pre_override` (00051 -- the restore snapshot, so a later re-follow restores the wrong value), `overall_confidence` and `parse_notes` (00003 -- shown in `admin-sop-list`), and `pipeline_run_id` (00016). The census in `tests/phase58/fork-draft.spec.ts` checks tables that reference `sops(id)`, not the columns of `sops` itself, so nothing catches this.
**Fix:** Add the six columns to the insert payload, and add a column census to the same spec: read every `add column` / `create table public.sops` column name from the migrations, subtract a justified skip-list (`id, created_at, updated_at, published_at, status, version, parent_sop_id, superseded_by, uploaded_by, placement, approval_state, approval_snapshot, review_due_at, last_reviewed_at, last_reviewed_by, fts`), and assert the remainder appears as a key in the `forkDraft` insert object.

### WR-02: `forkDraft` does not copy `sop_image_annotations`, so a forked draft's annotated photos lose their marks

**File:** `src/actions/versions.ts:184-208`; `src/actions/focus-steps.ts:617-655, 662-756`
**Issue:** `sop_image_annotations` is keyed on `sop_images.id`, not `sops.id`, so the table census does not see it. The fork copies `sop_images` rows (new ids) and the step's `image_paths` (which point at the baked file), but no annotation row. On the draft: `getStepAnnotation` returns `null` for the baked path, so "Annotate" opens the baked image as if it were the original and bakes marks on top of marks; "Remove photo" skips the "its marks are lost" confirmation; and `saveAnnotatedStepImage` then creates an annotation whose `sop_image_id` is the baked copy's row, so the real original is never recoverable from the draft. No data is destroyed on the published version, but the editing affordance the phase shipped (58-17) silently degrades on exactly the version an admin will edit next.
**Fix:** In the images block, generate ids up front (`const imageIds = images.map(() => randomUUID())`, map old -> new by array index, same idiom as sections/steps), insert with `id: imageIds[i]`, then:
```ts
const { data: anns } = await db.from('sop_image_annotations')
  .select('sop_image_id, scene, natural_width, natural_height, baked_storage_path, baked_at')
  .eq('organisation_id', orgId).in('sop_image_id', images.map((im) => im.id))
if (anns?.length) await must(db.from('sop_image_annotations').insert(
  anns.map((a) => ({ ...a, organisation_id: orgId, sop_image_id: imageMap.get(a.sop_image_id) }))), 'sop_image_annotations')
```
(select `id` on the images read). Extend the census to tables reachable through `sop_images(id)` / `sop_sections(id)` / `sop_focus_steps(id)`, not only `sops(id)`.

### WR-03: A partial reviewer run retires open findings from jobs that did not run, with no ledger row

**File:** `src/lib/parsers/ai-reviewer/orchestrator.ts:333-345`; `src/app/api/sops/[sopId]/ai-reviewer/route.ts:52-55, 89-99`
**Issue:** `persistFindings` deletes every open `sop_ai_findings` row for the SOP whose `run_id` is not the current run. The route still accepts `{ jobs: [...] }` from the body. `POST { jobs: ['E'] }` on a draft with open A/B/C/D findings runs only the terminology job; if E finds nothing, the run inserts one born-cleared `all_clear` marker and then deletes every A--D finding -- the publish gate (`open_findings`) is now clear, and unlike `clearFinding` nothing was written to the decision ledger. The UI only ever sends `{}` today, but the endpoint is admin-reachable and the per-day cap makes a single targeted call cheap.
**Fix:** Retire only what was re-checked:
```ts
// persistFindings(sopId, organisationId, runId, flags, stepIds, jobsRun)
.delete().eq('sop_id', sopId).eq('organisation_id', organisationId)
.is('cleared_at', null).neq('run_id', runId).in('job', [...jobsRun, 'all'])
```
and pass `jobsRun` (plus `'all'` for the marker rows) from `runReview`. Or drop the `jobs` body parameter from the route altogether -- the editor never uses it.

### WR-04: `reparseSop` and `restructureSop` still rewrite a published SOP; `restructureSop` has no role check

**File:** `src/actions/sops.ts:200-262, 268-314`
**Issue:** Phase 58 made content changes draft-only through `editableSop` in every `focus-steps.ts` and `sections.ts` write, but the two parse re-run actions in the same `src/actions/` tree were not swept (the sibling-miss class, CLAUDE.md 2026-07-29). Both delete `sop_sections` for the SOP (cascading `sop_focus_steps`, `sop_ai_findings` and `standard_attachments` on steps) and flip `status` to `parsing` regardless of the current status. Called on a published SOP (`ParseJobStatus.tsx:83,118` still imports both, `requeueParse` in `useParseJob.ts:52` as well), the live version's steps vanish: in-progress `sop_walks` rows point at deleted step ids, `recordWalkStep` returns "That step is not part of this SOP." for every tap, and `sop_completions.step_data` keys no longer resolve on the activity page. `restructureSop` additionally has no role gate at all (only `userId`), and takes `organisation_id` for the new `parse_jobs` row from the fetched job rather than the session.
**Fix:** After the org check in each: `const open = await editableSop(organisationId, sopId); if ('error' in open) return open` -- but allow `status === 'parsing'`/`'uploading'` too, since a failed job is exactly what these retry (add an `allowParsing` flag to `editableSop`, or check `status === 'published'` explicitly and refuse with `PUBLISHED_MSG`). Add the admin/safety_manager role check and `organisation_id: organisationId` (session) to `restructureSop`.

### WR-05: `useWalk` turns every server refusal into "Check your signal and tap again"

**File:** `src/hooks/useWalk.ts:136, 163`
**Issue:** `complete()` maps any error other than "Add a photo to continue." to `SAVE_ERROR`, and `photo()` maps everything to `PHOTO_ERROR`. The server's other refusals are state problems, not connectivity: "Start the walk again." (the walk was submitted or abandoned in another tab, or started over on a newer version), "That step is not part of this SOP." (the SOP changed under the walk) and "Finish the steps before this one first." (a locked step reached through a stale `stepId`). In all three the worker is told to tap again, taps again, and gets the same line indefinitely; the only exit is a manual reload. The local `walk` is never dropped, so `start()` keeps resuming the dead row.
**Fix:**
```ts
const STALE = new Set(['Start the walk again.', 'That step is not part of this SOP.'])
if ('error' in res) {
  if (STALE.has(res.error)) { setWalk(null); setPhase('browse'); setStepId(null); router.refresh(); return setError(res.error) }
  return setError(res.error === 'Add a photo to continue.' || res.error.startsWith('Finish the steps') ? res.error : SAVE_ERROR)
}
```
(`router.refresh()` from a click handler re-runs the server page so `initialWalk` and the `key` reflect the server's current walk.)

### WR-06: Autosave failure state leaks from one SOP's editor into the next

**File:** `src/hooks/useFocusAutosave.ts:36-40, 114-141`
**Issue:** `pending`, `failures`, `inflight` and `timer` are module-level and not keyed by SOP. The mount effect resets the pill to `idle` and flushes on unmount, but a patch that failed on SOP A stays in `pending`/`failures` (by design: "never dropped"). Open SOP B: the first settled save on B runs `settle()`, which sees `failures.size > 0` and sets `state: 'error', gaveUp: true` -- B's editor shows "Your last change didn't save. Keep this page open" for a change that belongs to A. Any later `send()` on B also fires A's queued patch and then invalidates B's `focus-sop`/`focus-gate` queries. This is the 2026-10-03 cross-record-state class on the admin side.
**Fix:** Scope the module state to the mounted SOP: record `activeSopId` in `useFocusAutosave`'s effect, store `sopId` alongside each pending patch, and in `settle()`/`send()` consider only entries whose `sopId === activeSopId`; on SOP change, flush then drop the previous SOP's failed entries (they were already retried three times and shown as not saved). At minimum, clear `failures` in the mount effect after the final flush so the pill is per-SOP.

### WR-07: Walk-step photo retake and draft delete leave orphaned storage objects

**File:** `src/actions/walk.ts:127-135`; `src/app/api/sops/[sopId]/route.ts:83-99`
**Issue:** `recordWalkStep` (`action: 'photo'`) replaces the step's entry in `walk.photos` but never removes the previous object from `completion-photos`; every retake leaves an unreferenced file under `{org}/completions/{walkId}/`. On the admin side, `DELETE /api/sops/[sopId]` removes `{org}/{sop}/original/*` and `{org}/{sop}/images/*` but not `{org}/{sop}/steps/**` (editor-uploaded step photos and baked annotation copies from `getStepImageUploadUrl`), so deleting a draft that had photos added in the focus editor strands them. Neither is a correctness bug for the worker, but the bucket grows with every retake and every abandoned draft, and nothing can ever find those paths again.
**Fix:** In the photo branch, after a successful update: `const prev = walk.photos.find((p) => p.stepId === stepId); if (prev && prev.storagePath !== photo.storagePath) void admin.storage.from('completion-photos').remove([prev.storagePath])` (service client). In the DELETE route, add a third sweep over `${org}/${sopId}/steps` (recursive: list per step dir) before the row delete.

## Info

### IN-01: `step_data` values changed meaning; the validator and schema docs still say `step_number`

**File:** `src/actions/completions.ts:68-69`; `src/lib/validators/completions.ts:9-24`; `src/actions/introspection.ts`
**Issue:** `submitCompletion` now writes `stepData[step.id] = Date.parse(walk.done[step.id])` (epoch ms). `StepDataSchema`'s doc block, the file header and the `/api/schema` surface still describe the value as the step's `step_number` (integer). The activity page only reads keys so nothing breaks, but the "externally-consumable" schema is now wrong.
**Fix:** Update the comments to "epoch ms the step was done" and reflect it in `introspection.ts`'s completion description.

### IN-02: Publish-gate counts on `sop_ai_findings` are silently 0 for non-admin editors

**File:** `src/actions/publish-gate.ts:27-31`; `src/lib/governance/publish-core.ts:70-74`
**Issue:** Both count findings with the session client, and 00071's only SELECT policy on `sop_ai_findings` is `admin`/`safety_manager`. A chain-approver editor sees `ready: true` in the bar while findings are open (cosmetic -- no Publish button for them), and `performPublish` via `approveStep` (session client of the approver) would skip the findings gate for a non-admin final approver; that path is stopped only by the unrelated `sops` UPDATE policy returning zero rows (409). The gate's correctness depends on a policy on a different table.
**Fix:** Count with `createAdminClient()` filtered by the session `organisation_id`, or add a read policy arm for approvers. Document which one.

### IN-03: An admin can hold two in-progress walks on one lineage; the page then picks `walks[0]` arbitrarily

**File:** `src/app/(protected)/sops/[sopId]/page.tsx:71-97`; `src/actions/walk.ts:57-74`
**Issue:** `resolveFocusTarget` opens the exact row for admins, and the unique index is per `(worker_id, sop_id)`, so an admin with an in-progress walk on v1 who opens v2 and taps Start gets a second in-progress row. `inProgressSopId: walks[0]?.sop_id` and `walks.find((w) => w.sop_id === target.id)` are then order-dependent. Workers cannot reach this (they are redirected to the walking version).
**Fix:** In `openWalk`, before insert, abandon any other `in_progress` walk the worker holds on the same lineage (one query on `sop_walks` with `.in('sop_id', lineageIds)`), or pick the newest `updated_at` on the page.

### IN-04: `notifyAssignedWorkers` is now called on every supersede but its write is unscoped and unchecked

**File:** `src/actions/versioning.ts:260-264`; `src/lib/governance/publish-core.ts:184-193`
**Issue:** Pre-existing, newly load-bearing: the service-role `sop_assignments` update is filtered by `sop_id` only (no `organisation_id`), its error is not read, and `organisationId` comes from the fetched `newSop` row. Cross-org misuse is stopped by the session-client `assignments` read returning nothing, and a unique-violation on the new SOP's existing assignments would be swallowed, leaving the old version's assignments in place. Workers still resolve to the latest version through the lineage rule, so the symptom is only a stale assignment row.
**Fix:** `.eq('organisation_id', organisationId)` on the update, check `error`, and derive `organisationId` from the session (the function already has it from `getSessionContext`).

### IN-05: `persistFindings` retire query can never match a finding with `run_id` null

**File:** `src/lib/parsers/ai-reviewer/orchestrator.ts:338-345`
**Issue:** `.neq('run_id', runId)` is `run_id <> $1`, which is NULL for rows whose `run_id` is NULL -- those rows are never retired. Every writer today sets `run_id`, so this is latent, but the column is nullable and `clearFinding` is the only other path.
**Fix:** `.or(\`run_id.is.null,run_id.neq.${runId}\`)`, or make `run_id` `not null` in a follow-up migration.

### IN-06: Tick and a pending text edit can race; the card self-corrects only after the next refresh

**File:** `src/components/focus/admin/StepCard.tsx:150-154`; `src/hooks/useFocusAutosave.ts:96-101`
**Issue:** `toggleTick` calls `tickFocusStep` immediately while a text/tip patch may still be in the 750 ms debounce. Server order is then tick -> text update -> trigger clears the tick; the card shows "Checked" until `afterSave`'s `refresh` lands. Correct on the server, briefly wrong on screen.
**Fix:** `await flush()` (expose it from `useFocusAutosave` to the card, or via `queue`'s return) before calling `tickFocusStep`.

---

_Reviewed: 2026-10-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
