/**
 * completionStore -- in-memory progress for the current walk.
 *
 * Separate from walkthrough.ts, which is also memory-only by design (Phase 3
 * safety decision D-02: re-acknowledgement required per session). Nothing here
 * is persisted; a reload starts the walk again.
 */
import { create } from 'zustand'

export interface LocalCompletion {
  localId: string                         // client UUID -- idempotency key
  sopId: string
  sopVersion: number
  contentHash: string                     // computed at submission time
  stepCompletions: Record<string, number> // stepId -> completedAt (ms)
  status: 'in_progress'
  startedAt: number
}

interface CompletionStoreState {
  // sopId -> LocalCompletion (active in-progress completions only)
  activeCompletions: Record<string, LocalCompletion>
  startCompletion: (sopId: string, sopVersion: number) => void
  markStepCompleted: (sopId: string, stepId: string) => void
  getActiveCompletion: (sopId: string) => LocalCompletion | null
  clearCompletion: (sopId: string) => void
}

export const useCompletionStore = create<CompletionStoreState>((set, get) => ({
  activeCompletions: {},

  startCompletion: (sopId, sopVersion) => {
    if (get().activeCompletions[sopId]) return // already in progress
    const newCompletion: LocalCompletion = {
      localId: crypto.randomUUID(),
      sopId,
      sopVersion,
      contentHash: '',
      stepCompletions: {},
      status: 'in_progress',
      startedAt: Date.now(),
    }
    set((state) => ({
      activeCompletions: { ...state.activeCompletions, [sopId]: newCompletion },
    }))
  },

  markStepCompleted: (sopId, stepId) => {
    const completion = get().activeCompletions[sopId]
    if (!completion) return
    set((state) => ({
      activeCompletions: {
        ...state.activeCompletions,
        [sopId]: {
          ...completion,
          stepCompletions: { ...completion.stepCompletions, [stepId]: Date.now() },
        },
      },
    }))
  },

  getActiveCompletion: (sopId) => get().activeCompletions[sopId] ?? null,

  clearCompletion: (sopId) => {
    set((state) => {
      const { [sopId]: _removed, ...remaining } = state.activeCompletions
      return { activeCompletions: remaining }
    })
  },
}))
