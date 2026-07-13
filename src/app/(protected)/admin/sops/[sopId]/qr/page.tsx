import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { getSessionContext } from '@/lib/auth/session-context'
import { PrintButton } from './PrintButton'

export const metadata: Metadata = {
  title: 'Print QR code — SOPstart',
}

/**
 * Printable QR sticker for a SOP — stick it on the machine it belongs to.
 * Scanning opens the worker view (/sops/[sopId]) directly: the worker at the
 * machine never browses a library (Visy 2026-05-05 — task-first, low-friction
 * access; also the per-machine variant answer to the "7 Toyota Corollas"
 * equipment-variation pain).
 */
export default async function SopQrPage({ params }: { params: Promise<{ sopId: string }> }) {
  const { sopId } = await params
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const { data: sop } = await supabase
    .from('sops')
    .select('id, title, sop_number, status')
    .eq('id', sopId)
    .maybeSingle()
  if (!sop) notFound()

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sopstart.com').replace(/\/$/, '')
  const workerUrl = `${siteUrl}/sops/${sop.id}`

  // Server-rendered SVG — crisp at any print size, no client JS needed.
  const qrSvg = await QRCode.toString(workerUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#09090b', light: '#ffffff' },
  })

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Print stylesheet: only the sticker prints */}
      <style>{`@media print { header, nav, footer, .no-print { display: none !important } body { background: white } }`}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <span className="pill">QR CODE</span>
          <h1 className="mono text-xl font-semibold text-[var(--ink-900)] mt-1">
            {sop.title ?? 'SOP'}
          </h1>
          <p className="text-sm text-[var(--ink-500)] mt-1">
            Print and stick this on the machine or work area. Scanning opens the procedure
            directly on the worker&apos;s phone.
            {sop.status !== 'published' && (
              <span className="block mt-1 text-amber-600 font-medium">
                ⚠ This SOP isn&apos;t published yet — workers will not see it until it is.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* The sticker */}
      <div className="mx-auto w-[340px] border-2 border-[var(--ink-900)] rounded-xl bg-white p-5 text-center">
        <div
          className="mx-auto w-[260px] h-[260px] [&>svg]:w-full [&>svg]:h-full"
          // qrcode's SVG output is generated server-side from our own data — safe to inline.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] mt-3">
          Scan for procedure
        </p>
        <p className="text-base font-semibold text-[var(--ink-900)] mt-1 leading-snug">
          {sop.title ?? 'Standard Operating Procedure'}
        </p>
        {sop.sop_number && (
          <p className="mono text-[11px] text-[var(--ink-500)] mt-1">{sop.sop_number}</p>
        )}
      </div>

      <div className="no-print mt-6 flex items-center justify-center gap-3">
        <PrintButton />
        <Link href="/admin/sops" className="evidence-btn text-sm">
          Back to SOPs
        </Link>
      </div>
      <p className="no-print mt-3 text-center text-xs text-[var(--ink-400)]">
        Tip: set copies-per-page in your print dialog to print multiple stickers per sheet.
      </p>
    </div>
  )
}
