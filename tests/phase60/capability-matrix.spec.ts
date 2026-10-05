/**
 * Phase 60 -- Capability matrix rows (stub; Wave 0 / 60-01).
 * Requirements: RQS-01, RQS-02, RQS-03, OBJ-01. Decisions: D-01, D-07, D-10. Owning plan: 60-02 / 60-04 / 60-06 / 60-09 / 60-11 / 60-17.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MATRIX = fs.readFileSync(path.resolve(__dirname, '..', '..', '.planning', 'codebase', 'CAPABILITY-MATRIX.md'), 'utf-8')
const row = (label: string) => MATRIX.split(/\r?\n/).find((l) => l.startsWith(`| ${label} |`)) ?? ''

test.describe("Capability matrix rows (60-02 / 60-04 / 60-06 / 60-09 / 60-11 / 60-17)", () => {
  test("60-02: read rows for requests, notifications and objectives", () => {
    const n = row('Read own notifications and mark them read')
    for (const name of ['notifications_read_own', 'notifications_mark_own_read', '00074', 'read_at']) expect(n).toContain(name)
    const r = row('Read requests')
    for (const name of ['requests_read', '00074', 'service-role']) expect(r).toContain(name)
    const o = row('Read objectives')
    for (const name of ['objectives_read_org', '00074', 'service-role']) expect(o).toContain(name)
    // the three new read rows grant a worker a read (own rows for requests), never a write
    expect(n.split('|').map((c) => c.trim()).slice(2, 6)).toEqual(['✅', '✅', '✅', '✅'])
    expect(o.split('|').map((c) => c.trim()).slice(2, 6)).toEqual(['✅', '✅', '✅', '✅'])
  })
  test.fixme("60-04: raiseRequest, withdrawRequest, answerRequest and listMyRequests rows", () => {})
  test.fixme("60-06: askToDoSop, declineAsk, stopAsking and listAskTargets rows", () => {})
  test.fixme("60-09: setObjective, clearObjective, confirmObjective and listObjectives rows", () => {})
  test.fixme("60-11: Office Requests tab rows (existing labels are never renamed, phase46 pins them)", () => {})
  test.fixme("60-17: the four removed assign rows are gone and the reassignment path is described as a request", () => {})
})
