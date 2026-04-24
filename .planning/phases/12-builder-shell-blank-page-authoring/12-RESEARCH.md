# Phase 12: Builder Shell & Blank-Page Authoring - Research

**Researched:** 2026-04-23
**Domain:** React page-builder integration (Puck) + Supabase additive migration + Dexie schema bump + sync-engine extension + Next.js 16 client-only render
**Confidence:** HIGH on library/API facts; MEDIUM on bundle-size, reorder-atomicity best fit

## Summary

Phase 12 bolts a drag-and-drop page builder (`@puckeditor/core`, formerly `@measured/puck`) onto the existing admin SOP flow, stores its output in a new `sop_sections.layout_data` JSONB column pinned by `layout_version`, and reuses the Phase 3 sync-engine to auto-save drafts. Workers render the same layout by importing the same block components and wrapping them in Puck's read-only `<Render>`.

Two facts from this session override a naive reading of the SPEC and MUST be surfaced to the planner:

1. **The package referenced in the SPEC (`@measured/puck`) was renamed to `@puckeditor/core` in Puck 0.21 (released 2026-01-14).** The canonical current version is `0.21.2` (published 2026-04-17). The old `@measured/puck` package latest is 0.20.2 (2026-01-29) and now carries a migration notice. Plans should install `@puckeditor/core@0.21.2`, not `@measured/puck`. This contradicts SPEC Acceptance Criteria line 112 literally, but not in spirit (SPEC says "the library" — Puck — not a specific npm name).

2. **supabase-js does not support client-side transactions.** `reorderSections` (SB-SECT-05) cannot be implemented as "a single Supabase transaction" from a server action using the normal JS client. The only two viable options are (a) a Postgres function called via `supabase.rpc('reorder_sections', ...)`, or (b) a sequence-bump using a deferred unique index. CONTEXT.md D-03 already permits the fallback; the planner should lock option (a) RPC because it is simpler and the migration already establishes the RLS model.

The rest of the research confirms CONTEXT's direction: Puck renders client-only via `next/dynamic({ ssr: false })` from a `'use client'` wrapper; Puck ships a `migrate()` helper that makes `layout_version` bumps cheap; block components that are shared between admin and worker must be real React components (no Puck-specific imports inside them) so the worker `<Render>` path does not pull in editor chrome.

**Primary recommendation:** Install `@puckeditor/core@0.21.2` (pin exact). Build shared block components as plain React — each exporting `{Component, PropsSchema}`. Register them in one builder-only `config.ts` that the editor imports, and one RSC-safe `config.rsc.ts` (or same config if blocks are server-safe) that the worker `<Render>` imports. Use Postgres RPC for atomic reorder. Bump Dexie to version 4 with a `draftLayouts` table keyed by `section_id`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Builder chrome + preview**
- **D-01:** Port the sketch's desktop/mobile preview toggle to the real builder as a persistent top bar. Reuses the CSS approach from `sketches/sop-blueprint/index.html` (commit `64f1bec`) — mobile view renders the canvas inside a 430px phone frame. Matches SPEC constraint that reflow is Tailwind-only; zero new design work.
- **D-02:** Section navigation uses a left sidebar with the section list. Click to switch between sections; drag handles on each row drive the `reorderSections` server action (SB-SECT-05). Consistent with the sketch's left-panel pattern.
- **D-03:** Save-state indicator is a mono-font pill in the top-right chrome. States: `SAVED 2s AGO` / `SAVING…` / `OFFLINE · QUEUED`. Visible at all times; does not steal canvas space.
- **D-04:** Publish is wired through the existing Phase 2 review flow. Builder has a primary `SEND TO REVIEW` button that navigates to `/admin/sops/[sopId]/review` — the existing page is the single source of truth for the publish workflow.

**Draft persistence + sync**
- **D-05:** Dexie table `draftLayouts` uses one row per section, keyed by `section_id`. Matches the Supabase row shape 1:1, enables partial sync on flaky networks, and pairs naturally with the sync-engine's per-record flush.
- **D-06:** Auto-save cadence confirms SPEC defaults: 750ms debounce on Dexie writes, 3s flush to Supabase. Matches the Phase 3 sync-engine (`src/lib/offline/sync-engine.ts`) exactly.
- **D-07:** Reconnect conflict resolution is last-write-wins by client timestamp. Each Dexie row carries `updated_at`; on flush, it is written to Supabase and the server's `updated_at` is set to match. If the server row is newer (another admin edited), the local Dexie value is overwritten and the admin sees a quiet toast: `Updated by another admin`. No merge UI — proper collab is Phase 17.
- **D-08:** Dexie row persists as an offline cache after successful server ack; it is purged only when the SOP is published. Enables offline authoring across tab reloads.

**Block component API**
- **D-09:** Zod prop schemas are co-located in each block's file. `src/components/sop/blocks/TextBlock.tsx` exports both `TextBlock` and `TextBlockPropsSchema`.
- **D-10:** Block components are environment-agnostic — no mode detection, no context provider, no `mode` prop.
- **D-11:** Block export shape: named function export + named schema. `export function TextBlock(props)` and `export const TextBlockPropsSchema`.
- **D-12:** Block styling is fully Tailwind, inside the block, no external `className` prop.

**Error resilience**
- **D-13:** Unknown block type → skip the single unknown block, render the rest. Grey placeholder: "This block isn't supported in your app version — update required." Single warning per page load.
- **D-14:** Invalid or missing props on a known block → render with visible empty-state. Warning logged once per page.
- **D-15:** Structurally broken `layout_data` (Zod parsing of outer shape fails) → full fallback to the legacy linear renderer for that section. Other sections render normally. Logs `[layout] parse failed for section {id}, fell back to linear`.
- **D-16:** Admin-side error surfacing inside the builder: inline red-outline per block with prop-level hint + section-level toast for corrupt layout_data.

### Claude's Discretion

- **Wizard flow (client vs server per step):** default to a client-only stepper that assembles all 4 steps in local state and commits via one `createSopFromWizard` server action on final submit.
- **Puck version pin:** researcher picks latest stable at planning time. Pin exact version (not caret). Flag version risk.
- **`reorderSections` atomicity:** default to a single Supabase transaction that rewrites `sort_order` for all affected rows. If Supabase JS SDK lacks transaction support, planner may adopt the "sequence bump + unique deferred index" pattern.
- **Block inline editor UX:** default to Puck's standard side-panel. Do not invent a custom editor surface.

### Deferred Ideas (OUT OF SCOPE)

