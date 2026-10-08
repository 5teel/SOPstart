/**
 * Phase 58 -- FOC-01, FOC-03 (D-26): the focus frame's structure.
 * Decisions: top bar, rail, column, Esc order, Back behaviour.
 * Filled by: 58-10 (frame + browse), 58-11 (walk UI, backForPath).
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
    for (const banned of ['Badge', 'Notification', 'Account', 'Bell']) {
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

  test('backForPath returns null for every /sops/* path so the focus frame owns the top bar (58-11)', () => {
    const PLACE = stripComments(read('src/lib/shell/home-state.ts'))
    expect(PLACE).toContain("pathname.startsWith('/sops/')) return null")
    // BackToSite renders nothing when backForPath is null (the layout stays unchanged).
    expect(read('src/components/layout/BackToSite.tsx')).toContain('if (!href) return null')
  })

  test('the SOP page is a server component that resolves the version and renders only the focus frame (58-11)', () => {
    const PAGE = read('src/app/(protected)/sops/[sopId]/page.tsx')
    expect(PAGE.split('\n').slice(0, 3).join('\n')).not.toContain('use client')
    const code = stripComments(PAGE)
    expect(code).toContain('resolveFocusTarget(')
    expect(code).toContain('notFound()')
    expect(code).toContain('redirect(focusHref(target.id, { from }))')
    expect(code).toContain('<FocusWalker')
    expect(code).not.toMatch(/useEffect|useRouter|router\./)
    for (const banned of ['BackToSite', 'PlantStage', '@/components/shell', '@/components/admin', 'SopTabNav', 'WalkthroughSwitcher', 'ReadTab', 'useSopDetail']) {
      expect(code, banned).not.toContain(banned)
    }
    // A draft is never offered to a worker: the resolver decides, not RLS.
    expect(stripComments(read('src/lib/sop/lineage-current.ts'))).toContain('ADMIN_ROLES.includes(role)')
  })

  test('the focus walker makes no router call and mounts browse, walk, review, sent and resume in one frame (58-11)', () => {
    const W = stripComments(read('src/components/focus/FocusWalker.tsx'))
    for (const c of ['<BrowseDocument', '<WalkStep', '<ReviewAndSend', '<SentPanel', '<ResumeCard', '<FocusFrame']) expect(W, c).toContain(c)
    expect(W).not.toMatch(/router\./)
  })

  test('no focus file imports the shell, the map, the list, the inbox or notifications (58-10)', () => {
    for (const { f, code } of focusFiles()) {
      // 60-14: the objective line and its editor seam are the two shell files a SOP surface may import (A-01)
      expect(code, f).not.toMatch(/@\/components\/shell(?!\/Objective(Line|Slot)')/)
      for (const banned of ['PlantStage', ['Notification', 'Badge'].join(''), 'AccountControl', 'loadInbox', 'BackToSite', '@/components/admin']) {
        expect(code, `${f} imports ${banned}`).not.toContain(banned)
      }
    }
    expect(stripComments(read('src/hooks/useFocusBack.ts'))).not.toMatch(/@\/components\/shell/)
    // The plant is reached only by the shell (Phase 57 sweep): the focus files never import it.
    for (const { f, code } of focusFiles()) expect(code, f).not.toContain('@/components/sop/plant')
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

  test('edit and parsing mount the lazy editor inside the same frame, with a skeleton while the chunk loads (58-13)', () => {
    const FRAME = stripComments(read('src/components/focus/FocusFrame.tsx'))
    expect(FRAME).toContain("const FocusEditor = dynamic(() => import('@/components/focus/admin/FocusEditor')")
    expect(FRAME).toContain('ssr: false')
    expect(FRAME).toContain('loading: () => <EditorSkeleton />')
    expect(FRAME).toContain("(mode === 'edit' || mode === 'parsing') && !!editor")
    expect(FRAME).toContain('<FocusEditor sop={editor.sop}')
    // The editor is handed the frame through a context, not an import of the frame.
    expect(FRAME).toContain('<FocusEditorBridgeContext.Provider value={bridge}>')
    expect(stripComments(read('src/components/focus/admin/FocusEditor.tsx'))).not.toMatch(/from '@\/components\/focus\/FocusFrame'/)
  })

  test('the top bar gets a save-pill slot in edit mode, and Back waits for the editor flush as well (58-13)', () => {
    const FRAME = read('src/components/focus/FocusFrame.tsx')
    expect(FRAME).toContain('data-testid="focus-save-slot"')
    expect(FRAME).toContain('editorBack.current?.()')
    expect(FRAME).toContain('beforeBack: mergedBeforeBack')
    expect(FRAME).toContain('setBeforeBack: setEditorBeforeBack')
  })

  test('the walker hands the frame the editor, the switch and the report-back, and never mounts the editor itself (58-13)', () => {
    const W = stripComments(read('src/components/focus/FocusWalker.tsx'))
    expect(W).toContain('editor={editing ? { sop: served, job, canPublish: canEdit, owner } : null}')
    expect(W).toContain('onEditorFocus={setEdited}')
    expect(W).not.toContain('FocusEditor')
    expect(W).not.toMatch(/@\/components\/focus\/admin/)
  })

  test('the page passes the mode, the job and canEdit to the walker, and the walker is still keyed to the SOP and the walk (58-13)', () => {
    const code = stripComments(read('src/app/(protected)/sops/[sopId]/page.tsx'))
    for (const prop of ['initialMode={initialMode}', 'job={job}', 'canEdit={canEdit}', "key={`${target.id}:${walk?.id ?? 'none'}`}"]) {
      expect(code, prop).toContain(prop)
    }
  })

  test('the parsing and skeleton views are tokens only and static under reduced motion (58-13)', () => {
    const SK = read('src/components/focus/EditorSkeleton.tsx')
    expect(SK).toContain('motion-reduce:animate-none')
    expect(SK).toContain('data-testid="edit-rail-skeleton"')
    expect(SK).toContain('w-75')
  })
})
