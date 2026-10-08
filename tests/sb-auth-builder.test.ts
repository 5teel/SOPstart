import { test, expect } from '@playwright/test'

/**
 * SB-AUTH -- authoring entry points. Repointed in 58-15 onto the focus editor.
 *
 * Moved: every entry point (wizard, AI prompt, upload) lands in the one focus
 * editor via focusHref(..., { mode: 'edit' }); the page's edit branch calls
 * requireSopEditAccess and the focus actions guard every write.
 *
 * Dropped, with the old builder (no successor):
 *  - SB-AUTH-01 `useForm` / `zodResolver` pins: the wizard validates its title
 *    step with a plain zod schema and no form library.
 *  - SB-AUTH-01 section-creation pins (`section_type: kind.slug`,
 *    `section_kind_id: kind.id`, the compensating `delete` on a failed section
 *    insert): createSopFromWizard no longer creates sections (58 D-19) -- a blank
 *    SOP opens on the editor's empty state -- so there is nothing to clean up.
 *  - SB-AUTH-04 "exactly one builder route directory" and the old builder shell
 *    'use client' pin: the builder route is a redirect-only page now and goes in
 *    58-16; convergence is asserted on the destination address instead.
 */
test.describe('SOP authoring entry points (SB-AUTH)', () => {
  test('SB-AUTH-01 admin can start a new SOP from a blank-page wizard with no source document', async () => {
    const fs = await import('node:fs/promises')

    const pageRsc = await fs.readFile('src/app/(protected)/admin/sops/new/blank/page.tsx', 'utf8')
    expect(pageRsc).toContain("from './WizardClient'")
    expect(pageRsc).toContain("redirect('/login')")
    expect(pageRsc).toContain("redirect('/')")
    expect(pageRsc).toContain("'admin', 'safety_manager'")
    expect(pageRsc).toContain('<WizardClient')

    const wizard = await fs.readFile('src/app/(protected)/admin/sops/new/blank/WizardClient.tsx', 'utf8')
    expect(wizard).toContain("'use client'")
    expect(wizard).toContain('createSopFromWizard(')
    expect(wizard).toContain('listSectionKinds')
    // Canonical wizard slugs -- per SPEC SB-AUTH-01 the wizard excludes custom/content
    for (const slug of ['hazards', 'ppe', 'steps', 'emergency', 'signoff']) expect(wizard).toContain(slug)
    // Redirect target on success: the focus editor.
    expect(wizard).toContain("router.push(focusHref(result.sopId, { mode: 'edit'")

    const sops = await fs.readFile('src/actions/sops.ts', 'utf8')
    expect(sops).toMatch(/export async function createSopFromWizard/)
    // source_type='blank' is the authoritative signal for wizard-authored SOPs; status 'draft' on insert
    expect(sops).toMatch(/source_type: 'blank'/)
    expect(sops).toMatch(/status: 'draft'/)
    // Admin role guard
    expect(sops).toMatch(/\['admin',\s*'safety_manager'\]/)
  })

  test.fixme('SB-AUTH-02 admin can type a natural-language prompt and receive a structured draft with hazards, PPE, steps, emergency pre-filled for review', async ({ page }) => {})
  test.fixme('SB-AUTH-03 admin can pick a template from the NZ template library as a starting point for a new SOP', async ({ page }) => {})

  test('SB-AUTH-04 blank / AI draft / upload entry points all converge on the single focus editor', async () => {
    const fs = await import('node:fs/promises')
    const entries = [
      'src/app/(protected)/admin/sops/new/blank/WizardClient.tsx',
      'src/app/(protected)/admin/sops/new/ai/PromptClient.tsx',
      'src/components/admin/UploadDropzone.tsx',
    ]
    for (const rel of entries) {
      const src = await fs.readFile(rel, 'utf8')
      expect(src, rel).toContain("from '@/lib/sop/focus-path'")
      expect(src, rel).toMatch(/router\.push\(focusHref\([^)]*\{ mode: 'edit'/)
    }

    // The ONE editor: the focus page's edit branch asks the server for edit access and mounts it.
    const page = await fs.readFile('src/app/(protected)/sops/[sopId]/page.tsx', 'utf8')
    expect(page).toContain('requireSopEditAccess({ sopId })')
    expect(page).toContain("rawMode === 'edit'")
    expect(page).toContain('<FocusWalker')

    const sops = await fs.readFile('src/actions/sops.ts', 'utf8')
    expect(sops).toMatch(/source_type: 'blank'/)
  })

  test('SB-AUTH-05 a builder-authored draft is distinguishable from an uploaded draft but publishes through the same publish flow', async () => {
    // SPEC reinterpretation: there is NO publishSop server action -- publish is
    // the POST /api/sops/[sopId]/publish route, and the single-gate requirement
    // is satisfied behaviourally (the editor's Publish bar reads the same gate).
    const fs = await import('node:fs/promises')

    const listAction = await fs.readFile('src/actions/admin-sop-list.ts', 'utf8')
    expect(listAction).toContain('source_type')
    const manage = await fs.readFile('src/components/home/sections/ManageSection.tsx', 'utf8')
    expect(manage).toContain('manage-new')

    const publishRoute = await fs.readFile('src/app/api/sops/[sopId]/publish/route.ts', 'utf8').catch(() => null)
    expect(publishRoute).not.toBeNull()

    // The focus editor's Publish bar reads the gate status the publish route enforces.
    const bar = await fs.readFile('src/components/focus/admin/PublishBar.tsx', 'utf8')
    expect(bar).toContain('getPublishGateStatus(')
    const dialog = await fs.readFile('src/components/focus/admin/PublishDialog.tsx', 'utf8')
    expect(dialog).toContain('/api/sops/')
    const sops = await fs.readFile('src/actions/sops.ts', 'utf8')
    expect(sops).not.toMatch(/export async function publishSop\b/)
  })
})
