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
import { createClient } from '@supabase/supabase-js'
import type { BrowserContext } from '@playwright/test'
import fs from 'node:fs'

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
} as const
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

async function mintSession(email: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) throw new Error(`generateLink failed for ${email}: ${error?.message}`)
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vd, error: ve } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (ve || !vd.session) throw new Error(`verifyOtp failed for ${email}: ${ve?.message}`)
  return vd.session
}

function base64url(s: string) {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Install an authenticated session for `role` into a Playwright context. */
export async function signInAs(context: BrowserContext, role: EvalRole) {
  const session = await mintSession(EVAL_USERS[role])
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
