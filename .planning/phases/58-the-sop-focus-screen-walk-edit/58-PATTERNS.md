# Phase 58: The SOP Focus Screen - Walk & Edit - Pattern Map

**Mapped:** 2026-10-05
**Files analyzed:** 22 new/modified groups
**Analogs found:** 20 / 22 (two partial: step-image upload action, forkDraft census spec)

Notes that bite:
- The Phase 57 lazy admin seam is `OneScreen.tsx` (`next/dynamic({ ssr:false })` over `AdminShell`), not `AdminSopSurface` (gone). The focus editor copies that exact fork.
- `sop_focus_steps` has NO authenticated write policy (00069 line 104). Every step write is a service-role action with self-enforced session-org scope.
- `requireSopEditAccess` resolves only `{sopId}|{sectionId}|{junctionId}`. Add `{stepId}` as a fourth arm in the same function (guards.ts 57-108); never write a second lookup.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/00071_focus_editor_walk.sql` | migration | CRUD | `00069_sop_kinds_placement_standards.sql`, `00070_decisions_ledger.sql` | exact |
| `scripts/apply-phase58-migration.mjs` | script | batch | `scripts/apply-phase56-migration.mjs` | exact |
| `src/actions/walk.ts` (`startWalk`, `recordWalkStep`, abandon) | server action | CRUD | `src/actions/completions.ts` (`submitCompletion`, `getPhotoUploadUrl`) | role-match |
| `src/actions/completions.ts` `submitCompletion` hardened + `recordSignature` call | server action | CRUD | itself (lines 24-120, 341-380) | exact |
| `src/actions/focus-steps.ts` (step/section edit, tick, objective, jump flag) | server action | CRUD | `src/actions/standards.ts` + `requireSopEditAccess` in `src/lib/auth/guards.ts` | role-match |
| `src/actions/findings.ts` `clearFinding` | server action | CRUD | `verifyBlock` in `src/actions/sop-section-blocks.ts:78-116` | exact |
| `src/actions/versions.ts` `forkDraft` | server action | CRUD | `cloneSopAsDraft` in `src/actions/versioning.ts`, `src/lib/builder/version-lineage.ts` | role-match |
| `src/lib/sop/focus.ts` (walk order, unlock, review) | utility (pure) | transform | `src/lib/sop/sections.ts` | exact |
| `src/lib/sop/focus-path.ts` (`focusHref`, `backHref`, legacy map) | utility (pure) | transform | `src/lib/shell/place.ts` | exact |
| `src/lib/sop/lineage-current.ts` | utility (pure) | transform | `src/lib/competency/lineage.ts` header + RESEARCH sketch | role-match |
| `src/lib/sop/focus-write.ts` (pipelines write steps via `convertSop`) | service (plain) | batch | `scripts/convert-sops-to-steps.ts` + `src/lib/sop/convert.ts` | role-match |
| `src/app/(protected)/sops/[sopId]/page.tsx` (server resolver) + `loading.tsx` | page (RSC) | request-response | `src/app/page.tsx` (57) + `(protected)/layout.tsx` | role-match |
| `src/components/focus/FocusFrame.tsx` (+ worker shell fork) | component | event-driven | `src/components/shell/OneScreen.tsx` | exact |
| `src/components/focus/{FocusTopBar,FocusRail,BrowseDocument,WalkStep,ReviewAndSend}.tsx` | component | event-driven | `src/components/sop/walkthrough/MobileWalkthrough`, `src/hooks/useStepPhotos.ts`, `MachineBody` | role-match |
| `src/hooks/useWalk.ts`, `useFocusSop.ts` | hook | request-response | `src/hooks/useStepPhotos.ts`, `useWorkerSops` | role-match |
| `src/components/focus/admin/{EditDocument,StepCard,AiCheckBanner,PublishBar,PublishDialog,ThisSopBlock,ParseProgress}.tsx` | component | CRUD | `builder-v2/InlineText.tsx`, `EditableDocument.tsx`, `ParseJobStatus.tsx`, `BuilderStandardsButton.tsx` | role-match |
| `src/hooks/useFocusAutosave.ts` | hook | event-driven | `src/hooks/useBuilderAutosave.ts` | exact |
| `src/lib/governance/publish-core.ts` gate re-key | service | request-response | itself, `tests/phase56/publish-gate-pin.spec.ts` | exact |
| `src/lib/parsers/ai-reviewer/orchestrator.ts` step re-key | service | request-response | itself (220-285) | exact |
| `src/lib/supabase/middleware.ts` legacy redirects | middleware | request-response | itself (62-83, Phase 57) | exact |
| `src/lib/shell/place.ts` `placeForPath` null for `/sops/*` | utility | transform | itself (47-55, `/pending` null) | exact |
| `tests/phase58/*.spec.ts`, `tests/phase41/bundle-gate.spec.ts`, `tests/phase55/deletion-sweep.spec.ts` | test | transform | `tests/phase57/retirement-sweep.spec.ts`, `tests/phase56/publish-gate-pin.spec.ts` | exact |
| `tests/evals/sop-focus.eval.ts`, `scripts/eval-fixtures.mjs` | test | request-response | `tests/evals/one-screen.eval.ts` | exact |
| `journeys.ts`, `uat/tests.ts`, `CAPABILITY-MATRIX.md`, `decision-writers.json`, `dropped-features.json` | config | - | same files (existing entries) | exact |

## Pattern Assignments

### `supabase/migrations/00071_focus_editor_walk.sql` (migration, CRUD)

**Analog:** `00069_sop_kinds_placement_standards.sql`

Header idiom (lines 21-32): double-quoted policies, org conjunct on every arm, WITH CHECK restates USING, no elevated-privilege function, idempotent. Do not quote the forbidden phrase literally in new comments (CLAUDE.md 2026-09-28); say "no elevated-privilege function".

Table + RLS (00069:76-111):
```sql
create table if not exists public.sop_focus_steps (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  ...
  source_key text not null,
  run_id uuid not null,
  unique (section_id, source_key),
  unique (id, organisation_id)
);
alter table public.sop_focus_steps enable row level security;
drop policy if exists "org_members_can_view_sop_focus_steps" on public.sop_focus_steps;
create policy "org_members_can_view_sop_focus_steps"
  on public.sop_focus_steps for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (select 1 from public.sops s where s.id = sop_focus_steps.sop_id)
  );
```
Apply for 00071: `alter table ... add column if not exists` for `verified_by_admin_id`, `verified_at`, `needs_recheck`; `alter column run_id drop not null`; `source_key` default `'edit:' || gen_random_uuid()::text`; `sops.objective`, `sops.allow_forward_jump`. `sop_walks` own-row policy: `organisation_id = public.current_organisation_id() and worker_id = auth.uid()` in BOTH `using` and `with check`. `sop_ai_findings`: admin/safety_manager read only, no authenticated write (copy admin-read arm from 00069:136-142 / 00070:83-89):
```sql
using (
  organisation_id = public.current_organisation_id()
  and public.current_user_role() in ('admin', 'safety_manager')
);
```
Tick-clearing trigger: copy the shape of 00069's `sync_placement` function (plpgsql, `set search_path = public, pg_temp`, invoker) and migration 00032's `clear_block_verification_on_content_change`. Fire on `text|kind|tip|photo_required|image_paths` change only.

### `scripts/apply-phase58-migration.mjs` (script, batch)

**Analog:** `scripts/apply-phase56-migration.mjs`

- `MIGRATION_FILES` array (33-37), later corrective migrations appended in order (CLAUDE.md 2026-07-28).
- `.env.local` loader (42-51), `managementSql()` (68-78) POSTing `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`.
- `db push` first, Management-API fallback (93-111), `--assert-only` flag (91).
- PGRST205-aware `assertSql` (123-147):
```js
msg.includes('PGRST205') || msg.includes('schema cache')
  ? `PGRST205 stale schema cache (NOT a missing object): ${msg}`
```
- Existence via `to_regclass` + `relrowsecurity` (158-166), policy count (167-171), policy-text pins (175+): pin every clause (org conjunct, `worker_id = auth.uid()` in with_check). End with `NOTIFY pgrst, 'reload schema'`. Check `supabase migration list` before `db push` (CLAUDE.md 2026-10-04).

### `src/actions/focus-steps.ts` (server action, CRUD)

**Analogs:** `src/actions/standards.ts` (shape), `src/lib/auth/guards.ts:22-130` (guards).

Imports + header contract (`standards.ts:18-28`), `'use server'`, async exports only:
```ts
'use server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminContext } from '@/lib/auth/guards'
import { z } from 'zod'
```
Per-export skeleton (`standards.ts:65-87`):
```ts
const ctx = await requireAdminContext()
if ('error' in ctx) return { error: ctx.error }
const orgId = ctx.organisationId
if (!orgId) return { error: 'No organisation' }
const parsed = createStandardSchema.safeParse(input)
if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
```
Differences for step writes: `standards.ts` writes with the session client (it has write policies). `sop_focus_steps` does not, so use `createAdminClient()` and put `.eq('organisation_id', ctx.organisationId)` on every write (CLAUDE.md 2026-06-15). Content edits use `requireSopEditAccess({ stepId })` (extend `SopEditTarget`, guards.ts:57-60, 84-108: add an arm resolving step -> section_id -> sop through admin client, then the existing session-org `sops` filter at 113-119). Tick/untick/clear/publish/fork use `requireAdminContext()` (guard comment lines 40-45: publish, verify, delete, version stay admin-only). No `organisationId`/`userId`/`agent` parameters on any schema (CLAUDE.md 2026-09-30).

### `src/actions/findings.ts` `clearFinding` (server action, CRUD)

**Analog:** `verifyBlock`, `src/actions/sop-section-blocks.ts:78-116`

Core pattern to re-key (finding id instead of block id; SOP and org resolved server-side):
```ts
const ctx = await requireAdmin()
if ('error' in ctx) return { ok: false, error: ctx.error }
...
await recordDecision({
  kind: n > 0 ? 'ai_finding_cleared' : 'verify',
  subject: { kind: 'section_block', id: blockId },
  sopId,
  summary: n > 0 ? `Checked a section and cleared ${n} AI finding...` : 'Checked a section before publishing',
  details: n > 0 ? { junction_id: blockId, flags } : { junction_id: blockId },
})
```
New: `subject: { kind: 'ai_finding', id }`; tick of a step records `verify` with `subject: { kind: 'focus_step', id }`. Resolve `sopId` from the finding row filtered by session org. Register both writers in `scripts/decision-writers.json`: the existing `columnKeys` entry `{ table: "sop_section_blocks", token: "verified_by_admin_id:" }` becomes `sop_focus_steps`, and add a `tables` entry for `sop_ai_findings` (`entries` shape: `{ file, function, status: "hook", key, kind, plan }`). `tests/phase56/decision-writers-sweep.spec.ts` enforces it.

### `src/actions/walk.ts` + hardened `submitCompletion` (server action, CRUD)

**Analog:** `src/actions/completions.ts`

Session + admin client + org-scoped retry-safe write (24-37, 53-76):
```ts
const { userId, organisationId } = await getSessionContext()
if (!userId) return { success: false, error: 'Not authenticated' }
if (!organisationId) return { success: false, error: 'No organisation found' }
const admin = createAdminClient()
```
Photo path shape guard to keep verbatim (39-46):
```ts
const photoPrefix = `${organisationId}/completions/${localId}/`
const validPhotoPath = (p) => p.storagePath === `${photoPrefix}${p.localId}.jpg` || p.storagePath === `${photoPrefix}${p.localId}.png`
```
Retry-safe: `isRetry = insertError?.code === '23505'`, re-check `existing.worker_id !== userId || existing.organisation_id !== organisationId` (84-91). New: `submitCompletion` loads the `sop_walks` row (filtered by session org AND `worker_id = userId`), recomputes `stepData`, `contentHash`, photos server-side, refuses if a hazard/PPE ack or required photo is missing, inserts with `id = walk.id`, marks the walk `submitted`. Remove client-supplied `stepData` and `stepAckTrace` params (CLAUDE.md 2026-10-03: drop parameters only the deleted flow supplied). `getPhotoUploadUrl` (294-327) is unchanged; `completionLocalId` becomes `walk.id`. After submit call `recordSignature({ completionId, role: 'worker' })` (341-380; org check at 362-373 is the model for every walk write: fetch, compare to session org, then write).

### `src/actions/versions.ts` `forkDraft` (server action, CRUD)

**Analog:** `cloneSopAsDraft` in `src/actions/versioning.ts`; lineage via `computeNextVersionLineage` in `src/lib/builder/version-lineage.ts:12`.
Pattern notes: `requireAdminContext`, fetch source filtered by SESSION org, reuse an open draft of the lineage if one exists, copy EVERY `sop_id`-keyed table (sections, focus steps, `sop_images`, `standard_attachments` at three levels with remapped ids, `sop_machines`, `sop_departments`, `sops_sub_trades`, owner/cadence/category, objective, `allow_forward_jump`). Pin it with a census spec that enumerates `references public.sops(id)` across `supabase/migrations` (CLAUDE.md 2026-07-29). Called from a button (user event), never a mount effect.

### `src/lib/sop/focus.ts` (utility, transform)

**Analog:** `src/lib/sop/sections.ts` (plain module, one classifier, header explains why)
```ts
/**
 * One place that answers "what kind of section is this?" ...
 * Plain module - no React, no 'use client'.
 */
