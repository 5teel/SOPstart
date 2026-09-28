'use client'

/**
 * The in-app plate scanner (D-07/D-08/D-09). Every frame is decoded on the
 * phone and nothing leaves it; the only navigation here is to /m/<code>
 * rebuilt from a validated code (T-53-02); the camera is released on every
 * exit (T-53-04).
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { extractMachineCode, normaliseMachineCode } from '@/lib/site/qr-decode'

type Mode = 'starting' | 'camera' | 'typing'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

export function ScanSheet({ onClose }: { onClose(): void }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [mode, setMode] = useState<Mode>('starting')
  const [note, setNote] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const go = useCallback(
    (code: string) => {
      stopCamera()
      router.push(`/m/${code}`)
      onClose()
    },
    [stopCamera, router, onClose]
  )

  useEffect(() => {
    let cancelled = false

    async function pickDecoder(): Promise<((video: HTMLVideoElement) => Promise<string | null>) | null> {
      const win = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      const NativeDetector = win.BarcodeDetector
      if (NativeDetector) {
        try {
          const formats = await NativeDetector.getSupportedFormats()
          if (formats.includes('qr_code')) {
            const detector = new NativeDetector({ formats: ['qr_code'] })
            return async (video) => {
              const codes = await detector.detect(video)
              return codes[0]?.rawValue ?? null
            }
          }
        } catch {
          // fall through to jsqr
        }
      }
      const { default: jsQR } = await import('jsqr')
      return async (video) => {
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (!vw || !vh) return null
        const scale = Math.min(1, 640 / vw)
        const width = Math.max(1, Math.round(vw * scale))
        const height = Math.max(1, Math.round(vh * scale))
        if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
        const canvas = canvasRef.current
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(video, 0, 0, width, height)
        const { data } = ctx.getImageData(0, 0, width, height)
        return jsQR(data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null
      }
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setNote("This phone can't open the camera here — type the code on the plate.")
        setMode('typing')
        return
      }

      const decodeFrame = await pickDecoder()
      if (cancelled) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setMode('camera')

        const tick = async () => {
          if (cancelled || !streamRef.current || !videoRef.current) return
          const video = videoRef.current
          if (video.readyState >= 2 && decodeFrame) {
            const text = await decodeFrame(video)
            if (text) {
              const code = extractMachineCode(text, window.location.origin)
              if (code) {
                go(code)
                return
              }
              setNote("That's not a SOPstart plate")
            }
          }
          if (!cancelled) {
            timerRef.current = window.setTimeout(tick, 200)
          }
        }
        timerRef.current = window.setTimeout(tick, 200)
      } catch (err) {
        const name = err instanceof Error ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setNote('Camera blocked — type the code on the plate instead.')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setNote('No camera found — type the code on the plate.')
        } else {
          setNote("Couldn't start the camera — type the code on the plate.")
        }
        setMode('typing')
      }
    }

    start()

    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function closeSheet() {
    stopCamera()
    onClose()
  }

  function typeInstead() {
    stopCamera()
    setMode('typing')
  }

  function submitTyped(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = normaliseMachineCode(typed)
    if (code) {
      go(code)
      return
    }
    setTypedError('Codes are 6 letters and numbers, like 7K2M9Q')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan a machine plate"
      data-testid="scan-sheet"
      data-mode={mode}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--ink-900)] text-white"
    >
      <div className="flex min-h-tap flex-shrink-0 items-center justify-between px-4">
        <h2 className="text-base font-semibold">Scan a machine plate</h2>
        <button
          type="button"
          data-testid="scan-close"
          aria-label="Close"
          onClick={closeSheet}
          className="flex min-h-tap items-center px-2"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {mode !== 'typing' && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 pb-6">
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative h-60 w-60 rounded-2xl border-2 border-white" aria-hidden="true" />
          {note && (
            <span
              data-testid="scan-note"
              className="relative rounded-full bg-white px-3 py-1 text-ui font-semibold text-[var(--ink-900)]"
            >
              {note}
            </span>
          )}
          <button
            type="button"
            data-testid="scan-type-instead"
            onClick={typeInstead}
            className="relative min-h-tap rounded-lg bg-white/10 px-4 text-ui font-semibold underline"
          >
            Type it instead
          </button>
        </div>
      )}

      {mode === 'typing' && (
        <div className="flex flex-1 flex-col justify-center gap-3 px-4 pb-6">
          {note && (
            <p data-testid="scan-note" className="text-ui text-white/80">
              {note}
            </p>
          )}
          <form data-testid="scan-code-form" onSubmit={submitTyped} className="flex flex-col gap-2">
            <label htmlFor="scan-code-entry" className="text-ui font-semibold">
              Type the code on the plate
            </label>
            <input
              id="scan-code-entry"
              data-testid="scan-code-entry"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                setTypedError(null)
              }}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              enterKeyHint="go"
              className="mono min-h-tap-glove rounded-lg border border-white/30 bg-white/10 px-4 text-xl tracking-widest text-white"
            />
            {typedError && (
              <p data-testid="scan-code-error" className="text-ui text-accent-escalate">
                {typedError}
              </p>
            )}
            <button
              type="submit"
              data-testid="scan-code-go"
              className="min-h-tap-glove rounded-lg bg-white text-base font-semibold text-[var(--ink-900)]"
            >
              Open machine
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
