---
phase: 57-the-one-screen-its-places
reviewed: 2026-10-05T04:30:00Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - scripts/check-bundle-size.ts
  - scripts/eval-fixtures.mjs
  - src/actions/departments.ts
  - src/actions/shell.ts
  - src/app/(protected)/admin/access/page.tsx
  - src/app/(protected)/admin/settings/page.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
  - src/app/(protected)/admin/sops/new/blank/page.tsx
  - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
  - src/app/(protected)/governance/page.tsx
  - src/app/(protected)/layout.tsx
  - src/app/(protected)/pending/page.tsx
  - src/app/page.tsx
  - src/components/admin/governance/AdminMachinePanel.tsx
  - src/components/admin/site/DepartmentsStrip.tsx
  - src/components/admin/site/SiteEmptyState.tsx
  - src/components/admin/site/SiteWorkspace.tsx
  - src/components/admin/wiring/WiringPatchBay.tsx
  - src/components/layout/BackToSite.tsx
  - src/components/providers/ProtectedProviders.tsx
  - src/components/shell/AccountControl.tsx
  - src/components/shell/AdminRoomBodies.tsx
  - src/components/shell/AdminShell.tsx
  - src/components/shell/OfficeCard.tsx
  - src/components/shell/OneScreen.tsx
  - src/components/shell/RoomBodies.tsx
  - src/components/shell/ShellFrame.tsx
  - src/components/shell/SiteSummary.tsx
  - src/components/shell/WorkerShell.tsx
  - src/components/sop/lenses/AdminAccessLens.tsx
  - src/components/sop/plant/MachinePanel.tsx
  - src/components/sop/plant/NowCard.tsx
  - src/components/sop/plant/PlantStage.tsx
  - src/hooks/useCompletions.ts
  - src/hooks/useWorkerSops.ts
  - src/lib/auth/role-home.ts
  - src/lib/governance/load-inbox.ts
  - src/lib/shell/place.ts
  - src/lib/site/departments.ts
  - src/lib/site/rooms.ts
  - src/lib/sop/admin-health.ts
  - src/lib/sop/worker-signal.ts
  - src/lib/sop-list/admin-rows.ts
  - src/lib/supabase/middleware.ts
  - next.config.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 57: Code Review Report

**Reviewed:** 2026-10-05T04:30:00Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Phase 57 collapses the worker list, dashboard, departments and site pages into the one screen at `/` (list · isometric site · detail), adds the four rooms, moves the Access lens to `/admin/access`, and swaps the bundle gate onto `/page`. The security posture of the new code is sound: `getAdminShell()` takes zero parameters and self-guards, `archiveDepartment` / `updateDepartment` gained session-org predicates, the middleware redirects use fixed destinations and only forward `?sop=` when it is a UUID, `parsePlace` is a whitelist, `?machine=` on the wizard is UUID-checked and re-verified server-side, `eval-fixtures.mjs` refuses to touch any non-fixture account and only writes to the eval-site org, and `ownsSegmentChunk` cannot be made to drop a route's own chunks. No dead links to `/sops`, `/dashboard`, `/admin/departments`, `/admin/site` or `?view=library` remain in `src/`. `journeys.ts` and `CAPABILITY-MATRIX.md` were updated for the new routes and gates.

The defects found are correctness problems in the composed numbers and surfaces, not access control: the Smoko room attributes other people's walks to a supervisor/admin, two "waiting for sign-off" counts are derived from a row-limited list, a floor-read failure is rendered as "the site has not been drawn yet", the camera re-fits whenever the signed scene URL rotates, department removal ignores member links, and the `/page` bundle baseline was raised in-phase without the ROADMAP record the gate's own rule demands.

## Warnings

### WR-01: Smoko room shows OTHER people's walks as "on your record" for supervisors and admins

**File:** `src/components/shell/RoomBodies.tsx:59-73`, `src/hooks/useCompletions.ts:106-151`
**Issue:** `SmokoBody` is rendered for every role (`WorkerShell.tsx:104`, `AdminShell.tsx:130`) and reads `useWorkerCompletions()`, which selects `sop_completions` with no `worker_id` filter and relies on RLS. The `sop_completions` SELECT policies (`00010_completion_schema.sql`) give supervisors their supervised workers' rows and admins/safety managers every org row, so a supervisor or admin opening the Smoko room sees "47 walks on your record. Latest: <someone else's SOP>, <date>". This is the exact class `useWorkerSops` already fixed for its own completion read (its WR-02 comment at `useWorkerSops.ts:62-67`: "RLS alone is NOT a self-scope here"). The same hook also feeds the worker Office counts (`OfficeWorkerBody`), which are correct only because that branch is worker-only.
**Fix:** Scope the shared hook to the caller once, so every consumer is right:
```ts
// useCompletions.ts — useWorkerCompletions queryFn
const { data: { user } } = await supabase.auth.getUser()
const { data, error } = await supabase
  .from('sop_completions')
  .select(`...`)
  .eq('worker_id', user?.id ?? '')
  .order('submitted_at', { ascending: false })
  .limit(50)
```

