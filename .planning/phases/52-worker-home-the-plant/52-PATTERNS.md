# Phase 52: Worker Home — The Plant - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 16
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/actions/site-worker.ts` | service (server action) | CRUD (read-only) | `src/actions/site.ts` (`listSiteForOrg`) | exact (strip admin gate) |
| `src/components/sop/plant/PlantHome.tsx` | component (dynamic entry) | request-response | `src/components/sop/AdminSopSurface.tsx` (via its `dynamic()` wiring in `sops/page.tsx`) | role-match |
| `src/components/sop/plant/PlantScene.tsx` | component | transform/render | `src/lib/site/scene.ts` (pure math) + `.planning/sketches/007-plant-floor-navigation/index.html` | role-match |
| `src/components/sop/plant/MachinePanel.tsx` | component | request-response | `src/components/sop/SopWorkerBrowser.tsx` (detail pane + badge vocabulary) | role-match |
| `src/components/sop/plant/NowCard.tsx` | component | transform (pure pick fn + render) | `src/components/sop/SopWorkerBrowser.tsx` (`topSignal`) | role-match |
| `src/components/sop/plant/AskBar.tsx` | component | event-driven (filter-as-you-type) | `sops/page.tsx` existing search `<input>` block (lines ~232-256) | role-match |
| `src/components/sop/plant/pins.ts` | utility (pure) | transform | Code Example in RESEARCH.md `plantRelState`/`derivePlantPins`, sibling of `topSignal` in `SopWorkerBrowser.tsx` | exact (given) |
| `src/components/sop/plant/__tests__/pins.test.ts` | test (unit) | — | `phase15-unit` project test style (static `@/` imports) | exact |
| `src/app/(protected)/sops/page.tsx` (edit) | route/page (render seam) | request-response | Existing `isAdmin ? <AdminSopSurface>... : <SopsSection ...>` seam, same file | exact |
| `scripts/check-bundle-size.ts` (edit) | config/build-gate | batch (build-time) | Existing `/sops/page` `GATED_ROUTES` entry's `forbiddenMarkers` groups | exact |
| `scripts/eval-fixtures.mjs` (edit) | utility (fixture seeding) | batch | Existing `eval-site-admin` fixture block (lines 9-54, 98) | exact |
| `tests/evals/lib/session.ts` (edit) | utility (auth) | request-response | Existing session-minting helpers used by `site-editor.eval.ts` | exact |
| `tests/evals/plant-home.eval.ts` | test (eval) | event-driven (Playwright) | `tests/evals/site-editor.eval.ts` (Phase 51) | exact |
| `tests/phase52/*.spec.ts` | test (source-contract) | — | `tests/phase51/*.spec.ts`, `tests/phase26/konva-worker-isolation.spec.ts` | exact |
| `playwright.config.ts` (edit) | config | — | Existing `phase51` project registration | exact |
| `tests/phase26/konva-worker-isolation.spec.ts` (edit) | test (lint/source-contract) | — | Same file, extend `ALLOWED_DIRS`/assertions | exact |
| `src/lib/journeys/journeys.ts` (edit) | config (data-driven page) | — | Same file, existing `Journey`/`JourneyStep` shape | exact |

## Pattern Assignments

### `src/actions/site-worker.ts` (service, CRUD read-only)

**Analog:** `src/actions/site.ts`

**Header/contract-comment pattern** (lines 1-22):
```typescript
'use server'

/**
 * Phase 51 — site model server actions (D-01, D-02, D-04, D-05, D-07, D-12).
 * ...
 * All functions return a discriminated union `{ ... } | { error }` — never throw.
 * requireAdminContext() runs first in every export; ... Every query also adds
 * an explicit `.eq('organisation_id', orgId)` using the SESSION organisationId
 * (never a value read off a fetched row — 2026-07-28).
 */
