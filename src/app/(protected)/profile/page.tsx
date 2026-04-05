import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemePicker } from '@/components/profile/ThemePicker'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold text-brand-yellow mb-6">Profile</h1>

      {/* User info */}
      <section className="neuro-panel p-5 mb-6">
        <h2 className="text-sm font-semibold text-steel-400 uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-steel-400">Email</span>
            <span className="text-sm text-steel-100">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-steel-400">User ID</span>
            <span className="text-sm text-steel-100 font-mono text-xs">
              {user.id.slice(0, 8)}
            </span>
          </div>
        </div>
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
