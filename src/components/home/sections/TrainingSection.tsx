'use client'

/**
 * Phase 63 (HOME-04, R2) -- Training: the assessment requests, the training matrix and a person's
 * training record -- the /admin/training body inside the home. Mounted for admin and safety manager
 * only (sectionsForRole); listOrgTree and listDepartments keep their own server guards (T-63-25).
 * Reached through next/dynamic from the home shell.
 */
import { useQuery } from '@tanstack/react-query'
import { listDepartments } from '@/actions/departments'
import { listOrgTree } from '@/actions/org-model'
import { TrainingBridge } from '@/components/admin/competency/TrainingBridge'
import { AssessmentRequestsPanel } from '@/components/observations/AssessmentRequestsPanel'

export function TrainingSection() {
  const treeQ = useQuery({ queryKey: ['training-tree'], queryFn: () => listOrgTree() })
  const deptQ = useQuery({ queryKey: ['training-departments'], queryFn: () => listDepartments() })
  const tree = treeQ.data

  return (
    <section data-testid="section-training" className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Training</h2>
      </div>
      <AssessmentRequestsPanel />
      {treeQ.isError || (tree && 'error' in tree) ? (
        <p className="text-ui text-accent-escalate">Could not load the training matrix{tree && 'error' in tree ? `: ${tree.error}` : '.'}</p>
      ) : tree && !deptQ.isLoading ? (
        <TrainingBridge tree={tree} departments={deptQ.data ?? []} />
      ) : (
        <p className="text-ui text-ink-500">Loading…</p>
      )}
    </section>
  )
}
