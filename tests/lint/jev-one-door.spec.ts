/**
 * ADR-0022 guard: the TypeSafe API is called from one module only (src/lib/ai/jev.ts), so the model
 * stays pinned through the registry and every call shares the same retry and key handling.
 *
 * Registration: playwright.config.ts `phase15-stubs` project testMatch alternation.
 * Verify: `npx playwright test --list --project=phase15-stubs | grep jev-one-door`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HOST = ['api', 'typesafe', 'ai'].join('.')
const DOOR = 'src/lib/ai/jev.ts'

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

test('only the Jev client names the TypeSafe API host', () => {
  const hits = walk(path.join(ROOT, 'src'))
    .map((p) => path.relative(ROOT, p).split(path.sep).join('/'))
    .filter((r) => r !== DOOR && fs.readFileSync(path.join(ROOT, r), 'utf-8').includes(HOST))
  expect(hits).toEqual([])
})

test('the Jev client reads its model from the registry', () => {
  expect(fs.readFileSync(path.join(ROOT, DOOR), 'utf-8')).toContain("aiModel('clear-fact-check')")
})
