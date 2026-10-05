import { test, expect } from '@playwright/test'

/**
 * SB-INFRA -- editor infrastructure and safety gates. Repointed in 58-15 onto the
 * focus editor.
 *
 * Moved: SB-INFRA-00 (route scaffold: server guard + client shell) is now the
 * focus page's edit branch + the lazy FocusEditor seam; SB-INFRA-03 (worker
 * bundle carries no editor) is the seam's static shape.
 *
 * Dropped: SB-INFRA-02 (Dexie offline authoring + sync engine) -- the app is
 * online-only since Phase 55 and the editor writes straight to the server
 * (useFocusAutosave); asserting it would reintroduce the cache.
 */
test.describe('Editor infrastructure and safety gates (SB-INFRA)', () => {
  test('SB-INFRA-00 the focus page is a server guard (session + edit access) rendering a client shell', async () => {
    const fs = await import('node:fs/promises')
    const page = await fs.readFile('src/app/(protected)/sops/[sopId]/page.tsx', 'utf8')
    expect(page).toContain('getSessionContext')
    expect(page).toContain("redirect('/login')")
    expect(page).toContain('requireSopEditAccess({ sopId })')
    expect(page).toContain('<FocusWalker')

    const walker = await fs.readFile('src/components/focus/FocusWalker.tsx', 'utf8')
    expect(walker).toContain("'use client'")
    const frame = await fs.readFile('src/components/focus/FocusFrame.tsx', 'utf8')
    expect(frame).toContain('<FocusEditor')
  })

  test.fixme('SB-INFRA-04 AI-drafted content passes the same Phase 6 adversarial verification gate before admin review so hallucinated hazards/PPE are flagged', async ({ page }) => {})

  test('SB-INFRA-03 the editor is code-split: only the frame names it, behind next/dynamic with ssr off', async () => {
    const fs = await import('node:fs/promises')
    const frame = await fs.readFile('src/components/focus/FocusFrame.tsx', 'utf8')
    expect(frame).toMatch(/dynamic\(\(\) => import\('@\/components\/focus\/admin\/FocusEditor'\)/)
    expect(frame).toContain('ssr: false')
    // No worker focus file imports the editor statically.
    for (const f of ['FocusWalker', 'FocusTopBar', 'FocusRail', 'BrowseDocument', 'WalkStep', 'ReviewAndSend', 'SentPanel', 'ResumeCard']) {
      const src = await fs.readFile(`src/components/focus/${f}.tsx`, 'utf8')
      expect(src, f).not.toMatch(/from '@\/components\/focus\/admin\//)
    }
    expect(await fs.readFile('src/hooks/useWalk.ts', 'utf8')).not.toContain('focus/admin')
  })
})
