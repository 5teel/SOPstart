// Phase 56 D-11: a quiet standards label beside a SOP or section title.
export { standardNames } from '@/lib/sop/placement'

export function StandardLabels({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <>
      {names.map((n) => (
        <span
          key={n}
          data-testid="standard-label"
          className="font-label text-micro text-accent-inspect bg-accent-inspect/10 rounded px-1.5 py-px"
        >
          {n}
        </span>
      ))}
    </>
  )
}
