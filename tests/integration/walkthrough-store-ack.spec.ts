/**
 * SB-LINE-02 / D-21 — walkthrough store ack-trace API unit coverage.
 *
 * Exercises the Phase 15 extensions to `useWalkthroughStore` in isolation:
 *   - markStepAcknowledged (append-once dedupe)
 *   - getHighestAckIndex (returns highest index in allStepIds that is acked, -1 if none)
 *   - getAckTrace (ordered array per sopId, empty if no entries)
 *   - resetWalkthrough also clears ackTrace
 *
 * The store is plain Zustand state with no DOM dependency — we instantiate
 * it in the Node test process and call its methods directly. No browser
 * navigation, no baseURL required.
 *
 * Phase 15-01 plan Task 4 acceptance — these tests must PASS (not test.fixme).
 */
import { test, expect } from '@playwright/test'

import { useWalkthroughStore } from '@/stores/walkthrough'

test.describe('Phase 15 D-21 — walkthrough store ack-trace', () => {
  // Reset shared store state between tests (the store is a singleton).
  test.beforeEach(() => {
    useWalkthroughStore.setState({
      completedSteps: {},
      acknowledgedSops: {},
      lockedSteps: {},
      ackTrace: {},
    })
  })

  test('markStepAcknowledged appends one entry with stepId + timestamp', () => {
    const before = Date.now()
    useWalkthroughStore.getState().markStepAcknowledged('sop-a', 'step-1')
    const after = Date.now()
    const trace = useWalkthroughStore.getState().getAckTrace('sop-a')
    expect(trace).toHaveLength(1)
    expect(trace[0].stepId).toBe('step-1')
    expect(trace[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(trace[0].timestamp).toBeLessThanOrEqual(after)
  })

  test('markStepAcknowledged is idempotent — second call for same stepId does not duplicate', () => {
    const s = useWalkthroughStore.getState()
    s.markStepAcknowledged('sop-a', 'step-1')
    s.markStepAcknowledged('sop-a', 'step-1')
    expect(useWalkthroughStore.getState().getAckTrace('sop-a')).toHaveLength(1)
  })

  test('getHighestAckIndex returns -1 when nothing acked, then climbs as steps are acked', () => {
    const stepIds = ['step-1', 'step-2', 'step-3']
    const s = useWalkthroughStore.getState()
    expect(s.getHighestAckIndex('sop-a', stepIds)).toBe(-1)
    s.markStepAcknowledged('sop-a', 'step-1')
    expect(useWalkthroughStore.getState().getHighestAckIndex('sop-a', stepIds)).toBe(0)
    useWalkthroughStore.getState().markStepAcknowledged('sop-a', 'step-2')
    expect(useWalkthroughStore.getState().getHighestAckIndex('sop-a', stepIds)).toBe(1)
  })

  test('getAckTrace returns [] for an unknown sopId', () => {
    expect(useWalkthroughStore.getState().getAckTrace('sop-never-touched')).toEqual([])
  })

  test('resetWalkthrough also clears ackTrace for that sopId', () => {
    const s = useWalkthroughStore.getState()
    s.markStepAcknowledged('sop-a', 'step-1')
    s.markStepAcknowledged('sop-b', 'step-1')
    useWalkthroughStore.getState().resetWalkthrough('sop-a')
    expect(useWalkthroughStore.getState().getAckTrace('sop-a')).toEqual([])
    // sop-b untouched
    expect(useWalkthroughStore.getState().getAckTrace('sop-b')).toHaveLength(1)
  })

  test('existing markStepComplete behaviour preserved (Phase 12.5 non-regression)', () => {
    const s = useWalkthroughStore.getState()
    s.markStepComplete('sop-a', 'step-1')
    s.markStepComplete('sop-a', 'step-1') // dedupe
    s.markStepComplete('sop-a', 'step-2')
    const completed = useWalkthroughStore.getState().getCompletedSteps('sop-a')
    expect(completed.size).toBe(2)
    expect(completed.has('step-1')).toBe(true)
    expect(completed.has('step-2')).toBe(true)
  })
})
