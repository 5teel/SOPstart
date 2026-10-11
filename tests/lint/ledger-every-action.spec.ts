/**
 * ADR-0008 -- every action a person takes is written to the decision ledger.
 * A server action export or API route handler whose body writes (insert / update / upsert /
 * delete / rpc) must call recordDecision(), unless it is on EXCLUDED with its reason.
 * ponytail: a write made only through a helper in another module is not seen; widen the
 * write markers if that pattern spreads.
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

/** file:function -> why it is not a decision. */
const EXCLUDED: Record<string, string> = {
  'walk.ts:recordWalkStep': 'progress through a SOP before it is sent; the sent completion is logged',
  'walk.ts:startOverWalk': 'progress through a SOP before it is sent',
  'versioning.ts:markNotificationRead': 'marking a notification read',
  'versioning.ts:notifyAssignedWorkers': 'part of the new version, which uploadNewVersion logs',
  'uat.ts:saveFeedback': 'feedback about the app, not the site',
  'auth.ts:joinWithInviteCode': 'joining a site: the cached session has no organisation for it yet, so the ledger would write to the wrong one',
  'auth.ts:acceptInvite': 'accepting an invite: no session organisation yet; the admin\'s invite is the logged decision',
  'completions.ts:submitCompletion': 'logged as sign_off through recordSignature, a helper in the same file',
  'grants.ts:ensureSopCollections': 'derived companion rows for a SOP, recomputed on read, not a decision',
}

const WRITE = /\.(insert|update|upsert|delete)\(|\.rpc\(/

function exportsOf(src: string, re: RegExp): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const starts = [...src.matchAll(re)]
  starts.forEach((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index! : src.length
    out.push({ name: m[1], body: src.slice(m.index!, end) })
  })
  return out
}

test.describe('Every action is logged (ADR-0008)', () => {
  test('every writing server action calls recordDecision or is excluded with a reason', () => {
    const dir = path.join(ROOT, 'src/actions')
    const missing: string[] = []
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = strip(fs.readFileSync(path.join(dir, file), 'utf8'))
      for (const { name, body } of exportsOf(src, /^export async function (\w+)/gm)) {
        if (!WRITE.test(body) || body.includes('recordDecision(') || EXCLUDED[`${file}:${name}`]) continue
        missing.push(`${file}:${name}`)
      }
    }
    expect(missing).toEqual([])
  })

  test('every writing API route handler calls recordDecision', () => {
    const missing: string[] = []
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name === 'route.ts') {
          const src = strip(fs.readFileSync(p, 'utf8'))
          for (const { name, body } of exportsOf(src, /^export async function (POST|PATCH|PUT|DELETE)\b/gm)) {
            const rel = path.relative(ROOT, p).replace(/\\/g, '/')
            if (WRITE.test(body) && !body.includes('recordDecision(') && !EXCLUDED_ROUTES[rel]) missing.push(`${rel}:${name}`)
          }
        }
      }
    }
    walk(path.join(ROOT, 'src/app/api'))
    expect(missing).toEqual([])
  })

  test('the exclusions are the ones ADR-0008 names', () => {
    const adr = fs.readFileSync(path.join(ROOT, 'docs/adr/0008-ledger-every-action.md'), 'utf8')
    for (const words of ['pure reads', 'upload URL', 'notification read', 'UAT feedback']) expect(adr).toContain(words)
  })
})

/** route path -> why its writes are not a person's decision. */
const EXCLUDED_ROUTES: Record<string, string> = {
  'src/app/api/sops/parse/route.ts': 'the parse pipeline; the create or re-parse that started it is logged',
  'src/app/api/sops/transcribe/route.ts': 'the parse pipeline; the create or re-parse that started it is logged',
  'src/app/api/sops/restructure/route.ts': 'the parse pipeline; restructureSop, which starts it, is logged',
}
