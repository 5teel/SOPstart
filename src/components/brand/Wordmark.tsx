/**
 * The SOPstart wordmark (sketch 010, 6e): SOP in an ink chip, "start" beside it,
 * one strip of hazard tape along the foot. Every size, weight and colour comes
 * from the --wm-* tokens through the .wm classes. No directive: server or client.
 *
 *  - full  : SOP + start + tape (default)
 *  - chip  : just the SOP chip (the Start button's source half)
 *  - start : just the lowercase word (the Start button label)
 */
export function Wordmark({
  variant = 'full',
  onInk = false,
  size,
  className,
  target = false,
  ...rest
}: {
  variant?: 'full' | 'chip' | 'start'
  onInk?: boolean
  size?: 'hero' | 'merge' | 'header' | 'phone' | 'bar'
  className?: string
  /** Marks the slot the Start merge lands in. */
  target?: boolean
  'data-fuse'?: string
}) {
  const cls = ['wm', variant !== 'full' && 'wm-notape', onInk && 'wm-on-ink', size && `wm-${size}`, className].filter(Boolean).join(' ')
  const common = { className: cls, 'data-wm-target': target ? '' : undefined, ...rest }
  if (variant === 'chip') return <span {...common}><span className="wm-sop">SOP</span></span>
  if (variant === 'start') return <span {...common}><span className="wm-start wm-start-only">start</span></span>
  return (
    <span {...common} role="img" aria-label="SOPstart">
      <span className="wm-sop">SOP</span>
      <span className="wm-start">start</span>
    </span>
  )
}
