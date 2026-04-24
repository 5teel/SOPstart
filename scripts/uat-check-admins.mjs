import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: members, error } = await sb
  .from('organisation_members')
  .select('user_id, role, organisation_id')
  .in('role', ['admin', 'safety_manager'])
  .limit(10)

if (error) { console.error('members error:', error); process.exit(1) }
console.log('Members:', JSON.stringify(members, null, 2))

const { data: users } = await sb.auth.admin.listUsers()
const relevant = (users?.users || [])
  .filter((u) => members?.some((m) => m.user_id === u.id))
  .map((u) => ({ id: u.id, email: u.email, confirmed: !!u.email_confirmed_at }))
console.log('Users:', JSON.stringify(relevant, null, 2))
