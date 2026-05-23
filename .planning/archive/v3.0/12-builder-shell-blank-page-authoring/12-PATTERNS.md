# Phase 12: Builder Shell & Blank-Page Authoring — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 15 new/modified
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/00020_section_layout_data.sql` | migration | DDL + RPC | `supabase/migrations/00019_section_kinds_and_blocks.sql` | exact |
| `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx` | route (RSC) | request-response | `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` | exact |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx` | component (client wrapper) | event-driven + client state | `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx` | role-match |
| `src/app/(protected)/admin/sops/new/blank/page.tsx` | route (RSC) | request-response | `src/app/(protected)/admin/sops/upload/page.tsx` | exact |
| `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` | component (client stepper) | event-driven + server action submit | `src/components/admin/SectionKindPicker.tsx` | role-match |
| `src/components/sop/blocks/HazardCardBlock.tsx` (+6 peers) | component (presentational) | render-only | `src/components/sop/SectionContent.tsx` (HazardContent/PpeContent internal) | role-match |
| `src/components/sop/blocks/puckConfig.ts` | config/registry | transform (map) | `src/lib/validators/blocks.ts` (discriminated-union registry) | role-match |
| `src/components/sop/blocks/index.ts` | barrel export | — | no analog — trivial file | n/a |
| `src/actions/sections.ts` (add `reorderSections`, `updateSectionLayout`) | server action | CRUD + RPC | `src/actions/sections.ts` (existing `createSection`) | exact (same file) |
| `src/actions/sops.ts` (add `createSopFromWizard`) | server action | CRUD (multi-insert) | `src/actions/sops.ts::createUploadSession` | exact (same file) |
| `src/lib/offline/db.ts` (Dexie v4 bump) | infrastructure | schema migration | `src/lib/offline/db.ts` (v1→v2→v3 bumps) | exact (same file) |
| `src/lib/offline/draft-sync.ts` / `flushDraftLayouts` | adapter (sync-engine extension) | batch + event-driven | `src/lib/offline/sync-engine.ts::flushPhotoQueue`, `flushCompletions` | exact |
| `src/components/sop/SectionContent.tsx` (add layout_data branch) | component (renderer) | render-only branching | `src/components/sop/SectionContent.tsx` (existing switch) | exact (same file) |
| `src/hooks/useDraftLayoutSync.ts` | hook | event-driven | `src/hooks/useSopSync.ts` | exact |
| `src/app/(protected)/admin/sops/page.tsx` (add chip) | route (RSC, edit) | request-response | existing list rendering in same file | exact (same file) |

## Pattern Assignments

---

### `supabase/migrations/00020_section_layout_data.sql` (migration, DDL + RPC)

**Analog:** `supabase/migrations/00019_section_kinds_and_blocks.sql`

**Additive-migration header comment block** (lines 1-12):
```sql
-- ============================================================
-- Migration 00019: v3.0 Section Schema + Block Library (additive)
-- Adds:
--   1. section_kinds catalog (global + per-org) with canonical seeds
--   2. sop_sections.section_kind_id advisory FK (nullable)
-- This migration is fully additive — no existing rows are modified
-- except an optional backfill that sets section_kind_id where a
-- legacy section_type matches a canonical slug.
-- ============================================================
```
Phase 12 copies this banner style. Each migration begins with a section banner listing the changes and explicitly calling out "additive".

**Additive column pattern** (lines 66-70):
```sql
alter table public.sop_sections
  add column if not exists section_kind_id uuid
    references public.section_kinds(id) on delete set null;

create index if not exists idx_sop_sections_kind on public.sop_sections (section_kind_id);
```
Copy verbatim for `layout_data jsonb` and `layout_version int` adds (no FK, no index required; JSONB is nullable).

**CHECK-constraint enum pattern** (lines 23-24) — use this for `sops.source_type`:
```sql
render_family    text not null check (render_family in
                   ('hazard','ppe','steps','content','signoff','emergency','custom')),
```
Project chose CHECK-string-enums over `create type ... as enum` in migration 19. Phase 12 follows the same pattern for `source_type` so rollback and additive evolution stay simple.

