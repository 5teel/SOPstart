'use client'
import { pickRecorderFormat, type RecorderFormat } from './media-recorder'
import { aiModel } from '@/lib/ai/registry'

export interface VoiceStreamOpts {
  language: 'en-NZ' | 'en-AU' | 'en-US'
  numerals?: boolean // true for MeasurementBlock — biases "twenty two point five" → "22.5"
  keyterms?: string[] // Phase 22 — SOP vocabulary injection (max 100) for ≥90% noise-accuracy target (VDW-VOICE-01)
}

export interface StreamHandle {
  stop: () => Promise<{
    transcript: string
    confidence: number
    blob: Blob
    ext: RecorderFormat['ext']
  }>
  onPartial: (cb: (text: string) => void) => void
  onFinal: (cb: (text: string, confidence: number) => void) => void
  onError: (cb: (err: Error) => void) => void
}

export async function startVoiceStream(opts: VoiceStreamOpts): Promise<StreamHandle> {
  const format = pickRecorderFormat()
  if (!format) throw new Error('Voice capture not supported in this browser')

  // 1. Mint ephemeral token server-side
  const tokenRes = await fetch('/api/voice/token', { method: 'POST' })
  if (!tokenRes.ok) {
    // Surface the SPECIFIC server cause instead of a blanket 'token_grant_failed'.
    // The route distinguishes: 401 unauthorized, 503 deepgram_not_configured
    // (DEEPGRAM_API_KEY missing in the deploy env), 502 token_grant_failed
    // (key present but rejected by Deepgram). Collapsing these to one string made
    // a Railway env-var mismatch indistinguishable from a code bug (Phase 22 UAT).
    let code = 'token_grant_failed'
    try {
      const body = (await tokenRes.json()) as { error?: string }
      if (body?.error) code = body.error
    } catch {
      /* non-JSON error body — keep default code */
    }
    throw new Error(code)
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // 2. Build Deepgram URL.
  // IMPORTANT: do NOT send `encoding`/`sample_rate`. MediaRecorder emits a
  // *containerized* stream (WebM/Ogg/MP4); Deepgram auto-detects codec + rate
  // from the container. Sending `encoding=opus` tells Deepgram to expect RAW
  // Opus packets, so it silently fails to decode the WebM and returns ZERO
  // transcripts (connection stays open, no error) — verified by streaming a
  // real WebM/Opus clip both ways against Deepgram. `format` is still used for
  // the MediaRecorder mimeType + blob extension below, just not for these params.
  const params = new URLSearchParams({
    model: aiModel('stt-stream'),
    language: opts.language,
    interim_results: 'true',
    smart_format: 'true',
    punctuate: 'true',
    no_delay: 'true',
    vad_events: 'true',
  })
  if (opts.numerals) params.set('numerals', 'true')
  // Phase 22 — inject SOP vocabulary as per-term keyterm params (VDW-VOICE-01).
  // Deepgram keyterms API requires one `keyterm=` append per term (not a joined list).
  // Capped at 100 terms to match Deepgram's documented limit.
  if (opts.keyterms?.length) {
    for (const kt of opts.keyterms.slice(0, 100)) {
      params.append('keyterm', kt)
    }
  }

  // 3. Open WebSocket with Sec-WebSocket-Protocol subprotocol auth (Pitfall 3).
  // Temporary tokens minted by /v1/auth/grant are JWTs and MUST use the 'bearer'
  // subprotocol. The 'token' subprotocol only accepts a raw DEEPGRAM_API_KEY and
  // returns HTTP 401 INVALID_AUTH for a grant JWT (verified directly against
  // Deepgram — this was the cause of the runtime "WebSocket error" on speak).
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, [
    'bearer',
    access_token,
  ])

  // 4. Acquire mic + start recorder
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType })
  const chunks: Blob[] = []

  let partialCb: (text: string) => void = () => {}
  let finalCb: (text: string, confidence: number) => void = () => {}
  let errorCb: (err: Error) => void = () => {}
  let lastFinalTranscript = ''
  let lastFinalConfidence = 0

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
      if (ws.readyState === WebSocket.OPEN) ws.send(e.data)
    }
  }
  recorder.onerror = (ev) =>
    errorCb(
      new Error(
        `MediaRecorder error: ${(ev as unknown as { error?: Error }).error?.message ?? 'unknown'}`
      )
    )

  // 5. KeepAlive every 3s while listening (Pitfall 4 — Deepgram closes idle after 10s)
  let keepAlive: ReturnType<typeof setInterval> | null = null

  ws.onopen = () => {
    recorder.start(250)
    keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }))
    }, 3000)
  }
  ws.onerror = () => errorCb(new Error('WebSocket error'))
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as {
        type?: string
        is_final?: boolean
        channel?: { alternatives?: Array<{ transcript?: string; confidence?: number }> }
      }
      if (msg.type !== 'Results') return
      const alt = msg.channel?.alternatives?.[0]
      if (!alt?.transcript) return
      if (msg.is_final) {
        lastFinalTranscript = (lastFinalTranscript ? lastFinalTranscript + ' ' : '') + alt.transcript
        lastFinalConfidence = alt.confidence ?? lastFinalConfidence
        finalCb(lastFinalTranscript, lastFinalConfidence)
      } else {
        // Surface accumulated finals + the current interim segment so the UI
        // shows the WHOLE question as it grows across pauses (Deepgram emits a
        // separate is_final per segment; a bare interim would drop earlier finals).
        const interim = (lastFinalTranscript ? lastFinalTranscript + ' ' : '') + alt.transcript
        partialCb(interim)
      }
    } catch {
      /* malformed frame — ignore */
    }
  }

  return {
    onPartial: (cb) => {
      partialCb = cb
    },
    onFinal: (cb) => {
      finalCb = cb
    },
    onError: (cb) => {
      errorCb = cb
    },
    stop: async () => {
      if (keepAlive) {
        clearInterval(keepAlive)
        keepAlive = null
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'Finalize' }))
        ws.send(JSON.stringify({ type: 'CloseStream' }))
      }
      if (recorder.state === 'recording') recorder.stop()
      // Stop mic tracks to release hardware indicator
      for (const t of stream.getTracks()) t.stop()
      // Allow a short window for final results to arrive
      await new Promise((r) => setTimeout(r, 300))
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      const blob = new Blob(chunks, { type: format.mimeType })
      return {
        transcript: lastFinalTranscript,
        confidence: lastFinalConfidence,
        blob,
        ext: format.ext,
      }
    },
  }
}
