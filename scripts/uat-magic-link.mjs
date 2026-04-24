import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'simonscott86@gmail.com',
  options: { redirectTo: 'http://localhost:4200/dashboard' }
})
if (error) { console.error(error); process.exit(1) }
console.log(data.properties.action_link)
