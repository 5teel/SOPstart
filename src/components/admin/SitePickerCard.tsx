'use client'
/**
 * Settings → Your site picker (2026-10-15): someone in several sites chooses which ones their
 * site picker lists. Only their own picker changes; the site you are in always stays.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setSiteHidden } from '@/actions/auth'
import type { MySite } from '@/lib/auth/sites'

export function SitePickerCard({ sites, currentId }: { sites: MySite[]; currentId: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The tick moves at once; a refused save puts it back.
  const [shown, setShown] = useState<Record<string, boolean>>(() => Object.fromEntries(sites.map((s) => [s.id, !s.hidden])))
  const toggle = async (id: string, show: boolean) => {
    setBusy(id)
    setError(null)
    setShown((m) => ({ ...m, [id]: show }))
    const r = await setSiteHidden(id, !show)
    setBusy(null)
    if (r.error) {
      setError(r.error)
      setShown((m) => ({ ...m, [id]: !show }))
    } else router.refresh()
  }
  return (
    <div data-testid="site-picker-settings" className="blueprint-frame flex flex-col gap-1">
      <p className="pb-1 text-ui text-ink-700">Untick a site to hide it from your site picker. Only your picker changes; nobody else&apos;s.</p>
      {sites.map((s) => {
        const current = s.id === currentId
        return (
          <label key={s.id} data-testid="site-picker-row" data-site={s.name} className="flex min-h-tap items-center gap-3 text-reading text-ink-900">
            <input
              type="checkbox"
              className="size-5"
              checked={shown[s.id] || current}
              disabled={current || busy !== null}
              onChange={(e) => void toggle(s.id, e.target.checked)}
            />
            <span className="min-w-0 truncate">{s.name}</span>
            {current && <span className="text-meta text-ink-600">the site you are in</span>}
          </label>
        )
      })}
      {error && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}
    </div>
  )
}
