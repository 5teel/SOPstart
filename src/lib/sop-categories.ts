/**
 * Phase 40 DAT-01 / D-01 / D-03 — the single SOP-category vocabulary.
 *
 * This is a fixed seed managed in code, deliberately NOT a database table:
 * nothing needs referential integrity against it (sop_review_cadences,
 * approval_chains, and collections all key on plain text with no FK), an
 * org-editable list is an explicitly deferred idea, and a lookup table would
 * add an RLS surface plus a PostgREST schema-cache hazard (CLAUDE.md
 * [2026-06-15]) for zero gain. Upgrade path: if/when the deferred
 * org-editable vocabulary idea is promoted, add a `sop_categories` table
 * mirroring the `block_categories` (00022) shape and generate this file's
 * exports from it instead of hand-maintaining them.
 *
 * Seed source: scripts/survey-sop-categories.mjs (run 2026-07-29 against the
 * live database) — every sops.category_tag value and every sops.category
 * value with count >= 2 is represented, per D-01. See 40-04-SUMMARY.md for
 * the full survey output and the explicit mapping table.
 */

export const SOP_CATEGORIES = [
  { slug: 'safety', label: 'Safety', sort: 10 },
  { slug: 'ppe', label: 'PPE', sort: 20 },
  { slug: 'machine-operation', label: 'Machine Operation', sort: 30 },
  { slug: 'manufacturing', label: 'Manufacturing', sort: 35 },
  { slug: 'maintenance', label: 'Maintenance', sort: 40 },
  { slug: 'quality', label: 'Quality', sort: 50 },
  { slug: 'cleaning-hygiene', label: 'Cleaning & Hygiene', sort: 60 },
  { slug: 'emergency', label: 'Emergency', sort: 70 },
  { slug: 'forklift-vehicles', label: 'Forklift & Vehicles', sort: 80 },
  { slug: 'chemical-handling', label: 'Chemical Handling', sort: 90 },
  { slug: 'electrical', label: 'Electrical', sort: 100 },
  { slug: 'training-induction', label: 'Training & Induction', sort: 110 },
  { slug: 'environmental', label: 'Environmental', sort: 120 },
  { slug: 'admin-office', label: 'Admin & Office', sort: 130 },
  { slug: 'other', label: 'Other', sort: 140 },
] as const

export type SopCategorySlug = (typeof SOP_CATEGORIES)[number]['slug']

export function categoryLabel(slug: string | null): string | null {
  if (!slug) return null
  return SOP_CATEGORIES.find((c) => c.slug === slug)?.label ?? null
}

export function isValidCategorySlug(slug: unknown): slug is SopCategorySlug {
  return typeof slug === 'string' && SOP_CATEGORIES.some((c) => c.slug === slug)
}

/**
 * Deterministic runtime twin of migration 00058's pass-1 SQL (D-02 exact/
 * slug match). Returns the slug when `raw` matches a slug exactly or a
 * label case-insensitively, otherwise null. The AI-mapping pass exists only
 * in the one-off 40-06 backfill, never at runtime -- an unmatched value
 * degrades to uncategorised (null), it does not 400 the request.
 */
export function normaliseToCategorySlug(raw: string | null | undefined): SopCategorySlug | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (!v) return null
  const match = SOP_CATEGORIES.find((c) => c.slug === v || c.label.toLowerCase() === v)
  return match?.slug ?? null
}
