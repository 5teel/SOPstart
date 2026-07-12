import Link from 'next/link'

/**
 * App-level not-found boundary (Phase 30 / RESEARCH Pitfall 1).
 * A stale link to a removed URL renders this navigable page instead of the
 * bare "This page couldn't load" browser error (CLAUDE.md 2026-06-08).
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="blueprint-frame max-w-md text-center">
        <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-2">
          PAGE NOT FOUND
        </p>
        <p className="text-sm text-[var(--ink-700)] mb-4">
          This page has moved or no longer exists.
        </p>
        <Link
          href="/"
          className="mono text-sm text-[var(--ink-900)] underline underline-offset-4"
        >
          Go to your home screen
        </Link>
      </div>
    </div>
  )
}
