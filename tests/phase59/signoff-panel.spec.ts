/**
 * Phase 59 -- sign-off panel (stub; Wave 0 / 59-01). Requirement OFF-02; decisions A-08, A-12.
 * Owner: 59-08. Registration: playwright.config.ts `phase59`.
 */
import { test } from '@playwright/test'

test.describe('signoff panel', () => {
  test.fixme(true, 'flips live in 59-08')
  test('the panel reproduces the assessor teaching copy for a non-assessor and still lets them reject (A-08)', () => {})
  test('an admin gets an override reason field; Sign off stays disabled until it is filled', () => {})
  test('Reject requires a reason of at least 10 characters', () => {})
  test('the raw ASSESSOR_OVERRIDE_REQUIRED code is handled, never shown', () => {})
  test('photos render as a thumbnail strip that opens a lightbox', () => {})
  test('the lightbox and the reason dialog carry role dialog and aria-modal so Escape closes only that layer (A-12)', () => {})
})
