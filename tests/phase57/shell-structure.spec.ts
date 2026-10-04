/**
 * Phase 57 -- SHL-01 the one screen's structure.
 * Frame half live from 57-02; page / layout / pathways halves are filled by
 * 57-04 and 57-06.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

/** Naive brace-matched body of `function <name>(...) { ... }`. */
function functionBody(src: string, name: string): string {
  const sig = src.indexOf(`function ${name}(`)
  if (sig === -1) return ''
  const start = src.indexOf('{', src.indexOf(')', sig))
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1)
  }
  return src.slice(start)
}

test.describe('SHL-01 frame', () => {
  const FRAME = read('src/components/shell/ShellFrame.tsx')
  const ACCOUNT = read('src/components/shell/AccountControl.tsx')

  test('ShellFrame renders three panes with the shell test ids', () => {
    for (const id of [
      'shell',
      'shell-search',
      'shell-room-row',
      'shell-dept-row',
      'shell-machine-row',
      'shell-stage',
      'shell-edit-site',
      'shell-no-site',
      'shell-detail',
      'shell-detail-close',
      'shell-dept-machine',
    ]) {
      expect(FRAME, id).toContain(`data-testid="${id}"`)
    }
    expect(FRAME).toContain('export function ShellFrame')
    expect(FRAME).toContain('export interface ShellSite')
    expect(FRAME).toContain('export interface ShellFrameProps')
    expect(FRAME).toContain('flyInset={0}')
  })

  test('the panes collapse by CSS only: no viewport hook, no navigation import, no header or nav element', () => {
    expect(FRAME).not.toContain('useViewport')
    expect(FRAME).not.toMatch(/from ['"]next\/navigation['"]/)
    expect(FRAME).not.toMatch(/router\./)
    expect(FRAME).not.toMatch(/<header|<nav|role="banner"/)
    expect(FRAME).toContain('hidden min-w-0 flex-1 lg:block')
    expect(FRAME).toContain('lg:w-64')
    expect(FRAME).toContain('lg:w-100')
  })

  test('place state is seeded by parsePlace and written only by select(), which also replaces the URL', () => {
    expect(FRAME).toMatch(/useState<Place>\(\(\) => parsePlace\(initialPlace\)\)/)
    expect((FRAME.match(/replaceState/g) ?? []).length).toBe(1)
    const select = functionBody(FRAME, 'select')
    expect(select).toContain('setPlace(p)')
    expect(select).toContain("window.history.replaceState(null, '', formatPlace(p))")
    expect((FRAME.match(/setPlace\(/g) ?? []).length).toBe(1)
  })

  test('map, list, close button and department machines all call select()', () => {
    expect(FRAME).toMatch(/onMachineClick=\{\(id\) => select\(\{ kind: 'machine', id \}\)\}/)
    expect(FRAME).toMatch(/onRoomClick=\{/)
    expect(FRAME).toContain('ROOM_IDS.find(')
    expect(FRAME).toMatch(/data-testid="shell-machine-row"[\s\S]{0,300}select\(\{ kind: 'machine'/)
    expect(FRAME).toMatch(/data-testid="shell-room-row"[\s\S]{0,300}select\(\{ kind: 'room'/)
    expect(FRAME).toMatch(/data-testid="shell-dept-row"[\s\S]{0,300}select\(\{ kind: 'dept'/)
    expect(FRAME).toMatch(/data-testid="shell-detail-close"[\s\S]{0,200}select\(OVERVIEW\)/)
    expect(FRAME).toMatch(/data-testid="shell-dept-machine"[\s\S]{0,200}select\(\{ kind: 'machine'/)
  })

  test('the camera effect never navigates; it flies, frames a department or refits', () => {
    const at = FRAME.indexOf('The camera follows the place')
    expect(at).toBeGreaterThan(-1)
    const effect = FRAME.slice(at, FRAME.indexOf('[placeKey', at))
    expect(effect).toContain('stage.flyTo(')
    expect(effect).toContain('stage.fitMachines(')
    expect(effect).toContain('stage.fit()')
    expect(effect).not.toMatch(/select\(|setPlace|replaceState/)
  })

  test('an unknown machine or department, or edit without rights, resolves to the overview in render', () => {
    const resolve = functionBody(FRAME, 'resolvePlace')
    expect(resolve).toContain('ctx.canEdit ? place : OVERVIEW')
    expect(resolve).toContain('if (ctx.loading) return place')
    expect(resolve).toMatch(/machines\.some\(/)
    expect(resolve).toMatch(/departments\.some\(/)
  })

  test('Escape selects the overview, ignored while typing and in edit mode', () => {
    expect(FRAME).toContain("e.key !== 'Escape'")
    expect(FRAME).toContain('isTypingTarget(e.target)')
    expect(FRAME).toContain('selectRef.current(OVERVIEW)')
    expect(FRAME).toMatch(/if \(editing\) return/)
    expect(functionBody(FRAME, 'isTypingTarget')).toMatch(/INPUT[\s\S]*TEXTAREA[\s\S]*SELECT[\s\S]*isContentEditable/)
  })

  test('the detail content is keyed by the place so per-place state resets', () => {
    expect(FRAME).toContain('<div key={placeKey}>')
    expect(FRAME).toContain('data-place={placeKey}')
  })

  test('edit mode swaps the stage and detail for one column rendered by renderEdit', () => {
    expect(FRAME).toContain('renderEdit(() => select(OVERVIEW))')
  })

  test('AccountControl carries email, Profile, Sign out and admin-only Pathways and Feedback', () => {
    expect(ACCOUNT).toContain('data-testid="shell-account"')
    expect(ACCOUNT).toContain('data-testid="shell-sign-out"')
    expect(ACCOUNT).toContain("from '@/actions/auth'")
    expect(ACCOUNT).toContain('<form action={signOut}')
    expect(ACCOUNT).toContain('href="/profile"')
    expect(ACCOUNT).toMatch(/isAdmin &&[\s\S]*href="\/pathways"[\s\S]*href="\/uat"/)
  })

  test('the frame is the only non-plant importer of the stage, and stays free of the canvas engine', () => {
    expect(FRAME).toContain("from '@/components/sop/plant/PlantStage'")
    expect(FRAME).not.toMatch(/konva/i)
  })
})

test.describe('SHL-01 one screen structure', () => {
  test.fixme('the root page renders the landing signed out and the one screen signed in [57-04]', () => {})
  test.fixme('the protected layout has no header; bridge pages carry the Back bar [57-06]', () => {})
  test.fixme('pathways map shows no unmapped screen for the new routes [57-04]', () => {})
})
