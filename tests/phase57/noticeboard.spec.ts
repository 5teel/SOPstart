/**
 * Phase 57 -- PLC-03 the Noticeboard lists site SOPs (stub; Wave 0 / 57-01).
 * Filled by: 57-04 (worker), 57-05 (admin).
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

test.describe('PLC-03 noticeboard', () => {
  test('worker noticeboard lists site-wide SOPs only', () => {
    expect(read('src/hooks/useWorkerSops.ts')).toMatch(/\.select\('[^']*, placement'\)/)
    expect(read('src/lib/sop/worker-signal.ts')).toContain("placement?: 'machine' | 'site' | null")
    const shell = read('src/components/shell/WorkerShell.tsx')
    expect(shell).toContain("s.raw.placement === 'site'")
    expect(shell).toContain('<NoticeboardWorkerBody sops={siteSops} />')
    expect(read('src/components/shell/RoomBodies.tsx')).toContain('No site-wide SOPs yet.')
  })

  test.fixme('admin noticeboardSops includes draft and published site SOPs with status [57-05]', () => {})
})
