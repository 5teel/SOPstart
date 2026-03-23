import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import RoleAssignmentTable from '@/components/admin/RoleAssignmentTable'

export const metadata: Metadata = {
  title: 'Manage Team',
}

export default async function AdminTeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check user is admin
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch org details for invite code
  const { data: org } = await supabase
    .from('organisations')
    .select('id, invite_code')
    .eq('id', member.organisation_id)
    .single()

  if (!org) redirect('/dashboard')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-steel-100">Manage Team</h1>
        <Link
          href="/dashboard"
          className="text-sm text-steel-400 hover:text-brand-yellow transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
      <RoleAssignmentTable orgId={org.id} inviteCode={org.invite_code} />
    </div>
  )
}