```
For `site-worker.ts`: same doc-comment convention but state the file's OWN invariant — "every export is session-scoped, NOT admin-gated" — so a future source-contract spec (mirroring `site-actions-contract.spec.ts`) can assert it positionally, same as the admin file's own spec.

**Auth/org-scope pattern** (`listSiteForOrg`, lines 47-57):
```typescript
export async function listSiteForOrg(): Promise<SiteData | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const orgId = ctx.organisationId
  if (!orgId) return { error: 'No organisation' }
  const db = ctx.supabase as unknown as SupabaseClient

  const { data: layoutRow, error: layoutErr } = await db
    .from('site_layouts')
    .select('*')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: true })
```
For the worker variant: swap `requireAdminContext()` for `getSessionContext()` (session-only, no role gate — per CLAUDE.md 2026-06-26 learning, use the shared `React.cache()`d helper, never raw `atob`/`parseJwtPayload`). Keep the `.eq('organisation_id', orgId)` on every query verbatim — this is the recurring cross-tenant-leak class (2026-08-04 x2, 2026-07-28). `db` is cast `as unknown as SupabaseClient` because these three tables are not yet in `database.types.ts` — same cast needed here.

**Return-shape convention:** discriminated union `SiteData | { error }`, reuse `SiteLayout`/`SiteMachine`/`SopMachineLink`/`SiteDepartment` types from `@/lib/validators/site` (subset fields only per D-03 — layout id, signed scene URL, width/height, machine `{id, name, department_id, polygon, sprite signed URL?}`, plus `sop_machines` pairs).

**Signed URL / scene bucket pattern** — import directly, do not reimplement:
```typescript
import { scenePath, polygonWithinScene, newMachineCode, SCENE_BUCKET, SCENE_SIGNED_TTL_SEC } from '@/lib/site/scene'
```
`SCENE_BUCKET = 'site-scenes'`, `SCENE_SIGNED_TTL_SEC = 3600` — reuse these constants verbatim (D-03).

---

### `src/components/sop/plant/pins.ts` (utility, pure/transform)

**Analog:** RESEARCH.md Code Example (already the intended source) + `SopWorkerBrowser.tsx`'s `topSignal` (lines 59-65) as the sibling-classifier precedent (2026-09-27 "one classifier, not two" rule).

**topSignal — the classifier NOT to fork:**
```typescript
export function topSignal(sop: WorkerSop): { label: string; tone: 'bad' | 'warn' | 'info' } | null {
  if (!sop.isAssigned) return { label: 'Not yours', tone: 'info' }
  if (sop.isRefresherOverdue) return { label: 'Refresher overdue', tone: 'bad' }
  if (sop.hasNewerVersion) return { label: 'Updated since you read it', tone: 'warn' }
  if (sop.isRefresherDue) return { label: 'Refresher due', tone: 'warn' }
  if (!sop.lastCompletedAt) return { label: 'Not done yet', tone: 'info' }
  return null
}
```
Per RESEARCH.md Pattern 2 / Assumption A2: export `plantRelState` as a SIBLING function in this same `SopWorkerBrowser.tsx` file (not a fork in `pins.ts`), then `pins.ts` imports and calls it:
```typescript
export type PlantRel = 'due' | 'never' | 'new' | 'done' | null

export function plantRelState(sop: WorkerSop): PlantRel {
  if (!sop.isAssigned) return null
  if (sop.isRefresherOverdue || sop.isRefresherDue) return 'due'
  if (sop.hasNewerVersion) return 'new'
  if (!sop.lastCompletedAt) return 'never'
  return 'done'
}

