import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = {
  title: 'Settings — SOPstart',
  description: 'Organisation settings: AI models, departments, and the AI agent layer.',
}

/**
 * Phase 30 (UX-02) — admin Settings hub.
 *
 * Groups the org-level configuration surfaces under one reachable home:
 * AI Settings, Departments, and the AI agent layer (previously an orphan —
 * /admin/agent had zero inbound links anywhere).
 *
 * The approval-chain editor relocates here with the governance fold in 30-08.
 * Shell modelled on admin/ai-settings/page.tsx; auth guard copied verbatim.
 */

const SECTIONS = [
  {
    href: '/admin/ai-settings',
    eyebrow: 'AI',
    title: 'AI Settings',
    description:
      'Which AI models power each part of SOPstart, with per-organisation overrides.',
  },
  {
    href: '/admin/departments',
    eyebrow: 'ORGANISATION',
    title: 'Departments',
    description:
      'Define departments once — SOPs, blocks and people all reference them.',
  },
  {
    href: '/admin/agent',
    eyebrow: 'AI',
    title: 'AI agent',
    description:
      'Evidence-backed improvement proposals and the agent activity feed for your SOP library.',
  },
]

export default async function AdminSettingsPage() {
  // Auth guard — mirrors /admin/ai-settings/page.tsx (organisation_members.role lookup).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <span className="pill">SETTINGS</span>
      </div>
      <h1 className="mono text-2xl font-semibold text-[var(--ink-900)]">Settings</h1>
      <p className="mt-1 mb-6 text-sm text-[var(--ink-500)]">
        Organisation-level configuration — AI models, departments, and the AI agent layer.
      </p>

      <AdminNav active="settings" />

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="blueprint-frame block transition-shadow hover:shadow-[0_0_0_1px_var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
          >
            <p className="mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.08em] mb-2">
              {section.eyebrow}
            </p>
            <h3 className="text-base font-semibold text-[var(--ink-900)] mb-1">
              {section.title}
            </h3>
            <p className="text-sm text-[var(--ink-500)]">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
