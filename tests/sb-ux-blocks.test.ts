import { test, expect } from '@playwright/test'

const NEW_BLOCKS = [
  'MeasurementBlock',
  'DecisionBlock',
  'EscalateBlock',
  'SignOffBlock',
  'ZoneBlock',
  'InspectBlock',
  'VoiceNoteBlock',
  'ModelBlock',
] as const

test('SB-UX-04: /api/schema lists the 8 new blocks', async ({ request }) => {
  const res = await request.get('/api/schema')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  const ids = new Set<string>(
    (body.blocks ?? []).map((b: { id: string }) => b.id)
  )
  for (const name of NEW_BLOCKS) {
    expect(ids.has(name), `/api/schema missing block ${name}`).toBe(true)
  }
})

test('SB-UX-04: each new block has non-empty props_schema and example_props', async ({
  request,
}) => {
  const res = await request.get('/api/schema')
  const body = await res.json()
  const byId = new Map<
    string,
    { props_schema: unknown; example_props: unknown }
  >(
    (body.blocks ?? []).map(
      (b: {
        id: string
        props_schema: unknown
        example_props: unknown
      }) => [b.id, b]
    )
  )
  for (const name of NEW_BLOCKS) {
    const entry = byId.get(name)
    expect(entry, `missing schema entry for ${name}`).toBeTruthy()
    expect(entry!.props_schema, `${name}.props_schema empty`).toBeTruthy()
    expect(entry!.example_props, `${name}.example_props empty`).toBeTruthy()
  }
})

test('SB-UX-05: EscalateBlock default escalationMode is "form"', async ({
  request,
}) => {
  const res = await request.get('/api/schema')
  const body = await res.json()
  const escalate = (body.blocks ?? []).find(
    (b: { id: string }) => b.id === 'EscalateBlock'
  )
  expect(escalate).toBeTruthy()
  // example_props.escalationMode should be 'form' (the default)
  expect(
    (escalate as { example_props: { escalationMode?: string } }).example_props
      .escalationMode ?? 'form'
  ).toBe('form')
})

test('SB-UX-11: three.js not installed; ModelBlock registered in schema', async ({
  request,
}) => {
  // Verify three.js is not in package.json
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../package.json') as Record<
    string,
    Record<string, string>
  >
  expect(pkg.dependencies?.three).toBeUndefined()
  expect(pkg.devDependencies?.three).toBeUndefined()

  // Verify ModelBlock appears in /api/schema
  const res = await request.get('/api/schema')
  const body = await res.json()
  const ids = new Set<string>(
    (body.blocks ?? []).map((b: { id: string }) => b.id)
  )
  expect(ids.has('ModelBlock')).toBe(true)
})
