/**
 * ADR-0002 guard: the app has no scheduled jobs.
 *
 * Work runs on the event that causes it or on the read that needs it, never on a
 * timer. This fails if any of the usual doors for a scheduled job reappears:
 *   1. a route under src/app/api whose path names a cron job or a sweep,
 *   2. the session proxy naming a cron exemption (a header-authenticated background route),
 *   3. any file under src reading the shared secret those routes used,
 *   4. a cron or schedule key in the hosting config (vercel.json, railway.json, railway.toml).
 *
 * The scans include comments on purpose, so this file and the code it guards
 * describe the banned things in words rather than quoting them (CLAUDE.md 2026-09-28).
 *
 * Registration: playwright.config.ts `phase15-stubs` project testMatch alternation.
 * Verify: `npx playwright test --list --project=phase15-stubs | grep no-scheduled-jobs`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SECRET = ['CRON', 'SECRET'].join('_')

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    out.push(p)
    if (e.isDirectory()) walk(p, out)
  }
  return out
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/')

test.describe('No scheduled jobs (ADR-0002)', () => {
  test('no path under src/app/api names a cron job or a sweep', () => {
    const hits = walk(path.join(ROOT, 'src', 'app', 'api')).filter((p) => /cron|sweep/i.test(rel(p).slice('src/app/api'.length)))
    expect(hits.map(rel)).toEqual([])
  })

  test('the session proxy names no cron exemption', () => {
    const proxy = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'supabase', 'middleware.ts'), 'utf-8')
    expect(proxy).not.toMatch(/cron/i)
  })

  test('no source file reads the shared cron secret', () => {
    const hits = walk(path.join(ROOT, 'src'))
      .filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p) && fs.statSync(p).isFile())
      .filter((p) => fs.readFileSync(p, 'utf-8').includes(SECRET))
    expect(hits.map(rel)).toEqual([])
  })

  test('hosting config declares no cron or schedule', () => {
    const found: string[] = []
    const keyOf = (k: string) => /^(crons?|cronSchedule|schedules?)$/i.test(k)
    const scan = (value: unknown, where: string) => {
      if (!value || typeof value !== 'object') return
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (keyOf(k)) found.push(`${where}: ${k}`)
        scan(v, where)
      }
    }
    for (const name of ['vercel.json', 'railway.json']) {
      const file = path.join(ROOT, name)
      if (fs.existsSync(file)) scan(JSON.parse(fs.readFileSync(file, 'utf-8')), name)
    }
    const toml = path.join(ROOT, 'railway.toml')
    if (fs.existsSync(toml)) {
      for (const line of fs.readFileSync(toml, 'utf-8').split(/\r?\n/)) {
        const m = /^\s*\[?([A-Za-z_.]+)\]?\s*(=|$)/.exec(line)
        if (m && m[1].split('.').some(keyOf)) found.push(`railway.toml: ${line.trim()}`)
      }
    }
    expect(found).toEqual([])
  })
})
