'use client'
/**
 * Phase 63 (HOME-01) -- the phone's bottom tab bar: the same sections as the desktop menu,
 * short labels, no counts. Shown by CSS only (below lg), never by reading the window.
 */
import { sectionsForRole, type Section } from '@/lib/shell/home-state'

const SHORT: Record<Section, string> = {
  sops: 'SOPs',
  record: 'Record', // ponytail: 'My record' wraps at 390 px with six tabs at 13 px
  training: 'Training',
  signoffs: 'Sign-offs',
  people: 'People',
  manage: 'Manage',
}

export function TabBar({ role, section, onSelect }: { role: string | null; section: Section; onSelect(s: Section): void }) {
  const list = sectionsForRole(role)
  if (list.length < 2) return null
  return (
    <nav
      aria-label="Sections"
      data-testid="home-tabbar"
      className="flex shrink-0 border-t border-ink-200 bg-paper-1 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {list.map((s) => (
        <button
          key={s}
          type="button"
          data-testid={`home-tab-${s}`}
          aria-current={section === s ? 'page' : undefined}
          onClick={() => onSelect(s)}
          className="min-h-tap flex-1 whitespace-nowrap px-0.5 text-meta text-ink-500 aria-[current=page]:font-bold aria-[current=page]:text-ink-900"
        >
          {SHORT[s]}
        </button>
      ))}
    </nav>
  )
}
