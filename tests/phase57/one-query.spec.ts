/**
 * Phase 57 -- SHL-05 / PLC-04 one query feeds pin and card.
 * 57-03 fills the loadInbox / getAdminShell contracts; 57-05 owns the parity wiring.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf-8').replace(/\r\n/g, '\n')

const LOAD = read('src', 'lib', 'governance', 'load-inbox.ts')
const SHELL = read('src', 'actions', 'shell.ts')
const PAGE = read('src', 'app', '(protected)', 'governance', 'page.tsx')

/** Drop // and block comments so a comment never satisfies or trips a match. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test.describe('SHL-05 one inbox query', () => {
  test('load-inbox is a plain module that returns the shared read', () => {
    const src = strip(LOAD)
    expect(src).not.toContain("'use server'")
    expect(src).not.toContain('server-only')
    expect(src).not.toContain('createAdminClient')
    expect(src).toContain('export async function loadInbox()')
    expect(src).toContain('export interface LoadedInbox')
    expect(src).toMatch(/governance:[\s\S]*library:[\s\S]*floor:[\s\S]*items:/)
  })

  test('governance page and getAdminShell import the same loadInbox', () => {
    expect(strip(PAGE)).toContain("from '@/lib/governance/load-inbox'")
    expect(strip(PAGE)).toContain('await loadInbox(')
    expect(strip(PAGE)).not.toContain('deriveInbox(')
    expect(strip(PAGE)).not.toContain('Promise.all(')
    expect(strip(SHELL)).toContain("from '@/lib/governance/load-inbox'")
    expect(strip(SHELL)).toContain('await loadInbox(')
  })

  test('getAdminShell is an admin-gated action with no org or role parameter', () => {
    const src = strip(SHELL)
    expect(src.split('\n')[0]).toContain("'use server'")
    expect(src).toContain('export async function getAdminShell()')
    expect(src.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(src.indexOf('requireAdminContext()')).toBeLessThan(src.indexOf('await loadInbox('))
    expect(src).toContain('inboxCount: inbox.items.length')
    expect(src).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(src).toContain(".eq('placement', 'site')")
    expect(src).not.toContain('createAdminClient')
    expect(src).not.toContain('server-only')
    // a 'use server' file exports only async functions (types are erased)
    const exports = src.match(/^export (?!async function|interface|type)\S+/gm)
    expect(exports).toBeNull()
  })

  test('completions awaiting sign-off are not inside the inbox count', () => {
    for (const src of [strip(LOAD), strip(SHELL)]) {
      expect(src).not.toMatch(/completion/i)
    }
  })

  test('the Workshop list is every non-published SOP in the org', () => {
    expect(strip(SHELL)).toContain("s.status !== 'published'")
  })
})

test.describe('PLC-04 office count parity', () => {
  test.fixme('Office pin and Office card read the same inbox count [57-05]', () => {})
})
