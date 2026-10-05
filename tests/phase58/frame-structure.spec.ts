/**
 * Phase 58 -- FOC-01, FOC-03 (D-26): the focus frame's structure.
 * Decisions: top bar, rail, column, Esc order, Back behaviour.
 * Filled by: 58-10 (frame + browse), 58-11 (walk UI, placeForPath).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const stripComments = (src: string) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l))
    .join('\n')

const FOCUS_DIR = path.join(ROOT, 'src', 'components', 'focus')
const focusFiles = () =>
  fs
    .readdirSync(FOCUS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ f, code: stripComments(read(`src/components/focus/${f}`)) }))

test.describe('FOC-01/FOC-03 focus frame', () => {
  test('the frame root carries the mode and version-state attributes', () => {
    const FRAME = read('src/components/focus/FocusFrame.tsx')
    expect(FRAME).toContain('data-testid="focus-screen"')
    expect(FRAME).toContain('data-mode={mode}')
    expect(FRAME).toContain('data-version-state={versionState}')
  })

  test('top bar carries Back and the SOP title only, plus a version chip and a slot (58-10)', () => {
    const BAR = read('src/components/focus/FocusTopBar.tsx')
    expect(BAR).toContain('onClick={onBack}')
    expect(BAR).toContain('{title}')
    expect(BAR).toContain('{children}')
    for (const banned of ['Badge', 'Notification', 'Account', 'Bell', 'RelBadge']) {
      expect(BAR, banned).not.toContain(banned)
    }
  })

  test('rail is w-75 and the reading column is max-w-205 (58-10)', () => {
    expect(read('src/components/focus/FocusRail.tsx')).toMatch(/\bw-75\b/)
    expect(read('src/components/focus/BrowseDocument.tsx')).toMatch(/\bmax-w-205\b/)
  })

  test('below lg the rail is a full-screen sheet opened by a "Steps" button, by CSS only (57 D-21)', () => {
    const RAIL = read('src/components/focus/FocusRail.tsx')
    expect(RAIL).toContain('max-lg:fixed max-lg:inset-0 max-lg:z-40')
    expect(RAIL).toContain('lg:flex')
    expect(read('src/components/focus/FocusTopBar.tsx')).toMatch(/data-testid="focus-steps-button"[\s\S]{0,200}lg:hidden/)
    expect(read('src/components/focus/FocusFrame.tsx')).not.toMatch(/useViewport|matchMedia/)
  })

  test.fixme('placeForPath returns null for every /sops/* path so the focus frame owns the top bar (58-11)', () => {})

  test('no focus file imports the shell, the map, the list, the inbox or notifications (58-10)', () => {
    for (const { f, code } of focusFiles()) {
      expect(code, f).not.toMatch(/@\/components\/shell/)
      for (const banned of ['PlantStage', 'NotificationBadge', 'AccountControl', 'loadInbox', 'BackToSite', '@/components/admin']) {
        expect(code, `${f} imports ${banned}`).not.toContain(banned)
      }
    }
    expect(stripComments(read('src/hooks/useFocusBack.ts'))).not.toMatch(/@\/components\/shell/)
  })

  test('no raw palette class, arbitrary pixel size or HTML-injection API in the focus files (T-58-20)', () => {
    for (const { f, code } of focusFiles()) {
      expect(code, f).not.toMatch(/\[[0-9]+px\]|text-(red|amber|green|blue|violet)-[0-9]/)
      expect(code, f).not.toContain('dangerously')
    }
  })

  test('Esc closes an overlay first, then leaves a field, then goes Back (58-10)', () => {
    const HOOK = stripComments(read('src/hooks/useFocusBack.ts'))
    const onKey = HOOK.slice(HOOK.indexOf('const onKey'))
    const overlay = onKey.indexOf('overlays.current')
    const field = onKey.indexOf('isField(')
    const back = onKey.indexOf('goBack()')
    expect(overlay).toBeGreaterThan(-1)
    expect(field).toBeGreaterThan(overlay)
    expect(back).toBeGreaterThan(field)
  })

  test('Back waits up to 3 s for a pending save, then router.push(backHref(from)) (D-26)', () => {
    const HOOK = stripComments(read('src/hooks/useFocusBack.ts'))
    expect(HOOK).toContain('SAVE_WAIT_MS = 3000')
    expect(HOOK).toContain('Promise.race')
    expect(HOOK).toContain('router.push(backHref(from))')
  })

  test('Back navigates from a user event, never from a mount effect (D-26, CLAUDE.md 2026-09-29) (58-10)', () => {
    const HOOK = stripComments(read('src/hooks/useFocusBack.ts'))
    // Every effect body in the hook: none may mention the router or call goBack.
    const effects = [...HOOK.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map((m) => m[1])
    expect(effects.length).toBeGreaterThan(0)
    for (const body of effects) {
      expect(body).not.toMatch(/router\./)
      expect(body).not.toContain('goBack(')
    }
    const BAR = read('src/components/focus/FocusTopBar.tsx')
    const FRAME = read('src/components/focus/FocusFrame.tsx')
    expect(BAR).toContain('onClick={onBack}')
    expect(FRAME).toContain('onBack={() => void goBack()}')
    for (const { f, code } of focusFiles()) expect(code, f).not.toMatch(/router\.(push|replace)/)
  })

  test('Start walking renders only when onStartWalking is passed and the version is not superseded (D-05, D-14)', () => {
    const BROWSE = read('src/components/focus/BrowseDocument.tsx')
    expect(BROWSE).toContain('const canStart = !!onStartWalking && !supersededBy')
    expect(BROWSE).toMatch(/\{canStart && \(/)
    expect(BROWSE).toContain('Start walking')
    expect(BROWSE).toContain('Updated since you last walked it')
    expect(BROWSE).toContain('This SOP has no steps yet.')
    // Browse creates no completion.
    expect(stripComments(BROWSE)).not.toMatch(/startWalk|submitCompletion|@\/actions/)
  })
})
