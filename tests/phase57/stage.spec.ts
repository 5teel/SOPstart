/**
 * Phase 57 -- PLC-01 / SHL-02 the stage (57-02).
 * Source-contract assertions on PlantStage's room layer and focus replay.
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs
  .readFileSync(path.resolve(__dirname, '..', '..', 'src', 'components', 'sop', 'plant', 'PlantStage.tsx'), 'utf-8')
  .replace(/\r\n/g, '\n')

test.describe('PLC-01 stage rooms', () => {
  test('PlantStage draws room hit-areas after the machines, so a room wins an overlap', () => {
    expect(SRC).toContain('export interface PlantStageRoom')
    const room = SRC.indexOf('data-testid="plant-room"')
    const machine = SRC.indexOf('data-testid="plant-machine"')
    expect(machine).toBeGreaterThan(-1)
    expect(room).toBeGreaterThan(machine)
  })

  test('a room polygon carries its data attributes, is keyboard-reachable and has a dashed rest outline', () => {
    for (const attr of ['data-room-id=', 'data-selected=', 'data-highlighted=', 'data-pin=']) {
      expect(SRC.slice(SRC.indexOf('data-testid="plant-room"'))).toContain(attr)
    }
    expect(SRC).toContain("strokeDasharray: '2 5'")
    expect(SRC).toContain('Math.min(2.4, 1 /')
  })

  test('the signposts are always visible: the signpost block never consults labelVisible', () => {
    const at = SRC.indexOf('data-testid="plant-room-sign"')
    expect(at).toBeGreaterThan(-1)
    const block = SRC.slice(SRC.lastIndexOf('rooms.map', at))
    expect(block).not.toContain('labelVisible')
    expect(block).toContain('data-testid="plant-room-pin"')
    expect(block).toMatch(/r\.pin > 0/)
  })

  test('a room click and Enter/Space call onRoomClick with the room id', () => {
    expect(SRC).toMatch(/onClick=\{\(\)\s*=>\s*onRoomClick\?\.\(r\.id\)\}/)
    expect((SRC.match(/onRoomClick\?\.\(r\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  test('flyTo finds machines then rooms and passes flyInset to flyToView (default keeps the old panel offset)', () => {
    expect(SRC).toMatch(/machines\.find\(.*\)\s*\?\?\s*rooms\.find\(/)
    expect(SRC).toMatch(/flyToView\(.*FLY_SCALE,\s*flyInset\)/)
    expect(SRC).toContain('flyInset = PLANT_PANEL_WIDTH')
  })
})

test.describe('SHL-02 stage focus', () => {
  test('the last camera intent is stored as fit / fly / box / free', () => {
    expect(SRC).not.toContain('followFitRef')
    for (const kind of ["'fit'", "'fly'", "'box'", "'free'"]) expect(SRC).toContain(`kind: ${kind}`)
  })

  test('a user pan or wheel sets the focus to free, so a resize does not fight the user', () => {
    const wheel = SRC.slice(SRC.indexOf('const onWheel'), SRC.indexOf("el.addEventListener('wheel'"))
    expect(wheel).toContain("focusRef.current = { kind: 'free' }")
    const down = SRC.slice(SRC.indexOf('function handlePointerDown'), SRC.indexOf('function handlePointerMove'))
    expect(down).toContain("focusRef.current = { kind: 'free' }")
  })

  test('the ResizeObserver replays the stored focus; a null view still fits', () => {
    const ro = SRC.slice(SRC.indexOf('new ResizeObserver('), SRC.indexOf('ro.observe('))
    expect(ro).toContain('viewRef.current === null')
    expect(ro).toContain('fit()')
    expect(ro).toContain('replayRef.current()')
  })

  test('the stage stays free of the router and the canvas engine', () => {
    expect(SRC).not.toMatch(/from ['"]next\/navigation['"]/)
    expect(SRC).not.toMatch(/useRouter/)
    expect(SRC).not.toMatch(/konva/i)
  })
})
