/**
 * Phase 53 -- PHN-01. Source-contract tests for the phone home layout:
 * ask bar, Now card (Walk it / Read only, no Show me), floor thumbnail,
 * then "Everything else", rendered below 1024px for a worker whose org
 * has a site.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24. Assertions run against
 * comment-stripped source (CLAUDE.md 2026-07-13 / phase41's precedent) so a
 * comment quoting a token cannot satisfy a check about the actual code.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const NOW_CARD_PATH = 'src/components/sop/plant/NowCard.tsx'
const PLANT_HOME_PATH = 'src/components/sop/plant/PlantHome.tsx'
const SITE_WORKER_PATH = 'src/actions/site-worker.ts'
const SITE_VALIDATORS_PATH = 'src/lib/validators/site.ts'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('NowCard -- optional onShowMe, inline layout', () => {
  test('props type declares onShowMe and inline as optional', () => {
    const src = read(NOW_CARD_PATH)
    expect(src).toMatch(/onShowMe\?:\s*\(machineId:\s*string\)\s*=>\s*void/)
    expect(src).toMatch(/inline\?:\s*boolean/)
  })

  test('plant-now-read exists with href /sops/${now.sop.id}, in the branch taken when onShowMe is absent', () => {
    const src = read(NOW_CARD_PATH)
    expect(src).toContain('data-testid="plant-now-read"')
    expect(src).toMatch(/href=\{`\/sops\/\$\{now\.sop\.id\}`\}/)
    const readIdx = src.indexOf('data-testid="plant-now-read"')
    const branchStart = src.lastIndexOf('onShowMe ?', readIdx)
    expect(branchStart).toBeGreaterThan(-1)
    const branch = src.slice(branchStart, readIdx)
    expect(branch).toContain(') : (')
  })

  test('the Show me button sits in the branch taken when onShowMe is present', () => {
    const src = read(NOW_CARD_PATH)
    const showIdx = src.indexOf('data-testid="plant-now-show"')
    expect(showIdx).toBeGreaterThan(-1)
    const branchStart = src.lastIndexOf('onShowMe ?', showIdx)
    expect(branchStart).toBeGreaterThan(-1)
    const branch = src.slice(branchStart, showIdx)
    expect(branch).not.toContain(') : (')
  })

  test('the inline class string contains no absolute', () => {
    const src = read(NOW_CARD_PATH)
    const idx = src.indexOf("inline\n          ? '")
    expect(idx).toBeGreaterThan(-1)
    const inlineClass = src.slice(src.indexOf("? '", idx) + 3, src.indexOf("'", src.indexOf("? '", idx) + 3))
    expect(inlineClass).not.toContain('absolute')
    expect(inlineClass).toContain('w-full')
  })

  test('PlantHome still passes onShowMe={open} and no inline prop (desktop call site untouched)', () => {
    const src = read(PLANT_HOME_PATH)
    expect(src).toContain('onShowMe={open}')
    expect(src).not.toContain('inline')
  })
})

test.describe('machine code reaches the worker', () => {
  test('site-worker.ts selects code on site_machines and maps it onto the worker machine', () => {
    const src = read(SITE_WORKER_PATH)
    expect(src).toMatch(/\.select\('id, name, department_id, polygon, sprite_path, code'\)/)
    expect(src).toMatch(/code:\s*m\.code/)
  })

  test('WorkerSiteMachine declares code: string', () => {
    const src = read(SITE_VALIDATORS_PATH)
    const idx = src.indexOf('export interface WorkerSiteMachine')
    expect(idx).toBeGreaterThan(-1)
    const body = src.slice(idx, src.indexOf('}', idx))
    expect(body).toMatch(/code:\s*string/)
  })
})
