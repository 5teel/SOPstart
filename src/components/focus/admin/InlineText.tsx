'use client'

import { useEffect, useRef } from 'react'

/**
 * Uncontrolled inline text editor (Pattern A, RESEARCH Pitfall 4).
 *
 * Seeds `textContent` ONCE on mount, reads `textContent` on blur, and commits
 * via the caller's `onCommit`. It NEVER re-writes the node from React state
 * while focused (that resets the caret + breaks IME) and NEVER uses innerHTML
 * (XSS — threat T-26-04-01; user text is only ever read as plain text).
 *
 * SSR-safe: all DOM reads (`window`/`document`) happen inside the mount effect,
 * which is client-only — no module-load or render-time DOM access (#418).
 */
interface InlineTextProps {
  initialValue: string
  onCommit: (value: string) => void
  className?: string
  ariaLabel?: string
  /**
   * Focus + place caret on mount (default true — the click-to-edit swap idiom).
   * The FIELD_MAP-driven field strip (26-06) renders several A fields at once
   * and passes `false` so they don't fight for focus on mount.
   */
  autoFocus?: boolean
}

export function InlineText({
  initialValue,
  onCommit,
  className,
  ariaLabel,
  autoFocus = true,
}: InlineTextProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = initialValue
    if (!autoFocus) return
    el.focus()
    // Place caret at the end of the seeded text.
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    // Seed once — intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      className={className}
      onBlur={() => onCommit(ref.current?.textContent ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          ref.current?.blur()
        }
      }}
    />
  )
}