### WR-02: "Waiting for sign-off" counts are computed from a 100-row list, so they under-count

**File:** `src/components/shell/AdminShell.tsx:89-90`, `src/components/shell/WorkerShell.tsx:59-60`, `src/hooks/useCompletions.ts:181`
**Issue:** `pendingSignOffs` / `pending` is `(signOffs.data ?? []).filter(c => c.status === 'pending_sign_off').length` over `useSupervisorCompletions({ type: 'all' })`, whose query is `.order('submitted_at', desc).limit(100)` across ALL statuses. Once an org has more than 100 completions, any pending row older than the 100 most recent is invisible to the count, so the Office pin, the Office card ("N waiting for your sign-off"), the Office body and the summary role line all under-report. D-16 ("pin and card never disagree") is preserved, but both agree on the wrong number. The worker-side `OfficeWorkerBody` counts have the same shape with `limit(50)`.
**Fix:** Count on the server, not from a page of rows:
```ts
// new small hook or inline in the two shells
useQuery({
  queryKey: ['completions', 'pending-count'],
  queryFn: async () => {
    const { count } = await createClient()
      .from('sop_completions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_sign_off')
    return count ?? 0
  },
})
```

### WR-03: A floor-read failure renders as "The site has not been drawn yet" with a Draw button

**File:** `src/actions/shell.ts:44-45`, `src/lib/governance/load-inbox.ts:33-39`, `src/components/shell/AdminShell.tsx:95`, `src/components/shell/ShellFrame.tsx:312-326`
**Issue:** `loadInbox()` keeps a `listSiteHealthForOrg()` error in `floor`, and `getAdminShell()` flattens it to `{ layout: null, machines: [], links: [], departments: [] }` with no error field. `AdminShell` therefore passes `loading=false` and an empty site to `ShellFrame`, which shows the `shell-no-site` empty state ("The site has not been drawn yet" + "Draw the site") for an org whose site exists but whose scene could not be signed (the one error path `listSiteForOrg` has). The inbox's machine items also silently vanish, so the Office count drops with no indication. The admin is told to redraw a site that is there.
**Fix:** Carry the error instead of swallowing it:
```ts
// shell.ts
const floorError = 'error' in inbox.floor ? inbox.floor.error : null
return { floor, floorError, ... }
// AdminShell.tsx
const loadError = isError ? 'Could not load the site.' : shell && 'error' in shell ? shell.error : data?.floorError ?? null
```
and have `ShellFrame` not offer "Draw the site" while `loadError` is set (pass `loading || !!loadError`, or a `siteError` prop).

### WR-04: The camera re-fits to the whole site whenever the signed scene URL rotates

**File:** `src/components/sop/plant/PlantStage.tsx:248-252`, `src/components/shell/AdminShell.tsx:88`, `src/components/shell/WorkerShell.tsx:51-55`
**Issue:** `PlantStage`'s mount-fit effect depends on `sceneUrl`. The scene URL is a freshly `createSignedUrl`'d string on every fetch of `getAdminShell()` / `listSiteForWorker()`. `AdminShell`'s `SHELL_KEY` query takes the QueryProvider default (`staleTime` 60 s, `refetchOnWindowFocus` on), so every time an admin tabs back after a minute the shell refetches, the URL changes, the `<img src>` swaps (reload/flash), and `fit()` runs, throwing the camera off the selected machine or room back to the full-site fit while the detail pane still shows that place. `ShellFrame`'s own camera effect does not re-fire (its deps are `placeKey`, `layout?.id`), so the stage and the selection disagree until the next click. The worker side only hits this after its 30-minute `staleTime`, but hits it the same way.
**Fix:** Fit on scene identity, not on the signed token:
```ts
// PlantStage.tsx
useEffect(() => { fit() }, [sceneWidth, sceneHeight]) // drop sceneUrl
```
and give the admin shell the same `staleTime: 30 * 60 * 1000` the worker query already carries (the inbox counts can be invalidated explicitly from `SiteEditSurface.refresh()`, which already does).

### WR-05: Department removal ignores member and content links, leaving orphaned junction rows

