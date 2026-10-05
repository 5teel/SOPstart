/**
 * Phase 59 -- inbox model (stub; Wave 0 / 59-01). Requirements OFF-01, OFF-02, OFF-04;
 * decisions D-04, D-05, A-01, A-11. Owner: 59-04. Registration: playwright.config.ts `phase59`.
 */
import { test } from '@playwright/test'

test.describe('inbox model', () => {
  test.fixme(true, 'flips live in 59-04')
  test('deriveInbox adds signoff and review kinds; legacy call shapes still valid (optional inputs)', () => {})
  test('chip order is All, Owner, Overdue, Approve, Sign-off, Stuck, Machines', () => {})
  test('an owned SOP that is also overdue yields one row, not two (dedupe of owned rows)', () => {})
  test('counts per chip and the pin total come from the same derive call; empty is 0', () => {})
  test('row action labels: Assign owner, Mark reviewed, Sign off, Approve, and the stuck / machine actions', () => {})
  test('a supervisor inbox holds sign-off rows only, and never the supervisor own walk', () => {})
  test('relativeWhen, nzDay, nzDateTime and reviewSegment format as the spec states (NZ dates)', () => {})
  test('memberLabel falls back to an email, never "role (uuid8)" (A-07)', () => {})
})
