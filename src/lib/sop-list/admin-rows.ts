// Phase 41 Plan 02 — pure row helpers, status-tab/sentinel constants, and the
// `MillerSop` type, extracted verbatim from
// `src/app/(protected)/admin/sops/page.tsx` (:31-115) plus the `MillerSop`
// type moved here from `src/components/admin/SopMillerBrowser.tsx`. Plain
// module — no 'use server' / 'use client' — a pure sync export in a
// 'use server' file fails `next build` with "Server Actions must be async
// functions" while passing `tsc` (CLAUDE.md 2026-06-27), so these helpers
// live outside `src/actions/`.

import type { Department } from '@/types/sop'

// Sketch 004 variant A — ONE rail: All · Drafts · Published · Needs attention
// · Access, with the rare filters (Parse issues · Owned by me) folded behind
// a native <details> menu. The rail is the page's only control tier.
// The tab counts must add up to All. They did not: a SOP mid-pipeline is
// neither a draft nor published, so `uploading`/`parsing` rows were reachable
// only through the FILTER dropdown and All read 30 while Drafts + Published
// read 28. Two rows were effectively invisible — including one that had been
// stuck in `parsing` for 29 days. `still_working` is rendered only when the
// count is non-zero, so a healthy org sees three tabs as before.
export const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Still working', value: 'failed' },
]

/**
 * A SOP that has been `uploading` or `parsing` for longer than this is not
 * working, it is wedged — the pipeline's own worst case is ~2 minutes for
 * video. Surfacing it as a flag is what makes the zombie rows actionable
 * rather than merely present.
 */
export const STUCK_AFTER_MS = 60 * 60 * 1000

// Sentinel non-existent id: forces a zero-row `.in('id', …)` result without
// special-casing an empty-array argument (Postgres/PostgREST edge case).
export const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000'

/**
 * A SOP created by upload has no title of its own, so the row falls back to the
 * source filename — which printed "Plenum chamber change procedure.pdf" and
 * "test-sop-page.webp" as if they were titles. Dropping the extension stops the
 * list reading like a file browser. The row also italicises these, because an
 * untitled SOP is a thing to fix, not a naming style.
 */
export function stripExtension(name: string | null | undefined): string {
  if (!name) return 'Untitled SOP'
  return name.replace(/\.[a-z0-9]{2,5}$/i, '') || name
}

/** `simonscott86@gmail.com` is 21 characters of noise on every row. */
export function shortOwner(label: string | null): string {
  if (!label) return ''
  return label.includes('@') ? label.split('@')[0] : label
}

/**
 * Compact relative age. The list had no date at all, so there was nothing to
 * scan by and no way to tell a SOP touched this morning from one abandoned in
 * April. `relativeDay` reads `Date.now()`; it is called only server-side
 * (inside the `listAdminSopRows` action) and its output ships as a
 * pre-rendered string, so there is no hydration-mismatch exposure — a later
 * refactor must not move this call into a client render.
 */
export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

/** Everything the list and detail panes need, resolved server-side. */
export type MillerSop = {
  id: string
  title: string | null
  /** Filename fallback, already stripped of its extension. */
  displayTitle: string
  untitled: boolean
  status: string
  categoryLabel: string | null
  categorySlug: string | null
  departments: string[]
  departmentIds: string[]
  allDepartments: boolean
  ownerLabel: string | null
  age: string
  updatedAt: string | null
  flagLabel: string | null
  flagStyle: string | null
  stuck: boolean
  confidence: number | null
}

export type AdminScopeDepartment = { id: string; name: string; count: number }

/** Return shape of `listAdminSopRows` — 41-04's status lens is written against this. */
export type AdminSopListResult = {
  sops: MillerSop[]
  departments: Department[]
  railCounts: { all: number; draft: number; published: number; failed: number }
  scopeDepartments: AdminScopeDepartment[]
  noAudienceCount: number
  flaggedCount: number
  scopeLabel: string
  filtered: boolean
}
