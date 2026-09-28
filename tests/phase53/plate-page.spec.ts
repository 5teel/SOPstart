/**
 * Phase 53 -- PHN-02/D-06. Source-contract tests for the printable A6
 * plate page: admin gate, server-rendered QR, A6 print rule, absolute
 * plate URL origin.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const PAGE_PATH = 'src/app/(protected)/admin/site/plate/[machineId]/page.tsx'
const PRINT_BUTTON_PATH = 'src/app/(protected)/admin/site/plate/[machineId]/PrintButton.tsx'
const WORKSPACE_PATH = 'src/components/admin/site/SiteWorkspace.tsx'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

// Copied from tests/phase41/merged-surface.spec.ts -- no shared test-utils
// module exists for this idiom in this codebase.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('plate page', () => {
  test('the plate page is gated by requireAdminContext() before any read', () => {
    const src = stripComments(read(PAGE_PATH))
    const guardIdx = src.indexOf('requireAdminContext()')
    const fromIdx = src.indexOf(".from('")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(fromIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(fromIdx)
    expect(src).toContain("'error' in ctx")
    expect(src).toContain('redirect(')
  })

  test('the machine lookup is filtered by the session organisation -- a foreign id 404s', () => {
    const src = stripComments(read(PAGE_PATH))
    const idx = src.indexOf(".from('site_machines')")
    expect(idx).toBeGreaterThan(-1)
    const nextAwaitIdx = src.indexOf('await ', idx)
    const chain = src.slice(idx, nextAwaitIdx > idx ? nextAwaitIdx : src.length)
    expect(chain).toContain('.eq(\'organisation_id\', ctx.organisationId)')
    expect(src).toContain('notFound()')
  })

  test('no admin client on this route', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).not.toContain('createAdminClient')
  })

  test('the QR is server-rendered SVG via qrcode.toString, encoding the absolute plate URL', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).toContain("import QRCode from 'qrcode'")
    expect(src).toContain("from '@/lib/site/qr-decode'")
    expect(src).toContain('plateUrl(')
    expect(src).toContain('QRCode.toString(url,')
    expect(src).toContain("type: 'svg'")
    expect(src).toContain('dangerouslySetInnerHTML')
  })

  test('the plate URL origin comes from NEXT_PUBLIC_SITE_URL or the request origin, never a hardcoded host', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).toContain('NEXT_PUBLIC_SITE_URL')
    expect(src).toContain('headers(')
    expect(src).not.toContain('sopstart.com')
  })

  test('@media print sets @page { size: A6 } and hides chrome/.no-print controls', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).toContain('@page')
    expect(src).toContain('A6')
    expect(src).toContain('.no-print')
    expect(src).toContain('display: none !important')
  })

  test('the machine name, department and short code render, the code as a camera fallback', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).toContain('data-testid="machine-plate"')
    expect(src).toContain('data-plate-url={url}')
    expect(src).toContain('data-testid="plate-qr"')
    expect(src).toContain('{machine.name}')
    expect(src).toContain('data-testid="plate-code"')
    expect(src).toContain('{machine.code}')
    expect(src).toContain('departmentName')
  })

  test('PrintButton triggers window.print()', () => {
    const src = stripComments(read(PRINT_BUTTON_PATH))
    expect(src).toContain('data-testid="plate-print"')
    expect(src).toContain('window.print()')
  })

  test('SiteWorkspace wires a Print plate link inside the selected machine panel, before the SOPs toggle', () => {
    const src = stripComments(read(WORKSPACE_PATH))
    const isSelectedIdx = src.indexOf('isSelected && (')
    const printLinkIdx = src.indexOf('data-testid="site-machine-print-plate"')
    const sopsToggleIdx = src.indexOf('data-testid="site-machine-sops-toggle"')
    expect(isSelectedIdx).toBeGreaterThan(-1)
    expect(printLinkIdx).toBeGreaterThan(isSelectedIdx)
    expect(printLinkIdx).toBeLessThan(sopsToggleIdx)
    expect(src).toContain('href={`/admin/site/plate/${machine.id}`}')
  })
})
