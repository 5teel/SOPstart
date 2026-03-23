'use client'
import { useEffect, useState } from 'react'
import { PRODUCT_NAME } from '@/lib/constants'

const DISMISS_KEY = 'install-prompt-dismissed-until'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [showIOS, setShowIOS] = useState(false)
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed within the window
    const dismissedUntil = localStorage.getItem(DISMISS_KEY)
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      setDismissed(true)
      return
    }

    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)

    if (isStandalone) return

    // Detect iOS
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    if (isIOS) {
      setShowIOS(true)
      return
    }

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
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
    if (outcome === 'accepted') {
      dismiss()
    }
  }

  if (dismissed) return null

  if (showIOS) {
    return (
      <div
        role="banner"
        className="relative flex items-start gap-3 bg-steel-800 border border-steel-700 rounded-lg mx-4 mt-2 p-3 text-sm text-steel-100"
      >
        <div className="flex-1">
          <p className="font-medium mb-1">Install {PRODUCT_NAME}</p>
          <p className="text-steel-400">
            Tap the Share button{' '}
            <span aria-label="Share icon" className="inline-block">
              &#8679;
            </span>{' '}
            then <strong>Add to Home Screen</strong> to install this app.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 text-steel-400 hover:text-steel-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    )
  }

  if (androidPrompt) {
    return (
      <div
        role="banner"
        className="relative flex items-center gap-3 bg-steel-800 border border-steel-700 rounded-lg mx-4 mt-2 p-3 text-sm text-steel-100"
      >
        <div className="flex-1">
          <p className="font-medium">Install {PRODUCT_NAME}</p>
          <p className="text-steel-400">Add to your home screen for quick access</p>
        </div>
        <button
          onClick={handleAndroidInstall}
          className="shrink-0 bg-brand-yellow text-steel-900 font-semibold px-3 py-1.5 rounded text-xs hover:opacity-90 transition-opacity"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 text-steel-400 hover:text-steel-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    )
  }

  return null
}
