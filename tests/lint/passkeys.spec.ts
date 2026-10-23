/**
 * ADR-0027 -- no passkey call in server code except through the admin API, and the admin API only
 * in the one server action that checks against it. Browser files ('use client') run the ceremony.
 * Comments are stripped first, so a comment naming a call never trips the guard.
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

const BROWSER_CALL = /\b(registerPasskey|signInWithPasskey)\(|\bauth\.passkey\./
const ADMIN_CALL = /\bauth\.admin\.passkey\./
const ADMIN_HOME = 'src/actions/passkeys.ts'

test.describe('passkey calls stay where ADR-0027 puts them', () => {
  const files = walk(path.join(ROOT, 'src')).map((f) => ({
    rel: path.relative(ROOT, f).replace(/\\/g, '/'),
    src: strip(fs.readFileSync(f, 'utf8')),
  }))

  test('server files never run the browser passkey API', () => {
    const bad = files.filter((f) => !f.src.trimStart().startsWith("'use client'") && BROWSER_CALL.test(f.src)).map((f) => f.rel)
    expect(bad).toEqual([])
  })

  test('the admin passkey API is used only by recordPasskeyChange, never in the browser', () => {
    const users = files.filter((f) => ADMIN_CALL.test(f.src)).map((f) => f.rel)
    expect(users).toEqual([ADMIN_HOME])
  })

  test('is not vacuous', () => {
    expect(files.filter((f) => BROWSER_CALL.test(f.src)).length).toBeGreaterThanOrEqual(2)
  })
})
