// Phase 66 D-07: give each persistent elevated eval fixture one TOTP factor and keep its secret in
// .env.local and the vault (~/.secrets/keys.env), so tests/evals/lib/session.ts can mint aal2.
// Run after node scripts/eval-fixtures.mjs:   node scripts/eval-mfa-fixtures.mjs
// Idempotent: a fixture with a verified factor and a stored secret is left alone. Only accounts with
// eval_fixture metadata are touched. Secrets are never printed.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { totp } from '../tests/evals/lib/totp.mjs'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const VAULT = path.join(os.homedir(), '.secrets', 'keys.env')

// Keep in step with TOTP_SECRET_ENV in tests/evals/lib/session.ts.
const FIXTURES = {
  'eval-admin@sopstart.com': 'EVAL_ADMIN_TOTP_SECRET',
  'eval-site-admin@sopstart.com': 'EVAL_SITE_ADMIN_TOTP_SECRET',
  'eval-site-safety@sopstart.com': 'EVAL_SITE_SAFETY_TOTP_SECRET',
  'eval-template-admin@sopstart.com': 'EVAL_TEMPLATE_ADMIN_TOTP_SECRET',
}

/** Replace or append NAME=value, BOM-less UTF-8, keeping the file's line endings. */
function putEnv(file, name, value) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^﻿/, '') : ''
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const i = lines.findIndex((l) => l.startsWith(`${name}=`))
  if (i >= 0) lines[i] = `${name}=${value}`
  else {
    if (lines.length && lines[lines.length - 1] === '') lines.pop()
    lines.push(`${name}=${value}`, '')
  }
  fs.writeFileSync(file, lines.join(eol), { encoding: 'utf8' })
}

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (listErr) throw listErr
for (const [email, envName] of Object.entries(FIXTURES)) {
  const user = list.users.find((u) => u.email === email)
  if (!user) { console.log(`${email}: no account yet (made by eval-fixtures.mjs or its eval) -- skipped`); continue }
  if (user.user_metadata?.eval_fixture !== true) throw new Error(`${email} is not an eval fixture -- refusing to touch its factors`)
  const { data: f, error } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  if (error) throw error
  const verified = f.factors.find((x) => x.factor_type === 'totp' && x.status === 'verified')
  if (verified && process.env[envName]) { console.log(`${email}: enrolled, secret stored (${envName})`); continue }
  for (const x of f.factors) await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: x.id })
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (le) throw le
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: ve } = await c.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (ve) throw ve
  const en = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Eval authenticator' })
  if (en.error) throw en.error
  const v = await c.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: totp(en.data.totp.secret) })
  if (v.error) throw v.error
  putEnv('.env.local', envName, en.data.totp.secret)
  putEnv(VAULT, envName, en.data.totp.secret)
  process.env[envName] = en.data.totp.secret
  console.log(`${email}: enrolled; secret written to .env.local and the vault as ${envName}`)
}
