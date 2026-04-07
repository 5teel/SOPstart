'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import VideoVersionRow from './VideoVersionRow'
import type { VideoGenerationJob } from '@/types/sop'

interface VideoVersionListProps {
  versions: VideoGenerationJob[]
  archivedVersions: VideoGenerationJob[]
  sopId: string
  onMutate: () => void
}

export default function VideoVersionList({
  versions,
  archivedVersions,
  sopId,
  onMutate,
}: VideoVersionListProps) {
  const [showArchived, setShowArchived] = useState(false)

  if (versions.length === 0 && archivedVersions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-semibold text-steel-100">No videos generated yet</p>
        <p className="text-sm text-steel-400 mt-2">
          Choose a format above and generate your first video version.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Active/ready versions */}
      {versions.map((v) => (
        <VideoVersionRow key={v.id} version={v} sopId={sopId} onMutate={onMutate} />
      ))}

      {/* Archived section */}
      {archivedVersions.length > 0 && (
        <div className="pt-4">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-1 text-sm text-steel-400 hover:text-steel-100 transition-colors"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${showArchived ? 'rotate-180' : ''}`}
            />
            {showArchived
              ? 'Hide archived versions'
              : `Show ${archivedVersions.length} archived version${archivedVersions.length === 1 ? '' : 's'}`}
          </button>
          {showArchived && (
            <div className="space-y-2 mt-2">
              {archivedVersions.map((v) => (
                <VideoVersionRow
                  key={v.id}
                  version={v}
                  sopId={sopId}
                  isArchived
                  onMutate={onMutate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
