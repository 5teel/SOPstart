'use client'

/**
 * Phase 41 bundle-regression fix: extracted verbatim from
 * `src/app/(protected)/sops/page.tsx` so the admin-only lazy chunk
 * (`AdminSopSurface.tsx`) can render its Miller rows with the SAME
 * primitives the worker column uses (D-02 — "do not build a second styled
 * list"), without page.tsx and AdminSopSurface.tsx statically importing
 * each other (which would be circular: page.tsx `dynamic()`-imports
 * AdminSopSurface, so AdminSopSurface cannot import page.tsx back).
 */
import type { ReactNode, ComponentProps } from 'react'

/** Sticky column header: mono, 10px, uppercase, on the recessed paper tone. */
export function MillerColumnHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="mono sticky top-0 z-10 border-b border-[var(--ink-200)] bg-[var(--paper-2)] px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-[var(--ink-500)]">
      {children}
    </h2>
  )
}

/**
 * A flush row in a Miller column: hairline-separated, never a floating card.
 * Selection is a solid ink fill, which is what lets three columns of these read
 * as one surface instead of three stacks of chips.
 */
export function MillerItem({
  children,
  selected,
  onClick,
  count,
  dot,
  ...rest
}: {
  children: ReactNode
  selected: boolean
  onClick: () => void
  count?: number
  dot?: string
} & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 border-b border-[var(--ink-100)] px-3 py-2 text-left text-[12.5px] transition-colors ${
        selected ? 'bg-[var(--ink-900)] font-semibold text-white' : 'text-[var(--ink-700)] hover:bg-[var(--paper-2)]'
      }`}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: dot }}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && (
        <span className={`mono flex-shrink-0 text-[10.5px] ${selected ? 'text-white/70' : 'text-[var(--ink-400)]'}`}>
          {count}
        </span>
      )}
    </button>
  )
}
