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
  // 2026-08-04: the picker went from 4 tiles to 3. "Talk it through"
  // (?mode=voice) and "Describe it" both pointed at /admin/sops/new/ai — the
  // same surface advertised twice. They are one "Draft it with AI" tile now,
  // and the type-vs-talk fork moved onto that page as a must-answer modal
  // (AiDraftFork). UX-04's actual invariant is unchanged: one create entry,
  // Upload first, every on-ramp reachable.
  test('method picker exists with all 3 options and Upload listed first', () => {
    const src = read(METHOD_PICKER)
    expect(src).toContain('/admin/sops/upload')
    expect(src).toContain('/admin/sops/new/ai')
    expect(src).toContain('/admin/sops/new/blank')
    // The voice path is no longer a tile — it is reachable through the fork on
    // /admin/sops/new/ai, which must still honour the ?mode= deep link.
    // Targets the href list, not the whole file: the comment above METHODS
    // explains the merge and names the old query string, which a bare
    // substring check would read as a surviving tile.
    expect(src).not.toMatch(/href:\s*'[^']*mode=voice/)
    const fork = read(path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'new', 'ai', 'AiDraftFork.tsx'))
    expect(fork).toContain("param === 'voice'")
    expect(fork).toContain("param === 'type'")
    // Upload must appear BEFORE the other destinations in TILE order. Scoped
    // to the METHODS array: the explanatory comment above it names every
    // route, so whole-file indexOf compares prose positions, not tiles.
    const methods = src.slice(src.indexOf('const METHODS'), src.indexOf('export default'))
    expect(methods.indexOf('/admin/sops/upload')).toBeGreaterThan(-1)
    expect(methods.indexOf('/admin/sops/upload')).toBeLessThan(methods.indexOf('/admin/sops/new/ai'))
    expect(methods.indexOf('/admin/sops/upload')).toBeLessThan(methods.indexOf('/admin/sops/new/blank'))
    // Admin guard present (T-30-05-01). Section nav lives in the app header
    // (sketch 004 — AdminNav deleted 2026-07-30).
    expect(src).toContain("['admin', 'safety_manager']")
    expect(src).not.toContain('<AdminNav')
  })

  test('/admin/sops has no duplicate create entry (the header Create New SOP link is the one entry)', () => {
    const src = read(ADMIN_SOPS_PAGE)
    // 2026-07-30: the page-level New SOP button moved to the app header
    // (TopHeader ADMIN_LINKS "Create New SOP" → /admin/sops/new). The page
    // itself must not re-add a second create entry.
    const pickerLinks = src.match(/href="\/admin\/sops\/new"/g) ?? []
    expect(pickerLinks).toHaveLength(0)
    const header = read(path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx'))
    expect(header).toContain("{ label: 'Create New SOP', href: '/admin/sops/new' }")
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

  test('worker /sops "Create SOP" tab removed', () => {
    const src = read(WORKER_SOPS_PAGE)
    expect(src).not.toContain('/admin/sops/upload')
    expect(src).not.toContain('Create SOP')
  })
})
