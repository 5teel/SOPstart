'use client'
/**
 * Phase 63 (HOME-01) -- the desktop section menu (sketch 009 A `.side`): the wordmark, the
 * sections the role may open (no counts), Manage SOPs last and quiet, and who you are at the foot.
 */
import { Wordmark } from '@/components/brand/Wordmark'
import { AccountControl } from '@/components/shell/AccountControl'
import { sectionsForRole, type Section } from '@/lib/shell/home-state'

export const SECTION_LABEL: Record<Section, string> = {
  sops: 'My SOPs',
  record: 'My record',
  training: 'Training',
  signoffs: 'Sign-offs',
  people: 'People',
  manage: 'Manage SOPs',
}

export function SectionMenu({
  role,
  section,
  userEmail,
  orgName,
  onSelect,
}: {
  role: string | null
  section: Section
  userEmail: string | null
  orgName: string
  onSelect(s: Section): void
}) {
  return (
    <aside data-testid="home-menu" className="flex w-55 shrink-0 flex-col border-r border-ink-200 bg-paper max-lg:hidden">
      <div className="flex justify-center px-5 pb-7 pt-6">
        <Wordmark size="menu" />
      </div>
      <nav aria-label="Sections" className="flex flex-col gap-0.5 px-3">
        {sectionsForRole(role).map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`home-section-${s}`}
            aria-current={section === s ? 'page' : undefined}
            onClick={() => onSelect(s)}
            className={`min-h-tap w-full rounded-lg px-3 text-left hover:bg-paper-2 aria-[current=page]:bg-paper-2 aria-[current=page]:font-bold ${
              s === 'manage' ? 'mt-3 border-t border-ink-200 pt-1 text-ui text-ink-500' : 'text-reading text-ink-900'
            }`}
          >
            {SECTION_LABEL[s]}
          </button>
        ))}
      </nav>
      <div className="mt-auto">
        <AccountControl email={userEmail} org={orgName} isAdmin={role === 'admin' || role === 'safety_manager'} />
      </div>
    </aside>
  )
}
