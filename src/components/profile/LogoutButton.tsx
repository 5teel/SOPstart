'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { signOut } from '@/actions/auth'

export function LogoutButton() {
  const [pending, setPending] = useState(false)

  return (
    <button
      onClick={async () => {
        setPending(true)
        try {
          await signOut()
        } catch {
          // redirect() throws — expected on success
        }
      }}
      disabled={pending}
      className="w-full h-[44px] flex items-center justify-center gap-2 rounded-xl bg-steel-800 border border-steel-700 text-red-400 hover:bg-red-900/20 hover:border-red-500/30 transition-colors text-sm font-semibold disabled:opacity-50"
    >
      <LogOut size={16} />
      {pending ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
