/**
 * Phase 52 -- HOM-05. Live source-contract tests for PlantAskBar.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'components', 'sop', 'plant', 'PlantAskBar.tsx'), 'utf-8')

test.describe('PlantAskBar', () => {
  test('the input onChange wires directly to the one query state, no router.push (2026-05-13)', () => {
    expect(SRC).toContain('data-testid="plant-ask"')
    expect(SRC).toMatch(/onChange=\{\(e\)\s*=>\s*onChange\(e\.target\.value\)\}/)
    expect(SRC).not.toContain('router.push')
    expect(SRC).not.toContain('useRouter')
    expect(SRC).not.toContain('history.pushState')
  })

  test('the mic button opens WalkthroughVoiceModal via next/dynamic({ ssr: false }), scoped to voiceSopId', () => {
    expect(SRC).toContain('data-testid="plant-ask-mic"')
    expect(SRC).toContain('disabled={!voiceSopId}')
    expect(SRC).toMatch(/onClick=\{\(\)\s*=>\s*setVoiceOpen\(true\)\}/)
    expect(SRC).toMatch(
      /dynamic\([\s\S]*?import\('@\/components\/sop\/voice\/WalkthroughVoiceModal'\)[\s\S]*?ssr:\s*false/
    )
    expect(SRC).toMatch(/voiceOpen\s*&&\s*voiceSopId[\s\S]*?<WalkthroughVoiceModal/)
    expect(SRC).toMatch(/sopId=\{voiceSopId\}/)
  })

  test('the voice modal chunk is reached only through next/dynamic -- no static import of WalkthroughVoiceModal in this file', () => {
    expect(SRC).not.toMatch(/^import\s+.*WalkthroughVoiceModal.*from/m)
  })
})
