'use client'

/**
 * Phase 26 (R4) — the inline dashed-purple smart-ghost affordance.
 *
 * Sits between blocks (like the ＋ dividers). Starts `.dim` (opacity-30) and is
 * promoted to live / gone by `useSmartGhosts` via `classList` toggles on the
 * registered ref — never via re-render (RESEARCH Pattern 4). Purple `--ai`
 * accent per 26-UI-SPEC (AI-origin marker only). Tab (global, handled by the
 * hook) or click accepts.
 */
import type { GhostSpec } from './useSmartGhosts'

interface GhostRowProps {
  ghost: GhostSpec
  registerRef: (afterIndex: number) => (el: HTMLElement | null) => void
  onEnter: (afterIndex: number) => void
  onLeave: (afterIndex: number) => void
  onClick: (afterIndex: number) => void
}

export function GhostRow({ ghost, registerRef, onEnter, onLeave, onClick }: GhostRowProps) {
  return (
    <div
      ref={registerRef(ghost.afterIndex)}
      data-smart-ghost
      data-after={ghost.afterIndex}
      role="button"
      tabIndex={-1}
      onClick={() => onClick(ghost.afterIndex)}
      onMouseEnter={() => onEnter(ghost.afterIndex)}
      onMouseLeave={() => onLeave(ghost.afterIndex)}
      className="my-[2px] flex cursor-pointer items-center gap-[9px] rounded-md border border-dashed border-[#8b5cf6] bg-[rgba(139,92,246,0.06)] px-3 py-[9px] text-[11px] text-[#8b5cf6] opacity-30 transition-opacity duration-150 hover:bg-[rgba(139,92,246,0.12)] hover:opacity-100"
    >
      <span className="rounded-[3px] bg-[#8b5cf6] px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-wider text-white">
        Tab
      </span>
      <span>
        ✦ add <b>{ghost.label}</b> — {ghost.why}
      </span>
      <span className="ml-auto text-[10px] text-[var(--ink-500,#71717a)]">or ＋</span>
    </div>
  )
}
