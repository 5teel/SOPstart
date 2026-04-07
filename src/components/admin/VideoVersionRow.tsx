'use client'

import { useState, useRef, useEffect } from 'react'
import { Edit2, Upload, EyeOff, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import VideoGenerationStatus from '@/components/admin/VideoGenerationStatus'
import {
  publishVersionExclusive,
  unpublishVideo,
  archiveVersion,
  unarchiveVersion,
  permanentDeleteVersion,
  updateVersionLabel,
} from '@/actions/video'
import type { VideoGenerationJob } from '@/types/sop'

interface VideoVersionRowProps {
  version: VideoGenerationJob
  sopId: string
  isArchived?: boolean
  onMutate: () => void
}

type ConfirmAction = 'publish' | 'archive' | 'delete' | null

const ACTIVE_STATUSES = ['queued', 'analyzing', 'generating_audio', 'rendering'] as const

function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status)
}

export default function VideoVersionRow({ version, sopId, isArchived, onMutate }: VideoVersionRowProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [editing, setEditing] = useState(false)
  const [labelValue, setLabelValue] = useState(version.label ?? '')
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)

  const isActive = isActiveStatus(version.status)

  // Auto-focus label input when editor opens
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleOpenConfirm = (action: ConfirmAction) => {
    setConfirmAction(action)
    setTimeout(() => {
      const firstBtn = confirmRef.current?.querySelector<HTMLButtonElement>('button')
      firstBtn?.focus()
    }, 50)
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setPending(true)
    try {
      if (confirmAction === 'publish') {
        await publishVersionExclusive(version.id, sopId)
      } else if (confirmAction === 'archive') {
        await archiveVersion(version.id)
      } else if (confirmAction === 'delete') {
        await permanentDeleteVersion(version.id)
      }
      onMutate()
    } finally {
      setPending(false)
      setConfirmAction(null)
    }
  }

  const handleUnpublish = async () => {
    setPending(true)
    try {
      await unpublishVideo(version.id)
      onMutate()
    } finally {
      setPending(false)
    }
  }

  const handleUnarchive = async () => {
    setPending(true)
    try {
      await unarchiveVersion(version.id)
      onMutate()
    } finally {
      setPending(false)
    }
  }

  const handleLabelSave = async () => {
    setEditing(false)
    const trimmed = labelValue.trim() || null
    await updateVersionLabel(version.id, trimmed)
    onMutate()
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleLabelSave()
    } else if (e.key === 'Escape') {
      setLabelValue(version.label ?? '')
      setEditing(false)
    }
  }

  // Format badge
  const formatLabel =
    version.format === 'narrated_slideshow' ? 'Narrated slideshow' : 'Screen recording'

  // Status badge
  let statusBadge: { cls: string; text: string }
  if (isActive) {
    statusBadge = { cls: 'bg-blue-500/20 text-blue-400 animate-pulse', text: 'Generating' }
  } else if (version.status === 'ready' && version.published) {
    statusBadge = { cls: 'bg-green-500/20 text-green-400', text: 'Published' }
  } else if (version.status === 'ready') {
    statusBadge = { cls: 'bg-steel-700 text-steel-400', text: 'Ready' }
  } else {
    statusBadge = { cls: 'bg-red-500/20 text-red-400', text: 'Failed' }
  }

  // Created date
  const createdDate = new Date(version.created_at).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Confirm panel copy
  const confirmCopy: Record<NonNullable<ConfirmAction>, string> = {
    publish:
      'Publish this version? Workers will see it in the SOP video tab. Any currently published version will be unpublished.',
    archive: 'Archive this version? You can restore it from the archived section.',
    delete:
      'Permanently delete this version? The video file and all data will be removed and cannot be recovered.',
  }
  const confirmButtonCls: Record<NonNullable<ConfirmAction>, string> = {
    publish: 'bg-brand-yellow text-steel-900',
    archive: 'bg-steel-600 text-steel-100',
    delete: 'bg-red-600 text-steel-100',
  }
  const confirmLabel: Record<NonNullable<ConfirmAction>, string> = {
    publish: 'Yes, publish',
    archive: 'Yes, archive',
    delete: 'Delete permanently',
  }
  const cancelLabel: Record<NonNullable<ConfirmAction>, string> = {
    publish: 'Not yet',
    archive: 'Keep version',
    delete: 'Keep it',
  }

  return (
    <div
      className={`rounded-lg bg-steel-800 border border-steel-700 overflow-hidden ${
        version.published ? 'border-l-2 border-l-brand-yellow' : ''
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-3 flex-wrap">
        {/* Version number */}
        <span className="text-xs font-semibold text-steel-400 shrink-0">
          v{version.version_number}
        </span>

        {/* Format badge */}
        <span className="text-xs px-2 py-0.5 rounded bg-steel-700 text-steel-400 shrink-0">
          {formatLabel}
        </span>

        {/* Status badge */}
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${statusBadge.cls}`}>
          {statusBadge.text}
        </span>

        {/* Label */}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={handleLabelKeyDown}
            maxLength={60}
            placeholder="E.g. Final cut, Training version..."
            className="bg-steel-900 border border-steel-600 rounded px-2 py-1 text-sm text-steel-100 w-full max-w-[240px]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm shrink-0 min-w-0 truncate"
          >
            {version.label ? (
              <span className="text-steel-100">{version.label}</span>
            ) : (
              <span className="text-steel-600 italic">Add label...</span>
            )}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Date */}
        <span className="text-xs text-steel-400 shrink-0">{createdDate}</span>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {!isArchived ? (
            <>
              {/* Edit label icon */}
              <button
                onClick={() => setEditing(true)}
                className="w-8 h-8 flex items-center justify-center text-steel-400 hover:text-steel-100 transition-colors"
                title="Edit label"
                disabled={pending}
              >
                <Edit2 size={16} />
              </button>

              {/* Publish icon — only on ready + unpublished */}
              {version.status === 'ready' && !version.published && (
                <button
                  onClick={() => handleOpenConfirm('publish')}
                  className="w-8 h-8 flex items-center justify-center text-steel-400 hover:text-steel-100 transition-colors"
                  title="Publish this version"
                  disabled={pending}
                >
                  <Upload size={16} />
                </button>
              )}

              {/* Unpublish icon — only on published */}
              {version.published && (
                <button
                  onClick={handleUnpublish}
                  className="w-8 h-8 flex items-center justify-center text-steel-400 hover:text-steel-100 transition-colors"
                  title="Unpublish"
                  disabled={pending}
                >
                  <EyeOff size={16} />
                </button>
              )}

              {/* Archive icon — ready/failed only, disabled during active generation */}
              {(version.status === 'ready' || version.status === 'failed') && (
                <button
                  onClick={() => !isActive && handleOpenConfirm('archive')}
                  className={`w-8 h-8 flex items-center justify-center transition-colors ${
                    isActive
                      ? 'text-steel-600 opacity-50 cursor-not-allowed'
                      : 'text-steel-400 hover:text-steel-100'
                  }`}
                  title={
                    isActive
                      ? 'Wait for generation to complete before archiving.'
                      : 'Archive this version'
                  }
                  disabled={pending || isActive}
                >
                  <Archive size={16} />
                </button>
              )}
            </>
          ) : (
            <>
              {/* Unarchive (restore) icon */}
              <button
                onClick={handleUnarchive}
                className="w-8 h-8 flex items-center justify-center text-steel-400 hover:text-steel-100 transition-colors"
                title="Restore from archive"
                disabled={pending}
              >
                <ArchiveRestore size={16} />
              </button>

              {/* Permanent delete icon */}
              <button
                onClick={() => handleOpenConfirm('delete')}
                className="w-8 h-8 flex items-center justify-center text-steel-400 hover:text-red-400 transition-colors"
                title="Permanently delete"
                disabled={pending}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline generation stepper */}
      {isActive && (
        <div className="px-3 pb-3">
          <VideoGenerationStatus
            jobId={version.id}
            initialStatus={version.status}
            initialStage={version.current_stage}
            onComplete={() => onMutate()}
            onFailed={() => onMutate()}
          />
          <p className="text-xs text-steel-400 mt-1">
            Generating your video — this usually takes 2-5 minutes.
          </p>
        </div>
      )}

      {/* Inline confirm panel */}
      {confirmAction && (
        <div
          ref={confirmRef}
          role="alertdialog"
          aria-modal="true"
          className="mx-3 mb-3 bg-steel-800 border border-steel-700 rounded-lg p-4"
        >
          <p className="text-sm text-steel-100 mb-4">{confirmCopy[confirmAction]}</p>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={pending}
              className={`flex-1 h-[44px] ${confirmButtonCls[confirmAction]} font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50`}
            >
              {pending ? 'Working...' : confirmLabel[confirmAction]}
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              disabled={pending}
              className="flex-1 h-[44px] bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 transition-colors disabled:opacity-50"
            >
              {cancelLabel[confirmAction]}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