export function derivePlantPins(
  machines: SiteMachine[],
  links: SopMachineLink[],
  sopsById: Map<string, WorkerSop>
): Map<string, number> {
  const pins = new Map<string, number>()
  for (const m of machines) {
    const sopIds = links.filter((l) => l.machine_id === m.id).map((l) => l.sop_id)
    const count = sopIds.filter((id) => {
      const rel = plantRelState(sopsById.get(id) as WorkerSop)
      return rel === 'due' || rel === 'never' || rel === 'new'
    }).length
    if (count > 0) pins.set(m.id, count)
  }
  return pins
}
```
**TONE map to reuse for badge colours** (`SopWorkerBrowser.tsx` lines 73-77, tokens only per design-token lint):
```typescript
const TONE: Record<'bad' | 'warn' | 'info', string> = {
  bad: 'bg-accent-escalate/14 text-[var(--accent-hazard)]',
  warn: 'bg-accent-decision/16 text-accent-decision',
  info: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
}
```

---

### `src/components/sop/plant/PlantScene.tsx` (component, transform/render)

**Analog:** `src/lib/site/scene.ts` (pure math — import, don't reimplement) + sketch `index.html`.

**Module header/contract** (lines 1-8):
```typescript
/**
 * Phase 51 -- pure scene helpers + editor prop contract (D-02, D-05, D-06, D-08).
 *
 * Plain module, no directive, no React/Konva/sharp/node: imports -- importable
 * from both client and server code. Only type-only imports from the validators.
 */
import type { Point, Polygon } from '@/lib/validators/site'
```
Import `fitView`, `zoomAt`, `centroid`, `polygonWithinScene` from this module. `fitView(W, H, sceneW, sceneH)` already returns `null` on `0×0` (Pitfall 5) — the caller MUST handle `null` via `ResizeObserver`, per RESEARCH.md's Code Example:
```typescript
const containerRef = useRef<HTMLDivElement>(null)
const [view, setView] = useState<View | null>(null)

useEffect(() => {
  const el = containerRef.current
  if (!el) return
  const doFit = () => {
    const v = fitView(el.clientWidth, el.clientHeight, sceneWidth, sceneHeight)
    if (v) setView(v)
  }
  doFit()
  const ro = new ResizeObserver(doFit)
  ro.observe(el)
  return () => ro.disconnect()
}, [sceneWidth, sceneHeight])
```
**Hydration-safety pattern** — mirror `useViewport()` (full file, 32 lines):
```typescript
'use client'

import { useEffect, useState } from 'react'

const DESKTOP_BREAKPOINT = '(min-width: 1024px)'

export function useViewport(): 'mobile' | 'desktop' {
  const [variant, setVariant] = useState<'mobile' | 'desktop'>('mobile')

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT)
    const update = () => setVariant(mql.matches ? 'desktop' : 'mobile')
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return variant
}
```
Never read `window`/`clientWidth` during initial render — same rule applies to `PlantScene`'s camera state (mount neutral, fit in an effect, per D-09 / 2026-06-08 learning).

---

### `src/components/sop/plant/NowCard.tsx`, `MachinePanel.tsx` (component, request-response)

**Analog:** `src/components/sop/SopWorkerBrowser.tsx`

**Doc-comment framing convention** (lines 1-20) — state what is intentionally NOT reused and why:
```typescript
'use client'

/**
 * Sketch 005 variant C, worker side — the list and detail columns...
 * Deliberately NOT a reuse of SopMillerBrowser. ...
 * All derivation (refresher state, newer-version detection, assignment origin)
 * stays in the page, which already owns the lineage-root and completion-clock
 * logic. This component renders what it is handed.
 */
