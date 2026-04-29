// Two-pane milestone checklist UI: left rail of milestones + right form
// pane showing the selected milestone's steps. Used by Journey, Surrogate
// (gc), and IP detail pages — pass userType='gc' or 'ip' and the stage.
//
// Each status pill click appends to entry.log so admins can audit who
// changed what when. Call onUpdate(stepId, updates) to persist (caller
// merges into journey_data._checklistTracking or whatever store applies).

import { useState, useEffect, useMemo } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Circle, ChevronDown, ChevronRight } from 'lucide-react'
import { getChecklistSteps, getChecklistMilestones, CHECKLIST_STEP_STATUSES, normalizeOptions } from '@/lib/checklistStore'

// Tailwind class for an active option pill, picked from the option's
// mapsTo target. Lets admin-defined dropdowns inherit the same color
// language as the built-in statuses.
const PILL_ACTIVE_BY_STATUS = {
  complete: 'bg-emerald-500 border-emerald-500 text-white',
  na: 'bg-stone-400 border-stone-400 text-white',
  skipped: 'bg-amber-500 border-amber-500 text-white',
  in_progress: 'bg-[#283693] border-[#283693] text-white',
  reviewing: 'bg-[#283693] border-[#283693] text-white',
  requested: 'bg-[#283693] border-[#283693] text-white',
  records_received: 'bg-[#283693] border-[#283693] text-white',
  partial_received: 'bg-[#283693] border-[#283693] text-white',
  followed_up: 'bg-[#283693] border-[#283693] text-white',
  started: 'bg-[#283693] border-[#283693] text-white',
  submitted: 'bg-[#283693] border-[#283693] text-white',
  not_started: 'bg-stone-200 border-stone-300 text-stone-700',
}

function formatRelativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.floor((now - then) / 1000))
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export default function MilestoneFormView({ userType = 'gc', stageId, tracking, onUpdate, onStatusLog, currentUserName }) {
  const milestones = useMemo(() => getChecklistMilestones(userType, stageId), [userType, stageId])
  const allSteps = useMemo(() => getChecklistSteps(userType, stageId).filter(s => s.type !== 'info_row'), [userType, stageId])
  const stepMap = useMemo(() => Object.fromEntries(allSteps.map(s => [s.id, s])), [allSteps])

  const milestonesWithProgress = useMemo(() => {
    const list = milestones.map(ms => {
      const steps = (ms.stepIds || []).map(id => stepMap[id]).filter(Boolean)
      const statuses = steps.map(s => tracking?.[s.id]?.status || 'not_started')
      const hasSteps = statuses.length > 0
      const allDone = hasSteps && statuses.every(st => ['complete', 'na', 'skipped'].includes(st))
      const anyStarted = statuses.some(st => st !== 'not_started')
      const status = allDone ? 'complete' : anyStarted ? 'in_progress' : 'not_started'
      const completedCount = statuses.filter(st => ['complete', 'na', 'skipped'].includes(st)).length
      return { ...ms, steps, status, completedCount, totalCount: steps.length }
    })
    const inMilestones = new Set(milestones.flatMap(m => m.stepIds || []))
    const orphans = allSteps.filter(s => !inMilestones.has(s.id))
    if (orphans.length > 0) {
      const statuses = orphans.map(s => tracking?.[s.id]?.status || 'not_started')
      const allDone = statuses.every(st => ['complete', 'na', 'skipped'].includes(st))
      const anyStarted = statuses.some(st => st !== 'not_started')
      list.push({
        id: '_other',
        label: 'Other Steps',
        steps: orphans,
        status: allDone ? 'complete' : anyStarted ? 'in_progress' : 'not_started',
        completedCount: statuses.filter(st => ['complete', 'na', 'skipped'].includes(st)).length,
        totalCount: orphans.length,
      })
    }
    return list
  }, [milestones, allSteps, stepMap, tracking])

  const defaultId = useMemo(() => {
    const firstActive = milestonesWithProgress.find(m => m.status !== 'complete')
    return firstActive?.id || milestonesWithProgress[0]?.id || null
  }, [milestonesWithProgress])
  const [selectedId, setSelectedId] = useState(defaultId)
  useEffect(() => { if (!selectedId && defaultId) setSelectedId(defaultId) }, [defaultId, selectedId])

  const [manualExpanded, setManualExpanded] = useState({})
  function isExpanded(ms) {
    if (manualExpanded[ms.id] !== undefined) return manualExpanded[ms.id]
    return ms.status !== 'complete'
  }
  function toggleExpanded(ms) {
    setManualExpanded(prev => ({ ...prev, [ms.id]: !isExpanded(ms) }))
  }

  const selected = milestonesWithProgress.find(m => m.id === selectedId) || milestonesWithProgress[0]

  if (milestonesWithProgress.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-8">No milestones configured for this stage. Set them up in Settings.</p>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <div className="relative">
        <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-stone-200" aria-hidden />
        <div className="space-y-1.5 relative">
          {milestonesWithProgress.map(ms => (
            <MilestoneRailRow
              key={ms.id}
              milestone={ms}
              selected={selectedId === ms.id}
              expanded={isExpanded(ms)}
              tracking={tracking}
              onSelect={() => setSelectedId(ms.id)}
              onToggle={() => toggleExpanded(ms)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        {selected && (
          <MilestoneFormPane
            milestone={selected}
            milestoneNumber={milestonesWithProgress.findIndex(m => m.id === selected.id) + 1}
            tracking={tracking}
            onUpdate={onUpdate}
            onStatusLog={onStatusLog}
            currentUserName={currentUserName}
          />
        )}
      </div>
    </div>
  )
}

function MilestoneRailRow({ milestone, selected, expanded, tracking, onSelect, onToggle }) {
  const ms = milestone
  const isComplete = ms.status === 'complete'
  const isInProgress = ms.status === 'in_progress'
  const dotClass = isComplete
    ? 'bg-[#283693] border-[#283693] text-white'
    : isInProgress
      ? 'bg-white border-[#ed148c] text-[#ed148c]'
      : 'bg-white border-stone-300 text-stone-300'

  return (
    <div className={`rounded-xl transition-colors ${selected ? 'bg-[#283693]/5 ring-1 ring-[#283693]/20' : ''}`}>
      <div className="flex items-start gap-3 px-2 py-2">
        <button
          onClick={onSelect}
          className={`mt-0.5 size-7 rounded-full border-[2.5px] flex items-center justify-center shrink-0 transition-all ${dotClass} ${selected ? 'scale-105' : ''}`}
          title={`Open ${ms.label}`}
        >
          {isComplete && <Check className="size-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={onSelect} className={`block text-left text-sm font-semibold leading-tight ${selected ? 'text-[#283693]' : isComplete ? 'text-stone-700' : 'text-stone-800'} hover:text-[#283693]`}>
            {ms.label}
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-stone-400">{ms.completedCount}/{ms.totalCount} done</p>
            {ms.totalCount > 0 && (
              <button onClick={onToggle} className="text-[10px] text-stone-400 hover:text-stone-600" title={expanded ? 'Collapse' : 'Expand'}>
                {expanded ? <ChevronDown className="size-3 inline" /> : <ChevronRight className="size-3 inline" />}
              </button>
            )}
          </div>
          {expanded && ms.steps.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {ms.steps.map(s => {
                const st = tracking?.[s.id]?.status || 'not_started'
                const done = st === 'complete' || st === 'na' || st === 'skipped'
                return (
                  <li key={s.id} className={`text-[11px] leading-tight ${done ? 'text-stone-400' : 'text-stone-600'}`}>
                    <span className="text-stone-300 mr-1">–</span>
                    {s.label}
                    {st === 'skipped' && <span className="ml-1 text-[9px] uppercase tracking-wider text-amber-500">Skipped</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function MilestoneFormPane({ milestone, tracking, onUpdate, onStatusLog, currentUserName, milestoneNumber }) {
  const ms = milestone
  return (
    <div>
      <div className="flex items-baseline gap-4 mb-5 pb-3 border-b-2 border-[#ed148c]/20">
        <span className="text-4xl font-heading font-black text-[#ed148c]/60 leading-none tabular-nums">
          {String(milestoneNumber || 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-heading font-black text-[#283693] tracking-tight leading-tight">{ms.label}</h3>
          <p className="text-[11px] text-stone-400 mt-0.5 uppercase tracking-wider font-semibold">
            {ms.completedCount} of {ms.totalCount} complete
          </p>
        </div>
      </div>
      {ms.steps.length === 0 ? (
        <p className="text-sm text-stone-400">No steps in this milestone.</p>
      ) : (
        <div className="space-y-2">
          {ms.steps.map(step => (
            <StepFormRow
              key={step.id}
              step={step}
              entry={tracking?.[step.id] || {}}
              onUpdate={onUpdate}
              onStatusLog={onStatusLog}
              currentUserName={currentUserName}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StepFormRow({ step, entry, onUpdate, onStatusLog, currentUserName }) {
  const status = entry.status || 'not_started'
  const isComplete = status === 'complete'
  const isSkipped = status === 'skipped'
  const isNa = status === 'na'
  const done = isComplete || isSkipped || isNa
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(entry.note || '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const log = Array.isArray(entry.log) ? entry.log : []
  const lastLog = log[log.length - 1]

  function setStatus(newStatus, extra = {}) {
    // For custom dropdowns, two different options can map to the same
    // underlying status (e.g., "1st Attempt" and "2nd Attempt" both
    // map to in_progress). Only treat as a no-op when BOTH the status
    // AND the option label are unchanged.
    const newOptionLabel = extra.optionLabel
    if (newStatus === status && (newOptionLabel === undefined || newOptionLabel === entry.optionLabel)) return
    const updates = { status: newStatus, ...extra }
    if (newStatus === 'complete' && !entry.completed_at) {
      updates.completed_at = new Date().toISOString()
      updates.completed_by = currentUserName
    }
    if (newStatus === 'skipped') {
      updates.skipped_at = new Date().toISOString()
      updates.skipped_by = currentUserName
    }
    const newLog = [...log, {
      status: newStatus,
      optionLabel: newOptionLabel || undefined,
      from: status,
      fromOptionLabel: entry.optionLabel || undefined,
      changed_at: new Date().toISOString(),
      changed_by: currentUserName,
    }]
    updates.log = newLog
    onUpdate(step.id, updates)
    if (newStatus === 'complete' && onStatusLog) {
      onStatusLog({ stepLabel: step.label, status: newStatus, optionLabel: newOptionLabel, date: new Date().toISOString().split('T')[0] })
    }
  }

  function saveNote() {
    onUpdate(step.id, { note: noteDraft })
    setNoteOpen(false)
  }

  const cardBg = isSkipped ? 'bg-amber-50/40 border-amber-100'
    : isComplete ? 'bg-emerald-50/30 border-emerald-100'
    : isNa ? 'bg-stone-50/60 border-stone-100'
    : 'bg-white border-stone-200'

  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors ${cardBg}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => setStatus(isComplete ? 'not_started' : 'complete')}
          className={`mt-1 size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
            isComplete ? 'bg-emerald-500 border-emerald-500 text-white' :
            isSkipped ? 'bg-amber-100 border-amber-400 text-amber-600' :
            isNa ? 'bg-stone-200 border-stone-300 text-stone-500' :
            'bg-white border-stone-300 hover:border-[#283693]'
          }`}
          title={isComplete ? 'Mark not started' : 'Mark complete'}
        >
          {isComplete && <Check className="size-3" strokeWidth={3} />}
          {isSkipped && <X className="size-2.5" strokeWidth={3} />}
          {isNa && <Circle className="size-1.5 fill-current" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className={`text-[13px] font-semibold ${done ? 'text-stone-500' : 'text-stone-800'} leading-snug`}>{step.label}</p>
            {isSkipped && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Skipped{entry.skipped_by ? ` · ${entry.skipped_by}` : ''}</span>
            )}
            {isNa && <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Not needed</span>}
            {isComplete && entry.completed_by && (
              <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">Complete · {entry.completed_by}</span>
            )}
          </div>

          {/* Status pills. If the step is configured with a custom dropdown
              in /settings, render ONLY the admin-defined options — the
              global default statuses are intentionally hidden so the
              configured workflow is the only path. */}
          {step.logType === 'dropdown' && Array.isArray(step.options) && step.options.length > 0 ? (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {normalizeOptions(step.options).map((opt, i) => {
                const active = entry.optionLabel === opt.label
                const activeClass = PILL_ACTIVE_BY_STATUS[opt.mapsTo] || PILL_ACTIVE_BY_STATUS.in_progress
                return (
                  <button
                    key={`${opt.label}-${i}`}
                    onClick={() => setStatus(opt.mapsTo, { optionLabel: opt.label })}
                    className={`text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? `${activeClass} font-semibold`
                        : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {CHECKLIST_STEP_STATUSES.filter(s => !['note'].includes(s.id)).map(s => {
                const active = status === s.id
                const isWarning = s.id === 'skipped'
                const isDone = s.id === 'complete'
                return (
                  <button
                    key={s.id}
                    onClick={() => setStatus(s.id)}
                    className={`text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? isWarning ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                          : isDone ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                          : 'bg-[#283693] border-[#283693] text-white font-semibold'
                        : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          )}

          {lastLog && (
            <div className="mt-1.5 flex items-center gap-2">
              <p className="text-[10px] text-stone-400">
                Last update: {lastLog.changed_by || 'Unknown'} · {formatRelativeTime(lastLog.changed_at)}
              </p>
              {log.length > 1 && (
                <button onClick={() => setHistoryOpen(!historyOpen)} className="text-[10px] text-[#283693] hover:underline">
                  {historyOpen ? 'Hide history' : `View history (${log.length})`}
                </button>
              )}
            </div>
          )}
          {historyOpen && log.length > 0 && (
            <ul className="mt-1.5 ml-3 space-y-0.5 border-l-2 border-stone-200 pl-3">
              {[...log].reverse().map((l, i) => (
                <li key={i} className="text-[10px] text-stone-500">
                  <span className="font-semibold text-stone-700">{l.optionLabel || l.status?.replace(/_/g, ' ')}</span>
                  {(l.fromOptionLabel || l.from) && (
                    <span className="text-stone-400"> ← {l.fromOptionLabel || l.from?.replace(/_/g, ' ')}</span>
                  )}
                  <span className="ml-1.5 text-stone-400">{l.changed_by || 'Unknown'} · {new Date(l.changed_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}

          {noteOpen ? (
            <div className="mt-2 space-y-1.5">
              <Textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} className="text-sm" placeholder="Internal note (visible to admin only)..." />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setNoteOpen(false); setNoteDraft(entry.note || '') }} className="text-xs text-stone-500 hover:text-stone-700">Cancel</button>
                <button onClick={saveNote} className="text-xs text-white bg-[#283693] px-3 py-1 rounded-full">Save note</button>
              </div>
            </div>
          ) : entry.note ? (
            <button onClick={() => { setNoteOpen(true); setNoteDraft(entry.note) }} className="mt-1.5 block text-[11px] text-stone-500 italic hover:text-stone-700 text-left">
              "{entry.note}"
            </button>
          ) : (
            <button onClick={() => { setNoteOpen(true); setNoteDraft('') }} className="mt-1.5 text-[10px] text-stone-400 hover:text-[#283693]">+ Add note</button>
          )}
        </div>
      </div>
    </div>
  )
}
