---
phase: 34-supervisor-observations
reviewed: 2026-07-20T06:50:26Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/actions/observations.ts
  - src/app/(protected)/activity/SupervisorActivityView.tsx
  - src/app/(protected)/admin/settings/page.tsx
  - src/app/(protected)/profile/page.tsx
  - src/components/activity/CompletionSummaryCard.tsx
  - src/components/admin/observations/ObservationLabelsCard.tsx
  - src/components/admin/org-model/OrgChartCanvas.tsx
  - src/components/admin/org-model/OrgColumnsBoard.tsx
  - src/components/admin/org-model/PersonPanel.tsx
  - src/components/admin/org-model/TeamViewShell.tsx
  - src/components/observations/ObservationRow.tsx
  - src/components/observations/RecordObservationModal.tsx
  - src/components/observations/VerdictButtons.tsx
  - src/components/profile/ObservationsSection.tsx
  - src/lib/journeys/journeys.ts
  - src/lib/uat/tests.ts
  - src/lib/validators/observations.ts
  - supabase/migrations/00052_supervisor_observations.sql
  - supabase/migrations/00053_sop_observations_cross_org_guard.sql
  - tests/phase34/observation-cross-org-isolation.spec.ts
  - tests/phase34/observation-immutability.spec.ts
  - tests/phase34/record-observation.spec.ts
  - tests/phase34/sop-version-stamp.spec.ts
  - tests/phase34/worker-observation-visibility.spec.ts
findings:
  critical: 2
  warning: 7
  info: 7
  total: 16
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-20T06:50:26Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the supervisor-observations feature end to end: migrations 00052/00053 (RLS + append-only + cross-org guard), the server-action layer (`observations.ts`), the shared modal + entry points (PersonPanel, Activity), the worker self-read surface (/profile), the labels editor, and the phase34 spec suite. `journeys.ts` and `uat/tests.ts` were both updated with the new flows (routes are real), all referenced CSS custom properties are declared in `blueprint-theme.css`, no `atob` JWT decoding, every server entrypoint uses `getSessionContext()`, and all value exports of the `'use server'` file are async. The append-only invariant (no UPDATE/DELETE policy) is genuinely enforced at the DB level and proven by live runtime tests.

Two Critical findings survive that discipline: (1) the SELECT policy's org branch has **no role check**, so a plain worker can read every peer's `needs_support` verdicts and supervisor notes directly via PostgREST — contradicting both the phase's own privacy framing and the role-scoped read precedent this table claims to model; (2) the D-06 "assigned-first" SOP picker silently no-ops for **supervisors** (the primary recorder persona) because `sop_assignments` RLS filters out every row the two assignment queries ask for.

## Structural Findings (fallow)

_No structural pre-pass was provided for this review._

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Any org member — including plain workers — can read every observation in the org via PostgREST

**File:** `supabase/migrations/00052_supervisor_observations.sql:34-40`
**Issue:** The read policy is:

```sql
using (
  organisation_id = public.current_organisation_id()
  or observed_worker_id = auth.uid()
)
```

