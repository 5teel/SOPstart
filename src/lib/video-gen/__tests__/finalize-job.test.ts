import { test, expect } from '@playwright/test'
import { finalizeRenderJob, type FinalizableJob } from '@/lib/video-gen/finalize-job'
import type { ShotstackRenderResponse } from '@/lib/video-gen/types'

// Minimal fake admin client capturing the last status update. The finalizer
// only touches .storage.upload and .from('...').update(...).eq(...).
function fakeAdmin() {
  const updates: Record<string, unknown>[] = []
  const admin = {
    storage: {
      from: () => ({ upload: async () => ({ error: null }) }),
    },
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updates.push(payload)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }
  return { admin: admin as never, updates }
}

const job: FinalizableJob = { id: 'j1', sop_id: 's1', organisation_id: 'o1', status: 'rendering' }

test('idempotent: already-ready job is a no-op (no re-download, no update)', async () => {
  const { admin, updates } = fakeAdmin()
  const res = await finalizeRenderJob(admin, { ...job, status: 'ready' }, {
    status: 'done',
    url: 'https://cdn/x.mp4',
  } as ShotstackRenderResponse)
  expect(res.outcome).toBe('already_ready')
  expect(updates).toHaveLength(0)
})

test('done + url → downloads and marks ready', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = (async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch
  try {
    const { admin, updates } = fakeAdmin()
    const res = await finalizeRenderJob(admin, job, {
      status: 'done',
      url: 'https://cdn/x.mp4',
    } as ShotstackRenderResponse)
    expect(res.outcome).toBe('recovered')
    expect(updates[0]?.status).toBe('ready')
    expect(updates[0]?.video_url).toBe('o1/s1/video/j1.mp4')
  } finally {
    globalThis.fetch = orig
  }
})

test('expired Shotstack URL (non-ok) → download_failed, no ready write', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = (async () => ({ ok: false, status: 403 })) as unknown as typeof fetch
  try {
    const { admin, updates } = fakeAdmin()
    const res = await finalizeRenderJob(admin, job, {
      status: 'done',
      url: 'https://cdn/expired.mp4',
    } as ShotstackRenderResponse)
    expect(res.outcome).toBe('download_failed')
    expect(updates).toHaveLength(0)
  } finally {
    globalThis.fetch = orig
  }
})

test('render failed → marks job failed', async () => {
  const { admin, updates } = fakeAdmin()
  const res = await finalizeRenderJob(admin, job, {
    status: 'failed',
    error: 'boom',
  } as ShotstackRenderResponse)
  expect(res.outcome).toBe('render_failed')
  expect(updates[0]?.status).toBe('failed')
})

test('still rendering → no terminal write', async () => {
  const { admin, updates } = fakeAdmin()
  const res = await finalizeRenderJob(admin, job, { status: 'rendering' } as ShotstackRenderResponse)
  expect(res.outcome).toBe('still_rendering')
  expect(updates).toHaveLength(0)
})
