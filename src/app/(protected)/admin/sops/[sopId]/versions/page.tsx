'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Video } from 'lucide-react'
import { getVersionHistory, uploadNewVersion, notifyAssignedWorkers, type VersionRecord } from '@/actions/versioning'

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SopVersionHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const sopId = params.sopId as string

  const [versions, setVersions] = useState<VersionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUploadConfirm, setShowUploadConfirm] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function loadVersions() {
      setLoading(true)
      const result = await getVersionHistory(sopId)
      if (result.success) {
        setVersions(result.versions)
      } else {
        setError(result.error)
      }
      setLoading(false)
    }
    loadVersions()
  }, [sopId])

  const currentSop = versions.find(v => v.superseded_by === null) ?? versions[0]
  const sopTitle = currentSop?.title ?? currentSop?.source_file_name ?? 'SOP'

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setShowUploadConfirm(false)

    try {
      const result = await uploadNewVersion(sopId, {
        name: file.name,
        size: file.size,
        type: file.type,
      })

      if (!result.success) {
        setError(result.error)
        setUploading(false)
        return
      }

      // Upload file to presigned URL
      const uploadResponse = await fetch(result.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadResponse.ok) {
        setError('File upload failed. Please try again.')
        setUploading(false)
        return
      }

      // Trigger parse for the new SOP version (client-side per Phase 2 decisions)
      await fetch('/api/sops/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId: result.newSopId }),
      })

      // Notify assigned workers about the SOP update (MGMT-07)
      await notifyAssignedWorkers(sopId as string, result.newSopId)

      // Redirect to new version's review page
      router.push(`/admin/sops/${result.newSopId}/review`)
    } catch (err) {
      console.error('Upload error:', err)
      setError('An unexpected error occurred. Please try again.')
      setUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/admin/sops/${sopId}/review`}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-steel-800 hover:bg-steel-700 transition-colors text-steel-400 hover:text-steel-100 flex-shrink-0"
          aria-label="Back to SOP review"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-steel-100 truncate">Version History</h1>
          {sopTitle && (
            <p className="text-sm text-steel-400 truncate mt-0.5">{sopTitle}</p>
          )}
        </div>
        <Link
          href={`/admin/sops/${sopId}/assign`}
          className="w-8 h-8 rounded-lg bg-steel-800 border border-steel-700 hover:bg-steel-700 hover:border-steel-600 text-steel-400 hover:text-steel-100 transition-colors flex items-center justify-center flex-shrink-0"
          title="Assign SOP"
        >
          <Users size={16} />
        </Link>
        <Link
          href={`/admin/sops/${sopId}/video`}
          className="w-8 h-8 rounded-lg bg-steel-800 border border-steel-700 hover:bg-steel-700 hover:border-steel-600 text-steel-400 hover:text-steel-100 transition-colors flex items-center justify-center flex-shrink-0"
          title="Video versions"
        >
          <Video size={16} />
        </Link>
      </div>

      {/* Upload new version button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowUploadConfirm(true)}
          disabled={uploading}
          className="flex items-center gap-2 h-[56px] px-5 bg-brand-yellow text-steel-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <UploadIcon className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload New Version'}
        </button>

        {/* Inline confirmation card */}
        {showUploadConfirm && (
          <div className="mt-3 bg-brand-orange/10 border border-brand-orange/30 rounded-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="h-5 w-5 text-brand-orange flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-steel-100 leading-relaxed">
                  Uploading a new version will replace what workers see -- the old version stays linked to any historical completions.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".docx,.doc,.pdf,.jpg,.jpeg,.png,.webp"
                      className="sr-only"
                      onChange={handleFileSelected}
                    />
                    <span className="text-brand-orange font-semibold text-sm hover:text-amber-400 transition-colors">
                      Got it, proceed
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUploadConfirm(false)}
                    className="text-steel-400 hover:text-steel-100 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Version history table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-steel-400">Loading version history...</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-steel-400">No versions found.</p>
        </div>
      ) : (
        <div className="w-full bg-steel-800 rounded-lg overflow-hidden border border-steel-700">
          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_1fr_120px] gap-4 px-4 py-3 bg-steel-900/60">
            <span className="text-xs font-semibold text-steel-400 uppercase tracking-wide">Version</span>
            <span className="text-xs font-semibold text-steel-400 uppercase tracking-wide">Uploaded</span>
            <span className="text-xs font-semibold text-steel-400 uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-steel-400 uppercase tracking-wide text-right">Actions</span>
          </div>

          {/* Data rows */}
          {versions.map((ver) => {
            const isCurrent = ver.superseded_by === null && ver.status === 'published'
            return (
              <div
                key={ver.id}
                className="grid grid-cols-[80px_1fr_1fr_120px] gap-4 px-4 items-center border-t border-steel-700 min-h-[56px] text-sm text-steel-100"
              >
                {/* Version number */}
                <span className="text-sm font-mono font-semibold">v{ver.version}</span>

                {/* Upload date */}
                <span className="text-sm text-steel-300">{formatDate(ver.created_at)}</span>

                {/* Status badge */}
                <span>
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-yellow/20 text-brand-yellow text-xs font-semibold rounded">
                      Current
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 bg-steel-700 text-steel-400 text-xs font-medium rounded">
                      Superseded
                    </span>
                  )}
                </span>

                {/* Actions */}
                <div className="flex justify-end">
                  {isCurrent && (
                    <Link
                      href={`/admin/sops/${ver.id}/review`}
                      className="text-brand-yellow hover:text-amber-400 text-sm font-medium transition-colors"
                    >
                      Review
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
