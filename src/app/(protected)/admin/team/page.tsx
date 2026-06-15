import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import RoleAssignmentTable from '@/components/admin/RoleAssignmentTable'
import { listDepartments } from '@/actions/departments'

export const metadata: Metadata = {
  title: 'Manage Team',
}

/**
 * Phase 15 / Wave 4 — Manage Team page.
 *
 * Phase 25 extension: fetches departments + passes them to RoleAssignmentTable so the
 * Departments column (member-mode DepartmentPicker + DChip + owner badge) is rendered.
 * The sub-trade section below RoleAssignmentTable is retained for backward-compat.
 */
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

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Fetch org details for invite code
  const { data: org } = await supabase
    .from('organisations')
    .select('id, invite_code')
    .eq('id', member.organisation_id)
    .single()

  if (!org) redirect('/dashboard')

  // Phase 25: fetch departments for the department filter + Departments column
  const departments = await listDepartments()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Sub-nav: SOPs | Library | Team | Departments */}
      <nav className="flex gap-[18px] border-b mb-6" style={{ borderColor: 'var(--ink-100)', marginBottom: '22px' }}>
        <Link
          href="/admin/sops"
          className="pb-[11px] font-medium text-[13px] border-b-2 border-transparent"
          style={{ color: 'var(--ink-500)' }}
        >
          SOPs
        </Link>
        <Link
          href="/admin/blocks"
          className="pb-[11px] font-medium text-[13px] border-b-2 border-transparent"
          style={{ color: 'var(--ink-500)' }}
        >
          Library
        </Link>
        <Link
          href="/admin/team"
          className="pb-[11px] font-medium text-[13px] border-b-2"
          style={{ color: 'var(--ink-900)', borderBottomColor: 'var(--ink-900)' }}
        >
          Team
        </Link>
        <Link
          href="/admin/departments"
          className="pb-[11px] font-medium text-[13px] border-b-2 border-transparent"
          style={{ color: 'var(--ink-500)' }}
        >
          Departments
        </Link>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink-900)]">Manage Team</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
            Invite people, set their role, and place them in one or more departments.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      <RoleAssignmentTable orgId={org.id} inviteCode={org.invite_code} departments={departments} />
    </div>
  )
}
