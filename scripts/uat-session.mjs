#!/usr/bin/env node
// Issue a Supabase session for the local UAT session cookie.
// Usage: node scripts/uat-session.mjs <email>
// Outputs JSON with the cookie name + value to install on http://localhost:4200.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Tiny .env.local loader (avoid dotenv dep).
try {
  const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch {}

const email = process.argv[2] ?? 'simonscott86@gmail.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? SERVICE_KEY
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
})
if (error) {
  console.error('generateLink failed:', error.message)
  process.exit(1)
}

const tokenHash = data.properties.hashed_token
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: vd, error: ve } = await anon.auth.verifyOtp({
  token_hash: tokenHash,
  type: 'magiclink',
})
if (ve || !vd.session) {
  console.error('verifyOtp failed:', ve)
  process.exit(1)
}

const expires_in =
  vd.session.expires_at && vd.session.expires_at > Math.floor(Date.now() / 1000)
    ? vd.session.expires_at - Math.floor(Date.now() / 1000)
    : 3600
const session = {
  access_token: vd.session.access_token,
  refresh_token: vd.session.refresh_token,
  expires_in,
  expires_at: vd.session.expires_at ?? Math.floor(Date.now() / 1000) + expires_in,
  token_type: 'bearer',
  user: null,
}

const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64')
const cookieName = `sb-${projectRef}-auth-token`

console.log(JSON.stringify({ cookieName, cookieValue, projectRef, email, userId: data.user?.id ?? null }))
