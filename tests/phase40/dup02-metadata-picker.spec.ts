/**
 * Phase 40 -- DUP-02 (D-09..D-12): one shared metadata picker.
 * PromptClient.tsx, WizardClient.tsx, and VoiceDraftClient.tsx used to each
 * render their own <DepartmentPicker directly. Plan 40-08 extracted
 * SopMetadataFields.tsx (title + department + category picker, localOnly)
 * and rewired all three on-ramps onto it, sourcing category options from
 * @/lib/sop-categories rather than a live `.from('sops').select('category')`
 * query. D-12: the upload flow (Phase 42 scope) must NOT gain metadata
 * fields here -- that would be a scope regression into a not-yet-designed
 * surface.
 *
 * Behavioural assertion (not just import presence, CLAUDE.md 2026-06-05):
 * the picker's onChange result must actually reach assignSopDepartments,
 * not a direct sop_departments insert bypassing the grant-backed write path.
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
const SOP_METADATA_DIALOG = path.join(SRC_DIR, 'components', 'admin', 'SopMetadataDialog.tsx')
const UPLOAD_PAGE = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'sops', 'upload', 'page.tsx')
const AI_PROMPT_ROUTE = path.join(SRC_DIR, 'app', 'api', 'sops', 'ai-prompt', 'route.ts')
const SOPS_ACTIONS = path.join(SRC_DIR, 'actions', 'sops.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('DUP-02 -- one shared metadata picker', () => {
  test('PromptClient, WizardClient, VoiceDraftClient import SopMetadataFields and render no local <DepartmentPicker', () => {
    for (const file of [PROMPT_CLIENT, WIZARD_CLIENT, VOICE_DRAFT_CLIENT]) {
      const src = read(file)
      expect(src).toContain("import { SopMetadataFields } from '@/components/admin/SopMetadataFields'")
      expect(src).not.toContain('<DepartmentPicker')
    }
  })

  // The picker + category vocabulary moved from SopMetadataFields into
  // SopMetadataDialog when metadata capture became a stepped modal. Assert the
  // behaviour WHERE IT LIVES *and* that the caller still wires it — a guard
  // that only greps the old file goes stale-green on the next relocation
  // (CLAUDE.md [2026-07-13]).
  test('SopMetadataDialog renders DepartmentPicker with localOnly and sources categories from @/lib/sop-categories', () => {
    const src = read(SOP_METADATA_DIALOG)
    expect(src).toContain('<DepartmentPicker')
    expect(src).toContain('localOnly')
    expect(src).toContain("from '@/lib/sop-categories'")
    expect(src).not.toContain(".from('sops').select('category')")
  })

  test('SopMetadataFields still owns the contract and mounts the dialog', () => {
    const src = read(SOP_METADATA_FIELDS)
    // The shared value type stays here — three call sites import it from here.
    expect(src).toContain('export type SopMetadataValue')
    // Wiring, not mere import presence: the dialog is actually rendered, and is
    // handed the value/onChange pair the parent owns.
    expect(src).toContain('<SopMetadataDialog')
    expect(src).toContain('value={value}')
    expect(src).toContain('onChange={onChange}')
    // Whatever the surface hides is dropped from the dialog's step run, so a
    // hidden field can never be asked for.
    expect(src).toContain('showDepartments && departments.length > 0')
    expect(src).not.toContain(".from('sops').select('category')")
  })

  test('metadata capture is one decision at a time, with answered steps revisitable (D-10)', () => {
    const src = read(SOP_METADATA_DIALOG)
    // Department -> Category -> Title: low-effort picks first.
    const order = ['departments', 'category', 'title']
    const positions = order.map((s) => src.indexOf(`STEP_LABEL`) >= 0 ? src.indexOf(`${s}:`) : -1)
    expect(positions.every((p) => p > 0), 'all three steps declared in STEP_LABEL').toBe(true)
    expect(positions[0]).toBeLessThan(positions[1])
    expect(positions[1]).toBeLessThan(positions[2])
    // An answered step stays on screen and can be re-opened.
    expect(src).toContain('onClick={() => setActive(step)}')
    // Nothing in a dialog rendered inside a parent <form> may submit it.
    expect(src).not.toMatch(/<button(?![^>]*type="button")[^>]*>/)
  })

  test('admin/sops/upload/page.tsx does NOT import SopMetadataFields (D-12 -- upload is Phase 42 scope)', () => {
    const src = read(UPLOAD_PAGE)
    expect(src).not.toContain('SopMetadataFields')
  })

  test("the picker's onChange result reaches assignSopDepartments, not a direct sop_departments insert (D-11)", () => {
    const aiPromptSrc = read(AI_PROMPT_ROUTE)
    const sopsActionsSrc = read(SOPS_ACTIONS)
    const sopMetadataSrc = read(SOP_METADATA_FIELDS)
    // /api/sops/ai-prompt still assigns departments off the request body via
    // the grant-backed write path, not a direct sop_departments insert.
    expect(aiPromptSrc).toContain('assignSopDepartments(sop.id, departmentIds, allDepartments)')
    expect(aiPromptSrc).toContain('departmentIds')
    expect(aiPromptSrc).toContain('allDepartments')
    // The wizard create path (src/actions/sops.ts) still calls assignSopDepartments too.
    expect(sopsActionsSrc).toContain('assignSopDepartments(')
    // None of the three surfaces this behaviour touches ever writes sop_departments directly.
    expect(aiPromptSrc).not.toContain(".from('sop_departments')")
    expect(sopsActionsSrc).not.toContain(".from('sop_departments')")
    expect(sopMetadataSrc).not.toContain(".from('sop_departments')")
  })
})
