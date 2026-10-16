/**
 * ADR-0019 -- the training lanes replace the Phase 35 matrix. The lane rule (lanes.ts) is tested
 * directly; the component is held to its contract by source: five lanes in training order, no
 * pill or glyph vocabulary, grouping that reuses the home's area/type, a By person view, words
 * for the flags, and nothing disabled on a competency state (CMP-04).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { laneFor, LANES } from '../../src/lib/competency/lanes'

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const LANES_SRC = read('src/components/admin/competency/TrainingLanes.tsx')
const THEME = read('src/styles/blueprint-theme.css')

test.describe('the lane rule', () => {
  test('signed off wins, an open request comes next, then the ladder', () => {
    expect(laneFor('competent_signed_off', true)).toBe('signed')
    expect(laneFor('read', true)).toBe('wait')
    expect(laneFor('not_started', true)).toBe('wait')
    expect(laneFor('supervised', false)).toBe('obs')
    expect(laneFor('read', false)).toBe('read')
    expect(laneFor('not_started', false)).toBe('none')
  })

  test('five lanes, in the order training happens', () => {
    expect(LANES.map((l) => l.name)).toEqual(['Not started', 'Read it', 'Observed', 'Waiting for you', 'Signed off'])
  })
})

test.describe('TrainingLanes', () => {
  test('reads the department cut and the open requests, and exports through the same generator', () => {
    expect(LANES_SRC).toContain('getTrainingMatrix({ departmentId })')
    expect(LANES_SRC).toContain('listAssessmentRequests()')
    expect(LANES_SRC).toContain('exportTrainingCsv(')
  })

  test('no pill or symbol vocabulary: it never renders StatePill', () => {
    expect(LANES_SRC).not.toContain('StatePill')
  })

  test('groups SOPs the way the home does: area or type', () => {
    expect(LANES_SRC).toContain('row.areaName')
    expect(LANES_SRC).toContain('SOP_TYPES')
    expect(LANES_SRC).toMatch(/'Area' : 'Type'/)
  })

  test('has a By person view with a track to their lane', () => {
    expect(LANES_SRC).toContain('By person')
    expect(LANES_SRC).toContain('lane-track')
  })

  test('flags are words, never a lock', () => {
    for (const w of ['needs support', 'old version', 'Refresher overdue', 'Refresher due']) expect(LANES_SRC).toContain(w)
    expect(LANES_SRC).not.toMatch(/\bdisabled[=>]/)
  })

  test('the lane classes live in the design file', () => {
    for (const c of ['.lanes', '.lane-row', '.lane-track', '.face', '.face-av']) expect(THEME).toContain(`${c} {`)
  })

  test('the bridge mounts the lanes and the matrix is gone', () => {
    expect(read('src/components/admin/competency/TrainingBridge.tsx')).toContain('<TrainingLanes')
    expect(fs.existsSync('src/components/admin/competency/TrainingMatrixView.tsx')).toBe(false)
  })
})
