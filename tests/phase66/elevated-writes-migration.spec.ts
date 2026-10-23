/**
 * Phase 66 / ADR-0028 -- migration 00087 moves every elevated write arm onto public.is_elevated().
 * Source checks; the live sweep and the aal1/aal2 probe are in scripts/apply-phase66-migration.mjs.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/00087_elevated_writes_need_aal2.sql'), 'utf8').replace(/\r\n/g, '\n')
const statements = sql
  .split('\n')
  .filter((l) => !l.startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)

test.describe('00087 elevated writes need aal2', () => {
  test('every altered policy names public.is_elevated() and no elevated arm survives on the plain role', () => {
    const altered = statements.filter((s) => s.startsWith('alter policy'))
    expect(altered.length).toBe(48)
    for (const s of altered) {
      expect(s, s.slice(0, 80)).toContain('public.is_elevated()')
      const withoutExclusion = s.replace(/NOT COALESCE\(\(current_user_role\(\) = ANY \(ARRAY\['admin'::app_role, 'safety_manager'::app_role\]\)\), false\)/g, '')
      expect(withoutExclusion, s.slice(0, 80)).not.toMatch(/current_user_role\(\) = ANY \(ARRAY\['admin'::app_role, 'safety_manager'::app_role\]\)/)
      expect(s).not.toMatch(/om\.role/)
    }
  })

  test('each ALL policy keeps a SELECT twin with its old predicate, so reads stay at aal1', () => {
    const twins = statements.filter((s) => s.startsWith('create policy'))
    expect(twins.length).toBe(10)
    for (const s of twins) {
      expect(s).toMatch(/for select to authenticated/)
      expect(s).not.toContain('is_elevated')
    }
  })

  test('the approver arm keeps working at aal1 only for non-elevated approvers', () => {
    const arms = sql.match(/is_sop_sign_off_approver\([a-z_.]+\) AND NOT COALESCE/g) ?? []
    expect(arms.length).toBe(5)
  })

  test('the rollback restores every policy it altered and drops the twins', () => {
    const back = fs.readFileSync(path.join(process.cwd(), 'scripts/apply-phase66-rollback.sql'), 'utf8')
    expect((back.match(/^alter policy/gm) ?? []).length).toBe(48)
    expect((back.match(/^drop policy if exists/gm) ?? []).length).toBe(10)
    expect(back).not.toContain('is_elevated')
  })
})