The first branch carries **no role restriction**. RLS is the only enforcement surface here (the phase's own D-12 design says so, and the SC-4 spec confirms "RLS is the only enforcement surface"). The server actions gate `listObservationsForPerson` to recorder roles, but any authenticated worker can bypass the actions entirely with `supabase.from('sop_observations').select('*')` against the public REST API and receive **every observation in their org** — peers' `needs_support` verdicts and the supervisor's free-text coaching notes. This is exactly the sensitive class the phase frames as "coaching evidence, not surveillance" and it directly contradicts:

- the migration's own inline comment ("worker self-read, **own rows only**"),
- the closest precedent this table models, `sop_completions` (00010), where every org-wide SELECT branch is role-scoped (`workers_see_own_completions` / `safety_managers_see_all` / `admins_see_all` / supervisor-via-assignment),
- the phase's stated safety invariant (worker read = self only).

The SC-4 runtime test only probes a **supervisor** session cross-org; no test exercises a plain **worker** session reading same-org peers' rows, which is why this shipped green.
**Fix:** New migration restricting the org branch to recorder roles, mirroring 00010:

```sql
drop policy if exists sop_observations_read_org on public.sop_observations;
create policy sop_observations_read_org on public.sop_observations
  for select to authenticated
  using (
    (
      organisation_id = public.current_organisation_id()
      and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    )
    or observed_worker_id = auth.uid()  -- OBS-02: worker self-read, own rows only
  );
```

Add a live runtime assertion (same ephemeral-org pattern as the immutability spec): a same-org `worker` session selecting `sop_observations` must return only rows where `observed_worker_id = self`.

### CR-02: D-06 "assigned-first" picker silently returns zero assignments for supervisor callers — RLS filters both queries

**File:** `src/actions/observations.ts:229-243` (with `supabase/migrations/00007_sop_assignments.sql:23-44`)
**Issue:** `listWorkerSopsForPicker` queries `sop_assignments` with the **session client**:

- individual: `.eq('user_id', workerId)` — but `workers_can_view_own_assignments` only exposes rows where `user_id = auth.uid()` (the *caller*, not the target worker), and `admins_can_manage_assignments` only covers `admin`/`safety_manager`. For a **supervisor** caller, every individual-assignment row of the observed worker is RLS-filtered → always `[]`.
- role: `.eq('role', workerMember.role)` — the worker's role is `'worker'`, but the RLS role branch only exposes rows where `role = current_user_role()` (i.e. `'supervisor'` for the caller) → always `[]`.

Net effect: for the phase's **primary recorder persona** (supervisor, entry points on /activity and the person panel), `assignedIds` is always empty — no "Required" tags, no assigned-first ordering, ever. No error is raised (RLS filtering is silent), so this passed every gate. Admin/safety-manager callers happen to work, which will mask the bug in admin-driven UAT. This is the same silent-RLS-filter class as the [2026-06-15] learning, on the read side.
**Fix:** Either (a) role-gate the action to recorder roles (it currently has no role check at all — see WR-08 note inside) and perform the two `sop_assignments` reads via `createAdminClient()` with explicit `.eq('organisation_id', organisationId)` self-scoping on both queries, or (b) add a SELECT policy letting supervisors read assignments org-wide:

```sql
create policy "recorders_can_view_org_assignments"
  on public.sop_assignments for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() = 'supervisor'
  );
```

Then verify with a live test as a supervisor session that an individually-assigned SOP comes back `assigned: true`.

## Warnings

### WR-01: `setObservationLabels` has no runtime input validation — non-string/unbounded values land in `organisations.observation_labels` and can crash every render that consumes them

**File:** `src/actions/observations.ts:90-105`
**Issue:** Server actions receive untrusted client input; TypeScript parameter types are erased at runtime. `input.performed_to_sop` is spread straight into a jsonb write with no Zod parse — an admin-role client can submit an object, array, number, or a multi-megabyte string. A non-string value then flows out of `getObservationLabels()` into `VerdictButtons` / `ObservationRow` JSX (`{labels[verdict]}`), where a non-primitive throws "Objects are not valid as a React child" — crashing the record modal and every worker's /profile page org-wide. This violates the project convention "Zod schemas in `src/lib/validators/` for all form/API validation" — the write path in the same feature (`RecordObservationSchema`) does it correctly.
**Fix:** Add to `src/lib/validators/observations.ts` and parse at the top of the action:

```ts
export const ObservationLabelsSchema = z.object({
  performed_to_sop: z.string().trim().min(1).max(80).optional(),
  needs_support: z.string().trim().min(1).max(80).optional(),
})
```

Also add `maxLength={80}` to the two inputs in `ObservationLabelsCard.tsx`.

### WR-02: `completionId` is not validated against the org / worker / SOP — cross-org and mismatched completion links are accepted

**File:** `src/actions/observations.ts:52-61` (and `supabase/migrations/00053:39`)
**Issue:** Migration 00053 closes the cross-org hole for `sop_id` and `observed_worker_id`, but `completion_id` is only FK-checked for existence — a crafted `recordObservation` call can attach (a) another org's completion id, or (b) a same-org completion belonging to a different worker or a different SOP than the observation claims. Since `completion_id` is the D-11 evidence link that Phase 35's competency engine will presumably traverse, a mismatched link is corrupted audit evidence in an append-only table — it can never be fixed by update.
**Fix:** When `completionId` is provided, verify before insert with the session client (RLS-visible to recorders):

```ts
if (completionId) {
  const { data: completion } = await supabase
    .from('sop_completions')
    .select('id')
    .eq('id', completionId)
    .eq('organisation_id', organisationId)
    .eq('worker_id', workerId)
    .eq('sop_id', sopId)
    .maybeSingle()
  if (!completion) return { success: false, error: 'Completion does not match this worker and SOP.' }
}
```

(Or extend `sop_observation_refs_in_org` to take `p_completion_id` and enforce it in the policy.)

### WR-03: `sop_observation_refs_in_org` is a PostgREST-exposed SECURITY DEFINER oracle for cross-org membership and SOP existence

**File:** `supabase/migrations/00053_sop_observations_cross_org_guard.sql:20-30`
**Issue:** Every Postgres function is auto-exposed at `POST /rest/v1/rpc/sop_observation_refs_in_org` with default EXECUTE granted to PUBLIC. Any authenticated user from any org can pass arbitrary `(sop_id, worker_id, org_id)` triples and receive a boolean confirming "user X is a member of org Y" / "SOP S belongs to org Y" — the function is SECURITY DEFINER precisely so it bypasses the caller's RLS. This is the exact class the [2026-07-05] learning locked down for `match_sop_agent_metadata` ("a SECURITY DEFINER function is EITHER self-scoping via auth.uid() … OR locked to service_role — never both"). It cannot be revoked from `authenticated` (the RLS policy evaluates it as the calling role), so it must self-scope.
**Fix:** New migration making the function inert for foreign orgs — the policy always passes the caller's own org, so this changes nothing for legitimate inserts:

```sql
create or replace function public.sop_observation_refs_in_org(p_sop_id uuid, p_worker_id uuid, p_org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    p_org_id = public.current_organisation_id()
    and exists (select 1 from public.sops s where s.id = p_sop_id and s.organisation_id = p_org_id)
    and exists (select 1 from public.organisation_members m where m.user_id = p_worker_id and m.organisation_id = p_org_id)
$$;
```

### WR-04: Modal can save against an invisible SOP — `sopId` preset survives even when the SOP isn't in the picker list

**File:** `src/components/observations/RecordObservationModal.tsx:36,48,85-86,153`
**Issue:** `sopId` is seeded from `presetSopId`, but the "selected" card renders from `selectedSop = sops.find(...)`. If the preset SOP is not in `listWorkerSopsForPicker`'s results (SOP archived/unpublished after the completion was submitted — the "I observed this" row action passes completions' `sop_id` regardless of current status), `selectedSop` is `null`, so the UI shows the *unselected* search state — yet `canSave` is still true (`Boolean(sopId && verdict)`). The supervisor sees no SOP chosen, picks a verdict, hits Save, and records an observation against a SOP they never saw selected. Same divergence window exists while `loadingSops` is true.
**Fix:** Derive save-ability and display from one source. Simplest: clear a preset that fails to resolve once sops load:

