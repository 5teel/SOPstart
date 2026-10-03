# Phase 56: A Simpler SOP & the Decision Ledger - Pattern Map

**Mapped:** 2026-10-04
**Files analyzed:** 20 new/modified (per 56-RESEARCH "Recommended Structure" + D-08/A-04 writers + D-10 display surfaces)
**Analogs found:** 18 / 20 (two partial; one no-analog item)

Amendments applied: A-01 (generated rows live in a NEW table `sop_focus_steps`, NOT `sop_steps` - so RESEARCH's `converted_from is null` reader-filter work and `tests/lint/no-unfiltered-step-reads.spec.ts` are NOT needed), A-03 (seven backfill sources), A-04 (writer list), A-07 (`sop_conversion_runs`), A-08 (fail-soft `recordDecision`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/00069_*.sql` (focus steps, conversion runs, `sops.placement` + trigger, standards + attachments + seed) | migration | CRUD | `supabase/migrations/00067_site_model.sql` | exact |
| `supabase/migrations/00070_decisions_ledger.sql` (table, append-only triggers, backfill, RPC revoke) | migration | batch / append-only | `00067_site_model.sql` (policies) | role-match (trigger half has no analog) |
| `scripts/apply-phase56-migration.mjs` | script (applier) | batch | `scripts/apply-phase51-migration.mjs` | exact |
| `scripts/probe-decisions-immutable.mjs` | script (probe) | request-response | `apply-phase51-migration.mjs` `assertSql`/`managementSql` | partial |
| `src/lib/sop/convert/*.ts` (types, block-to-step, plan, report) | utility (pure) | transform | `src/lib/sop/sections.ts` + `src/lib/competency/refresher.ts` | role-match |
| `scripts/convert-sops-to-steps.ts` | script (runner) | batch | `scripts/backfill-section-layouts.ts` (named in RESEARCH) | role-match (not read) |
| `src/lib/decisions/record.ts` (`recordDecision`) | utility (plain module) | event-driven / append | `setReviewCadence` admin-client write in `governance.ts` | role-match |
| `src/actions/standards.ts` | server action | CRUD | `src/actions/governance.ts` + `src/actions/site.ts` `setSopMachines` | exact |
| `BuilderStandardsButton.tsx` | component (portal modal) | CRUD | `BuilderMachinesButton.tsx` | exact |
| `BuilderStageShell.tsx` (modify: mount button) | component | - | itself, lines 41-42, 139-140 | exact |
| `StandardLabels` (worker label) + `useSopDetail` embed | component/hook | request-response | `BuilderMachinesButton` token usage; `useSopDetail` | partial |
| Writer hooks: `approvals.ts`, `completions.ts`, `assignments.ts`, `governance.ts`, `observations.ts`, `sop-section-blocks.ts`, `publish-core.ts`, `ai-fields.ts` | server action (modify) | event-driven | `setSopOwner` / `setReviewCadence` | exact shape |
| `src/lib/journeys/journeys.ts` (modify) | config | - | journey `wire-up-access` (line 358) | exact |
| `.planning/codebase/CAPABILITY-MATRIX.md` (modify) | doc | - | existing "Link SOPs to machines" row | exact |
| `playwright.config.ts` (modify: `phase56` project + lint regex) | config | - | `phase55` entry (line 671) | exact |
| `tests/phase56/*.spec.ts` (source-contract + writer sweep) | test | file-I/O | `tests/phase55/deletion-sweep.spec.ts` | exact |
| `scripts/decision-writers.json` | config (data-driven sweep) | - | `scripts/dropped-features.json` | exact |
| `src/lib/**/__tests__/*.test.ts` (convert + record unit tests) | test (unit) | transform | `src/lib/competency/__tests__/refresher.test.ts` | exact |
| `tests/evals/sop-ledger.eval.ts` | eval | request-response | `tests/evals/governance.eval.ts` | exact |
| `src/types/database.types.ts`, `src/types/sop.ts` (hand-edit) | types | - | existing hand-extended blocks | role-match |

## Pattern Assignments

### `supabase/migrations/00069_*.sql` and `00070_*.sql` (migration)

**Analog:** `supabase/migrations/00067_site_model.sql`

Conventions: header comment block citing decisions; `create table if not exists`; `create index if not exists`; `enable row level security`; **quoted** policy names with `drop policy if exists` first (the RLS lint only parses double-quoted names); every write policy's `WITH CHECK` byte-identical to `USING`.

**Table + composite-FK pattern** (lines 76-88):
```sql
create table if not exists public.sop_machines (
  sop_id uuid not null references public.sops(id) on delete cascade,
  machine_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sop_id, machine_id),
  foreign key (machine_id, organisation_id) references public.site_machines (id, organisation_id) on delete cascade
);
create index if not exists sop_machines_organisation_id_idx on public.sop_machines (organisation_id);
alter table public.sop_machines enable row level security;
```
Keep the closing `);` at line start (the lint recognises tenant tables that way). Use this for `sop_focus_steps` (add `section_id ... on delete cascade`, `unique (section_id, source_key)`), `sop_conversion_runs`, `standards`, and the attachment table (A-01/D-12: prefer three nullable FK columns `sop_id`/`section_id`/`focus_step_id` with a CHECK of exactly one, so deletes cascade and no orphan labels).

**Policy pair pattern** (lines 96-111) - exactly two per table:
```sql
drop policy if exists "org_members_can_view_site_layouts" on public.site_layouts;
create policy "org_members_can_view_site_layouts"
  on public.site_layouts for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "admins_can_write_site_layouts" on public.site_layouts;
create policy "admins_can_write_site_layouts"
  on public.site_layouts for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );
```
Apply to `standards` + attachments (all org members SELECT so workers see labels; admin/safety_manager write). `sop_focus_steps` needs org column (denormalise `organisation_id` like 00067 does to avoid cross-table policy subqueries; recursion learning 2026-05-13).

**`decisions` (00070) differs:** exactly two policies, SELECT (org + `current_user_role() in ('admin','safety_manager')`) and INSERT-only (`with check` org + `actor_kind='person' and actor_id = auth.uid() and source='live'`), no UPDATE/DELETE policy, NO FKs with cascade/set-null (A-08; only `supersedes_decision_id -> decisions(id)`). Full DDL is in 56-RESEARCH "Recommended ledger shape" and "RLS, Trigger and Grant Patterns" - copy from there; the repo has no existing raising trigger (first of its kind). No-analog note: the `BEFORE UPDATE OR DELETE` / `BEFORE TRUNCATE` + `ENABLE ALWAYS` + `REVOKE` block comes from RESEARCH, not the codebase.

**Idempotency header comment to copy** (lines 24-27): "Idempotent: create table if not exists, create index if not exists, drop policy if exists before every create policy ... so the applier's Management-API fallback can re-run this file safely." Backfill must use `insert ... on conflict do nothing` keyed on `(legacy_table, legacy_id)`.

**Comment hazard:** do not quote forbidden literals in SQL comments (00067 line 20 phrases it "No elevated-privilege function" - copy that wording style; lint guards scan comments).

---

### `scripts/apply-phase56-migration.mjs` (applier)

**Analog:** `scripts/apply-phase51-migration.mjs` (copy whole file, change names)

**MIGRATION_FILES order list** (lines 35-38) - must list 00069 then 00070 (and any later corrective file), asserted by index in a spec (CLAUDE.md 2026-07-28):
```js
const MIGRATION_FILES = [
  path.join(ROOT, 'supabase/migrations/00067_site_model.sql'),
  // If a later migration corrects 00067, append it here (CLAUDE.md 2026-07-28).
]
```

**`.env.local` loader + ref extraction** (lines 43-68), **`managementSql`** (lines 73-93), **db push with Management API fallback** (lines 107-147), **`assertSql` that distinguishes PGRST205 from a real error** (lines 163-188) - copy verbatim.

**Assertion shape to extend** (lines 192-206, 229-245): `to_regclass` + `relrowsecurity`; policy `qual`/`with_check` text checks (`with_check === qual` for write policies); `pg_constraint.confdeltype` checks. Add for this phase: policy count = 2 for each new table; for `decisions` assert `pg_trigger` rows with `tgenabled = 'A'`, `has_table_privilege('service_role','public.decisions','UPDATE') = false`, per-source backfill counts equal source counts (seven tables), and the in-DB refusal probe (RESEARCH section 7 DO block).

**Cache reload** (lines 346-353):
```js
await managementSql("NOTIFY pgrst, 'reload schema'")
```
Exit 0/1 summary block at lines 355-378.

---

### `scripts/probe-decisions-immutable.mjs` and eval probe (partial analog)

No existing `set local role` script. Reuse `managementSql` from the applier; for the eval use supabase-js service key (no OTP spend): select a real decision id first (probe vacuity - an UPDATE matching zero rows proves nothing), then `.update(...)` / `.delete()` must return an error whose message contains `append-only`, then re-select to show the row unchanged.

---

### `src/actions/standards.ts` (server action, CRUD)

**Analog:** `src/actions/governance.ts` (header + `setSopOwner` lines 1-161, `setReviewCadence` 274-311) and `src/actions/site.ts` `setSopMachines` (401+).

**Imports + guard** (governance.ts 43-58; site.ts uses `requireAdminContext` from `@/lib/auth/guards`, guards.ts line 22-29):
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
```
`requireAdminContext()` returns `{ supabase, user:{id}, role, organisationId } | { error }`.

**Action skeleton to copy** (site.ts 401-424):
```ts
const ctx = await requireAdminContext()
if ('error' in ctx) return { error: ctx.error }
const orgId = ctx.organisationId
if (!orgId) return { error: 'No organisation' }
const db = ctx.supabase as unknown as SupabaseClient
const parsed = setSopMachinesSchema.safeParse(input)      // Zod in src/lib/validators/
if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
const { data: sopRow, error: sopErr } = await db.from('sops').select('id')
  .eq('id', sopId).eq('organisation_id', orgId).maybeSingle()
if (!sopRow) return { error: 'SOP not found in your organisation' }
```
Verify every client-supplied id (sop, section, focus step, standard) belongs to `orgId` before writing; never take org from a parameter.

**Return shape:** `Promise<{ ... } | { error: string }>`; `console.error('[fnName] ...', err)` tag style. Async exports only (CLAUDE.md 2026-06-27) - label formatting helpers go in `src/lib/`. Session client + RLS is the real gate when an RLS write policy exists (the standards tables have one); use admin client only for tables with no authenticated write policy, as `setReviewCadence` does.

---

### `src/lib/decisions/record.ts` (`recordDecision`, plain module, NOT `'use server'`)

**Analog:** `setReviewCadence` service-role write (governance.ts 289-310):
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = createAdminClient() as any
const { error } = await admin.from('sop_review_cadences').upsert({
  organisation_id: ctx.organisationId,   // from session ONLY, never a parameter
  ...
})
if (error) { console.error('[setReviewCadence] upsert error', error); return { error: error.message } }
```
Apply: insert into `decisions` with the admin client; `organisation_id` and person `actor_id` come from `getSessionContext()` in the caller (pass `ctx`, not client input). Agent branch requires validated `actor_name` (DB CHECK backs it). Per A-08: await after the primary write, never throw; on failure `console.error('[recordDecision] FAILED', ...)` (distinct tag the sweep/reconcile finds). Export actor constants and types from this module (plain module so sync exports are legal).

**Writer hook sites (modify):** insert `await recordDecision({...})` immediately after the successful primary write, e.g. in `setSopOwner` after the `updated.length === 0` check (governance.ts 157-160) before `return { success: true }`. Subject/actor data in scope per 56-RESEARCH writer table (rows 1-14): `approvals.ts:186/254`, `publish-core.ts` `performPublish` (hook after flip, outside `assertPublishGates`; gate body byte-identical), `governance.ts:147/254/294`, `completions.ts:221/364`, `observations.ts:112`, `assignments.ts:49/85/119` (read the row first on delete), `sop-section-blocks.ts:75/99` (resolve sop/org server-side via block -> section -> sop, no client `sopId` parameter), `ai-fields.ts` `applyAiWrite` (`actor_kind='agent'`). Allowlisted (no ledger row): `selfAddSop`/`selfRemoveSop`, `requestAssessorReview`, `setApprovalChain`, `setDepartmentOwner`, versioning re-point, SOP-delete cleanup, UAT seed scripts.

---

### `BuilderStandardsButton.tsx` (component, portal modal) and `BuilderStageShell.tsx`

**Analog:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx` (copy structure; place beside it).

**Escape-to-close, no `mounted` gate** (lines 22-34):
```tsx
const [open, setOpen] = useState(false)
useEffect(() => {
  if (!open) return
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [open])
```
**Adjust-state-during-render reset to avoid set-state-in-effect lint** (lines 44-54), **load-on-open effect calling a server action** (56-68), **named handler wired to the action with optimistic update + rollback + `saveState`** (72-87).

**Menu row + portal shell** (lines 114-146): `role="menuitem"` button with `text-ui` / `text-micro` and `var(--ink-*)` tokens; `createPortal(<div className="fixed inset-0 z-50 bg-black/50 ..." onClick={close}> <div data-testid=... role="dialog" aria-label=... onClick={(e)=>e.stopPropagation()} className="bg-[var(--paper)] ... sm:rounded-2xl ...">`, header with `X` close button, loading/error lines using `text-meta` and `var(--accent-hazard)`. Use `data-testid="standards-panel"` for the eval. Plain words: "section"/"step", never "block". No Dialog primitive exists - do not add one. Tokens only (design-tokens lint): `min-h-tap`, `rounded-lg`, `rounded-2xl`.

**Mount in `BuilderStageShell.tsx`:** add import next to lines 41-42 and render on the line after `<BuilderMachinesButton sopId={sopId} />` (line 139):
```tsx
import { BuilderMachinesButton } from './BuilderMachinesButton'
...
<BuilderMachinesButton sopId={sopId} />
<BuilderCategoryButton sopId={sopId} categorySlug={sop.category_slug ?? null} />
```
Add a "Whole site" row to the machines modal for SOP-03 (calls `setSopMachines({ sopId, machineIds: [] })`); the placement trigger flips `sops.placement`.

---

### `StandardLabels` + `useSopDetail` embed (partial)

No existing label component. Use `BuilderMachinesButton`'s token vocabulary (`text-micro`, `var(--ink-500)`) and the `--accent-inspect` token per one-screen-site.md; keep to one embedded select added to `useSopDetail`'s existing query and a ~20-line component (bundle gate +2 KB; run `npm run build`). SOP- and section-level only on the old walk rail (A-05). Do not import the admin panel from any `/sops` file.

---

### `src/lib/sop/convert/*.ts` (pure converter modules)

**Analog:** `src/lib/sop/sections.ts` (plain module, `import type` only, no React) and `src/lib/competency/refresher.ts` (pure fns with static-import unit tests).

**Classifier reuse - never a private keyword list** (sections.ts 9-28):
```ts
import type { SopWithSections } from '@/types/sop'
export type Section = SopWithSections['sop_sections'][number]
export const isPpeSection = (s: Section) => has(s, PPE_KEYWORDS)
export const isHazardSection = (s: Section) =>
  has(s, HAZARD_KEYWORDS) && !isPpeSection(s) && !isEmergencySection(s)
```
Import `isHazardSection`/`isPpeSection` and use for default kinds only (D-04). Runner must load `section_kind:section_kinds!section_kind_id(*)` like `useSopDetail`. Explicit-failure readers per block type (RESEARCH "Reader that returns an explicit failure instead of null"); use exported `PUCK_TYPE_TO_BLOCK_KIND` and `stripMeta()` from `block-registry.tsx`; do NOT call either `puckPropsToBlockContent`.

**Runner** `scripts/convert-sops-to-steps.ts`: tsx script, `--dry-run` default, `--apply`, `--org`, `--sop`; upsert on `(section_id, source_key)`, delete stale generated rows, skip when `layout_hash` matches the stored `sop_conversion_runs` row; hard gate per SOP (hazard >= cards + warning/caution callouts, ppe >= cards, every PPE item present). Not read in this pass - the planner should open `scripts/backfill-section-layouts.ts` for the env/loader/CLI idiom.

---

### `tests/phase56/*.spec.ts` (source-contract + data-driven sweep) and `scripts/decision-writers.json`

**Analog:** `tests/phase55/deletion-sweep.spec.ts` + `scripts/dropped-features.json` (shape: `{ version, entries: [{feature, phase, kind, path|pattern|...}], allow: [{pattern, reason, files}] }`).

**Helpers to copy** (spec lines 21-120): `read()` with CRLF normalisation, `exists()`, `stripComments()` (blanks full-line comments), `walkTsFiles()`, `findMatches()` with `isAllowed()` allowlist, `scan('src', regexes)`.
```ts
function stripComments(src: string): string {
  return src.split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line)).join('\n')
}
```
**Fixme-until-live model** (lines 34-37, 124-127): `LIVE_FEATURES` array + `test.fixme(!LIVE.includes(key), ...)` so Wave-0 stubs flip live in the plan that implements them. **Not-vacuous guard** (lines 234-245): assert entry count, known keys, every regex compiles.

Adapt for DEC-01: entries keyed by writer table (data-keyed, A-04): for each `sop_approvals` / `completion_sign_offs` / `sop_assignments` / ... write site in `src/`, assert the same file also contains a call to `recordDecision(` (wiring, not mere token presence; CLAUDE.md 2026-06-05); allowlist the reasoned exceptions listed above. Also assert `MIGRATION_FILES` index order for 00069 < 00070, `publish-core.ts` `assertPublishGates` untouched by a call to `recordDecision`, and that `rls-org-scope` covers new tables. Comments must describe forbidden patterns in words.

---

### `playwright.config.ts` (modify)

**Analog:** `phase55` entry (lines 655-675) - append a `phase56` entry verbatim with a broad testMatch so later plans add specs with no config edit:
```ts
{
  name: 'phase56',
  testDir: '.',
  testMatch: /tests\/phase56\/.*\.(spec|test)\.ts$/,
  use: { browserName: 'chromium' },
},
```
Verify: `npx playwright test --list --project=phase56`. Any new `tests/lint/*.spec.ts` must be appended by filename to the `phase15-stubs` regex (line 40; ends `...|no-dead-internal-hrefs)\.spec\.ts$`). With A-01 no new lint guard is required, but `rls-org-scope` already in that regex lints the new tables automatically.

**Unit-test project:** there is no `phase15-unit` project in this config. Use the per-dir pattern, e.g. add
```ts
{ name: 'phase56-unit', testDir: './src/lib/sop/convert/__tests__', testMatch: /.*\.test\.ts$/ },
```
(models `phase35-unit` at line 408-411 and `phase28-unit` 203-206). A second one for `./src/lib/decisions/__tests__`, or one `testDir: './src'` with a regex like `phase21-unit` (line 69-72).

---

### Unit tests for pure modules

**Analog:** `src/lib/competency/__tests__/refresher.test.ts` (static `@/` imports, Playwright `test`/`expect`; dynamic `import('@/...')` fails outside testDir, CLAUDE.md 2026-06-24):
```ts
import { test, expect } from '@playwright/test'
import { refresherDueDate, isRefresherDue } from '@/lib/competency/refresher'

test.describe('refresherDueDate', () => {
  test('unset interval -> null (D-02, no org/category fallback)', () => {
    expect(refresherDueDate('2026-01-15T00:00:00.000Z', null)).toBe(null)
  })
})
```
Cover: each of 18 block types -> kind, Warning/Caution callout -> hazard placed before the step, Tip -> tip, unreadable hazard card -> failure, idempotent keys, hard gate arithmetic.

---

### `tests/evals/sop-ledger.eval.ts` (deployed eval)

**Analog:** `tests/evals/governance.eval.ts`

**Header/imports/skip/SLOW** (lines 17-23, 33-35):
```ts
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { EVAL_ENV_READY, signInAs } from './lib/session'
import { ensurePlantFixture, REAL_SOPSTART_ORG_ID, shot, watchConsole } from './lib/plant-fixture'
const SLOW = { timeout: 25_000 }
test.describe('Phase 56 -- ... (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'set EVAL_BASE_URL (+ Supabase keys in .env.local) -- run via `npm run eval`')
```
**Service-key fixture client + org guard** (lines 42-53): `createClient(url, SERVICE_KEY, { auth: { persistSession: false } })`; `ensurePlantFixture(db)`; `if (siteOrgId === REAL_SOPSTART_ORG_ID) throw ...` (write only to the eval-site org). **Reset-and-read-back fixture state** (lines 106-112) and **`afterAll` cleanup** (126-129) - for standards created by the eval ("EVAL LOTO"), delete in `afterAll`. **Test body idiom** (136-151): `signInAs(context, 'siteAdmin')` once per test/describe (OTP budget), `page.goto`, `expect(...).toBeVisible(SLOW)`, `toPass(SLOW)` for dynamic counts; assert by name, never "exactly N" on shared org. Read screenshots before declaring pass; ledger probes use the service key (no session minting).

---

### `src/lib/journeys/journeys.ts` (modify)

**Analog:** journey `wire-up-access` (line 358-371) for object shape: `{ id, group, persona, title, summary, steps: [{ id, type: 'start'|'screen'|'action'|'decision'|'end', label, detail?, route?, branches? }] }`. The panel adds no route, so edit the existing builder journey (step `build`, line ~347/416 `detail` listing Tools menu contents) to name "Standards" and "Placement: machine or whole site", and add an action step in group 'Refine & publish'. Keep `route` values real.

---

## Shared Patterns

### Org scope from session, never a parameter
**Source:** `src/actions/governance.ts` 75-83 (`requireAdmin`), `src/lib/auth/guards.ts` 22-29 (`requireAdminContext`), `src/actions/site.ts` 404-424
**Apply to:** `standards.ts`, `record.ts` callers, every writer hook, `verifyBlock` (resolve sop/org by join).

### Service-role writes self-enforce org
**Source:** `governance.ts` 289-310 (`setReviewCadence`)
**Apply to:** `recordDecision`, converter runner (explicit `organisation_id` on every row).

### Migration shape and RLS lint compatibility
**Source:** `00067_site_model.sql` (quoted policies, `WITH CHECK` = `USING`, idempotent re-run)
**Apply to:** 00069, 00070.

### Applier + cache reload
**Source:** `scripts/apply-phase51-migration.mjs`
**Apply to:** `apply-phase56-migration.mjs`.

### Grep-guard comment hygiene
**Source:** `deletion-sweep.spec.ts` `stripComments` + 00067 header wording
**Apply to:** all new source, SQL and specs (describe forbidden patterns in words).

### Tokens and plain words
**Source:** `BuilderMachinesButton.tsx` class vocabulary
**Apply to:** all new UI (`text-ui/meta/micro`, `var(--ink-*)`, `var(--accent-*)`, `min-h-tap`; "section"/"step", not "block").

## No Analog Found

| File / Piece | Role | Data Flow | Reason |
|---|---|---|---|
| Append-only trigger block (`BEFORE UPDATE OR DELETE`, `BEFORE TRUNCATE`, `ENABLE ALWAYS`, `REVOKE`) in 00070 | migration | append-only | No raising trigger or table-level REVOKE exists in any migration; use 56-RESEARCH section 6 DDL |
| `set local role service_role` refusal probe | script | request-response | No existing script; use RESEARCH section 7 DO block via `managementSql` |
| Agent-actor producer (`applyAiWrite` as `actor_kind='agent'`) | utility | event-driven | No agent identity exists anywhere today; design from RESEARCH Open Question 1 / A-04 |
| `StandardLabels` worker component | component | request-response | No quiet-label component exists; keep to token vocabulary and bundle limits |
| `phase15-unit` project | config | - | Does not exist under that name; use per-dir `phaseNN-unit` entries |

## Metadata

**Analog search scope:** `supabase/migrations`, `scripts/`, `src/actions`, `src/lib/{sop,auth,journeys,competency}`, builder route dir, `tests/phase55`, `tests/evals`, `playwright.config.ts`
**Files read:** 56-CONTEXT, 56-RESEARCH (lines 1-543 of 699; remaining sections are code examples and open questions), 00067, apply-phase51, governance.ts (partial), BuilderMachinesButton, deletion-sweep spec, governance.eval (partial), playwright.config (partial), sections.ts (partial), refresher.test (partial)
**Not read (planner should open):** `scripts/backfill-section-layouts.ts`, `src/hooks/useSopDetail.ts`, `tests/evals/lib/session.ts`, remainder of 56-RESEARCH (Open Questions)
**Pattern extraction date:** 2026-10-04
