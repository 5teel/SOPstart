/**
 * Phase 60 -- retirement sweep (stub; Wave 0 / 60-01).
 * Filled by: 60-05 (the Machines inbox kind retires into agent requests), 60-14
 * (the SOP objective column writer and readers go), 60-17 (the assign screen, its
 * actions, its API route and the old notifications hook go). Negative assertions
 * that quote a retired literal live here (the repoint inventory walk excludes this
 * folder). Assert the absence of REFERENCES, not only of files (CLAUDE.md 2026-08-04).
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
// Helpers the owning plans use when they flip the fixme cases live.
export const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

export function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

export function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSrc(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('retire: the Machines inbox kind (60-05)', () => {
  test('the inbox model has no machines kind, no machines chip and no "write a SOP" action', () => {
    const src = stripComments(read('src/lib/governance/inbox.ts'))
    expect(src).not.toContain("'machines'")
    expect(src).not.toContain('Write a SOP')
    expect(src).not.toContain('machinesWithoutSops')
    expect(src).not.toMatch(/machines:\s*ReadonlyArray/)
  })
  test('the stale-department row links to the SOP edit address and reads "Open SOP"', () => {
    const row = read('src/components/office/InboxRow.tsx')
    expect(row).toContain("focusHref(g.id, { mode: 'edit', from: 'office' })")
    expect(row).toContain('Open SOP')
    expect(row).not.toContain('Fix assignment')
    expect(row).not.toMatch(/href=\{`\/admin\/sops\/\$\{[^}]+\}\/assign`\}/)
  })
})

test.describe('retire: the SOP objective column writer (60-14)', () => {
  test.fixme(true, 'flips live in 60-14')
  test('the SOP objective writer action is gone and no src file names it', () => {})
  test('no src file reads or writes the sops objective column; forkDraft no longer copies it', () => {})
})

test.describe('retire: the assign screen and its writers (60-17)', () => {
  test.fixme(true, 'flips live in 60-17')
  test('the assign page directory, the assignment row component, the SOP-level sub-trade picker, the assignments API route and the old notifications hook are gone', () => {})
  test('the four assign actions and the request-removal action are gone from src, and the writer registry no longer lists them', () => {})
  test('no src file links to an assign address (regex anchored on an href or a router call plus the admin SOP path, so the proxy redirect source is not counted)', () => {})
  test('legacyRedirectFor sends the assign address to the SOP edit address, and the proxy applies it', () => {})
})
