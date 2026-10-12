'use client'

/**
 * Asks Android users to put SOPstart on their home screen. Shows only when the
 * browser offers the install (Chrome / Samsung Internet fire `beforeinstallprompt`,
 * and stop firing it once the app is installed), never inside the installed app,
 * and stays quiet for two weeks after "Not now".
 * ponytail: browsers without the event (Firefox) get no prompt; add menu instructions if asked.
 */
import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const KEY = 'sopstart-install-dismissed'
const QUIET_MS = 14 * 24 * 60 * 60 * 1000

function snooze() {
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {}
}

export function InstallPrompt() {
  const [offer, setOffer] = useState<InstallEvent | null>(null)

  useEffect(() => {
    if (!/Android/i.test(navigator.userAgent) || matchMedia('(display-mode: standalone)').matches) return
    try {
      if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < QUIET_MS) return
    } catch {}
    const onOffer = (e: Event) => {
      e.preventDefault()
      setOffer(e as InstallEvent)
    }
    const onInstalled = () => setOffer(null)
    window.addEventListener('beforeinstallprompt', onOffer)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onOffer)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!offer) return null

  async function install() {
    await offer!.prompt()
    if ((await offer!.userChoice).outcome === 'dismissed') snooze()
    setOffer(null)
  }

  return (
    <div data-testid="install-prompt" role="region" aria-label="Install SOPstart" className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-ink-200 bg-paper-1 p-3">
      <p className="min-w-0 flex-1 text-meta text-ink-700">
        <span className="block text-ui font-semibold text-ink-900">Add SOPstart to your home screen</span>
        Opens full screen, one tap away.
      </p>
      <button
        type="button"
        data-testid="install-later"
        onClick={() => {
          snooze()
          setOffer(null)
        }}
        className="min-h-tap shrink-0 px-2 text-ui text-ink-600"
      >
        Not now
      </button>
      <button type="button" data-testid="install-app" onClick={() => void install()} className="min-h-tap shrink-0 rounded-lg bg-ink-900 px-4 text-ui font-medium text-paper">
        Install
      </button>
    </div>
  )
}