**RLS inheritance comment** — migration 19 does NOT add new RLS policies for the added column on `sop_sections` (lines 66-70); policies are table-level and inherit. Phase 12 must NOT add column-level policies either.

**RPC function pattern** — no prior analog in 00019, but the `current_organisation_id()` and `current_user_role()` helper functions are defined earlier (00003_sop_schema.sql:91-97). The new `reorder_sections` RPC uses `language plpgsql` without `security definer` so RLS applies to the caller — mirroring how existing policies gate writes.

---

### `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx` (route, RSC)

**Analog:** `src/app/(protected)/admin/sops/[sopId]/review/page.tsx`

**Auth + role guard pattern** (lines 25-39):
```ts
const supabase = await createClient()

const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

// Check user is admin or safety_manager
const { data: member } = await supabase
  .from('organisation_members')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle()

if (!member || !['admin', 'safety_manager'].includes(member.role)) {
  redirect('/dashboard')
}
```
Copy verbatim — every admin RSC route uses this exact block.

**RSC param + nested fetch pattern** (lines 19-58):
```ts
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ sopId: string }>
}) {
  const { sopId } = await params
  ...
  const { data: sop, error: sopError } = await supabase
    .from('sops')
    .select(`
      *,
      sop_sections (
        *,
        sop_steps ( * ),
        sop_images ( * )
      )
    `)
    .eq('id', sopId)
    .order('sort_order', { referencedTable: 'sop_sections', ascending: true })
    .single()

  if (sopError || !sop) {
    redirect('/admin/sops')
  }
```
Next.js 16 `params: Promise<…>` with `await params` is the current convention. Copy the select shape — builder page fetches the same nested structure plus `layout_data` + `layout_version` (implicit via `*`).

**Metadata export + Suspense wrapper** (lines 8-10, 105-116):
```ts
export const metadata: Metadata = {
  title: 'Review SOP',
}
...
return (
  <Suspense fallback={null}>
    <ReviewClient sop={...} />
  </Suspense>
)
```
Copy shape for builder page: `title: 'Builder'`, Suspense wrapper, pass fetched data + Puck `Data` shape to client.

---

### `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx` (client wrapper)

**Analog:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx`

**`'use client'` component with prop-hydrated initial state** (PipelineProgressClient lines 1-42):
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
...

type SopRow = { id: string; title: string | null; ... }
```
Builder copies: `'use client'` directive, client Supabase via `@/lib/supabase/client`, lucide icons, props are fully-typed hydrated server state.

**`next/dynamic` ssr:false pattern for Puck** — no in-repo analog; follow the RESEARCH.md Pattern 1 excerpt exactly:
```tsx
const PuckEditor = dynamic(
  () => import('@puckeditor/core').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="p-8 text-steel-400">Loading editor…</div> }
)
```
Use `text-steel-400` palette class to match project (see `StatusBadge.tsx` / `SectionContent.tsx` palette).

---

### `src/app/(protected)/admin/sops/new/blank/page.tsx` (route, RSC wizard entry)

**Analog:** `src/app/(protected)/admin/sops/upload/page.tsx`

**Minimal admin RSC shell** (lines 1-45):
```tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UploadDropzone } from '@/components/admin/UploadDropzone'

export const metadata: Metadata = {
  title: 'Upload SOPs',
}

export default async function UploadSopsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-steel-100">Upload SOPs</h1>
        <Link href="/admin/sops" className="text-sm text-steel-400 hover:text-brand-yellow transition-colors">
          Back to library
        </Link>
      </div>
      <p className="text-sm text-steel-400 mb-8">
        Upload your SOP documents and we&apos;ll parse them into mobile-friendly procedures. ...
      </p>
      <UploadDropzone />
    </div>
  )
}
```
Blank-wizard page copies structure: same chrome (`max-w-2xl`, H1 + "Back to library" link, `text-steel-100`/`text-steel-400` palette), swap `<UploadDropzone />` for `<WizardClient />`, title `"New SOP from scratch"`.

