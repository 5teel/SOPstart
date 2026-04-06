import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemePicker } from '@/components/profile/ThemePicker'
import { LogoutButton } from '@/components/profile/LogoutButton'
import { OrgSwitcher } from '@/components/profile/OrgSwitcher'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold text-brand-yellow mb-2">Profile</h1>

      {/* Account info */}
      <section className="neuro-panel p-5">
        <h2 className="text-sm font-semibold text-steel-400 uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-steel-400">Email</span>
          <span className="text-sm text-steel-100">{user.email}</span>
        </div>
      </section>

      {/* Org memberships + switcher */}
      <OrgSwitcher />

      {/* Sign out */}
      <LogoutButton />

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