```ts
setSops(fetchedSops)
setSopId((cur) => (cur && !fetchedSops.some((s) => s.id === cur) ? null : cur))
```

and/or gate `canSave` on `Boolean(selectedSop && verdict) && !busy && !loadingSops`.

### WR-05: Unhandled promise rejections leave permanent "Loading…" states in modal and person panel

**File:** `src/components/observations/RecordObservationModal.tsx:62-69`; `src/components/admin/org-model/PersonPanel.tsx:50-57`
**Issue:** Both `Promise.all([...]).then(...)` chains have no `.catch`. A rejected server-action call (network drop — this is a PWA for on-site use — or a thrown error in the action) leaves `loadingSops`/`loading` stuck at `true` forever ("Loading SOPs…" with no retry, Save unreachable) plus an unhandled rejection in the console. `OrgColumnsBoard.tsx:49` has the same pattern on `getTeamMembersWithEmails()`.
**Fix:** Add `.catch` that flips loading off and surfaces the error state, e.g. in the modal:

```ts
.catch(() => { if (!cancelled) { setLoadingSops(false); setError('Could not load SOPs — check your connection and reopen.') } })
```

### WR-06: Person chips are click-only `<span>`s — new interactive affordance with no keyboard or AT access

**File:** `src/components/admin/org-model/OrgChartCanvas.tsx:237-249`; `src/components/admin/org-model/OrgColumnsBoard.tsx:109-121`
**Issue:** Phase 34-06 made person chips the entry point to PersonPanel by putting `onClick` on a `<span>` with no `role="button"`, no `tabIndex`, no key handler. The feature (D-03 entry A) is unreachable by keyboard and invisible to assistive tech in both org views. Accessibility basics on a newly-added interactive control are in the never-simplify-away set.
**Fix:** Render clickable chips as `<button type="button" className="person-chip …">` (or add `role="button" tabIndex={0}` + Enter/Space handler if the button element fights the chip CSS).

