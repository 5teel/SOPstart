/**
 * Phase 55 / Plan 55-01 -- ORG-01 one organisation.
 *
 * LIVE now: the two preconditions the cut relies on.
 *   D-06  nothing in src/ signs a user up from the browser, so turning off
 *         public sign-up at the auth provider cannot break a product path.
 *   D-02  the invitation channel exists (email invite, accept, join by code),
 *         so removing organisation creation leaves a way in.
 * LIVE (55-12): organisation creation and switching are gone, and
 * /sign-up is a static "ask your admin" page.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}
function code(rel: string): string {
  return read(rel)
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('ORG-01 preconditions (live)', () => {
  test('D-06: nobody signs up from the browser', () => {
    const offenders: string[] = []
    for (const f of walk(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, f)
      code(rel).split('\n').forEach((line, i) => {
        if (/auth\.signUp\(/.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`)
      })
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test('D-02: the invitation channel exists', () => {
    const auth = code('src/actions/auth.ts')
    for (const needle of [
      'export async function inviteWorker',
      'inviteUserByEmail(',
      'export async function acceptInvite',
      "type: 'invite'",
      'export async function joinWithInviteCode',
    ]) {
      expect(auth, needle).toContain(needle)
    }
    expect(exists('src/app/(auth)/join/page.tsx')).toBe(true)
    expect(exists('src/app/(auth)/invite/accept')).toBe(true)
  })
})

test.describe('organisation creation and switching are gone (55-12)', () => {
  test('actions, schema and components are removed', () => {
    const auth = code('src/actions/auth.ts')
    for (const gone of ['signUpOrganisation', 'switchOrganisation', 'getUserMemberships', 'UserMembership']) {
      expect(auth, gone).not.toContain(gone)
    }
    const validators = code('src/lib/validators/auth.ts')
    expect(validators).not.toContain('orgSignUpSchema')
    expect(validators).not.toContain('OrgSignUpInput')
    expect(exists('src/components/auth/OrgSignUpForm.tsx')).toBe(false)
    expect(exists('src/components/profile/OrgSwitcher.tsx')).toBe(false)
    expect(code('src/app/(protected)/profile/page.tsx')).not.toContain('OrgSwitcher')
  })
})

test.describe('/sign-up says ask your admin (55-12)', () => {
  test('the page is static text with no form', () => {
    const src = code('src/app/(auth)/sign-up/page.tsx')
    expect(src).not.toContain("'use client'")
    expect(src).not.toContain('<form')
    expect(src).not.toContain('<input')
    expect(src).not.toMatch(/from ['"]@\/actions/)
    expect(src).toContain('SOPstart is by invitation')
    expect(src).toContain('Ask your admin')
  })
})

test.describe('no register links (55-12)', () => {
  test('login, landing and join point nobody at sign-up', () => {
    for (const f of ['src/components/auth/LoginForm.tsx', 'src/app/page.tsx', 'src/components/auth/JoinByCodeForm.tsx']) {
      const src = code(f)
      expect(src, `${f} links /sign-up`).not.toContain('/sign-up')
      expect(src, `${f} says Register`).not.toContain('Register')
    }
    expect(code('src/app/(auth)/login/page.tsx')).not.toContain('registered')
  })
})
