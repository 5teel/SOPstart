import { create } from 'zustand'
import type { AckTraceEntry } from '@/types/sop'

interface WalkthroughState {
  // sopId -> array of completed stepIds (string[] for JSON serializability)
  completedSteps: Record<string, string[]>
  // sopId -> timestamp when acknowledged
  acknowledgedSops: Record<string, number>
  // stepId -> true when locked by EscalateBlock (lock mode)
  lockedSteps: Record<string, true>
  // Phase 15 D-21: sopId -> ordered list of step ack-button clicks (evidence of sequential reading)
  ackTrace: Record<string, AckTraceEntry[]>
  markStepComplete: (sopId: string, stepId: string) => void
  markStepIncomplete: (sopId: string, stepId: string) => void
  acknowledgeSafety: (sopId: string) => void
  isAcknowledged: (sopId: string) => boolean
  getCompletedSteps: (sopId: string) => Set<string>
  resetWalkthrough: (sopId: string) => void
  lockStep: (stepId: string) => void
  unlockStep: (stepId: string) => void
  // Phase 15 D-21: sequential ack-trace API
  markStepAcknowledged: (sopId: string, stepId: string) => void
  getHighestAckIndex: (sopId: string, allStepIds: string[]) => number
  getAckTrace: (sopId: string) => AckTraceEntry[]
}

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  completedSteps: {},
  acknowledgedSops: {},
  lockedSteps: {},
  ackTrace: {},

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
      const { [sopId]: _trace, ...remainingTrace } = state.ackTrace
      return {
        completedSteps: remainingSteps,
        acknowledgedSops: remainingAcks,
        ackTrace: remainingTrace,
      }
    }),

  lockStep: (stepId) =>
    set((state) => ({ lockedSteps: { ...state.lockedSteps, [stepId]: true } })),

  unlockStep: (stepId) =>
    set((state) => {
      const next = { ...state.lockedSteps }
      delete next[stepId]
      return { lockedSteps: next }
    }),

  // Phase 15 D-21: append-only ack-trace, dedupe by stepId (mirrors markStepComplete)
  markStepAcknowledged: (sopId, stepId) =>
    set((state) => {
      const existing = state.ackTrace[sopId] ?? []
      if (existing.some((entry) => entry.stepId === stepId)) return state
      return {
        ackTrace: {
          ...state.ackTrace,
          [sopId]: [...existing, { stepId, timestamp: Date.now() }],
        },
      }
    }),

  getHighestAckIndex: (sopId, allStepIds) => {
    const trace = get().ackTrace[sopId] ?? []
    if (trace.length === 0) return -1
    const ackedSet = new Set(trace.map((e) => e.stepId))
    // Walk from the end so we find the highest index in allStepIds that is acked.
    for (let i = allStepIds.length - 1; i >= 0; i--) {
      if (ackedSet.has(allStepIds[i])) return i
    }
    return -1
  },

  getAckTrace: (sopId) => get().ackTrace[sopId] ?? [],
}))
