import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: d1 } = await sb.from('sops').delete().eq('title', 'PHASE-12 UAT - DELETE ME').select('id')
const { data: d2 } = await sb.from('sops').delete().eq('title', 'VIEWPORT-TEST - DELETE ME').select('id')
console.log(`Deleted ${(d1?.length||0) + (d2?.length||0)} test SOP(s)`)
