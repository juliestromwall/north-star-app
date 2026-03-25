import { SURROGATE_STAGES } from '@/lib/constants'

export default function StageBadge({ stage, status, className = '' }) {
  const stageObj = SURROGATE_STAGES.find(s => s.id === stage || s.label === stage)
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