- Wizard resumability across tab close (stay in local React state only for this phase)
- Block inline comments for admins (Phase 17)
- Puck's "auto-generated preview from fields" (each block renders its own preview identical to worker render)
- Custom admin tokens / theming (builder uses the same admin theme)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SB-AUTH-01 | Blank-page wizard for new SOP (no source document) | Next.js 16 App Router server action pattern + existing `createSection` precedent in `src/actions/sections.ts`; composite `createSopFromWizard` server action commits wizard state atomically |
| SB-AUTH-04 | Single builder surface `/admin/sops/builder/[sopId]` regardless of entry point | Next.js 16 dynamic route param pattern (already used in `[sopId]/review`, `[sopId]/assign`); route shape is free choice |
| SB-AUTH-05 | Builder-authored drafts distinguishable in library, same publish gate | `sops.source_type` enum column (additive); existing publish is `POST /api/sops/[sopId]/publish` (route.ts, not a named server action — see "Publish wiring" in Pitfalls) |
| SB-LAYOUT-01 | 7 draggable blocks, linear or 2-col grid on `lg:` | Puck `components` config + `slot` fields for nested zones or grid CSS on the root slot; see "Multi-column layouts" docs |
| SB-LAYOUT-02 | Block components shared between admin editor and worker walkthrough | Puck `config.components.*.render` accepts any React component — same import works for admin (inside `<Puck>`) and worker (inside `<Render>`) |
| SB-LAYOUT-03 | Layouts reflow to 5.5" phone via Tailwind breakpoints | Pure CSS; Puck's `viewports` prop lets admin preview without changing data |
| SB-LAYOUT-04 | `layout_data` JSONB + `layout_version` INT, auto-save via Phase 3 sync-engine | Additive Supabase migration `00020`; Dexie v4 bump with `draftLayouts` table; reuse existing sync pattern from `src/lib/offline/sync-engine.ts` |
| SB-LAYOUT-06 | Worker linear fallback for null `layout_data` or unsupported `layout_version` | Single branch in `src/components/sop/SectionContent.tsx` gating on `section.layout_data != null && SUPPORTED_LAYOUT_VERSIONS.includes(section.layout_version)` |
| SB-SECT-05 | Drag-reorder sections, persists `sort_order` | Postgres RPC `reorder_sections(p_sop_id, p_ordered_section_ids[])` called from server action; avoids supabase-js transaction limitation |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Drag-and-drop builder UI (7 blocks, side-panel props) | Browser / Client | — | Puck is a client-only React library; `'use client'` + `next/dynamic({ ssr: false })` required to avoid hydration mismatch |
| Block palette + Zod prop validation | Browser / Client (authoring) + Frontend Server (persistence) | — | Zod schema lives with the block (D-09); parsed on both sides — admin validates before Dexie write, server validates before DB write |
| Draft auto-save to Dexie | Browser / Client | — | Dexie is IndexedDB; entirely browser-side |
| Draft flush to Supabase | Frontend Server (server action) | Database (RLS) | Auto-save POSTs from client through a server action; RLS enforces org-scoping |
| Layout persistence | Database | — | `sop_sections.layout_data` JSONB column; version pin in `layout_version` |
| Section reorder atomicity | Database (RPC) | API / Backend (server action wrapper) | supabase-js has no client transactions; Postgres function is the only atomic option |
| Worker layout render | Browser / Client | Frontend Server (SSR) | Puck `<Render>` can SSR in RSC since 0.19, but SafeStart worker path is `'use client'` — keep as client render |
| Legacy linear fallback | Browser / Client | — | Already lives in `SectionContent.tsx`; add branch, do not touch the existing codepath |
| `AUTHORED IN BUILDER` chip | Frontend Server (SSR) | — | Library page is a server component reading `sops.source_type`; no client logic needed |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@puckeditor/core` | `0.21.2` | React drag-and-drop visual editor (renamed from `@measured/puck`) | Mandated by roadmap. Active, MIT-licensed, React 19 peer support, official Next.js App Router guidance. [VERIFIED: `npm view @puckeditor/core version` → 0.21.2, published 2026-04-17] |
| `zod` | `^4.3.6` (already installed) | Block prop validation, wizard schemas, server-action input validation | Already project standard. [VERIFIED: package.json] |
| `dexie` | `^4.3.0` (already installed) | IndexedDB for offline draft cache | Already project standard, already at Dexie 4 which supports versioned upgrades. [VERIFIED: package.json] |
| `@dnd-kit/react` | transitive via Puck | Drag-reorder primitives | Ships inside `@puckeditor/core` — do NOT install separately. [VERIFIED: `npm view @puckeditor/core` lists `@dnd-kit/react: 0.1.18` as dependency] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | `^7.72.0` (already installed) | Blank-page wizard 4-step form state | Wizard steps 1–3 are forms; step 4 is review/commit |
| `@hookform/resolvers` | `^5.2.2` (already installed) | Zod adapter for react-hook-form | Wire wizard Zod schemas to RHF |
| `lucide-react` | (already installed) | Icons on blocks (hazard triangle, PPE shield) | Already used project-wide; each block uses lucide icons directly |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@puckeditor/core` | Custom DnD via `@dnd-kit` directly | Would cost ~4× engineering; SPEC constraint forbids it ("Must use `@measured/puck`") |
| Postgres RPC for reorder | Sequence-bump + deferred unique index | Works but more complex SQL; two-phase commit concerns; RPC is simpler and matches Supabase idiom |
| Shared block components across admin/worker | Separate admin/worker component trees | Violates SB-LAYOUT-02 grep acceptance test; more code to maintain |
| Puck's own `viewports` prop for mobile preview | Port the sketch's CSS phone-frame approach | CONTEXT D-01 locks the sketch approach; Puck `viewports` would re-render inside an iframe and conflict with Tailwind `md:`/`lg:` breakpoints |

**Installation:**

```bash
npm install @puckeditor/core@0.21.2
```

