/**
 * Phase 57 -- PLC-05 departments in edit mode.
 * 57-03 fills the actions and the strip; 57-07 owns the route redirects.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { DEPT_COLOURS, deriveDepartmentCode } from '@/lib/site/departments'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf-8').replace(/\r\n/g, '\n')

const ACTIONS = read('src', 'actions', 'departments.ts')

/** Source of `export async function <name>(...)` up to its column-0 closing brace. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  expect(start, `${name} exists`).toBeGreaterThan(-1)
  const end = src.indexOf('\n}\n', start)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end + 2)
}

test.describe('PLC-05 departments: code derivation', () => {
  test('initials, suffixes, limits', () => {
    expect(deriveDepartmentCode('Forming', [])).toBe('FOR')
    expect(deriveDepartmentCode('Hot End Forming', [])).toBe('HEF')
    expect(deriveDepartmentCode('Forming', ['FOR'])).toBe('FOR2')
    expect(deriveDepartmentCode('Forming', ['FOR', 'FOR2'])).toBe('FOR3')
    expect(deriveDepartmentCode('a b c d e f g h', [])).toHaveLength(6)
    expect(deriveDepartmentCode('!!!', [])).toBe('D')
    expect(deriveDepartmentCode('Forming', ['for'])).toBe('FOR2')
    for (const n of ['Forming', 'Hot End Forming', 'a b c d e f g h', '!!!', 'x']) {
      expect(deriveDepartmentCode(n, ['FOR', 'D', 'X'])).toMatch(/^[A-Z0-9]{1,6}$/)
    }
  })

  test('a six-character base still fits its suffix', () => {
    const code = deriveDepartmentCode('a b c d e f', ['ABCDEF'])
    expect(code).toBe('ABCDE2')
    expect(code.length).toBeLessThanOrEqual(6)
  })

  test('eight colours', () => {
    expect(DEPT_COLOURS).toHaveLength(8)
  })
})

test.describe('PLC-05 departments: actions', () => {
  test('the colour list lives in the plain module and the action imports it', () => {
    expect(ACTIONS).toContain("from '@/lib/site/departments'")
    expect(ACTIONS).not.toContain("'#f97316'")
    expect(ACTIONS).toContain('z.enum(DEPT_COLOURS)')
  })

  test('createDepartment derives the code server-side from the org codes', () => {
    const body = fnBody(ACTIONS, 'createDepartment')
    expect(body).toContain('deriveDepartmentCode(')
    expect(body).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(ACTIONS).toMatch(/const CreateDepartmentInput[\s\S]*?code:[^\n]*\.optional\(\)/)
  })

  test('archiveDepartment counts machines and SOP rules before it archives, and returns both', () => {
    const body = fnBody(ACTIONS, 'archiveDepartment')
    const upd = body.indexOf('.update(')
    expect(upd).toBeGreaterThan(-1)
    expect(body.indexOf("'site_machines'")).toBeGreaterThan(-1)
    expect(body.indexOf("'site_machines'")).toBeLessThan(upd)
    expect(body.indexOf("'sop_departments'")).toBeGreaterThan(-1)
    expect(body.indexOf("'sop_departments'")).toBeLessThan(upd)
    expect(body).toContain('machines, sops')
    expect(body).toContain("'Still in use'")
    // lookup, machine count and the archive write each carry the session org (sop_departments has no org column; the department is already proven in-org)
    expect((body.match(/\.eq\('organisation_id', ctx\.organisationId\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  test('updateDepartment filters by the session org as well as the id', () => {
    const body = fnBody(ACTIONS, 'updateDepartment')
    expect(body).toContain(".eq('id', parsed.data.id)")
    expect(body).toContain(".eq('organisation_id', ctx.organisationId)")
  })

  test('no service-role client inside the three department bodies', () => {
    for (const n of ['createDepartment', 'updateDepartment', 'archiveDepartment']) {
      expect(fnBody(ACTIONS, n)).not.toContain('createAdminClient')
    }
  })
})

test.describe('PLC-05 live', () => {
  test.skip(process.env.PHASE57_LIVE !== '1', 'set PHASE57_LIVE=1 to run against the live database')

  test('the eval-site Forming department is in use, so a remove would be refused', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    for (const l of fs.existsSync(path.join(ROOT, '.env.local')) ? read('.env.local').split('\n') : []) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(url && key, 'service env present').toBeTruthy()
    const db = createClient(url!, key!, { auth: { persistSession: false } })
    const { data: orgs } = await db.from('organisations').select('id').eq('name', 'SOPstart Eval Site').limit(1)
    const orgId = (orgs?.[0] as { id: string } | undefined)?.id
    expect(orgId).toBeTruthy()
    const { data: dept } = await db.from('departments').select('id').eq('organisation_id', orgId!).eq('name', 'Forming').maybeSingle()
    expect(dept).toBeTruthy()
    const { count: machines } = await db
      .from('site_machines').select('id', { count: 'exact', head: true })
      .eq('department_id', (dept as { id: string }).id).eq('organisation_id', orgId!)
    const { count: sops } = await db
      .from('sop_departments').select('sop_id', { count: 'exact', head: true })
      .eq('department_id', (dept as { id: string }).id)
    expect((machines ?? 0) + (sops ?? 0)).toBeGreaterThan(0)
    expect(machines ?? 0).toBeGreaterThan(0)
  })
})

const STRIP = read('src', 'components', 'admin', 'site', 'DepartmentsStrip.tsx')
const WORKSPACE = read('src', 'components', 'admin', 'site', 'SiteWorkspace.tsx')
const EMPTY = read('src', 'components', 'admin', 'site', 'SiteEmptyState.tsx')

test.describe('PLC-05 strip', () => {
  test('one row per department with a dot, rename, eight colours and remove', () => {
    for (const id of ['dept-strip"', 'dept-strip-row', 'dept-strip-rename', 'dept-strip-colour', 'dept-strip-remove', 'dept-strip-refused', 'dept-strip-add-name', 'dept-strip-add"']) {
      expect(STRIP, id).toContain(`data-testid="${id.replace(/"$/, '')}"`)
    }
    expect(STRIP).toContain('data-dept-id={dept.id}')
    expect(STRIP).toContain('DEPT_COLOURS.map(')
  })

  test('no literal hex in the strip', () => {
    expect(STRIP.match(/#[0-9a-fA-F]{6}/g)).toBeNull()
  })

  test('each control is wired to a named handler that calls the action', () => {
    expect(STRIP).toMatch(/onClick=\{\(\) => void handleRemove\(\)\}/)
    expect(STRIP).toMatch(/onClick=\{\(\) => void pickColour\(colour\)\}/)
    expect(STRIP).toMatch(/onClick=\{\(\) => void handleAdd\(\)\}/)
    expect(STRIP).toMatch(/onBlur=\{\(\) => void commitRename\(\)\}/)
    expect(STRIP).toContain("if (e.key === 'Enter')")
    expect(STRIP).toMatch(/async function handleRemove[\s\S]*?archiveDepartment\(/)
    expect(STRIP).toMatch(/async function commitRename[\s\S]*?updateDepartment\(/)
    expect(STRIP).toMatch(/async function pickColour[\s\S]*?updateDepartment\(/)
    expect(STRIP).toMatch(/async function handleAdd[\s\S]*?createDepartment\(/)
  })

  test('a refusal shows both counts and every success calls onChanged', () => {
    expect(STRIP).toContain('result.machines')
    expect(STRIP).toContain('result.sops')
    expect((STRIP.match(/onChanged\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  test('the machine form can create a department in place', () => {
    expect(WORKSPACE).toContain('"__new"')
    expect(WORKSPACE).toContain('New department')
    expect(WORKSPACE).toContain('data-testid="site-machine-new-dept"')
    expect(WORKSPACE).toContain('data-testid="site-machine-new-dept-add"')
    expect(WORKSPACE).toMatch(/async function handleCreateDepartment[\s\S]*?createDepartment\([\s\S]*?handleDepartmentChange\(machineId, created\.id\)[\s\S]*?onDepartmentsChanged\?\.\(\)/)
    expect(WORKSPACE).toContain('createdDepartments')
  })

  test('the empty state hands control back through onDone', () => {
    expect(EMPTY).toContain('onDone?: () => void')
    expect((EMPTY.match(/if \(onDone\) onDone\(\)\s*\n\s*else router\.refresh\(\)/g) ?? []).length).toBe(2)
  })

  test.fixme('the old departments and site pages redirect to edit mode [57-07]', () => {})
})