---

### `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` (client stepper)

**Analog:** `src/components/admin/SectionKindPicker.tsx`

**Kind-fetch + local-state pattern** (SectionKindPicker lines 1-80):
```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle, ShieldCheck, ListChecks, Siren, CheckCircle2, FileText, Sparkles,
} from 'lucide-react'
import type { SectionKind } from '@/types/sop'
import { listSectionKinds } from '@/actions/sections'

const ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle, ShieldCheck, ListChecks, Siren, CheckCircle2, FileText, Sparkles,
}

export function SectionKindPicker({ onSubmit, onCancel }: SectionKindPickerProps) {
  const [kinds, setKinds] = useState<SectionKind[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKindId, setSelectedKindId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listSectionKinds()
      .then((data) => { if (mounted) { setKinds(data); setLoading(false) } })
      .catch((e: unknown) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load section kinds')
          setLoading(false)
        }
      })
    return () => { mounted = false }
  }, [])
```
Wizard step 2 reuses `listSectionKinds()` directly + the same `ICON_MAP`. Local-state-only stepper per CONTEXT D-16 (Claude's Discretion). Error surface mirrors `setError(e instanceof Error ? ...)` shape.

**Form submit pattern** (lines 78-110 approx):
```tsx
const handleSubmit = async () => {
  if (!selectedKindId || !title.trim()) return
  setSubmitting(true)
  ...
}
```
Step 4 of wizard calls `createSopFromWizard` the same way, with `router.push('/admin/sops/builder/' + result.sopId)` on success.

---

### `src/components/sop/blocks/HazardCardBlock.tsx` (block component; Text, Heading, Photo, Callout, Step, HazardCard, PPECard — 7 files, same shape)

**Analog:** `src/components/sop/SectionContent.tsx::HazardContent` and `PpeContent`

**HazardContent palette + layout** (SectionContent.tsx lines 25-51):
```tsx
function HazardContent({ section, isEmergency }: { section: SectionWithChildren; isEmergency: boolean }) {
  const Icon = isEmergency ? Siren : AlertTriangle
  const lines = parseContentLines(section.content)

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-red-400 flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-red-400">
          {section.title}
        </span>
      </div>
      {lines.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-steel-100 leading-relaxed">
              <span className="text-red-400 mt-1.5 flex-shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : ...}
    </div>
  )
}
```
**`HazardCardBlock` copies this exactly**: `bg-red-500/10 border border-red-500/30 rounded-xl p-5`, `AlertTriangle` from `lucide-react`, `text-red-400` + `text-sm font-bold uppercase tracking-widest` for title, `text-steel-100 leading-relaxed` for body.

**PpeContent palette** (lines 53-80):
```tsx
<div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-4">
  <div className="flex items-center gap-2 mb-3">
    <ShieldCheck size={18} className="text-blue-400 flex-shrink-0" />
    <span className="text-sm font-bold uppercase tracking-widest text-blue-400">
      {section.title}
    </span>
  </div>
```
**`PPECardBlock` copies this exactly** — palette `bg-blue-500/10` / `border-blue-500/30` / `text-blue-400`, `ShieldCheck` icon.

**Step list palette** (lines 82-113) — source for `StepBlock`:
```tsx
<div
  key={step.id}
  className="flex items-start gap-4 p-4 bg-steel-800 rounded-xl border border-steel-700"
>
  <span className="text-[13px] font-bold text-steel-400 w-6 flex-shrink-0 pt-0.5 tabular-nums">
    {step.step_number}
  </span>
  <div className="flex-1 min-w-0">
    ...
    <p className="text-base text-steel-100 leading-relaxed">{step.text}</p>
```
**`StepBlock` copies this exactly**: `bg-steel-800 rounded-xl border border-steel-700`, `tabular-nums` for step number, `text-steel-100 leading-relaxed` for text.

**Default/content palette** (lines 116-128) — source for `TextBlock`, `HeadingBlock`, `CalloutBlock`:
```tsx
<div className="bg-steel-800 border border-steel-700 rounded-xl p-5 mb-4">
  {section.content && (
    hasTable
      ? <SopTable markdown={section.content} />
      : <p className="text-base text-steel-100 leading-relaxed whitespace-pre-wrap">{section.content}</p>
  )}
</div>
```

**Block export shape** (new — per CONTEXT D-09/D-11):
```tsx
// src/components/sop/blocks/HazardCardBlock.tsx
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'

export const HazardCardBlockPropsSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  severity: z.enum(['critical', 'warning', 'notice']).default('warning'),
})
export type HazardCardBlockProps = z.infer<typeof HazardCardBlockPropsSchema>

export function HazardCardBlock({ title, body, severity }: HazardCardBlockProps) {
  // copy HazardContent JSX verbatim with props wired
}
```
Named function export + named schema (SPEC grep target).

---

### `src/components/sop/blocks/puckConfig.ts` (block registry for Puck)

**Analog:** `src/lib/validators/blocks.ts` (discriminated-union registry of block content schemas)

**Discriminated-union registry pattern** (lines 10-45):
```ts
export const HazardBlockContentSchema = z.object({
  kind: z.literal('hazard'),
  text: z.string().min(1),
  severity: z.enum(['critical', 'warning', 'notice']),
})

export const PpeBlockContentSchema = z.object({
  kind: z.literal('ppe'),
  items: z.array(z.string().min(1)).min(1),
})
...

export const BlockContentSchema = z.discriminatedUnion('kind', [
  HazardBlockContentSchema,
  PpeBlockContentSchema,
  StepBlockContentSchema,
  EmergencyBlockContentSchema,
  CustomBlockContentSchema,
])
```
**What to copy:** the "registry file that imports per-variant schemas and assembles them" shape. Phase 12's `puckConfig.ts` imports `{Block, BlockPropsSchema}` from each of the 7 block files and assembles the Puck `Config` object (RESEARCH.md Pattern 2).

---

### `src/components/sop/blocks/index.ts` (barrel)

Trivial — re-export the 7 blocks + schemas. No analog needed. Match the style of any Phase 11 barrel (none present in `src/components/sop/` — keep it minimal: one `export * from './TextBlock'` per file).

---

### `src/actions/sections.ts` — add `reorderSections` + `updateSectionLayout`

**Analog:** `src/actions/sections.ts::createSection` (existing in same file)

**Server-action file header** (lines 1-5):
```ts
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { SectionKind, SopSection } from '@/types/sop'
```
Top-of-file `'use server'` + Zod + server Supabase client.

**Zod input + parse + supabase pattern** (lines 26-51):
```ts
const CreateSectionInput = z.object({
  sopId: z.string().uuid(),
  sectionKindId: z.string().uuid(),
  title: z.string().min(1).max(120),
  content: z.string().max(10_000).nullable().optional(),
})

export type CreateSectionInputType = z.infer<typeof CreateSectionInput>

export async function createSection(
  input: CreateSectionInputType
): Promise<SopSection> {
  const parsed = CreateSectionInput.parse(input)
  const supabase = await createClient()

  const { data: kind, error: kindErr } = await supabase
    .from('section_kinds')
    .select('id, slug, display_name')
    .eq('id', parsed.sectionKindId)
    .single()
  if (kindErr || !kind) {
    throw new Error('Unknown section kind: ' + parsed.sectionKindId)
  }
```
**Copy verbatim:** Zod schema above function → `parse()` → `await createClient()` → supabase call → check error with `if (error)` + throw `Error` with context.

**RPC invocation pattern** — no direct analog (Phase 12 introduces first RPC). Use RESEARCH.md Pattern excerpt: `await supabase.rpc('reorder_sections', { p_sop_id, p_ordered_section_ids })`. Return type: `void` or `{ success: true } | { error: string }` shape matching `deleteSop` in `src/actions/sops.ts:326-352`.

**Result-shape convention** (from `src/actions/sops.ts:326-352`):
```ts
export async function deleteSop(sopId: string): Promise<{ success: true } | { error: string }> {
  ...
  if (error) return { error: error.message }
  return { success: true }
}
```
New `reorderSections` and `updateSectionLayout` MAY use this discriminated-union return shape OR throw — `createSection` throws, `deleteSop` returns. Planner locks one. Recommendation: match `deleteSop` (discriminated union) for server actions called from client because Puck's onChange handler should not surface throws.

---

### `src/actions/sops.ts` — add `createSopFromWizard`

**Analog:** `src/actions/sops.ts::createUploadSession` (same file, lines 8-98)

**Auth + JWT-claims pattern** (lines 16-33):
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Not authenticated' }

// Get org_id from JWT claims
const { data: { session } } = await supabase.auth.getSession()
const jwtClaims = session?.access_token
  ? JSON.parse(atob(session.access_token.split('.')[1]))
  : {}
const organisationId: string | null = jwtClaims['organisation_id'] ?? null
if (!organisationId) return { error: 'No organisation found' }

// Check role
const role = jwtClaims['user_role']
if (!role || !['admin', 'safety_manager'].includes(role)) {
  return { error: 'You need admin access to upload SOPs.' }
}
```
Copy verbatim. `createSopFromWizard` must pull `organisation_id` + role check from JWT exactly like this.

**Admin-client insert for SOP creation** (lines 34-63):
```ts
const admin = createAdminClient()
...
const { data: sop, error: sopError } = await admin
  .from('sops')
  .insert({
    organisation_id: organisationId,
    source_file_name: file.name,
    source_file_type: fileType,
    source_file_path: '',
    uploaded_by: user.id,
    status: 'uploading',
  })
  .select('id')
  .single()

if (sopError || !sop) {
  console.error('SOP creation error:', sopError)
  return { error: 'Failed to create upload session. Please try again.' }
}
```
Wizard copies: `createAdminClient()` (bypasses RLS for controlled insert), `.insert(...).select('id').single()`, error-log-then-return pattern. For wizard set `status: 'draft'` and `source_type: 'blank'` (new column).

**Pseudo-atomic multi-insert + cleanup** (lines 170-196 in `createVideoUploadSession`):
```ts
const { error: updateError } = await admin
  .from('sops')
  .update({ source_file_path: storagePath })
  .eq('id', sop.id)

if (updateError) {
  await admin.from('sops').delete().eq('id', sop.id)
  return { error: 'Failed to create upload session. Please try again.' }
}

const { error: jobError } = await admin
  .from('parse_jobs')
  .insert({ ... })

if (jobError) {
  console.error('Parse job creation error:', jobError)
  await admin.from('sops').delete().eq('id', sop.id)
  return { error: 'Failed to create upload session. Please try again.' }
}
```
Wizard must replicate this pattern: if the section-batch insert fails after `sops.insert`, delete the SOP row so the user retries from a clean state. (No supabase-js txn; compensating delete.)

---

### `src/lib/offline/db.ts` — Dexie v4 bump, add `draftLayouts`

**Analog:** `src/lib/offline/db.ts` (existing v1→v2→v3 bumps, same file)

**Version-bump pattern with full cumulative stores** (lines 46-81):
```ts
db.version(1).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
})

