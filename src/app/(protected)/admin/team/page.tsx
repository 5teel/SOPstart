import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import RoleAssignmentTable from '@/components/admin/RoleAssignmentTable'
import { AdminNav } from '@/components/admin/AdminNav'
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
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')

  // Check user is admin
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  // Org invite code + departments are independent reads — fetch concurrently.
  const [{ data: org }, departments] = await Promise.all([
    supabase
      .from('organisations')
      .select('id, invite_code')
      .eq('id', organisationId ?? '')
      .single(),
    listDepartments(),
  ])

  if (!org) redirect('/dashboard')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <AdminNav active="team" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink-900)]">Manage Team</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
            Invite people, set their role, and place them in one or more departments.
          </p>
        </div>
      </div>

      <RoleAssignmentTable orgId={org.id} inviteCode={org.invite_code} departments={departments} />
    </div>
  )
}
