import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { LogoutButton } from '@/components/profile/LogoutButton'
import { OrgSwitcher } from '@/components/profile/OrgSwitcher'
import { ObservationsSection } from '@/components/profile/ObservationsSection'
import { CompetencySection } from '@/components/profile/CompetencySection'

export default async function ProfilePage() {
  const { userId, userEmail } = await getSessionContext()

  if (!userId) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold text-[var(--ink-900)] mb-2">Profile</h1>

      {/* Account info */}
      <section className="blueprint-frame p-5">
        <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--ink-500)]">Email</span>
          <span className="text-sm text-[var(--ink-900)]">{userEmail}</span>
        </div>
      </section>

      {/* Org memberships + switcher */}
      <OrgSwitcher />

      {/* Observations about you (OBS-02) */}
      <ObservationsSection />

      {/* My competency (CMP-01/D-04) */}
      <CompetencySection />

      {/* Sign out */}
      <LogoutButton />
    </div>
  )
}
