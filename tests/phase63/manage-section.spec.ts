/**
 * Phase 63 -- Manage SOPs. Requirement HOME-04; threats T-63-22/23.
 * Owner: 63-08. Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const code = (p: string) =>
  fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const MANAGE_ACTION = code('src/actions/manage.ts')
const SURFACE = code('src/components/admin/site/SiteEditSurface.tsx')
const SECTION = code('src/components/home/sections/ManageSection.tsx')
const OBJECTIVES = code('src/components/home/sections/ObjectivesList.tsx')

test.describe('manage section', () => {
  test('listManageDrafts checks the admin before any read and runs no inbox side effect', () => {
    expect(MANAGE_ACTION).toMatch(/export async function listManageDrafts\(\)/)
    expect(MANAGE_ACTION.indexOf('requireAdminContext(')).toBeGreaterThan(-1)
    expect(MANAGE_ACTION.indexOf('requireAdminContext(')).toBeLessThan(MANAGE_ACTION.indexOf('loadInbox('))
    expect(MANAGE_ACTION).not.toMatch(/reconcileMachineRequests|ensureReviewDueNotifications/)
  })

  test('the site editor is its own module: strip, workspace, and the areas refresh', () => {
    expect(SURFACE).toContain('<DepartmentsStrip')
    expect(SURFACE).toContain('<SiteWorkspace')
    expect(SURFACE).toContain("'library-areas'")
    expect(SURFACE).toContain("'manage-drafts'")
    expect(SURFACE).toContain('Site &amp; departments')
  })

  test('ManageSection offers New SOP, drafts and Site & departments, with no count', () => {
    expect(SECTION).toContain('/admin/sops/new')
    expect(SECTION).toContain("queryKey: ['manage-drafts']")
    expect(SECTION).toContain('listManageDrafts()')
    expect(SECTION).toContain('homeFrom(')
    expect(SECTION).toMatch(/view === 'site'[\s\S]*<SiteEditSurface/)
    expect(SECTION).toContain('onDone={() => onView(null)}')
    expect(SECTION).toContain('data-testid="manage-site"')
    expect(SECTION).toMatch(/<h2[^>]*>Manage SOPs<\/h2>/)
    expect(SECTION).not.toMatch(/<h2[^>]*>[^<]*(\{|\d)/)
    expect(SECTION).not.toMatch(/change request|requests/i)
  })

  test('the objectives list covers the site, every department and every machine', () => {
    expect(OBJECTIVES).toContain("type: 'site'")
    expect(OBJECTIVES).toContain("type: 'department'")
    expect(OBJECTIVES).toContain("type: 'machine'")
    expect((OBJECTIVES.match(/<ObjectiveSlot/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(OBJECTIVES).toContain("queryKey: ['site-org']")
  })
})