### WR-07: `useWorkerProfiles` fetches rows and discards everything — worker names can never be real, and the observation record inherits the placeholder

**File:** `src/app/(protected)/activity/SupervisorActivityView.tsx:21-39,59-65`
**Issue:** The hook selects only `user_id` from `organisation_members` — data the caller already has in `workerIds` — then fabricates `Worker ${id.slice(0,8)}`. So the "Record observation" worker picker, the modal's locked worker chip, and the privacy line "Visible to Worker 3fa4b2c1" all show opaque UUID fragments. This is the [2026-07-13] "hook fetched the data then threw it away" class: the query exists but returns nothing usable, and the fetch itself is a no-op round trip. A supervisor picking between "Worker 8a4f21bc" and "Worker 8a4f30d1" is a real mis-record risk on an append-only table.
**Fix:** Resolve display names (email at minimum) — e.g. widen the recorder-safe path: have a server action return `{user_id, email}` for the org's members to recorder roles (note `getTeamMembersWithEmails` is admin/safety_manager-gated, so it can't be reused as-is for supervisors), and use it in `workerMap`.

## Info

### IN-01: Migration 00052's comment claims a nonexistent "admin-update policy on organisations"

**File:** `supabase/migrations/00052_supervisor_observations.sql:58-60`
**Issue:** The D-02 comment says "the existing admin-update policy on organisations (00001_foundation_schema.sql) already gates writes." No UPDATE policy on `organisations` exists in any migration — 00002 grants SELECT only (which is exactly why `setObservationLabels` needs the admin client, per its own correct comment in `observations.ts:107-110`).
**Fix:** Correct the comment so the next reader doesn't assume an RLS write gate exists.

### IN-02: `resolveDisplayNames` lists all platform users capped at 1000 — observer names silently degrade to "Unknown"

**File:** `src/actions/observations.ts:141-152`
**Issue:** `listUsers({ perPage: 1000 })` is a single unpaginated platform-wide page; beyond 1000 auth users, observer attribution on worker profiles shows "Unknown". Also duplicates the email-resolution idiom in `actions/auth.ts:getTeamMembersWithEmails` (same cap there).
**Fix:** Paginate or query `admin.auth.admin.getUserById` per distinct id (observers per page are few); consider one shared resolver.

### IN-03: Tautological assertion in the immutability spec

**File:** `tests/phase34/observation-immutability.spec.ts:182,220`
**Issue:** `expect(updateErr === null || updateErr.message).toBeTruthy()` passes for any error object with a non-empty message and for null — it asserts nothing. The real guarantee is carried solely by `toHaveLength(0)` + the unchanged-row re-read (which are sound).
**Fix:** Drop the line or assert the specific acceptable outcomes (`updateErr === null || /permission|policy/i.test(updateErr.message)`).

### IN-04: `workerIds.sort()` mutates a memoized array inside the query key

**File:** `src/app/(protected)/activity/SupervisorActivityView.tsx:23`
**Issue:** `.sort()` mutates the `useMemo`-cached `workerIds` in place during render — downstream consumers (`workerOptions`) see the array reordered without a dependency change. Currently benign, but it's a latent shared-state mutation.
**Fix:** `[...workerIds].sort().join(',')` (or `workerIds.toSorted()`).

### IN-05: Unused `role` prop on `SupervisorActivityView`

**File:** `src/app/(protected)/activity/SupervisorActivityView.tsx:47`
**Issue:** `role` is destructured to `_role` and never used; the prop and its interface field are dead weight.
**Fix:** Remove the prop or use it (e.g. to widen the record button to admins).

### IN-06: `formatNZDateTime` duplicated

**File:** `src/components/observations/ObservationRow.tsx:11-23`; `src/components/activity/CompletionSummaryCard.tsx:28-38`
**Issue:** Byte-identical helper in two components in the same feature surface.
**Fix:** Hoist to a shared `src/lib` date util.

### IN-07: `recordObservation` accepts non-published SOPs on direct calls

**File:** `src/actions/observations.ts:48-50`
**Issue:** The UI picker lists only `status = 'published'`, but the action's version lookup doesn't filter status — a crafted call can append an observation against a draft/parsing SOP (stamping whatever `version` it holds). Low impact, but the append-only nature means bad rows are permanent.
**Fix:** Add `.eq('status', 'published')` to the version lookup and return a distinct error.

---

_Reviewed: 2026-07-20T06:50:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
