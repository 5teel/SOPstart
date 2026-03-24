'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { reparseSop } from '@/actions/sops'
import type { ParseJobStatus as ParseJobStatusType } from '@/types/sop'

interface ParseJobStatusProps {
  sopId: string
  initialStatus?: ParseJobStatusType | null
  initialErrorMessage?: string | null
  isOcr?: boolean
}

export default function ParseJobStatus({
  sopId,
  initialStatus,
  initialErrorMessage,
  isOcr = false,
}: ParseJobStatusProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ParseJobStatusType | null>(
    initialStatus ?? null
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage ?? null
  )
  const [deleting, setDeleting] = useState(false)
  const [reParsing, setReParsing] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let pollingInterval: ReturnType<typeof setInterval> | null = null
    let realtimeConnected = false

    // Start polling fallback after 5s if Realtime hasn't fired
    const pollingTimeout = setTimeout(() => {
      if (!realtimeConnected) {
        pollingInterval = setInterval(async () => {
          const { data } = await supabase
            .from('parse_jobs')
            .select('status, error_message')
            .eq('sop_id', sopId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() as { data: { status: string; error_message: string | null } | null }
          if (data) {
            setStatus(data.status as ParseJobStatusType)
            if (data.error_message) setErrorMessage(data.error_message)
            if (data.status === 'completed' || data.status === 'failed') {
              if (pollingInterval) clearInterval(pollingInterval)
            }
          }
        }, 5000)
      }
    }, 5000)

    const channel = supabase
      .channel(`parse-job-${sopId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parse_jobs',
          filter: `sop_id=eq.${sopId}`,
        },
        (payload) => {
          realtimeConnected = true
          if (pollingInterval) clearInterval(pollingInterval)
          setStatus(payload.new.status as ParseJobStatusType)
          if (payload.new.error_message) setErrorMessage(payload.new.error_message)
        }
      )
      .subscribe(() => {
        realtimeConnected = true
      })

    return () => {
      clearTimeout(pollingTimeout)
      if (pollingInterval) clearInterval(pollingInterval)
      supabase.removeChannel(channel)
    }
  }, [sopId])

  const handleReparse = async () => {
    setReParsing(true)
    await reparseSop(sopId)
    setStatus('queued')
    setErrorMessage(null)
    setReParsing(false)
    router.refresh()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/sops/${sopId}`, { method: 'DELETE' })
    router.push('/admin/sops')
  }

  // OCR low-confidence banner
  const OcrBanner = () => (
    <div className="bg-brand-orange/20 border border-brand-orange/50 text-brand-orange rounded-lg px-4 py-3 text-sm flex gap-2 items-start mb-4">
      <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
      <span>
        Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing.
      </span>
    </div>
  )

  if (status === 'completed') {
    return (
      <>
        {isOcr && <OcrBanner />}
        <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-semibold text-steel-100">Parsed and ready to review</p>
            <button
              onClick={() => router.refresh()}
              className="text-brand-yellow text-sm font-medium hover:text-amber-400 mt-1"
            >
              Review now &rarr;
            </button>
          </div>
        </div>
      </>
    )
  }

  if (status === 'failed') {
    return (
      <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-brand-orange flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-steel-100">Couldn&apos;t parse that one</p>
          {errorMessage && (
            <p className="text-xs text-steel-400 mt-1 line-clamp-2">{errorMessage}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={handleReparse}
              disabled={reParsing}
              className="text-brand-orange text-sm hover:text-amber-500 font-medium"
            >
              {reParsing ? 'Trying again…' : 'Try again'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-400 text-sm hover:text-red-300 font-medium"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Parsing / queued / processing state (default)
  return (
    <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3">
      <div
        className="flex-shrink-0 mt-0.5 animate-spin border-2 border-blue-500/30 border-t-blue-400 rounded-full w-5 h-5"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-steel-100">Crunching your SOP&hellip;</p>
        <p className="text-xs text-steel-400 mt-1">
          Grab a hot drink or take a smoko — we&apos;ll let you know when it&apos;s ready.
        </p>
      </div>
    </div>
  )
}
