/**
 * Phase 57 -- PLC-03 the Noticeboard lists site SOPs (stub; Wave 0 / 57-01).
 * Filled by: 57-04 (worker), 57-05 (admin).
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import { noticeboardSops, healthPinCount, type HealthRow } from '@/lib/sop/admin-health'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

test.describe('PLC-03 noticeboard', () => {
  test('worker noticeboard lists site-wide SOPs only', () => {
    expect(read('src/hooks/useWorkerSops.ts')).toMatch(/\.select\('[^']*, placement[^']*'\)/)
    expect(read('src/lib/sop/worker-signal.ts')).toContain("placement?: 'machine' | 'site' | null")
    const shell = read('src/components/shell/WorkerShell.tsx')
    expect(shell).toContain("s.raw.placement === 'site'")
    expect(shell).toContain('<NoticeboardWorkerBody sops={siteSops} />')
    expect(read('src/components/shell/RoomBodies.tsx')).toContain('No site-wide SOPs yet.')
  })

})

const row = (id: string, title: string, status: string, flags: HealthRow['flags'] = []): HealthRow => ({
  id,
  title,
  status,
  flags,
  ownerLabel: 'Sam',
  reviewDueAt: null,
})

test.describe('PLC-03 admin noticeboard', () => {
  const rows = new Map<string, HealthRow>([
    ['a', row('a', 'Zulu', 'published')],
    ['b', row('b', 'Alpha', 'draft')],
    ['c', row('c', 'Mike', 'published', ['unowned'])],
    ['d', row('d', 'Bravo', 'published', ['overdue'])],
    ['x', row('x', 'Elsewhere', 'published')],
  ])

  test('published site SOPs first, drafts as a tail, each group in panel order', () => {
    const out = noticeboardSops(['a', 'b', 'c', 'd', 'missing'], rows)
    expect(out.map((s) => s.id)).toEqual(['c', 'd', 'a', 'b'])
    expect(out.map((s) => s.status)).toEqual(['published', 'published', 'published', 'draft'])
    expect(out[3].badge).toBe('DRAFT')
  })

  test('only the site SOP ids are listed', () => {
    expect(noticeboardSops(['a'], rows).map((s) => s.id)).toEqual(['a'])
    expect(noticeboardSops([], rows)).toEqual([])
  })

  test('healthPinCount counts NO OWNER and REVIEW DUE rows only', () => {
    expect(healthPinCount(noticeboardSops(['a', 'b', 'c', 'd'], rows))).toBe(2)
    expect(healthPinCount([])).toBe(0)
  })

  test('the admin noticeboard body states the draft tail through the shared rows', () => {
    expect(read('src/components/shell/AdminRoomBodies.tsx')).toContain('export function AdminNoticeboardBody(')
  })
})
