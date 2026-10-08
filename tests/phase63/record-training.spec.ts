/**
 * Phase 63 -- My record and Training sections. Requirement HOME-04; threats T-63-24/25/26.
 * Owner: 63-09. Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const code = (p: string) =>
  fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const RECORD = code('src/components/home/sections/MyRecordSection.tsx')
const TRAINING = code('src/components/home/sections/TrainingSection.tsx')
const NOTIF = code('src/components/home/panels/NotificationsPanel.tsx')
const PAGE = code('src/app/(protected)/activity/page.tsx')

test.describe('record and training', () => {
  test('MyRecordSection composes the list and both panels and resolves a place through homeFromAddress', () => {
    expect(RECORD).toContain('<CompletionList />')
    expect(RECORD).toContain('<NotificationsPanel')
    expect(RECORD).toContain('<MyRequestsPanel')
    expect(RECORD).toContain('homeFromAddress(')
    expect(RECORD).toMatch(/<h2[^>]*>My record<\/h2>/)
  })

  test('the notification panel trusts no stored place and stays on the browser client', () => {
    expect(NOTIF).toContain('isSafePlace(n.place)')
    expect(NOTIF).not.toMatch(/from '@\/actions\//)
    expect(NOTIF).not.toMatch(/NOTIFICATIONS\s*·/) // R5
  })

  test('TrainingSection reads only the two admin-guarded lists and mounts the two screens', () => {
    const actions = [...TRAINING.matchAll(/from '@\/actions\/([\w-]+)'/g)].map((m) => m[1]).sort()
    expect(actions).toEqual(['departments', 'org-model'])
    expect(TRAINING).toContain('listOrgTree()')
    expect(TRAINING).toContain('listDepartments()')
    expect(TRAINING).toContain('<TrainingBridge')
    expect(TRAINING).toContain('<AssessmentRequestsPanel />')
    expect(TRAINING).not.toMatch(/import\s+['"][^'"]*\.css['"]/)
  })

  test('neither heading carries a number', () => {
    for (const src of [RECORD, TRAINING]) {
      expect(src).toMatch(/<h2[^>]*>(My record|Training)<\/h2>/)
      expect(src).not.toMatch(/<h2[^>]*>[^<]*(\{|\d)/)
    }
  })

  test('the activity list moved: WorkerActivityView is gone and the page renders CompletionList', () => {
    expect(fs.existsSync('src/app/(protected)/activity/WorkerActivityView.tsx')).toBe(false)
    expect(fs.existsSync('src/components/home/sections/CompletionList.tsx')).toBe(true)
    expect(PAGE).toContain("import { CompletionList } from '@/components/home/sections/CompletionList'")
    expect(PAGE).toContain('<CompletionList />')
  })
})