export const isPpeSection = (s: Section) => has(s, PPE_KEYWORDS)
```
Copy: header comment naming the drift it prevents, exported pure predicates/selectors over `FocusStepDraft`-shaped rows (`kind` from `src/lib/sop/convert.ts:22` `StepKind`). Exports: `walkOrder(steps)` (hazard/ppe first, then sections in sequence, D-07), `isUnlocked(stepId, done, allowForward)`, `reviewMissing(...)`, `kindLabel`. Rail numbering is per section; "Step n of N" is the walk index (`step_number` is never an id, CLAUDE.md 2026-09-27). `scopeSopToJob`/`procedureSections` (sections.ts 30-60) are retired with the old walkthrough.

### `src/lib/sop/focus-path.ts` (utility, transform)

**Analog:** `src/lib/shell/place.ts:17-41`
```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parsePlace(token: string | null | undefined): Place {
  if (!token) return { kind: 'overview' }
  ...
  return { kind: 'overview' }
}
export function formatPlace(place: Place): string { switch (place.kind) { ... } }
```
Copy: whitelist-only, raw token never carried into the result. `backHref(from) = formatPlace(parsePlace(from))`; add `placeToken(place)` (inverse) so entry points emit `?from=`; `focusHref(id, { mode?, from? })` emits only UUID-validated ids and a token that round-trips through `parsePlace`; `legacyRedirectFor(path, search)` pure mapping used by the proxy. Unit-test with static `@/` imports (never dynamic `import('@/...')`, CLAUDE.md 2026-06-24).

### `src/lib/sop/lineage-current.ts` (utility, transform)

**Analog:** `src/lib/competency/lineage.ts:1-60` (header doctrine, plain module, `parent_sop_id ?? id` root, "Currency is never derived from `superseded_by`", lines 20-22) and RESEARCH Code Examples (`latestPublished`, `lineageRoot`). Consumers: SOP page resolver, `useWorkerSops`, `listSiteForWorker` (`site-worker.ts` ~114), `observations.ts:317`.

### `src/lib/sop/focus-write.ts` (service, batch) and pipeline routes

**Analog:** `convertSop` / `planFocusStepWrites` in `src/lib/sop/convert.ts:318, 597`; `scripts/convert-sops-to-steps.ts`.
Call `convertSop({ sopId, sections, sopImagePaths })` over in-memory `Section[]` built from the real inserted section ids; insert drafts with `source_key = 'new:' || uuid` and `organisation_id` from the session. Stop writing `layout_data` and junctions in `api/sops/parse`, `ai-prompt`, `transcribe`, `restructure`, `createSopFromWizard` (CLAUDE.md 2026-07-07 trio rule collapses to sections + focus steps). `scripts/convert-sops-to-steps.ts --apply` must exit 1 with "converter retired in Phase 58" (spec-pinned); add `--missing` mode; never touch `new:`/`edit:` keys.

### `src/app/(protected)/sops/[sopId]/page.tsx` + `loading.tsx` (RSC, request-response)

**Analogs:** `src/app/page.tsx` (57 session branch) and `(protected)/layout.tsx` (providers live only in the layout; use `getSessionContext()`).
```tsx
const { userId, userEmail, role: memberRole } = await getSessionContext()
if (!userId) { redirect('/login') }
```
Resolver rules in the server component only: worker + draft/unknown -> `notFound()`; worker + superseded -> `redirect()` to latest via `lineage-current`; admin gets the exact row; no navigation or mutation from a mount effect (CLAUDE.md 2026-09-29). Replaces the current 151-line client page (imports at lines 1-13: `useSopDetail`, `SopTabNav`, `ReadTab`, `WalkthroughSwitcher` all deleted). Keep `loading.tsx` as a frame-shaped skeleton. `(protected)/layout.tsx:20` renders `<BackToSite />`; make `placeForPath` return `null` for `/sops/*` (place.ts:47-55 already returns null for `/pending`) so the focus top bar owns the screen.

### `src/components/focus/FocusFrame.tsx` + lazy editor seam (component, event-driven)

**Analog:** `src/components/shell/OneScreen.tsx:1-27`
```tsx
const AdminShell = dynamic(() => import('@/components/shell/AdminShell').then((m) => m.AdminShell), {
  ssr: false,
  loading: SHELL_LOADING,
})
export function OneScreen(props: ShellProps) {
  const isAdmin = useIsAdmin()
  return isAdmin ? <AdminShell {...props} /> : <WorkerShell {...props} />
}
```
Copy: static import of the worker walk (browse/walk/review) so the gate measures real first download; editor, `ParseProgress` and (if the optional wave lands) Konva only inside `dynamic(..., { ssr:false })`, referenced nowhere else. `/sops/[sopId]/page` baseline 795 +/-2 (`.bundle-baseline.json:56`); baselines move DOWN by hand with a history note, never up (CLAUDE.md 2026-09-13/2026-10-05). Walk <-> Edit admin switch via `window.history.replaceState` + local state (A1), never `router.push('?mode=')` (CLAUDE.md 2026-05-13).

### Walk components + `useWalk` (component/hook)

**Analog:** `src/hooks/useStepPhotos.ts:15-70`
```ts
export function useStepPhotos(activeCompletionId: string | undefined) {
  const [allPhotos, setPhotos] = useState<StepPhoto[]>([])
  const photos = useMemo(() => allPhotos.filter((p) => p.completionId === activeCompletionId), [allPhotos, activeCompletionId])
  ...
  const result = await getPhotoUploadUrl({ localId, contentType: 'image/jpeg', completionLocalId: completionId })
```
Keep the hook; key it to `walk.id`. `completionStore` (`src/stores/completionStore.ts:11-19`: `localId`, `stepCompletions`) becomes a cache of server state or is deleted; the second walk in one session must not inherit the first (CLAUDE.md 2026-10-03, eval walks twice). Tokens/size classes: take row/panel markup from `MachineBody` in `src/components/sop/plant/MachinePanel.tsx`; 60 px button = `tap-glove`; add `--text-step` to `blueprint-theme.css` `@theme` and the token loop in `tests/lint/design-tokens.spec.ts`.

### Editor components + `useFocusAutosave` (component/hook, CRUD)

**Analogs:** `src/components/admin/builder-v2/InlineText.tsx`, `src/hooks/useBuilderAutosave.ts`, `ParseJobStatus.tsx`, `BuilderStandardsButton.tsx`.

InlineText (re-home as-is): uncontrolled, seeds `textContent` once, commits on blur, never `innerHTML` (XSS, header comment lines 5-12). Autosave to copy (13-15, 18-30, 69-79, 87-123): 750 ms debounce, `RETRY_MS = 5_000`, `MAX_RETRIES = 3`, zustand `useBuilderSaveStatus` for the "Saved/Saving/Not saved" pill, flush on `pagehide`/`visibilitychange`; re-key `saveLayout(sectionId, data)` to a step-action call (`updateFocusStep({ stepId, patch })`) and drop the `server_newer` LWW branch unless the action reintroduces it. Parse progress: reuse the `ParseJobStatus` realtime + 3-timer polling watchdog (`shouldStartPolling`, `PLAIN_STAGES`/`STAGE_SETS` in `src/lib/admin/job-stages.ts`); steps swap in place with no route change; ETA heuristic per D-19. Relocate `BuilderMachinesButton`/`BuilderStandardsButton`/`BuilderCategoryButton` (portaled modal, Escape closes, `BuilderStandardsButton.tsx:1-40`) out of `admin/sops/builder/[sopId]/` into `src/components/focus/admin/` before that directory is deleted. Ticks: no tick-all control (`tests/lint/no-bulk-verify-ui.spec.ts` stays green).

### `src/lib/governance/publish-core.ts` gate re-key (service, request-response)

**Analog:** itself, lines 41-106 (body hash-pinned), 124-185 (`performPublish`).

Current shape to replace (one named task "re-key the gate and re-pin", D-16):
```ts
export async function assertPublishGates(supabase: Supabase, sopId: string): Promise<PublishGateResult> {
  ... unapprovedCount (sop_sections.approved=false) ...
  const verifyGateApplies = sourceType !== 'ai_prompt' && !!sourceFilePath
  ... .from('sop_section_blocks')...is('verified_by_admin_id', null) -> { error: 'unverified_blocks', status: 400, count }
```
New body: count `sop_focus_steps` for the SOP (>=1), `verified_by_admin_id is null` count -> keep the `unverified_blocks`-style error code decision explicit in the spec, and `sop_ai_findings` with `cleared_at is null`; section-approved and ai_prompt bypass removed. Keep `performPublish` gate-before-first-write order (spec `tests/phase56/publish-gate-pin.spec.ts:36-42`) and its fail-soft `recordDecision({ kind: 'publish', ... })` (176-185). Add `notifyAssignedWorkers(old, new)` when `parent_sop_id` is set (F5). Pin idiom to re-pin once with the decision in the header:
```ts
const PUBLISH_GATE_SHA256 = '43cd12ec...'
function bodyOf(decl: string) { ... src.indexOf('\nexport ', start + 1) ... }
expect(createHash('sha256').update(body).digest('hex')).toBe(PUBLISH_GATE_SHA256)
```
Any new import in `publish-core.ts` must be added to the `Module._load` stub list in `scripts/verify-gate-check.tsx` (`recordDecision` imports `server-only`, CLAUDE.md 2026-10-04). Repoint in the same commit: `tests/builder/builder-review-flow.spec.ts`, `tests/phase26/spine-regression.spec.ts`, `tests/phase29/publish-core-extraction.spec.ts`, `tests/phase29/publish-chain-gate.spec.ts`, `tests/phase40/spine-freeze.spec.ts`, plus `getPublishGateStatus` parity.

### `src/lib/parsers/ai-reviewer/orchestrator.ts` step re-key

**Analog:** itself, 220-285. Source is the cached block; add the draft as a second NON-cached user block:
```ts
const cachedSourceBlock = {
  type: 'text' as const,
  text: `SOURCE CONTENT:\n${sourceText}`,
  cache_control: { type: 'ephemeral' as const },
}
...
const response = (await anthropic.messages.create({ model: VERIFY_MODEL, max_tokens: job.maxTokens, system: [{ type: 'text', text: job.systemPrompt }], ...
```
Add `{ type:'text', text: 'DRAFT STEPS:\n' + JSON.stringify([{ step_id, section, kind, text }]) }` after it; each job's JSON and `parseResponse` returns `step_id` instead of `block_id`; persist to `sop_ai_findings`. Blank SOP (no parse job): run jobs D and E only (D-17). Fail-open synthetic-flag behaviour stays; job E vocab (`fetchOrgVocabulary`, 235-247) switches to focus steps. Route `api/sops/[sopId]/ai-reviewer/route.ts` loses the `no_parse_job` 404 for blank SOPs.

### `src/lib/supabase/middleware.ts` legacy redirects (middleware)

**Analog:** itself, lines 62-83 (Phase 57 block). Copy:
```ts
const SOP_ID = /^[0-9a-f]{8}-.../i   // line 6
const redirect = NextResponse.redirect(new URL(destination, request.url))
response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
return redirect
```
Add a sibling block: `/sops/<uuid>` with `tab` in {walk, read} -> `/sops/<uuid>`; `/admin/sops/builder/<uuid>` and `/admin/sops/<uuid>/versions` -> `/sops/<uuid>?mode=edit`. Destination is a template over the UUID-tested id only. Never a client `router.replace` (CLAUDE.md 2026-09-29). Also retarget the `next.config.ts` `/admin/sops/:sopId/review` redirect. Put the mapping in `focus-path.ts` so it is unit-testable.

### Specs (test)

**Analogs:** `tests/phase57/retirement-sweep.spec.ts:13-34` (helpers) and `repoint-inventory.spec.ts` (RETIRED tokens, INVENTORY with `delete|repoint`, LIVE_PLANS).
```ts
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
function stripComments(src: string): string { ... }
function walkSrc(dir: string, out: string[] = []): string[] { ... }
```
Negative assertions that quote a retired literal live in the retirement sweep (the inventory walk excludes that folder). Assert absence of REFERENCES, not just the file (CLAUDE.md 2026-08-04). Register `phase58` in `playwright.config.ts` next to `phase56`/`phase57` and confirm with `npx playwright test --list --project=phase58` (CLAUDE.md 2026-05-25). `scripts/dropped-features.json` entry shape (`{ feature, phase, kind: "file", path }`) and `LIVE_FEATURES` in `tests/phase55/deletion-sweep.spec.ts`; the optional annotation wave removes the `annotation` entries from both.

### `tests/evals/sop-focus.eval.ts` + `scripts/eval-fixtures.mjs`

**Analog:** `tests/evals/one-screen.eval.ts:1-70`: header (assert by NAME, `SLOW`, comments describe retired URLs in words), imports from `./lib/session` (`EVAL_ENV_READY`, `signInAs`) and `./lib/plant-fixture` (`ensurePlantFixture`, `shot`, `watchConsole`, `REAL_SOPSTART_ORG_ID`), `test.skip(!EVAL_ENV_READY, ...)`, `test.use({ viewport: { width: 1440, height: 900 } })`, service-client `beforeAll` that refuses the real org id. Extend `eval-fixtures.mjs` (walk fixture upsert pattern at lines 206-270, idempotent select-then-update/insert by key) with focus-step rows, a draft with ticks and open findings, a blank SOP, a v3/v4 lineage, `processing` and `failed` `parse_jobs`. Walk twice in one session; assert `toHaveCount(1)` before click timeouts (CLAUDE.md 2026-09-28).

### Config / maps (same-commit)

- `src/lib/journeys/journeys.ts`: `JourneyStep.route` must be a real route (lines 15-26); rewrite the ~16 builder/tab/versions references (RESEARCH list).
- `.planning/codebase/CAPABILITY-MATRIX.md`: add rows (walk/browse per role, Walk <-> Edit switch, jump-ahead write, version browse read, tick/clear/publish, fork, step edit by approvers); legend symbols at lines 23-28; state that D-13 draft refusal is enforced by the page, not RLS (Pitfall 7).
- `scripts/decision-writers.json`: see `clearFinding` above.

## Shared Patterns

### Server-action guard + org scope
**Source:** `src/lib/auth/guards.ts:22-29, 71-119`
**Apply to:** every new action (`walk`, `focus-steps`, `findings`, `versions`)
Role and org from `getSessionContext()` only; service-role writes carry `.eq('organisation_id', ctx.organisationId)`; the org predicate is never read off the fetched row (guards.ts 47-54, CLAUDE.md 2026-07-28). No client-supplied trust flags.

### Ledger write
**Source:** `src/lib/decisions/record.ts:21-47`
**Apply to:** tick, `clearFinding`, publish, Send for sign-off
```ts
await recordDecision({ kind, subject: { kind, id }, sopId, summary, details })
```
Org and actor from session, fail-soft, called after the primary write. Plain module importing `server-only`: add to stub lists of harnesses that load the touched path.

### `'use server'` rule
**Source:** `src/actions/standards.ts:14-16`
Async exports only; pure helpers go in plain modules (`focus.ts`, `focus-path.ts`, `lineage-current.ts`, `focus-write.ts`). A guard that bans an admin-client import in an action file means the privileged read belongs in a plain module (CLAUDE.md 2026-10-04).

### URL state
**Source:** `src/lib/shell/place.ts` + proxy block `middleware.ts:62-83`
Whitelist tokens, fixed destinations, server-side redirects, `history.replaceState` for hot-path state.

### Tokens / lint
**Source:** `src/styles/blueprint-theme.css`, `tests/lint/design-tokens.spec.ts`
Tokens only, radius vocabulary of four, `min-h-tap`/`tap-glove`; after the first build grep `.next/static/css/*.css` for `text-step`, `max-w-205`, `w-75`, `bg-accent-signoff`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Step-image upload action (admin attaches a photo to a step, writes `sop_images` row + appends `image_paths`) | server action | file-I/O | Old builder `MediaGrid` only displayed images; model on `getPhotoUploadUrl` (completions.ts:294-327) for signed upload, add type/size/org-prefix validation and the A-06 rule that `image_paths` equals an existing `sop_images.storage_path` |
| Konva annotation (optional final wave, F1) | component | event-driven | Deleted in Phase 55-10 (`6eb04d2d`); rebuild from git history (`52b40a6f`, `6eb04d2d^`), un-drop in `dropped-features.json` + `LIVE_FEATURES`, widen `tests/phase26/konva-worker-isolation.spec.ts` |
| Fork census spec (every `references public.sops(id)` table) | test | transform | No existing migration-enumerating copy-coverage spec; closest idiom is `tests/lint/rls-org-scope.spec.ts` (parses all migrations in order) |

## Metadata

**Analog search scope:** `src/actions`, `src/lib/{auth,governance,sop,shell,competency,decisions,parsers/ai-reviewer,supabase}`, `src/components/{shell,admin/builder-v2,admin,sop}`, `src/hooks`, `supabase/migrations`, `scripts`, `tests/{phase56,phase57,evals}`
**Files read:** ~25 (plus planning docs)
**Pattern extraction date:** 2026-10-05
