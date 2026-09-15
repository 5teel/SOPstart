---
phase: 41-one-sop-surface
reviewed: 2026-09-15T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/app/(protected)/sops/page.tsx
  - src/components/sop/AdminSopSurface.tsx
  - src/components/sop/MillerPrimitives.tsx
  - src/components/sop/sops-nav-types.ts
  - src/components/sop/SopWorkerBrowser.tsx
  - src/components/sop/lenses/AdminStatusLens.tsx
  - src/components/sop/lenses/AdminAttentionLens.tsx
  - src/components/sop/lenses/AdminAccessLens.tsx
  - src/components/admin/SopMillerBrowser.tsx
  - src/actions/admin-sop-list.ts
  - src/actions/admin-access-view.ts
  - src/lib/sop-list/admin-rows.ts
  - src/lib/governance/flag-display.ts
  - src/app/(protected)/admin/sops/page.tsx
  - src/app/(protected)/admin/governance/page.tsx
  - src/components/layout/TopHeader.tsx
  - src/lib/auth/role-home.ts
  - src/lib/supabase/middleware.ts
  - src/app/api/version/route.ts
  - src/components/admin/wiring/WiringPatchBay.tsx
  - src/components/admin/wiring/SelectionStrip.tsx
  - src/components/admin/ParseJobStatus.tsx
  - src/components/admin/UploadDropzone.tsx
  - src/actions/ai-fields.ts
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
  - scripts/check-bundle-size.ts
  - scripts/capture-bundle-baseline.ts
  - scripts/run-evals.mjs
  - scripts/eval-fixtures.mjs
  - tests/evals/lib/session.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: resolved
---

# Phase 41: Code Review Report

**Reviewed:** 2026-09-15
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 41's data-boundary discipline is solid: `listAdminSopRows` and
`listAdminAccessData` both call `requireAdminContext()` as their first
statement, both use the session RLS client (never the service-role client),
and both are the *only* gate in front of that data now that `/admin/sops`'s
page-level redirect is gone — verified by tracing every downstream call
(`listOrgTree`, `listGrants`, `ensureSopCollections`, `listGovernanceQueue`)
back to its own `requireAdmin()`/`requireAdminContext()` call. The two legacy
redirect shims (`/admin/sops`, `/admin/governance`) keep the admin guard in
front of the destination and never redirect off-origin — no open-redirect
path. `/api/version` leaks only the build SHA. The render-slot seam
(`page.tsx` ↔ `AdminSopSurface`) has no render-phase `setState` loop:
`onNavChange` is only ever invoked from an effect or an event handler, and the
admin-takeover / admin-in-frame / worker-empty-state ordering is correct.

The one real security-relevant defect is in the **eval fixture bootstrap
script**, not the shipped app: it grants org membership/role to whatever
account currently holds the fixture email, without ever checking that the
account is the one *it* created. The rest of the findings are UX/maintenance
issues in the newly-extracted admin surface (dead code left behind by the
bundle-isolation extraction, an inconsistent URL-encoding pattern in one
redirect shim, and a couple of state-masking/dead-affordance UX gaps).

## Critical Issues

### CR-01: Eval fixture script can silently escalate an unrelated existing account to org admin

