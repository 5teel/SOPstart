/**
 * What a person may do, derived from their role, the approval chains and who they supervise.
 * Plain module, no directive. It MIRRORS the server gates for display only; the gates stay
 * where they are (CAPABILITY-MATRIX.md):
 *   - sign off a completion: signOffCompletion() -- supervisor (own supervised workers), admin, safety manager
 *   - ask someone to do a SOP (assign): canAsk() -- supervisor, admin, safety manager
 *   - approve a SOP in a category: stepMatchesCaller() over approval_chains
 *   - publish: admin, safety manager
 *   - invite people and change roles: admin
 */
import { stepMatchesCaller, type ChainStep } from '@/lib/governance/approvals'
import { canAsk } from '@/lib/requests/model'
import { categoryLabel } from '@/lib/sop-categories'
import type { AppRole } from '@/types/auth'

export interface Authority {
  /** 'any' = any worker's completion; 'supervised' = only the workers they supervise. */
  signOff: 'any' | 'supervised' | null
  /** Workers this person supervises (supervisor_assignments). */
  supervises: number
  assigns: boolean
  /** Category labels whose approval chain names this person or their role. */
  approves: string[]
  publishes: boolean
  managesPeople: boolean
}

export const ROLE_WORDS: Record<AppRole, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'SOP Admin',
  safety_manager: 'Safety Manager',
}

/** Display order: who carries the most authority first. */
export const ROLE_ORDER: AppRole[] = ['safety_manager', 'admin', 'supervisor', 'worker']

export const ROLE_PLURAL: Record<AppRole, string> = {
  worker: 'Workers',
  supervisor: 'Supervisors',
  admin: 'SOP Admins',
  safety_manager: 'Safety Managers',
}

export function authorityOf(
  person: { user_id: string; role: AppRole },
  chains: ReadonlyArray<{ category: string; steps: ChainStep[] }>,
  supervision: ReadonlyArray<{ supervisor_id: string; worker_id: string }>,
): Authority {
  const { role } = person
  const caller = { userId: person.user_id, role }
  const admin = role === 'admin' || role === 'safety_manager'
  const approves = chains
    .filter((c) => c.steps.some((s) => stepMatchesCaller(s, caller)))
    .map((c) => categoryLabel(c.category) ?? c.category)
    .sort()
  return {
    signOff: admin ? 'any' : role === 'supervisor' ? 'supervised' : null,
    supervises: supervision.filter((s) => s.supervisor_id === person.user_id).length,
    assigns: canAsk(role),
    approves,
    publishes: admin,
    managesPeople: role === 'admin',
  }
}

/** One plain sentence per thing the person may do, for the person sheet. */
export function authorityLines(a: Authority): string[] {
  const lines: string[] = []
  if (a.signOff === 'any') lines.push("Signs off anyone's completed SOPs.")
  if (a.signOff === 'supervised') {
    lines.push(
      a.supervises === 0
        ? 'Signs off the workers they supervise, but no workers are linked to them yet.'
        : `Signs off the ${a.supervises === 1 ? 'worker' : `${a.supervises} workers`} they supervise, on SOPs they are signed off on themselves.`,
    )
  }
  if (a.assigns) lines.push('Asks people to do SOPs.')
  if (a.approves.length > 0) lines.push(`Approves and edits SOPs in ${a.approves.join(', ')}.`)
  if (a.publishes) lines.push('Edits and publishes any SOP.')
  if (a.managesPeople) lines.push('Invites people and changes roles.')
  if (lines.length === 0) lines.push('Follows SOPs and sends them for sign-off.')
  return lines
}
