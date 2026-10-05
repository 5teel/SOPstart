/**
 * Phase 60 -- objective model. Requirement OBJ-02; decisions D-10, D-11; threat T-60-12. Owner: 60-03.
 * Registration: playwright.config.ts `phase60`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  OBJECTIVE_SUBJECTS,
  OBJECTIVE_MAX,
  objectiveLine,
  normaliseObjectiveText,
  setByWords,
  type ObjectiveView,
} from '@/lib/objectives/model'

const NOW = new Date('2026-10-06T03:00:00Z') // 4 pm NZDT, Tue 6 Oct
const base: ObjectiveView = {
  id: 'o1',
  subjectType: 'machine',
  subjectId: null,
  text: 'Forming runs at 96%',
  dueOn: null,
  setByLabel: 'Jane',
  setByAgent: null,
  confirmed: true,
  setAt: '2026-10-01T00:00:00Z',
}

test.describe('Objective model (60-03)', () => {
  test('subjects and the length cap', () => {
    expect([...OBJECTIVE_SUBJECTS]).toEqual(['site', 'department', 'machine', 'sop', 'person'])
    expect(OBJECTIVE_MAX).toBe(200)
  })

  test('a person-set objective with a future date reads by-date and set-by', () => {
    const l = objectiveLine({ ...base, dueOn: '2026-11-12' }, NOW)
    expect(l).toEqual({
      prefix: 'Objective',
      text: 'Forming runs at 96%',
      when: 'by 12 Nov',
      overdue: false,
      setBy: 'set by Jane',
      agent: null,
      unconfirmed: false,
    })
  })

  test('a past date reads "was due" and is flagged overdue; due today is not overdue', () => {
    const past = objectiveLine({ ...base, dueOn: '2026-10-03' }, NOW)
    expect(past.when).toBe('was due 3 Oct')
    expect(past.overdue).toBe(true)
    const today = objectiveLine({ ...base, dueOn: '2026-10-06' }, NOW)
    expect(today.overdue).toBe(false)
    expect(today.when).toBe('by 6 Oct')
  })

  test('no date means no date segment; the prefix can be the place name', () => {
    const l = objectiveLine(base, NOW, 'Press')
    expect(l.when).toBeNull()
    expect(l.overdue).toBe(false)
    expect(l.prefix).toBe('Press')
  })

  test('an agent-set unconfirmed objective is flagged; a confirmed one is not', () => {
    const agent = { ...base, setByLabel: null, setByAgent: 'SOPstart assistant', confirmed: false }
    const u = objectiveLine(agent, NOW)
    expect(u.setBy).toBe('set by SOPstart assistant')
    expect(u.agent).toBe('SOPstart assistant')
    expect(u.unconfirmed).toBe(true)
    expect(objectiveLine({ ...agent, confirmed: true }, NOW).unconfirmed).toBe(false)
  })

  test('setByWords: name always, email only for admin and safety manager, else "an admin"', () => {
    expect(setByWords({ fullName: 'Jane Smith', email: 'jane@x.nz' }, 'worker')).toBe('Jane Smith')
    const noName = { fullName: null, email: 'jane@x.nz' }
    expect(setByWords(noName, 'admin')).toBe('jane@x.nz')
    expect(setByWords(noName, 'safety_manager')).toBe('jane@x.nz')
    for (const role of ['worker', 'supervisor', null]) expect(setByWords(noName, role)).toBe('an admin')
    expect(setByWords(null, 'admin')).toBe('an admin')
  })

  test('normaliseObjectiveText collapses whitespace and refuses empty or over-long text', () => {
    expect(normaliseObjectiveText('  Zero   lost-time\n\ninjuries \t this quarter ')).toEqual({
      ok: true,
      text: 'Zero lost-time injuries this quarter',
    })
    expect(normaliseObjectiveText(' \n ').ok).toBe(false)
    expect(normaliseObjectiveText('x'.repeat(OBJECTIVE_MAX)).ok).toBe(true)
    expect(normaliseObjectiveText('x'.repeat(OBJECTIVE_MAX + 1)).ok).toBe(false)
    expect(normaliseObjectiveText(`${'x '.repeat(100)}${'x '.repeat(5)}`).ok).toBe(false) // 211 chars once collapsed
  })

  test('the module is plain: no directive, no server-only', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src/lib/objectives/model.ts'), 'utf-8')
    expect(src).not.toMatch(/^'use server'|server-only/m)
  })
})
