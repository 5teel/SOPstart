import { create } from 'zustand'

interface NetworkStore {
  isOnline: boolean
  lastOnlineAt: Date | null
  setOnline: (online: boolean) => void
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  // SSR-safe default: must NOT read navigator at module-load. The server has no
  // navigator (→ true), but the client would seed from navigator.onLine, so any
  // value rendered from isOnline during the first paint (e.g. the builder SAVE
  // pill) would mismatch between server and client → React #418 hydration error.
  // The real status is synced post-mount by useOnlineStatus (effect = client-only,
  // runs after hydration). See CLAUDE.md [2026-06-08] hydration learning.
  isOnline: true,
  lastOnlineAt: null,
  setOnline: (online) =>
    set({
      isOnline: online,
      lastOnlineAt: online ? new Date() : null,
    }),
}))
