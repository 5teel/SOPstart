/**
 * Phase 58 (58-12) -- FOC-02 / WRK-04 / SOP-04: the editor's document, step card
 * and rail. Source-contract guards that pin WIRING (a handler reaches the action),
 * not just token presence (CLAUDE.md 2026-06-05).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const ADMIN = 'src/components/focus/admin'

/** Comments out of the way, so a guard on a literal is not tripped by prose about it. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    return e.isDirectory() ? walk(rel) : /\.tsx?$/.test(e.name) ? [rel] : []
  })
}

test.describe('step card', () => {
  const card = read(`${ADMIN}/StepCard.tsx`)

  test('the tick is a per-step checkbox wired to tickFocusStep / untickFocusStep', () => {
    expect(card).toContain('I have checked this')
    expect(card).toMatch(/tickFocusStep\(\{ stepId: step\.id \}\)/)
    expect(card).toMatch(/untickFocusStep\(\{ stepId: step\.id \}\)/)
    // The checkbox's own handler reaches the tick, not just a function that exists.
    expect(card).toMatch(/type="checkbox" checked=\{ticked\}[^>]*onChange=\{toggleTick\}/)
  })

  test('only admins and safety managers get the checkbox', () => {
    expect(card).toContain('canTick && !readOnly')
    // The page decides the flag from the role; the card never reads a role itself.
    expect(card).not.toMatch(/role\s*===/)
  })

  test('a tick is never batched', () => {
    for (const f of walk('src/components/focus')) {
      const src = code(read(f))
      expect(src, f).not.toMatch(/Promise\.all\([^)]*tickFocusStep/)
      expect(src, f).not.toMatch(/\.map\([^)]*tickFocusStep/)
    }
  })

  test('edits of text, kind, tip and the photo flag go through the autosave queue', () => {
    expect(card).toMatch(/queue\(step\.id, patch\)/)
    expect(card).toContain('edit({ kind: next })')
    expect(card).toContain('edit({ text: value })')
    expect(card).toContain('edit({ tip: e.target.value })')
    expect(card).toContain('edit({ photoRequired: e.target.checked })')
    expect(card).toContain('Edited — check it again')
  })

  test('step text is written as text, never as HTML', () => {
    for (const f of walk(ADMIN)) {
      expect(code(read(f)), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/)
    }
  })

  test('the step delete confirm carries the UI-SPEC copy', () => {
    expect(card).toContain('Delete this step?')
    expect(card).toContain('It will be removed from this draft.')
    expect(card).toContain('Delete step')
    expect(card).toContain('Keep it')
    expect(card).toContain('bg-accent-escalate')
  })

  test('photos go up through the guarded upload and attach actions, and come off through removeStepImage', () => {
    expect(card).toContain('getStepImageUploadUrl(')
    expect(card).toContain('attachStepImage(')
    expect(card).toContain('removeStepImage(')
    expect(card).toContain('moveFocusStep(')
    expect(card).toContain('deleteFocusStep(')
  })
})

test.describe('document', () => {
  const doc = read(`${ADMIN}/EditDocument.tsx`)

  test('forkDraft runs only from a click handler, never an effect', () => {
    expect(doc.match(/forkDraft\(/g)?.length).toBe(1)
    expect(code(doc)).not.toMatch(/useEffect/)
    const fn = doc.slice(doc.indexOf('async function startEditing'))
    expect(fn.slice(0, fn.indexOf('\n  }\n'))).toContain('forkDraft({ sopId })')
    expect(doc).toMatch(/onClick=\{\(\) => void startEditing\(\)\}/)
    expect(doc).toContain('router.push(focusHref(res.draftId')
  })

  test('a published version is read-only and offers Start editing', () => {
    expect(doc).toContain("const readOnly = sop.status !== 'draft'")
    expect(doc).toContain('Start editing v')
    expect(doc).toContain('Draft — not published yet')
    expect(doc).toContain('is live')
    expect(doc).toContain('logged in the decision ledger')
  })

  test('the blank SOP says so and offers Add a section', () => {
    expect(doc).toContain('Nothing here yet')
    expect(doc).toContain('Add your first section, then write the steps a worker follows.')
    expect(doc).toContain('Add a section')
  })

  test('sections: rename, move, delete and add reach their actions; steps follow source order', () => {
    expect(doc).toContain('updateSectionTitle(')
    expect(doc).toContain('reorderSections(')
    expect(doc).toContain('deleteFocusSection(')
    expect(doc).toContain('createSection(')
    expect(doc).toContain('addFocusStep(')
    expect(doc).toContain('Its {deleting.count} steps go too.')
    expect(doc).toContain('Delete section')
    expect(doc).toContain('Keep it')
    // Never the walk order: the editor groups by section.
    expect(doc).not.toContain('walkOrder')
  })

  test('structural actions re-read the SOP', () => {
    expect(doc).toContain('invalidate()')
    expect(doc).toContain('useFocusAutosave(sopId)')
  })

  test('it offers a slot for 58-13 banner above the sections', () => {
    expect(doc).toContain('bannerSlot')
  })
})

test.describe('rail', () => {
  const rail = read(`${ADMIN}/EditRail.tsx`)

  test('steps in source order with a tick state, an add-section row and a footer slot', () => {
    expect(rail).toContain('focus.sections.map')
    expect(rail).toContain('Add section')
    expect(rail).toContain('footer')
    expect(rail).toContain('scrollToStep(step.id)')
    expect(rail).toContain('w-75 shrink-0')
    expect(rail).not.toContain('walkOrder')
  })
})

test.describe('no bulk tick, nothing in the worker path', () => {
  test('no tick-all wording anywhere under src/components/focus', () => {
    for (const f of walk('src/components/focus')) {
      const src = code(read(f)).toLowerCase()
      for (const phrase of ['approve all', 'verify all', 'select all', 'check all', 'tick all', 'bulk verify', 'skip remaining']) {
        expect(src, `${f}: ${phrase}`).not.toContain(phrase)
      }
    }
  })

  test('no worker file imports the admin editor components', () => {
    const files = [...walk('src/app/(protected)/sops'), ...walk('src/components/focus').filter((f) => !f.startsWith(`${ADMIN}/`))]
    for (const f of files) {
      // 58-13: FocusFrame is the one seam, and only through next/dynamic (pinned in edit-rail).
      if (f === 'src/components/focus/FocusFrame.tsx') {
        expect(code(read(f)), f).not.toMatch(/from '@\/components\/focus\/admin/)
        continue
      }
      expect(code(read(f)), f).not.toContain('components/focus/admin')
    }
  })

  test('copy says step and section, never block', () => {
    // The relocated tool buttons keep their own wording guard (phase56 standards-actions).
    const moved = ['InlineText', 'MachinesButton', 'StandardsButton', 'CategoryButton'].map((n) => `${ADMIN}/${n}.tsx`)
    for (const f of walk(ADMIN).filter((f) => !moved.includes(f))) {
      // ThisSopBlock is the planned component name; it never reaches the screen.
      expect(code(read(f)).replaceAll('ThisSopBlock', ''), f).not.toMatch(/block/i)
    }
  })
})