**File:** `scripts/eval-fixtures.mjs:10-15`
**Issue:** The script resolves the fixture user purely by email match against
*all* users in the project (`list.users.find(u => u.email === email)`), and
**only** checks `eval_fixture` metadata on the branch where it creates a new
user. If a user with `eval-admin@sopstart.com` / `eval-worker@sopstart.com`
already exists for any other reason (manually created, a stale account from
before this script existed, a typo'd signup, etc.) and is *not* the intended
synthetic fixture, the script unconditionally runs:
```js
await sb.from('organisation_members').upsert(
  { organisation_id: EVAL_ORG_ID, user_id: user.id, role },
  { onConflict: 'organisation_id,user_id' }
)
```
which grants that account **admin** (or worker) membership of the SOPstart
org — a privilege escalation of an account nobody vetted, from an idempotent
maintenance script that is expected to be re-run freely. This is exactly the
scenario the phase brief flagged: "the fixture script cannot escalate an
existing non-fixture account" — right now it can.
**Fix:** Gate the upsert on the account actually being the fixture (verify
metadata on the *found* branch too, not just the *created* branch), and abort
loudly instead of silently promoting an unexpected account:
```js
let user = list.users.find(u => u.email === email)
if (!user) {
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } })
  if (error) throw error
  user = data.user
  console.log('created', email)
} else if (user.user_metadata?.eval_fixture !== true) {
  throw new Error(`${email} exists but is not an eval fixture account (missing eval_fixture metadata) — refusing to grant org membership. Investigate before re-running.`)
}
const { error } = await sb.from('organisation_members').upsert({ organisation_id: EVAL_ORG_ID, user_id: user.id, role }, { onConflict: 'organisation_id,user_id' })
```

## Warnings

### WR-01: Redirect shim interpolates a user-controlled query param unescaped, unlike its sibling

**File:** `src/app/(protected)/admin/governance/page.tsx:33`
**Issue:** `redirect(filter ? \`/sops?view=attention&filter=${filter}\` : '/sops?view=attention')` interpolates the raw, decoded `filter` search param directly into the redirect target string. The sibling shim (`src/app/(protected)/admin/sops/page.tsx`) builds its equivalent redirect via `URLSearchParams`/`qp.set(...)` for every forwarded param, which properly percent-encodes special characters. Because `filter` here is not encoded, a value containing `&` injects extra query params onto the same-origin destination, and a value containing raw CR/LF (achievable via a decoded query string) risks Node's http layer rejecting the header outright (`ERR_INVALID_CHAR`, ends in a 500) rather than a clean redirect. There is no open-redirect risk today (the destination prefix `/sops?` is a fixed literal and `filter` is presently unread downstream), but the inconsistency is a live footgun the moment anything ever reads/echoes `filter` on the destination.
**Fix:**
```js
const qp = new URLSearchParams({ view: 'attention' })
if (filter) qp.set('filter', filter)
redirect(`/sops?${qp.toString()}`)
```

### WR-02: Mobile department-filter button is a dead affordance while an admin status lens is showing

**File:** `src/app/(protected)/sops/page.tsx:557-582` (vs. the guarded desktop equivalent at `:614-640`)
**Issue:** The desktop Miller scope column explicitly hides the worker's own "By department" filter group when an admin status scope is active (`!admin.hideWorkerSummary && (...)`, added specifically to avoid the duplicate-header bug caught in the 2026-09-15 deployed-site eval). The mobile scope strip has no equivalent guard: `WORKER_SCOPES` buttons, `{admin.mobileRows}`, and the "All departments" bottom-sheet trigger button all render unconditionally. `deptMatches`/`selectedDeptIds` only filter `workerSops` (consumed by `SopWorkerBrowser`), which is never rendered while `admin.inFrameElement` is truthy (`SopMillerBrowser` renders instead, full width, on all breakpoints since it has no `lg:`-only wrapper). So on a phone, while an admin is viewing e.g. "Drafts", the department-filter button is present, tappable, and opens the bottom sheet, but selecting a department changes nothing on screen — a confusing dead control.
**Fix:** Gate the button (and arguably the `WORKER_SCOPES` strip) the same way the desktop column does: `{!admin.hideWorkerSummary && (<button onClick={onOpenDeptSheet}>...</button>)}`.

### WR-03: `listAdminAccessData` silently swallows a `listGrants()` failure instead of surfacing it

**File:** `src/actions/admin-access-view.ts:80`
**Issue:** `const grants: GrantRow[] = 'error' in grantsResult ? [] : grantsResult.grants` — a transient failure in `listGrants()` (DB hiccup, RLS misconfiguration, etc.) is silently downgraded to "zero grants" rather than propagated the way `treeResult`'s error is (`if ('error' in treeResult) return { error: treeResult.error }`, two lines above). The wiring UI has no way to distinguish "this SOP/team genuinely has no access wired" from "the access data failed to load" — an admin could see an apparently-unwired collection, re-wire it from scratch, and end up with duplicate/conflicting grants once the underlying fetch issue is fixed and the original grants reappear.
**Fix:** Treat a `listGrants()` error the same as a `listOrgTree()` error — return `{ error: grantsResult.error }` from `listAdminAccessData` (or at minimum surface a distinct "partial data" flag to the lens) rather than defaulting to an empty array.

### WR-04: Two independent copies of `EMPTY_ADMIN` must be kept in sync by hand

**File:** `src/app/(protected)/sops/page.tsx:59-65` and `src/components/sop/AdminSopSurface.tsx:166-172`
**Issue:** `page.tsx` deliberately re-declares its own local `EMPTY_ADMIN` constant instead of importing the one exported from `AdminSopSurface.tsx`, because importing it would pull the whole admin chunk into the always-loaded worker bundle (the correct call, given SB-LINE-06). But that leaves `AdminSopSurface.tsx`'s exported `EMPTY_ADMIN` completely unused (confirmed — no other file imports it) while being the "canonical" shape of `AdminRenderProps`'s empty state. If a future change adds a field to `AdminRenderProps`, it is easy to update the exported copy (which looks like the source of truth) and forget the duplicate in `page.tsx`, silently reintroducing a bug in the worker path.
**Fix:** Delete the unused export from `AdminSopSurface.tsx` (or add a one-line comment there pointing at `page.tsx`'s copy as the one that actually matters), and add a lint/source-contract assertion that the two object literals stay structurally identical — the project already has precedent for this class of guard (e.g. `tests/phase30/list-rows.spec.ts` keeping `flag-display.ts` in sync with `GovernanceQueueRow.tsx`'s private copy).

## Info

### IN-01: `navsEqual` is dead code

**File:** `src/components/sop/AdminSopSurface.tsx:148-156`
**Issue:** `navsEqual(a, b)` is defined but never called anywhere in the file. Its shape (comparing every `SopNav` field) strongly suggests it was meant to guard the `onNavChange(resolved)` call inside the `useSearchParams()`-keyed effect (`:196-200`) so a chunk-load/deep-link resolution that produces an unchanged nav doesn't force an extra parent re-render — but that guard was never wired in, so the effect calls `onNavChange` with a brand-new object every time it fires, whether or not anything actually changed.
**Fix:** Either wire it in (`if (!navsEqual(nav, resolved)) onNavChange(resolved)`) or delete the function.

### IN-02: `admin/sops` and `admin/governance` shims still forward legacy `filter=` param that is a documented no-op

**File:** `src/app/(protected)/admin/sops/page.tsx:39`, `src/app/(protected)/admin/governance/page.tsx:33`
**Issue:** Confirmed pre-existing (not introduced by Phase 41 — `git show 4cdcc1b` shows the original `/admin/sops/page.tsx` already commented "Legacy ?filter= deep-links ... are accepted but ignored"), so not a regression. Flagging only because both shims still carry the dead param forward into the merged `/sops` surface, where `resolveAdminScope()` in `AdminSopSurface.tsx` doesn't read `filter` at all — a bookmarked `?filter=X` link degrades to plain "All SOPs" with no visible acknowledgement. Low priority; consider dropping the param from both shims now that the destination has no consumer for it, to avoid it looking load-bearing to a future reader.

---

_Reviewed: 2026-09-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (2026-09-15, commit `181f291`)

| Finding | Outcome |
|---------|---------|
| CR-01 fixture script escalation | Fixed — refuses any existing account without `eval_fixture` metadata |
| WR-01 governance shim raw interpolation | Fixed — `URLSearchParams`; phase28/phase30 pins repointed in the same commit |
| WR-02 dead mobile department control under admin lens | Fixed — gated on `hideWorkerSummary` like the desktop column |
| WR-03 swallowed `listGrants()` error | Fixed — returns `{ error }` |
| WR-04 duplicate `EMPTY_ADMIN` | Fixed — export removed from the lazy module; `page.tsx` copy is the only one |
| IN-01 dead `navsEqual` | Fixed — deleted |
| IN-02 legacy `filter=` forwarded by both shims | Accepted — pre-existing no-op, harmless; Phase 43 route-truth sweep owns it |
