import { create } from 'zustand'

interface NetworkStore {
  isOnline: boolean
  lastOnlineAt: Date | null
  setOnline: (online: boolean) => void
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastOnlineAt: null,
  setOnline: (online) =>
    set({
      isOnline: online,
      lastOnlineAt: online ? new Date() : null,
    }),
}))
