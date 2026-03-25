'use client'
import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import type { CachedSop } from '@/lib/offline/db'

interface SopLibraryCardProps {
  sop: CachedSop
  isCached: boolean
}

export function SopLibraryCard({ sop, isCached }: SopLibraryCardProps) {
  const meta = [sop.category, sop.department].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/sops/${sop.id}`}
      className="flex items-start gap-4 p-4 bg-steel-800 rounded-xl hover:bg-steel-700 active:bg-steel-600 transition-colors cursor-pointer min-h-[88px] border border-transparent hover:border-steel-600"
    >
      {/* Left column — icon + cache dot */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
        <FileText size={28} className="text-steel-400" />
        {isCached ? (
          <span
            className="w-2.5 h-2.5 rounded-full bg-green-500"
            title="Available offline"
          />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-steel-600" />
        )}
      </div>

      {/* Middle column — title, meta, badges */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-steel-100 leading-snug line-clamp-2">
          {sop.title ?? 'Untitled SOP'}
        </p>
        {meta && (
          <p className="text-xs text-steel-400 mt-0.5">{meta}</p>
        )}
        {sop.sop_number && (
          <p className="text-xs text-steel-400 font-mono">{sop.sop_number}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-yellow/20 text-brand-yellow text-xs font-semibold rounded">
            Assigned
          </span>
        </div>
      </div>

      {/* Right column — chevron */}
      <div className="flex-shrink-0 flex flex-col items-end justify-between self-stretch">
        <ChevronRight size={18} className="text-steel-400" />
      </div>
    </Link>
  )
}
