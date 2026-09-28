/**
 * Phase 53 -- PHN-01 (negative case) + the /sops phone seam wiring. Source-
 * contract tests confirming the phone home is additive: an org with no
 * drawn site keeps today's stacked worker list unchanged, and every worker
 * route reachable today stays reachable when a site does exist.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24. Assertions run against
 * comment-stripped source.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SOPS_PAGE_PATH = 'src/app/(protected)/sops/page.tsx'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('phone seam wiring', () => {
  test('wantsPhone is viewport === "mobile"; the site query is enabled for either viewport', () => {
    const src = stripComments(read(SOPS_PAGE_PATH))
    expect(src).toContain("const wantsPhone = viewport === 'mobile'")
    expect(src).toContain('enabled: wantsPlant || wantsPhone')
  })

  test('a single site constant requires layout AND at least one machine, and both plantSite and phoneSite derive from it', () => {
    const src = stripComments(read(SOPS_PAGE_PATH))
    const siteIdx = src.indexOf('const site: WorkerSiteData | null =')
    expect(siteIdx).toBeGreaterThan(-1)
    const siteExpr = src.slice(siteIdx, src.indexOf('\n', siteIdx + 200))
    expect(src.slice(siteIdx, siteIdx + 400)).toMatch(/siteResult\.layout/)
    expect(src.slice(siteIdx, siteIdx + 400)).toMatch(/machines\.length > 0/)
    expect(src).toContain('const plantSite: WorkerSiteData | null = wantsPlant ? site : null')
    expect(src).toContain('const phoneSite: WorkerSiteData | null = wantsPhone ? site : null')
    void siteExpr
  })

  test('PhoneHome referenced only through dynamic(() => import(...)) with ssr: false', () => {
    const src = stripComments(read(SOPS_PAGE_PATH))
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/sop\/plant\/PhoneHome'\)/)
    const staticValueImport = /import\s+(?!type\b)\{[^}]*PhoneHome[^}]*\}\s+from\s+['"]@\/components\/sop\/plant\/PhoneHome['"]/
    expect(staticValueImport.test(src)).toBe(false)
  })

  test('the PhoneHome slot is gated on phone && onQueryChange, positioned after useWorkerSops(', () => {
    const src = stripComments(read(SOPS_PAGE_PATH))
    const sectionStart = src.indexOf('function SopsSection(')
    expect(sectionStart).toBeGreaterThan(-1)
    const sectionSrc = src.slice(sectionStart)
    const slotIdx = sectionSrc.indexOf('phone && onQueryChange && (')
    expect(slotIdx).toBeGreaterThan(-1)
    expect(sectionSrc.slice(slotIdx, slotIdx + 80)).toContain('<PhoneHome')
    const hookIdx = sectionSrc.indexOf('useWorkerSops(')
    expect(hookIdx).toBeGreaterThan(-1)
    expect(slotIdx).toBeGreaterThan(hookIdx)
  })

  test('sops={workerSops} appears at least twice (plant slot + phone slot)', () => {
    const src = read(SOPS_PAGE_PATH)
    const hits = src.match(/sops=\{workerSops\}/g) ?? []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  test('the one SopsSection call site passes phone={phoneSite} (Phase 54: admins now take a separate AdminLibraryTable branch, so there is exactly one SopsSection call site)', () => {
    const src = read(SOPS_PAGE_PATH)
    const hits = src.match(/phone=\{phoneSite\}/g) ?? []
    expect(hits.length).toBe(1)
  })

  test('the toolbar search box is hidden while either the plant or the phone home is rendering', () => {
    expect(read(SOPS_PAGE_PATH)).toContain('!takeover && !plantSite && !phoneSite')
  })

  test('the final return renders <WorkerSimpleList (which carries the scope strip) below the PhoneHome slot (Phase 54, additive)', () => {
    const src = stripComments(read(SOPS_PAGE_PATH))
    const sectionStart = src.indexOf('function SopsSection(')
    const sectionSrc = src.slice(sectionStart)
    const phoneSlotIdx = sectionSrc.indexOf('phone && onQueryChange && (')
    const listIdx = sectionSrc.indexOf('<WorkerSimpleList')
    expect(phoneSlotIdx).toBeGreaterThan(-1)
    expect(listIdx).toBeGreaterThan(-1)
    expect(listIdx).toBeGreaterThan(phoneSlotIdx)
  })

  test('no early return keyed on phone -- the phone home is additive, never a replacement branch', () => {
    const src = stripComments(read(SOPS_PAGE_PATH))
    const sectionStart = src.indexOf('function SopsSection(')
    const sectionSrc = src.slice(sectionStart)
    expect(sectionSrc).not.toMatch(/if\s*\(\s*phone\b[^)]*\)\s*return/)
  })
})
