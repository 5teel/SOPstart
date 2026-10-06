/**
 * Phase 57 -- SHL-04 search lights shapes (57-01 pure half, 57-02 frame half).
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { roomMatches } from '@/lib/site/rooms'
import { askMatches } from '@/lib/sop/worker-signal'

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
  const FRAME = fs
    .readFileSync(path.resolve(__dirname, '..', '..', 'src', 'components', 'shell', 'ShellFrame.tsx'), 'utf-8')
    .replace(/\r\n/g, '\n')

  test('the search box filters the list and lights machine and room shapes through askMatches and roomMatches', () => {
    expect(FRAME).toContain('askMatches(query, machines, links, sopsById)')
    expect(FRAME).toContain('roomMatches(query, siteSopTitles)')
    expect(FRAME).toContain('highlighted: machineHits.has(m.id)')
    expect(FRAME).toContain('highlighted: roomHits.has(r.id)')
    expect(FRAME).toContain('shownMachines = searching ? machines.filter((m) => machineHits.has(m.id))')
    expect(FRAME).toContain('shownRooms = searching ? rooms.filter((r) => roomHits.has(r.id))')
    expect(FRAME).toContain('Nothing matches')
  })

  test('askMatches accepts a map of id to { title }', () => {
    const machines = [
      { id: 'm1', name: 'Press' },
      { id: 'm2', name: 'Oven' },
    ]
    const links = [{ sop_id: 's1', machine_id: 'm2' }]
    const sops = new Map([['s1', { title: 'Lockout procedure' }]])
    expect([...askMatches('lockout', machines, links, sops)]).toEqual(['m2'])
    expect([...askMatches('press', machines, links, sops)]).toEqual(['m1'])
    expect([...askMatches('', machines, links, sops)]).toEqual([])
  })
})