**File:** `src/actions/departments.ts:281-293`, `src/components/admin/site/DepartmentsStrip.tsx:71-75`
**Issue:** `archiveDepartment` refuses only while `site_machines` or `sop_departments` reference the department. `member_departments` (people, written by `assignMemberDepartments` in the same file) and `block_departments` are not checked, so a department with people in it archives cleanly and leaves their membership rows pointing at an archived department; `listDepartments()` still counts them (`people_count`) and `/admin/team`'s department chips keep showing it. The strip's refusal copy ("still used by N machines and N SOP rules") also cannot mention people, so an admin has no signal. D-22 named machines and visibility rules; the people link is the same "still in use" rule applied one table over (CLAUDE.md 2026-07-29: a sweep keyed on a planner's list misses the sibling table in the same file).
**Fix:**
```ts
const { count: memberCount } = await ctx.supabase
  .from('member_departments').select('member_id', { count: 'exact', head: true })
  .eq('department_id', departmentId)
const people = memberCount ?? 0
if (machines > 0 || sops > 0 || people > 0) return { error: 'Still in use', machines, sops, people }
```
and extend the strip's message with `plural(result.people ?? 0, 'person')`.

### WR-06: The `/page` bundle baseline was raised in-phase (792 → 831 KB) without the ROADMAP record the gate requires

**File:** `scripts/check-bundle-size.ts:18-39,228-234`, `.bundle-baseline.json` (`routes./page`, history entries dated 2026-10-05)
**Issue:** The gate's delta check is only as strong as the baseline it compares against. `.bundle-baseline.json` for `/page` moved 792 → 565 → 831 within Phase 57 (commits `3417aa51`, `517b2d27`, `c40b8fae`, `97644f21`). The file's own note says "Raising a value needs a signed-off decision recorded in ROADMAP", and CLAUDE.md 2026-09-13 says a baseline is a decision artefact an executor must never retune. The 831 entry is documented as a methodology correction (the earlier figure excluded the then-lazy WorkerShell chunk) and attributed to the orchestrator, which is the right actor, but `ROADMAP.md` contains no record of it (grep for `831` returns nothing). As it stands the one screen ships +36 KB over the retired list page with the authorising record living only inside the measuring instrument's data file.
**Fix:** Add the decision to ROADMAP (route, old/new value, reason: first like-for-like measurement with WorkerShell static, +36 KB accepted for stage + rooms + frame + Now card), or if it is not accepted, restore the `next/dynamic` WorkerShell split and the 565 KB value.

## Info

### IN-01: `setDepartmentOwner` is the one write in `departments.ts` still without the session-org predicate

**File:** `src/actions/departments.ts:339-342`
**Issue:** This phase added `.eq('organisation_id', ctx.organisationId)` to `updateDepartment` and `archiveDepartment` but left the sibling `setDepartmentOwner` update filtered on `id` alone. The `departments_admin_update` RLS policy is org-scoped, so a foreign id updates zero rows rather than a foreign row, but the action then returns `{ success: true }` for a no-op, and the file no longer has one consistent idiom.
**Fix:** Add `.eq('organisation_id', ctx.organisationId)` and treat an empty result as `'Department not found'`, matching `archiveDepartment`.

### IN-02: Wizard silently drops a failed machine link

**File:** `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx:99-103`
**Issue:** `await setSopMachines(...)` discards its result; on failure the admin lands in the builder with a SOP that is not on the machine they started from and no message. The comment calls this intentional, but the user has no way to know the placement did not happen.
**Fix:** Keep the navigation, but surface it: `const link = machineId ? await setSopMachines(...) : null` and push `?placed=0` (or a toast) when `'error' in link` so the builder can show "Not placed on its machine yet -- use Tools > Pick machines".

### IN-03: Two "Back" affordances on the builder

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx:391-401`, `src/components/layout/BackToSite.tsx`, `src/lib/shell/place.ts:47-55`
**Issue:** The builder keeps its wayfinder "Back to / The site" link (`/`) and now also sits under the layout's "Back to the site" bar (`placeForPath` falls through to `/`). Both go to the same place; the Delete action in the same shell goes to `/?place=workshop`. Not a bug, but one of the two is redundant and the three destinations are inconsistent.
**Fix:** Either return `null` from `placeForPath` for `/admin/sops/builder/*` (the builder owns its header), or drop the wayfinder back link; and map the builder to `/?place=workshop` so Back and Delete agree.

### IN-04: Primary scene image is `loading="lazy"`

**File:** `src/components/sop/plant/PlantStage.tsx:328-337`
**Issue:** The site scene is the stage's main content and is positioned inside a transformed container whose first-render `view` is null (`invisible`). `loading="lazy"` lets the browser defer the fetch until it judges the image near the viewport, which for an invisible, transformed element can mean after the camera fit, producing a blank stage followed by a late image.
**Fix:** Drop `loading="lazy"` (keep `decoding="async"`), or add `fetchPriority="high"`.

### IN-05: Fixture lookup is a single unpaginated `listUsers` page

**File:** `scripts/eval-fixtures.mjs:31`
**Issue:** `listUsers({ perPage: 500 })` is used to find every fixture account. Past 500 auth users the fixture may be missing from the page, and the script then calls `createUser` for an existing email and throws. It fails closed (good) but with a misleading "already registered" error rather than "page too small".
**Fix:** Look each fixture up directly instead of scanning a page -- `sb.auth.admin.listUsers` has no email filter, so use `sb.rpc`/`auth.users` via the Management API, or page through `listUsers` until found.

---

_Reviewed: 2026-10-05T04:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
