'use client'

import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

type QualityState = 'idle' | 'checking' | 'pass' | 'warn'

interface ImageQualityOverlayProps {
  state: QualityState
  message?: string // custom warning message, defaults provided
}

export function ImageQualityOverlay({ state, message }: ImageQualityOverlayProps) {
  if (state === 'idle') return null

  const config = {
    checking: {
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      text: 'Checking image...',
      color: 'text-steel-400',
    },
    pass: {
      icon: <CheckCircle className="w-4 h-4" />,
      text: 'Looking good',
      color: 'text-green-400',
    },
    warn: {
      icon: <AlertTriangle className="w-4 h-4" />,
      text: message || 'Image may be hard to read -- retake recommended',
      color: 'text-brand-orange',
    },
  }[state]

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 border-b border-steel-700 ${config.color}`}
      role="status"
      aria-live="polite"
    >
      {config.icon}
      <span className="text-sm">{config.text}</span>
    </div>
  )
}
