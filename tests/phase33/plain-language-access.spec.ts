/**
 * SC-5 — No jargon ("grants" / "wire up" / "UNWIRED") anywhere user-facing
 * in the wiring UI; a plain-language "Who can see this?" / "What can they
 * see?" answer panel replaces the jargon-laden copy.
 *
 * Contract (33-09-PLAN must_haves, RESEARCH Pattern 5):
 *   - `src/components/admin/wiring/AccessAnswerPanel.tsx` (NEW) — selecting
 *     a SOP/collection renders "Who can see this?" (people-first sentence,
 *     e.g. "Only 2 people can see this SOP — Dave Hohaia and Priya Sharma,
 *     chosen by name"); selecting a person/team flips to "What can they
 *     see?".
 *   - `WiringPatchBay.tsx` jargon sweep: "NEW · UNWIRED" / "N grants" /
 *     bay-hint line / saveError copy rewritten to plain language.
 *   - `SelectionStrip.tsx` copy rewritten (idle onboarding line, "via N
 *     grants" -> people-first sentence, "✓ Done wiring" -> "Save — done"
 *     class label) while the 48px fixed-slot STRUCTURE stays exactly as-is
 *     (Phase 32 SC-6 pixel-stability contract — repoint
 *     banner-slot-stability.spec.ts's copy pins in the same commit, keep
 *     its structural pins).
 *   - PublishStage's "Wire up access" CTA label rewritten.
 *   - Internal identifiers (`createGrant`, `pending`, testids) are OUT of
 *     scope — SC-5 is user-visible copy only.
 *
 * Flipped LIVE in: 33-09.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STRIP = path.join(ROOT, 'src', 'components', 'admin', 'wiring', 'SelectionStrip.tsx')
const BAY = path.join(ROOT, 'src', 'components', 'admin', 'wiring', 'WiringPatchBay.tsx')
const PANEL = path.join(ROOT, 'src', 'components', 'admin', 'wiring', 'AccessAnswerPanel.tsx')
const PUBLISH_STAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'PublishStage.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// Extract only the JSX render body of each source-contract file (skip doc
// comments, which are allowed to reference the old jargon for history/
// context — the ACTUAL rendered strings are what SC-5 gates).
function renderBody(src: string): string {
  return src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test.describe('SC-5 — no jargon literals in rendered wiring UI copy', () => {
  test('SelectionStrip render body contains no "grant"/"wire up"/"UNWIRED" text', () => {
    const body = renderBody(read(STRIP))
    expect(body).not.toMatch(/UNWIRED/i)
    expect(body).not.toMatch(/wire up/i)
    // "grantCount" is an internal prop name (identifiers exempt) — the JSX
    // strings themselves must not say "grant".
    expect(body).not.toContain('grant.')
    expect(body).not.toContain('grants.')
    expect(body).not.toMatch(/\d grant/i)
  })

  test('WiringPatchBay render body contains no "UNWIRED"/"Wire up" text and drops "N grants" counts', () => {
    const body = renderBody(read(BAY))
    expect(body).not.toMatch(/UNWIRED/i)
    expect(body).not.toMatch(/Wire up/i)
    expect(body).not.toContain("grant{grantCount")
    expect(body).not.toMatch(/\d grants?</i)
    // Plain-language replacements are present.
    expect(body).toContain('follows collection')
    expect(body).toContain('chosen by name')
    expect(body).toContain("That didn&apos;t save")
  })

  test('PublishStage CTA no longer says "Wire up access"', () => {
    const body = renderBody(read(PUBLISH_STAGE))
    expect(body).not.toMatch(/Wire up access/i)
    expect(body).toContain('Choose who sees it')
  })
})

test.describe('SC-5 — AccessAnswerPanel answers "Who can see this?" / "What can they see?"', () => {
  test('renders "Who can see this?" for SOP/collection selection, chosen-by-name sentence + re-follow note', () => {
    const src = read(PANEL)
    expect(src).toContain('Who can see this?')
    expect(src).toContain("chosen by name.")
    expect(src).toContain('Remove all named people and this SOP follows its collection again.')
  })

  test('renders "What can they see?" for person/team selection', () => {
    const src = read(PANEL)
    expect(src).toContain('What can they see?')
    const heading = src.match(/const heading = ([\s\S]*?)\n/)?.[1] ?? ''
    expect(heading).toContain("'unit'")
    expect(heading).toContain("'What can they see?'")
  })

  test('WiringPatchBay wires AccessAnswerPanel from its EXISTING accessByUnit/grants/peopleIndex memos — no new fetch, no second resolver', () => {
    const src = read(BAY)
    expect(src).toContain('<AccessAnswerPanel data={panelData} />')
    expect(src).toContain('const panelData = useMemo((): AccessAnswerPanelData => {')
    // Reuses the shipped memos — not a second resolveEffectiveAccess call.
    expect(src).toContain('const access = accessByUnit.get(panelTargetId)')
    expect(src).toContain('const sopAccess = sopAccessByUnit.get(panelTargetId)')
    // The two existing resolver call sites (accessByUnit + sopAccessByUnit,
    // unchanged from 33-08) are the only ones with real arguments.
    const resolverCallSites = src.match(/resolveEffectiveAccess\(chain, \w+\)/g) ?? []
    expect(resolverCallSites.length).toBe(2)
  })
})

test.describe('SC-5 — SelectionStrip 48px structural pins survive the copy sweep', () => {
  test('h-[48px] slot structure is untouched', () => {
    const src = read(STRIP)
    expect(src).toContain('h-[48px] overflow-hidden')
    expect(src).toContain('className={`strip-slot h-[48px] overflow-hidden ${state}`}')
    expect(src).toContain('onClick={onDone}')
    const divCount = (src.match(/<div data-state=/g) ?? []).length
    expect(divCount).toBe(1)
  })
})
