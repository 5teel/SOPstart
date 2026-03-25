'use client'
import { useState } from 'react'
import { ShieldAlert, AlertTriangle, ShieldCheck, Siren, ChevronDown } from 'lucide-react'
import type { SopSection } from '@/types/sop'

interface SafetyAcknowledgementProps {
  sopId: string
  hazardsSection?: SopSection
  ppeSection?: SopSection
  emergencySection?: SopSection
  onAcknowledge: () => void
}

function parseListItems(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

export function SafetyAcknowledgement({
  hazardsSection,
  ppeSection,
  emergencySection,
  onAcknowledge,
}: SafetyAcknowledgementProps) {
  const [emergencyExpanded, setEmergencyExpanded] = useState(false)

  return (
    <div className="fixed inset-0 z-40 bg-steel-900 flex flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 px-4 py-8 pb-[120px] max-w-2xl mx-auto w-full">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <ShieldAlert size={40} className="text-brand-orange" />
          <h1 className="text-2xl font-bold text-steel-100">Before you start</h1>
          <p className="text-base text-steel-400">
            Review the hazards and required PPE for this procedure.
          </p>
        </div>

        {/* Hazards card */}
        {hazardsSection && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                Hazards
              </span>
            </div>
            <div className="border-t border-red-500/20 my-3" />
            {hazardsSection.content ? (
              <ul className="list-none space-y-2">
                {parseListItems(hazardsSection.content).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-base text-steel-100 leading-relaxed">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-steel-100 leading-relaxed">{hazardsSection.title}</p>
            )}
          </div>
        )}

        {/* PPE card */}
        {ppeSection && (
          <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                PPE Required
              </span>
            </div>
            <div className="border-t border-blue-500/20 my-3" />
            {ppeSection.content ? (
              <div className="flex flex-wrap gap-2">
                {parseListItems(ppeSection.content).map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-base text-steel-100 leading-relaxed">{ppeSection.title}</p>
            )}
          </div>
        )}

        {/* Emergency card (collapsible) */}
        {emergencySection && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setEmergencyExpanded((v) => !v)}
              className="flex items-center justify-between p-4 min-h-[56px] w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Siren size={18} className="text-red-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                  Emergency Procedures
                </span>
              </div>
              <ChevronDown
                size={16}
                className={`text-steel-400 transition-transform duration-200 ${emergencyExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            {emergencyExpanded && emergencySection.content && (
              <div className="px-5 pb-5 text-base text-steel-100 leading-relaxed">
                {emergencySection.content}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom acknowledgement bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-steel-900 border-t border-steel-700 px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={onAcknowledge}
          className="w-full h-[80px] bg-brand-orange text-white font-bold text-lg rounded-xl hover:bg-orange-500 active:bg-orange-700 transition-colors flex items-center justify-center gap-2"
        >
          <ShieldCheck size={22} />
          Understood — Start Procedure
        </button>
      </div>
    </div>
  )
}