// v2: adds completions + photoQueue tables
// All v1 index strings are repeated (required by Dexie schema migration)
// blob is intentionally NOT listed — never index binary data in Dexie
db.version(2).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
})

// v3: adds section_kind_id index ...
db.version(3).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, section_kind_id, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
})
```
**Copy verbatim for v4:** repeat ALL v3 store strings, add `draftLayouts: 'section_id, sop_id, syncState, _cachedAt'`. This is the project's canonical Dexie pattern and Pitfall 6 explicitly warns against omitting prior stores.

**EntityTable type addition** (lines 34-42):
```ts
type SopAssistantDB = Dexie & {
  sops: EntityTable<CachedSop, 'id'>
  sections: EntityTable<SopSection, 'id'>
  steps: EntityTable<SopStep, 'id'>
  images: EntityTable<SopImage, 'id'>
  syncMeta: EntityTable<{ key: string; value: string }, 'key'>
  completions: EntityTable<LocalCompletion, 'localId'>
  photoQueue: EntityTable<QueuedPhoto, 'localId'>
}
```
Add `draftLayouts: EntityTable<DraftLayout, 'section_id'>` to the intersection type.

**Interface pattern** (lines 13-32):
```ts
export interface LocalCompletion {
  localId: string                        // client UUID — idempotency key
  sopId: string
  sopVersion: number
  ...
  status: 'in_progress' | 'submitted'
  startedAt: number
}
```
New `DraftLayout` interface copies this shape: inline field comments, epoch-ms timestamps (not ISO strings), `syncState: 'dirty' | 'synced'` union literal.

---

### `src/lib/offline/draft-sync.ts` OR extend `src/lib/offline/sync-engine.ts`

**Analog:** `src/lib/offline/sync-engine.ts::flushPhotoQueue` (lines 162-222) and `flushCompletions` (lines 231-293)

**Flush function signature + return shape** (lines 162-165):
```ts
export async function flushPhotoQueue(
  _supabase: AnySupabaseClient
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = []
  let uploaded = 0
```
Copy: `flushDraftLayouts(supabase): Promise<{ flushed: number; errors: string[] }>`.

**Iteration + per-row error collection** (lines 170-221):
```ts
try {
  const pending = await db.photoQueue
    .where('uploaded')
    .equals(0)
    .toArray()

  for (const photo of pending) {
    try {
      ...
      if ('error' in urlResult) {
        errors.push(`Photo ${photo.localId}: ${urlResult.error}`)
        continue
      }
      ...
      await db.photoQueue.update(photo.localId, { uploaded: true, storagePath: urlResult.path })
      uploaded++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Photo ${photo.localId}: ${message}`)
    }
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  errors.push(message)
}

return { uploaded, errors }
```
Copy this exact shape for `flushDraftLayouts`: `where('syncState').equals('dirty').toArray()`, per-row try, push to `errors` array, increment `flushed`, update `syncState: 'synced'` on success. LWW comparison on `updated_at` (RESEARCH Pattern 5 excerpt) goes inside the per-row try.

**Type import pattern** (lines 1-5):
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import('@supabase/supabase-js').SupabaseClient<any, any, any>
import { db } from '@/lib/offline/db'
```
Copy verbatim.

---

### `src/components/sop/SectionContent.tsx` — add `layout_data` branch

**Analog:** `src/components/sop/SectionContent.tsx` (same file, existing switch at lines 130-162)

**Existing switch that must stay byte-identical** (lines 130-162):
```tsx
export function SectionContent({ section }: SectionContentProps) {
  const family = resolveRenderFamily(section)

  switch (family) {
    case 'hazard':
      return <HazardContent section={section} isEmergency={false} />
    case 'emergency':
      return <HazardContent section={section} isEmergency={true} />
    case 'ppe':
      return <PpeContent section={section} />
    case 'steps':
      return (
        <>
          {section.content && (
            <div className="bg-steel-800 border border-steel-700 rounded-xl p-5 mb-4">
              <p className="text-base text-steel-100 leading-relaxed whitespace-pre-wrap">{section.content}</p>
            </div>
          )}
          <StepsContent section={section} />
        </>
      )
    case 'signoff':
      return <DefaultContent section={section} />
    case 'content':
    case 'custom':
    default:
      return <DefaultContent section={section} />
  }
}
```
**Change surgery:** wrap with a single `if` above this switch:
```tsx
if (section.layout_data != null && section.layout_version != null) {
  return (
    <LayoutRenderer
      layoutData={section.layout_data}
      layoutVersion={section.layout_version}
      fallback={/* call the existing switch */}
    />
  )
}
// existing switch untouched
```
The existing switch body must not be edited — required for SB-LAYOUT-06 byte-identical legacy behaviour. Extract the switch into a local `<LegacyRenderer>` sub-component at bottom of file, pass it as `fallback`.

---

### `src/hooks/useDraftLayoutSync.ts`

**Analog:** `src/hooks/useSopSync.ts`

**Hook structure** (entire file, 1-64):
```ts
'use client'
import { useEffect, useRef, useState } from 'react'
import { useNetworkStore } from '@/stores/network'
import { syncAssignedSops } from '@/lib/offline/sync-engine'
import { createClient } from '@/lib/supabase/client'

const SYNC_DEBOUNCE_MS = 30_000 // 30 seconds

export function useSopSync() {
  const isOnline = useNetworkStore((s) => s.isOnline)
  const lastSyncRef = useRef<number>(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{
    synced: number
    errors: string[]
  } | null>(null)

  async function triggerSync() {
    const now = Date.now()
    if (now - lastSyncRef.current < SYNC_DEBOUNCE_MS) return
    lastSyncRef.current = now

    setSyncing(true)
    try {
      const supabase = createClient()
      const result = await syncAssignedSops(supabase)
      setLastSyncResult(result)
    } finally {
      setSyncing(false)
    }
  }

  // Sync on mount if online
  useEffect(() => { if (isOnline) triggerSync() }, [])

  // Sync when coming back online
  useEffect(() => { if (isOnline) triggerSync() }, [isOnline])

  // Sync on visibility change to visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && isOnline) triggerSync()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isOnline])

  return { syncing, lastSyncResult }
}
```
**Copy verbatim shape for `useDraftLayoutSync`:** `useNetworkStore` isOnline subscription, `useRef` debounce gate, `useState` for syncing + lastResult, three useEffects (mount / online-transition / visibility). Change `SYNC_DEBOUNCE_MS` to `3_000` (Phase 12 flush cadence — CONTEXT D-06) and swap `syncAssignedSops` for `flushDraftLayouts`.

---

### `src/app/(protected)/admin/sops/page.tsx` — add `AUTHORED IN BUILDER` chip

**Analog:** `src/app/(protected)/admin/sops/page.tsx` (same file, existing list rendering lines 119-180)

**Existing meta-row pattern** (lines 126-141):
```tsx
<div className="flex-1 min-w-0">
  <p className="text-base font-semibold text-steel-100 truncate">
    {sop.title ?? sop.source_file_name}
  </p>
  <div className="flex items-center gap-3 mt-1 flex-wrap">
    {sop.sop_number && (
      <span className="text-xs text-steel-400">{sop.sop_number}</span>
    )}
    {sop.category && (
      <span className="text-xs text-steel-400">{sop.category}</span>
    )}
    <span className="text-xs text-steel-400">
      {formatDate(sop.updated_at ?? sop.created_at)}
    </span>
  </div>
</div>
<StatusBadge status={sop.status as SopStatus} />
```
**Add chip** in the meta-row, conditional on `sop.source_type !== 'uploaded' && sop.source_type != null`:
```tsx
{sop.source_type && sop.source_type !== 'uploaded' && (
  <span className="text-[10px] font-bold uppercase tracking-wider text-steel-400 border border-steel-600 rounded px-1.5 py-0.5">
    AUTHORED IN BUILDER
  </span>
)}
```
Copy type/palette of existing `text-xs text-steel-400` meta spans but bump to `tracking-wider` + border to match the SPEC wording (uppercase, tracking-wider). Also update the `select(...)` string on line 57 to include `source_type`.

---

## Shared Patterns

### Authentication + Role Guard (RSC admin routes)

**Source:** `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` lines 25-39

**Apply to:** every new admin RSC route in this phase (`builder/[sopId]/page.tsx`, `new/blank/page.tsx`)

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

const { data: member } = await supabase
  .from('organisation_members')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle()

if (!member || !['admin', 'safety_manager'].includes(member.role)) {
  redirect('/dashboard')
}
```

### Auth + Role Guard (server actions)

**Source:** `src/actions/sops.ts::createUploadSession` lines 16-33

**Apply to:** every new server action (`createSopFromWizard`, `reorderSections`, `updateSectionLayout`)

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Not authenticated' }

const { data: { session } } = await supabase.auth.getSession()
const jwtClaims = session?.access_token
  ? JSON.parse(atob(session.access_token.split('.')[1]))
  : {}
const organisationId: string | null = jwtClaims['organisation_id'] ?? null
if (!organisationId) return { error: 'No organisation found' }

const role = jwtClaims['user_role']
if (!role || !['admin', 'safety_manager'].includes(role)) {
  return { error: 'Admin access required' }
}
```

### Zod validation (server actions)

**Source:** `src/actions/sections.ts::createSection` lines 26-38

**Apply to:** `reorderSections`, `updateSectionLayout`, `createSopFromWizard`

```ts
const CreateSectionInput = z.object({
  sopId: z.string().uuid(),
  sectionKindId: z.string().uuid(),
  title: z.string().min(1).max(120),
  content: z.string().max(10_000).nullable().optional(),
})

export async function createSection(input: CreateSectionInputType): Promise<SopSection> {
  const parsed = CreateSectionInput.parse(input)
  ...
```
Zod schema declared at top of action, `.parse()` at function entry (throws on invalid — server actions are trusted by UI callers).

### Error handling / logging (server actions)

**Source:** `src/actions/sections.ts::createSection` lines 48-51, 87-91

**Apply to:** all server actions

```ts
if (kindErr || !kind) {
  throw new Error('Unknown section kind: ' + parsed.sectionKindId)
}
...
if (insErr || !inserted) {
  console.error('[createSection] insert error', insErr)
  throw new Error('Failed to create section')
}
```
Pattern: check `err || !data`, `console.error('[actionName] description', err)` then throw or return `{ error: ... }`. Tag each log with `[actionName]` prefix.

### Dark-theme palette tokens (block components)

**Source:** `src/components/sop/SectionContent.tsx` lines 25-128

| Semantic | Classes |
|----------|---------|
| Hazard/Emergency | `bg-red-500/10 border border-red-500/30 text-red-400` |
| PPE | `bg-blue-500/10 border border-blue-500/30 text-blue-400` |
| Content/default | `bg-steel-800 border border-steel-700 text-steel-100` |
| Step item | `bg-steel-800 rounded-xl border border-steel-700` |
| Body text | `text-base text-steel-100 leading-relaxed` |
| Meta text | `text-xs text-steel-400` |
| Section label | `text-sm font-bold uppercase tracking-widest` |
| Card | `rounded-xl p-5` |

**Apply to:** all 7 block components. HazardCardBlock→red, PPECardBlock→blue, everything else→steel-800/steel-700.

### Test project registration

**Source:** `playwright.config.ts` lines 45-48

```ts
{
  name: 'phase11-stubs',
  testMatch: /sb-auth-builder|sb-section-schema|sb-layout-editor|sb-image-annotation|sb-collaborative-editing|sb-block-library|sb-builder-infrastructure|resolve-render-family/,
},
```
RESEARCH.md flags that `phase11-stubs` already matches all Phase 12 test files. Planner decides whether to split into a `phase12-stubs` project or share. Default: share (files test the same `sb-*` series — splitting adds config noise without test-isolation benefit).

---

## No Analog Found

None — every new/modified file has a close in-repo analog. The one "new concept" is `@puckeditor/core` integration itself, which has no in-repo analog; RESEARCH.md Patterns 1-3 cover it via official Puck docs.

## Metadata

**Analog search scope:** `src/app/(protected)/admin/sops/**`, `src/components/sop/**`, `src/components/admin/**`, `src/actions/**`, `src/lib/offline/**`, `src/lib/validators/**`, `src/hooks/**`, `supabase/migrations/**`, `tests/**`

**Files scanned:** ~60 (directory listings) + 12 read in full or partial

**Pattern extraction date:** 2026-04-24
