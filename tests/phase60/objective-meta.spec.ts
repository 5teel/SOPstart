/**
 * Phase 60 -- Objective line (60-13 machine, department, person; 60-14 SOP).
 * Requirements: OBJ-01, OBJ-02, OBJ-03. Decisions: D-11, A-07.
 * Source-contract over comment-stripped source; the live behaviour is the deployed eval.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const strip = (src: string) =>
  src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n')
const read = (rel: string) => strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

const LINE = read('src/components/shell/ObjectiveLine.tsx')
const EDITOR = read('src/components/requests/ObjectiveEditor.tsx')
const SLOT = read('src/components/shell/ObjectiveSlot.tsx')

test.describe('Objective line (60-13)', () => {
  test('ObjectiveLine is static text on tokens only: no card, no border box, no icon, no stylesheet', () => {
    expect(LINE).toContain('data-testid="objective-line"')
    expect(LINE).toContain('data-agent=')
    expect(LINE).toContain('data-confirmed=')
    expect(LINE).toContain('mono min-w-0 break-words text-meta text-ink-500')
    expect(LINE).not.toMatch(/import\s+['"][^'"]*\.css['"]/)
    expect(LINE).not.toContain('lucide-react')
    // the line itself is never a card (the chips carry their own border)
    const paragraph = LINE.slice(LINE.indexOf('<p'), LINE.indexOf('>', LINE.indexOf('<p')))
    expect(paragraph).not.toMatch(/rounded|border|bg-/)
    expect(LINE).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\[\d+px\]|text-(red|amber|green|blue)-\d/)
  })

  test('the words come from objectiveLine and an agent-set objective carries both chips', () => {
    expect(LINE).toContain('objectiveLine(')
    expect(LINE).toContain('Unconfirmed')
    expect(LINE).toContain('border-ai/40 bg-ai/10 text-ai')
    expect(LINE).toContain('border-accent-decision/40 bg-accent-decision/10 text-ink-900')
    expect(LINE).toContain('text-accent-escalate')
  })

  test('ObjectiveEditor is wired to the three actions, invalidates the shared key, and handles failure', () => {
    expect(EDITOR).toMatch(/setObjective\(\{\s*subject/)
    expect(EDITOR).toMatch(/clearObjective\(\{\s*subject/)
    expect(EDITOR).toContain('confirmObjective({ objectiveId: current.id })')
    expect(EDITOR).toContain('OBJECTIVES_KEY')
    expect(EDITOR).toMatch(/try\s*{[\s\S]*catch[\s\S]*finally/)
    for (const words of ['By (optional)', 'Save objective', "Don&apos;t change it", 'Remove this objective?', 'Yes, remove it', 'Keep it', 'Clear date']) {
      expect(EDITOR).toContain(words)
    }
    expect(EDITOR).toContain('data-testid="objective-editor"')
    expect(EDITOR).toContain('data-testid="objective-confirm"')
    expect(EDITOR).toContain('maxLength={OBJECTIVE_MAX}')
  })

  test('ObjectiveEditor is a lazy module: no stylesheet, never statically imported', () => {
    expect(EDITOR).not.toMatch(/import\s+['"][^'"]*\.css['"]/)
    expect(SLOT).toMatch(/import\('@\/components\/requests\/ObjectiveEditor'\)/)
    expect(SLOT).not.toMatch(/^import\s[^;]*from\s+'@\/components\/requests\/ObjectiveEditor'/m)
  })

  test('Esc closes the editor only', () => {
    expect(EDITOR).toMatch(/addEventListener\('keydown', onKey, true\)/)
    expect(EDITOR).toContain('e.preventDefault()')
    expect(EDITOR).toContain('e.stopPropagation()')
  })

  test.fixme('ObjectiveLine is mounted on both machine panels, the department panel and the People row', () => {})
  test.fixme('the SOP objective is read from objectives (lineage root) in loadFocusSop, BrowseDocument and This SOP', () => {})
  test.fixme('browse offers "Make a request"', () => {})
})
