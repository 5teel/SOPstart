import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { listDepartments } from '@/actions/departments'
import { listOrgTree } from '@/actions/org-model'
import { TeamViewShell } from '@/components/admin/org-model/TeamViewShell'
import { AssessmentRequestsPanel } from '@/components/observations/AssessmentRequestsPanel'

export const metadata: Metadata = {
  title: 'Team',
}

/**
 * Phase 32-07 (D-08) — /admin/team is now the org model surface: Node Chart
 * (org -> area -> department -> role) renders by default with an in-page
 * ⊞ Chart / ▤ Columns toggle (TeamViewShell). Columns absorbs the Phase
 * 15/25 member roster (RoleAssignmentTable — invite, org-privilege role,
 * department picker) as a collapsible sub-panel; nothing was deleted.
 * Admin nav lives in the app header (sketch 004); Team link still lands here.
 */
export default async function AdminTeamPage() {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')

  // Check user is admin
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  // Independent reads — fetch concurrently ([2026-07-13] no serial waterfall).
  const [{ data: org }, departments, tree] = await Promise.all([
    supabase
      .from('organisations')
      .select('id, invite_code, name')
      .eq('id', organisationId ?? '')
      .single(),
    listDepartments(),
    listOrgTree(),
  ])

  if (!org) redirect('/dashboard')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink-900)]">Team</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
            Draw your org structure — areas, departments, roles and people — or switch to Columns to add people fast.
          </p>
        </div>
      </div>

      <AssessmentRequestsPanel />

      {'error' in tree ? (
        <p className="text-sm text-red-500">Could not load the org model: {tree.error}</p>
      ) : (
        <TeamViewShell
          tree={tree}
          orgName={org.name ?? 'Organisation'}
          orgId={org.id}
          inviteCode={org.invite_code}
          departments={departments}
        />
      )}
    </div>
  )
}
