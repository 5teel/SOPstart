import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSessionContext } from '@/lib/auth/session-context'
import { normaliseMachineCode } from '@/lib/site/qr-decode'
import { SCENE_BUCKET, SCENE_SIGNED_TTL_SEC, zoneColour } from '@/lib/site/scene'
import { MachineView } from '@/components/sop/plant/MachineView'

export const metadata: Metadata = {
  title: 'Machine — SOPstart',
}

/**
 * PHN-02/D-04 -- opened by scanning a machine's printed plate. Every read
 * is scoped to the session organisation on top of RLS (2026-07-28: the
 * session org, never a value off a fetched row); a malformed, unknown or
 * foreign code all 404 identically (T-53-01) so a probe learns nothing.
 * The tables here are not yet in database.types.ts, so the session client
 * is used through the same untyped view src/actions/site-worker.ts uses.
 */
export default async function MachinePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  const code = normaliseMachineCode(rawCode)
  if (!code) notFound()

  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/m/${code}`)}`)
  if (!organisationId) notFound()

  const db = supabase as unknown as SupabaseClient

  const { data: machineRow } = await db
    .from('site_machines')
    .select('id, name, department_id, sprite_path')
    .eq('code', code)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!machineRow) notFound()
  const machine = machineRow as {
    id: string
    name: string
    department_id: string | null
    sprite_path: string | null
  }

  const { data: deptRows } = await db
    .from('departments')
    .select('id, name, colour')
    .eq('organisation_id', organisationId)
    .eq('archived', false)
    .order('name', { ascending: true })
  const departments = (deptRows ?? []) as Array<{ id: string; name: string; colour: string }>
  const deptIndex = departments.findIndex((d) => d.id === machine.department_id)
  const deptRow = deptIndex >= 0 ? departments[deptIndex] : null
  const department = deptRow ? { name: deptRow.name, colour: zoneColour(deptRow, deptIndex) } : null

  let spriteUrl: string | null = null
  if (machine.sprite_path) {
    const { data: signedSprite } = await db.storage
      .from(SCENE_BUCKET)
      .createSignedUrl(machine.sprite_path, SCENE_SIGNED_TTL_SEC)
    spriteUrl = signedSprite?.signedUrl ?? null
  }

  const { data: linkRows } = await db
    .from('sop_machines')
    .select('sop_id')
    .eq('machine_id', machine.id)
    .eq('organisation_id', organisationId)
  const sopIds = ((linkRows ?? []) as Array<{ sop_id: string }>).map((r) => r.sop_id)

  let publishedIds: string[] = []
  if (sopIds.length > 0) {
    const { data: sopRows } = await db
      .from('sops')
      .select('id')
      .eq('organisation_id', organisationId)
      .eq('status', 'published')
      .in('id', sopIds)
    publishedIds = ((sopRows ?? []) as Array<{ id: string }>).map((r) => r.id)
  }

  return (
    <main data-testid="machine-page" className="mx-auto w-full max-w-xl px-4 py-4">
      <MachineView
        machine={{ id: machine.id, name: machine.name, spriteUrl }}
        department={department}
        sopIds={publishedIds}
      />
    </main>
  )
}
