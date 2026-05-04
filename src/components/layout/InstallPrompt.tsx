'use client'
import { useEffect, useState } from 'react'
import { PRODUCT_NAME } from '@/lib/constants'

const DISMISS_KEY = 'install-prompt-dismissed-until'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [showIOS, setShowIOS] = useState(false)
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const dismissedUntil = localStorage.getItem(DISMISS_KEY)
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      setDismissed(true)
      return
    }
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
    if (isStandalone) return
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    if (isIOS) { setShowIOS(true); return }
    const handler = (e: Event) => { e.preventDefault(); setAndroidPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS))
    setDismissed(true)
    setShowIOS(false)
    setAndroidPrompt(null)
  }

  async function handleAndroidInstall() {
    if (!androidPrompt) return
    await androidPrompt.prompt()
    const { outcome } = await androidPrompt.userChoice
    if (outcome === 'accepted') dismiss()
  }

  const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )

  if (dismissed) return null

  if (showIOS) {
    return (
      <div role="banner" className="relative flex items-start gap-3 bg-white border border-[var(--ink-100)] rounded-lg mx-4 mt-2 p-3 text-sm text-[var(--ink-900)]">
        <div className="flex-1">
          <p className="font-medium mb-1">Install {PRODUCT_NAME}</p>
          <p className="text-[var(--ink-500)]">
            Tap the Share button <span aria-label="Share icon" className="inline-block">&#8679;</span>{' '}
            then <strong>Add to Home Screen</strong> to install this app.
          </p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss install prompt" className="shrink-0 text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors">
          <CloseIcon />
        </button>
      </div>
    )
  }

  if (androidPrompt) {
    return (
      <div role="banner" className="relative flex items-center gap-3 bg-white border border-[var(--ink-100)] rounded-lg mx-4 mt-2 p-3 text-sm text-[var(--ink-900)]">
        <div className="flex-1">
          <p className="font-medium">Install {PRODUCT_NAME}</p>
          <p className="text-[var(--ink-500)]">Add to your home screen for quick access</p>
        </div>
        <button onClick={handleAndroidInstall} className="shrink-0 bg-[var(--ink-900)] text-[var(--paper)] font-semibold px-3 py-1.5 rounded text-xs hover:opacity-80 transition-opacity">
          Install
        </button>
        <button onClick={dismiss} aria-label="Dismiss install prompt" className="shrink-0 text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors">
          <CloseIcon />
        </button>
      </div>
    )
  }

  return null
}
