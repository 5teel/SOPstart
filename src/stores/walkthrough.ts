import { create } from 'zustand'

interface WalkthroughState {
  // sopId -> array of completed stepIds (string[] for JSON serializability)
  completedSteps: Record<string, string[]>
  // sopId -> timestamp when acknowledged
  acknowledgedSops: Record<string, number>
  markStepComplete: (sopId: string, stepId: string) => void
  markStepIncomplete: (sopId: string, stepId: string) => void
  acknowledgeSafety: (sopId: string) => void
  isAcknowledged: (sopId: string) => boolean
  getCompletedSteps: (sopId: string) => Set<string>
  resetWalkthrough: (sopId: string) => void
}

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  completedSteps: {},
  acknowledgedSops: {},

  markStepComplete: (sopId, stepId) =>
    set((state) => {
      const existing = state.completedSteps[sopId] ?? []
      if (existing.includes(stepId)) return state
      return {
        completedSteps: {
          ...state.completedSteps,
          [sopId]: [...existing, stepId],
        },
      }
    }),

  markStepIncomplete: (sopId, stepId) =>
    set((state) => {
      const existing = state.completedSteps[sopId] ?? []
      return {
        completedSteps: {
          ...state.completedSteps,
          [sopId]: existing.filter((id) => id !== stepId),
        },
      }
    }),

  acknowledgeSafety: (sopId) =>
    set((state) => ({
      acknowledgedSops: {
        ...state.acknowledgedSops,
        [sopId]: Date.now(),
      },
    })),

  isAcknowledged: (sopId) => {
    const ts = get().acknowledgedSops[sopId]
    return !!ts
  },

  getCompletedSteps: (sopId) => {
    const steps = get().completedSteps[sopId] ?? []
    return new Set(steps)
  },

  resetWalkthrough: (sopId) =>
    set((state) => {
      const { [sopId]: _steps, ...remainingSteps } = state.completedSteps
      const { [sopId]: _ack, ...remainingAcks } = state.acknowledgedSops
      return {
        completedSteps: remainingSteps,
        acknowledgedSops: remainingAcks,
      }
    }),
}))
