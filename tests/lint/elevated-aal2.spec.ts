/**
 * ADR-0028 -- every elevated role check goes through the one aal2 classifier.
 *
 * The app reads a caller's role only from getSessionContext(), which reports an admin or safety
 * manager without an aal2 session as a worker. So the guard is: nothing else derives the caller's
 * role (no claim reads, no getUser/getClaims outside the session module and the proxy), the
 * session module and the guards use needsSecondStep, and any later migration that writes a policy
 * naming an elevated role also names public.is_elevated(). Comments are stripped first.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const strip = (src: string) =>
  src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/^\s*--.*$/, ''))
    .join('\n')
const read = (rel: string) => strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walk(path.join(ROOT, 'src')).map((f) => ({
  rel: path.relative(ROOT, f).replace(/\\/g, '/'),
  src: strip(fs.readFileSync(f, 'utf8')),
}))
const server = files.filter((f) => !f.src.trimStart().startsWith("'use client'"))

test.describe('ADR-0028: elevated role checks go through the aal2 classifier', () => {
  test("getSessionContext reports an elevated member without aal2 as a worker", () => {
    const s = read('src/lib/auth/session-context.ts')
    expect(s).toMatch(/needsSecondStep\(memberRole, aal\)/)
    expect(s).toMatch(/role: secondStep \? 'worker' : memberRole/)
  })

  test('the guards refuse before the second step', () => {
    const g = read('src/lib/auth/guards.ts')
    const admin = g.slice(g.indexOf('export async function requireAdminContext'), g.indexOf('export type SopEditTarget'))
    expect(admin).toMatch(/if \(needsSecondStep\) return \{ error: "Confirm it's you", needsAal2: true \}/)
    const edit = g.slice(g.indexOf('export async function requireSopEditAccess'))
    expect(edit.indexOf('if (needsSecondStep)')).toBeGreaterThan(-1)
    expect(edit.indexOf('if (needsSecondStep)')).toBeLessThan(edit.indexOf('createAdminClient()'))
  })

  test('the user_role claim is read only by the proxy and the login redirect, each next to needsSecondStep', () => {
    const readers = server.filter((f) => !f.rel.startsWith('src/types/') && /user_role/.test(f.src)).map((f) => f.rel).sort()
    expect(readers).toEqual(['src/actions/auth.ts', 'src/lib/supabase/middleware.ts'])
    for (const rel of readers) expect(read(rel)).toMatch(/needsSecondStep\(/)
  })

  test('no server file verifies the session itself except the session module and the proxy', () => {
    const bad = server
      .filter((f) => /\bauth\.(getUser|getClaims)\(/.test(f.src))
      .map((f) => f.rel)
      .filter((r) => r !== 'src/lib/auth/session-context.ts' && r !== 'src/lib/supabase/middleware.ts')
    expect(bad).toEqual([])
  })

  test('the admin MFA API is used only in src/actions/mfa.ts', () => {
    expect(files.filter((f) => /\bauth\.admin\.mfa\./.test(f.src)).map((f) => f.rel)).toEqual(['src/actions/mfa.ts'])
  })

  test('the proxy sends /admin to /verify before the second step', () => {
    const m = read('src/lib/supabase/middleware.ts')
    expect(m).toMatch(/if \(secondStep && path\.startsWith\('\/admin'\)\)/)
    expect(m).toMatch(/verifyHref\(path \+ request\.nextUrl\.search\)/)
  })

  test('a migration after 00087 that writes a policy naming an elevated role also uses is_elevated()', () => {
    const dir = path.join(ROOT, 'supabase/migrations')
    const later = fs.readdirSync(dir).filter((f) => /^\d{5}_/.test(f) && Number(f.slice(0, 5)) > 87)
    for (const f of later) {
      const s = strip(fs.readFileSync(path.join(dir, f), 'utf8'))
      for (const stmt of s.split(';')) {
        if (!/\b(create|alter)\s+policy\b/i.test(stmt)) continue
        if (/\bfor\s+select\b/i.test(stmt)) continue
        if (/'admin'|'safety_manager'|om\.role/.test(stmt)) expect(stmt, `${f}: ${stmt.slice(0, 120)}`).toMatch(/is_elevated\(\)/)
      }
    }
  })
})
