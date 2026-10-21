'use client'

import { useState } from 'react'
import { ENQUIRIES_EMAIL } from '@/lib/contact'

/**
 * Enquiries: a native popover with the address to copy or open. A bare mailto link looked
 * dead on a computer with no mail app set up, so the address is always shown.
 */
export function Enquiries({ className, label = 'Enquiries' }: { className?: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ENQUIRIES_EMAIL)
      setCopied(true)
    } catch {
      /* the address stays on screen to select by hand */
    }
  }
  return (
    <>
      <button type="button" popoverTarget="enquiries-popover" data-testid="enquiries" className={className}>
        {label}
      </button>
      <div
        id="enquiries-popover"
        popover="auto"
        data-testid="enquiries-popover"
        className="m-auto w-full max-w-sm rounded-2xl text-left border border-ink-200 bg-paper-1 p-6 text-ink-900 shadow-lg backdrop:bg-ink-900/40"
      >
        <h2 className="text-xl font-semibold">Get in touch</h2>
        <p className="mt-2 text-reading text-ink-600">Email us and we will get back to you.</p>
        <p className="mt-4 select-all rounded-lg bg-paper-2 px-4 py-3 text-reading font-semibold">{ENQUIRIES_EMAIL}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={copy} className="flex min-h-tap flex-1 items-center justify-center rounded-lg border border-ink-300 px-4 text-ui font-semibold hover:border-ink-900">
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <a href={`mailto:${ENQUIRIES_EMAIL}`} data-testid="enquiries-email" className="flex min-h-tap flex-1 items-center justify-center rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper hover:opacity-90">
            Open email
          </a>
        </div>
        <button type="button" popoverTarget="enquiries-popover" popoverTargetAction="hide" className="mt-3 flex min-h-tap w-full items-center justify-center rounded-lg text-ui text-ink-600 hover:bg-paper-2">
          Close
        </button>
      </div>
    </>
  )
}
