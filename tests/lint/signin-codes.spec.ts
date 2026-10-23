/**
 * ADR-0029 -- sign-in codes are touched only by the two actions, through the service role.
 * signin_codes has no policies, so a session client would read nothing; this keeps every use in
 * the two audited places and keeps the code module (node:crypto, the hash) out of client files.
 * Comments are stripped first.
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
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = walk(path.join(ROOT, 'src'))
  .map((f) => ({ rel: path.relative(ROOT, f).replace(/\\/g, '/'), src: strip(fs.readFileSync(f, 'utf8')) }))
  .filter((f) => !f.rel.startsWith('src/types/'))

test.describe('ADR-0029: sign-in codes stay in two actions', () => {
  test('signin_codes and signin_code_try appear only in members.ts and auth.ts', () => {
    const users = files.filter((f) => /signin_codes|signin_code_try/.test(f.src)).map((f) => f.rel).sort()
    expect(users).toEqual(['src/actions/auth.ts', 'src/actions/members.ts'])
  })

  test('each use goes through the service-role client, never the session client', () => {
    for (const rel of ['src/actions/auth.ts', 'src/actions/members.ts']) {
      const src = files.find((f) => f.rel === rel)!.src
      const uses = src.match(/\.(?:from\('signin_codes'\)|rpc\('signin_code_try')/g) ?? []
      const viaService = src.match(/(?:svc\(\)|\(admin as any\))\s*\.(?:from\('signin_codes'\)|rpc\('signin_code_try')/g) ?? []
      expect(uses.length, rel).toBeGreaterThan(0)
      expect(viaService.length, rel).toBe(uses.length)
    }
  })

  test('no client file imports the code module', () => {
    const bad = files
      .filter((f) => f.src.trimStart().startsWith("'use client'") && f.src.includes('@/lib/members/signin-code'))
      .map((f) => f.rel)
    expect(bad).toEqual([])
  })
})
