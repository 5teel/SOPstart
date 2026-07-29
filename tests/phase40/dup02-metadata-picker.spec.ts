/**
 * Phase 40 -- DUP-02 (D-09..D-12): one shared metadata picker. Today
 * PromptClient.tsx, WizardClient.tsx, and VoiceDraftClient.tsx each render
 * their own <DepartmentPicker directly. Plan 40-08 extracts
 * SopMetadataFields.tsx (department + category picker, localOnly) and
 * rewires all three on-ramps onto it, sourcing category options from
 * @/lib/sop-categories rather than a live `.from('sops').select('category')`
 * query. D-12: the upload flow (Phase 42 scope) must NOT gain metadata
 * fields here -- that would be a scope regression into a not-yet-designed
 * surface.
 *
 * Behavioural assertion (not just import presence, CLAUDE.md 2026-06-05):
 * the picker's onChange result must actually reach assignSopDepartments,
 * not a direct sop_departments insert bypassing the grant-backed write path.
 *
 * `test.fixme` until 40-08.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')

const PROMPT_CLIENT = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'sops', 'new', 'ai', 'PromptClient.tsx')
const WIZARD_CLIENT = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'sops', 'new', 'blank', 'WizardClient.tsx')
const VOICE_DRAFT_CLIENT = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'sops', 'new', 'ai', 'VoiceDraftClient.tsx')
const SOP_METADATA_FIELDS = path.join(SRC_DIR, 'components', 'admin', 'SopMetadataFields.tsx')
const UPLOAD_PAGE = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'sops', 'upload', 'page.tsx')
const AI_PROMPT_ROUTE = path.join(SRC_DIR, 'app', 'api', 'sops', 'ai-prompt', 'route.ts')
const SOPS_ACTIONS = path.join(SRC_DIR, 'actions', 'sops.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('DUP-02 -- one shared metadata picker', () => {
  test.fixme('PromptClient, WizardClient, VoiceDraftClient import SopMetadataFields and render no local <DepartmentPicker', () => {
    for (const file of [PROMPT_CLIENT, WIZARD_CLIENT, VOICE_DRAFT_CLIENT]) {
      const src = read(file)
      expect(src).toContain("import { SopMetadataFields } from '@/components/admin/SopMetadataFields'")
      expect(src).not.toContain('<DepartmentPicker')
    }
  })

  test.fixme('SopMetadataFields renders DepartmentPicker with localOnly and sources categories from @/lib/sop-categories', () => {
    const src = read(SOP_METADATA_FIELDS)
    expect(src).toContain('<DepartmentPicker')
    expect(src).toContain('localOnly')
    expect(src).toContain("from '@/lib/sop-categories'")
    expect(src).not.toContain(".from('sops').select('category')")
  })

  test.fixme('admin/sops/upload/page.tsx does NOT import SopMetadataFields (D-12 -- upload is Phase 42 scope)', () => {
    const src = read(UPLOAD_PAGE)
    expect(src).not.toContain('SopMetadataFields')
  })

  test.fixme("the picker's onChange result reaches assignSopDepartments, not a direct sop_departments insert (D-11)", () => {
    const aiPromptSrc = read(AI_PROMPT_ROUTE)
    const sopsActionsSrc = read(SOPS_ACTIONS)
    expect(aiPromptSrc).toContain('assignSopDepartments(')
    expect(sopsActionsSrc).toContain('assignSopDepartments(')
    expect(aiPromptSrc).not.toContain(".from('sop_departments').insert")
    expect(sopsActionsSrc).not.toContain(".from('sop_departments').insert")
  })
})
