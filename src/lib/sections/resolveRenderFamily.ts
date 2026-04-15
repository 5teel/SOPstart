import type { SopSection, SectionRenderFamily, SectionKind } from '@/types/sop'

/**
 * Resolve a section's render family (used by the worker walkthrough
 * renderer to pick which component to mount).
 *
 * Priority order:
 *   1. If section.section_kind?.render_family is set → use it (v3.0 path).
 *   2. Else, run the legacy substring fallback on section.section_type
 *      so v1/v2 SOPs render identically.
 *   3. If the section has sop_steps.length > 0, upgrade 'content' → 'steps'
 *      (steps-by-shape, matching today's SectionContent.tsx logic).
 */
export function resolveRenderFamily(
  section: Pick<SopSection, 'section_type' | 'section_kind'> & {
    sop_steps?: { id: string }[]
  }
): SectionRenderFamily {
  const joined = section.section_kind?.render_family
  if (joined) return joined
  return inferRenderFamilyFromType(section.section_type, section.sop_steps?.length ?? 0)
}

/**
 * Legacy substring matcher preserved verbatim from SopSectionTabs.tsx /
 * SectionContent.tsx. Do not modify without running the v1/v2 regression.
 *
 * REGRESSION GUARD: there is intentionally NO branch mapping the legacy
 * proc-edure section_type to steps. A section with that type name and zero
 * extracted steps must render as content (DefaultContent), matching the
 * original SectionContent cascade. Adding such a branch would silently
 * regress legacy SOPs to an empty StepsContent render. Locked by
 * tests/resolve-render-family.test.ts Test 7.
 */
export function inferRenderFamilyFromType(
  sectionType: string,
  stepCount: number
): SectionRenderFamily {
  const t = sectionType.toLowerCase()
  if (t.includes('hazard')) return 'hazard'
  if (t.includes('emergency')) return 'emergency'
  if (t.includes('ppe') || t.includes('protective')) return 'ppe'
  if (stepCount > 0) return 'steps'              // steps-by-shape wins over any type-name match
  if (t.includes('sign') && t.includes('off')) return 'signoff'
  return 'content'
}

/**
 * Resolve tab styling (icon + color) for the worker walkthrough tab bar.
 * Prefers the section_kind metadata; falls back to hard-coded canonical colors.
 */
export function resolveTabStyling(
  section: Pick<SopSection, 'section_type' | 'section_kind'>
): {
  family: SectionRenderFamily
  icon: string | null
  colorFamily: string | null
  displayName: string | null
} {
  const kind: SectionKind | null | undefined = section.section_kind
  if (kind) {
    return {
      family: kind.render_family,
      icon: kind.icon,
      colorFamily: kind.color_family,
      displayName: kind.display_name,
    }
  }
  const family = inferRenderFamilyFromType(section.section_type, 0)
  // Canonical fallback palette matches SopSectionTabs SECTION_COLORS.
  const fallback: Record<SectionRenderFamily, { icon: string | null; colorFamily: string | null }> = {
    hazard:    { icon: 'AlertTriangle', colorFamily: 'red-400' },
    emergency: { icon: 'Siren',         colorFamily: 'red-400' },
    ppe:       { icon: 'ShieldCheck',   colorFamily: 'blue-400' },
    steps:     { icon: 'ListChecks',    colorFamily: 'brand-yellow' },
    signoff:   { icon: 'CheckCircle2',  colorFamily: 'green-400' },
    content:   { icon: null,            colorFamily: 'steel-100' },
    custom:    { icon: null,            colorFamily: 'steel-100' },
  }
  return { family, ...fallback[family], displayName: null }
}
