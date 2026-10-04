/**
 * Phase 57 -- PLC-04 pins (stub; Wave 0 / 57-01).
 * Filled by: 57-04 (worker pins), 57-05 (admin health pins).
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

test.describe('PLC-04 pins', () => {
  test('worker machine pins come from derivePlantPins; the Noticeboard pin counts due site SOPs', () => {
    const shell = read('src/components/shell/WorkerShell.tsx')
    expect(shell).toContain('derivePlantPins(')
    expect(shell).toContain('machinePins={machinePins}')
    expect(shell).toContain('const noticeboardDue = dueAt(siteSops)')
    expect(shell).toContain('pickNowQueue(')
  })

  test('the Office pin exists for a supervisor only', () => {
    const shell = read('src/components/shell/WorkerShell.tsx')
    expect(shell).toContain('roomPins={isSupervisor ? { office: pending, noticeboard: noticeboardDue } : { noticeboard: noticeboardDue }}')
  })

  test.fixme('admin machine pins come from machineHealth; Office pin equals the inbox count [57-05]', () => {})
  test.fixme('healthPinCount counts bad and due machines only [57-05]', () => {})
})
