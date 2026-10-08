/**
 * Phase 63 -- Sign-offs and People over the Office pane. Requirement HOME-04;
 * threats T-63-20/21. Owner: 63-07. Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { tabsFor } from '../../src/lib/shell/home-state'
import { tabsForRole } from '../../src/lib/shell/office-tabs'

const code = (p: string) =>
  fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const SIGNOFFS = code('src/components/home/sections/SignOffsSection.tsx')
const PEOPLE = code('src/components/home/sections/PeopleSection.tsx')
const ROLES = ['admin', 'safety_manager', 'supervisor', 'worker', null]

test.describe('office sections', () => {
  test('each section takes its tabs from tabsFor, never a hand-written list', () => {
    expect(SIGNOFFS).toContain("tabsFor('signoffs', role)")
    expect(PEOPLE).toContain("tabsFor('people', role)")
    for (const src of [SIGNOFFS, PEOPLE]) expect(src).not.toMatch(/\[\s*'(inbox|requests|decisions|people|access)'/)
  })

  test('the pane is reached only through dynamic(), and the pin and tab are passed on', () => {
    for (const src of [SIGNOFFS, PEOPLE]) {
      expect(src).toContain("dynamic(() => import('@/components/office/OfficePane')")
      expect(src).not.toMatch(/^import[^\n]*components\/office\//m)
      expect(src).toContain('onTab={onTab}')
      expect(src).toContain('<OfficePane tab={tab}')
    }
    expect(PEOPLE).toContain('initialSop={pin}')
  })

  test('headings are plain words with no count and no Office', () => {
    expect(SIGNOFFS).toMatch(/<h2[^>]*>Sign-offs<\/h2>/)
    expect(PEOPLE).toMatch(/<h2[^>]*>People<\/h2>/)
    for (const src of [SIGNOFFS, PEOPLE]) {
      expect(src).not.toMatch(/<h2[^>]*>[^<]*(\{|\d)/)
      expect(src).not.toMatch(/>[^<{]*\bOffice\b/)
    }
  })

  test('tabsFor over both sections equals tabsForRole for every role (gates unchanged, R2)', () => {
    for (const role of ROLES) {
      const union = new Set([...tabsFor('signoffs', role), ...tabsFor('people', role)])
      expect([...union].sort()).toEqual([...tabsForRole(role)].sort())
    }
  })
})
