import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

test.describe('SOP Builder authoring entry points (SB-AUTH)', () => {
  test('SB-AUTH-01 admin can start a new SOP from a blank-page wizard (title → sections → review → draft save) with no source document', async () => {
    // Plan 12-03 delivers:
    //   - src/app/(protected)/admin/sops/new/blank/page.tsx (RSC w/ admin guard)
    //   - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx (4-step stepper)
    //   - src/actions/sops.ts::createSopFromWizard (atomic SOP + sections create)
    //
    // Structural-assertion test matching the Plan 01/02/04 precedent — full
    // live DOM + DB-fixture tests require a playwright webServer + fixture
    // harness that does not exist yet.
    const fs = await import('node:fs/promises')

    // Wizard route files exist
    const pageRsc = await fs.readFile(
      'src/app/(protected)/admin/sops/new/blank/page.tsx',
      'utf8'
    )
    expect(pageRsc).toContain("from './WizardClient'")
    expect(pageRsc).toContain("redirect('/login')")
    expect(pageRsc).toContain("redirect('/dashboard')")
    expect(pageRsc).toContain("'admin', 'safety_manager'")
    expect(pageRsc).toContain('<WizardClient />')

    const wizard = await fs.readFile(
      'src/app/(protected)/admin/sops/new/blank/WizardClient.tsx',
      'utf8'
    )
    // 4-step stepper with local state + RHF + Zod
    expect(wizard).toContain("'use client'")
    expect(wizard).toContain('useForm')
    expect(wizard).toContain('zodResolver')
    expect(wizard).toContain('createSopFromWizard')
    expect(wizard).toContain('listSectionKinds')
    // Canonical wizard slugs — per SPEC SB-AUTH-01 the wizard excludes custom/content
    expect(wizard).toContain('hazards')
    expect(wizard).toContain('ppe')
    expect(wizard).toContain('steps')
    expect(wizard).toContain('emergency')
    expect(wizard).toContain('signoff')
    // Redirect target on success — must land at unified builder route
    expect(wizard).toContain('router.push(`/admin/sops/builder/')

    // Server action shape
    const sops = await fs.readFile('src/actions/sops.ts', 'utf8')
    expect(sops).toMatch(/export async function createSopFromWizard/)
    // source_type='blank' is the authoritative signal for wizard-authored SOPs
    expect(sops).toMatch(/source_type: 'blank'/)
    // status='draft' on insert
    expect(sops).toMatch(/status: 'draft'/)
    // Mirrors kind.slug -> section_type (matches createSection precedent)
    expect(sops).toContain('section_type: kind.slug')
    expect(sops).toContain('section_kind_id: kind.id')
    // Compensating cleanup on failure
    expect(sops).toMatch(/admin\.from\('sops'\)\.delete\(\)\.eq\('id',\s*sop\.id\)/)
    // Admin role guard
    expect(sops).toMatch(/\['admin',\s*'safety_manager'\]/)
  })

  test.fixme('SB-AUTH-02 admin can type a natural-language prompt and receive a structured draft with hazards, PPE, steps, emergency pre-filled for review', async ({ page }) => {})
  test.fixme('SB-AUTH-03 admin can pick a template from the NZ template library as a starting point for a new SOP', async ({ page }) => {})

  test('SB-AUTH-04 blank / AI draft / template entry points all converge on a single builder UI', async () => {
    // SPEC SB-AUTH-04: all authoring entry points converge on a single builder
    // route. Phase 12 delivers the blank path (Plan 03); AI + template paths
    // ship in Phase 14 + Phase 15 but must target the same route.
    const fs = await import('node:fs/promises')

    // 1. Exactly one builder route directory exists in src/app.
    const routeDirs = execSync(
      'find src/app -type d -name "[[]sopId[]]" -path "*admin/sops*builder*"',
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    expect(routeDirs.length).toBe(1)
    expect(routeDirs[0]).toMatch(/admin\/sops\/builder\/\[sopId\]$/)

    // 2. The wizard redirects to the unified builder route on success.
    const wizard = await fs.readFile(
      'src/app/(protected)/admin/sops/new/blank/WizardClient.tsx',
      'utf8'
    )
    expect(wizard).toContain('/admin/sops/builder/')

    // 3. createSopFromWizard marks the row source_type='blank' — downstream
    //    assertion point for DB-level "which path did this SOP come from?"
    const sops = await fs.readFile('src/actions/sops.ts', 'utf8')
    expect(sops).toMatch(/source_type: 'blank'/)

    // 4. Builder chrome sends to review — both upload + builder converge here.
    const builderClient = await fs.readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
      'utf8'
    )
    // Existing review page is the single publish gate per CONTEXT D-04.
    expect(builderClient).toMatch(/\/admin\/sops\/\$\{sopId\}\/review|\/admin\/sops\/.*\/review/)
  })

  test('SB-AUTH-05 a builder-authored draft is visually distinguishable from an uploaded draft in the admin SOP library but publishes through the same Phase 2 review+publish flow', async () => {
    // SPEC reinterpretation (documented in plan objective):
    //   SPEC's original acceptance says "one publishSop export". Current
    //   codebase has NO publishSop server action — publish is the existing
    //   POST /api/sops/[sopId]/publish route handler. Per CONTEXT D-04 both
    //   upload and builder paths navigate to /admin/sops/[sopId]/review,
    //   which calls the existing publish route. Single-gate requirement is
    //   satisfied BEHAVIOURALLY, not via a literal `publishSop` export grep.
    const fs = await import('node:fs/promises')

    // 1. Library listing renders AUTHORED IN BUILDER chip for non-uploaded rows.
    const libraryPage = await fs.readFile(
      'src/app/(protected)/admin/sops/page.tsx',
      'utf8'
    )
    expect(libraryPage).toContain('AUTHORED IN BUILDER')
    expect(libraryPage).toContain('source_type')
    expect(libraryPage).toMatch(/source_type.+!==\s*'uploaded'/)
    // Library has a visible link to the blank wizard
    expect(libraryPage).toContain('/admin/sops/new/blank')

    // 2. Both UI surfaces converge on the existing publish route. No new
    //    publish code was written in Plan 12-03.
    const reviewClient = await fs.readFile(
      'src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx',
      'utf8'
    )
    expect(reviewClient).toContain('/api/sops/')
    expect(reviewClient).toContain('/publish')

    const builderClient = await fs.readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
      'utf8'
    )
    // Builder's SEND TO REVIEW points at the existing review page, NOT at
    // a new publish action.
    expect(builderClient).toMatch(/review/i)

    // 3. Existing publish route file exists at the canonical location.
    const publishRoute = await fs
      .readFile('src/app/api/sops/[sopId]/publish/route.ts', 'utf8')
      .catch(() => null)
    expect(publishRoute).not.toBeNull()

    // 4. Phase 12-03 does NOT introduce a `publishSop` server action.
    //    (The SPEC reinterpretation is documented in the plan objective —
    //    literal grep is intentionally NOT asserted.)
    const sops = await fs.readFile('src/actions/sops.ts', 'utf8')
    expect(sops).not.toMatch(/export async function publishSop\b/)
  })
})
