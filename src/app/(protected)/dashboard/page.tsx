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

  // Fetch membership to determine role
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = member?.role ?? null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-steel-100 mb-6">Dashboard</h1>

      {role === 'admin' && <AdminDashboard />}
      {role === 'worker' && <WorkerDashboard />}
      {role === 'supervisor' && <SupervisorDashboard />}
      {role === 'safety_manager' && <SafetyManagerDashboard />}
      {!role && <PendingDashboard />}
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="space-y-4">
      <p className="text-steel-400 text-sm">Welcome, Admin. Get started:</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/sops/upload">
          <ActionCard
            title="Upload SOPs"
            description="Import your existing SOP documents"
          />
        </Link>
        <Link href="/admin/sops">
          <ActionCard
            title="SOP Library"
            description="View and manage all SOPs"
          />
        </Link>
        <Link href="/admin/team">
          <ActionCard
            title="Invite Team"
            description="Add workers and assign roles"
          />
        </Link>
        <Link href="/admin/team">
          <ActionCard
            title="Manage Roles"
            description="View and update team member roles"
          />
        </Link>
      </div>
    </div>
  )
}

function WorkerDashboard() {
  return (
    <div className="rounded-xl bg-steel-800 border border-steel-700 p-6 text-center">
      <p className="text-steel-400">Your assigned SOPs will appear here once your admin uploads them.</p>
    </div>
  )
}

function SupervisorDashboard() {
  return (
    <div className="rounded-xl bg-steel-800 border border-steel-700 p-6 text-center">
      <p className="text-steel-400">Completions awaiting your review will appear here.</p>
    </div>
  )
}

function SafetyManagerDashboard() {
  return (
    <div className="rounded-xl bg-steel-800 border border-steel-700 p-6 text-center">
      <p className="text-steel-400">Organisation-wide SOP compliance will appear here.</p>
    </div>
  )
}

function PendingDashboard() {
  return (
    <div className="rounded-xl bg-steel-800 border border-steel-700 p-6 text-center">
      <p className="text-steel-400">Your account is being set up. Ask your admin if you have access issues.</p>
    </div>
  )
}

function ActionCard({
  title,
  description,
  disabled = false,
  badge,
}: {
  title: string
  description: string
  disabled?: boolean
  badge?: string
}) {
  return (
    <div
      className={`rounded-xl border p-5 min-h-[var(--min-tap-target)] flex flex-col justify-center ${
        disabled
          ? 'bg-steel-800/50 border-steel-700 opacity-60 cursor-not-allowed'
          : 'bg-steel-800 border-steel-700 hover:border-brand-yellow cursor-pointer transition-colors'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-steel-100">{title}</h3>
          <p className="text-steel-400 text-sm mt-0.5">{description}</p>
        </div>
        {badge && (
          <span className="shrink-0 text-xs bg-steel-700 text-steel-400 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}
