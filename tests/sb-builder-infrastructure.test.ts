import { test, expect } from '@playwright/test'

test.describe('Builder infrastructure and safety gates (SB-INFRA)', () => {
  test('SB-INFRA-00 /admin/sops/builder/[sopId] route scaffold exists as RSC guard + client shell pair', async () => {
    // Repointed 2026-07-13: Puck was deleted in Phase 26 (bespoke inline editor);
    // this spec had rotted against the old @puckeditor/core scaffold and was
    // failing silently. The auth guard now flows through the shared
    // getSessionContext() (local JWT verify + cached member-role lookup).
    const fs = await import('node:fs/promises')
    const page = await fs.readFile('src/app/(protected)/admin/sops/builder/[sopId]/page.tsx', 'utf8')
    expect(page).toContain('getSessionContext')
    expect(page).toContain("redirect('/login')")
    expect(page).toContain("redirect('/dashboard')")
    expect(page).toContain("redirect('/admin/sops')")
    expect(page).toContain('BuilderStageShell')

    const shell = await fs.readFile('src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx', 'utf8')
    expect(shell).toContain("'use client'")
  })
  test.fixme('SB-INFRA-01 draft SOPs authored in the builder integrate with Phase 9 sop_pipeline_runs so builder-authored SOPs can route to video generation with the same progress page and publish auto-queue', async ({ page }) => {})
  test.fixme('SB-INFRA-02 all builder content persists through Dexie for offline authoring and syncs via the existing sync engine with no explicit save step (auto-save to Dexie on change, debounced to Supabase)', async ({ page }) => {})
  test.fixme('SB-INFRA-03 builder bundle is code-split; CI verifies worker route First-Load-JS does not include Puck, Konva, Yjs, or y-dexie imports', async ({ page }) => {})
  test.fixme('SB-INFRA-04 AI-drafted content passes the same Phase 6 adversarial verification gate before admin review so hallucinated hazards/PPE are flagged', async ({ page }) => {})
})
