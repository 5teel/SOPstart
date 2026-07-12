import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import { getApprovalChains } from '@/actions/approvals'
import { getOrgMembers } from '@/actions/assignments'
import { GovernanceFilterChips, type GovernanceFilter } from '@/components/admin/governance/GovernanceFilterChips'
import { GovernanceQueueRow } from '@/components/admin/governance/GovernanceQueueRow'
import { ApprovalChainEditor, type ChainMember } from '@/components/admin/governance/ApprovalChainEditor'
import { AdminNav } from '@/components/admin/AdminNav'
import type { ChainStep } from '@/lib/governance/approvals'

export const metadata: Metadata = {
  title: 'Governance queue',
}

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Org-aware membership lookup (LR-05): scope to the caller's JWT org so a
  // multi-org user resolves a single row and .maybeSingle() can't error on
  // duplicate memberships. The real gate is requireAdmin() inside
  // listGovernanceQueue (JWT-based) — this is belt-and-suspenders.
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const organisationId = claims['organisation_id'] as string | undefined

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organisation_id', organisationId ?? '')
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const activeFilter = (params.filter ?? 'all') as GovernanceFilter

  const result = await listGovernanceQueue()
  const allRows: GovernanceRow[] = 'success' in result && result.success ? result.rows : []
  const flaggedRows = allRows.filter((r) => r.flags.length > 0)

  const counts: Record<GovernanceFilter, number> = {
    all: flaggedRows.length,
    overdue: flaggedRows.filter((r) => r.flags.includes('overdue')).length,
    due_soon: flaggedRows.filter((r) => r.flags.includes('due_soon')).length,
    unowned: flaggedRows.filter((r) => r.flags.includes('unowned')).length,
    stale_role: flaggedRows.filter((r) => r.flags.includes('stale_role')).length,
    awaiting_approval: flaggedRows.filter((r) => r.flags.includes('awaiting_approval')).length,
  }

  const visibleRows = activeFilter === 'all' ? flaggedRows : flaggedRows.filter((r) => r.flags.includes(activeFilter))

  // Approval chains config panel (D29-05) — distinct sops.category values for
  // the org, no new table. Simple select + dedupe in JS.
  const { data: categoryRows } = await supabase
    .from('sops')
    .select('category')
    .eq('organisation_id', organisationId ?? '')
    .not('category', 'is', null)

  const categories = Array.from(
    new Set((categoryRows ?? []).map((r) => r.category).filter((c): c is string => !!c)),
  ).sort()

  const chainsResult = await getApprovalChains()
  const chains: Record<string, ChainStep[]> =
    'success' in chainsResult && chainsResult.success
      ? Object.fromEntries(chainsResult.chains.map((c) => [c.category, c.steps]))
      : {}

  const membersResult = await getOrgMembers()
  const members: ChainMember[] =
    membersResult.success
      ? membersResult.members
          .filter((m) => m.role === 'admin' || m.role === 'safety_manager')
          .map((m) => ({ user_id: m.user_id, role: m.role, label: m.email ?? m.full_name ?? `${m.role} (${m.user_id.slice(0, 8)})` }))
      : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="pill">GOVERNANCE</span>
          </div>
          <h1 className="mono text-2xl font-semibold text-[var(--ink-900)]">Governance queue</h1>
        </div>
      </div>

      {/* Governance is a view of SOPs (UX-03 fold lands in 30-08) */}
      <AdminNav active="sops" />

      <GovernanceFilterChips active={activeFilter} counts={counts} />

      {'error' in result && (
        <div className="blueprint-frame text-center py-12">
          <p className="mono text-[11px] text-red-600 uppercase tracking-wider mb-2">ERROR</p>
          <p className="text-sm text-[var(--ink-500)]">{result.error}</p>
        </div>
      )}

      {'success' in result && visibleRows.length === 0 && (
        <div className="blueprint-frame text-center py-12">
          <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-2">CLEAR</p>
          <p className="text-lg font-semibold text-[var(--ink-900)] mb-1">Nothing needs attention</p>
          <p className="text-sm text-[var(--ink-500)]">Every SOP in this filter is owned, current, and correctly assigned.</p>
        </div>
      )}

      {visibleRows.length > 0 && (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <GovernanceQueueRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="pill">CONFIG</span>
          <h2 className="mono text-lg font-semibold text-[var(--ink-900)]">Approval chains</h2>
        </div>
        <ApprovalChainEditor categories={categories} members={members} chains={chains} />
      </div>
    </div>
  )
}
