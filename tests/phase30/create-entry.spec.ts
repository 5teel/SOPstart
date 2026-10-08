/**
 * UX-04 — One create entry (flipped live by 30-05).
 *
 * Contract (30-RESEARCH § Test Map + § Current Wiring 4):
 *   - Exactly ONE "New SOP" button (on /admin/sops) → method-picker screen
 *     /admin/sops/new with 4 options, Upload a document FIRST
 *     (per Visy interview — create-from-scratch is not the headline):
 *     Upload a document · Describe it ·
 *     Start blank.
 *   - Destinations remain: /admin/sops/upload, /admin/sops/new/ai
 *     /admin/sops/new/blank.
 *   - The worker has no "Create SOP" entry anywhere on the one screen.
 *
 * Repointed in 57-08: the worker list page is gone, so the "no duplicate
 * create entry" checks read the worker shell files (the one screen's worker
 * half) instead.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const METHOD_PICKER = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'new', 'page.tsx',
)
const WORKER_SHELL = [
  ...['WorkerShell.tsx', 'RoomBodies.tsx', 'SiteSummary.tsx', 'OfficeCard.tsx'].map((f) => path.join(ROOT, 'src', 'components', 'shell', f)),
  path.join(ROOT, 'src', 'components', 'home', 'HomeShell.tsx'), // 63-11: the home replaced OneScreen
]
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
    // Voice drafting was cut (Phase 55): /admin/sops/new/ai opens straight onto
    // the typed brief, with no type-vs-talk fork.
    // Targets the href list, not the whole file: the comment above METHODS
    // explains the merge and names the old query string, which a bare
    // substring check would read as a surviving tile.
    expect(src).not.toMatch(/href:\s*'[^']*mode=voice/)
    const fork = read(path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'new', 'ai', 'AiDraftFork.tsx'))
    expect(fork).toContain('PromptClient')
    expect(fork).not.toContain('Talk it through')
    expect(fork).not.toContain('ai-draft-fork')
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

  test('the worker shell has no create entry (the Workshop Write a new SOP link is the one entry)', () => {
    const shellSrc = WORKER_SHELL.map(read).join('\n')
    const pickerLinks: string[] = [
      ...(shellSrc.match(/href="\/admin\/sops\/new"/g) ?? []),
    ]
    expect(pickerLinks).toHaveLength(0)
    // Phase 57: the header is gone; the one create entry is the Workshop's "Write a new SOP".
    const workshop = read(path.join(ROOT, 'src', 'components', 'shell', 'AdminRoomBodies.tsx'))
    expect(workshop).toContain('room-workshop-new')
    expect(shellSrc).not.toContain('href="/admin/sops/upload"')
    expect(shellSrc).not.toContain('href="/admin/sops/new/ai"')
    expect(shellSrc).not.toContain('href="/admin/sops/new/blank"')
    expect(shellSrc).not.toContain('mode=voice')
    expect(shellSrc).not.toContain('Voice Draft')
  })

  test('no stray intake hrefs anywhere in src outside the picker', () => {
    const intakeHref = /href="\/admin\/sops\/(upload|new\/(ai|blank))/
    const allowed = new Set([METHOD_PICKER])
    const offenders = walk(path.join(ROOT, 'src'))
      .filter((f) => !allowed.has(f) && intakeHref.test(read(f)))
    expect(offenders).toEqual([])
  })

  test('journeys.ts maps the /admin/sops/new method picker', () => {
    const src = read(JOURNEYS)
    expect(src).toContain("route: '/admin/sops/new'")
  })

  test('the worker shell has no "Create SOP" entry', () => {
    const src = WORKER_SHELL.map(read).join('\n')
    expect(src).not.toContain('/admin/sops/upload')
    expect(src).not.toContain('Create SOP')
  })
})
