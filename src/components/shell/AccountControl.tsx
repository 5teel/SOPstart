'use client'

/**
 * Quiet account control at the foot of the menu (D-15b): who you are and where,
 * then one link per row -- an account menu, not a navigation bar. Admins also get
 * Settings and the two maps (Pathways, Feedback). Sign out is last and separated. Someone in more than
 * one site picks the site here (2026-10-11); the page reloads into it.
 */
import { useState } from 'react'
import Link from 'next/link'
import { signOut, switchSite } from '@/actions/auth'

export interface Site { id: string; name: string }

const LINK = 'flex min-h-tap w-full items-center rounded-lg px-2 text-left text-ui text-ink-700 hover:bg-paper-2 hover:text-ink-900'

export function AccountControl({ email, isAdmin, secondStep = false, org, orgId, sites = [] }: { email: string | null; isAdmin: boolean; secondStep?: boolean; org?: string; orgId?: string | null; sites?: Site[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function pick(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await switchSite(id)
      if (res.error) throw new Error(res.error)
      window.location.assign('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.")
      setBusy(false)
    }
  }
  return (
    <div data-testid="shell-account" className="flex flex-col border-t border-ink-200 p-2">
      {(email || org) && (
        <div className="min-w-0 px-2 pb-2 pt-1">
          {email && <p className="truncate text-ui font-semibold text-ink-900">{email}</p>}
          {sites.length > 1 && orgId ? (
            <label className="mt-1 block">
              <span className="sr-only">Site</span>
              <select
                data-testid="site-switch"
                value={orgId}
                disabled={busy}
                onChange={(e) => pick(e.target.value)}
                className="min-h-tap w-full truncate rounded-lg border border-ink-200 bg-paper px-2 text-meta text-ink-700"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            org && (
              <p data-testid="home-org" className="mono truncate text-meta text-ink-600">
                {org}
              </p>
            )
          )}
          {error && <p role="alert" className="pt-1 text-meta text-accent-hazard">{error}</p>}
        </div>
      )}
      <Link href="/profile" className={LINK}>
        Profile
      </Link>
      {secondStep && (
        // Phase 66 / ADR-0028: an admin or safety manager reads and runs SOPs at once, and gets the
        // admin side back after the second step. A full load, so /verify's server redirect runs.
        <a href="/verify" data-testid="shell-second-step" className={LINK}>
          Confirm it&apos;s you for admin work
        </a>
      )}
      {isAdmin && (
        <>
          <Link href="/admin/settings" data-testid="shell-settings" className={LINK}>
            Settings
          </Link>
          <Link href="/pathways" className={LINK}>
            Pathways
          </Link>
          <Link href="/uat" className={LINK}>
            Feedback
          </Link>
        </>
      )}
      <form action={signOut} className="mt-1 border-t border-ink-200 pt-1">
        <button type="submit" data-testid="shell-sign-out" className={LINK}>
          Sign out
        </button>
      </form>
    </div>
  )
}