```
Apply the same discipline: `NowCard`/`MachinePanel` render what `pins.ts` + the page hand them; no derivation logic inside the component.

**WorkerSop shape to consume (lines 27-45)** — reuse the type verbatim, do not redefine:
```typescript
export type WorkerSop = {
  id: string
  title: string
  categoryLabel: string | null
  lastCompletedAt: string | null
  isRefresherDue: boolean
  isRefresherOverdue: boolean
  hasNewerVersion: boolean
  isAssigned: boolean
  isSelfAssigned: boolean
  removalRequested: boolean
  raw: CachedSop
}
```
**Row meta pattern** (line 68) for the panel's SOP rows: `[sop.raw.sop_number, sop.categoryLabel, sop.raw.department].filter(Boolean).join(' · ')`.

**Walk/Read link convention** — `MachinePanel` rows link `Walk ›` to `/sops/[sopId]?tab=walk` and plain `Read` to `/sops/[sopId]` (D-11); use `next/link` `<Link>` exactly as `SopWorkerBrowser` does (imports `Link from 'next/link'`, icons from `lucide-react`).

---

### `src/components/sop/plant/AskBar.tsx` (component, event-driven filter)

**Analog:** `sops/page.tsx`'s existing search input (verbatim block to port, ~lines 232-256):
```tsx
<label className="relative order-last flex min-h-tap w-full items-center sm:ml-auto sm:min-h-9 sm:w-72">
  <Search size={16} className="pointer-events-none absolute left-3 text-[var(--ink-500)]" aria-hidden="true" />
  <input
    type="search"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search SOPs…"
    aria-label="Search SOPs"
    enterKeyHint="search"
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    className="h-full w-full rounded-lg border border-[var(--ink-300)] bg-white pl-9 pr-9 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
  />
  {query && (
    <button type="button" onClick={() => setQuery('')} aria-label="Clear search" ...>
      <X size={14} />
    </button>
  )}
