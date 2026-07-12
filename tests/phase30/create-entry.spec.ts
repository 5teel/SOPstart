/**
 * UX-04 — One create entry (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + § Current Wiring 4):
 *   - Exactly ONE "New SOP" button (on /admin/sops) → method-picker screen
 *     (suggested /admin/sops/new) with 4 options, Upload a document FIRST
 *     (per Visy interview — create-from-scratch is not the headline):
 *     Upload a document · Talk it through (?mode=voice) · Describe it ·
 *     Start blank.
 *   - The 8 existing entry points collapse: 4 header buttons + 4 empty-state
 *     repeats on admin/sops/page.tsx, 3 dashboard DashTiles (die with UX-01),
 *     worker /sops "Create SOP" tab removed (admins reach create via nav).
 *   - Destinations remain: /admin/sops/upload, /admin/sops/new/ai
 *     (+?mode=voice), /admin/sops/new/blank.
 *
 * This file starts as test.fixme — the UX-04 plan flips it live.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ADMIN_SOPS_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx',
)
const METHOD_PICKER = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'new', 'page.tsx',
)
const WORKER_SOPS_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-04 — one create entry', () => {
  test.fixme('method picker exists with all 4 options and Upload listed first', () => {
    const src = read(METHOD_PICKER)
    expect(src).toContain('/admin/sops/upload')
    expect(src).toContain('/admin/sops/new/ai')
    expect(src).toContain('mode=voice')
    expect(src).toContain('/admin/sops/new/blank')
    // Upload must appear BEFORE the other destinations in source order.
    expect(src.indexOf('/admin/sops/upload')).toBeLessThan(src.indexOf('/admin/sops/new/blank'))
  })

  test.fixme('/admin/sops has exactly one New SOP entry (header buttons + empty-state tiles collapsed)', () => {
    const src = read(ADMIN_SOPS_PAGE)
    // The single entry links to the method picker, not the 3 intake routes.
    expect(src).toContain("'/admin/sops/new'")
    expect(src).not.toContain('Voice Draft')
  })

  test.fixme('worker /sops "Create SOP" tab removed', () => {
    const src = read(WORKER_SOPS_PAGE)
    expect(src).not.toContain('/admin/sops/upload')
    expect(src).not.toContain('Create SOP')
  })
})
