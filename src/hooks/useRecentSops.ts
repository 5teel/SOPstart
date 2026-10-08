'use client'
/**
 * Phase 63 -- Recent and Most used for the home list. The device half of Recent lives
 * in localStorage, read only through useSyncExternalStore with an empty server snapshot,
 * so the first render matches the server (CLAUDE.md 2026-06-08).
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { LibraryRow } from '@/hooks/useLibrary'
import { mergeRecent, mostUsed, parseRecent, pushRecent, recentKey } from '@/lib/library/recent'

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function useRecentSops(userId: string, rows: readonly LibraryRow[]) {
  const key = recentKey(userId)
  const subscribe = useCallback(
    (cb: () => void) => {
      const on = (e: StorageEvent) => {
        if (!e.key || e.key === key) cb()
      }
      window.addEventListener('storage', on)
      return () => window.removeEventListener('storage', on)
    },
    [key],
  )
  // A string snapshot is referentially stable while the stored text is unchanged.
  const raw = useSyncExternalStore(subscribe, () => read(key), () => '')

  const remember = useCallback(
    (rootId: string) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(pushRecent(parseRecent(read(key)), rootId)))
      } catch {
        return // storage refused (private mode): Recent just stays as it was
      }
      // The storage event only reaches OTHER tabs; tell this one.
      window.dispatchEvent(new StorageEvent('storage', { key }))
    },
    [key],
  )

  return useMemo(() => {
    const byRoot = new Map(rows.map((r) => [r.rootId, r]))
    const own = rows.filter((r) => r.lastAt).map((r) => ({ root: r.rootId, at: r.lastAt as string }))
    const recent = mergeRecent(parseRecent(raw), [], own)
      .map((root) => byRoot.get(root))
      .filter((r): r is LibraryRow => !!r)
    // Completions are already counted per lineage on each row; expand them for the shared ranking.
    const completions = rows.flatMap((r) => Array.from({ length: r.doneCount }, () => ({ root: r.rootId, status: 'done', title: r.title })))
    const most = mostUsed(completions)
      .map((m) => ({ row: byRoot.get(m.root), count: m.count }))
      .filter((m): m is { row: LibraryRow; count: number } => !!m.row)
    return { recent, mostUsed: most, remember }
  }, [raw, rows, remember])
}
