/**
 * Phase 59 -- wide shell pane (stub; Wave 0 / 59-01). Requirement SHL-06; decisions D-02, A-12.
 * Owner: 59-03 (ShellFrame wide class + Esc guard). Registration: playwright.config.ts `phase59`.
 */
import { test } from '@playwright/test'

test.describe('shell wide', () => {
  test.fixme(true, 'flips live in 59-03')
  test('ShellFrame keeps the literal lg:w-100 detail width', () => {})
  test('the wide variant adds lg:w-[58%] lg:min-w-140 only when the place is wide', () => {})
  test('ShellFrame has exactly one setPlace( writer and one replaceState', () => {})
  test('the Escape handler returns early on defaultPrevented and on an aria-modal element (A-12)', () => {})
  test('PlantStage keeps its ResizeObserver refit so the map re-centres on a pane resize', () => {})
})
