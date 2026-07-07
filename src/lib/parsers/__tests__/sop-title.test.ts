import { test, expect } from '@playwright/test'
import { isPlaceholderTitle, titleFromFileName, TITLE_CONVENTIONS } from '../sop-title'

test.describe('sop-title — naming guard (pure functions)', () => {
  test('placeholder titles are detected', () => {
    expect(isPlaceholderTitle('Untitled SOP')).toBe(true)
    expect(isPlaceholderTitle('untitled')).toBe(true)
    expect(isPlaceholderTitle('')).toBe(true)
    expect(isPlaceholderTitle(null)).toBe(true)
    expect(isPlaceholderTitle('SOP')).toBe(true)
    expect(isPlaceholderTitle('Standard Operating Procedure')).toBe(true)
  })

  test('real titles pass through untouched', () => {
    expect(isPlaceholderTitle('Changing Neck Rings on 21 Machines')).toBe(false)
    expect(isPlaceholderTitle('Forklift Pre-Start Checks — Hamilton Site')).toBe(false)
  })

  test('filename fallback strips extension, doc codes, and version noise', () => {
    expect(titleFromFileName('EN-FOR-03-031 Blank Side Hanger Change_v2_FINAL.docx')).toBe(
      'Blank Side Hanger Change',
    )
    expect(titleFromFileName('Changing Baffles.doc')).toBe('Changing Baffles')
    expect(titleFromFileName(null)).toBe(null)
    expect(titleFromFileName('a.pdf')).toBe(null) // too short to be a title
  })

  test('conventions md file loads (agent instructions present)', () => {
    // The conventions file is the single agent-instruction source for naming —
    // if it goes missing the parser silently loses its title guidance.
    expect(TITLE_CONVENTIONS).toContain('SOP Title Naming Conventions')
    expect(TITLE_CONVENTIONS).toContain('Never include')
  })
})
