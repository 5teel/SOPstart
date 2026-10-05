/**
 * Phase 60 -- Capability matrix rows (stub; Wave 0 / 60-01).
 * Requirements: RQS-01, RQS-02, RQS-03, OBJ-01. Decisions: D-01, D-07, D-10. Owning plan: 60-02 / 60-04 / 60-06 / 60-09 / 60-11 / 60-17.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test } from '@playwright/test'

test.describe("Capability matrix rows (60-02 / 60-04 / 60-06 / 60-09 / 60-11 / 60-17)", () => {
  test.fixme("60-02: read rows for requests, notifications and objectives", () => {})
  test.fixme("60-04: raiseRequest, withdrawRequest, answerRequest and listMyRequests rows", () => {})
  test.fixme("60-06: askToDoSop, declineAsk, stopAsking and listAskTargets rows", () => {})
  test.fixme("60-09: setObjective, clearObjective, confirmObjective and listObjectives rows", () => {})
  test.fixme("60-11: Office Requests tab rows (existing labels are never renamed, phase46 pins them)", () => {})
  test.fixme("60-17: the four removed assign rows are gone and the reassignment path is described as a request", () => {})
})
