# Phase 60: Requests, Notifications & Objectives - Pattern Map

**Mapped:** 2026-10-06
**Files analyzed:** 27 new/modified groups
**Analogs found:** 26 / 27 (no analog: the notification bell + overview body, which compose existing pieces)

Notes that bite (all verified in the tree this pass):
- `recordDecision()` (`src/lib/decisions/record.ts:21-47`) reads the SESSION (`getSessionContext()`), so it only works inside a session-bearing action. The cron route and `raiseRequestAsAgent` have no session and must NOT call it. This is consistent with D-01 ("raising is not a decision"). Only `answerRequest`, `askToDoSop`, `declineAsk` and the objective actions log.
- `ShellFrame.tsx` is source-pinned (59-PATTERNS, `tests/phase57/shell-structure.spec.ts`): no router, one `setPlace(`, literal `lg:w-100` / `lg:w-64`. The search `<label>` is at line 175 inside `listPane` (line 172). The bell is a prop slot placed beside it; its click calls the shell's `select()`.
- `middleware.ts:40` is a single-path equality (`const isCronRoute = path === '/api/agent-layer/synthesis-sweep'`); it must become a two-path set and `synthesis-sweep-auth.spec.ts` must keep its literals.
- `acceptProposal` (`ai-fields.ts:192-199`) rebuilds `fieldContext` from exactly five named keys; `applyAiWrite` subject is `context.sectionId ?? context.sopId ?? null` (line 105). Both need `subjectId`/`agentName` (F-09).
- The `OfficePane` tab bar is hidden when `tabs.length <= 1` (line 93); giving the supervisor a second tab (`requests`) turns it on (F-06).
- `InboxRow.tsx:213-217` is the only caller linking to the assign page from `src/` besides `ThisSopBlock.tsx:307-310`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/00074_requests_notifications_objectives.sql` | migration | CRUD | `00073_office_ledger.sql` (kind widen) + 00070 (`decisions` SELECT-only table) | exact |
| `scripts/apply-phase60-migration.mjs` | script | batch | `scripts/apply-phase59-migration.mjs` | exact |
| `src/lib/decisions/shape.ts` + `read.ts` (5 kinds) | utility (pure) | transform | itself (lines 10-17) | exact |
| `src/lib/requests/model.ts` (kinds, states, `canAnswer`, labels) | utility (pure) | transform | `src/lib/shell/office-tabs.ts` (plain module idiom) | role-match |
| `src/lib/requests/core.ts` (claim, ask core, assignments) | service (server-only) | CRUD | `src/lib/members/remove.ts` + `record.ts` header idiom | role-match |
| `src/lib/requests/agent.ts` (`raiseRequestAsAgent`) | service (server-only) | CRUD | `synthesis-sweep/route.ts` batch + `remove.ts` | role-match |
| `src/actions/requests.ts` | server action | request-response | `src/actions/office.ts` (+ `assignments.ts` guard/log shape) | exact |
| `src/lib/notifications/{kinds,places}.ts` (pure) | utility | transform | `src/lib/sop/focus-path.ts` builders (`focusHref`) | role-match |
| `src/lib/notifications/write.ts` | service (server-only) | event-driven | `src/lib/decisions/record.ts` | role-match |
| `src/lib/objectives/{model,core}.ts` + `src/actions/objectives.ts` | service + action | CRUD | `remove.ts` + `office.ts` | role-match |
| `src/lib/ai-fields/registrations/objectives.ts` + validators/`ai-fields.ts` edits | registry | request-response | `registrations/index.ts` + `validators/ai-fields.ts:41-50` | exact |
| `src/app/api/cron/daily-sweep/route.ts` | route (machine endpoint) | batch | `src/app/api/agent-layer/synthesis-sweep/route.ts` | exact |
| `src/lib/supabase/middleware.ts` (cron set + assign 307) | middleware | request-response | itself (lines 38-47, 90-97) | exact |
| `src/components/office/{RequestsTab,RequestRow}.tsx` | component | CRUD | `InboxRow.tsx` + `OfficePane.tsx` | exact |
| `src/lib/shell/office-tabs.ts` (`requests` tab) | utility (pure) | transform | itself | exact |
| `src/components/shell/NotificationBell.tsx` + `ShellFrame` slot | component | event-driven | `useNotifications.ts` read + `ShellFrame.tsx:172-199` | partial |
| `src/components/shell/SiteOverview.tsx` (lazy) + `OneScreen` seam | component | request-response | `OneScreen.tsx:19-27` + `SiteSummary.tsx` | partial |
| `src/components/shell/ObjectiveLine.tsx` | component | transform | `OwnerReviewMeta.tsx` | exact |
| `src/components/requests/{RequestComposer,AskPicker,ObjectiveEditor}.tsx` (lazy) | component | CRUD | `ReasonDialog.tsx` + `OwnerPicker.tsx` | role-match |
| Notification writers: `publish/route.ts`, `approveStep`, `submitCompletion`, `notifyAssignedWorkers` | server action | event-driven | `versioning.ts:239-258` (the writer it replaces) | exact |
| `src/hooks/useNotifications.ts` | hook | delete | itself | delete |
| `assignments.ts` retirements + `decision-writers.json` | server action + config | CRUD | `assignments.ts:37-123` | exact |
| `InboxRow.tsx` fix-link repoint, `ThisSopBlock` ask link | component | request-response | `InboxRow.tsx:213-217` | exact |
| Assign page deletion + `legacyRedirectFor` | route/proxy | request-response | `tests/phase58/legacy-redirects.spec.ts` idiom | exact |
| `scripts/check-bundle-size.ts` markers | config | - | itself (line 99-111) | exact |
| `scripts/verify-gate-check.tsx` stub | config | - | its `Module._load` list | exact |
| `tests/phase60/*.spec.ts` + `playwright.config.ts` `phase60` | test | transform | `tests/phase59/{repoint-inventory,retirement-sweep}.spec.ts` | exact |
| `tests/phase60/*-rls-live.spec.ts` | test | request-response | `tests/phase59/ledger-rls-live.spec.ts` | exact |
| `tests/evals/requests.eval.ts` | test | request-response | `tests/evals/office.eval.ts` | exact |

## Pattern Assignments

### `supabase/migrations/00074_requests_notifications_objectives.sql` (migration, CRUD)

**Analog:** `supabase/migrations/00073_office_ledger.sql` lines 15-22 (idempotent drop + add of `decisions_kind_check`). Header in words only (CLAUDE.md 2026-09-28: never quote a forbidden literal in a comment).
```sql
alter table public.decisions drop constraint if exists decisions_kind_check;
alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
  'request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed'
));
```
Three tables: copy the full skeleton in `60-RESEARCH.md` "Migration skeleton" (SELECT-only policies, no write policy; `notifications` column grant `grant update (read_at)`; `unique (user_id, dedupe_key)`; no FK to `sops` per A-10). Resolve the research note: `set_by_user ... on delete set null` conflicts with `objectives_one_setter`; use a plain uuid (no FK) or `on delete cascade`, same for `requests.raised_by_user`. Data step: one `objectives` row per non-null `sops.objective` keyed on the lineage root (A-01), `on conflict do nothing`. No `worker_notifications` copy (A-02). Org-scope lint: every policy arm conjoins `organisation_id = public.current_organisation_id()` (`tests/lint/rls-org-scope.spec.ts`). Run `npx supabase migration list` first (last applied 00073).

### `scripts/apply-phase60-migration.mjs` (script, batch)

**Analog:** `scripts/apply-phase59-migration.mjs` (whole file; copy structure). Concrete parts to reuse verbatim:
- `MIGRATION_FILES` array (line 28), env loader (30-39), `managementSql()` (55-65), stale-history guard (76-95), `db push` then Management API fallback (97-116), `assertSql()` with PGRST205 branch (125-149), `NOTIFY pgrst, 'reload schema'` (198-207).
- Replace `KINDS` (152-157) with the 23 kinds; check `def.includes(\`'${k}'::text\`)`.
- Replace the policy assertions (172-188) with: `requests` carries exactly one policy (SELECT); `objectives` exactly one SELECT; `notifications` one SELECT + one UPDATE; no INSERT/DELETE policy on any of the three; `has_column_privilege('authenticated','public.notifications','title','UPDATE') = false` and `... 'read_at','UPDATE') = true`; `count(sops.objective not null)` equals migrated `objectives` rows of `subject_type='sop'`.
- Assertions must pin EVERY security clause (CLAUDE.md 2026-07-28), not just existence.

### `src/lib/decisions/shape.ts` + `read.ts` (5 new kinds)

**Analog:** `shape.ts` lines 10-17 (`DECISION_KINDS` mirrors the migration check). Append the five kinds; `DEFAULT_AGENT_NAME` (line 22) is the agent name for sweep/AI producers. Add each kind to exactly one `KIND_GROUPS` entry and a plain-words label in `read.ts`; extend `tests/phase56/decision-kinds-live.spec.ts` `samples()` (a `Record<DecisionKind, DecisionInput>`, so `tsc` fails until done) and `tests/phase59/ledger-read.spec.ts`. Summaries are literal words (`shape.ts:28`, 1-200 chars); free text (notes) goes in `details`.

### `src/lib/requests/core.ts` (service, CRUD, server-only)

**Analog:** `src/lib/members/remove.ts` (plain module, service role, session org is the scope, returns a count) + `record.ts` header (why service role, why fail-soft). Pattern 1 from research is the claim:
```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
// remove.ts:22-27 shape: .eq('id', id).eq('organisation_id', orgId).select('id')  -> add .eq('state','open') as the claim
const { data, error } = await createAdminClient().from('requests')
  .update({ ...patch, decided_at: new Date().toISOString() })
  .eq('id', id).eq('organisation_id', orgId).eq('state', 'open')
  .select('id, kind, subject_type, subject_id, raised_by_user, target_role, target_user_id, note')
return data?.[0] ?? null   // null => already answered; no ledger row, no notification
```
`askToDoSopCore` replaces `assignSopToRole/User` (`assignments.ts:50-60` and `94-104` insert shapes: `{ organisation_id, sop_id, assignment_type: 'role'|'individual', role|user_id, assigned_by }`), but with the service role, an explicit org filter, a role guard `admin|safety_manager|supervisor`, subject-in-org verification, and `23505` -> `update assigned_by = asker` (F-21; `assignments.ts:63-65` is the existing 23505 branch). It returns `{ requestId, recipients }`; the CALLER logs. Verify the SOP and target person belong to the session org before any write (CLAUDE.md 2026-06-15, 2026-07-28: never the fetched row's org). Decline resolves the assignment through lineage (F-20, `lineageRoot` in `src/lib/sop/lineage-current.ts`).

### `src/lib/requests/agent.ts` (service, CRUD, server-only)

**Analog:** `synthesis-sweep/route.ts` for the batch caps + per-org loop; `remove.ts` for the module idiom. Plain module, NOT `'use server'` (CLAUDE.md 2026-09-30: every `'use server'` export is POST-reachable). Insert with `raised_by_agent = a.agent` (typed `AgentName` from `shape.ts:20-21`); the partial unique index makes a repeat a no-op (`23505` => skip); skip machines with a `new_sop` answered in the last 30 days. Takes `organisationId` as a parameter because it has no session (the cron loop supplies it from the row it iterates, so scope each query with that explicit id). No `recordDecision` call (it needs a session and raising is not a decision).

### `src/actions/requests.ts` (server action, request-response)

**Analog:** `src/actions/office.ts` header (lines 1-9) and session reads (29-37, 92-95); log-after-write from `assignments.ts:71-77`.
```ts
'use server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { recordDecision } from '@/lib/decisions/record'
// async exports only; no org / user / agent field in any schema; z.object({...}).strict()
const { userId, role, organisationId } = await getSessionContext()
if (!userId) return { error: 'Not authenticated' }
if (!organisationId) return { error: 'No organisation found' }
```
`answerRequest`: guard role (`admin|safety_manager|supervisor`), validate input (decline note >= 10 server-side, matching `ReasonDialog` `MIN = 10`), `claimOpenRequest(...)`, null => `{ error: 'Already answered' }`, then exactly one `recordDecision({ kind: 'request_accepted'|'request_declined', subject: { kind: 'request', id }, sopId, summary: <literal words>, details: { request_kind, answer_note } })`, then `notify(...)`, then `return { logged: result.ok }` so the receipt only says "logged" when true (`OfficePane.tsx:34-40`). Reads for the Requests tab use the SESSION client under RLS (like `getOfficeInbox`), privileged reads in `src/lib/` (CR-01 guards ban `createAdminClient` in several action files; do not import it here). Register every writer in `scripts/decision-writers.json` (see Shared Patterns).

### `src/lib/notifications/write.ts` (service, event-driven, server-only)

**Analog:** `record.ts` (fail-soft, never breaks the primary write) and the writer it replaces, `versioning.ts:239-258` (builds `userIds`, inserts rows). Pattern 3:
```ts
await createAdminClient().from('notifications').upsert(
  rows.map((r) => ({ ...r, organisation_id: orgId })),
  { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
)
```
Call it after the primary write inside try/catch, return nothing the caller depends on. `place` comes only from `places.ts` builders wrapping `focusHref` / `formatPlace`; the table CHECK (`like '/%' and not like '//%'`) is the backstop. Dedupe keys per F-12.

### `src/lib/notifications/places.ts` (utility, transform)

**Analog:** `src/lib/sop/focus-path.ts` `focusHref` + `src/lib/shell/place.ts` `formatPlace` (whitelisted, UUID-gated fixed templates). Unit-test with static `@/` imports (CLAUDE.md 2026-06-24: dynamic `import('@/...')` breaks in Playwright).

### Notification writers (publish, approve, completion, new version, request answered)

**Analog:** `src/actions/versioning.ts:239-267` (`notifyAssignedWorkers`: collects `userIds`, inserts `worker_notifications` with `type: 'sop_updated'`, re-points assignments). Swap the insert for `notify({ kind: 'new_version', dedupe_key: \`new_version:${newSopId}\`, place: focusHref(newSopId) ...})`; keep the `sop_assignments` repoint (it stays allow-listed in `decision-writers.json`). `markNotificationRead` (`versioning.ts:273-289`, server action) is NOT the pattern for the new table: mark-read uses the browser client (A-06). For `publish/route.ts` and `approveStep`, hook at the pending-divert and after a non-final approval (F-13). `submitCompletion` hook goes after `recordSignature(` (the `delegatedHooks` anchor in `decision-writers.json`). Add `request.includes('lib/notifications')` to the `Module._load` stub list in `scripts/verify-gate-check.tsx:97-118` in the same commit and run `--project=phase26` (CLAUDE.md 2026-10-04, A-11).

### `src/lib/ai-fields/registrations/objectives.ts` + `FieldContext` widening (registry)

**Analog:** `src/lib/validators/ai-fields.ts:41-50` (`FieldContextSchema`) and `src/actions/ai-fields.ts`. Required edits, all in one commit:
```ts
// validators/ai-fields.ts: add to FieldContextSchema
subjectId: z.string().uuid().optional(),
// ai-fields.ts:105  subject: { kind: 'field', id: context.subjectId ?? context.sectionId ?? context.sopId ?? null }
// ai-fields.ts:193-199 acceptProposal rebuild: add  subjectId: ctx['subjectId'] as string | undefined
```
Register `objective.site|department|machine|sop|person` (`stakeLevel: 'low'`) with `write` calling `src/lib/objectives/core.ts` (re-check session role admin/safety_manager and that the subject is in the session org inside the core) and a read-only `objectives.all`. Keep the SOP id in `subjectId`, NOT `sopId`, so the published-SOP gate (`ai-fields.ts:64-78`) does not divert it. `applyAiWrite` already logs `ai_field_write` for applied writes (101-110), so the core must not log for the agent path (one change = one row). Register in `registrations/index.ts` barrel.

### `src/app/api/cron/daily-sweep/route.ts` (route, batch)

**Analog:** `src/app/api/agent-layer/synthesis-sweep/route.ts`. Copy `isAuthorized` VERBATIM (lines 34-46; `synthesis-sweep-auth.spec.ts` greps route source, do not extract it), the batch-cap constants (31-32) and the `POST` skeleton (126-154):
```ts
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const header = request.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer\s+/i, '').trim()
  const providedBuf = Buffer.from(provided); const secretBuf = Buffer.from(secret)
  if (providedBuf.length !== secretBuf.length) return false
  return crypto.timingSafeEqual(providedBuf, secretBuf)
}
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  ...
}
```
Both jobs (review-due notifications; machine-without-SOP agent requests) run in one route, iterating orgs with caps; every query carries the iterated row's `organisation_id` explicitly (the synthesis route's `hasNewerSignal` at lines 97-124 is the per-org filter idiom). No VOYAGE-style env gate needed. Ops: Railway cron is a human checkpoint (A-08).

### `src/lib/supabase/middleware.ts` (middleware, request-response)

**Analog:** itself. Replace line 40:
```ts
const CRON_PATHS = ['/api/agent-layer/synthesis-sweep', '/api/cron/daily-sweep']
const isCronRoute = CRON_PATHS.includes(path)
```
Add the source-contract assertion for the new literal beside the synthesis one (the 2026-07-05 learning: the exemption is half the feature). Assign redirect: extend `legacyRedirectFor` in `src/lib/sop/focus-path.ts` (research: regex `...(?:versions|assign)`), the existing hook at lines 90-97 already 307s with cookies copied; flip `tests/phase58/legacy-redirects.spec.ts:61` from null. Server-side only, never a client effect (CLAUDE.md 2026-09-29).

### `src/components/office/RequestsTab.tsx` + `RequestRow.tsx` (component, CRUD)

**Analog:** `InboxRow.tsx` (row grammar, `RowDone` contract, `run()` helper, severity/chip styles, `ROW_BUTTON`) and `OfficePane.tsx` (tab wiring).
- Row: copy `data-testid="office-row"` `<li>` skeleton, `ROW_BUTTON` constant (InboxRow lines 47-48), `run(word, act)` pending/error pattern (146-159), `FAILED_COPY` (30), and `export type RowDone = { receipt: string; logged: boolean | null }` (28). One button per row (59 D-04): Accept; Decline opens `ReasonDialog` (props at `ReasonDialog.tsx:11-22`: `title, body, label, confirmLabel, confirmTone, pending, error, onConfirm, onCancel`). Agent chip classes: `bg-ai/10 text-ai border border-ai/40` (copy `DecisionsTab.tsx:44`).
- Pane: add `requests: 'Requests'` to `TAB_LABEL` (OfficePane lines 22-27), render `{tab === 'requests' && <RequestsTab onReceipt={(r) => setReceipt({ ...r, tab })} />}` beside the existing tab branches (149-158), and show the open-request count next to the label like the inbox count (122-124). Tab change still goes only through the shell's `select()` (line 116).
- Receipt text "· logged in the decision ledger" comes from `receiptWords` (34-40); do not re-implement.
- No `router`, no navigation from an effect; patch `SHELL_KEY` with `setQueryData`, never `invalidateQueries(SHELL_KEY)` (59 F-02). Pin = one pure `officePinCount(items, requests)` used in `getAdminShell`, `WorkerShell`, `InboxTab.handleDone`, `RequestsTab.handleDone` (F-07, Pitfall 2).
- Accept receipts for `change_sop`: editor link for admin/safety_manager, browse link `focusHref(id)` for a supervisor (F-23; `InboxRow.tsx:175` is the `focusHref(sopId, { from: 'office' })` idiom).

### `src/lib/shell/office-tabs.ts` (utility, pure)

**Analog:** itself (lines 9-20). Add `'requests'` to `OFFICE_TABS`, `WIDE_TABS` unchanged (requests is a narrow list), and:
```ts
if (role === 'supervisor') return ['inbox', 'requests']
```
`Place.room.tab` is `Exclude<OfficeTab,'inbox'>` so `parsePlace` whitelists it automatically (F-06). Same-commit repoints: `tests/phase59/place-tab.spec.ts:30-35`, `capability-matrix.spec.ts`, `office-pane-structure.spec.ts`, two office eval cases (idle supervisor "no tab control").

### `src/components/shell/NotificationBell.tsx` + `ShellFrame` slot (component, event-driven)

**Analog:** read pattern from `src/hooks/useNotifications.ts:21-41` (browser `createClient()` + React Query + RLS; the code being retired, but its READ idiom is the right one per A-06) and the slot position `ShellFrame.tsx:172-199` (search `<label>` inside `listPane`). Keep the bell a `bell?: ReactNode` prop rendered next to the label; no `router.`, no `next/navigation`, no second `setPlace(`/`replaceState` in `ShellFrame` (`tests/phase57/shell-structure.spec.ts:47-111`). Query:
```ts
const { count } = await createClient().from('notifications')
  .select('id', { count: 'exact', head: true }).is('read_at', null)   // RLS scopes to own rows
```
`refetchOnWindowFocus: true` plus a modest `staleTime`; NO `refetchInterval` server-action polling and no server action on this path (F-14). Mark-read: `createClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)` (column grant allows only `read_at`), awaited before navigating. Click = `select(OVERVIEW)` + `scrollIntoView` of the notifications section. When a new unread `asked` row appears, `invalidateQueries({ queryKey: ['user-sop-assignments'] })` (Pitfall 8).

### `src/components/shell/SiteOverview.tsx` (lazy) + seam (component, request-response)

**Analog:** `OneScreen.tsx:19-27` for the `next/dynamic` seam and `SiteSummary.tsx` for the counts card, which stays unchanged and on top (D-13).
```tsx
const SiteOverview = dynamic(() => import('@/components/shell/SiteOverview').then((m) => m.SiteOverview), {
  ssr: false,
  loading: () => null,
})
```
Mount from both shells below `SiteSummary`. No CSS import inside (59-12 lesson: lazy CSS cost +1.97 KB). Sections hide when empty; never a count-only placeholder. Add one literal from this module (and from `RequestComposer`, `AskPicker`, `ObjectiveEditor`) to the `/page` group in `scripts/check-bundle-size.ts` next to the 59 entry (lines 107-110):
```ts
{ label: 'office pane (lazy, 59 A-11)', markers: ['Nothing needs you', 'Nothing here can be edited or deleted'] },
```
Marker self-validation (lines 372-380) fails if the literal is not in the build, so pick strings that are in the lazy chunk. Never recapture `.bundle-baseline.json`; run `npm run build` in every shell-touching plan.

### `src/components/shell/ObjectiveLine.tsx` (component, transform)

**Analog:** `src/components/admin/governance/OwnerReviewMeta.tsx` (whole file): `<p data-testid=... className="mono flex min-w-0 items-center gap-1 text-meta text-ink-500">` with `Label · <span className="text-ink-700">value</span>` segments and `bg-accent-decision/10` chip for the warn state. Render `Objective · <text> · by 12 Nov · set by Jane`; agent-set: agent chip + `unconfirmed`. Date text via `src/lib/office/format.ts` (NZ-pinned, avoids React #418). Tokens only (`tests/lint/design-tokens.spec.ts`). Static, text-only, no icons beyond what the file already imports. Edit/Confirm controls live in the lazy `ObjectiveEditor`, mounted only for admin/safety_manager.

### `src/components/requests/{RequestComposer,AskPicker,ObjectiveEditor}.tsx` (lazy components)

**Analogs:** `ReasonDialog.tsx` (whole file) for the modal shell: `fixed inset-0 z-50 ... bg-ink-900/40`, `role="dialog" aria-modal="true"` (so the shell Esc guard sees it), local `onKeyDown` Escape handler that `preventDefault` + `stopPropagation` (58-63), focus-in/return-focus effect (50-56), `maxLength={500}` textarea (90), `min-h-tap` buttons. `OwnerPicker.tsx` (`src/components/admin/governance/`) for the role/person popover markup and Esc handling; `getOrgMembers` is admin-only (F-05) so the picker reads a new `listAskTargets()` (admin/safety_manager/supervisor; id + label + role only, labels via `src/lib/members/labels.ts`). Reached only via `next/dynamic`; supervisors use it from the worker machine panel (A-04), so it must not be statically imported in worker shell files (`tests/lint/no-static-admin-lens-import.spec.ts` greps comments too).

### `assignments.ts` retirement + `scripts/decision-writers.json` (server action + config)

**Analog:** `src/actions/assignments.ts:37-123` (the three actions being retired) and `decision-writers.json` entries at the `assignSopToRole/User`, `removeAssignment` lines (plan 8). Delete `assignSopToRole`, `assignSopToUser`, `removeAssignment`, `getAssignments`; keep `getOrgMembers`, `selfAddSop`, `selfRemoveSop`, `getUserSopAssignments`. In `decision-writers.json`: add `requests`, `objectives` to `tables`; `entries` for `answerRequest`, `askToDoSop`, `declineAsk`, `setObjective`, `clearObjective`, `confirmObjective` (`status: "hook"`, `key`, `kind`); `allow` entries with a `reason` for `raiseRequest` / `raiseRequestAsAgent` ("raising is a request, not a decision") and `notifyAssignedWorkers` stays as-is; remove the retired `assignments.ts` entries. Update `LIVE_WRITERS` in `tests/phase56/decision-writers-sweep.spec.ts:44-46` in the same commit. `assign` / `unassign` stay in `DECISION_KINDS` (269 historical rows).

### Assign page deletion + repoints

**Analog:** `tests/phase59/repoint-inventory.spec.ts` (RETIRED `{ token, plan }`, INVENTORY `{ file, disposition, plan }`, `LIVE_PLANS`, comment-stripped matching, SELF/phase-folder exclusions, lines 38-90) and `tests/phase59/retirement-sweep.spec.ts` helpers:
```ts
export const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
export function stripComments(src: string): string { return src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n') }
```
Delete list (research "Deletion inventory"): `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx`, `AssignmentRow.tsx`, `src/app/api/sops/[sopId]/assignments/route.ts`, `useNotifications.ts`, `setSopObjective` (`focus-steps.ts:369-393`), the `machines` inbox kind. Assert absence of REFERENCES (anchor on `/admin/sops/` + `/assign`, CLAUDE.md 2026-08-04). Two src links to repoint: `InboxRow.tsx:213-217` (to `focusHref(g.id, { mode: 'edit', from: 'office' })`, button renamed "Open SOP", A-12) and `ThisSopBlock.tsx:307-310` (to the lazy "Ask someone to do this"). Same-commit living-map edits: `src/lib/journeys/journeys.ts` (`assign-sop` journey ~402-412, queue `fix` step ~498), `src/lib/uat/tests.ts`, `.planning/codebase/CAPABILITY-MATRIX.md` (add rows; never rename the rows pinned by `tests/phase46/capability-matrix-doc.spec.ts`), `scripts/dropped-features.json` (`{ feature, phase, kind: 'file'|'dir'|'route-page', path }` only).

### `tests/phase60/*` + `playwright.config.ts`

**Analog:** the `phase59` project (broad `testMatch`). Add `phase60` with `testMatch: /tests\/phase60\/.*\.(spec|test)\.ts$/`, confirm with `npx playwright test --list --project=phase60` (CLAUDE.md 2026-05-25: an unregistered spec never runs). Spec names per research Wave 0 gaps. Assert wiring (the handler calls the action, the claim has `.eq('state','open')`), not token presence (CLAUDE.md 2026-06-05). Comments must describe forbidden literals in words (2026-09-28).

### `tests/phase60/requests-notifications-objectives-rls-live.spec.ts`

**Analog:** `tests/phase59/ledger-rls-live.spec.ts` lines 14-65: `PHASE60_LIVE=1` gate (line 34 `const LIVE = process.env.PHASE59_LIVE === '1' && ...`), env loader (21-30), `sessionClient()` via `generateLink` + `verifyOtp` (38-45), `EVAL_SITE_ORG_NAME` / `EVAL_USERS` from `../evals/lib/session`, `expect(siteOrgId).not.toBe(REAL_SOPSTART_ORG_ID)` (61). Matrix: `research` "Live RLS probe matrix". Re-read denied writes with the service client (a silent zero-row deny). Run once (OTP budget, CLAUDE.md 2026-09-28).

### `tests/evals/requests.eval.ts`

**Analog:** `tests/evals/office.eval.ts` and `sop-focus.eval.ts` header idioms (`SLOW`, `signInAs`, `ensurePlantFixture`, `shot`, `watchConsole`, service-client `beforeAll` that refuses the real org id). Rules: assert by name never count (shared eval-site org, CLAUDE.md 2026-09-29; "EVAL Oven" will draw an agent request), `toHaveCount(1)` before each click, generous timeout after `goto`, a second iteration for notifications/requests (2026-10-03), rendered content not HTTP status for the assign 307 case, zoomed screenshots of bell, Requests row, each objective line (2026-10-05), clean up leftover rows with the service key. Repoint pin assertions in `office.eval.ts` / `one-screen.eval.ts` to "inbox + requests".

## Shared Patterns

### Session-derived scope and service-role cores
**Source:** `src/actions/office.ts:29-37, 92-95`; `src/lib/members/remove.ts:22-27`; `src/lib/decisions/record.ts:25-37`
**Apply to:** `requests.ts`, `objectives.ts`, `core.ts` files, `write.ts`
Org, role, actor from `getSessionContext()` only; zod `.strict()` with no `organisationId`/`userId`/`agent` field; every service-role query carries `.eq('organisation_id', <session org>)`; privileged reads in plain `src/lib/` modules with `import 'server-only'`; `'use server'` files export async functions only (CLAUDE.md 2026-06-15, 2026-06-27, 2026-09-30, 2026-10-04).

### One ledger row per decision, logged AFTER the primary write
**Source:** `record.ts` + `assignments.ts:71-77`
**Apply to:** `answerRequest`, `askToDoSop`, `declineAsk`, `setObjective`, `clearObjective`, `confirmObjective`
```ts
const logged = await recordDecision({ kind, subject: { kind: 'request', id }, sopId, summary: 'Accepted a request', details })
return { logged: logged.ok }
```
New cores never log; the calling action logs once. Agent writes through the AI field interface log via `applyAiWrite` only.

### Receipt wording
**Source:** `OfficePane.tsx:34-40`
**Apply to:** every Office action
" · logged in the decision ledger" only when `logged === true`; failure copy otherwise.

### Cache hygiene (no router.refresh, no shell invalidation)
**Source:** `OfficePane.tsx` header comment; 59-PATTERNS "Cache hygiene"
**Apply to:** all pane and overview actions
`onDone` -> `invalidateQueries(['office-inbox'])` + `setQueryData(SHELL_KEY, ...)`; notifications ride the browser client + their own query key; never navigate from a mount effect while the page fires mount-time server actions (CLAUDE.md 2026-09-29).

### Lazy seam with forbidden marker
**Source:** `OneScreen.tsx:19-22`; `check-bundle-size.ts:107-110`
**Apply to:** `SiteOverview`, `RequestComposer`, `AskPicker`, `ObjectiveEditor`, `RequestsTab`
`next/dynamic({ ssr: false })`, no stylesheet import, one literal per module added to the `/page` markers; `/` is at 834/834 and `/sops/[sopId]` reads 794 against 792, so no headroom.

### Tokens and lint
**Source:** `src/styles/blueprint-theme.css`, `tests/lint/design-tokens.spec.ts`
**Apply to:** all new components
Tokens only (`text-ink-500`, `bg-accent-decision/10`, `min-h-tap`, `rounded-lg`); no `[Npx]`; grep `.next/static/css/*.css` for any new utility family before pushing (CLAUDE.md 2026-09-28).

### Cron auth
**Source:** `synthesis-sweep/route.ts:34-46` + `middleware.ts:38-40`
**Apply to:** `daily-sweep/route.ts`
Bearer `CRON_SECRET`, `timingSafeEqual`, fail closed; exempt by exact path in the proxy.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `NotificationBell.tsx` + `SiteOverview.tsx` composition | component | request-response | No existing client notification UI (the old hook has no consumer); compose `useNotifications.ts` read idiom + `OwnerReviewMeta` text style + `OneScreen` lazy seam |
| `notifications` table with column-level `grant update (read_at)` | migration | CRUD | No existing table uses a column-restricted UPDATE grant; use the research skeleton and assert `has_column_privilege` in the applier and live probe |
| `requests`/`objectives` polymorphic `subject_id` with no FK | migration | CRUD | Intentional (fork-draft census, F-17); closest precedent is `decisions.subject_id` |

## Metadata

**Analog search scope:** `src/actions`, `src/lib/{decisions,members,shell,validators,ai-fields,supabase,notifications-adjacent}`, `src/components/{office,shell,admin/governance}`, `src/hooks`, `src/app/api/agent-layer`, `supabase/migrations`, `scripts`, `tests/{phase59,evals}`
**Files read:** ~20 directly (plus 60-CONTEXT, 60-RESEARCH, 59-PATTERNS)
**Pattern extraction date:** 2026-10-06
