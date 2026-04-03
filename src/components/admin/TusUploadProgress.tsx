'use client'

interface TusUploadProgressProps {
  percentage: number  // 0-100
}

export function TusUploadProgress({ percentage }: TusUploadProgressProps) {
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1 bg-steel-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-yellow rounded-full transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-steel-400 tabular-nums w-[36px] text-right">
        {percentage}%
      </span>
    </div>
  )
}
