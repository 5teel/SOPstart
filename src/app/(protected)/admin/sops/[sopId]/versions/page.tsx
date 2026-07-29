'use client'

/**
 * Phase 23 Plan 23-05 — AFL-VER-01 / D-05/D-06: Versions page with
 * "Edit into new version" (cloneSopAsDraft), "Restore as new version"
 * (restoreVersionAsNew), and "Compare" (→ diff page) buttons.
 *
 * NOTE: journeys.ts must reflect the new version/diff/restore flows — the
 * actual journeys.ts edit is in Plan 23-07 (same-change rule from CLAUDE.md).
 *
 * CLAUDE.md 2026-06-05: all onClick handlers are WIRED to the server actions
 * (no empty handler).
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Video } from 'lucide-react'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import {
  getVersionHistory,
  uploadNewVersion,
  notifyAssignedWorkers,
  cloneSopAsDraft,
  restoreVersionAsNew,
  type VersionRecord,
} from '@/actions/versioning'
import { getApprovalHistory, type ApprovalHistoryRow } from '@/actions/approvals'
import { getVersionCompletionBreakdown, type VersionCompletionBreakdown } from '@/actions/competency'
import { setRefresherInterval } from '@/actions/governance'
import { ACCEPT_ATTR, INTAKE_HINT, validateIntakeFile } from '@/lib/upload/file-intake'
import { startVideoSopUpload } from '@/lib/upload/start-video-sop-upload'

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

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
  const [approvals, setApprovals] = useState<ApprovalHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // TRN-03 per-version completion breakdown (Plan 36-09) — failures surface
  // as a message, never as a silently-empty panel (CLAUDE.md 2026-07-20).
  const [breakdown, setBreakdown] = useState<VersionCompletionBreakdown | null>(null)
  const [breakdownError, setBreakdownError] = useState<string | null>(null)
  const [expandedVersionIds, setExpandedVersionIds] = useState<Set<string>>(new Set())

  // REF-01/REF-02 refresher interval control (Plan 36-09)
  const [refresherInput, setRefresherInput] = useState<string>('')
  const [savingRefresher, setSavingRefresher] = useState(false)

  // Upload new version state (existing pattern retained — D-05: re-upload remains available)
  const [showUploadConfirm, setShowUploadConfirm] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Video re-upload progress (D-06) — percentage shown in the button label;
  // no new progress component (plan 40-03 owns progress UI).
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  // Edit into new version (clone) state — D-05
  const [showCloneConfirm, setShowCloneConfirm] = useState(false)
  const [cloning, setCloning] = useState(false)

  // Restore as new version state — D-06; tracks which version is being restored
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const [showRestoreConfirmFor, setShowRestoreConfirmFor] = useState<string | null>(null)

  // Compare: track which version to compare against current
  const [selectedForCompare, setSelectedForCompare] = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    const result = await getVersionHistory(sopId)
    if (result.success) {
      setVersions(result.versions)
      // Read-only approval history (D29-06) — fetched for every version id
      // in the lineage; approver + step labels come already-resolved from
      // getApprovalHistory (reuses getOrgMembers() + approval_snapshot
      // server-side, no second member query, no label column).
      const approvalsResult = await getApprovalHistory(result.versions.map((v) => v.id))
      if ('success' in approvalsResult && approvalsResult.success) {
        setApprovals(approvalsResult.rows)
      }
      // TRN-03 completion breakdown (D-09) — surfaced as an error message on
      // failure, never a silent empty panel.
      const breakdownResult = await getVersionCompletionBreakdown(sopId)
      if ('breakdown' in breakdownResult) {
        setBreakdown(breakdownResult.breakdown)
        setBreakdownError(null)
      } else {
        setBreakdown(null)
        setBreakdownError(breakdownResult.error)
      }
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [sopId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  // WR-01: a cloned-but-unpublished draft also has superseded_by === null and
  // the highest version, so it must never win — the refresher control, clone
  // source, title, and compare baseline all target the live PUBLISHED current
  // (same predicate as the row-level "Current" badge below).
  const currentSop = versions.find(v => v.superseded_by === null && v.status === 'published') ?? versions[0]
  const sopTitle = currentSop?.title ?? currentSop?.source_file_name ?? 'SOP'

  // Seed the refresher-interval input from the current version's persisted value.
  useEffect(() => {
    setRefresherInput(
      currentSop?.refresher_interval_months != null ? String(currentSop.refresher_interval_months) : ''
    )
  }, [currentSop?.refresher_interval_months])

  function toggleVersionExpanded(versionId: string) {
    setExpandedVersionIds((prev) => {
      const next = new Set(prev)
      if (next.has(versionId)) next.delete(versionId)
      else next.add(versionId)
      return next
    })
  }

  // --- Refresher interval handlers — REF-01/REF-02 ---
  // CLAUDE.md 2026-06-05: wired to the server action, no empty handler.
  async function handleSaveRefresher() {
    if (!currentSop) return
    const trimmed = refresherInput.trim()
    const months = trimmed === '' ? null : Number(trimmed)
    if (months !== null && (!Number.isInteger(months) || months < 1 || months > 120)) {
      setError('Refresher interval must be a whole number of months between 1 and 120.')
      return
    }
    setSavingRefresher(true)
    const result = await setRefresherInterval(currentSop.id, months)
    setSavingRefresher(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    await loadVersions()
  }

  async function handleClearRefresher() {
    if (!currentSop) return
    setSavingRefresher(true)
    const result = await setRefresherInterval(currentSop.id, null)
    setSavingRefresher(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    await loadVersions()
  }

  // --- Upload new version handler ---
  // D-04/D-05: validated + (when needed) HEIC-converted through the shared
  // intake module, same as UploadDropzone/VideoFormatSelectionModal.
  // D-06: a video source is routed through startVideoSopUpload (audio
  // extraction + TUS + /api/sops/transcribe), never the document parser.
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return

    setShowUploadConfirm(false)

    const intake = await validateIntakeFile(picked)
    if (!intake.ok) {
      setError(intake.message)
      return
    }
    const file = intake.file

    setUploading(true)
    setUploadProgress(null)

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

      if (result.isVideo) {
        const videoResult = await startVideoSopUpload({
          file,
          session: { sopId: result.newSopId, path: result.path, token: result.token },
          onProgress: (pct) => setUploadProgress(pct),
          onError: (message) => setError(message),
        })

        if (!videoResult.ok) {
          setUploading(false)
          return
        }
      } else {
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
      }

      // Notify assigned workers about the SOP update (MGMT-07)
      await notifyAssignedWorkers(sopId as string, result.newSopId)

      // Redirect to new version's builder (review folded into builder — Phase 21.5)
      router.push(`/admin/sops/builder/${result.newSopId}`)
    } catch (err) {
      console.error('Upload error:', err)
      setError('An unexpected error occurred. Please try again.')
      setUploading(false)
    }
  }

  // --- Edit into new version (clone) handler — D-05 ---
  // CLAUDE.md 2026-06-05: wired to the server action, no empty handler
  async function handleClone() {
    if (!currentSop) return
    setCloning(true)
    setShowCloneConfirm(false)
    const result = await cloneSopAsDraft(currentSop.id)
    if (!result.success) {
      setError(result.error)
      setCloning(false)
      return
    }
    router.push(`/admin/sops/builder/${result.newDraftId}`)
  }

  // --- Restore as new version handler — D-06 ---
  // CLAUDE.md 2026-06-05: wired to the server action, no empty handler
  async function handleRestore(versionId: string) {
    setRestoringVersionId(versionId)
    setShowRestoreConfirmFor(null)
    const result = await restoreVersionAsNew(versionId)
    if (!result.success) {
      setError(result.error)
      setRestoringVersionId(null)
      return
    }
    router.push(`/admin/sops/builder/${result.newDraftId}`)
  }

  return (
    <AdminPageShell
      active="sops"
      title="Version History"
      description={sopTitle}
      backLink={{
        href: `/admin/sops/builder/${sopId}`,
        label: 'Back to SOP',
        ariaLabel: 'Back to SOP builder',
      }}
      contentClassName="max-w-3xl mx-auto px-4 py-8 lg:px-8 lg:py-10"
    >
      {/* Per-SOP quick links — assign + video versions */}
      <div className="flex justify-end gap-2 mb-4">
        <Link
          href={`/admin/sops/${sopId}/assign`}
          className="w-8 h-8 rounded-lg bg-white border border-[var(--ink-100)] hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors flex items-center justify-center flex-shrink-0"
          title="Assign SOP"
        >
          <Users size={16} />
        </Link>
        <Link
          href={`/admin/sops/${sopId}/video`}
          className="w-8 h-8 rounded-lg bg-white border border-[var(--ink-100)] hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors flex items-center justify-center flex-shrink-0"
          title="Video versions"
        >
          <Video size={16} />
        </Link>
      </div>

      {/* Action buttons row — Upload New Version (D-05: re-upload stays) + Edit into new version */}
      <div className="mb-6 flex flex-wrap gap-3">
        {/* Upload New Version button — D-05: re-upload remains available */}
        <button
          type="button"
          onClick={() => { setShowUploadConfirm(true); setShowCloneConfirm(false) }}
          disabled={uploading || cloning}
          className="flex items-center gap-2 h-[56px] px-5 bg-[var(--paper-2)] border border-[var(--ink-200)] text-[var(--ink-900)] font-semibold rounded-xl hover:bg-white hover:border-[var(--ink-400)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <UploadIcon className="h-4 w-4" />
          {uploading
            ? uploadProgress != null
              ? `Uploading... ${uploadProgress}%`
              : 'Uploading...'
            : 'Upload New Version'}
        </button>

        {/* Edit into new version button — D-05 primary supersede entry */}
        <button
          type="button"
          onClick={() => { setShowCloneConfirm(true); setShowUploadConfirm(false) }}
          disabled={uploading || cloning || !currentSop}
          className="flex items-center gap-2 h-[56px] px-5 bg-[var(--ink-900)] text-white font-semibold rounded-xl hover:bg-[var(--ink-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <CopyIcon className="h-4 w-4" />
          {cloning ? 'Creating draft...' : 'Edit into new version'}
        </button>

        {/* Refresher interval control — REF-01/REF-02: how often WORKERS must
            re-walk this procedure. Separate from the document's own review
            cycle (D28 cadence). Disabled ONLY while a save is in flight —
            never based on competency/refresher-due/version-currency state. */}
        {currentSop && (
          <div className="flex items-center gap-2 h-[56px] px-4 bg-white border border-[var(--ink-200)] rounded-xl">
            <label htmlFor="refresher-interval-months" className="text-xs text-[var(--ink-500)] leading-tight">
              Refresher (months)
            </label>
            <input
              id="refresher-interval-months"
              type="number"
              min={1}
              max={120}
              step={1}
              value={refresherInput}
              onChange={(e) => setRefresherInput(e.target.value)}
              placeholder="Off"
              className="w-16 h-9 px-2 rounded-lg border border-[var(--ink-200)] text-sm text-[var(--ink-900)]"
            />
            <button
              type="button"
              onClick={handleSaveRefresher}
              disabled={savingRefresher}
              className="h-9 px-3 bg-[var(--ink-900)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--ink-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingRefresher ? 'Saving...' : 'Save'}
            </button>
            {currentSop.refresher_interval_months !== null && currentSop.refresher_interval_months !== undefined && (
              <button
                type="button"
                onClick={handleClearRefresher}
                disabled={savingRefresher}
                className="text-xs text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Turn off
              </button>
            )}
          </div>
        )}
      </div>

      {currentSop && (
        <p className="-mt-4 mb-6 text-xs text-[var(--ink-500)] leading-relaxed max-w-xl">
          This sets how often workers must re-walk this procedure on their phone to stay current
          — it&apos;s separate from this document&apos;s own review cycle. Leave it blank and
          workers get no refresher prompts for this SOP.
        </p>
      )}

      {breakdownError && (
        <p className="mb-4 text-sm text-red-400">{breakdownError}</p>
      )}

      {/* Upload confirmation card (existing pattern) */}
      {showUploadConfirm && (
        <div className="mb-4 bg-[var(--accent-voice)]/10 border border-[var(--accent-voice)]/30 rounded-xl px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-[var(--accent-voice)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--ink-900)] leading-relaxed">
                Uploading a new version will replace what workers see -- the old version stays linked to any historical completions.
                Supports {INTAKE_HINT}.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept={ACCEPT_ATTR}
                    className="sr-only"
                    onChange={handleFileSelected}
                  />
                  <span className="text-[var(--accent-voice)] font-semibold text-sm hover:text-[var(--ink-700)] transition-colors">
                    Got it, proceed
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowUploadConfirm(false)}
                  className="text-[var(--ink-500)] hover:text-[var(--ink-900)] text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clone confirmation card — same pattern as upload confirm */}
      {showCloneConfirm && currentSop && (
        <div className="mb-4 bg-[var(--accent-signoff)]/10 border border-[var(--accent-signoff)]/30 rounded-xl px-4 py-4">
          <div className="flex items-start gap-3">
            <CopyIcon className="h-5 w-5 text-[var(--accent-signoff)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--ink-900)] leading-relaxed">
                This will copy the current published version (v{currentSop.version}) into a new editable draft.
                Workers continue using the current version until you publish the draft.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={handleClone}
                  className="text-[var(--accent-signoff)] font-semibold text-sm hover:text-[var(--ink-700)] transition-colors"
                >
                  Create draft copy
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloneConfirm(false)}
                  className="text-[var(--ink-500)] hover:text-[var(--ink-900)] text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-400">{error}</p>
      )}

      {/* Version history table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-[var(--ink-500)]">Loading version history...</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-[var(--ink-500)]">No versions found.</p>
        </div>
      ) : (
        <div className="w-full bg-white rounded-lg overflow-hidden border border-[var(--ink-100)]">
          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_1fr_200px] gap-4 px-4 py-3 bg-[var(--paper)]/60">
            <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide">Version</span>
            <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide">Uploaded</span>
            <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide text-right">Actions</span>
          </div>

          {/* Data rows */}
          {versions.map((ver) => {
            const isCurrent = ver.superseded_by === null && ver.status === 'published'
            const isRestoringThis = restoringVersionId === ver.id
            const showRestoreConfirm = showRestoreConfirmFor === ver.id
            const verApprovals = approvals.filter((a) => a.sopId === ver.id)

            // Compare: A = this version, B = current
            const currentId = currentSop?.id
            const compareUrl = currentId
              ? `/admin/sops/${sopId}/versions/diff?a=${ver.id}&b=${currentId}`
              : null

            return (
              <div key={ver.id} className="border-t border-[var(--ink-100)]">
                <div
                  className="grid grid-cols-[80px_1fr_1fr_200px] gap-4 px-4 items-center min-h-[56px] text-sm text-[var(--ink-900)]"
                >
                  {/* Version number */}
                  <span className="text-sm font-mono font-semibold">v{ver.version}</span>

                  {/* Upload date */}
                  <span className="text-sm text-[var(--ink-500)]">{formatDate(ver.created_at)}</span>

                  {/* Status badge */}
                  <span>
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--ink-900)]/20 text-[var(--ink-900)] text-xs font-semibold rounded">
                        Current
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-[var(--paper-2)] text-[var(--ink-500)] text-xs font-medium rounded">
                        Superseded
                      </span>
                    )}
                  </span>

                  {/* Actions */}
                  <div className="flex justify-end items-center gap-2 flex-wrap">
                    {isCurrent && (
                      <Link
                        href={`/admin/sops/builder/${ver.id}`}
                        className="text-[var(--ink-900)] hover:text-[var(--ink-700)] text-sm font-medium transition-colors"
                      >
                        Review
                      </Link>
                    )}

                    {/* Compare — links to diff page: A=this version, B=current */}
                    {compareUrl && !isCurrent && (
                      <Link
                        href={compareUrl}
                        className="text-[var(--ink-500)] hover:text-[var(--ink-900)] text-sm font-medium transition-colors"
                        title="Compare with current version"
                      >
                        Compare
                      </Link>
                    )}

                    {/* Restore as new version — D-06: per non-current version */}
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowRestoreConfirmFor(showRestoreConfirm ? null : ver.id)
                        }
                        disabled={!!restoringVersionId}
                        className="text-[var(--accent-signoff)] hover:text-[var(--ink-700)] text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isRestoringThis ? 'Restoring...' : 'Restore'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline restore confirmation — D-06, mirrors showUploadConfirm pattern */}
                {showRestoreConfirm && !isCurrent && (
                  <div className="mx-4 mb-3 bg-[var(--paper-2)] border border-[var(--ink-100)] rounded-xl px-4 py-3">
                    <p className="text-sm text-[var(--ink-900)] leading-relaxed mb-2">
                      This copies v{ver.version} content into a <strong>new draft</strong>.
                      The old version is not reactivated — history stays append-only.
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleRestore(ver.id)}
                        className="text-[var(--accent-signoff)] font-semibold text-sm hover:text-[var(--ink-700)] transition-colors"
                      >
                        Restore as new version
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRestoreConfirmFor(null)}
                        className="text-[var(--ink-500)] hover:text-[var(--ink-900)] text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Approval history — read-only, D29-06 (APR-05). Grouped under
                    this version; approver + step labels already resolved by
                    getApprovalHistory server-side. */}
                {verApprovals.length > 0 && (
                  <ul className="mx-4 mb-3 space-y-1">
                    {verApprovals.map((a) => (
                      <li key={a.id} className="text-xs text-[var(--ink-500)]">
                        <span className="font-medium text-[var(--ink-900)]">{a.approverLabel}</span>
                        {' — '}
                        {a.action === 'approved' ? 'Approved' : 'Requested changes'}
                        {' — '}
                        {a.stepLabel}
                        {' — '}
                        {formatDate(a.createdAt)}
                        {a.comment && <span className="italic"> ({a.comment})</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {/* TRN-03 completion breakdown (D-09) — coaching framing, no
                    write control, no "force re-walk" action. Renders a zero
                    state so an admin can tell "nobody" from "not loaded". */}
                {(() => {
                  const verBreakdown = breakdown?.versions.find((v) => v.sopId === ver.id)
                  const completionCount = verBreakdown?.completionCount ?? 0
                  const isExpanded = expandedVersionIds.has(ver.id)
                  const outdatedNote = !isCurrent && completionCount > 0
                  return (
                    <div className="mx-4 mb-3 pt-2 border-t border-[var(--ink-100)]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleVersionExpanded(ver.id)}
                          className="text-xs font-medium text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
                        >
                          {isExpanded ? 'Hide' : 'Show'} workers
                        </button>
                        <span className="text-xs text-[var(--ink-500)]">
                          {completionCount === 0
                            ? 'No completions on this version'
                            : `${completionCount} completed this version`}
                        </span>
                        {outdatedNote && (
                          <span className="text-xs font-medium text-[var(--accent-voice)]">
                            — trained on an outdated version
                          </span>
                        )}
                      </div>
                      {isExpanded && (
                        verBreakdown && verBreakdown.workers.length > 0 ? (
                          <ul className="mt-2 space-y-1 pl-1">
                            {verBreakdown.workers.map((w) => (
                              <li key={w.userId} className="text-xs text-[var(--ink-500)]">
                                <span className="font-medium text-[var(--ink-900)]">{w.displayName}</span>
                                {' — '}
                                {formatDate(w.completedAt)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--ink-500)]">No workers to show.</p>
                        )
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </AdminPageShell>
  )
}
