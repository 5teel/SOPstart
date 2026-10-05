/**
 * Phase 59 -- people tab (stub; Wave 0 / 59-01). Requirement OFF-05; decision D-11.
 * Owner: 59-11. Registration: playwright.config.ts `phase59`.
 */
import { test } from '@playwright/test'

test.describe('people tab', () => {
  test.fixme(true, 'flips live in 59-11')
  test('the table has name, email, role select, departments, status and Remove columns', () => {})
  test('the role select calls the safe role writer, never the retired one', () => {})
  test('Remove asks for confirmation in an aria-modal dialog', () => {})
  test('the department picker is the existing member_departments picker, unchanged', () => {})
  test('Invited shows as a status chip and an invite form takes an email and a role', () => {})
})
