import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import QRCode from 'qrcode'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminContext } from '@/lib/auth/guards'
import { plateUrl } from '@/lib/site/qr-decode'
import { PrintButton } from './PrintButton'

export const metadata: Metadata = {
  title: 'Machine plate — SOPstart',
}

/**
 * PHN-02/D-06 — a printable A6 plate for one machine: the QR for its
 * absolute /m/<code> URL, its name, department and the short code itself
 * (the fallback for a camera that won't read). Admin-gated (T-53-05); the
 * machine lookup carries the session-org filter on top of RLS, so a
 * foreign machine id 404s exactly like an unknown one.
 */
export default async function MachinePlatePage({ params }: { params: Promise<{ machineId: string }> }) {
  const { machineId } = await params
  const ctx = await requireAdminContext()
  if ('error' in ctx) {
    redirect(ctx.error === 'Not authenticated' ? '/login' : '/sops')
  }
  if (!ctx.organisationId) notFound()
  if (!z.string().uuid().safeParse(machineId).success) notFound()

  // These tables are not yet in database.types.ts, so the session client is
  // used through the same untyped view src/actions/site.ts and
  // src/actions/site-worker.ts already use.
  const db = ctx.supabase as unknown as SupabaseClient

  const { data: machineRow } = await db
    .from('site_machines')
    .select('id, name, code, department_id')
    .eq('id', machineId)
    .eq('organisation_id', ctx.organisationId)
    .maybeSingle()
  if (!machineRow) notFound()
  const machine = machineRow as { id: string; name: string; code: string; department_id: string | null }

  let departmentName: string | null = null
  if (machine.department_id) {
    const { data: deptRow } = await db
      .from('departments')
      .select('name')
      .eq('id', machine.department_id)
      .eq('organisation_id', ctx.organisationId)
      .maybeSingle()
    departmentName = (deptRow as { name: string } | null)?.name ?? null
  }

  // D-05: NEXT_PUBLIC_SITE_URL when set, else the request origin -- never a
  // hardcoded host.
  const hdrs = await headers()
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${hdrs.get('x-forwarded-proto') ?? 'https'}://${hdrs.get('x-forwarded-host') ?? hdrs.get('host')}`
  const url = plateUrl(origin, machine.code)

  // Server-rendered SVG — crisp at any print size, no client JS needed. No
  // color option: the library default (black on white) keeps this file free
  // of hex literals, so it needs no design-token allowlist entry.
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <style>{`
        @page { size: A6 portrait; margin: 8mm; }
        @media print {
          header, nav, footer, .no-print { display: none !important }
          body { background: white }
        }
      `}</style>

      <div
        data-testid="machine-plate"
        data-plate-url={url}
        className="mx-auto flex w-80 flex-col items-center rounded-lg border-2 border-[var(--ink-900)] bg-white p-5 text-center"
      >
        <div
          data-testid="plate-qr"
          className="h-60 w-60 [&>svg]:h-full [&>svg]:w-full"
          // qrcode's SVG output is generated server-side from our own
          // server-built URL — safe to inline (T-53-09).
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-3 text-xl font-semibold text-[var(--ink-900)]">{machine.name}</p>
        {departmentName && (
          <p className="mono text-meta uppercase tracking-widest text-[var(--ink-500)] mt-1">{departmentName}</p>
        )}
        <p data-testid="plate-code" className="mono text-2xl font-semibold tracking-widest text-[var(--ink-900)] mt-2">
          {machine.code}
        </p>
        <p className="text-meta text-[var(--ink-500)] mt-2">Scan with the SOPstart app, or type this code</p>
      </div>

      <div className="no-print mt-6 flex items-center justify-center gap-3">
        <PrintButton />
        <Link href="/admin/site" className="evidence-btn text-sm">
          Back to site map
        </Link>
      </div>
    </div>
  )
}