**Version verification:** Confirmed against npm registry 2026-04-23. `@puckeditor/core` dist-tags: `latest: 0.21.2`. Peer: `react: ^18.0.0 || ^19.0.0` — compatible with React 19.2.4 in this project.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ ADMIN AUTHORING PATH                                                │
│                                                                     │
│ Browser / Client                                                    │
│                                                                     │
│ /admin/sops/new/blank        /admin/sops/builder/[sopId]            │
│ ┌──────────────────┐         ┌────────────────────────────┐         │
│ │ Blank wizard     │ create  │ BuilderClient ('use client')│         │
│ │ (4-step RHF +    ├────────►│ └── next/dynamic(           │         │
│ │  Zod)            │ redirect│       () => import(          │         │
│ └────────┬─────────┘         │       '@puckeditor/core'),   │         │
│          │                   │       { ssr: false })        │         │
│          │                   │ └── <Puck config data         │         │
│          │                   │        onChange={debounce}/>  │         │
│          │                   └────────┬───────────────────────┘       │
│          │                            │ onChange (750ms debounce)    │
│          │                            ▼                              │
│          │                   ┌────────────────────┐                   │
│          │                   │ Dexie draftLayouts │                   │
│          │                   │ (section_id PK)    │                   │
│          │                   └────────┬───────────┘                   │
│          │                            │ 3s flush (online)             │
│          ▼                            ▼                               │
│ ┌──────────────────────────────────────────────┐                      │
│ │ Server actions (Next.js 16 App Router)       │                      │
│ │ • createSopFromWizard  (atomic SOP+sections) │                      │
│ │ • updateSectionLayout  (draft flush)         │                      │
│ │ • reorderSections      (via RPC)             │                      │
│ └──────────────────┬───────────────────────────┘                      │
│                    │                                                  │
│ Database / Storage │                                                  │
│                    ▼                                                  │
│ ┌──────────────────────────────────────────────┐                      │
│ │ Supabase Postgres (migration 00020 additive) │                      │
│ │ • sops.source_type enum                      │                      │
│ │ • sop_sections.layout_data JSONB             │                      │
│ │ • sop_sections.layout_version INT            │                      │
│ │ • fn reorder_sections(sop_id, ids[])         │                      │
│ │ • RLS unchanged — inherited by new columns   │                      │
│ └──────────────────────────────────────────────┘                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ WORKER CONSUMPTION PATH                                             │
│                                                                     │
│ /sops/[sopId]/walkthrough → SectionContent.tsx                      │
│   if (section.layout_data && SUPPORTED_VERSIONS.has(layout_version))│
│     → <Render config={workerConfig} data={section.layout_data}/>    │
│       (same block component imports; NO editor chrome)              │
│   else                                                              │
│     → existing linear renderer (unchanged)                          │
│                                                                     │
│ Shared block layer (src/components/sop/blocks/*)                    │
│   TextBlock, HeadingBlock, PhotoBlock, CalloutBlock,                │
│   StepBlock, HazardCardBlock, PPECardBlock                          │
│   Each exports { Component, PropsSchema }                           │
└─────────────────────────────────────────────────────────────────────┘
```

Data entry: admin drags a block → Puck `onChange` fires → debounced write to Dexie `draftLayouts` (750 ms) → flush to Supabase (3 s). On reconnect, sync-engine reconciles. Worker walkthrough reads `layout_data` from the existing `useSopDetail` cache path; branches on `layout_version`.

### Recommended Project Structure

```
src/
├── components/
│   └── sop/
│       ├── blocks/                        # NEW — shared admin+worker block components
│       │   ├── TextBlock.tsx              # exports { TextBlock, TextBlockPropsSchema }
│       │   ├── HeadingBlock.tsx
│       │   ├── PhotoBlock.tsx
│       │   ├── CalloutBlock.tsx
│       │   ├── StepBlock.tsx
│       │   ├── HazardCardBlock.tsx
│       │   ├── PPECardBlock.tsx
│       │   └── index.ts                   # barrel export of all 7
│       ├── SectionContent.tsx             # EDIT — add single layout_data branch
│       └── LayoutRenderer.tsx             # NEW — wraps Puck <Render>, handles D-13/14/15 fallbacks
├── lib/
│   ├── builder/                           # NEW — builder-only infra
│   │   ├── puck-config.ts                 # Puck Config built from the 7 block modules
│   │   ├── layout-schema.ts               # Zod schema for outer layout_data shape
│   │   ├── draftLayouts-sync.ts           # Dexie ⇄ Supabase flush extension of sync-engine
│   │   └── supported-versions.ts          # export const SUPPORTED_LAYOUT_VERSIONS = [1]
│   └── offline/
│       ├── db.ts                          # EDIT — bump to v4, add draftLayouts table
│       └── sync-engine.ts                 # EDIT — add flushDraftLayouts()
├── actions/
│   ├── sections.ts                        # EDIT — add reorderSections, updateSectionLayout
│   └── sops/
│       └── createSopFromWizard.ts         # NEW — atomic SOP+sections create
├── hooks/
│   ├── useDraftLayoutSync.ts              # NEW — modeled on useSopSync.ts
│   └── useBuilderAutosave.ts              # NEW — Puck onChange → debounced Dexie write
├── app/
│   └── (protected)/
│       └── admin/
│           └── sops/
│               ├── new/
│               │   └── blank/
│               │       ├── page.tsx       # NEW — wizard entry
│               │       └── WizardClient.tsx
│               ├── builder/
│               │   └── [sopId]/
│               │       ├── page.tsx       # NEW — server component: fetch SOP+sections
│               │       └── BuilderClient.tsx   # NEW — 'use client' wrapper with next/dynamic
│               └── page.tsx               # EDIT — add AUTHORED IN BUILDER chip
└── types/
    └── sop.ts                             # EDIT — add layout_data, layout_version, source_type
supabase/
└── migrations/
    └── 00020_section_layout_data.sql      # NEW
```

### Pattern 1: Client-only Puck loading in Next.js 16 App Router

**What:** Puck must be lazy-imported from inside a `'use client'` component because (a) its DnD depends on browser APIs, (b) `ssr: false` on `next/dynamic` is only allowed from client components in App Router.

**When to use:** Every Puck editor mount point.

**Example:**

```tsx
// src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
'use client'

import dynamic from 'next/dynamic'
import { puckConfig } from '@/lib/builder/puck-config'
import type { Data } from '@puckeditor/core'

const PuckEditor = dynamic(
  () => import('@puckeditor/core').then((mod) => mod.Puck),
  { ssr: false, loading: () => <div className="p-8 text-steel-400">Loading editor…</div> }
)

export function BuilderClient({ sopId, initialData }: { sopId: string; initialData: Data }) {
  return <PuckEditor config={puckConfig} data={initialData} onChange={handleChange} />
}
```

Then the RSC page:

```tsx
// src/app/(protected)/admin/sops/builder/[sopId]/page.tsx
import '@puckeditor/core/puck.css' // CSS must be imported at app or page level

export default async function Page({ params }: { params: Promise<{ sopId: string }> }) {
  const { sopId } = await params
  // fetch sop + sections in RSC, pass Puck Data down to client
  return <BuilderClient sopId={sopId} initialData={...} />
}
```

[CITED: https://puckeditor.com/docs/getting-started — `npm i @puckeditor/core --save`]
[CITED: https://puckeditor.com/docs/integrating-puck/server-components — RSC passthrough pattern]
[CITED: https://nextjs.org/docs/app/guides/lazy-loading — `ssr: false` must be inside a Client Component in App Router]

### Pattern 2: Shared block component with co-located Zod schema

**What:** Each block file exports a React component and a Zod schema. The Puck config imports both; the worker `<Render>` pulls in only the component, transitively via the same config.

**Example:**

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
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-red-400" />
        <span className="text-sm font-bold uppercase tracking-widest text-red-400">{title}</span>
      </div>
      <p className="text-base text-steel-100 leading-relaxed">{body}</p>
    </div>
  )
}
```

And the Puck config:

```ts
// src/lib/builder/puck-config.ts
import type { Config } from '@puckeditor/core'
import { HazardCardBlock, HazardCardBlockPropsSchema } from '@/components/sop/blocks/HazardCardBlock'
// ... other 6 block imports

export const puckConfig: Config = {
  components: {
    HazardCardBlock: {
      fields: {
        title: { type: 'text' },
        body: { type: 'textarea' },
        severity: {
          type: 'select',
          options: [
            { label: 'Critical', value: 'critical' },
            { label: 'Warning', value: 'warning' },
            { label: 'Notice', value: 'notice' },
          ],
        },
      },
      defaultProps: { title: 'Hazard', body: '', severity: 'warning' },
      render: (props) => {
        // Safe-render guard: Zod parse inside render, fall back to empty-state (D-14)
        const parsed = HazardCardBlockPropsSchema.safeParse(props)
        if (!parsed.success) {
          return <div className="text-amber-400 text-sm">Hazard card — fix required props</div>
        }
        return <HazardCardBlock {...parsed.data} />
      },
    },
    // ... 6 more
  },
}
```

Puck's field types (`text`, `textarea`, `select`, `number`, `array`, `object`, `custom`) are what the admin side-panel renders. Zod is the runtime validator that catches corrupt `layout_data` at render time.

[CITED: https://puckeditor.com/docs/api-reference/fields — field type reference]
[CITED: https://puckeditor.com/docs/api-reference/configuration/component-config — component config shape]

### Pattern 3: Worker render via `<Render>`

**What:** Worker uses Puck's read-only `<Render>` component — same config, same data, no editor chrome.

**Example:**

```tsx
// src/components/sop/LayoutRenderer.tsx
'use client'

import { Render } from '@puckeditor/core'
import { puckConfig } from '@/lib/builder/puck-config'
import { SUPPORTED_LAYOUT_VERSIONS } from '@/lib/builder/supported-versions'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'

export function LayoutRenderer({ layoutData, layoutVersion, fallback }: Props) {
  if (!SUPPORTED_LAYOUT_VERSIONS.includes(layoutVersion)) {
    if (typeof window !== 'undefined') {
      console.warn('[layout] unsupported version', layoutVersion) // once per page via ref flag
    }
    return fallback
  }
  const parsed = LayoutDataSchema.safeParse(layoutData)
  if (!parsed.success) {
    console.warn('[layout] parse failed, fell back to linear')
    return fallback
  }
  return <Render config={puckConfig} data={parsed.data} />
}
```

Then the branch in `SectionContent.tsx`:

```tsx
export function SectionContent({ section }: SectionContentProps) {
  // NEW branch — renders null-safely
  if (section.layout_data != null && section.layout_version != null) {
    return (
      <LayoutRenderer
        layoutData={section.layout_data}
        layoutVersion={section.layout_version}
        fallback={<LegacyRenderer section={section} />}
      />
    )
  }
  return <LegacyRenderer section={section} />
}
```

The existing switch statement inside today's `SectionContent` becomes `<LegacyRenderer>` (extracted 1:1 so the byte-identical guarantee holds).

[CITED: https://puckeditor.com/docs/api-reference/components/render — Render API]

### Pattern 4: Additive Supabase migration following migration-00019 precedent

**What:** `00020_section_layout_data.sql` adds three things: `sop_sections.layout_data` (JSONB NULL), `sop_sections.layout_version` (INT NULL), and `sops.source_type` (TEXT with CHECK constraint — match the existing style; migration 00019 used `check (render_family in (...))` for its enum-like column rather than a true Postgres `enum` type).

**Example:**

```sql
-- 00020_section_layout_data.sql
begin;

alter table public.sop_sections
  add column if not exists layout_data jsonb,
  add column if not exists layout_version int;

-- No backfill — legacy rows keep NULL on both columns.
-- Worker branches on layout_data != null AND version supported.

alter table public.sops
  add column if not exists source_type text
    check (source_type in ('uploaded','blank','ai','template'));

-- Do NOT add NOT NULL + default in a single step on a large table.
-- Existing rows remain NULL; worker and library UI treat NULL as 'uploaded'
-- for display purposes, or a separate backfill statement (not required by
-- SPEC but recommended as a one-liner) sets all existing rows to 'uploaded'.
update public.sops set source_type = 'uploaded' where source_type is null;

-- Now enforce future writes
alter table public.sops alter column source_type set default 'uploaded';
alter table public.sops alter column source_type set not null;

-- Atomic reorder helper (workaround for supabase-js no-transaction limitation).
-- RLS still applies because the function runs as the caller (no SECURITY DEFINER).
create or replace function public.reorder_sections(
  p_sop_id uuid,
  p_ordered_section_ids uuid[]
) returns void
language plpgsql
as $$
begin
  update public.sop_sections
     set sort_order = arr.ord,
         updated_at = now()
    from unnest(p_ordered_section_ids) with ordinality as arr(id, ord)
   where sop_sections.sop_id = p_sop_id
     and sop_sections.id = arr.id;
end;
$$;

grant execute on function public.reorder_sections(uuid, uuid[]) to authenticated;

commit;
```

RLS inheritance: `sop_sections` already has RLS enabled (from Phase 1 / 00003_sop_schema.sql). New columns on an RLS-protected table are governed by the existing policies. No new policies required.

[VERIFIED: `supabase/migrations/00019_section_kinds_and_blocks.sql` — uses `check (... in (...))` pattern rather than `create type ... as enum`, consistent with SPEC scope of "additive" migration]
[VERIFIED: `supabase/migrations/00003_sop_schema.sql` line 2 — `sop_status` uses a real enum, but migration 00019 shows the project has accepted CHECK constraint enums for additive changes]

### Pattern 5: Dexie v4 table addition

**What:** Bump Dexie schema version from 3 → 4. Declare new `draftLayouts` store. Previous store declarations MUST be repeated verbatim; Dexie requires the cumulative schema.

**Example:**

```ts
// src/lib/offline/db.ts — append below the existing db.version(3).stores({...}) call

export interface DraftLayout {
  section_id: string          // primary key — matches Supabase row
  sop_id: string              // indexed for bulk queries per SOP
  layout_data: unknown        // opaque JSON — validated by LayoutDataSchema at read time
  layout_version: number
  updated_at: number          // epoch ms (client-side LWW)
  syncState: 'dirty' | 'synced'
  _cachedAt: number
}

// Extend SopAssistantDB union type with `draftLayouts: EntityTable<DraftLayout, 'section_id'>`

db.version(4).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, section_kind_id, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
  draftLayouts: 'section_id, sop_id, syncState, _cachedAt',
})
```

**No populate function needed** — `draftLayouts` is a new table with no legacy data to migrate. [CITED: https://dexie.org/docs/Version/Version.upgrade()]

**Multi-tab write conflict:** Dexie is IndexedDB-backed; IDB transactions serialize across tabs for the same DB. Two tabs writing the same `section_id` row will see LWW at the Dexie layer, then LWW again at the Supabase layer on flush (D-07). No additional locking needed.

### Pattern 6: Puck onChange debounced to Dexie

**What:** Puck fires `onChange(data)` on every edit. Wrap in a 750 ms debounce (D-06). Each onChange scope is per-section — because each section has its own `<Puck>` instance with its own `layout_data`.

**Example:**

```tsx
// src/hooks/useBuilderAutosave.ts
import { useCallback, useRef } from 'react'
import { db } from '@/lib/offline/db'
import type { Data } from '@puckeditor/core'

export function useBuilderAutosave(sectionId: string, sopId: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback((data: Data) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await db.draftLayouts.put({
        section_id: sectionId,
        sop_id: sopId,
        layout_data: data,
        layout_version: 1,
        updated_at: Date.now(),
        syncState: 'dirty',
        _cachedAt: Date.now(),
      })
      // Trigger the sync-engine flush (defined in sync-engine.ts)
      // in the same pattern as photoQueue flush on 3 s cadence.
    }, 750)
  }, [sectionId, sopId])
}
```

### Anti-Patterns to Avoid

- **Importing Puck in the worker bundle via a shared config file that also exports the Editor.** The worker only needs `<Render>`. Import both from `@puckeditor/core` — tree-shaking should eliminate the editor chunk for worker routes, but `Puck` and `Render` live in the same module entry. Mitigation: the worker imports `Render` only; webpack's tree-shaking drops the unused editor code because `@puckeditor/core` has no declared `sideEffects`. Verify via bundle analyzer after build (ties to SB-INFRA-03 though that's Phase 18). [VERIFIED: `npm view @puckeditor/core exports` — single root entry; no `sideEffects: false` flag declared, which MEDIUM-risks tree-shaking; CI bundle check is the escape valve]
- **Using Puck's built-in `viewports` prop for mobile preview while ALSO porting the sketch CSS toggle.** Two competing preview systems. CONTEXT D-01 locks the sketch approach — do not pass `viewports` prop unless the sketch toggle is removed.
- **Running `update` statements in a loop from a server action for reorder.** Without atomicity, a crashed request can leave `sort_order` in a broken state. Use the RPC.
- **Storing `layout_data` in Dexie and forgetting the `syncState` flag.** The sync-engine flush loop needs a way to find dirty rows; a boolean/string flag indexed in Dexie is the cleanest pattern (matches `photoQueue.uploaded`).
- **Treating `layout_version` as a semver string.** SPEC locks it as a monotonic integer. Puck's own `migrate()` helper uses integer-versioned transforms and expects this shape.
- **Using `'use server'` on a file that imports Puck.** Puck is a client-only library; any server module that transitively imports it will break the RSC build. Server actions should import only the Zod schemas (pure) and the config-less block props, never `@puckeditor/core`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop UI with block palette, nested zones, inline editing | Custom `@dnd-kit` + React | `@puckeditor/core` | Mandated; Puck ships side-panel, DnD, field validation, undo/redo, viewports, plugin rail |
| Client-side transaction for atomic multi-row update | Loop of `supabase.from().update()` calls | Postgres RPC function | supabase-js has no transaction support (postgrest-js archived 2026-01-23) |
| Layout schema versioning / migration of old data | Manual JSON transforms | Puck `migrate()` + `transformProps()` | Puck provides battle-tested helpers that handle prop renames, zone migrations, and slot restructuring. Call in the reader at render time or in a batch job. |
| Form step state management for 4-step wizard | Custom React reducer | `react-hook-form` + step index | RHF is already installed; `useForm` + `useState` for current step is the project pattern |
| IndexedDB versioning / upgrade | `indexedDB.open` directly | Dexie `db.version(N).stores()` | Dexie is already the offline store; its upgrade API handles the schema evolution and transaction coordination |
| Debounced client-side flush | `setTimeout` in component | Project's existing `sync-engine.ts` + a `flushDraftLayouts` addition | Phase 3 pattern is battle-tested in `flushPhotoQueue` / `flushCompletions` — extend it, don't parallel it |
| Zod prop validation UI inside the builder | Custom error surfaces per block | Puck's built-in field error rendering + D-16 red-outline on block shell | Puck renders prop errors in the side-panel; D-16 layers our red outline on the preview shell |

**Key insight:** Puck already solves roughly 80% of what a custom builder would solve. The work in Phase 12 is integration, schema, and persistence — not DnD or UI primitives. Over-engineering custom editor affordances will cost time and conflict with Phase 17's collab work.

## Runtime State Inventory

*(Phase 12 is additive — no rename/refactor of existing identifiers. This section is included for completeness.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 12 only ADDS columns/tables; never renames existing keys. Legacy SOPs keep `layout_data = NULL` and render via the linear path. | None |
| Live service config | None — no external service depends on SafeStart's internal schema | None |
| OS-registered state | None | None |
| Secrets/env vars | None — Puck runs fully client-side with no API key. No new env vars. | None |
| Build artifacts | `node_modules/@puckeditor/core` is a fresh install; no stale artifact risk. However, existing Dexie v3 databases in client browsers auto-upgrade to v4 on next page load. | Verify upgrade path works: open a v3 DB, trigger `db.open()`, confirm draftLayouts store appears. Covered by `tests/offline-sync.test.ts` adjacent patterns. |

## Common Pitfalls

### Pitfall 1: Package rename bite
**What goes wrong:** Plans install `@measured/puck` verbatim from SPEC and end up with 0.20.2, which is the pre-rename version. The Puck website and recent docs reference `@puckeditor/core` APIs only.
**Why it happens:** SPEC was drafted before the rename (Puck 0.21 shipped 2026-01-14). The roadmap and CONTEXT inherited the old name.
**How to avoid:** Install `@puckeditor/core@0.21.2`. Update import statements (`from '@puckeditor/core'`). Import CSS from `@puckeditor/core/puck.css`.
**Warning signs:** Build warnings about deprecated scope; missing `richtext` field type; docs links 404ing under `/measured`.

### Pitfall 2: Puck CSS not imported
**What goes wrong:** Editor renders but has no styles — side-panel invisible, drag handles missing. Everything looks broken.
**Why it happens:** `@puckeditor/core` ships a separate CSS bundle at `@puckeditor/core/puck.css` that must be manually imported at app or page level. The JS bundle does not auto-inject it.
**How to avoid:** `import '@puckeditor/core/puck.css'` at the top of `BuilderClient.tsx` (since it's a `'use client'` file) OR at the top of the route page. Do NOT import it in the shared block components (would pollute worker bundle).
**Warning signs:** Puck editor renders as unstyled DOM; console warnings about missing CSS variables.

### Pitfall 3: ssr:false imported from a server component
**What goes wrong:** Next.js build fails with `Error: ssr: false is not allowed with next/dynamic in Server Components`.
**Why it happens:** App Router forbids `ssr: false` in server components. Puck must be dynamic-imported from inside a component that begins with `'use client'`.
**How to avoid:** The server page (`page.tsx`) renders `<BuilderClient>`; `BuilderClient.tsx` has `'use client'` and calls `dynamic(..., { ssr: false })` itself.
[CITED: https://nextjs.org/docs/app/guides/lazy-loading]

### Pitfall 4: supabase-js has no transactions — reorder is lossy
**What goes wrong:** `reorderSections` writes `UPDATE` statements in a loop. A network failure between writes leaves `sort_order` partially updated. Worker walkthrough shows wrong order on next load.
**Why it happens:** postgrest-js was archived 2026-01-23 without ever adding transaction support. A client-side transaction is architecturally impossible.
**How to avoid:** Write the reorder as a Postgres function called via `supabase.rpc('reorder_sections', { p_sop_id, p_ordered_section_ids })`. The function does the whole reorder in a single DB transaction implicitly.
**Warning signs:** Intermittent test failures on flaky network; two rows with same `sort_order` value.

### Pitfall 5: Tree-shaking doesn't drop the editor from worker bundle
**What goes wrong:** Worker route pulls in Puck's 400 KB editor despite only using `<Render>`. First-Load-JS blows up by 120+ KB gzipped.
**Why it happens:** `@puckeditor/core` has no `"sideEffects": false` in its package.json exports. Webpack cannot automatically tree-shake modules with side-effects flagged. Puck docs don't guarantee zero editor code in the `<Render>`-only path.
**How to avoid (Phase 12):** Accept some editor code on the worker route for Phase 12; document the concern. Phase 18 (SB-INFRA-03) specifically adds a CI check for worker bundle composition. The planner should add a follow-up task note rather than try to solve this in Phase 12.
**Warning signs:** `next build` output shows `/sops/[sopId]/walkthrough` first-load JS > 350 KB gzipped.
[VERIFIED: `npm view @puckeditor/core` returns no `sideEffects` field; Bundlephobia reports ~128 KB gzip for the main bundle]

### Pitfall 6: Dexie v3 → v4 upgrade loses cached SOPs
**What goes wrong:** Developer writes `db.version(4).stores({ draftLayouts: 'section_id, ...' })` and omits the existing store declarations. Dexie interprets missing stores as "delete", wiping `sops`, `sections`, etc. from every worker's device.
**Why it happens:** Dexie's `version(N).stores({...})` is declarative-cumulative — each version must list every store that should exist at that version.
**How to avoid:** Copy the full v3 `stores` object, add `draftLayouts` to it, pass as v4. The existing v3 → v4 pattern in `db.ts` lines 73–81 shows exactly this.
**Warning signs:** After the first page load post-deploy, offline users see empty SOP lists.
[VERIFIED: `src/lib/offline/db.ts` lines 57–81 show this pattern across v1 → v3]

### Pitfall 7: Publish wiring mismatch — SPEC references "publishSop server action" but it doesn't exist
**What goes wrong:** Planner grep-searches for `publishSop` and finds nothing; creates a new server action that duplicates logic. Now two publish paths exist.
**Why it happens:** Today's publish is `POST /api/sops/[sopId]/publish` (src/app/api/sops/[sopId]/publish/route.ts), not a server action. The review page calls it via `fetch`. SPEC SB-AUTH-05 says "one `publishSop` export" but the codebase uses an API route.
**How to avoid:** Either (a) keep the API route, update SPEC wording interpretation to "single publish endpoint" (CONTEXT D-04 already says the builder navigates to the review page, so the builder never calls publish directly); OR (b) extract publish into a server action wrapping the existing route logic. Option (a) is lower-risk for Phase 12 and already satisfied by D-04.
**Warning signs:** Test expectation says "grep confirms one `publishSop` export" — the literal grep will fail today regardless of what Phase 12 does, because there is no such export.
[VERIFIED: `grep -r "publishSop" src/` returns zero matches; `src/app/api/sops/[sopId]/publish/route.ts` is the publish implementation]

### Pitfall 8: section_kind_id on wizard-created sections
**What goes wrong:** Wizard creates sections with `section_kind_id` set but without `section_type` populated; the existing linear renderer's `resolveRenderFamily` lookup falls through to default.
**Why it happens:** The existing `createSection` server action (src/actions/sections.ts line 71) mirrors `kind.slug` into `section_type`. New wizard code must do the same.
**How to avoid:** Reuse `createSection` or replicate the kind→section_type mapping. Consider refactoring `createSection` to accept an array for wizard-scale batching.
**Warning signs:** Blank-wizard SOP's Hazards section renders as generic content on the worker side.
[VERIFIED: `src/actions/sections.ts` line 71–80 shows the pattern]

### Pitfall 9: source_type NULL on existing rows breaks library chip filter
**What goes wrong:** The migration adds `source_type` but doesn't backfill, so all existing SOPs have `source_type = NULL`. The library chip logic `source_type != 'uploaded'` is TRUE for NULL in SQL three-valued logic (actually, `NULL != 'uploaded'` returns NULL, not TRUE). Worse: `NULL != 'uploaded'` in a WHERE filter is falsy so no filter works predictably.
**Why it happens:** SQL NULL semantics surprise developers who think of it as "not equal to anything".
**How to avoid:** Run a one-time UPDATE in the migration to set all existing `source_type = 'uploaded'` before applying the NOT NULL constraint. Migration snippet in Pattern 4 above does this.
**Warning signs:** Library test expects chip absent for uploaded SOPs; sees NULL and renders the chip anyway.

### Pitfall 10: Puck `<Render>` inside a Suspense boundary that also contains suspense-sensitive children
**What goes wrong:** Worker walkthrough loads `<Render>` which internally uses Zustand and other client hooks. Wrapping in an existing Suspense boundary meant for server-component data can cause infinite re-render when `layout_data` updates.
**Why it happens:** Puck's internal state management expects a stable React tree; Suspense re-mounting resets its state.
**How to avoid:** Mount `<LayoutRenderer>` in a stable parent that isn't inside Suspense, OR pass `key={section.id}` so rev-mounts are deterministic.
**Warning signs:** Console warning about "setState on unmounted component" during walkthrough navigation.

## Code Examples

Verified patterns — all drawn from official Puck docs or the project's existing patterns.

### Puck editor mounting with onChange

```tsx
// Source: https://puckeditor.com/docs/api-reference/components/puck + project pattern
'use client'
import dynamic from 'next/dynamic'
import { puckConfig } from '@/lib/builder/puck-config'
import { useBuilderAutosave } from '@/hooks/useBuilderAutosave'
import type { Data } from '@puckeditor/core'

const Puck = dynamic(
  () => import('@puckeditor/core').then((m) => m.Puck),
  { ssr: false }
)

export function SectionEditor({ sectionId, sopId, initialData }: Props) {
  const onChange = useBuilderAutosave(sectionId, sopId)
  return (
    <Puck
      config={puckConfig}
      data={initialData ?? { content: [], root: { props: {} } }}
      onChange={onChange}
    />
  )
}
```

### Puck Render in worker path

```tsx
// Source: https://puckeditor.com/docs/api-reference/components/render
'use client'
import { Render } from '@puckeditor/core'
import { puckConfig } from '@/lib/builder/puck-config'

export function BlockRenderer({ data }: { data: Data }) {
  return <Render config={puckConfig} data={data} />
}
```

### Postgres RPC reorder called from server action

```ts
// src/actions/sections.ts — addition
'use server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ReorderInput = z.object({
  sopId: z.string().uuid(),
  orderedSectionIds: z.array(z.string().uuid()).min(1),
})

export async function reorderSections(input: z.infer<typeof ReorderInput>) {
  const parsed = ReorderInput.parse(input)
  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_sections', {
    p_sop_id: parsed.sopId,
    p_ordered_section_ids: parsed.orderedSectionIds,
  })
  if (error) throw new Error(`Reorder failed: ${error.message}`)
}
```

### Dexie draftLayouts flush (extends sync-engine)

```ts
// src/lib/offline/sync-engine.ts — addition
export async function flushDraftLayouts(
  supabase: AnySupabaseClient
): Promise<{ flushed: number; errors: string[] }> {
  const errors: string[] = []
  let flushed = 0
  const dirty = await db.draftLayouts.where('syncState').equals('dirty').toArray()

  for (const row of dirty) {
    try {
      // Last-write-wins: if server row newer, accept server version (D-07)
      const { data: server } = await supabase
        .from('sop_sections')
        .select('updated_at')
        .eq('id', row.section_id)
        .single()

      const serverTime = server ? new Date(server.updated_at).getTime() : 0
      if (serverTime > row.updated_at) {
        // Server is newer — drop our draft
        await db.draftLayouts.update(row.section_id, { syncState: 'synced' })
        continue
      }

      const { error } = await supabase
        .from('sop_sections')
        .update({
          layout_data: row.layout_data,
          layout_version: row.layout_version,
          updated_at: new Date(row.updated_at).toISOString(),
        })
        .eq('id', row.section_id)

      if (error) {
        errors.push(`Draft ${row.section_id}: ${error.message}`)
        continue
      }
      await db.draftLayouts.update(row.section_id, { syncState: 'synced' })
      flushed++
    } catch (err) {
      errors.push(`Draft ${row.section_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { flushed, errors }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@measured/puck` | `@puckeditor/core` | Puck 0.21 — 2026-01-14 | Package rename + new scope. SPEC references the old name. |
| `DropZone` component for nested zones | `slot` field type in component config | Puck 0.19 — 2025 | DropZone is still supported but "being replaced" per API docs. New code should prefer `slot`. |
| Client-only `<Render>` | Server-component-capable `<Render>` (via `@puckeditor/core/rsc` export) | Puck 0.19+ | Worker path could theoretically SSR; not required for Phase 12 but useful for future optimization |
| supabase-js transactions (never existed) | Postgres RPC / Edge Functions | postgrest-js archived 2026-01-23 | No future client transactions are coming. All multi-row atomic writes must be RPCs. |

**Deprecated/outdated:**
- `@measured/puck` — still installable but receives a migration notice; will not get new features. Use `@puckeditor/core`.
- `DropZone` — still works; prefer `slot` field type for new code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Puck `<Render>` does not transitively force the editor bundle onto worker routes IF webpack tree-shaking is effective despite missing `sideEffects: false` flag | Pitfall 5 | Worker First-Load-JS grows by ~120 KB gzip; Phase 18 CI check will catch it. Phase 12 tasks should note this as a known trade-off. |
| A2 | Dexie v3 → v4 upgrade succeeds on all client browsers without data loss when only adding a new table | Pattern 5 | If false, worker devices lose cached SOPs on next page load. Mitigation: Playwright test that walks v3 DB → v4 upgrade. |
| A3 | Existing RLS policies on `sop_sections` cover writes/reads to the new `layout_data` column without amendment | Pattern 4 | If false, authenticated users get denied writes. Mitigation: add explicit test in `tests/rls-isolation.test.ts`. Historically TRUE for Supabase — RLS is table-level, not column-level. |
| A4 | Puck 0.21's field types (`text`, `textarea`, `select`, `number`, `array`, `object`, `custom`) are sufficient for all 7 Phase 12 blocks | Standard Stack | If the designer wants e.g. a color picker, a custom field is needed. Per CONTEXT, the standard side-panel is used — no custom fields planned. |

## Open Questions (RESOLVED)

*All questions have been resolved during planning. Locked outcomes below are authoritative for executors.*

1. **Does SPEC's `publishSop` grep assertion need reinterpretation?**
   - RESOLVED: The builder never calls publish directly. CONTEXT D-04 is authoritative — the builder's `SEND TO REVIEW` button navigates to the existing `/admin/sops/[sopId]/review` page, which in turn invokes the existing `POST /api/sops/[sopId]/publish` route. No new `publishSop` server action is created. The SPEC literal grep is reinterpreted as behavioural convergence ("both UI surfaces end at the same review + publish endpoint"), verified by Plan 03's SB-AUTH-05 test asserting both paths converge on the review page and that `/api/sops/[sopId]/publish` is reachable from there.
   - What we know: No `publishSop` export exists today. Publish is `POST /api/sops/[sopId]/publish`.

2. **Should each section get its own `<Puck>` instance, or one builder with multiple sections as root zones?**
   - RESOLVED: One `<Puck>` instance, remounted per section via `key={activeSectionId}` on the `<Puck>` element. Dexie `draftLayouts` holds the per-section state; remount is cheap and avoids state bleed across sections. Implemented in Plan 01 Task 3 (BuilderClient) and re-confirmed in Plan 04 Task 1 (onChange wiring).
   - What we know: D-02 says section navigation is a left sidebar (click to switch).

3. **What's the failure mode if `layout_data` size exceeds Postgres jsonb practical limits?**
   - RESOLVED: 128 KB hard cap enforced in the `updateSectionLayout` server action. Payloads exceeding `Buffer.byteLength(JSON.stringify(layoutData), 'utf8') > 128 * 1024` are rejected with `{ error: 'Layout exceeds 128 KB; reduce block count or content' }` before any Supabase UPDATE. Implemented in Plan 04 Task 2 via the `MAX_LAYOUT_BYTES` constant.
   - What we know: Postgres jsonb hard limit is 1 GB; practical perf suffers above a few MB.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Dev + Railway build | ✓ | ≥20 (engines pin in package.json) | — |
| npm | Install `@puckeditor/core` | ✓ | 10+ | — |
| Postgres 15+ | Supabase hosted; `jsonb`, `array unnest() with ordinality` | ✓ | Supabase production | — |
| Supabase CLI | Local migration apply | ✓ (dev dep `supabase: ^2.22.6`) | 2.22+ | — |
| Playwright | Stub-to-real test conversion | ✓ | `^1.58.2` | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase12-stubs` (project to be added per Wave 0) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SB-AUTH-01 | Wizard 4-step completes, lands at builder route with 3 sections | integration + e2e | `npx playwright test tests/sb-auth-builder.test.ts -g "SB-AUTH-01"` | ✅ (fixme stub) |
| SB-AUTH-04 | Single builder route handles all entry points; `sops.source_type = 'blank'` for wizard | integration | `npx playwright test tests/sb-auth-builder.test.ts -g "SB-AUTH-04"` | ✅ (fixme stub) |
| SB-AUTH-05 | Library chip visible for non-uploaded; publish path reuses existing endpoint | e2e + unit (grep) | `npx playwright test tests/sb-auth-builder.test.ts -g "SB-AUTH-05"` + CI grep | ✅ (fixme stub) |
| SB-LAYOUT-01 | 7 blocks in palette, DiagramHotspotBlock absent, 2-col grid works | e2e (DOM queries) | `npx playwright test tests/sb-layout-editor.test.ts -g "SB-LAYOUT-01"` | ✅ (fixme stub) |
| SB-LAYOUT-02 | Block HTML matches between admin editor preview and worker walkthrough | e2e (HTML diff) | `npx playwright test tests/sb-layout-editor.test.ts -g "SB-LAYOUT-02"` | ✅ (fixme stub) |
| SB-LAYOUT-03 | 393×852 viewport: blocks span viewport width; no JS-based viewport branching | e2e (viewport + grep) | `npx playwright test tests/sb-layout-editor.test.ts -g "SB-LAYOUT-03"` + `grep -rE "isMobile\|useMediaQuery\|navigator\.userAgent" src/components/sop/blocks/` | ✅ (fixme stub) |
| SB-LAYOUT-04 | Edit → 5s later DB row has layout_version=1 + non-null JSONB; airplane-mode queues, reconnect flushes | e2e (DB poll + network offline) | `npx playwright test tests/sb-layout-editor.test.ts -g "SB-LAYOUT-04"` | ✅ (fixme stub) |
| SB-LAYOUT-06 | 3 scenarios: NULL legacy, version=999 fallback+warn, version=1 renders | e2e (fixture SOPs) | `npx playwright test tests/sb-layout-editor.test.ts -g "SB-LAYOUT-06"` | ✅ (fixme stub) |
| SB-SECT-05 | Drag section 3 → index 1; sort_order atomic; worker reflects on next load | e2e | `npx playwright test tests/sb-section-schema.test.ts -g "SB-SECT-05"` | ✅ (passing for 11 scope; extend for 12) |
| RPC integrity | `reorder_sections` handles concurrent callers without corruption | unit (SQL) | SQL test in a new `tests/rls-isolation.test.ts` case | ❌ Wave 0 |
| Migration idempotency | `00020_section_layout_data.sql` reruns cleanly | unit | Supabase local test with `supabase db reset` | covered by Supabase tooling |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase12-stubs` (targets only phase 12 test files)
- **Per wave merge:** `npx playwright test --project=phase12-stubs --project=phase3-stubs --project=phase11-stubs` (phase 12 + adjacent for regression)
- **Phase gate:** `npm test` — full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `playwright.config.ts` — add `phase12-stubs` project matching `sb-auth-builder|sb-layout-editor|sb-section-schema|sb-builder-infrastructure`. Current `phase11-stubs` line 47 already matches these files; decide whether to split phase 11 vs 12 ownership or share.
- [ ] `tests/rls-isolation.test.ts` — add test case for `reorder_sections` RPC returning permission error when caller is not admin of the SOP's org.
- [ ] Fixture helper: a Playwright helper to seed an SOP with `layout_version = 999` (for the unsupported-version case in SB-LAYOUT-06).
- [ ] Fixture helper: a Playwright helper to drive Puck's block palette (drag-drop synthesis is non-trivial — consider using Puck's programmatic `setData` via a test hook rather than real DnD gestures).

## Project Constraints (from CLAUDE.md)

- **Dev port 4200** — never hardcode in Railway start command; builder dev loop uses `npm run dev` which serves at `http://localhost:4200`.
- **Railway Node 20 pin** — `@puckeditor/core` peer on React 19 + its TipTap/ProseMirror deps require Node 20+. Engines pin in `package.json` already satisfies.
- **Windows optional deps** — `@tailwindcss/oxide-win32-x64-msvc` and `lightningcss-win32-x64-msvc` stay in `optionalDependencies`. No new Windows-only deps expected from Puck.
- **Parallel worktree merge check** — when Phase 12 is executed across multiple worktrees, watch for duplicate `export function reorderSections` declarations after merge. Use the CLAUDE.md dedup rule.
- **Dark theme default** — all 7 block components must render against `bg-steel-900 / text-brand-yellow` palette. HazardCardBlock uses `red-400`, PPECardBlock uses `blue-400` (matches existing `SectionContent.tsx` palette lines 32, 59).
- **Large tap targets** — worker-rendered blocks must preserve 44×44 px min touch targets per SPEC SB-LAYOUT-03.
- **Server actions in `src/actions/`** — `createSopFromWizard`, `reorderSections`, `updateSectionLayout` all belong there.
- **Zod validators convention** — project convention places SOP schemas in `src/lib/validators/`, but CONTEXT D-09 explicitly deviates for block prop schemas (co-located with block). Note this deviation in the plan.

## Sources

### Primary (HIGH confidence)
- Context7: `/websites/puckeditor` — fetched 2026-04-23; covers component config, fields, Render, viewports, Next.js integration, data migration.
- `npm view @puckeditor/core` — version 0.21.2, published 2026-04-17; peer react ^18.0.0 || ^19.0.0; dependencies include @dnd-kit/react 0.1.18, @tiptap/core ^3.11.1, @tanstack/react-virtual ^3.13.9, zustand ^5.0.3.
- `npm view @measured/puck` — version 0.20.2, published 2026-01-29; confirms old package abandoned.
- Puck blog: https://puckeditor.com/blog/puck-021 — confirms package rename 2026-01-14.
- Puck upgrade-guide: https://puckeditor.com/docs/integrating-puck/data-migration — `migrate()` and `transformProps()` APIs.
- Puck getting-started: https://puckeditor.com/docs/getting-started — install command + minimal editor.
- Puck components/render: https://puckeditor.com/docs/api-reference/components/render — Render API.
- Next.js 16 docs: https://nextjs.org/docs/app/guides/lazy-loading — `ssr: false` restriction in App Router.
- Dexie docs: https://dexie.org/docs/Version/Version.upgrade() — version bump + new-table semantics.
- `supabase/migrations/00019_section_kinds_and_blocks.sql` — migration style precedent (CHECK enum, RLS via current_organisation_id, additive-only).
- `src/lib/offline/db.ts` — Dexie v3 current schema.
- `src/lib/offline/sync-engine.ts` — flush pattern precedent (`flushPhotoQueue`, `flushCompletions`).
- `src/components/sop/SectionContent.tsx` — current worker renderer.
- `src/actions/sections.ts` — `createSection` pattern for wizard reuse.
- `src/app/api/sops/[sopId]/publish/route.ts` — current publish implementation (not a server action).
- Bundlephobia (@puckeditor/core@0.21.2): main 128 KB gzip, additional chunks totaling ~240 KB gzip.

### Secondary (MEDIUM confidence)
- WebSearch results on supabase-js transactions (cross-referenced with official GitHub discussions #526, #4562, and postgrest-js archival notice dated 2026-01-23).
- Puck 0.21 blog post interpretation (breaking changes summary — detailed upgrade guide not retrievable via WebFetch; no 404 on the blog post itself).
- Medium articles on Next.js App Router + ssr:false patterns (used for cross-verification, not as primary source).

### Tertiary (LOW confidence)
- DEV Community "Next.js 16 App Router: The Complete Guide for 2026" — general corroboration only.

## Metadata

**Confidence breakdown:**
- Puck package/version: HIGH — direct npm registry + official docs cross-check.
- Puck Next.js integration pattern: HIGH — official docs explicit.
- Dexie upgrade path: HIGH — official docs + project's own precedent.
- Supabase-js transaction workaround: HIGH — multiple primary sources confirm.
- Bundle-size worker-path impact: MEDIUM — Bundlephobia reliable but Puck tree-shaking behavior is not guaranteed; follow-up CI check planned in Phase 18.
- Reorder RPC atomicity: HIGH — `update ... from unnest(...) with ordinality` is a standard Postgres idiom; runs in one transaction implicitly.
- SPEC/CONTEXT/code alignment for `publishSop`: MEDIUM — SPEC wording conflicts with current codebase; Open Question 1 flags for planner resolution.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (Puck ships minor releases roughly monthly; @puckeditor/core 0.22 is already in canary 2026-04)
