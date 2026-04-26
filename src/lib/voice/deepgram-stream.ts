'use client'
import { pickRecorderFormat, type RecorderFormat } from './media-recorder'

export interface VoiceStreamOpts {
  language: 'en-NZ' | 'en-AU' | 'en-US'
  numerals?: boolean // true for MeasurementBlock — biases "twenty two point five" → "22.5"
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
  if (!tokenRes.ok) throw new Error('token_grant_failed')
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // 2. Build Deepgram URL with format-matched encoding (Pitfall 9)
  const params = new URLSearchParams({
    model: 'nova-3',
    language: opts.language,
    encoding: format.deepgramEncoding,
    sample_rate: String(format.sampleRate),
    interim_results: 'true',
    smart_format: 'true',
    punctuate: 'true',
    no_delay: 'true',
    vad_events: 'true',
  })
  if (opts.numerals) params.set('numerals', 'true')

  // 3. Open WebSocket with Sec-WebSocket-Protocol subprotocol auth (Pitfall 3)
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, [
    'token',
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
        partialCb(alt.transcript)
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
