/**
 * completionStore — Zustand store for durable step-level completion progress.
 *
 * IMPORTANT: This is a SEPARATE store from walkthrough.ts, which remains memory-only
 * by design (Phase 3 safety decision D-02: re-acknowledgement required per session).
 *
 * This store persists to Dexie on every mutation so that in-progress completions
 * survive app restarts (D-02 resume support for the completion record, not safety state).
 */
import { create } from 'zustand'
import { db, type LocalCompletion } from '@/lib/offline/db'

interface CompletionStoreState {
  // sopId -> LocalCompletion (active in-progress completions only)
  activeCompletions: Record<string, LocalCompletion>
  startCompletion: (sopId: string, sopVersion: number) => Promise<void>
  markStepCompleted: (sopId: string, stepId: string) => Promise<void>
  getActiveCompletion: (sopId: string) => LocalCompletion | null
  clearCompletion: (sopId: string) => Promise<void>
  restoreFromDexie: (sopId: string) => Promise<LocalCompletion | null>
}

export const useCompletionStore = create<CompletionStoreState>((set, get) => ({
  activeCompletions: {},

  /**
   * Start a new completion for a SOP. Creates a new LocalCompletion with a
   * client-generated UUID (idempotency key) and writes it to Dexie immediately.
   */
  startCompletion: async (sopId: string, sopVersion: number) => {
    const existing = get().activeCompletions[sopId]
    if (existing && existing.status === 'in_progress') {
      // Already in progress — do not create a duplicate
      return
    }

    const localId = crypto.randomUUID()
    const newCompletion: LocalCompletion = {
      localId,
      sopId,
      sopVersion,
      contentHash: '',  // computed at submission time
      stepCompletions: {},
      status: 'in_progress',
      startedAt: Date.now(),
    }

    // Write to Dexie for durability
    await db.completions.put(newCompletion)

    set((state) => ({
      activeCompletions: {
        ...state.activeCompletions,
        [sopId]: newCompletion,
      },
    }))
  },

  /**
   * Mark a step as completed. Records the current timestamp and writes the
   * updated completion record to Dexie.
   */
  markStepCompleted: async (sopId: string, stepId: string) => {
    const completion = get().activeCompletions[sopId]
    if (!completion) return

    const updated: LocalCompletion = {
      ...completion,
      stepCompletions: {
        ...completion.stepCompletions,
        [stepId]: Date.now(),
      },
    }

    // Write to Dexie for durability on every step
    await db.completions.put(updated)

    set((state) => ({
      activeCompletions: {
        ...state.activeCompletions,
        [sopId]: updated,
      },
    }))
  },

  /**
   * Get the active in-progress completion for a SOP (synchronous read from store).
   */
  getActiveCompletion: (sopId: string) => {
    return get().activeCompletions[sopId] ?? null
  },

  /**
   * Clear a completion from both Zustand state and Dexie.
   * Called after a successful submission to clean up.
   */
  clearCompletion: async (sopId: string) => {
    const completion = get().activeCompletions[sopId]
    if (completion) {
      await db.completions.delete(completion.localId)
    }

    set((state) => {
      const { [sopId]: _removed, ...remaining } = state.activeCompletions
      return { activeCompletions: remaining }
    })
  },

  /**
   * Restore an in-progress completion from Dexie after app restart.
   * Returns the restored LocalCompletion (or null if none found).
   * Call this on walkthrough page load to support D-02 resume.
   */
  restoreFromDexie: async (sopId: string) => {
    const existing = get().activeCompletions[sopId]
    if (existing) return existing

    const found = await db.completions
      .where('sopId')
      .equals(sopId)
      .and((c) => c.status === 'in_progress')
      .first()

    if (!found) return null

    set((state) => ({
      activeCompletions: {
        ...state.activeCompletions,
        [sopId]: found,
      },
    }))

    return found
  },
}))
