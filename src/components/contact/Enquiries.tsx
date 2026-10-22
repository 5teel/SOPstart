'use client'

import { useState } from 'react'
import { ENQUIRIES_EMAIL } from '@/lib/contact'

/**
 * Enquiries: a native popover with the address to copy or open. A bare mailto link looked
 * dead on a computer with no mail app set up, so the address is always shown. `id` names the
 * popover and its test ids, so two on one page (the welcome offer) stay distinct.
 */
export function Enquiries({
  className,
  label = 'Enquiries',
  id = 'enquiries',
  title = 'Get in touch',
  body = 'Email us and we will get back to you.',
  subject,
}: {
  className?: string
  label?: string
  id?: string
  title?: string
  body?: string
  subject?: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ENQUIRIES_EMAIL)
      setCopied(true)
    } catch {
      /* the address stays on screen to select by hand */
    }
  }
  const popover = `${id}-popover`
  return (
    <>
      <button type="button" popoverTarget={popover} data-testid={id} className={className}>
        {label}
      </button>
      <div
        id={popover}
        popover="auto"
        data-testid={popover}
        className="m-auto w-full max-w-sm rounded-2xl text-left border border-ink-200 bg-paper-1 p-6 text-ink-900 shadow-lg backdrop:bg-ink-900/40"
      >
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-reading text-ink-600">{body}</p>
        <p className="mt-4 select-all rounded-lg bg-paper-2 px-4 py-3 text-reading font-semibold">{ENQUIRIES_EMAIL}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={copy} className="flex min-h-tap flex-1 items-center justify-center rounded-lg border border-ink-300 px-4 text-ui font-semibold hover:border-ink-900">
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <a
            href={`mailto:${ENQUIRIES_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`}
            data-testid={`${id}-email`}
            className="flex min-h-tap flex-1 items-center justify-center rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper hover:opacity-90"
          >
            Open email
          </a>
        </div>
        <button type="button" popoverTarget={popover} popoverTargetAction="hide" className="mt-3 flex min-h-tap w-full items-center justify-center rounded-lg text-ui text-ink-600 hover:bg-paper-2">
          Close
        </button>
      </div>
    </>
  )
}
