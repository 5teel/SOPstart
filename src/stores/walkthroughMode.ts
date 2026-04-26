'use client'
import { create } from 'zustand'

export type WalkthroughMode = 'immersive' | 'list'
const KEY = 'safestart.walkthrough-mode'

function readInitial(): WalkthroughMode {
  if (typeof window === 'undefined') return 'list'
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === 'immersive' || raw === 'list') return raw
  } catch {
    /* ignore */
  }
  return 'list'
}

interface State {
  mode: WalkthroughMode
  setMode: (m: WalkthroughMode) => void
}

export const useWalkthroughModeStore = create<State>((set) => ({
  mode: readInitial(),
  setMode: (m) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(KEY, m)
      } catch {
        /* ignore */
      }
    }
    set({ mode: m })
  },
}))
