import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemePicker } from '@/components/profile/ThemePicker'
import { LogoutButton } from '@/components/profile/LogoutButton'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  safety_manager: 'Safety Manager',
  supervisor: 'Supervisor',
  worker: 'Worker',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch org membership + org name
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { role: string; organisation_id: string } | null }

  let orgName: string | null = null
  if (member) {
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', member.organisation_id)
      .maybeSingle() as { data: { name: string } | null }
    orgName = org?.name ?? null
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold text-brand-yellow mb-6">Profile</h1>

      {/* Account info */}
      <section className="neuro-panel p-5 mb-4">
        <h2 className="text-sm font-semibold text-steel-400 uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-steel-400">Email</span>
            <span className="text-sm text-steel-100">{user.email}</span>
          </div>
          {orgName && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-steel-400">Organisation</span>
              <span className="text-sm text-steel-100">{orgName}</span>
            </div>
          )}
          {member?.role && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-steel-400">Role</span>
              <span className="text-sm text-steel-100">
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Sign out */}
      <section className="mb-6">
        <LogoutButton />
      </section>

      {/* Theme picker */}
      <section className="neuro-panel p-5">
        <h2 className="text-sm font-semibold text-steel-400 uppercase tracking-wider mb-1">
          Site Theme
        </h2>
        <p className="text-xs text-steel-600 mb-4">
          Choose an industrial aesthetic. Applies instantly across all pages.
        </p>
        <ThemePicker />
      </section>
    </div>
  )
}
