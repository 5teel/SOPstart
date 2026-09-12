/**
 * Phase 41 / Plan 41-01 — Wave-0 stub for SUR-03 / SUR-04 + the
 * `/admin/sops` redirect shim. Flipped live by 41-06.
 *
 * Source-contract idiom, not browser automation — normalises \r\n to \n
 * per CLAUDE.md 2026-07-18.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TOP_HEADER = path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx')
const ADMIN_SOPS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx')
const SOP_MILLER_BROWSER = path.join(ROOT, 'src', 'components', 'admin', 'SopMillerBrowser.tsx')
const SOP_WORKER_BROWSER = path.join(ROOT, 'src', 'components', 'sop', 'SopWorkerBrowser.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('SUR-03 — one top-level "SOPs" entry', () => {
  test.fixme(true, 'flipped live by 41-06')
  test('SUR-03: ADMIN_LINKS drops Manage SOPs / the /admin/sops href; BASE_LINKS keeps exactly one /sops entry', () => {
    const header = read(TOP_HEADER)
    expect(header).not.toContain('Manage SOPs')
    expect(header).not.toContain("'/admin/sops'")
    const sopsMatches = header.match(/href:\s*'\/sops'/g) ?? []
    expect(sopsMatches.length).toBe(1)
  })

  test('SUR-03: a governance entry deep-links /sops?view=attention', () => {
    const header = read(TOP_HEADER)
    expect(header).toContain('/sops?view=attention')
  })
})

test.describe('redirect shim — /admin/sops preserves deep links to /sops', () => {
  test.fixme(true, 'flipped live by 41-06')
  test('redirect shim: guard stays in front of redirect(), destination is /sops, query built via URLSearchParams', () => {
    const shim = read(ADMIN_SOPS_PAGE)
    expect(shim).toContain("['admin', 'safety_manager']")
    expect(shim).toContain('redirect(')
    expect(shim).toContain('/sops')
    expect(shim).toContain('URLSearchParams')
    const guardIdx = shim.indexOf("['admin', 'safety_manager']")
    const redirectIdx = shim.indexOf('redirect(`/sops')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(redirectIdx === -1 || guardIdx < redirectIdx).toBe(true)
    for (const param of ['view', 'status', 'owner', 'filter', 'departments', 'collection', 'sop']) {
      expect(shim).toContain(param)
    }
  })

  test('redirect shim: no longer imports the admin lens components/actions directly', () => {
    const shim = read(ADMIN_SOPS_PAGE)
    for (const token of [
      'SopMillerBrowser',
      'WiringPatchBayShell',
      'GovernanceQueueRow',
      'listGovernanceQueue',
      'listOrgTree',
      'listGrants',
    ]) {
      expect(shim).not.toContain(token)
    }
  })
})

test.describe('SUR-04 — one path from a SOP to its builder', () => {
  test.fixme(true, 'flipped live by 41-06')
  test('SUR-04: SopMillerBrowser links to the builder; SopWorkerBrowser does not', () => {
    const miller = read(SOP_MILLER_BROWSER)
    expect(miller).toContain('/admin/sops/builder/')
    const worker = read(SOP_WORKER_BROWSER)
    expect(worker).not.toContain('/admin/sops/builder')
  })
})
