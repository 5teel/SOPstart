'use client'

import { useState } from 'react'

// Phase 66 / ADR-0028: ten one-time codes, shown once, with Copy and Download as text.
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  const text = `SOPstart recovery codes. Each works once.\n\n${codes.join('\n')}\n`
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sopstart-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-3" data-testid="recovery-codes">
      <p className="text-sm text-[var(--ink-700)]">
        Keep these somewhere safe. If you lose your phone, one of them gets you back in. Each works once, and you
        won&apos;t see them again.
      </p>
      <ol className="mono grid grid-cols-2 gap-2 rounded-lg border border-[var(--ink-100)] bg-white p-3 text-base text-[var(--ink-900)]">
        {codes.map((c) => (
          <li key={c} data-testid="recovery-code">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button type="button" className="chip flex-1 justify-center" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className="chip flex-1 justify-center" onClick={download}>
          Download
        </button>
      </div>
    </div>
  )
}
