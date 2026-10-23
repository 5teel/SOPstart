/**
 * Phase 65 -- passkeys (ADR-0027). Source contract and ledger kinds.
 * Registration: playwright.config.ts `phase65`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { DECISION_KINDS } from '@/lib/decisions/shape'
import { KIND_GROUPS, KIND_WORDS } from '@/lib/decisions/read'
import { passkeyErrorWords } from '@/lib/auth/passkey-words'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')

test.describe('passkeys source contract (ADR-0027)', () => {
  test('supabase-js is pinned exactly, at a version with passkeys', () => {
    const v = JSON.parse(read('package.json')).dependencies['@supabase/supabase-js'] as string
    expect(v).toMatch(/^\d+\.\d+\.\d+$/)
    const [major, minor] = v.split('.').map(Number)
    expect(major === 2 ? minor >= 105 : major > 2).toBe(true)
  })

  test('the ignored experimental passkey flag is not set anywhere', () => {
    expect(code('src/lib/supabase/client.ts')).not.toMatch(/experimental/)
  })

  test('recordPasskeyChange checks the admin list for the session user before it logs', () => {
    const src = code('src/actions/passkeys.ts')
    expect(src.startsWith("'use server'")).toBe(true)
    expect(src).toMatch(/import\s*\{\s*recordDecision\s*\}\s*from\s*'@\/lib\/decisions\/record'/)
    expect(src).toMatch(/auth\.admin\.passkey\.listPasskeys\(\{\s*userId\s*\}\)/)
    // the user id is the session's, never a parameter
    expect(src).toMatch(/const \{ userId \} = await getSessionContext\(\)/)
    expect(src).toMatch(/z\.object\(\{\s*kind: z\.enum\(\['added', 'removed'\]\),\s*passkeyId: z\.string\(\)\.uuid\(\),\s*\}\)/)
    expect(src).not.toMatch(/organisation/i)
    const body = src.slice(src.indexOf('export async function recordPasskeyChange'))
    const check = body.indexOf('passkeysOf(userId)')
    const del = body.indexOf('auth.admin.passkey.deletePasskey({ userId, passkeyId })')
    const rec = body.indexOf('await recordDecision(')
    expect(check).toBeGreaterThan(-1)
    expect(del).toBeGreaterThan(check)
    expect(rec).toBeGreaterThan(del)
    expect(body).toContain("kind === 'added' ? 'passkey_added' : 'passkey_removed'")
    expect(body).toContain("subject: { kind: 'passkey', id: passkeyId }")
  })

  test('Profile shows the Passkeys section and login the passkey button', () => {
    expect(code('src/app/(protected)/profile/page.tsx')).toContain('<PasskeysSection />')
    expect(code('src/app/(auth)/login/page.tsx')).toMatch(/<PasskeySignIn next=\{next\} \/>\s*<LoginForm/)
  })

  test('the login button lets the proxy redirect and reads WebAuthn support only after mount', () => {
    const src = code('src/components/auth/PasskeySignIn.tsx')
    expect(src).not.toMatch(/router\.(replace|push)|useRouter/)
    expect(src).toContain("window.location.assign(next ? `/login?next=${encodeURIComponent(next)}` : '/login')")
    expect(src).toContain('useState(false)')
    expect(src).toContain('useEffect(() => setSupported(browserHasPasskeys()), [])')
    const section = code('src/components/profile/PasskeysSection.tsx')
    expect(section).toContain('useState<boolean | null>(null)')
    expect(section).toMatch(/useEffect\(\(\) => \{\s*setSupported\(browserHasPasskeys\(\)\)/)
  })

  test('config.toml mirrors the live passkey settings', () => {
    const toml = read('supabase/config.toml')
    expect(toml).toMatch(/\[auth\.passkey\]\nenabled = true/)
    expect(toml).toMatch(/\[auth\.webauthn\]\nrp_id = "sopstart\.com"\nrp_display_name = "SOPstart"\nrp_origins = \["https:\/\/sopstart\.com"\]/)
  })

  test('errors are plain sentences', () => {
    expect(passkeyErrorWords({ code: 'ERROR_CEREMONY_ABORTED' }, 'add')).toBe('Cancelled. Nothing was added.')
    expect(passkeyErrorWords({ name: 'NotAllowedError' }, 'sign-in')).toBe('Cancelled. Try again, or use your password.')
    expect(passkeyErrorWords({ code: 'too_many_passkeys' }, 'add')).toBe('You have as many passkeys as allowed. Remove one first.')
    expect(passkeyErrorWords({ code: 'passkey_disabled' }, 'sign-in')).toBe('Passkeys are switched off right now. Use your password.')
    expect(passkeyErrorWords({ code: 'webauthn_whatever' }, 'sign-in')).toBe(
      "That passkey didn't sign you in. Use your password, or try another passkey.",
    )
    expect(passkeyErrorWords(null, 'add')).toBe("The passkey wasn't added. Try again.")
  })
})

test.describe('passkey ledger kinds (00085)', () => {
  test('both kinds are registered, worded and grouped', () => {
    for (const k of ['passkey_added', 'passkey_removed'] as const) {
      expect(DECISION_KINDS).toContain(k)
      expect(KIND_GROUPS.setup).toContain(k)
    }
    expect(KIND_WORDS.passkey_added).toBe('Added a passkey')
    expect(KIND_WORDS.passkey_removed).toBe('Removed a passkey')
  })

  test('00085 recreates the kind check with every kind and adds nothing else', () => {
    const sql = code('supabase/migrations/00085_passkey_ledger_kinds.sql')
    expect(sql).toMatch(/alter table public\.decisions drop constraint if exists decisions_kind_check;/)
    const m = sql.match(/check\s*\(\s*kind\s+in\s*\(([^)]*)\)/i)
    expect(m).not.toBeNull()
    const kinds = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    // 00086 (Phase 66) widened the list again with the five MFA kinds.
    const at85 = DECISION_KINDS.filter((k) => !/^(mfa_|recovery_code)/.test(k))
    expect(new Set(kinds)).toEqual(new Set(at85))
    expect(kinds.length).toBe(at85.length)
    expect(sql).not.toMatch(/\b(policy|create table|create function|grant)\b/i)
  })
})
