/**
 * Phase 58 -- FOC-04 (D-09, D-10, D-15, D-22): server walk actions.
 * Filled by: 58-09.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test } from '@playwright/test'

test.describe("FOC-04 walk actions", () => {
  test.fixme("startWalk, recordWalkStep, startOverWalk take no organisation, user or agent parameter (58-09)", () => {})
  test.fixme("every walk read and write is scoped to the session org and the session worker (58-09)", () => {})
  test.fixme("the step belongs to the walk's SOP (58-09)", () => {})
  test.fixme("acknowledgements are accepted only on hazard and ppe steps (58-09)", () => {})
  test.fixme("step order is enforced unless the SOP allows forward jump (D-09) (58-09)", () => {})
  test.fixme("photo paths match the exact {org}/completions/{walkId}/{photoId}.{jpg|png} shape (58-09)", () => {})
  test.fixme("submitCompletion recomputes from the walk row and refuses a missing ack or photo (D-10, D-15, D-22) (58-09)", () => {})
})
