import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import RoleAssignmentTable from '@/components/admin/RoleAssignmentTable'
import { SubTradePicker } from '@/components/admin/SubTradePicker'

export const metadata: Metadata = {
  title: 'Manage Team',
}

/**
 * Phase 15 / Wave 4 — Manage Team page.
 *
 * The existing `RoleAssignmentTable` handles invites, roles, and remove
 * actions (Phase 1+ logic; untouched). Below the table we list each org
 * member with a `SubTradePicker` (D-12) — multi-select pill picker bound
 * to the 5-row seed vocabulary (operator/fitter/sparky/maintainer/other).
 * Sub-trade assignment is orthogonal to roles — both gates participate in
 * the worker's SOP-library visibility via RLS (migration 00030).
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

  // Fetch all org members so we can render a SubTradePicker per worker row.
  // We deliberately use `organisation_members` (the same source as
  // RoleAssignmentTable) so the two sections stay consistent. RLS scopes
  // the read to the admin's own org.
  const { data: members } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', member.organisation_id)
    .order('role', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Manage Team</h1>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      <RoleAssignmentTable orgId={org.id} inviteCode={org.invite_code} />

      {/* Phase 15 — sub-trade tagging (D-12) */}
      <section
        className="mt-8 rounded-xl bg-white border border-[var(--ink-100)] p-4"
        data-testid="sub-trade-section"
      >
        <h2 className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-widest mb-1">
          Sub-trade tags
        </h2>
        <p className="text-xs text-[var(--ink-500)] mb-4">
          Tag workers with their sub-trade(s). SOPs tagged to a sub-trade
          are visible only to workers carrying that tag. Untagged SOPs
          remain visible to everyone.
        </p>

        {!members || members.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)] py-2">
            No team members yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--ink-100)]">
            {members.map(m => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 py-3 min-h-[60px] flex-wrap"
                data-testid={`worker-row-${m.user_id}`}
              >
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-medium text-[var(--ink-900)] truncate">
                    Worker {m.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-[var(--ink-500)] capitalize">
                    {m.role.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex-1 min-w-[280px]">
                  <SubTradePicker mode="user" userId={m.user_id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
