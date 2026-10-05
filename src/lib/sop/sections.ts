/**
 * One place that answers "is this a hazard / PPE / emergency section?" for the
 * old section model. Now only the converter (`convert.ts`) reads it. Plain
 * module — no React, no 'use client'.
 */
import type { SopWithSections } from '@/types/sop'

export type Section = SopWithSections['sop_sections'][number]

const HAZARD_KEYWORDS = ['hazard', 'danger', 'warning', 'risk', 'safety']
const PPE_KEYWORDS = ['ppe', 'protective', 'protection', 'safety equipment']
const EMERGENCY_KEYWORDS = ['emergency', 'first aid', 'spill']

function haystack(s: Section): string {
  return `${s.section_kind?.render_family ?? ''} ${s.section_type} ${s.title}`.toLowerCase()
}
const has = (s: Section, words: string[]) => words.some((w) => haystack(s).includes(w))

export const isPpeSection = (s: Section) => has(s, PPE_KEYWORDS)
export const isEmergencySection = (s: Section) => has(s, EMERGENCY_KEYWORDS)
/** Hazards, not PPE and not emergency — those have their own homes. */
export const isHazardSection = (s: Section) =>
  has(s, HAZARD_KEYWORDS) && !isPpeSection(s) && !isEmergencySection(s)
