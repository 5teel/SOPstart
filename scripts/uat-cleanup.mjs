import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await sb.from('sops').delete().eq('title', 'PHASE-12 UAT - DELETE ME').select('id')
if (error) console.error(error); else console.log(`Deleted ${data.length} test SOP(s)`)
