/**
 * Phase 59 -- retirement sweep (stub; Wave 0 / 59-01).
 * Filled by: 59-13 (addresses redirect to Office places), 59-14 (governance, team,
 * access pages and org-model canvases deleted), 59-15 (supervisor activity view
 * and the supervisor half of the completion page deleted). Negative assertions
 * that quote a retired literal live here (the repoint inventory walk excludes
 * this folder). Assert the absence of REFERENCES, not only of files
 * (CLAUDE.md 2026-08-04).
 * Registration: playwright.config.ts `phase59` project.
 */
import { test } from '@playwright/test'
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

test.describe('retire: legacy addresses redirect to Office places (59-13)', () => {
  test.fixme(true, 'flips live in 59-13')
  test('the proxy sends the governance, team and access addresses to their Office places with fixed templates', () => {})
  test('the sop query is UUID-gated and cookies are copied onto the redirect', () => {})
  test('no client effect redirects any of the legacy addresses', () => {})
  test('the old Office card bridge links are gone', () => {})
})

test.describe('retire: governance, team and access pages (59-14)', () => {
  test.fixme(true, 'flips live in 59-14')
  test('the three page directories are gone', () => {})
  test('the named components and the org-model canvases are gone', () => {})
  test('no src file links to the retired addresses (anchored on href or a router call, so the proxy source strings are not counted)', () => {})
})

test.describe('retire: supervisor activity view and completion supervisor half (59-15)', () => {
  test.fixme(true, 'flips live in 59-15')
  test('the supervisor activity view and its filter, summary card and reject sheet are gone', () => {})
  test('a non-owner opening a completion address is sent to the Office by the server page, never a client effect', () => {})
})
