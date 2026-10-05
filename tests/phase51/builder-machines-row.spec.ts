/**
 * Phase 51 -- SIT-04. Source-contract assertions for the builder's
 * "Pick machines for this SOP" ToolsMenu row + MachinesButton modal (moved to
 * src/components/focus/admin in 58-12).
 *
 * Activated by Plan 51-06.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

const BUTTON_PATH = "src/components/focus/admin/MachinesButton.tsx"
const SHELL_PATH = "src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx"

/** Returns the [start, end) character span of a top-level `function <name>(` body. */
function functionSpan(src: string, name: string): [number, number] {
  const marker = new RegExp(`function ${name}\\(`)
  const m = marker.exec(src)
  if (!m) throw new Error(`${name} not found in source`)
  const start = m.index
  let i = src.indexOf('{', m.index)
  let depth = 1
  i++
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return [start, i]
}

test.describe('modal', () => {
  test('SopMachinePicker lists org-scoped machines grouped by department, with search', () => {
    const src = read(BUTTON_PATH)
    expect(src.startsWith("'use client'")).toBe(true)
    expect(src).toContain('listSopMachines(')
    expect(src).toContain('data-testid="machines-picker"')
    expect(src).toContain('aria-label="Find a machine"')
    expect(src).toContain('href="/?place=edit"')
    expect(src).toContain('Pick machines for this SOP')
  })

  test('toggling a machine in the picker writes through setSopMachines(sopId, ids), not a bespoke insert', () => {
    const src = read(BUTTON_PATH)
    expect(src).toContain('setSopMachines({ sopId, machineIds: next })')
  })

  test('the checkbox handler is wired to the shared setSopMachines() call, not just present in the file', () => {
    const src = read(BUTTON_PATH)
    const [start, end] = functionSpan(src, 'toggleMachine')
    const body = src.slice(start, end)
    expect(body).toContain('setSopMachines(')
    expect(src).toContain('onChange={() => void toggleMachine(machine.id)}')
  })

  test('modal follows the portaled-modal pattern (createPortal to document.body, Escape closes)', () => {
    const src = read(BUTTON_PATH)
    expect(src).toContain('createPortal(')
    expect(src).toContain('document.body')
    expect(src).toContain('role="menuitem"')
    expect(src).toContain("'Escape'")
  })

  test('never imports the admin/service-role client', () => {
    const src = read(BUTTON_PATH)
    expect(src).not.toContain('createAdminClient')
  })
})

test.describe('tools menu', () => {
  test('BuilderStageShell ToolsMenu renders a "Pick machines" row inside the tools menu', () => {
    const src = read(SHELL_PATH)
    expect(src).toContain("import { MachinesButton } from '@/components/focus/admin/MachinesButton'")
    expect(src).toContain('<MachinesButton sopId={sopId} />')
  })

  test('the row opens MachinesButton, not a route navigation, and sits after the tool links, before DeleteSopButton', () => {
    const src = read(SHELL_PATH)
    // JSX usages (not the import lines) — each of these tags is used exactly
    // once as JSX in the whole file, inside ToolsMenu.
    const editIdx = src.indexOf('items.map(')
    const machinesIdx = src.indexOf('<MachinesButton sopId={sopId} />')
    const deleteIdx = src.indexOf('<DeleteSopButton')
    expect(editIdx).toBeGreaterThan(-1)
    expect(machinesIdx).toBeGreaterThan(editIdx)
    expect(deleteIdx).toBeGreaterThan(machinesIdx)
  })
})
