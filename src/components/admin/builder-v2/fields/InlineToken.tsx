'use client'

import { useEffect, useRef } from 'react'

/**
 * Pattern D — inline editable token (UI-SPEC §Field-Editor Contract).
 *
 * A dashed-underline, mono, type-in-place span for numeric/short-string values
 * (step number, measurement unit, max duration). Uncontrolled like InlineText
 * (RESEARCH Pitfall 4): seed `textContent` once, read `textContent` on blur,
 * commit the RAW string via `onCommit`. The shell routes it through the
 * Zod-validated `commitFieldToContent`, which parses numerics and keeps the
 * prior value on invalid input. Never innerHTML (XSS — inherits T-26-04-01).
 *
 * SSR-safe: DOM reads only inside the mount effect (#418).
 */
interface InlineTokenProps {
  value: unknown
  onCommit: (raw: string) => void
  className?: string
  ariaLabel?: string
}

export function InlineToken({ value, onCommit, className, ariaLabel }: InlineTokenProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const initial = value == null ? '' : String(value)

  useEffect(() => {
    if (ref.current) ref.current.textContent = initial
    // Seed once — intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      data-inline-token
      contentEditable
      suppressContentEditableWarning
      className={
        className ??
        'font-mono text-[12px] underline decoration-dashed underline-offset-4 outline-none focus:decoration-solid'
      }
      onBlur={() => onCommit(ref.current?.textContent ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          ref.current?.blur()
        }
      }}
    >
      {initial}
    </span>
  )
}
