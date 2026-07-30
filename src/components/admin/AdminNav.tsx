import Link from 'next/link'
import { NavPendingSpinner } from '@/components/layout/NavPendingSpinner'

/**
 * Phase 30 (UX-02) — the ONE shared admin sub-nav.
 *
 * Replaces the 5 copy-pasted inline "Admin sections" navs (3 styling idioms).
 * Server-rendered pages pass their own `active` key — no client hooks needed.
 *
 * "Governance" deep-links /admin/sops?view=attention (orchestrator decision #1);
 * the folded needs-attention view itself lands in 30-08.
 *
 * Presentation only — this component does NOT replace any per-page auth guard
 * (threat model T-30-03-01): every admin page keeps its own role gate.
 */

export type AdminNavKey = 'sops' | 'governance' | 'blocks' | 'team' | 'settings'

const ITEMS: { key: AdminNavKey; label: string; href: string }[] = [
  { key: 'sops', label: 'SOPs', href: '/admin/sops' },
  { key: 'governance', label: 'Needs attention', href: '/admin/sops?view=attention' },
  { key: 'blocks', label: 'Content', href: '/admin/blocks' },
  { key: 'team', label: 'Team', href: '/admin/team' },
  { key: 'settings', label: 'Settings', href: '/admin/settings' },
]

export function AdminNav({ active }: { active: AdminNavKey }) {
  return (
    <nav
      aria-label="Admin sections"
      className="flex gap-1 border-b border-[var(--ink-100)] mb-6"
    >
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="tab"
          data-active={active === item.key ? 'true' : undefined}
        >
          {item.label}
          <NavPendingSpinner className="h-3 w-3" />
        </Link>
      ))}
    </nav>
  )
}
