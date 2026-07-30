import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Phase 40 (DUP-04) — the one shared admin creation-flow page shell.
 *
 * Consolidates the hand-rolled header + "Back to library" link duplicated
 * across /admin/sops/upload, /admin/sops/new/blank, /admin/sops/new/ai,
 * /admin/sops/[sopId]/versions and the pipeline progress page. The optional
 * `backLink` slot preserves the per-SOP contextual link those last two pages
 * need (RESEARCH Pitfall 5). Admin section nav lives in the app header
 * (sketch 004 variant A) — this shell renders no nav of its own.
 *
 * Presentation only — no auth logic (T-40-09-01). Every page keeps its own
 * getSessionContext guard and redirect(); this component must never be
 * mistaken for that boundary.
 *
 * No 'use client'/'use server' directive — composes into both server pages
 * (upload, new/blank, new/ai) and client pages (versions,
 * PipelineProgressClient) without forcing either.
 */

export interface AdminPageShellBackLink {
  href: string
  label: string
  ariaLabel?: string
}

interface AdminPageShellProps {
  title: string
  badge?: string
  description?: ReactNode
  backLink?: AdminPageShellBackLink
  mono?: boolean
  children: ReactNode
  contentClassName?: string
}

export function AdminPageShell({
  title,
  badge,
  description,
  backLink,
  mono,
  children,
  contentClassName = 'max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-12',
}: AdminPageShellProps) {
  return (
    <div className={contentClassName}>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          {badge && <span className="pill">{badge}</span>}
          <h1
            className={`${mono ? 'mono ' : ''}text-2xl font-semibold text-[var(--ink-900)] mt-1`}
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[var(--ink-500)] mt-1">{description}</p>
          )}
        </div>

        {backLink && (
          <Link
            href={backLink.href}
            aria-label={backLink.ariaLabel ?? backLink.label}
            className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors flex-shrink-0"
          >
            {backLink.label}
          </Link>
        )}
      </div>

      {children}
    </div>
  )
}
