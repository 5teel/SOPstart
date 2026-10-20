/**
 * Hollow-parse guard: a parse whose procedure sections are all empty is a failure, not a SOP
 * (GLM 5.2 direct translation, analogue eval 2026-10-20). Runs in the phase20-parsers project.
 */
import { test, expect } from '@playwright/test'
import { isHollowParse } from '../sop-parser'
import type { ParsedSop } from '@/lib/validators/sop'

const sop = (sections: Array<Partial<ParsedSop['sections'][number]>>): ParsedSop =>
  ({ title: 'T', overall_confidence: 1, sections: sections.map((s, i) => ({ order: i + 1, type: 'procedure', title: 'S', content: null, steps: null, confidence: 1, ...s })) }) as ParsedSop

const step = { order: 1, text: 'Do it', warning: null, caution: null, tip: null, required_tools: null, time_estimate_minutes: null, has_image: false, image_indexes: null }

test('no steps anywhere and a bare procedure title is hollow', () => {
  expect(isHollowParse(sop([{ type: 'scope', content: 'Purpose' }, { steps: [] }, { steps: null }]))).toBe(true)
  // the Visy GLM shape: one "procedure" holds the training text, the real procedures are titles only
  expect(isHollowParse(sop([{ content: 'Must be trained by an authorised trainer.' }, { steps: [] }, { type: 'cleanup' }]))).toBe(true)
})

test('any step, or text in every procedure section, is not hollow', () => {
  expect(isHollowParse(sop([{ steps: [] }, { steps: [step] }]))).toBe(false)
  expect(isHollowParse(sop([{ content: 'Read the rules below.' }]))).toBe(false)
})

test('a SOP with no procedure sections is not hollow', () => {
  expect(isHollowParse(sop([{ type: 'hazards', content: 'Hot surface' }]))).toBe(false)
})
