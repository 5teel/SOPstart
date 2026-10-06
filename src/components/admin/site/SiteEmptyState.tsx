'use client'

/**
 * Phase 51 — D-11 empty state for the site edit mode: start from a template
 * (ADR-0003), Generate (only when GEMINI_API_KEY is configured, D-06) or Upload.
 * Every on-ramp records the scene through the single upsertSiteLayout path.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, Upload as UploadIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { applySitePreset, createSceneUploadUrl, upsertSiteLayout } from '@/actions/site'
import { SCENE_MAX_BYTES, SCENE_MIME_TYPES } from '@/lib/validators/site'
import { extForMime } from '@/lib/site/scene'
import { SITE_PRESETS, presetImagePath } from '@/lib/site/presets'

export function SiteEmptyState({ canGenerate, onDone }: { canGenerate: boolean; onDone?: () => void }) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [applying, setApplying] = useState<string | null>(null)
  const [presetError, setPresetError] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerateError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/site/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setGenerateError(json?.error ?? 'Scene generation failed — try again or upload an image.')
        setGenerating(false)
        return
      }
      if (onDone) onDone()
      else router.refresh()
    } catch (err) {
      console.error('[SiteEmptyState] generate error', err)
      setGenerateError('Scene generation failed — try again or upload an image.')
      setGenerating(false)
    }
  }

  async function handlePreset(id: string) {
    setPresetError(null)
    setApplying(id)
    const result = await applySitePreset(id)
    if ('error' in result) {
      setPresetError(result.error)
      setApplying(null)
      return
    }
    if (onDone) onDone()
    else router.refresh()
  }

  async function handleUpload(file: File) {
    setUploadError(null)

    if (!SCENE_MIME_TYPES.includes(file.type as (typeof SCENE_MIME_TYPES)[number])) {
      setUploadError('Please choose a JPG or PNG image.')
      return
    }
    if (file.size > SCENE_MAX_BYTES) {
      setUploadError('That image is over 15 MB — choose a smaller file.')
      return
    }
    const ext = extForMime(file.type)
    if (!ext) {
      setUploadError('Please choose a JPG or PNG image.')
      return
    }

    setUploading(true)
    setUploadStage('Uploading…')

    const session = await createSceneUploadUrl({ ext })
    if ('error' in session) {
      setUploadError(session.error)
      setUploading(false)
      setUploadStage(null)
      return
    }

    const supabase = createClient()
    const { error: uploadErr } = await supabase.storage
      .from('site-scenes')
      .uploadToSignedUrl(session.path, session.token, file, { contentType: file.type })
    if (uploadErr) {
      setUploadError('Upload failed — try again.')
      setUploading(false)
      setUploadStage(null)
      return
    }

    setUploadStage('Reading the image…')
    const result = await upsertSiteLayout({ id: session.layoutId, ext })
    if ('error' in result) {
      setUploadError(result.error)
      setUploading(false)
      setUploadStage(null)
      return
    }

    if (onDone) onDone()
    else router.refresh()
  }

  return (
    <div data-testid="site-empty-state" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-xl font-semibold text-ink-900">Set up your site map</h1>
      <p className="mt-1 text-reading text-ink-500">
        Describe the site once — every machine you draw on it becomes a place SOPs belong to.
      </p>

      <h2 className="mt-8 text-ui font-medium text-ink-900">Start from a template</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SITE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid="site-preset"
            data-preset-id={p.id}
            onClick={() => void handlePreset(p.id)}
            disabled={applying !== null}
            className="flex flex-col overflow-hidden rounded-lg border border-ink-200 bg-paper-1 text-left hover:border-ink-900 disabled:opacity-60"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static thumbnail from public/ */}
            <img src={presetImagePath(p.id)} alt="" className="aspect-video w-full object-cover" />
            <span className="flex items-center gap-2 px-3 pt-3 text-ui font-medium text-ink-900">
              {applying === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
              {applying === p.id ? 'Setting up the site…' : p.name}
            </span>
            <span className="px-3 pb-3 pt-1 text-meta text-ink-500">{p.blurb}</span>
          </button>
        ))}
      </div>
      {presetError && (
        <p role="alert" aria-live="polite" className="mt-2 text-meta text-accent-hazard">
          {presetError}
        </p>
      )}

      <h2 className="mt-8 text-ui font-medium text-ink-900">Or draw your own</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {canGenerate && (
          <div className="rounded-lg border border-ink-200 bg-paper-1 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-ink-500" />
              <h2 className="text-ui font-medium text-ink-900">Generate from a description</h2>
            </div>
            <textarea
              aria-label="Describe your site"
              data-testid="site-generate-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={generating}
              rows={5}
              className="mt-3 w-full rounded-lg border border-ink-300 bg-paper p-3 text-reading text-ink-900 disabled:opacity-60"
              placeholder="What the site makes, the machines left to right, and where the hot or loud areas are."
            />
            <p className="mt-1 text-meta text-ink-500">
              One paragraph: what the site makes, the machines from left to right, and where the hot or loud areas
              are.
            </p>
            <button
              type="button"
              data-testid="site-generate-button"
              onClick={handleGenerate}
              disabled={generating || description.trim().length < 20}
              className="mt-3 flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 text-ui font-medium text-paper disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {generating ? 'Drawing your site — this takes about half a minute' : 'Generate the site'}
            </button>
            {generateError && (
              <p role="alert" aria-live="polite" className="mt-2 text-meta text-accent-hazard">
                {generateError}
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-ink-200 bg-paper-1 p-4">
          <div className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5 text-ink-500" />
            <h2 className="text-ui font-medium text-ink-900">Upload an image</h2>
          </div>
          <p className="mt-3 text-meta text-ink-500">
            JPG or PNG, up to 15 MB. A top-down or isometric drawing of the site works best.
          </p>
          <label className="mt-3 flex min-h-tap w-full cursor-pointer items-center justify-center rounded-lg bg-ink-900 px-4 text-ui font-medium text-paper disabled:opacity-50">
            <input
              type="file"
              accept="image/jpeg,image/png"
              data-testid="site-upload-input"
              disabled={uploading}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void handleUpload(file)
              }}
            />
            {uploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploadStage ?? 'Uploading…'}
              </span>
            ) : (
              'Choose an image'
            )}
          </label>
          {uploadError && (
            <p role="alert" aria-live="polite" className="mt-2 text-meta text-accent-hazard">
              {uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
