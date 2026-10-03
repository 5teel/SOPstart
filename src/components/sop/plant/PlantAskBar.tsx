'use client'

/**
 * The on-scene ask bar (D-13) -- the page's one search query, relocated onto
 * the plant scene. Typing highlights matching machines and narrows the panel.
 */
import { Search, X } from 'lucide-react'

export function PlantAskBar({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <div className="pointer-events-auto flex h-12 max-w-140 flex-1 items-center gap-2.5 rounded-lg border border-[var(--ink-300)] bg-white/96 px-3 shadow">
      <label className="flex flex-1 items-center gap-2.5">
        <Search size={16} className="pointer-events-none text-[var(--ink-500)]" aria-hidden="true" />
        <input
          data-testid="plant-ask"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask or search… a machine or a procedure"
          aria-label="Ask or search SOPs"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-reading text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-500)] [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="grid h-8 w-8 place-items-center rounded text-[var(--ink-500)] hover:text-[var(--ink-900)]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