</label>
```
Per D-13, this is the SAME input — the plant view uses this toolbar box as the ask bar; do not build a second search box. State-managed with `useState`, no `router.push` (2026-05-13 rule).

**Mic → voice modal wiring (D-13, resolved Q1):** import `WalkthroughVoiceModal` via `next/dynamic({ ssr: false })` inside the plant module — mirror the exact `dynamic()` call convention used for `SopWorkerBrowser`/`AdminSopSurface` in `sops/page.tsx`:
```typescript
const SopWorkerBrowser = dynamic(
  () => import('@/components/sop/SopWorkerBrowser').then((m) => m.SopWorkerBrowser),
  { ssr: false }
)
```
Next dedupes the chunk since `WalkthroughVoiceModal` is already dynamic-loaded elsewhere — no bundle cost (RESEARCH.md Open Question 1, resolved).

---

### `src/app/(protected)/sops/page.tsx` (edit — render seam)

**Analog:** same file's own admin/worker seam (lines 269-275, current):
```tsx
{isAdmin ? (
  <AdminSopSurface nav={nav} onNavChange={setNav} filter={query}>
    {(admin) => admin.takeoverElement ?? <SopsSection {...sectionProps} admin={admin} />}
  </AdminSopSurface>
) : (
  <SopsSection {...sectionProps} admin={EMPTY_ADMIN} />
)}
```
**Target shape per D-01/Pattern 3:**
```tsx
{isAdmin ? (
  <AdminSopSurface nav={nav} onNavChange={setNav} filter={query}>
    {(admin) => admin.takeoverElement ?? <SopsSection {...sectionProps} admin={admin} />}
  </AdminSopSurface>
) : showPlant ? (
  <PlantHome />
) : (
  <SopsSection {...sectionProps} admin={EMPTY_ADMIN} />
)}
```
where `showPlant = !isAdmin && variant === 'desktop' && hasSiteLayout === true` (loading/undefined defaults to `false` so the fallback list renders first — never a flash, per D-04/Pitfall 6). `PlantHome` declared via the SAME `dynamic()` pattern as `SopWorkerBrowser`/`AdminSopSurface` above (lines 44-50):
```typescript
const AdminSopSurface = dynamic(
  () => import('@/components/sop/AdminSopSurface').then((m) => m.AdminSopSurface),
  { ssr: false }
)
```
`isAdmin` resolution note (existing comment, line ~123): "computed synchronously since isAdmin is already resolved server-side (CLAUDE.md 2026-06-08 hydration class)" — no hydration risk on that flag; only `variant`/`hasSiteLayout` need the neutral-then-correct pattern (`useViewport()` already does this; the layout-existence check must be a `useQuery`, never an SSR prop, per Pitfall 6).

---

### `scripts/check-bundle-size.ts` (edit — add Konva marker group)

**Analog:** the existing `/sops/[sopId]/page` entry's Konva group (lines 74-77) — same file, same array, different route entry:
```typescript
{
  route: '/sops/[sopId]/page',
  ...
  forbiddenMarkers: [
    { label: 'pdfjs-dist (D-21-09)', markers: ['pdfjs-dist', 'PDFWorker', 'getDocument'] },
    { label: 'mammoth (D-21-09)', markers: ['mammoth', 'convertToHtml'] },
    { label: 'konva (26-05 D-03)', markers: ['react-konva', 'konva'] },
  ],
},
```
**Target edit** — add the same group to the `/sops/page` entry (currently lines 80-97, only 3 groups, no Konva):
```typescript
{
  route: '/sops/page',
  ...
  forbiddenMarkers: [
    { label: 'status lens (SopMillerBrowser.tsx)', markers: [...] },
    { label: 'governance/attention lens (GovernanceQueueRow.tsx)', markers: [...] },
    { label: 'access lens (WiringPatchBay.tsx)', markers: [...] },
    { label: 'konva (52-06 D-02)', markers: ['react-konva', 'konva'] },
  ],
},
```
Comment convention above the array (lines 60-62) explains WHY markers are string literals not identifiers ("production minification renames identifiers but preserves string literals") — keep consistent for the new group.

---

### `scripts/eval-fixtures.mjs` (edit — add eval-site worker + published SOP)

**Analog:** the existing `eval-site-admin` fixture block (lines 9-54, 98):
```javascript
// Phase 51 (51-07): a third fixture, eval-site-admin, is admin of its OWN org
// "SOPstart Eval Site" — the site-editor eval resets the org's site before ...
export const EVAL_SITE_ORG_NAME = 'SOPstart Eval Site'
export const EVAL_SITE_ADMIN_EMAIL = 'eval-site-admin@sopstart.com'
...
if (user && user.user_metadata?.eval_fixture !== true) throw new Error(`${email} exists but is not an eval fixture — refusing to change its membership`)
if (!user) { const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } }); if (error) throw error; user = data.user; console.log('created', email) }
...
const { error } = await sb.from('organisation_members').upsert({ organisation_id: siteOrg.id, user_id: siteAdmin.id, role: 'admin' }, { onConflict: 'organisation_id,user_id' })
```
**Target addition** — same `eval_fixture: true` metadata guard, same idempotent create+upsert idiom, for a new `eval-site-worker@sopstart.com` with `role: 'worker'` in `EVAL_SITE_ORG_NAME`, plus a PUBLISHED (not draft) fixture SOP linked to "EVAL Press" and assigned to this worker (Pitfalls 2 & 3 in RESEARCH.md — mandatory fix before the eval can pass).

---

### `tests/evals/plant-home.eval.ts` (test, eval)

**Analog:** `tests/evals/site-editor.eval.ts` (Phase 51) — session minting via `tests/evals/lib/session.ts`, same fixture-org pattern, same screenshot-then-assert style used across `tests/evals/*.eval.ts`. Follow its `beforeAll` session-mint + `test.describe` structure; assertions per D-16 (scene renders, ≥1 polygon, pin count ≥1, panel opens with badge, `Walk it` href `=== '/sops/<id>?tab=walk'`, chip changes transform, no `worker-miller-scope` testid, no console errors) plus the second no-site-org test using the real-org `eval-worker`.

---

### `tests/phase52/*.spec.ts` (test, source-contract)

**Analog:** `tests/phase26/konva-worker-isolation.spec.ts` (handler-wiring / grep style) and `tests/phase51/*.spec.ts` (per-requirement stub convention). Key idiom to copy — grep for the REAL wiring, not just string presence (2026-06-05 rule):
```typescript
function findStaticImports(specifierPattern: string): Hit[] { ... }
function violationsOutsideAllowedDir(hits: Hit[]): Hit[] {
  return hits.filter((h) => !ALLOWED_DIRS.some((dir) => h.file.startsWith(dir + '/')))
}
test('D-03: no static import of konva outside ...', () => {
  const hits = findStaticImports('konva')
  const violations = violationsOutsideAllowedDir(hits)
  expect(violations).toEqual([])
})
```
Extend `ALLOWED_DIRS` in the SAME `konva-worker-isolation.spec.ts` file is not needed (deny-by-default already covers `src/components/sop/plant/`) — D-15 asks only for an explicit assertion/comment, per RESEARCH.md's Don't-Hand-Roll table.

---

### `playwright.config.ts` (edit — register `phase52` project)

**Analog:** existing `phase51`-style project entries (lines 14-101, e.g.):
```typescript
{
  ...
  testMatch: /sb-auth-builder|sb-section-schema|.../,
},
```
Add a `phase52` project with a broad `testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/`, mirroring the pattern noted in RESEARCH.md ("mirrors `phase51`'s broad testMatch registration, per CLAUDE.md 2026-05-25"). Verify with `npx playwright test --list --project=phase52` before considering any spec "gated" (2026-05-25 learning — an unregistered spec never runs).

---

### `src/lib/journeys/journeys.ts` (edit)

**Analog:** same file's existing `Journey`/`JourneyStep` types (lines 16-35) — add/extend the worker `/sops` journey with the plant flow steps (fly-to, panel open, Walk it) using real `route` values (`/sops`, `/sops/[sopId]?tab=walk`) so `/pathways` coverage stays green (CLAUDE.md Pathways Map Maintenance trigger — mandatory same-commit edit for any new user-facing screen/flow).

## Shared Patterns

### Org-scoping on every new query (security-critical)
**Source:** `src/actions/site.ts` lines 47-57 (`.eq('organisation_id', orgId)` using SESSION org id, never a fetched-row value)
**Apply to:** `site-worker.ts` — every single query. This is the codebase's #1 recurring bug class (CLAUDE.md 2026-08-04 ×2, 2026-07-28, 2026-07-20, 2026-06-15).

### No hydration mismatch from window/navigator at first render
**Source:** `src/hooks/useViewport.ts` (full file, seeds `'mobile'`, corrects in `useEffect`)
**Apply to:** `PlantScene.tsx` camera state, `sops/page.tsx`'s `showPlant` gate, any `hasSiteLayout` query (must be `useQuery`, never an SSR prop).

### One classifier, not two
**Source:** `SopWorkerBrowser.tsx` `topSignal` (lines 59-65)
**Apply to:** `pins.ts`'s `plantRelState` — must live as a sibling export in `SopWorkerBrowser.tsx` itself, not a reimplementation elsewhere (2026-09-27 rule).

### Discriminated-union return + no-throw convention for server actions
**Source:** `src/actions/site.ts` header comment (lines 1-22)
**Apply to:** `site-worker.ts`'s `listSitePlantForOrg`/`listSiteForWorker` export.

### Dynamic-import isolation for heavy client trees
**Source:** `sops/page.tsx` lines 44-50 (`SopWorkerBrowser`/`AdminSopSurface` `dynamic({ ssr: false })`)
**Apply to:** `PlantHome` and the `WalkthroughVoiceModal` re-import inside the plant module.

## No Analog Found

None — every file in scope has a direct or role-matched analog already in the codebase; this phase is pure composition per RESEARCH.md's own conclusion.

## Metadata

**Analog search scope:** `src/actions/`, `src/components/sop/`, `src/lib/site/`, `src/hooks/`, `src/app/(protected)/sops/`, `scripts/`, `tests/evals/`, `tests/phase26/`, `tests/phase51/`, `src/lib/journeys/`, `playwright.config.ts`
**Files scanned:** `src/lib/site/scene.ts`, `src/hooks/useViewport.ts`, `src/actions/site.ts`, `src/components/sop/SopWorkerBrowser.tsx`, `src/app/(protected)/sops/page.tsx`, `scripts/check-bundle-size.ts`, `tests/phase26/konva-worker-isolation.spec.ts`, `scripts/eval-fixtures.mjs`, `playwright.config.ts`, `src/lib/journeys/journeys.ts`
**Pattern extraction date:** 2026-09-28
