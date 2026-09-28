# Phase 51: Site Model & Machine Editor - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 14
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/00067_site_model.sql` | migration | CRUD | `supabase/migrations/00061_sops_select_org_scope.sql` + `00062_org_members_update_check_org_scope.sql` + `00059_sop_videos_storage_scope.sql` | exact |
| `src/actions/site.ts` | service (server actions) | CRUD | `src/actions/departments.ts` (`assignMemberDepartments`, `callerOrgId`, `orgScopedDeptIds`) | exact |
| `src/app/api/admin/site/generate/route.ts` | route (API) | request-response (external call) | none in-repo (no prior Gemini call) | no analog — use RESEARCH.md Gemini REST example |
| `src/app/(protected)/admin/site/page.tsx` | route (server component) | request-response | any `admin/*/page.tsx` using `requireAdminContext()` (pattern in `src/lib/auth/guards.ts`) | role-match |
| `src/app/(protected)/admin/site/SiteEditorLoader.tsx` | provider (dynamic loader) | — | `src/components/admin/builder-v2/visual/AnnotationEditorLoader.tsx` | exact |
| `src/components/admin/site/SiteEditor.tsx` | component (canvas editor) | event-driven | `src/components/admin/builder-v2/visual/AnnotationEditor.tsx` | exact |
| `src/components/admin/sop/SopMachinePicker.tsx` (new ToolsMenu modal) | component | request-response | `BuilderFlowButton.tsx` (portaled-modal pattern) | exact |
| `BuilderStageShell.tsx` `ToolsMenu` (edit — new row) | component | event-driven | `ToolsMenu` function itself, existing rows | exact (same file) |
| `src/components/layout/TopHeader.tsx` (edit `ADMIN_LINKS`) | config/nav | — | existing `ADMIN_LINKS` array | exact |
| `src/lib/journeys/journeys.ts` (edit) | config | — | existing `Journey`/`JourneyStep` entries | exact |
| `tests/phase51/*.spec.ts` | test | CRUD / request-response | `tests/lint/rls-org-scope.spec.ts`, sibling `phase4x` runtime specs | role-match |
| `tests/evals/site-editor.eval.ts` | test (deployed eval) | event-driven | `tests/evals/sop-surface.eval.ts` | exact |
| `playwright.config.ts` (add `phase51` project) | config | — | existing `phase40`/`phase41`/`phase46` project blocks | exact |
| `tests/phase26/konva-worker-isolation.spec.ts` (edit allow-list) | test (lint) | — | itself — widen `ALLOWED_DIR` to an array | exact |

## Pattern Assignments

### `supabase/migrations/00067_site_model.sql` (migration, CRUD)

**Analogs:** `00061_sops_select_org_scope.sql`, `00062_org_members_update_check_org_scope.sql`, `00059_sop_videos_storage_scope.sql`

Table + two-policy shape (SELECT org-scoped, ALL admin/safety_manager with `WITH CHECK` restating `USING`) — already fully spelled out in RESEARCH.md "RLS migration shape to copy" and "Storage bucket + org-scoped storage RLS" code blocks (lines 325-381 of RESEARCH.md). Copy verbatim, repeat for `site_machines` and `sop_machines` with `organisation_id` denormalised on each row (no subqueries — avoids the 00030/00031 recursion class).

**FK cascade** (D-13, Pitfall 4): explicit named clauses —
```sql
machine_id uuid not null references public.site_machines(id) on delete cascade,
sop_id uuid not null references public.sops(id) on delete cascade,
department_id uuid references public.departments(id) on delete set null
```

**Validation gate:** `tests/lint/rls-org-scope.spec.ts` runs generically over all migrations — no edit needed, just conform to the shape.

---

### `src/actions/site.ts` (service, CRUD)

**Analog:** `src/actions/departments.ts`

**Imports pattern** (departments.ts lines 22-27):
```typescript
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
```
(Do NOT import `materializeSopAccess` — that's `assignSopDepartments`'s grants-layer concern, explicitly not applicable here per RESEARCH.md Anti-Patterns.)

**Auth/org-scope helper pattern** (departments.ts lines 338-360, copy renamed for machines):
```typescript
async function orgScopedDeptIds(admin: any, organisationId: string, ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return []
  const { data } = await admin
    .from('departments')
    .select('id')
    .eq('organisation_id', organisationId)
    .in('id', ids)
  return ((data ?? []) as Array<{ id: string }>).map(d => d.id)
}

async function callerOrgId(admin: any, ctx: AdminCtx): Promise<string | null> {
  const { data } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', ctx.user.id)
    .maybeSingle()
  return (data?.organisation_id as string | undefined) ?? ctx.organisationId
}
```

**Core junction-write pattern to mirror for `setSopMachines`** (departments.ts lines 365-416, `assignMemberDepartments`):
```typescript
export async function assignMemberDepartments(memberId: string, departmentIds: string[]) {
  if (!memberId) return { error: 'memberId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Guard: parent row must belong to the caller's organisation.
  const { data: memberRow } = await admin
    .from('organisation_members').select('organisation_id')
    .eq('user_id', memberId).maybeSingle()
  if (!memberRow) return { error: 'Member not found' }
  if (memberRow.organisation_id !== orgId) return { error: 'Member belongs to another organisation' }

  const validIds = await orgScopedDeptIds(admin, orgId, departmentIds)

  // Replace semantics: delete existing rows, then insert new ones.
  const { error: delErr } = await admin.from('member_departments').delete().eq('member_id', memberId)
  if (delErr) { console.error('[assignMemberDepartments] delete error', delErr); return { error: delErr.message } }
  if (validIds.length > 0) {
    const rows = validIds.map((department_id: string) => ({ member_id: memberId, department_id, assigned_by: ctx.user.id }))
    const { error: insErr } = await admin.from('member_departments').insert(rows)
    if (insErr) { console.error('[assignMemberDepartments] insert error', insErr); return { error: insErr.message } }
  }
  return { success: true }
}
```
For `setSopMachines(sopId, machineIds)`: verify `sops` row org matches caller org AND filter `machineIds` to `site_machines` in caller org, then delete-then-insert into `sop_machines`. For `createSiteMachine`/`updateSiteMachine`/polygon writes, use the **session client** (`createClient()`) + `requireAdminContext()` directly — RLS enforces org scope there since those tables DO carry an authenticated admin write policy (unlike the junction tables).

**Error handling pattern:** discriminated union `{ data } | { error }`, never throw; `console.error('[fnName] ...', err)` before returning `{ error: err.message }`.

**Validation:** Zod polygon schema — `z.array(z.tuple([z.number(), z.number()])).min(3)` (per Pitfall 3, do NOT add convexity/self-intersection checks).

---

### `src/app/(protected)/admin/site/page.tsx` (route, request-response)

**Analog pattern:** `requireAdminContext()` from `src/lib/auth/guards.ts` (lines 22-29):
```typescript
export async function requireAdminContext(): Promise<AdminContext | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  return { supabase, user: { id: userId }, role, organisationId }
}
```
Server component fetches `site_layouts` + `site_machines` rows with the session client (RLS-scoped), signs the scene path, passes `GEMINI_API_KEY` presence as a boolean prop (Pitfall 2), and renders `SiteEditorLoader`.

**Signed URL pattern** — `src/lib/builder/sign-layout-data-images.ts` (`SIGNED_TTL_SEC = 3600`, `supabase.storage.from(bucket).createSignedUrl(path, SIGNED_TTL_SEC)` idiom) — mirror this TTL constant and call shape for `site-scenes`.

---

### `src/components/admin/site/SiteEditorLoader.tsx` (provider, dynamic loader)

**Analog:** `src/components/admin/builder-v2/visual/AnnotationEditorLoader.tsx` (copy verbatim, full file, 20 lines):
```typescript
'use client'
import dynamic from 'next/dynamic'

export const AnnotationEditorLoader = dynamic(
  () => import('./AnnotationEditor'),
  { ssr: false, loading: () => <div>Loading annotator…</div> }
)
export default AnnotationEditorLoader
```
Rename `AnnotationEditor`→`SiteEditor`, "annotator"→"site editor".

---

### `src/components/admin/site/SiteEditor.tsx` (component, event-driven canvas)

**Analog:** `src/components/admin/builder-v2/visual/AnnotationEditor.tsx` — Stage/Layer/Transformer idiom, pan/zoom-to-cursor math (RESEARCH.md Pattern 1, lines 196-229) and `getRelativePointerPosition()` for scene-px conversion (RESEARCH.md Pattern 2, lines 237-245). Re-run `fit()` via `ResizeObserver`, not just on mount (Pitfall 5).

**Token discipline:** paper/ink tokens only (`text-[var(--ink-900)]` etc.) — `tests/lint/design-tokens.spec.ts` bans raw Tailwind palette classes.

---

### `src/components/admin/sop/SopMachinePicker.tsx` (component, request-response modal)

**Analog:** `BuilderFlowButton.tsx` (full portaled-modal pattern, lines 1-60+):
```typescript
'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function BuilderFlowButton({ sop }: { sop: SopWithSections }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button" role="menuitem" onClick={() => setOpen(true)}
        className="flex w-full flex-col items-start gap-0.5 rounded px-3 py-2 text-left hover:bg-[var(--paper-2)] transition-colors"
      >
        <span className="text-ui text-[var(--ink-900)]">See the flow diagram</span>
        <span className="text-micro text-[var(--ink-500)]">a map of how the steps connect — view only</span>
      </button>
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center sm:p-4">
          {/* modal content */}
        </div>,
        document.body
      )}
    </>
  )
}
```
For `SopMachinePicker`: same shell, label "Manage machines", body = org-scoped multi-select grouped by department, writing `setSopMachines(sop.id, ids)` on change/close.

---

### `BuilderStageShell.tsx` `ToolsMenu` (edit — add new row)

**Analog:** the existing `items` array + rendered rows (lines 81-142 excerpted):
```typescript
const items: { label: string; hint: string; href: string }[] = [
  { label: 'Assign this SOP to workers', hint: 'choose who must do it and by when', href: `/admin/sops/${sopId}/assign` },
  { label: 'See earlier versions', hint: 'what changed, and when', href: `/admin/sops/${sopId}/versions` },
  ...
]
...
<div className="my-1 h-px bg-[var(--ink-100)]" />
<BuilderFlowButton sop={sop} />
<BuilderFlowEditButton sop={sop} sopId={sopId} />
```
Add `<SopMachinePicker sop={sop} />` alongside `BuilderFlowButton`/`BuilderFlowEditButton` below the divider (it needs a modal, not a route `href`, so it goes with those two, not in the plain `items` array).

---

### `src/components/layout/TopHeader.tsx` (edit `ADMIN_LINKS`)

**Analog:** existing array (lines 145-151):
```typescript
const ADMIN_LINKS: NavLink[] = [
  { label: 'Governance', href: '/sops?view=attention' },
  { label: 'Create New SOP', href: '/admin/sops/new' },
  { label: 'Content', href: '/admin/blocks' },
  { label: 'Team', href: '/admin/team' },
  { label: 'Settings', href: '/admin/settings' },
]
```
Add `{ label: 'Site', href: '/admin/site' }` (Team · Site · Settings order per D-08).

---

### `src/lib/journeys/journeys.ts` (edit)

**Analog:** existing `Journey`/`JourneyStep` shape (lines 15-37). Add a step/journey entry with `route: '/admin/site'` so `/pathways` coverage shows it mapped — required in the same change per project convention.

---

### `tests/phase26/konva-worker-isolation.spec.ts` (edit allow-list)

**Current shape** (lines 28-30, 79-92):
```typescript
// The ONLY directory permitted to statically import konva / react-konva / ...
const ALLOWED_DIR = path...
...
function violationsOutsideAllowedDir(hits: Hit[]): Hit[] {
  return hits.filter((h) => !h.file.startsWith(ALLOWED_DIR + '/'))
}
```
Widen `ALLOWED_DIR` (single string) to an array (e.g. `ALLOWED_DIRS`) including `src/components/admin/site`, and change `violationsOutsideAllowedDir` to `!ALLOWED_DIRS.some(dir => h.file.startsWith(dir + '/'))`. This MUST land in the same wave that introduces `SiteEditor.tsx`'s Konva import or the `phase26` project goes red (Pitfall 1).

---

### `tests/phase51/*.spec.ts` and `playwright.config.ts` (test, config)

**Analog:** any `phase40`/`phase41`/`phase46` broad `testMatch` project block in `playwright.config.ts` — copy verbatim, `testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/`. Verify registration with `npx playwright test --list --project=phase51` before writing specs (2026-05-25 unregistered-spec class).

**Runtime RLS matrix analog:** any existing phase spec exercising (role × own/other-row × same/cross-org) cells — mirror the 2026-07-20 pattern: probe as eval admin (write+read), eval worker same-org (read visible), foreign-org session (read empty).

---

### `tests/evals/site-editor.eval.ts` (deployed eval)

**Analog:** `tests/evals/sop-surface.eval.ts` — session minting via `tests/evals/lib/session.ts` (magic-link → verifyOtp → `sb-<ref>-auth-token` cookie), screenshot-at-viewport-width pattern, self-skip without `EVAL_BASE_URL`. No `playwright.config.ts` edit needed — existing `evals` project regex (`tests/evals/*.eval.ts`) auto-registers it.

## Shared Patterns

### Admin-only server-action guard
**Source:** `src/lib/auth/guards.ts` lines 22-29 (`requireAdminContext`)
**Apply to:** `src/actions/site.ts` (all functions), `src/app/(protected)/admin/site/page.tsx`, `src/app/api/admin/site/generate/route.ts`

### Junction-write org self-scoping (service-role client)
**Source:** `src/actions/departments.ts` lines 338-416 (`callerOrgId`, `orgScopedDeptIds`, `assignMemberDepartments`)
**Apply to:** `setSopMachines` in `src/actions/site.ts` only (not the direct `site_machines` CRUD, which uses the session client since RLS covers it)

### RLS org-scope + WITH CHECK restating USING
**Source:** `supabase/migrations/00061_*.sql`, `00062_*.sql`
**Apply to:** `00067_site_model.sql` — all three tables, enforced automatically by `tests/lint/rls-org-scope.spec.ts`

### Signed URL serving
**Source:** `src/lib/builder/sign-layout-data-images.ts` (`SIGNED_TTL_SEC = 3600`, `createSignedUrl`)
**Apply to:** `site-scenes` bucket scene path signing in `page.tsx`

### Konva dynamic-import isolation
**Source:** `src/components/admin/builder-v2/visual/AnnotationEditorLoader.tsx`
**Apply to:** `SiteEditorLoader.tsx` + the widened `konva-worker-isolation.spec.ts` allow-list

### Portaled modal from a ToolsMenu row
**Source:** `BuilderFlowButton.tsx` (full component)
**Apply to:** `SopMachinePicker.tsx`

### Design tokens only, no raw palette classes
**Source:** `src/styles/blueprint-theme.css` + `tests/lint/design-tokens.spec.ts`
**Apply to:** `SiteEditor.tsx`, `SopMachinePicker.tsx`, `page.tsx`, empty-state component

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/app/api/admin/site/generate/route.ts` | route | request-response (external API) | No prior Gemini integration in codebase; use RESEARCH.md's cited REST code example (`generativelanguage.googleapis.com`, `x-goog-api-key` header, `responseModalities: ['IMAGE']`) as the template instead of an in-repo analog. Model string via `GEMINI_IMAGE_MODEL` env override (mirrors `VERIFY_MODEL`/`TTS_MODEL` model-rot mitigation). |
| Upload control for the empty state | component | file-I/O | No direct analog — `UploadDropzone.tsx` is too coupled to SOP creation sessions (TUS, multi-format). Reuse `src/lib/upload/file-intake.ts`'s validation primitives (`ACCEPT_ATTR`/`validateIntakeFile`-style helpers) inside a small purpose-built control, per RESEARCH.md Open Question 2. |

## Metadata

**Analog search scope:** `src/actions/`, `src/components/admin/builder-v2/visual/`, `src/app/(protected)/admin/sops/builder/[sopId]/`, `src/lib/auth/`, `src/lib/builder/`, `src/lib/journeys/`, `supabase/migrations/`, `tests/lint/`, `tests/phase26/`, `tests/evals/`, `playwright.config.ts`
**Files scanned:** ~15 (departments.ts, guards.ts, AnnotationEditor/Loader.tsx, BuilderFlowButton.tsx, BuilderStageShell.tsx, TopHeader.tsx, journeys.ts, sign-layout-data-images.ts, konva-worker-isolation.spec.ts, migrations 00059/00061/00062)
**Pattern extraction date:** 2026-09-28
