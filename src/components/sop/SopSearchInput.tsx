'use client'
import { useEffect, useRef } from 'react'
import { Search, SearchX } from 'lucide-react'
import { SopLibraryCard } from '@/components/sop/SopLibraryCard'
import type { CachedSop } from '@/lib/offline/db'

interface SopSearchInputProps {
  searchTerm: string
  onSearch: (term: string) => void
  onClose: () => void
  results: CachedSop[]
}

export function SopSearchInput({ searchTerm, onSearch, onClose, results }: SopSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const showNoResults = searchTerm.length > 0 && results.length === 0

  return (
    <div className="fixed inset-0 z-40 bg-steel-900 flex flex-col transition-transform duration-200 ease-out translate-y-0">
      {/* Search input bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-steel-700 flex-shrink-0">
        <Search size={20} className="text-steel-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search SOPs..."
          className="flex-1 bg-transparent text-base text-steel-100 placeholder:text-steel-400 outline-none h-[40px]"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-brand-yellow hover:text-amber-400 flex-shrink-0 px-2"
        >
          Cancel
        </button>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {showNoResults ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <SearchX size={40} className="text-steel-600" />
            <div>
              <p className="text-lg font-semibold text-steel-100">Nothing matched</p>
              <p className="text-sm text-steel-400 mt-1">
                Try a different search term or check your spelling.
              </p>
            </div>
          </div>
        ) : (
          results.map((sop) => (
            <SopLibraryCard key={sop.id} sop={sop} isCached={true} />
          ))
        )}
      </div>
    </div>
  )
}
