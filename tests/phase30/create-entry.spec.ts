/**
 * UX-04 — One create entry (flipped live by 30-05).
 *
 * Contract (30-RESEARCH § Test Map + § Current Wiring 4):
 *   - Exactly ONE "New SOP" button (on /admin/sops) → method-picker screen
 *     /admin/sops/new with 4 options, Upload a document FIRST
 *     (per Visy interview — create-from-scratch is not the headline):
 *     Upload a document · Talk it through (?mode=voice) · Describe it ·
 *     Start blank.
 *   - Destinations remain: /admin/sops/upload, /admin/sops/new/ai
 *     (+?mode=voice), /admin/sops/new/blank.
 *   - Worker /sops "Create SOP" tab removal is 30-06 scope (shares
 *     sops/page.tsx) — that test stays fixme here until 30-06 flips it.
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
const JOURNEYS = path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full)
  }
  return out
}

test.describe('UX-04 — one create entry', () => {
  test('method picker exists with all 4 options and Upload listed first', () => {
    const src = read(METHOD_PICKER)
    expect(src).toContain('/admin/sops/upload')
    expect(src).toContain('/admin/sops/new/ai')
    expect(src).toContain('mode=voice')
    expect(src).toContain('/admin/sops/new/blank')
    // Upload must appear BEFORE the other destinations in source order.
    expect(src.indexOf('/admin/sops/upload')).toBeLessThan(src.indexOf('/admin/sops/new/ai'))
    expect(src.indexOf('/admin/sops/upload')).toBeLessThan(src.indexOf('/admin/sops/new/blank'))
    // Admin guard present (T-30-05-01) + shared nav rendered.
    expect(src).toContain("['admin', 'safety_manager']")
    expect(src).toContain('<AdminNav active="sops" />')
  })

  test('/admin/sops has exactly one New SOP entry (header buttons + empty-state tiles collapsed)', () => {
    const src = read(ADMIN_SOPS_PAGE)
    // The single entry links to the method picker, not the 3 intake routes.
    const pickerLinks = src.match(/href="\/admin\/sops\/new"/g) ?? []
    expect(pickerLinks).toHaveLength(1)
    expect(src).not.toContain('href="/admin/sops/upload"')
    expect(src).not.toContain('href="/admin/sops/new/ai"')
    expect(src).not.toContain('href="/admin/sops/new/blank"')
    expect(src).not.toContain('mode=voice')
    expect(src).not.toContain('Voice Draft')
  })

  test('no stray intake hrefs anywhere in src outside the picker (worker tab = 30-06)', () => {
    const intakeHref = /href="\/admin\/sops\/(upload|new\/(ai|blank))/
    const allowed = new Set([
      METHOD_PICKER,
      WORKER_SOPS_PAGE, // "Create SOP" tab removal lands in 30-06 (shares this file)
    ])
    const offenders = walk(path.join(ROOT, 'src'))
      .filter((f) => !allowed.has(f) && intakeHref.test(read(f)))
    expect(offenders).toEqual([])
  })

  test('journeys.ts maps the /admin/sops/new method picker', () => {
    const src = read(JOURNEYS)
    expect(src).toContain("route: '/admin/sops/new'")
  })

  test.fixme('worker /sops "Create SOP" tab removed', () => {
    const src = read(WORKER_SOPS_PAGE)
    expect(src).not.toContain('/admin/sops/upload')
    expect(src).not.toContain('Create SOP')
  })
})
