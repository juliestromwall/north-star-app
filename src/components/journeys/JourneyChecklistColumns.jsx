import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { ChevronDown } from 'lucide-react'
import TrackingTable from '@/components/shared/TrackingTable'
import { deriveParentStatus } from '@/lib/checklistStore'

/**
 * Journey-specific layout: a top "Journey Progress" bar over a grid of
 * column cards (Medical / Legal / Transfer in 3 cols, Pregnancy + any
 * extra milestones full-width below).
 *
 * Columns are derived from the existing checklist `milestones` config so the
 * admin can already arrange/rename them in /settings → Matched Journey
 * Checklist (no schema change needed). The first three milestones become
 * the side-by-side columns; subsequent milestones render as full-width
 * sections below. Steps not referenced by any milestone fall into a final
 * "Other" full-width section so nothing disappears.
 */
export default function JourneyChecklistColumns({ steps, milestones, statuses, tracking, onUpdate, currentUserName, onStatusLog, title = 'Journey Progress' }) {
  // Bucket steps by milestone, preserving milestone order
  const buckets = useMemo(() => {
    const used = new Set()
    const result = []
    for (const ms of (milestones || [])) {
      const ids = ms.stepIds || []
      const colSteps = []
      for (const sid of ids) {
        const step = steps.find(s => s.id === sid)
        if (step) { colSteps.push(step); used.add(sid) }
      }
      result.push({ id: ms.id, label: ms.label, steps: colSteps })
    }
    const orphans = steps.filter(s => !used.has(s.id) && !s.parentId)
    if (orphans.length > 0) {
      result.push({ id: '_other', label: 'Other', steps: orphans })
    }
    return result
  }, [milestones, steps])

  // Top 3 buckets render side-by-side; the rest stack full-width below.
  // Order matches the milestones config so the admin controls layout from /settings.
  const topThree = buckets.slice(0, 3)
  const fullWidth = buckets.slice(3)

  // Overall progress across every active top-level step
  const progress = useMemo(() => {
    const topLevel = steps.filter(s => !s.parentId)
    let active = 0, done = 0
    for (const s of topLevel) {
      const kids = steps.filter(c => c.parentId === s.id)
      const st = kids.length > 0 ? deriveParentStatus(kids, tracking) : tracking[s.id]?.status
      if (st === 'na') continue
      active++
      if (st === 'complete' || st === 'partial_complete') done++
    }
    return { done, active }
  }, [steps, tracking])
  const pct = progress.active > 0 ? Math.round((progress.done / progress.active) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Top: Journey Progress bar */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-stone-800">{title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-400">{pct}%</span>
              <span className="text-sm font-bold text-[#283693]">{progress.done}<span className="text-stone-300 font-normal">/{progress.active}</span></span>
            </div>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #283693, #ed148c)' }} />
          </div>
        </div>
      </Card>

      {/* 3 columns */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {topThree.map(bucket => (
            <ColumnCard
              key={bucket.id}
              bucket={bucket}
              statuses={statuses}
              tracking={tracking}
              onUpdate={onUpdate}
              currentUserName={currentUserName}
              onStatusLog={onStatusLog}
            />
          ))}
        </div>
      )}

      {/* Full-width buckets (Pregnancy, Postpartum, Other, etc.) */}
      {fullWidth.map(bucket => (
        <ColumnCard
          key={bucket.id}
          bucket={bucket}
          statuses={statuses}
          tracking={tracking}
          onUpdate={onUpdate}
          currentUserName={currentUserName}
          onStatusLog={onStatusLog}
          fullWidth
        />
      ))}
    </div>
  )
}

function ColumnCard({ bucket, statuses, tracking, onUpdate, currentUserName, onStatusLog, fullWidth = false }) {
  const [collapsed, setCollapsed] = useState(false)

  // Per-column progress for the header badge
  const { done, active } = useMemo(() => {
    let d = 0, a = 0
    for (const s of bucket.steps) {
      const st = tracking[s.id]?.status
      if (st === 'na') continue
      a++
      if (st === 'complete' || st === 'partial_complete') d++
    }
    return { done: d, active: a }
  }, [bucket.steps, tracking])

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-[#283693]/[0.04] to-[#ed148c]/[0.04] border-b border-stone-100 hover:from-[#283693]/[0.07] hover:to-[#ed148c]/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-[#283693] uppercase tracking-wide">{bucket.label}</h4>
          {active > 0 && (
            <span className="text-[10px] font-bold text-stone-500 bg-white border border-stone-200 px-1.5 py-0.5 rounded-full">
              {done}/{active}
            </span>
          )}
        </div>
        <ChevronDown className={`size-4 text-stone-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>
      {!collapsed && (
        bucket.steps.length === 0 ? (
          <p className="text-xs text-stone-400 italic text-center py-6">No tasks in this section yet.</p>
        ) : (
          <TrackingTable
            steps={bucket.steps}
            statuses={statuses}
            tracking={tracking}
            onUpdate={onUpdate}
            currentUserName={currentUserName}
            onStatusLog={onStatusLog}
            noHeader
            noCard
          />
        )
      )}
    </Card>
  )
}
