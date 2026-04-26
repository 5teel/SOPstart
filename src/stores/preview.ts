'use client'
import { create } from 'zustand'

export type PreviewViewport = 'desktop' | 'mobile'

interface PreviewState {
  viewport: PreviewViewport
  setViewport: (v: PreviewViewport) => void
}

const STORAGE_KEY = 'safestart.preview-viewport'

function readInitial(): PreviewViewport {
  if (typeof window === 'undefined') return 'desktop'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'mobile' || raw === 'desktop') return raw
  } catch { /* private mode / disabled storage — ignore */ }
  return 'desktop'
}

export const usePreviewStore = create<PreviewState>((set) => ({
  viewport: readInitial(),
  setViewport: (v) => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(STORAGE_KEY, v) } catch { /* ignore */ }
    }
    set({ viewport: v })
  },
}))
