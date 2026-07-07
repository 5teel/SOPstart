import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listDepartments } from '@/actions/departments'
import { VoiceDraftClient } from './VoiceDraftClient'

export const metadata: Metadata = {
  title: 'Talk through a SOP — SOPstart',
  description: 'Describe a procedure out loud and draft a structured SOP collaboratively.',
}

export default async function NewVoiceSopPage() {
  // Auth guard — mirrors /admin/sops/new/ai/page.tsx.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  const departments = await listDepartments()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Talk through a SOP</h1>
        <Link href="/admin/sops/new/ai" className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)] underline">
          Prefer typing?
        </Link>
      </div>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        Describe the procedure out loud. The assistant asks follow-up questions, builds a brief as
        you go, and drafts the SOP when you&apos;re ready.
      </p>
      <VoiceDraftClient departments={departments} />
    </div>
  )
}
