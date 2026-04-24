import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ORG = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea'
const USER = '177c3f6b-fa27-477b-9046-7ce84228855e'
const { data: sop } = await sb.from('sops').insert({ title: 'VIEWPORT-TEST - DELETE ME', sop_number: 'VP-1', organisation_id: ORG, source_type: 'blank', status: 'draft', uploaded_by: USER, source_file_name: 'x', source_file_type: 'docx', source_file_path: '' }).select('id').single()
const { data: kinds } = await sb.from('section_kinds').select('id, slug, display_name').in('slug', ['hazards','ppe','steps','emergency','signoff'])
const rows = kinds.map((k, i) => ({ sop_id: sop.id, section_kind_id: k.id, section_type: k.slug, title: k.display_name, sort_order: i }))
await sb.from('sop_sections').insert(rows)
console.log('sopId:', sop.id)
