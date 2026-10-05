/**
 * Phase 58 -- FOC-01, FOC-03 (D-26): the focus frame's structure.
 * Decisions: top bar, rail, column, Esc order, Back behaviour.
 * Filled by: 58-10 (frame + browse), 58-11 (walk UI, placeForPath).
 * Registration: playwright.config.ts `phase58` project.
 */
import { test } from '@playwright/test'

test.describe("FOC-01/FOC-03 focus frame", () => {
  test.fixme("top bar carries Back and the SOP title only (58-10)", () => {})
  test.fixme("rail is w-75 and the reading column is max-w-205 (58-10)", () => {})
  test.fixme("placeForPath returns null for every /sops/* path so the focus frame owns the top bar (58-11)", () => {})
  test.fixme("no focus file imports a shell testid or shell component (58-10)", () => {})
  test.fixme("Esc closes a dialog first, then leaves a field, then goes Back (58-10)", () => {})
  test.fixme("Back navigates to backHref via router.push from a user event, never from a mount effect (D-26, CLAUDE.md 2026-09-29) (58-10)", () => {})
})
