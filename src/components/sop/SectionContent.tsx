'use client'
import { AlertTriangle, ShieldCheck, Siren } from 'lucide-react'
import { SopImageInline } from '@/components/sop/SopImageInline'
import { SopTable, containsMarkdownTable } from '@/components/sop/SopTable'
import type { SopSection, SopStep, SopImage } from '@/types/sop'

type SectionWithChildren = SopSection & {
  sop_steps: SopStep[]
  sop_images: SopImage[]
}

interface SectionContentProps {
  section: SectionWithChildren
}

function parseContentLines(content: string | null): string[] {
  if (!content) return []
  return content
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

function HazardContent({ section }: { section: SectionWithChildren }) {
  const isEmergency = section.section_type === 'emergency'
  const Icon = isEmergency ? Siren : AlertTriangle
  const lines = parseContentLines(section.content)

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-red-400 flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-red-400">
          {section.title}
        </span>
      </div>
      {lines.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-steel-100 leading-relaxed">
              <span className="text-red-400 mt-1.5 flex-shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : section.content ? (
        <p className="text-base text-steel-100 leading-relaxed mt-3">{section.content}</p>
      ) : null}
    </div>
  )
}

function PpeContent({ section }: { section: SectionWithChildren }) {
  const items = parseContentLines(section.content)

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={18} className="text-blue-400 flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-blue-400">
          {section.title}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap -m-1 mt-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30 m-1"
            >
              {item}
            </span>
          ))}
        </div>
      ) : section.content ? (
        <p className="text-base text-steel-100 leading-relaxed mt-3">{section.content}</p>
      ) : null}
    </div>
  )
}

function StepsContent({ section }: { section: SectionWithChildren }) {
  const stepImages = section.sop_images.filter((img) => !img.step_id)

  return (
    <div className="flex flex-col gap-3">
      {section.sop_steps.map((step) => {
        const images = section.sop_images.filter((img) => img.step_id === step.id)
        return (
          <div
            key={step.id}
            className="flex items-start gap-4 p-4 bg-steel-800 rounded-xl border border-steel-700"
          >
            <span className="text-[13px] font-bold text-steel-400 w-6 flex-shrink-0 pt-0.5 tabular-nums">
              {step.step_number}
            </span>
            <div className="flex-1 min-w-0">
              {containsMarkdownTable(step.text)
                ? <SopTable markdown={step.text} />
                : <p className="text-base text-steel-100 leading-relaxed">{step.text}</p>
              }
              {images.map((img) => (
                <SopImageInline key={img.id} src={img.storage_path} alt={img.alt_text ?? 'Step image'} />
              ))}
            </div>
          </div>
        )
      })}
      {stepImages.map((img) => (
        <SopImageInline key={img.id} src={img.storage_path} alt={img.alt_text ?? 'Section image'} />
      ))}
    </div>
  )
}

function DefaultContent({ section }: { section: SectionWithChildren }) {
  const hasTable = containsMarkdownTable(section.content)

  return (
    <div className="bg-steel-800 border border-steel-700 rounded-xl p-5 mb-4">
      {section.content && (
        hasTable
          ? <SopTable markdown={section.content} />
          : <p className="text-base text-steel-100 leading-relaxed whitespace-pre-wrap">{section.content}</p>
      )}
    </div>
  )
}

export function SectionContent({ section }: SectionContentProps) {
  switch (section.section_type) {
    case 'hazards':
    case 'emergency':
      return <HazardContent section={section} />
    case 'ppe':
      return <PpeContent section={section} />
    case 'steps':
      return <StepsContent section={section} />
    default:
      return <DefaultContent section={section} />
  }
}
