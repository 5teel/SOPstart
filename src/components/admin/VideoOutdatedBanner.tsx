'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface VideoOutdatedBannerProps {
  variant: 'admin' | 'worker'
  sopId?: string
}

export default function VideoOutdatedBanner({ variant, sopId }: VideoOutdatedBannerProps) {
  return (
    <div
      role="status"
      className="bg-[var(--accent-voice)]/20 border border-[var(--accent-voice)]/50 rounded-lg px-4 py-3 mb-4 flex items-start gap-2"
    >
      <AlertTriangle size={16} className="text-[var(--accent-voice)] flex-shrink-0 mt-0.5" />
      <div>
        {variant === 'admin' ? (
          <>
            <p className="text-sm text-[var(--accent-voice)]">
              Video is outdated — the SOP was updated after this video was generated. Re-generate recommended.
            </p>
            {sopId && (
              <Link
                href={`/admin/sops/${sopId}/video`}
                className="text-xs text-[var(--accent-voice)] underline mt-1 block"
              >
                Re-generate
              </Link>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--accent-voice)]">
            This video was generated from an earlier version of this SOP. The current procedure may differ.
          </p>
        )}
      </div>
    </div>
  )
}
