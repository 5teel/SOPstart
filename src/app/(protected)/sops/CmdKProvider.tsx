'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { CommandPalette } from '@/components/sop/CommandPalette'
import { useSopDetail } from '@/hooks/useSopDetail'

export function CmdKProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const sopIdMatch = pathname?.match(/\/sops\/([^/]+)/)
  const sopId = sopIdMatch?.[1] ?? null

  const { data: sop } = useSopDetail(sopId ?? '')
  const [cmdOpen, setCmdOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      if (document.querySelector('[aria-modal="true"]')) return
      setCmdOpen((prev) => !prev)
    }
    if (e.key === 'Escape') setCmdOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      {children}
      {sop && sopId && (
        <CommandPalette
          sop={sop}
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
        />
      )}
    </>
  )
}
