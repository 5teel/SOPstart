/**
 * One place that answers "what kind of section is this?" for the worker
 * surfaces. The Read page and both walkthroughs used to each carry their own
 * matcher — the walkthrough's only looked for `hazard`/`ppe` in section_type,
 * so a section typed "Safety Requirements" rendered on Read and then the
 * walkthrough's "review the hazards" gate opened EMPTY (OTG Probe
 * Maintenance, 2026-09-27). Plain module — no React, no 'use client'.
 */
import type { SopWithSections } from '@/types/sop'

export type Section = SopWithSections['sop_sections'][number]

const HAZARD_KEYWORDS = ['hazard', 'danger', 'warning', 'risk', 'safety']
const PPE_KEYWORDS = ['ppe', 'protective', 'protection', 'safety equipment']
const EMERGENCY_KEYWORDS = ['emergency', 'first aid', 'spill']
const SCOPE_KEYWORDS = ['scope', 'purpose', 'overview', 'introduction']

function haystack(s: Section): string {
  return `${s.section_kind?.render_family ?? ''} ${s.section_type} ${s.title}`.toLowerCase()
}
const has = (s: Section, words: string[]) => words.some((w) => haystack(s).includes(w))

export const isPpeSection = (s: Section) => has(s, PPE_KEYWORDS)
export const isEmergencySection = (s: Section) => has(s, EMERGENCY_KEYWORDS)
/** Hazards, not PPE and not emergency — those have their own homes. */
export const isHazardSection = (s: Section) =>
  has(s, HAZARD_KEYWORDS) && !isPpeSection(s) && !isEmergencySection(s)
export const isScopeSection = (s: Section) => has(s, SCOPE_KEYWORDS) && (s.sop_steps?.length ?? 0) === 0

/** The jobs inside a SOP: every section that actually has steps, in order. */
export function procedureSections(sop: SopWithSections): Section[] {
  return sop.sop_sections.filter((s) => (s.sop_steps?.length ?? 0) > 0)
}

/** Tools and parts for one job — the union across its steps, first-seen order. */
export function jobTools(section: Section): string[] {
  const seen = new Set<string>()
  for (const st of section.sop_steps ?? []) for (const t of st.required_tools ?? []) seen.add(t.trim())
  return [...seen].filter(Boolean)
}

/**
 * A SOP narrowed to ONE job: every step-less section (scope, safety,
 * references) plus the chosen procedure. The walkthroughs flatten
 * `sop_sections` into their step list, so handing them this is all it takes
 * to make "Step 1 of 6" mean the mirror-cleaning job rather than "Step 1 of
 * 40" across four unrelated procedures.
 *
 * ponytail: the completion record this produces covers the job's steps, not
 * the whole SOP — fine while a completion is per SOP; revisit if completions
 * ever become per-procedure.
 */
export function scopeSopToJob(sop: SopWithSections, jobSectionId: string): SopWithSections {
  return {
    ...sop,
    sop_sections: sop.sop_sections.filter(
      (s) => (s.sop_steps?.length ?? 0) === 0 || s.id === jobSectionId,
    ),
  }
}
