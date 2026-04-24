import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await sb.from('section_kinds').select('*').limit(20)
if (error) { console.error(error); process.exit(1) }
console.log(`section_kinds count: ${data.length}`)
console.log(JSON.stringify(data.slice(0,3), null, 2))

// Simulate RLS by using an anon key with JWT for the admin user
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const sbAnon = createClient(url, anonKey)

// Get a session for this admin via impersonation
const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'simonscott86@gmail.com'
})
if (linkErr) { console.error(linkErr); process.exit(1) }
// extract access token from action link by calling verify endpoint not needed — use a different path
