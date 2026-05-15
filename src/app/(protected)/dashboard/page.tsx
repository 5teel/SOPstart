import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = member?.role ?? null

  if (role === 'worker') redirect('/sops')
  if (role === 'supervisor') redirect('/activity')
  if (role === 'safety_manager') redirect('/activity')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 lg:py-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="pill">DASHBOARD</span>
          <span className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider">
            v3.0 / Closeout
          </span>
        </div>
        <h1 className="mono text-2xl font-semibold text-[var(--ink-900)] mb-1">Home</h1>
        <p className="text-sm text-[var(--ink-500)] mb-8">
          Pick a path. Build, review, and publish your SOPs.
        </p>

      {role === 'admin' && <AdminDashboard />}
      {!role && <PendingDashboard />}
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DashTile
        href="/admin/sops/new/ai"
        eyebrow="AI"
        title="Draft from a prompt"
        description="Describe the procedure in plain English. Claude drafts a structured SOP for review."
      />
      <DashTile
        href="/admin/sops/new/blank"
        eyebrow="BUILDER"
        title="Start blank"
        description="Open the builder with an empty canvas and pick block types as you go."
      />
      <DashTile
        href="/admin/sops/upload"
        eyebrow="INTAKE"
        title="Upload existing SOP"
        description="Word, PDF, image, video, or YouTube link. We parse and you review."
      />
      <DashTile
        href="/admin/sops"
        eyebrow="LIBRARY"
        title="SOP library"
        description="Search, filter, assign, and version published SOPs."
      />
      <DashTile
        href="/admin/blocks"
        eyebrow="REUSE"
        title="Library"
        description="Reusable hazards, PPE, callouts and steps shared across SOPs."
      />
      <DashTile
        href="/admin/team"
        eyebrow="TEAM"
        title="Team & invites"
        description="Add workers, set roles, share invite codes."
      />
    </div>
  )
}

function PendingDashboard() {
  return (
    <div className="blueprint-frame max-w-md">
      <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-1">
        ACCOUNT PENDING
      </p>
      <p className="text-sm text-[var(--ink-700)]">
        Your account is being set up. Ask your admin if you have access issues.
      </p>
    </div>
  )
}

function DashTile({
  href,
  eyebrow,
  title,
  description,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="blueprint-frame block transition-shadow hover:shadow-[0_0_0_1px_var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
    >
      <p className="mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.08em] mb-2">
        {eyebrow}
      </p>
      <h3 className="text-base font-semibold text-[var(--ink-900)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--ink-500)]">{description}</p>
    </Link>
  )
}
