/**
 * Removes everything created by scripts/uat-seed-competency.mjs:
 *  - all evidence rows (completions, sign-offs, observations) for @uat-seed.test workers
 *  - their org memberships + department assignments + direct SOP grants
 *  - the UATSEED department (cascades sop_departments links)
 *  - the fake auth users themselves
 *
 * Run: node scripts/uat-seed-cleanup.mjs
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  // 1. Find all fake users by email domain
  const fakeUsers = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    fakeUsers.push(...data.users.filter(u => u.email?.endsWith('@uat-seed.test')))
    if (data.users.length < 1000) break
  }
  const ids = fakeUsers.map(u => u.id)
  console.log(`Fake users found: ${ids.length}`)

  if (ids.length > 0) {
    // 2. Evidence rows (append-only tables — service role bypasses RLS)
    const { data: comps } = await admin.from('sop_completions').select('id').in('worker_id', ids)
    const compIds = (comps ?? []).map(c => c.id)
    if (compIds.length) {
      await admin.from('completion_sign_offs').delete().in('completion_id', compIds)
      // completion_photos may reference completions — clear defensively
      await admin.from('completion_photos').delete().in('completion_id', compIds)
      const { error } = await admin.from('sop_completions').delete().in('id', ids.length ? compIds : [])
      if (error) throw error
    }
    await admin.from('sop_observations').delete().in('observed_worker_id', ids)

    // 3. Membership / assignment rows
    await admin.from('sop_access_people').delete().in('member_id', ids)
    await admin.from('member_departments').delete().in('member_id', ids)
    await admin.from('organisation_members').delete().in('user_id', ids)
    console.log(`Evidence + memberships removed (${compIds.length} completions)`)
  }

  // 4. The seed department (cascades member_departments/sop_departments FKs)
  const { data: depts } = await admin.from('departments').select('id, name').eq('code', 'UATSEED')
  for (const d of depts ?? []) {
    const { error } = await admin.from('departments').delete().eq('id', d.id)
    if (error) throw error
    console.log(`Deleted department: ${d.name}`)
  }

  // 5. Auth users last
  for (const u of fakeUsers) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) console.error(`Could not delete ${u.email}: ${error.message}`)
    else console.log(`Deleted user: ${u.email}`)
  }

  console.log('\nCleanup complete.')
}

main().catch(e => { console.error(e); process.exit(1) })
