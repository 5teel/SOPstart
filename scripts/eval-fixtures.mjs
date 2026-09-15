// Idempotently ensures the two deployed-site eval accounts exist in the SOPstart org.
// Run: node scripts/eval-fixtures.mjs   (reads .env.local; safe to re-run)
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
export const EVAL_ORG_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea' // "SOPstart" (ex-Potenco), see memory project_prod_org_merge
export const EVAL_USERS = { admin: 'eval-admin@sopstart.com', worker: 'eval-worker@sopstart.com' }
const { data: list } = await sb.auth.admin.listUsers({ perPage: 500 })
for (const [role, email] of Object.entries(EVAL_USERS)) {
  let user = list.users.find(u => u.email === email)
  // CR-01 (41-REVIEW): never touch a real account that happens to own this email —
  // only an account this script created (eval_fixture metadata) may be (re)granted a role.
  if (user && user.user_metadata?.eval_fixture !== true) throw new Error(`${email} exists but is not an eval fixture — refusing to change its membership`)
  if (!user) { const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { eval_fixture: true } }); if (error) throw error; user = data.user; console.log('created', email) }
  const { error } = await sb.from('organisation_members').upsert({ organisation_id: EVAL_ORG_ID, user_id: user.id, role }, { onConflict: 'organisation_id,user_id' })
  if (error) throw error
  console.log(`${email} → ${role} of SOPstart (${user.id})`)
}
