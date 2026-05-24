'use client'

/**
 * Phase 21 (Plan 21-04 Task 1) — VerifyChecklist keyboard bindings.
 *
 * Spike 004 contract (locked):
 *   j     → next block (down)
 *   k     → previous block (up)
 *   a     → approve  (= verifyBlock + implicit ack of any flags on that block)
 *   d     → decline-revisit  (= unverifyBlock — flags remain visible)
 *   Enter → focus source pane on the active block's provenance region
 *
 * Gating rules:
 *   - Listener attaches to `window`.
 *   - Ignored when the active element is an <input>, <textarea>, or
 *     contenteditable surface (Spike 004 finding #4 — never steal keys from
 *     a wizard form).
 *   - Each handler calls preventDefault() to suppress browser-default
 *     behaviour (e.g. `Enter` form submit, `j`/`k` find-link in Firefox).
 *
 * Auditability: ALL consumers of these bindings (the Gate component itself
 * + any future progressive-disclosure UI) import THIS module. One map, one
 * source of truth. Spike 004 doc references this file path as the contract.
 */

import { useEffect } from 'react'

export type ChecklistKeybindHandlers = {
  blocks: ReadonlyArray<{ id: string }>
  activeIdx: number
  setActiveIdx: (idx: number) => void
  approve: (blockId: string) => void
  decline: (blockId: string) => void
  /** Called when admin presses Enter — scrolls source pane to the active block. */
  focusSourcePane: (blockId: string) => void
  /**
   * Optional gate — when false, no keys are processed. Used to disable the
   * listener while a modal is open or while the gate is hidden (CONV-12
   * AI-prompt SOPs).
   */
  enabled?: boolean
}

const NAV_NEXT = 'j'
const NAV_PREV = 'k'
const APPROVE = 'a'
const DECLINE = 'd'
const FOCUS_SOURCE = 'Enter'

/**
 * Spike 004 keyboard map exported as a literal for test introspection and
 * for the on-screen help affordance. Do NOT inline these letters anywhere
 * else — change them here and they change everywhere.
 */
export const CHECKLIST_KEYBINDS = {
  next: NAV_NEXT,
  prev: NAV_PREV,
  approve: APPROVE,
  decline: DECLINE,
  focusSource: FOCUS_SOURCE,
} as const

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export function useChecklistKeybinds(h: ChecklistKeybindHandlers): void {
  const { blocks, activeIdx, setActiveIdx, approve, decline, focusSourcePane } = h
  const enabled = h.enabled !== false

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return
      // Skip when modifier keys are held — leave Ctrl/Meta/Alt combos to the OS.
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key
      if (key === NAV_NEXT) {
        e.preventDefault()
        const next = Math.min(blocks.length - 1, activeIdx + 1)
        setActiveIdx(next)
        return
      }
      if (key === NAV_PREV) {
        e.preventDefault()
        const prev = Math.max(0, activeIdx - 1)
        setActiveIdx(prev)
        return
      }
      if (key === APPROVE) {
        e.preventDefault()
        const block = blocks[activeIdx]
        if (block) approve(block.id)
        return
      }
      if (key === DECLINE) {
        e.preventDefault()
        const block = blocks[activeIdx]
        if (block) decline(block.id)
        return
      }
      if (key === FOCUS_SOURCE) {
        e.preventDefault()
        const block = blocks[activeIdx]
        if (block) focusSourcePane(block.id)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocks, activeIdx, setActiveIdx, approve, decline, focusSourcePane, enabled])
}
