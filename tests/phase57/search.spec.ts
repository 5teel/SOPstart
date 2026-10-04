/**
 * Phase 57 -- SHL-04 search lights shapes (Wave 0 / 57-01).
 * roomMatches is pure and LIVE from 57-01; the frame half is filled by 57-02.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import { roomMatches } from '@/lib/site/rooms'

test.describe('SHL-04 rooms', () => {
  test('an empty query matches no room', () => {
    expect([...roomMatches('', ['Eval convert fixture SOP'])]).toEqual([])
    expect([...roomMatches('   ', [])]).toEqual([])
  })

  test('a room matches by its name', () => {
    expect([...roomMatches('smoko', [])]).toEqual(['smoko'])
    expect([...roomMatches('Office', [])]).toEqual(['office'])
  })

  test('matching is case-insensitive and partial', () => {
    expect([...roomMatches('NOTICE', [])]).toEqual(['noticeboard'])
  })

  test('the Noticeboard also matches a site-wide SOP title', () => {
    expect([...roomMatches('convert', ['Eval convert fixture SOP'])]).toEqual(['noticeboard'])
  })

  test('a query that is neither a room nor a site SOP matches nothing', () => {
    expect([...roomMatches('press', ['x'])]).toEqual([])
  })
})

test.describe('SHL-04 frame', () => {
  test.fixme('the search box lights machine and room shapes that match [57-02]', () => {})
  test.fixme('askMatches accepts a map of id to { title } [57-02]', () => {})
})
