'use client'

/**
 * Phase 58 (58-13) -- the parse-job engine, lifted out of ParseJobStatus so the
 * editor's "still reading" view and the old status card share ONE realtime +
 * polling owner (DUP-03): realtime subscription, a grace timer, a stale watchdog
 * and a 5 s poll. It never navigates. A completion is reported through the
 * callbacks and the caller decides what to do; every callback sits behind the
 * effect-scoped `cancelled` flag, because clearing an interval does not cancel a
 * request already in flight (a poll that lands after unmount must not move a user
 * who has left -- CLAUDE.md 2026-09-29, tests/phase40).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { reparseSop } from '@/actions/sops'
import { shouldStartPolling } from '@/lib/admin/job-stages'
import type { ParseJobStatus } from '@/types/sop'

const POLL_INTERVAL_MS = 5000
const REALTIME_GRACE_MS = 5000
const REALTIME_STALE_MS = 15000

/** Plain, serialisable: the server page hands one of these to the editor. */
export interface ParseJobSnapshot {
  status: ParseJobStatus | null
  errorMessage: string | null
  currentStage: string | null
  isVideo: boolean
  inputType: string | null
  /** ISO time the job was queued; drives the rough time left. */
  startedAt: string | null
}

export interface UseParseJobOptions {
  initial?: Partial<ParseJobSnapshot>
  /** The job finished (poll or realtime). Never navigate from a mount effect. */
  onCompleted?: () => void
  /** Only the poll path: ParseJobStatus refreshes the server tree here. */
  onPollCompleted?: () => void
}

type JobRow = {
  status: string
  error_message: string | null
  current_stage: string | null
  file_type: string
  input_type: string | null
}

/** Re-queue a parse from a click ("Try again"). Returns an error line, or null once it is queued. */
export async function requeueParse(sopId: string, isVideo: boolean): Promise<string | null> {
  const result = await reparseSop(sopId)
  if ('error' in result) return result.error
  try {
    const res = await fetch(isVideo ? '/api/sops/transcribe' : '/api/sops/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sopId }),
    })
    if (!res.ok) return 'Could not start the retry — please try again.'
  } catch {
    return 'Could not start the retry — check your connection and try again.'
  }
  return null
}

export function useParseJob(sopId: string, opts: UseParseJobOptions = {}) {
  const [job, setJob] = useState<ParseJobSnapshot>({
    status: null,
    errorMessage: null,
    currentStage: null,
    isVideo: false,
    inputType: null,
    startedAt: null,
    ...opts.initial,
  })
  const [pollError, setPollError] = useState(false)

  const optsRef = useRef(opts)
  optsRef.current = opts
  const lastUpdateRef = useRef<number>(Date.now())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    lastUpdateRef.current = Date.now()

    // Clearing the interval on unmount does NOT cancel a request already in
    // flight. Without this flag, a poll fired just before you navigate away
    // resolves a second later on a dead component and still runs its
    // completion branch -- on the AI-draft surfaces that dragged the user into
    // the editor. Symptom: you click Manage SOPs and get thrown into the last
    // SOP you were drafting, with no input from you.
    let cancelled = false

    function startPolling() {
      if (cancelled || pollingRef.current) return
      pollingRef.current = setInterval(fetchParseJob, POLL_INTERVAL_MS)
    }

    async function fetchParseJob() {
      const { data, error } = (await supabase
        .from('parse_jobs')
        .select('status, error_message, current_stage, file_type, input_type')
        .eq('sop_id', sopId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()) as { data: JobRow | null; error: unknown }
      if (cancelled) return
      setPollError(!!error)
      if (data) {
        setJob((j) => ({
          ...j,
          status: data.status as ParseJobStatus,
          errorMessage: data.error_message || j.errorMessage,
          currentStage: data.current_stage || j.currentStage,
          isVideo: j.isVideo || data.file_type === 'video',
          inputType: data.input_type ?? null,
        }))
        lastUpdateRef.current = Date.now()
        if (data.status === 'completed') {
          const { onCompleted, onPollCompleted } = optsRef.current
          if (onCompleted) onCompleted()
          if (onPollCompleted) onPollCompleted()
        }
      }
    }

    const channel = supabase
      .channel(`parse-job-${sopId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'parse_jobs', filter: `sop_id=eq.${sopId}` },
        (payload) => {
          if (cancelled) return
          lastUpdateRef.current = Date.now()
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          const n = payload.new as Partial<JobRow>
          setJob((j) => ({
            ...j,
            status: (n.status as ParseJobStatus) ?? j.status,
            errorMessage: n.error_message || j.errorMessage,
            currentStage: n.current_stage || j.currentStage,
            isVideo: j.isVideo || n.file_type === 'video',
            inputType: n.input_type !== undefined ? (n.input_type ?? null) : j.inputType,
          }))
          const { onCompleted } = optsRef.current
          if (n.status === 'completed' && onCompleted) onCompleted()
        }
      )
      .subscribe((subStatus) => {
        lastUpdateRef.current = Date.now()
        if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          startPolling()
        }
      })
    fetchParseJob()

    // Polling grace period: if no realtime event fires within REALTIME_GRACE_MS, start polling.
    const startPollingTimeout = setTimeout(() => {
      if (shouldStartPolling(lastUpdateRef.current, Date.now(), REALTIME_GRACE_MS)) {
        startPolling()
      }
    }, REALTIME_GRACE_MS)

    // Stale watchdog: even if realtime is delivering events, start polling after
    // REALTIME_STALE_MS to catch silent drops (connected then went quiet).
    const staleWatchdog = setInterval(() => {
      if (shouldStartPolling(lastUpdateRef.current, Date.now(), REALTIME_STALE_MS)) {
        startPolling()
      }
    }, REALTIME_STALE_MS)

    return () => {
      cancelled = true
      clearTimeout(startPollingTimeout)
      clearInterval(staleWatchdog)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [sopId])

  const patch = useCallback((next: Partial<ParseJobSnapshot>) => setJob((j) => ({ ...j, ...next })), [])

  return { job, patch, pollError }
}
