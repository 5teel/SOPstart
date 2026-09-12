# Phase 41: One SOP Surface - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 13 (create/modify)
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(protected)/sops/page.tsx` (modify — add admin scope group + lens switch) | route/component | request-response + client-state | itself, current version (`sops/page.tsx:34-37` dynamic import, `:91,150-153` scope state) | exact (extend in place) |
| `src/app/(protected)/admin/sops/page.tsx` (rewrite → redirect shim) | route | request-response (redirect) | `src/app/(protected)/admin/governance/page.tsx` (Phase 30 shim) | exact |
| `src/components/sop/lenses/AdminStatusLens.tsx` (new) | component | CRUD (client fetch + render) | `src/components/admin/SopMillerBrowser.tsx` (wrap unchanged) + `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` (dynamic-import wrapper shape) | role-match |
| `src/components/sop/lenses/AdminAttentionLens.tsx` (new) | component | CRUD (client fetch + render) | `GovernanceQueueRow.tsx` (wrap unchanged) + `WalkthroughSwitcher.tsx` | role-match |
| `src/components/sop/lenses/AdminAccessLens.tsx` (new) | component | CRUD (client fetch + render) | `WiringPatchBayShell.tsx` (wrap unchanged) + `WalkthroughSwitcher.tsx` | role-match |
| `src/actions/sops.ts` or new `src/actions/admin-sop-list.ts` — `listAdminSopRows(params)` (new server action, extracted from `admin/sops/page.tsx:162-343`) | service (server action) | CRUD | `src/actions/governance.ts` (`listGovernanceQueue`) — same self-guarding action shape | exact |
| `src/components/layout/TopHeader.tsx` (modify `ADMIN_LINKS`) | component/config | request-response (nav) | itself, current `ADMIN_LINKS` array (lines ~141-147) | exact |
| `scripts/check-bundle-size.ts` (modify — route array) | utility/config (build gate) | batch (post-build check) | itself, current single-route implementation | exact |
| `scripts/capture-bundle-baseline.ts` (modify — route array) | utility/config | batch | itself, current single-route implementation | exact |
| `.bundle-baseline.json` (modify — add `/sops/page` key) | config | — | itself (`routes: Record<string,number>` already multi-key-shaped) | exact |
| `src/lib/journeys/journeys.ts` (modify) | config | — | Phase 30 governance-fold edits to journeys.ts (same file, same kind of edit) | exact |
| `tests/phase41/*.spec.ts` (new) | test | request-response / source-contract | `tests/phase30/dead-weight.spec.ts` (reference-sweep), `tests/phase30/admin-nav.spec.ts` (nav assertion) | exact |
| `playwright.config.ts` (modify — register `phase41` project) | config | — | `phase40` project entry (lines 526-528) | exact |

## Pattern Assignments

### `src/app/(protected)/sops/page.tsx` (route, client shell — modify)

**Analog:** itself (current file) — this is an extension, not a rewrite. Preserve every worker code path verbatim.

**Existing dynamic-import pattern to replicate for admin lenses** (`sops/page.tsx:34-37`):
```typescript
const SopWorkerBrowser = dynamic(
  () => import('@/components/sop/SopWorkerBrowser').then((m) => m.SopWorkerBrowser),
  { ssr: false }
)
```
Add sibling `dynamic()` calls for `AdminStatusLens`, `AdminAttentionLens`, `AdminAccessLens` — same `{ ssr: false }` shape. **Do not** statically import `SopMillerBrowser`, `WiringPatchBayShell`, `GovernanceQueueRow`, `DepartmentPicker`, or any `governance.ts`/`org-model.ts`/`grants.ts` action into this file — only through these dynamic wrappers (mirrors the `WalkthroughSwitcher.tsx` "sole allowed reference site" rule).

**Role-gating pattern** (`src/components/providers/RoleProvider.tsx`):
```typescript
export function useIsAdmin(): boolean {
  const role = useContext(RoleContext)
  return role === 'admin' || role === 'safety_manager'
}
```
Usage inside the page: `const isAdmin = useIsAdmin(); {isAdmin && <AdminScopeGroup .../>}` — zero new fetch, role already resolved server-side via `getSessionContext()` in `(protected)/layout.tsx`.

**Scope-state pattern already proven on this file** (worker dept filter, `sops/page.tsx:91`, `:150-153`) — reuse `useState` + `history.replaceState` for admin scope switches too; **do not** copy the admin page's `<Link href="/admin/sops?...">` navigation pattern (that is correct only for a server component's full re-render, and on the merged client page would trigger an RSC fetch through the service worker per the CLAUDE.md 2026-05-13 learning). Only the *initial* URL should be read via `useSearchParams()` on mount.

**Deep-link precedence to preserve exactly** (from `admin/sops/page.tsx:153-154`, `!isAccessView` guard): when the active scope is the access lens, `departments`/`collection` params must be ignored by that lens's own tree state — do not let them apply simultaneously with `view=access`.

---

### `src/app/(protected)/admin/sops/page.tsx` (rewrite → redirect shim)

**Analog:** `src/app/(protected)/admin/governance/page.tsx` (Phase 30 shim) — copy this shape exactly, adjusted for `/sops` as destination and to preserve `?view=`, `?departments=`, `?collection=`, `?sop=` (governance shim only remaps `?filter=`; this one must pass through 4 params).

```typescript
// Source: src/app/(protected)/admin/governance/page.tsx (existing code, full file)
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }
  const params = await searchParams
  const filter = params.filter
  redirect(filter ? `/admin/sops?view=attention&filter=${filter}` : '/admin/sops?view=attention')
}
```

**Adaptation notes:**
- The admin guard stays IN FRONT of the redirect (unauthenticated/unauthorised never learns destination shape) — keep this exact ordering.
- Build the destination query string from all 4 pass-through params (`view`, `departments`, `collection`, `sop`), not just one — construct via `URLSearchParams` rather than manual string interpolation since there are multiple optional params.
- Recommendation from RESEARCH (Open Question 2): keep this a page-level `redirect()`, not a `next.config.js` rewrite — matches this exact precedent and allows remapping if the merged page's param names differ.

---

### `src/components/sop/lenses/AdminStatusLens.tsx` / `AdminAttentionLens.tsx` / `AdminAccessLens.tsx` (new — thin client wrappers)

**Analogs:** the components being wrapped are unchanged; only a `useQuery` fetch wrapper is new.

**Wrapped component contract for AdminStatusLens** (`src/components/admin/SopMillerBrowser.tsx:1-60`):
```typescript
'use client'
// Sketch 005 variant C — the middle and right columns of the Miller layout.
// Selection lives in client state; the detail pane renders from data the list
// already carries. No query runs when you click a row.
export type MillerSop = { id: string; title: string | null; /* ...full shape... */ }
export function SopMillerBrowser({ sops, scopeLabel, departments }: {
  sops: MillerSop[]
  scopeLabel: string
  departments: Department[]
}) { ... }
```
`AdminStatusLens` supplies `sops`/`departments` via `useQuery` calling the new `listAdminSopRows(params)` action instead of the page's current server-side `Promise.all` fetch. Component itself is untouched — imported only inside the lens wrapper, never from `sops/page.tsx` directly.

**Dynamic-import wrapper shape** (reuse from `WalkthroughSwitcher.tsx:34-44`):
```typescript
const DesktopWalkthrough = dynamic(
  () => import('./DesktopWalkthrough').then((m) => ({ default: m.DesktopWalkthrough })),
  { ssr: false, loading: () => null }
)
```
Apply the identical `.then((m) => ({ default: m.X }))` shape when the target export is named, not default.

---

### `listAdminSopRows(params)` (new server action)

**Analog:** `src/actions/governance.ts` (`listGovernanceQueue`) and sibling `org-model.ts`/`grants.ts` actions — already `'use server'`, already self-guard via `requireAdminContext()`.

**Guard pattern to open with** (`src/lib/auth/guards.ts:22`):
```typescript
export async function requireAdminContext(): Promise<AdminContext | { error: string }> {
  // ... resolves session, checks role in ['admin','safety_manager'], returns
  // { error: string } on failure — every extracted action must check this
  // FIRST since /admin/sops's page-level redirect('/dashboard') safety net
  // is gone once /sops is reachable by every role.
}
```
Every new action this phase creates must call `requireAdminContext()` (or equivalent) and return `{ error }` on failure — this is not optional since there is no longer a page-level redirect gate in front of it.

**Do not re-derive inline** — extract `admin/sops/page.tsx:162-343` (status filter, draft-confidence sort, department/collection id resolution, `?sop=` collection-ensure, `NO_MATCH_ID` sentinel for empty `.in()` queries) verbatim into this action rather than reimplementing by eye.

---

### `src/components/layout/TopHeader.tsx` (modify `ADMIN_LINKS`)

**Analog:** itself — `ADMIN_LINKS` array (current lines ~141-147). Drop the `{ label: 'Manage SOPs', href: '/admin/sops' }` entry; keep Content/Team/Settings; add/repoint a Governance entry to `href: '/sops?view=attention'`.

**Note (RESEARCH correction):** `AdminNav.tsx` does not exist (deleted 2026-07-30) — do not create or edit it. `tests/phase30/admin-nav.spec.ts` already asserts `expect(fs.existsSync(ADMIN_NAV)).toBe(false)`; extend that spec or add a phase41 sibling, do not target a new file.

---

### `scripts/check-bundle-size.ts` / `scripts/capture-bundle-baseline.ts` (modify — generalize to route array)

**Analog:** itself, current single-route implementation (`check-bundle-size.ts:44-53`):
```typescript
const RSC_MANIFEST_PATH = path.join(
  NEXT_DIR, 'server', 'app', '(protected)', 'sops', '[sopId]',
  'page_client-reference-manifest.js'
)
const ROUTE = '/sops/[sopId]/page'
const TOLERANCE_KB = 2
```
Refactor into a loop over `[{ route: '/sops/[sopId]/page', rscManifestPath: ..., forbiddenMarkers: ['pdfjs','mammoth','konva',...] }, { route: '/sops/page', rscManifestPath: '.../sops/page_client-reference-manifest.js', forbiddenMarkers: ['WiringPatchBayShell','GovernanceQueueRow','SopMillerBrowser','DepartmentPicker','setSopCategory'] }]`. `.bundle-baseline.json`'s `routes: Record<string, number>` shape already supports the second key — no schema change needed, just a second capture run.

**Reusable helper, no rewrite needed** (`check-bundle-size.ts:172-231`):
```typescript
function findSymbolInBuildOutput(symbol: string): { found: boolean; locations: string[] } {
  // checks page bundle, react-loadable manifest, and static chunks
}
```
Call this with the new symbol names for the negative-assertion (chunk-absence) checks on `/sops/page`.

---

### `tests/phase41/*.spec.ts` (new test files)

**Analog 1 — reference-sweep pattern:** `tests/phase30/dead-weight.spec.ts:1-40` — pair `fs.existsSync(...).toBe(false)` for any deleted file with a `src/`-wide grep for lingering references (per the 2026-08-04 CLAUDE.md learning: "a deletion guard must assert the absence of REFERENCES, not just the absence of the file"). Apply this to the `/admin/sops` non-shim references inventory (RESEARCH Wave-0 gap: `ai-fields.ts:208,255`, `ParseJobStatus.tsx:317`, `role-home.ts:20`, `journeys.ts` ×6, `roles.ts` ×2, `uat/tests.ts` ×15).

**Analog 2 — nav assertion pattern:** `tests/phase30/admin-nav.spec.ts` — extend with an assertion that `Manage SOPs` is absent from `ADMIN_LINKS` and a `Governance` entry points to `/sops?view=attention`.

---

### `playwright.config.ts` (register `phase41` project)

**Analog:** `phase40` project entry (lines 526-528):
```typescript
{
  name: 'phase40',
  testDir: '.',
  testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/,
},
```
Copy verbatim with `phase40` → `phase41`. Per the 2026-05-25 CLAUDE.md learning, validate registration with `npx playwright test --list --project=phase41 | grep <filename>` after adding — an unregistered spec file silently never runs.

---

## Shared Patterns

### Bundle isolation via `next/dynamic({ ssr: false })`
**Source:** `src/components/sop/walkthrough/WalkthroughSwitcher.tsx:34-44`, `src/app/(protected)/sops/page.tsx:34-37`
**Apply to:** all three new lens components — this is the load-bearing mechanism for D-08; conditional JSX rendering alone does not keep the admin code out of the worker's shipped chunk, only `next/dynamic` code-splitting does.

### Role gating
**Source:** `src/components/providers/RoleProvider.tsx` (`useIsAdmin()`)
**Apply to:** `sops/page.tsx` scope-group rendering. UI-level gating is a UX convenience only — every server action behind a lens must independently self-enforce via `requireAdminContext()` since the page-level `redirect('/dashboard')` safety net (`admin/sops/page.tsx:130-135`) disappears once `/sops` is the shared route.

### Redirect shim preserving query strings
**Source:** `src/app/(protected)/admin/governance/page.tsx` (Phase 30 precedent, one level down the same pattern)
**Apply to:** `admin/sops/page.tsx` rewrite. Guard-before-redirect ordering must be preserved.

### URL state on hot click paths
**Source:** CLAUDE.md 2026-05-13 learning; existing pattern at `sops/page.tsx:91,150-153`
**Apply to:** all admin scope switches inside the merged page — `useState` + `history.replaceState`, never `router.push`/`<Link>` for in-page scope changes.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/journeys/journeys.ts` route/screen edits for the merge | config | — | Not a code pattern to copy — apply the phase's own route inventory directly per the file's existing structure (Phase 30's governance-fold edits are the closest precedent in kind, already listed above) |
| Two-vs-one server action split for `listAdminSopRows` vs access-lens data | service | CRUD | Open question in RESEARCH (recommendation: split into two — reuse `listOrgTree`/`listGrants` for access lens rather than inventing a new combined action); no existing single analog since the two are already independent branches in the current admin page |

## Metadata

**Analog search scope:** `src/app/(protected)/sops/`, `src/app/(protected)/admin/`, `src/components/sop/`, `src/components/admin/`, `src/components/layout/`, `src/lib/auth/`, `src/actions/`, `scripts/`, `tests/phase30/`, `playwright.config.ts`
**Files scanned:** RESEARCH.md's own exhaustive citations (13 full-file reads already performed by gsd-phase-researcher) plus 4 direct verification reads this pass (`SopMillerBrowser.tsx` head, `guards.ts` excerpt, `admin/governance/page.tsx` full, `check-bundle-size.ts` head, `playwright.config.ts` grep)
**Pattern extraction date:** 2026-09-13

## PATTERN MAPPING COMPLETE

**Phase:** 41 - One SOP Surface
**Files classified:** 13
**Analogs found:** 11 / 13

### Coverage
- Files with exact analog: 8
- Files with role-match analog: 3
- Files with no analog: 2 (journeys.ts edit is not a copyable pattern; server-action split is an open design question, not missing precedent)

### Key Patterns Identified
- The `next/dynamic({ ssr: false })` wrapper (`WalkthroughSwitcher.tsx`, already used in `sops/page.tsx` itself) is the single mechanism that satisfies both D-03 (rendering model) and D-08 (bundle isolation) — every new admin lens component must go through it, and nothing about `SopMillerBrowser`/`WiringPatchBayShell`/`GovernanceQueueRow` needs to change internally.
- The Phase 30 `admin/governance/page.tsx` redirect shim is a byte-level template for the new `admin/sops/page.tsx` shim — same guard-then-redirect ordering, just more pass-through params.
- Every server action this phase creates must open with `requireAdminContext()` because the page-level `redirect('/dashboard')` gate disappears entirely once `/sops` becomes the shared route — this is the one place where "copy the pattern" is a security requirement, not a style choice.

### File Created
`.planning/phases/41-one-sop-surface/41-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
