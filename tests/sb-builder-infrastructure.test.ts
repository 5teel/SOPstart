import { test, expect } from '@playwright/test'

test.describe('Builder infrastructure and safety gates (SB-INFRA)', () => {
  test('SB-INFRA-00 /admin/sops/builder/[sopId] route scaffold exists with Puck CSS import + ssr:false dynamic load', async () => {
    // Plan 01: the builder route must exist as an RSC + client wrapper pair that
    // loads @puckeditor/core client-only via next/dynamic with ssr:false. Full
    // route-load / 200-vs-302 assertions land with Plan 02 once the palette is wired.
    const fs = await import('node:fs/promises')
    const page = await fs.readFile('src/app/(protected)/admin/sops/builder/[sopId]/page.tsx', 'utf8')
    expect(page).toContain("import '@puckeditor/core/puck.css'")
    expect(page).toContain('organisation_members')
    expect(page).toContain("redirect('/login')")
    expect(page).toContain("redirect('/dashboard')")
    expect(page).toContain("redirect('/admin/sops')")
    expect(page).toContain('BuilderClient')

    const client = await fs.readFile('src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx', 'utf8')
    expect(client).toContain("'use client'")
    expect(client).toContain('ssr: false')
    expect(client).toContain("'@puckeditor/core'")
  })
  test.fixme('SB-INFRA-01 draft SOPs authored in the builder integrate with Phase 9 sop_pipeline_runs so builder-authored SOPs can route to video generation with the same progress page and publish auto-queue', async ({ page }) => {})
  test.fixme('SB-INFRA-02 all builder content persists through Dexie for offline authoring and syncs via the existing sync engine with no explicit save step (auto-save to Dexie on change, debounced to Supabase)', async ({ page }) => {})
  test.fixme('SB-INFRA-03 builder bundle is code-split; CI verifies worker route First-Load-JS does not include Puck, Konva, Yjs, or y-dexie imports', async ({ page }) => {})
  test.fixme('SB-INFRA-04 AI-drafted content passes the same Phase 6 adversarial verification gate before admin review so hallucinated hazards/PPE are flagged', async ({ page }) => {})
})
