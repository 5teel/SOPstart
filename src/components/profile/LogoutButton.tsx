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
      className="w-full h-[44px] flex items-center justify-center gap-2 rounded-xl bg-white border border-[var(--ink-100)] text-[var(--accent-escalate)] hover:bg-[var(--accent-escalate)]/5 hover:border-[var(--accent-escalate)]/30 transition-colors text-sm font-semibold disabled:opacity-50"
    >
      <LogOut size={16} />
      {pending ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
