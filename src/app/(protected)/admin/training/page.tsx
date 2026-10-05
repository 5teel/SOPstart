import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdminContext } from '@/lib/auth/guards'
import { listDepartments } from '@/actions/departments'
import { listOrgTree } from '@/actions/org-model'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { TrainingBridge } from '@/components/admin/competency/TrainingBridge'
import { AssessmentRequestsPanel } from '@/components/observations/AssessmentRequestsPanel'

export const metadata: Metadata = { title: 'Training' }

/**
 * Phase 59 (A-05) -- the training bridge. The matrix, a person's training
 * record and the assessment requests keep their screens; only their address
 * changed, until Phase 61 re-homes them. Reached from the Smoko room.
 *
 * requireAdminContext() runs before any read (T-59-51); the org-model and
 * department reads stay org-scoped by their own guards.
 */
export default async function AdminTrainingPage() {
  const ctx = await requireAdminContext()
  if ('error' in ctx) {
    redirect(ctx.error === 'Not authenticated' ? '/login' : '/')
  }

  const [departments, tree] = await Promise.all([listDepartments(), listOrgTree()])

  return (
    <AdminPageShell title="Training" description="Who has read, been observed on and been signed off for each SOP">
      <AssessmentRequestsPanel />
      {'error' in tree ? (
        <p className="text-sm text-accent-escalate">Could not load the training matrix: {tree.error}</p>
      ) : (
        <TrainingBridge tree={tree} departments={departments} />
      )}
    </AdminPageShell>
  )
}
