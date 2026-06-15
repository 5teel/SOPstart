import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listDepartments } from '@/actions/departments'
import { getTeamMembersWithEmails } from '@/actions/auth'
import { DepartmentGrid } from '@/components/admin/departments/DepartmentGrid'

export const metadata: Metadata = {
  title: 'Departments',
}

/**
 * Phase 25 Plan 04 — /admin/departments SSR route.
 *
 * Auth guard: redirects non-admin/safety_manager to /dashboard (REQ-1, T-25-01).
 * Fetches: listDepartments() (DepartmentWithCounts[]) + team members for owner selector.
 * Renders: page h1 + sub-heading + shared sub-nav + DepartmentGrid.
 *
 * The "＋ New department" header CTA is rendered inside DepartmentGrid (client component)
 * so it can wire directly to the create modal's open state without a server/client boundary
 * prop-drilling issue.
 *
 * Analog: src/app/(protected)/admin/blocks/page.tsx (auth pattern copied exactly).
 */
export default async function DepartmentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Fetch departments (DepartmentWithCounts[]) for the org
  const departments = await listDepartments()

  // Fetch org members for the owner selector inside the form modal
  const teamResult = await getTeamMembersWithEmails()
  const orgMembers =
    'members' in teamResult && teamResult.members
      ? teamResult.members.map((m) => ({
          id: m.user_id,
          name: m.email?.split('@')[0] ?? m.user_id.slice(0, 8),
          email: m.email ?? '',
          role: m.role,
        }))
      : []

  return (
    <div
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '26px 24px 60px',
        background: 'var(--paper)',
        minHeight: '100vh',
      }}
    >
      {/* Sub-heading (above the grid's own header row) */}
      <p
        style={{
          fontSize: '12px',
          color: 'var(--ink-500)',
          maxWidth: '620px',
          lineHeight: 1.5,
          margin: '0 0 0',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        A first-class entity. SOPs, blocks and people all reference departments — define them once
        here and everything else points back. Each department has an owner accountable for its
        procedures.
      </p>

      {/* Shared admin sub-nav: SOPs | Library | Team | Departments */}
      <nav
        aria-label="Admin sections"
        style={{
          display: 'flex',
          gap: '18px',
          borderBottom: '1px solid var(--ink-100)',
          margin: '18px 0 22px',
          fontSize: '13px',
        }}
      >
        <Link
          href="/admin/sops"
          style={{
            paddingBottom: '11px',
            fontWeight: 500,
            color: 'var(--ink-500)',
            textDecoration: 'none',
            borderBottom: '2px solid transparent',
          }}
        >
          SOPs
        </Link>
        <Link
          href="/admin/blocks"
          style={{
            paddingBottom: '11px',
            fontWeight: 500,
            color: 'var(--ink-500)',
            textDecoration: 'none',
            borderBottom: '2px solid transparent',
          }}
        >
          Library
        </Link>
        <Link
          href="/admin/team"
          style={{
            paddingBottom: '11px',
            fontWeight: 500,
            color: 'var(--ink-500)',
            textDecoration: 'none',
            borderBottom: '2px solid transparent',
          }}
        >
          Team
        </Link>
        <Link
          href="/admin/departments"
          style={{
            paddingBottom: '11px',
            fontWeight: 500,
            color: 'var(--ink-900)',
            textDecoration: 'none',
            borderBottom: '2px solid var(--ink-900)',
          }}
          aria-current="page"
        >
          Departments
        </Link>
      </nav>

      {/* Department card grid — client component owns h1 + CTA + create/edit/archive state */}
      <DepartmentGrid departments={departments} orgMembers={orgMembers} />
    </div>
  )
}
