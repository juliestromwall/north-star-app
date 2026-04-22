import { SURROGATE_STAGES, IP_STAGES } from '@/lib/constants'

// Compact status pill colored by journey stage — used in list views where the
// stage is usually "Matched Journey" and showing both is redundant.
export function JourneyStatusPill({ stage, status, caseType }) {
  const stages = caseType === 'ip' ? IP_STAGES : SURROGATE_STAGES
  const stageObj = stages.find(s => s.id === stage || s.label === stage)
    || SURROGATE_STAGES.find(s => s.id === stage || s.label === stage)
  const color = stageObj?.color || '#283693'
  const label = status || stageObj?.label || '—'
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border whitespace-nowrap"
      style={{ color, backgroundColor: `${color}12`, borderColor: `${color}30` }}
    >
      {label}
    </span>
  )
}

export default function StageBadge({ stage, status, className = '', caseType }) {
  const stages = caseType === 'ip' ? IP_STAGES : SURROGATE_STAGES
  const stageObj = stages.find(s => s.id === stage || s.label === stage) || SURROGATE_STAGES.find(s => s.id === stage || s.label === stage)
  const color = stageObj?.color || '#283693'
  const label = stageObj?.label || stage || '—'

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
        style={{
          color,
          backgroundColor: `${color}15`,
          borderColor: `${color}30`,
        }}
      >
        {label}
      </span>
      {status && (
        <span className="text-xs text-stone-500 font-medium">{status}</span>
      )}
    </div>
  )
}
