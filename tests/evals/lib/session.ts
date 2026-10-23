/**
 * Deployed-site eval session helper.
 *
 * Mints a real Supabase session for a fixture account (admin API magic link →
 * verifyOtp, the same path tests/phase46 uses) and encodes it exactly the way
 * @supabase/ssr 0.6 reads it back from the browser: cookie name
 * `sb-<projectRef>-auth-token`, value `base64-` + base64url(JSON session),
 * split into `.0`, `.1`… chunks above MAX_CHUNK_SIZE.
 *
 * Fixture accounts are created by `node scripts/eval-fixtures.mjs`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BrowserContext } from '@playwright/test'
import fs from 'node:fs'
import { totp } from './totp.mjs'

for (const l of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

export const EVAL_BASE_URL = process.env.EVAL_BASE_URL ?? ''
// siteAdmin (Phase 51 / 51-07): admin of its OWN org "SOPstart Eval Site" —
// the site-editor eval resets the org's site before every run, which would
// delete Simon's real site map if it ran in the shared SOPstart eval org.
export const EVAL_USERS = {
  admin: 'eval-admin@sopstart.com',
  worker: 'eval-worker@sopstart.com',
  siteAdmin: 'eval-site-admin@sopstart.com',
  // Phase 52: worker member of the eval-site org (never the real SOPstart
  // org), so a plant-home eval can see a pin without risking Simon's data.
  siteWorker: 'eval-site-worker@sopstart.com',
  // Phase 57 D-06: supervisor member of the eval-site org (never the real
  // org), so the supervisor Office card can be proved on the deployed site.
  siteSupervisor: 'eval-site-supervisor@sopstart.com',
  // Phase 59: supervisor with no assigned worker and no owned SOP -- its Office
  // inbox is empty by construction, so a sibling eval cannot fill it.
  siteSupervisorIdle: 'eval-site-supervisor-idle@sopstart.com',
  // Phase 60: safety manager member of the eval-site org -- the second approver of a two-step chain.
  siteSafety: 'eval-site-safety@sopstart.com',
  // ADR-0003: sole admin of a throwaway org the site-templates eval recreates every run.
  templateAdmin: 'eval-template-admin@sopstart.com',
} as const
// Phase 59: a worker nobody supervises. No session is minted for it; the eval only seeds rows for it.
export const EVAL_SITE_WORKER2_EMAIL = 'eval-site-worker2@sopstart.com'
export type EvalRole = keyof typeof EVAL_USERS
export const EVAL_SITE_ORG_NAME = 'SOPstart Eval Site'
export const EVAL_SITE_SOP_TITLE = 'Eval site fixture SOP'
export const EVAL_SITE_DEPARTMENT = 'Forming'
export const EVAL_PLANT_SOP_TITLE = 'Eval plant fixture SOP'
export const EVAL_PLANT_MACHINE = 'EVAL Press'
// Phase 55: dedicated walk fixture (published, unassigned, on no machine; step 2 needs a photo).
export const EVAL_WALK_SOP_TITLE = 'Eval walk fixture SOP'
// Phase 56: the converter's known-answer fixture (published, unassigned, on no machine).
export const EVAL_CONVERT_SOP_TITLE = 'Eval convert fixture SOP'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const PROJECT_REF = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ''
const MAX_CHUNK_SIZE = 3180 // @supabase/ssr utils/chunker.js

export const EVAL_ENV_READY = !!(EVAL_BASE_URL && SUPABASE_URL && SERVICE_KEY && ANON_KEY)

// Phase 66 (ADR-0028): an admin or safety manager needs an aal2 session for any admin screen or
// write, so the helper proves the second step for them. The persistent elevated fixtures keep one
// TOTP factor whose secret sits in .env.local and the vault (scripts/eval-mfa-fixtures.mjs enrols
// them); deleting a factor revokes the account's other sessions, so they are never re-enrolled here.
// A throwaway elevated account an eval made has no factor yet: it is enrolled on first sign-in and
// its secret kept for the run.
const TOTP_SECRET_ENV: Record<string, string> = {
  'eval-admin@sopstart.com': 'EVAL_ADMIN_TOTP_SECRET',
  'eval-site-admin@sopstart.com': 'EVAL_SITE_ADMIN_TOTP_SECRET',
  'eval-site-safety@sopstart.com': 'EVAL_SITE_SAFETY_TOTP_SECRET',
  'eval-template-admin@sopstart.com': 'EVAL_TEMPLATE_ADMIN_TOTP_SECRET',
}
const runSecrets = new Map<string, string>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

async function stepUp(admin: Client, anon: Client, email: string, userId: string) {
  const { data: rows } = await admin
    .from('organisation_members')
    .select('role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['admin', 'safety_manager'])
  if (!rows?.length) return null
  const { data: listed, error } = await admin.auth.admin.mfa.listFactors({ userId })
  if (error) throw new Error(`listFactors failed for ${email}: ${error.message}`)
  let factorId = listed.factors.find((f) => f.factor_type === 'totp' && f.status === 'verified')?.id
  let secret = runSecrets.get(email) ?? (TOTP_SECRET_ENV[email] ? process.env[TOTP_SECRET_ENV[email]] : undefined)
  if (!factorId) {
    const en = await anon.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Eval authenticator' })
    if (en.error) throw new Error(`TOTP enrol failed for ${email}: ${en.error.message}`)
    factorId = en.data.id
    secret = en.data.totp.secret
    runSecrets.set(email, secret)
  } else if (!secret) {
    throw new Error(`${email} has a TOTP factor but no secret in .env.local -- run node scripts/eval-mfa-fixtures.mjs`)
  }
  const v = await anon.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
  if (v.error) throw new Error(`TOTP verify failed for ${email}: ${v.error.message}`)
  const { data } = await anon.auth.getSession()
  const aal = data.session && JSON.parse(Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString()).aal
  if (aal !== 'aal2') throw new Error(`no aal2 session for ${email}`)
  return data.session!
}

async function mintSession(email: string, opts: { aal1?: boolean } = {}) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed for ${email}: ${error?.message}`)
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed for ${email}: ${ve?.message}`)
  if (opts.aal1) return vd.session
  return (await stepUp(admin, anon, email, vd.session.user.id)) ?? vd.session
}

function base64url(s: string) {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Install an authenticated session for `role` into a Playwright context. */
export async function signInAs(context: BrowserContext, role: EvalRole, opts: { aal1?: boolean } = {}) {
  return signInAsEmail(context, EVAL_USERS[role], opts)
}

/** Same, for a throwaway account an eval created itself. `aal1` skips the second step (Phase 66). */
export async function signInAsEmail(context: BrowserContext, email: string, opts: { aal1?: boolean } = {}) {
  const session = await mintSession(email, opts)
  const value = 'base64-' + base64url(JSON.stringify(session))
  const name = `sb-${PROJECT_REF}-auth-token`
  const host = new URL(EVAL_BASE_URL).hostname
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += MAX_CHUNK_SIZE) chunks.push(value.slice(i, i + MAX_CHUNK_SIZE))
  const cookies = chunks.map((v, i) => ({
    name: chunks.length === 1 ? name : `${name}.${i}`,
    value: v,
    domain: host,
    path: '/',
    httpOnly: false,
    secure: EVAL_BASE_URL.startsWith('https'),
    sameSite: 'Lax' as const,
  }))
  await context.addCookies(cookies)
  return session
}
