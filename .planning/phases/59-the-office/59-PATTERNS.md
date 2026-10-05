# Phase 59: The Office - Pattern Map

**Mapped:** 2026-10-05
**Files analyzed:** 26 new/modified groups
**Analogs found:** 25 / 26 (no analog: the sign-off expansion panel, which composes existing pieces)

Notes that bite:
- The lazy admin seam is `OneScreen.tsx` (`next/dynamic({ ssr:false })` over `AdminShell`). The Office pane is a SECOND dynamic import of one module (`OfficePane`), used from `AdminShell` and from the supervisor branch of `WorkerShell`. Never a static import in worker shell files (`tests/lint/no-static-admin-lens-import.spec.ts` greps comments too).
- `ShellFrame.tsx` line 92 `useState<Place>(() => parsePlace(initialPlace))`, line 105-106 the single `setPlace(p)` + `window.history.replaceState(null, '', formatPlace(p))`, line 348 the literal `lg:w-100`. `tests/phase57/shell-structure.spec.ts:56-70` pins all of them. Keep one writer; put `tab` INSIDE the room place; keep the literal `lg:w-100` in a conditional class.
- `decisions` has no authenticated write; `recordDecision()` is the only writer. Migration 00073 widens only `decisions_kind_check` (A-04: no new SELECT policy). Confirm the constraint name via `pg_constraint` first (A1).
- Every governance write already exists as a guarded server action. New code is reads, labels, guard fixes (F-03..F-11), and deletions.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/00073_office_ledger.sql` | migration | CRUD | `00072_sop_walks_server_written.sql`, `00070_decisions_ledger.sql` | exact |
| `scripts/apply-phase59-migration.mjs` | script | batch | `scripts/apply-phase58-migration.mjs` | exact |
| `src/lib/shell/place.ts` (room `tab`) + `src/lib/shell/office-tabs.ts` | utility (pure) | transform | `src/lib/shell/place.ts` itself | exact |
| `src/components/shell/ShellFrame.tsx` (wide class, Esc guard, role tab resolve) | component | event-driven | itself (`resolvePlace` 61-70, 92-122, 345-349) | exact |
| `src/components/shell/{AdminShell,WorkerShell,OneScreen}.tsx` pane seam | component | event-driven | `OneScreen.tsx` 9-27 | exact |
| `src/app/page.tsx` (read `tab`, UUID-gated `sop`) | page (RSC) | request-response | itself + `admin/access/page.tsx` UUID regex | exact |
| `src/components/office/OfficePane.tsx` (+ per-tab skeleton) | component | event-driven | `src/components/focus/admin/FocusEditor.tsx` + `EditorSkeleton.tsx` | role-match |
| `src/components/office/InboxTab.tsx`, `InboxRow.tsx` | component | CRUD | `GovernanceQueueRow.tsx` + `GovernanceInbox.tsx` | exact |
| `src/components/office/SignOffPanel.tsx`, `ApprovePanel.tsx` | component | request-response | `activity/[completionId]/CompletionDetailClient.tsx`, `CompletionStepRow.tsx` | partial |
| `src/components/office/DecisionsTab.tsx` | component | request-response | `AdminSopRows` list idiom + `INBOX_CHIPS` chips | role-match |
| `src/components/office/PeopleTab.tsx` | component | CRUD | `src/components/admin/RoleAssignmentTable.tsx` | exact (lift) |
| Access mount in pane | component | request-response | `src/components/sop/lenses/AdminAccessLens.tsx` | exact (unchanged) |
| `src/lib/governance/inbox.ts` (`signoff` kind) | utility (pure) | transform | itself | exact |
| `src/lib/governance/load-inbox.ts` (pending sign-offs) | service (plain) | request-response | itself | exact |
| `src/actions/office.ts` (`getOfficeInbox`, `getCompletionForReview`, `listDecisions`) | server action | request-response | `src/actions/walk.ts` + `completions.ts` | role-match |
| `src/lib/decisions/read.ts` (KIND_GROUPS, labels, cursor) | utility (pure) | transform | `src/lib/governance/inbox.ts` header idiom, `src/lib/decisions/shape.ts` | role-match |
| `src/lib/decisions/shape.ts` (3 new kinds) | utility | transform | itself | exact |
| `src/actions/auth.ts` guards (`inviteWorker`, `updateMemberRoleSafe`, `removeMember`, ledger writes) | server action | CRUD | `src/actions/governance.ts` `setSopOwner` (ledger + guard) | role-match |
| `src/actions/assignments.ts` `getOrgMembers` labels (F-07) | server action | request-response | `auth.ts` `getTeamMembersWithEmails` | role-match |
| `src/actions/governance.ts` `confirmSopCurrent` owner path (A-01) | server action | CRUD | itself | exact |
| `src/actions/completions.ts` `signOffCompletion` self sign-off refusal + countersign | server action | CRUD | itself (lines 168-260) | exact |
| `src/hooks/useWorkerSops.ts` `.neq('status','rejected')` | hook | request-response | itself (72-93) | exact |
| `src/lib/supabase/middleware.ts` four redirects | middleware | request-response | itself 63-84 | exact |
| Deletions + `scripts/dropped-features.json` + `scripts/decision-writers.json` | config | - | Phase 57/58 entries | exact |
| `tests/phase59/*.spec.ts` + `playwright.config.ts` `phase59` project | test | transform | `tests/phase58/{repoint-inventory,retirement-sweep}.spec.ts` | exact |
| `tests/phase59/ledger-rls-live.spec.ts` | test | request-response | `tests/phase58/focus-rls-live.spec.ts` | exact |
| `tests/evals/office.eval.ts`, `scripts/eval-fixtures.mjs` | test | request-response | `tests/evals/sop-focus.eval.ts`, `governance.eval.ts` | exact |
| `journeys.ts`, `uat/tests.ts`, `CAPABILITY-MATRIX.md` | config | - | same files | exact |

## Pattern Assignments

### `supabase/migrations/00073_office_ledger.sql` (migration)

**Analog:** `00072_sop_walks_server_written.sql` (header states why, idempotent `drop ... if exists`) and `00070_decisions_ledger.sql` (kind check). Write the header in words, never quoting a forbidden phrase (CLAUDE.md 2026-09-28).
```sql
alter table public.decisions drop constraint if exists decisions_kind_check;
alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve','reject','sign_off','countersign','assign','unassign','publish',
  'owner_change','review','observation','verify','verify_withdrawn',
  'ai_finding_cleared','cadence_change','ai_field_write',
  'role_change','member_invited','member_removed'));
```
Do NOT add a supervisor policy (A-04). Append triggers fire on row ops, not DDL. `tests/lint/rls-org-scope.spec.ts` parses migrations in order; nothing org-scoped changes. Mirror the list in `src/lib/decisions/shape.ts` `DECISION_KINDS` plus a spec comparing migration text to the array.

### `scripts/apply-phase59-migration.mjs` (script)

**Analog:** `scripts/apply-phase58-migration.mjs` lines 1-60 (`MIGRATION_FILES` array, `.env.local` loader, `managementSql()` to `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, `db push` first then Management API fallback, `--assert-only`, PGRST205-aware assert, `NOTIFY pgrst, 'reload schema'`). Single-file list `['supabase/migrations/00073_office_ledger.sql']`; assertion pins the constraint text contains `role_change`, `member_invited`, `member_removed` AND all 15 prior kinds. Run `supabase migration list` before `db push` (CLAUDE.md 2026-10-04); last applied is 00072.

### `src/lib/shell/place.ts` + `office-tabs.ts` (pure)

**Analog:** `place.ts` lines 10-56. Extend `Place` room arm: `{ kind: 'room'; id: RoomId; tab?: OfficeTab }`. `parsePlace(token, tab?)` whitelists the tab (anything not in `OFFICE_TABS` is dropped, raw token never carried); `formatPlace` emits `/?place=office&tab=people` (inbox omits tab); `placeToken` still returns `office` so `focusHref(..., { from: 'office' })` and `backHref` keep working; `placeForPath` (line 65) drops `/governance`, `/admin/team`, `/admin/access` (keep `/admin/settings`). Pattern from research:
```ts
export const OFFICE_TABS = ['inbox', 'decisions', 'people', 'access'] as const
export const WIDE_TABS: ReadonlyArray<OfficeTab> = ['decisions', 'people', 'access']
export const tabsForRole = (role: string | null): OfficeTab[] =>
  role === 'admin' || role === 'safety_manager' ? [...OFFICE_TABS] : role === 'supervisor' ? ['inbox'] : []  // A-04: supervisor = inbox only
```
Unit-test with static `@/` imports (CLAUDE.md 2026-06-24). Repoint `tests/phase57/place.spec.ts:56` and the `parsePlace(initialPlace)` pin in `shell-structure.spec.ts` in the same commit.

### `src/components/shell/ShellFrame.tsx` (wide class, Esc guard)

**Analog:** itself. Detail pane (line 348): `className="relative w-full shrink-0 overflow-y-auto border-ink-200 bg-paper lg:h-full lg:w-100 lg:border-l"`. Make it conditional, keeping the literal `lg:w-100`:
```tsx
const wide = effective.kind === 'room' && effective.id === 'office' && !!effective.tab && WIDE_TABS.includes(effective.tab)
// `... ${wide ? 'lg:w-[58%] lg:min-w-140' : 'lg:w-100'} ...`
```
`resolvePlace` (61-70, "edit without rights is the overview"): add the render-time fallback, never a redirect:
```ts
if (place.kind === 'room' && place.id === 'office' && place.tab && !ctx.officeTabs.includes(place.tab)) return { kind: 'room', id: 'office' }
```
Esc handler (lines 114-122) ignores only `isTypingTarget`; add an early return when `e.defaultPrevented` or `document.querySelector('[aria-modal="true"]')` (A-12). The camera refit already exists (`PlantStage` ResizeObserver replay, hidden 0x0 guarded) and `placeKey` (line 101) depends on `formatPlace(effective)`, so tab changes re-fly; do not rebuild it. After build grep `.next/static/css/*.css` for `min-w-140` and `w-\[58%\]` (CLAUDE.md 2026-09-28).

### Pane seam (`OneScreen.tsx` / `AdminShell` / `WorkerShell`)

**Analog:** `OneScreen.tsx` lines 9-27:
```tsx
const AdminShell = dynamic(() => import('@/components/shell/AdminShell').then((m) => m.AdminShell), {
  ssr: false,
  loading: SHELL_LOADING,
})
```
Copy for `const OfficePane = dynamic(() => import('@/components/office/OfficePane').then((m) => m.OfficePane), { ssr: false, loading: <OfficeSkeleton/> })` used from both shells. The loading skeleton must live in the static side (tiny div) so the lazy chunk stays lazy. `WorkerShell` already has `usePendingSignOffCount(isSupervisor)` (line 59); add `worker_id <> me` to that query in `useCompletions.ts:228-245` so pin and list agree. Add a forbidden-marker group to `scripts/check-bundle-size.ts` `/page` using the literal "Nothing needs you. That's the goal." Never recapture `.bundle-baseline.json`; `/` should read delta 0 (CLAUDE.md 2026-09-13, 2026-10-05). Repoint the `GovernanceQueueRow` allow-list entry in `tests/lint/no-static-admin-lens-import.spec.ts` (points at deleted `GovernanceInbox.tsx`).

### `src/components/office/OfficePane.tsx` (component, event-driven)

**Analog:** `src/components/focus/admin/FocusEditor.tsx` (lazy root with named exports, `'use client'` header comment explaining seam) and `src/components/focus/EditorSkeleton.tsx` (`const bar = 'animate-pulse rounded bg-ink-100 motion-reduce:animate-none'`, `data-testid` skeletons). Pane root keeps `data-testid="room-body" data-room-id="office"` (as `AdminOfficeBody` line 35: `flex flex-col gap-3 p-4 pr-16`). Tab bar = segmented control; tabs from `tabsForRole(role)`; tab change calls the shell's `select()` (one writer), never its own `replaceState` or `router.push` (CLAUDE.md 2026-05-13). Per-tab skeleton while the first query loads.

### `InboxTab.tsx` / `InboxRow.tsx` (component, CRUD)

**Analog:** `GovernanceQueueRow.tsx`. Keep: `data-testid="gov-row"`, severity dot map (28-33), `FLAG_STYLE`/`FLAG_LABEL` (12-26), the 4-column grid (`grid-cols-[10px_1fr_auto_auto]`), and the action-branch precedence (115-139: approve-me, then unowned, then stale_role, then confirm-current) which is the APR-03/04 hard constraint (header comment 35-43). Replace what must change:
```tsx
// REMOVE (F-09): const router = useRouter() ... router.refresh()
// ADD: onDone callback prop; parent invalidates ['office-inbox'] and patches SHELL_KEY
const result = await confirmSopCurrent(row.id)
if ('error' in result) { setError(result.error); return }
onDone({ receipt: 'Marked reviewed', logged: result.logged })
```
`OwnerPicker` (`./OwnerPicker`) gets the same `onDone` swap for its `router.refresh()` at line ~60. Receipt line is `role="status"` and ends " · logged in the decision ledger" only when `logged` is true (Pattern 5). Chips from `INBOX_CHIPS` (`inbox.ts` 29-36) with `inboxCounts`/`chipMatches` (139-157) as `GovernanceInbox` used them; empty state "Nothing needs you. That's the goal." plus cleared-today count. Link out with `focusHref(id, { mode: 'edit', from: 'office' })` (line 96). Cache patch: `qc.setQueryData(SHELL_KEY, ...)` (`SHELL_KEY = ['shell-admin']`, AdminShell.tsx:31) to decrement `inboxCount`; never `invalidateQueries(SHELL_KEY)` (30-minute `staleTime`, re-signs scene URL, F-02).

### `SignOffPanel.tsx` / `ApprovePanel.tsx` (partial analog)

**Analogs:** `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` (lines ~55-179 assessor/override copy, 136-149 `recordSignature` after approve, 318-437 UI) and `src/components/activity/CompletionStepRow.tsx` (thumbnails + dynamic `yet-another-react-lightbox`, reuse; do not hand-roll). Lift, do not rewrite:
- assessor-blocked teaching copy + "Request assessment" (`requestAssessorReview`, `src/actions/observations.ts`)
- admin / safety-manager override reason (>= 10 chars) sent as `overrideReason`
- reject reason >= 10 chars (server enforces at `completions.ts` ~180-185)
- `recordSignature({ completionId, role: 'supervisor' })` after approve (F-04) or move it inside `signOffCompletion` and register a `delegatedHooks` entry (58 `submitCompletion` precedent)
Buttons disabled while pending; the "Sign-off recorded but status update failed" error is non-retryable text (Pitfall 11). Lightbox and confirm dialogs get `role="dialog" aria-modal="true"` so the shell's Esc guard sees them. `ApprovePanel`: `approveStep(row.id)` / `requestChanges(...)` (`src/actions/approvals.ts`, guards stay `requireAdmin`), chain-so-far from `getApprovalStatus`, link `focusHref(id, { from: 'office' })`. No analog for the composed expansion; the guard strings are the contract.

### `src/actions/office.ts` (server action, request-response)

**Analog:** `src/actions/walk.ts` lines 1-60. Copy the header contract (async exports only, no org/user/role fields in any schema, privileged reads in plain modules) and the session helper:
```ts
'use server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
const uuid = z.string().uuid()
type Fail = { error: string }
async function sessionOrFail() {
  const ctx = await getSessionContext()
  if (!ctx.userId) return { error: 'Not authenticated' } as Fail
  if (!ctx.organisationId) return { error: 'No organisation found' } as Fail
  return { supabase: ctx.supabase, userId: ctx.userId, organisationId: ctx.organisationId, role: ctx.role }
}
```
Differences: reads use the SESSION client (RLS decides visibility), unlike walk's service-client writes. `getCompletionForReview(completionId)`: validate UUID, session-client select of `sop_completions` + `completion_photos` + `completion_sign_offs`, then sign storage paths from the returned rows in a plain `src/lib/` module (admin client lives there, CR-01 guard); compute `isAssessor` via `isSignedOffAssessor` (`lib/competency/assessor`). `listDecisions({ group, cursor })`: `.from('decisions').select(...).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51)`, cursor `.or('created_at.lt.<t>,and(created_at.eq.<t>,id.lt.<id>)')`, `.in('kind', KIND_GROUPS[group])`; role guard admin/safety_manager (A-04). `getOfficeInbox()` returns sign-off items only for supervisors.

### `src/lib/governance/inbox.ts` + `load-inbox.ts`

**Analog:** themselves. `InboxChip` gains `'signoff'`; `InboxItem.kind` gains `'signoff'` with a `signOff` payload (`{ completionId, sopId, sopTitle, sopVersion, workerId, submittedAt, photoCount }`); `INBOX_CHIPS` order becomes All, No owner, Overdue, Approve, Sign-off, Stuck, Machines; `inboxCounts` init (139-152) gains `signoff: 0`. `deriveInbox` input adds OPTIONAL `signOffs?: ...` (default `[]`) so existing six call shapes in `tests/phase54/governance-inbox.spec.ts` stay valid; edit its `:241` order pin. Machine row action (line 132) becomes `/admin/sops/new/blank?machine=<id>`; stuck row `Retry` becomes "Try again" via `requeueParse(sopId, isVideo)` in `src/hooks/useParseJob.ts` (`ai_prompt` SOPs show Open). `loadInbox` (header says sign-offs excluded) gains `listPendingSignOffs()` (session client, self-guarded role in supervisor|safety_manager|admin, `status = 'pending_sign_off'`, `worker_id <> me` per A-03), feeding `deriveInbox({ ..., signOffs })`; `getAdminShell` (`actions/shell.ts:54`, `inboxCount: inbox.items.length`) then counts them. `AdminShell.tsx:96,136` `usePendingSignOffCount` is dropped for admins to avoid double counting.

### `src/lib/decisions/read.ts` (pure)

**Analog:** `inbox.ts` (plain module, header names the drift it prevents). Exports `KIND_GROUPS` (All, Approvals approve/reject, Sign-offs sign_off/countersign, Ownership owner_change/assign/unassign, Publishing publish, Reviews review/cadence_change, AI ai_finding_cleared/ai_field_write/verify/verify_withdrawn, Other observation + role_change/member_invited/member_removed), plain-words kind labels, cursor encode/decode. Spec asserts every `DECISION_KINDS` value is in exactly one group. Dates: fixed `Pacific/Auckland` (`CompletionDetailClient.tsx:67-75` idiom).

### `src/actions/auth.ts` people guards + ledger (server action, CRUD)

**Analogs:** `setSopOwner` in `src/actions/governance.ts` (guard + write + `recordDecision`, returns `logged`), `recordDecision` in `src/lib/decisions/record.ts` (org and actor from session, fail-soft returns `{ ok }`). Changes: `inviteWorker` (`:131-165`) gets admin/safety-manager guard, zod `role` enum (reuse `updateRoleSchema` roles), only `admin` may grant `admin`, `invited_role` from input (read at `acceptInvite:200`), logs `member_invited`; `updateMemberRoleSafe` (`:446-456`) adds `.select('id')` and errors on zero rows (F-11, RLS is admin-only: 00062), logs `role_change` with details `{ from, to }`, subject `{ kind: 'member', id: user_id }`; `removeMember` captures the target user id BEFORE delete, logs `member_removed`; delete `updateMemberRole` (no caller). Summaries are literal plain words, no emails (Pitfall 10). `getOrgMembers` (`assignments.ts:188-215`) fills `email`/`full_name` via `auth.admin.listUsers`, as `getTeamMembersWithEmails` (`auth.ts:295-306`) already does. "Invited" list: auth users with `user_metadata.organisation_id === org` and no membership row (A-10, `[ASSUMED]` verify in Wave 0).

### `scripts/decision-writers.json` + sweep (config)

**Analog:** the file itself (shape: `tables`, `columnKeys`, `entries` with `{ file, function, status:'hook', key, kind, plan }`, `extraHooks` with `anchor`). Add `organisation_members` to `tables`; entries for `updateMemberRoleSafe` (`role_change`), `removeMember` (`member_removed`), `addMemberByEmail` (`member_invited`); `extraHooks` for `inviteWorker` anchor `inviteUserByEmail(`; `allow` entries with reasons for `joinWithInviteCode` and `acceptInvite` (Pitfall 9). Append keys to `LIVE_WRITERS` in `tests/phase56/decision-writers-sweep.spec.ts`; extend `samples()` in `tests/phase56/decision-kinds-live.spec.ts` (a `Record<DecisionKind, DecisionInput>`, so `tsc` fails until the three kinds have samples).

### `signOffCompletion` / `confirmSopCurrent` / `useWorkerSops`

**Analogs:** themselves. `completions.ts:168-260`: add `worker_id !== userId` refusal ("You cannot sign off your own walk"), keep reject-reason, assessor and override order, return `logged`. `confirmSopCurrent` gains an owner path: service client, `.eq('organisation_id', session org)`, `owner_user_id = userId` re-checked server-side (never read org off the fetched row, CLAUDE.md 2026-07-28), matrix row. `useWorkerSops.ts:72-93`: add `.neq('status','rejected')` to the completions read; check `src/actions/competency.ts` (O6).

### `src/lib/supabase/middleware.ts` redirects

**Analog:** itself lines 63-84. Edit in place:
```ts
if (path === '/sops' && view === 'attention') destination = '/?place=office'
else if (path === '/sops' && view === 'access') destination = sop && SOP_ID.test(sop) ? `/?place=office&tab=access&sop=${sop}` : '/?place=office&tab=access'
const redirect = NextResponse.redirect(new URL(destination, request.url))
response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
```
Add a sibling block for `/governance` (to `/?place=office`), `/admin/team` (`&tab=people`), `/admin/access[?sop=<uuid>]` (`&tab=access[&sop=]`). Fixed templates over UUID-tested ids only; cookies copied. Prefer putting the mapping in a pure helper next to `legacyRedirectFor` in `focus-path.ts` for unit testing. `/activity/<id>` for a non-owner is a server `redirect()` in the page (role from `getSessionContext`), never a client effect (CLAUDE.md 2026-09-29).

### `AdminSopRows` owner/review meta (OFF-04)

**Analog:** `AdminMachinePanel.tsx:77-79` (existing "owner X, review due" line, `AdminPanelSop.ownerLabel`/`reviewDueAt` in `admin-health.ts`). Change format only: "Owner · Jane Smith · review due 12 Nov", day precision, `Pacific/Auckland`, "No owner" warn tint, overdue escalate tint, "no review date" quiet. Workshop drafts (`AdminRoomBodies.tsx:64-96`) gain the same line: add `ownerLabel`/`reviewDueAt` to the `drafts` payload in `getAdminShell`. Editor "This SOP" block (58-12, `ThisSopBlock.tsx`) gains `OwnerPicker` + Mark reviewed.

### Deletions and sweeps

**Analogs:** `tests/phase58/repoint-inventory.spec.ts` (RETIRED `{ token, plan }` list, INVENTORY `{ file, disposition: 'delete'|'repoint', plan }`, LIVE_PLANS, comment-stripped matching, excludes self and `tests/phase58/`) and `tests/phase58/retirement-sweep.spec.ts` (helpers `read`, `stripComments`, `walkSrc`; negative assertions on `MW` contents and `src` walks). Copy helpers verbatim:
```ts
export const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
export function stripComments(src: string): string { return src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n') }
```
Assert absence of REFERENCES, not only files (CLAUDE.md 2026-08-04); anchor regexes on `/governance` etc. so `@/` imports are not false positives. Delete list is in RESEARCH "Deletion Inventory" (governance page, `GovernanceInbox`, `admin/team` page, `admin/access` page only, `TeamViewShell`/`OrgChartCanvas`/`OrgColumnsBoard`/`ViewToggle`, `SupervisorActivityView`, `ActivityFilter`, `CompletionSummaryCard`, `RejectReasonSheet` after the lift, org-model mutating exports but keep `listOrgTree`). A-05: mount `TrainingMatrixView`, `PersonPanel`, `AssessmentRequestsPanel` on a minimal `/admin/training` bridge page (Phase 57 D-14 bridge idiom, admin guard, `BackToSite`) linked from the Smoko admin card; add `journeys.ts` route for it. `scripts/dropped-features.json` entries use `{ feature, phase, kind: 'file'|'dir'|'route-page', path }` only (no symbol kinds). Tests to rewrite or delete are listed in RESEARCH (phase54 governance specs, phase57 retirement/machine-body/one-query/place/departments, phase28/29/30 governance specs, evals `governance`, `one-screen`, `sop-ledger`, `cut-features`, `dead-surface`).

### `tests/phase59/*` + `playwright.config.ts`

**Analog:** `playwright.config.ts` `phase58` project (lines ~682-698, deliberately broad `testMatch: /tests\/phase58\/.*\.(spec|test)\.ts$/`). Add `phase59` the same way and confirm with `npx playwright test --list --project=phase59` (CLAUDE.md 2026-05-25). Spec files per RESEARCH Validation map: `place-tab`, `shell-wide`, `inbox-model`, `office-pane-structure`, `signoff-actions`, `approve-actions`, `owner-review-meta`, `people-actions`, `access-mount`, `ledger-read`, `capability-matrix`, `retirement-sweep`, `repoint-inventory`. Behavioural wiring assertions (handler references the action), not token presence (CLAUDE.md 2026-06-05). Pure-module tests use static `@/` imports.

### `tests/phase59/ledger-rls-live.spec.ts`

**Analog:** `tests/phase58/focus-rls-live.spec.ts` lines 1-60: `PHASE58_LIVE=1` gate (use `PHASE59_LIVE=1`), `loadEnv()`, `mintAccessToken` (magic link then `verifyOtp`), `asUser(token)` client with Bearer header, throwaway orgs deleted in cleanup, re-read denied writes with the service client (silent zero-row denies). With A-04 there is no new policy, so the live probe proves: worker sees 0 decisions, supervisor sees 0 (no widening), admin sees own org only, cross-org 0, and the widened kind check accepts the three new kinds via `recordDecision`. Run once (shared OTP budget, CLAUDE.md 2026-09-28).

### `tests/evals/office.eval.ts` + `scripts/eval-fixtures.mjs`

**Analog:** `tests/evals/sop-focus.eval.ts` lines 1-50 (header rules, `SLOW = { timeout: 30_000 }`, `SHORT`, imports from `./lib/session` (`EVAL_ENV_READY`, `signInAs`, `EVAL_PLANT_SOP_TITLE`...) and `./lib/plant-fixture` (`ensurePlantFixture`, `REAL_SOPSTART_ORG_ID`, `shot`, `watchConsole`), `deleteEvalCompletions` from `./lib/completion-cleanup`, `TINY_PNG` buffer, service-client `beforeAll` that refuses the real org id). Keep `governance.eval.ts` fixture setup (unowned plant SOP + "EVAL Oven") or the unowned row will not exist. Assert by NAME not count; `toHaveCount(1)` short timeout before every click; `SLOW` after every `goto`; assert `shell-detail[data-place]` and rendered content, never HTTP status; second iteration (two completions, rejected walk re-shows "never done"); match owner picker items by email now that F-07 lands. Add idempotent `supervisor_assignments` seed (supervisor to worker) in `eval-fixtures.mjs` (select-then-insert idiom, lines ~206-270). Case list: RESEARCH "Deployed eval" 1-12.

### Config / maps (same-commit)

- `src/lib/journeys/journeys.ts`: replace `/governance`, `/admin/team`, `/admin/access` steps with `/?place=office&tab=...` routes that are real; add `/admin/training`.
- `src/lib/uat/tests.ts`: Office entries.
- `.planning/codebase/CAPABILITY-MATRIX.md`: add Office tab x role rows, owner mark-reviewed, self sign-off refusal; correct the supervisor "Approval chains" cell (A-02); do not rename the rows pinned by `tests/phase46/capability-matrix-doc.spec.ts` ("Governance queue", "Approval chains", "Manage team", "Sign off completion"), edit cells only.

## Shared Patterns

### Server-action guard and org scope
**Source:** `src/lib/auth/guards.ts` (`requireAdminContext`, `requireAdmin`), `src/actions/walk.ts` `sessionOrFail`
**Apply to:** `office.ts`, `auth.ts` people actions, `confirmSopCurrent`, `signOffCompletion`
Org, role, actor from `getSessionContext()` only; no `organisationId`/`userId`/`role`/`agent` parameter on any schema (CLAUDE.md 2026-09-30, 2026-10-03). Service-role writes carry `.eq('organisation_id', ctx.organisationId)`; never use the fetched row's org (2026-07-28). Privileged reads (photo signing, `getUserById`) in plain `src/lib/` modules (Phase 46 CR-01).

### Ledger write
**Source:** `src/lib/decisions/record.ts`
**Apply to:** every governance write in the Office
```ts
await recordDecision({ kind, subject: { kind, id }, sopId, summary, details })
```
Fail-soft; return `logged` so the UI says "· logged in the decision ledger" only when true. If a harness loads the touched path, add `recordDecision` to its `Module._load` stub list (`scripts/verify-gate-check.tsx`, `server-only`, CLAUDE.md 2026-10-04).

### Cache hygiene (no router.refresh)
**Source:** `AdminShell.tsx:31` (`SHELL_KEY`), TanStack Query
**Apply to:** all pane actions
`onDone` -> `invalidateQueries(['office-inbox'])` + `setQueryData(SHELL_KEY, ...)`; never `router.refresh()` or navigation from an effect (Next 16.2.1 orphaned action, CLAUDE.md 2026-09-29).

### `'use server'` rule
**Source:** `src/actions/walk.ts` header
Async exports only; `KIND_GROUPS`, label maps, cursor helpers, `office-tabs` live in plain modules (CLAUDE.md 2026-06-27).

### Tokens and lint
**Source:** `src/styles/blueprint-theme.css`, `tests/lint/design-tokens.spec.ts`
Tokens only (`text-accent-escalate`, `bg-accent-signoff/10`, `min-h-tap`, `rounded-lg`), no `[Npx]`; `lg:w-[58%]` is a percentage and allowed. Comments describe forbidden literals in words (CLAUDE.md 2026-09-28).

### Bundle gate
**Source:** `scripts/check-bundle-size.ts`, `.bundle-baseline.json`
Run `npm run build` in every plan that touches a shell or lazy seam; never recapture the baseline.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Sign-off / approve expansion (composed panels) | component | request-response | Composes `CompletionDetailClient` logic (being deleted) with `CompletionStepRow`; copy constants and gate behaviour, not layout |

## Metadata

**Analog search scope:** `src/components/{shell,focus,admin/governance,office-adjacent}`, `src/lib/{shell,governance,decisions,supabase}`, `src/actions/{walk,completions,auth,governance}`, `supabase/migrations`, `scripts`, `tests/{phase57,phase58,evals}`
**Files read:** ~14 directly, plus 59-CONTEXT, 59-RESEARCH (full) and 58-PATTERNS
**Pattern extraction date:** 2026-10-05
