import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Check, X, Clock, EyeOff, Eye, Plus, Pencil, Trash2, ChevronDown, CheckCircle2, CornerDownRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { deriveParentStatus, normalizeOptions } from '@/lib/checklistStore'

/**
 * Card-based checklist UI for the journey overview. Groups steps under
 * stage-header pills (from `milestones`) and renders each as its own
 * profile-style card with inline edit/log/subtask actions.
 *
 * Backwards-compatible with existing `journey_data._checklistTracking`
 * shape — does not migrate or drop any historical log entries.
 */
export default function JourneyChecklistCards({ steps, milestones = [], statuses, tracking, onUpdate, currentUserName, title = 'Journey Checklist' }) {
  // Pull in case-specific subtasks (created from the journey, not the global template)
  const caseSubtasks = useMemo(() => {
    const subs = []
    for (const [key, val] of Object.entries(tracking || {})) {
      if (val?._isCaseSubtask && !val?._deleted) {
        subs.push({ id: key, label: val._label || key, parentId: val._parentId, _isCaseSubtask: true })
      }
    }
    return subs
  }, [tracking])

  const allSteps = useMemo(() => [...steps, ...caseSubtasks], [steps, caseSubtasks])

  // Build parent → children map and a "stage" lookup for grouping
  const childrenByParent = useMemo(() => {
    const map = {}
    for (const s of allSteps) {
      if (s.parentId) {
        if (!map[s.parentId]) map[s.parentId] = []
        map[s.parentId].push(s)
      }
    }
    return map
  }, [allSteps])

  const topLevel = useMemo(() => allSteps.filter(s => !s.parentId), [allSteps])

  // Decide which milestone (= stage header) a top-level step belongs to.
  // Steps not referenced by any milestone fall into an "Other" bucket so
  // nothing disappears.
  const stageOfStep = useMemo(() => {
    const map = {}
    for (const ms of milestones) {
      for (const sid of (ms.stepIds || [])) map[sid] = ms.id
    }
    return map
  }, [milestones])

  const groupedStages = useMemo(() => {
    const groups = []
    const seenIds = new Set()
    for (const ms of milestones) {
      const stepsInStage = topLevel.filter(s => stageOfStep[s.id] === ms.id)
      if (stepsInStage.length === 0) continue
      groups.push({ id: ms.id, label: ms.label, steps: stepsInStage })
      for (const s of stepsInStage) seenIds.add(s.id)
    }
    const orphans = topLevel.filter(s => !seenIds.has(s.id))
    if (orphans.length > 0) {
      groups.push({ id: '_other', label: 'Other', steps: orphans })
    }
    return groups
  }, [milestones, topLevel, stageOfStep])

  // Total progress (top-level only, skipping N/A)
  const progress = useMemo(() => {
    const active = topLevel.filter(s => {
      const kids = childrenByParent[s.id] || []
      const st = kids.length > 0 ? deriveParentStatus(kids, tracking) : tracking[s.id]?.status
      return st !== 'na'
    })
    const done = active.filter(s => {
      const kids = childrenByParent[s.id] || []
      const st = kids.length > 0 ? deriveParentStatus(kids, tracking) : tracking[s.id]?.status
      return st === 'complete' || st === 'partial_complete'
    })
    return { done: done.length, total: active.length }
  }, [topLevel, childrenByParent, tracking])

  // Cascade parent status from subtask updates (matches TrackingTable behavior
  // so milestone progress on the matched-journey card stays in sync).
  function updateStep(stepId, data) {
    onUpdate(stepId, data)
    const step = allSteps.find(s => s.id === stepId)
    if (!step?.parentId) return
    const parent = allSteps.find(s => s.id === step.parentId)
    if (!parent) return
    const siblings = allSteps.filter(s => s.parentId === parent.id)
    const projected = { ...tracking, [stepId]: { ...(tracking[stepId] || {}), ...data } }
    const newParentStatus = deriveParentStatus(siblings, projected)
    if (!newParentStatus || newParentStatus === tracking[parent.id]?.status) return
    const parentData = tracking[parent.id] || { history: [] }
    const entry = {
      status: newParentStatus,
      date: new Date().toISOString().split('T')[0],
      note: 'Auto from subtasks',
      by: 'System',
      auto: true,
    }
    onUpdate(parent.id, { status: newParentStatus, history: [...(parentData.history || []), entry] })
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Card className="rounded-2xl border-stone-100 overflow-hidden">
      {/* Header with progress */}
      <div className="px-5 pt-5 pb-4 bg-gradient-to-r from-[#283693]/[0.04] to-[#ed148c]/[0.04] border-b border-stone-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-stone-800">{title}</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-stone-400">{pct}%</span>
            <span className="font-bold text-[#283693]">{progress.done}<span className="text-stone-300 font-normal">/{progress.total}</span></span>
          </div>
        </div>
        <div className="h-1.5 bg-white rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #283693, #ed148c)' }} />
        </div>
      </div>

      {/* Stages */}
      <div className="p-5 space-y-6">
        {groupedStages.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-8">No checklist steps configured for this stage.</p>
        )}
        {groupedStages.map(stage => (
          <StageBlock
            key={stage.id}
            stage={stage}
            tracking={tracking}
            childrenByParent={childrenByParent}
            allSteps={allSteps}
            statuses={statuses}
            onUpdate={updateStep}
            currentUserName={currentUserName}
            rawOnUpdate={onUpdate}
          />
        ))}
      </div>
    </Card>
  )
}

function StageBlock({ stage, tracking, childrenByParent, allSteps, statuses, onUpdate, currentUserName, rawOnUpdate }) {
  const [collapsed, setCollapsed] = useState(false)
  const stageDone = stage.steps.filter(s => {
    const kids = childrenByParent[s.id] || []
    const st = kids.length > 0 ? deriveParentStatus(kids, tracking) : tracking[s.id]?.status
    return st === 'complete' || st === 'partial_complete' || st === 'na'
  }).length
  const stageTotal = stage.steps.length

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 mb-3 group"
      >
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#283693] to-[#ed148c] text-white text-xs font-bold uppercase tracking-wide shadow-sm">
          {stage.label}
        </span>
        <span className="text-xs font-semibold text-stone-400">{stageDone}/{stageTotal}</span>
        <div className="flex-1 h-px bg-stone-200 ml-1" />
        <ChevronDown className={`size-4 text-stone-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {stage.steps.map(step => (
            <TaskCard
              key={step.id}
              step={step}
              isSubtask={false}
              children={childrenByParent[step.id] || []}
              tracking={tracking}
              statuses={statuses}
              onUpdate={onUpdate}
              rawOnUpdate={rawOnUpdate}
              currentUserName={currentUserName}
              allSteps={allSteps}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ step, isSubtask, children = [], tracking, statuses, onUpdate, rawOnUpdate, currentUserName }) {
  const data = tracking[step.id] || {}
  const history = data.history || []
  const lastEntry = history.length > 0 ? history[history.length - 1] : null
  const hasChildren = !isSubtask && children.length > 0
  const storedStatus = data.status || 'not_started'
  const currentStatus = hasChildren ? (deriveParentStatus(children, tracking) || 'not_started') : storedStatus
  const isComplete = currentStatus === 'complete' || currentStatus === 'partial_complete'
  const isInProgress = currentStatus === 'in_progress' || currentStatus === 'started' || currentStatus === 'requested' || currentStatus === 'reviewing'
  const isDeactivated = currentStatus === 'na' || currentStatus === 'deactivated'

  const [expanded, setExpanded] = useState(false)
  const [editingHistoryIdx, setEditingHistoryIdx] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskLabel, setNewSubtaskLabel] = useState('')
  // Inline log form
  const [logDate, setLogDate] = useState('')
  const [logNote, setLogNote] = useState('')

  function applyStatus(newStatus, opts = {}) {
    const today = new Date().toISOString().split('T')[0]
    const date = opts.date || logDate || today
    const note = (opts.note ?? logNote) || null
    const entry = {
      status: newStatus,
      date,
      note: note?.trim() || null,
      by: currentUserName || 'Admin',
    }
    onUpdate(step.id, {
      status: newStatus,
      history: [...history, entry],
    })
    setLogNote('')
    setLogDate('')
    setExpanded(false)
  }

  function deactivate() {
    onUpdate(step.id, { status: 'na' })
    setExpanded(false)
  }

  function reactivate() {
    const lastReal = [...history].reverse().find(h => h.status !== 'na')
    onUpdate(step.id, { status: lastReal?.status || 'not_started' })
  }

  function addSubtask() {
    if (!newSubtaskLabel.trim()) return
    const id = 'csub_' + Date.now()
    rawOnUpdate(id, {
      status: 'not_started',
      history: [],
      _isCaseSubtask: true,
      _parentId: step.id,
      _label: newSubtaskLabel.trim(),
    })
    setNewSubtaskLabel('')
    setAddingSubtask(false)
  }

  function deleteSubtask(subId) {
    rawOnUpdate(subId, { ...(tracking[subId] || {}), _deleted: true })
  }

  function saveHistoryEdit(idx) {
    const newHistory = [...history]
    newHistory[idx] = {
      ...newHistory[idx],
      status: editStatus,
      date: editDate || newHistory[idx].date,
      note: editNote.trim() || null,
    }
    const newStatus = newHistory[newHistory.length - 1].status
    onUpdate(step.id, { status: newStatus, history: newHistory })
    setEditingHistoryIdx(null)
  }

  function deleteHistoryEntry(idx) {
    const newHistory = [...history]
    newHistory.splice(idx, 1)
    const newStatus = newHistory.length > 0 ? newHistory[newHistory.length - 1].status : 'not_started'
    onUpdate(step.id, { status: newStatus, history: newHistory })
  }

  // Status pill colors — matches the rest of the app
  const statusPill = (() => {
    if (isComplete) return { label: 'Complete', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    if (isInProgress) return { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    if (isDeactivated) return { label: 'Not Needed', cls: 'bg-stone-100 text-stone-500 border-stone-200' }
    if (currentStatus !== 'not_started') {
      const lbl = data.optionLabel || lastEntry?.optionLabel || (statuses?.find(s => s.id === currentStatus)?.label) || currentStatus
      return { label: lbl, cls: 'bg-violet-100 text-violet-700 border-violet-200' }
    }
    return { label: 'Not Started', cls: 'bg-stone-50 text-stone-400 border-stone-200' }
  })()

  // Card visual state
  const cardClass = isDeactivated
    ? 'border-stone-100 bg-stone-50/40 opacity-60'
    : isComplete
      ? 'border-emerald-200 bg-emerald-50/40'
      : isInProgress
        ? 'border-blue-200 bg-blue-50/30'
        : 'border-stone-200 bg-white hover:border-[#283693]/30'

  return (
    <>
      <div className={`rounded-xl border ${cardClass} transition-colors ${isSubtask ? 'ml-6' : ''}`}>
        {/* Row header */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-left px-4 py-3 flex items-center gap-3"
        >
          {isSubtask && <CornerDownRight className="size-3 text-stone-300 shrink-0 -ml-1" />}

          {/* Status circle — visual only on this card style; the real toggle is in the expanded actions */}
          {isDeactivated ? (
            <div className="size-6 rounded-full bg-stone-200 shrink-0 flex items-center justify-center"><X className="size-3.5 text-stone-400" /></div>
          ) : isComplete ? (
            <div className="size-6 rounded-full bg-emerald-500 shrink-0 flex items-center justify-center shadow-sm"><Check className="size-3.5 text-white" /></div>
          ) : isInProgress ? (
            <div className="size-6 rounded-full border-2 border-blue-400 shrink-0 flex items-center justify-center"><div className="size-2 rounded-full bg-blue-400" /></div>
          ) : (
            <div className="size-6 rounded-full border-2 border-stone-200 shrink-0" />
          )}

          {/* Label + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${isSubtask ? 'text-sm' : 'text-[15px]'} font-semibold ${isDeactivated ? 'line-through text-stone-400' : isComplete ? 'text-stone-600' : 'text-stone-800'}`}>
                {data.customLabel || step.label}
              </span>
              {hasChildren && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-stone-200 text-stone-500">
                  {children.filter(c => {
                    const st = tracking[c.id]?.status
                    return st === 'complete' || st === 'partial_complete'
                  }).length}/{children.length}
                </span>
              )}
            </div>
            {/* Last log meta — date + author only when present and row is collapsed */}
            {!expanded && lastEntry && (
              <div className="text-[11px] text-stone-400 mt-0.5">
                {lastEntry.date && <span>{formatDate(lastEntry.date)}</span>}
                {lastEntry.by && <span> · {lastEntry.by}</span>}
                {lastEntry.note && <span className="text-stone-500"> · "{lastEntry.note.length > 50 ? lastEntry.note.slice(0, 50) + '…' : lastEntry.note}"</span>}
              </div>
            )}
          </div>

          {/* Right: status pill + chevron */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusPill.cls}`}>{statusPill.label}</span>
            <ChevronDown className={`size-4 text-stone-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Expanded inline editor */}
        {expanded && !hasChildren && (
          <div className="border-t border-stone-100 bg-white/50 px-4 py-3 space-y-3" onClick={e => e.stopPropagation()}>
            {/* Status quick-pick */}
            <div className="flex flex-wrap gap-2">
              <PickPill
                active={isComplete}
                onClick={() => applyStatus('complete')}
                cls="bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
                inactive="text-emerald-700 bg-white hover:bg-emerald-50 border-emerald-200"
              >
                <Check className="size-3.5" /> Complete
              </PickPill>
              <PickPill
                active={isInProgress}
                onClick={() => applyStatus('in_progress')}
                cls="bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                inactive="text-blue-700 bg-white hover:bg-blue-50 border-blue-200"
              >
                <Clock className="size-3.5" /> In Progress
              </PickPill>
              <PickPill
                active={isDeactivated}
                onClick={isDeactivated ? reactivate : deactivate}
                cls="bg-stone-400 hover:bg-stone-500 text-white border-stone-400"
                inactive="text-stone-600 bg-white hover:bg-stone-100 border-stone-200"
              >
                {isDeactivated ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {isDeactivated ? 'Reactivate' : 'Not Needed'}
              </PickPill>
            </div>

            {/* Custom dropdown options if step has them */}
            {step.logType === 'dropdown' && step.options?.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Options</label>
                <div className="flex flex-wrap gap-1.5">
                  {normalizeOptions(step.options).map(opt => (
                    <button key={opt.label}
                      onClick={() => {
                        const mapsTo = opt.mapsTo || 'in_progress'
                        const today = new Date().toISOString().split('T')[0]
                        const entry = { status: mapsTo, optionLabel: opt.label, date: logDate || today, note: logNote.trim() || null, by: currentUserName || 'Admin' }
                        onUpdate(step.id, { status: mapsTo, optionLabel: opt.label, history: [...history, entry] })
                        setLogNote(''); setLogDate(''); setExpanded(false)
                      }}
                      className="text-[11px] font-medium px-2 py-1 rounded-full border border-stone-200 bg-white hover:bg-violet-50 hover:border-violet-300 text-stone-600 hover:text-violet-700">
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date + Note row */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Date</label>
                <Input type="date" value={logDate || new Date().toISOString().split('T')[0]} onChange={e => setLogDate(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Note (optional)</label>
                <Input value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="Add details about this update…" className="h-9 text-xs" />
              </div>
            </div>

            {/* Footer: history toggle + close */}
            <div className="flex items-center justify-between text-[11px]">
              <button onClick={() => setShowHistory(s => !s)} className="text-stone-500 hover:text-[#283693] inline-flex items-center gap-1">
                <Clock className="size-3" />
                {showHistory ? 'Hide' : `History (${history.length})`}
              </button>
              <button onClick={() => setExpanded(false)} className="text-stone-400 hover:text-stone-600">Close</button>
            </div>

            {/* History */}
            {showHistory && history.length > 0 && (
              <div className="border-t border-stone-100 pt-2 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">History (oldest → newest)</p>
                {history.map((h, i) => {
                  const isEditing = editingHistoryIdx === i
                  if (isEditing) {
                    return (
                      <div key={i} className="rounded-lg border border-[#283693]/30 bg-[#283693]/5 p-2 space-y-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="h-8 rounded-md border border-stone-200 px-2 text-xs bg-white">
                            {statuses?.filter(s => s.id !== 'not_started').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                          <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <Input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note…" className="h-8 text-xs" />
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setEditingHistoryIdx(null)} className="text-[10px] text-stone-400 hover:text-stone-600 px-2 py-1">Cancel</button>
                          <button onClick={() => saveHistoryEdit(i)} className="text-[10px] font-semibold text-white bg-[#283693] px-2 py-1 rounded">Save</button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded hover:bg-stone-50 group/h">
                      <span className="font-medium text-stone-600">{h.optionLabel || (statuses?.find(s => s.id === h.status)?.label) || h.status}</span>
                      <span className="text-stone-400">{formatDate(h.date)}</span>
                      {h.note && <span className="text-stone-500 truncate flex-1">"{h.note}"</span>}
                      <span className="text-stone-300 ml-auto">{h.by}</span>
                      <span className="opacity-0 group-hover/h:opacity-100 flex gap-0.5">
                        <button onClick={() => { setEditingHistoryIdx(i); setEditStatus(h.status); setEditDate(h.date || ''); setEditNote(h.note || '') }} className="p-0.5 text-stone-400 hover:text-[#283693]"><Pencil className="size-3" /></button>
                        <button onClick={() => deleteHistoryEntry(i)} className="p-0.5 text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Subtasks (rendered as nested cards) */}
        {hasChildren && (
          <div className="border-t border-stone-100 px-4 py-3 space-y-2">
            {children.map(child => (
              <TaskCard
                key={child.id}
                step={child}
                isSubtask={true}
                tracking={tracking}
                statuses={statuses}
                onUpdate={onUpdate}
                rawOnUpdate={rawOnUpdate}
                currentUserName={currentUserName}
              >{[]}</TaskCard>
            ))}
            {addingSubtask ? (
              <div className="flex items-center gap-2 ml-6">
                <CornerDownRight className="size-3 text-stone-300 shrink-0" />
                <Input
                  autoFocus
                  value={newSubtaskLabel}
                  onChange={e => setNewSubtaskLabel(e.target.value)}
                  placeholder="Subtask name…"
                  onKeyDown={e => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskLabel('') } }}
                  className="h-8 text-xs flex-1"
                />
                <button onClick={addSubtask} disabled={!newSubtaskLabel.trim()} className="text-[11px] font-semibold text-white bg-[#283693] px-2.5 py-1 rounded disabled:opacity-30">Add</button>
                <button onClick={() => { setAddingSubtask(false); setNewSubtaskLabel('') }} className="text-[11px] text-stone-400 hover:text-stone-600">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddingSubtask(true)} className="ml-6 inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-[#283693]">
                <Plus className="size-3" /> Add subtask
              </button>
            )}
          </div>
        )}

        {/* Add subtask button for non-parent rows that don't yet have children */}
        {!hasChildren && !isSubtask && expanded && (
          <div className="border-t border-stone-100 px-4 py-2">
            {addingSubtask ? (
              <div className="flex items-center gap-2 ml-6">
                <CornerDownRight className="size-3 text-stone-300 shrink-0" />
                <Input
                  autoFocus
                  value={newSubtaskLabel}
                  onChange={e => setNewSubtaskLabel(e.target.value)}
                  placeholder="Subtask name…"
                  onKeyDown={e => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskLabel('') } }}
                  className="h-8 text-xs flex-1"
                />
                <button onClick={addSubtask} disabled={!newSubtaskLabel.trim()} className="text-[11px] font-semibold text-white bg-[#283693] px-2.5 py-1 rounded disabled:opacity-30">Add</button>
                <button onClick={() => { setAddingSubtask(false); setNewSubtaskLabel('') }} className="text-[11px] text-stone-400 hover:text-stone-600">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddingSubtask(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-[#283693]">
                <Plus className="size-3" /> Add subtask
              </button>
            )}
          </div>
        )}

        {/* Delete subtask (case-specific) */}
        {isSubtask && step._isCaseSubtask && expanded && (
          <div className="border-t border-stone-100 px-4 py-2">
            <button onClick={() => deleteSubtask(step.id)} className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-400 hover:text-red-500">
              <Trash2 className="size-3" /> Remove subtask
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function PickPill({ active, onClick, cls, inactive, children }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${active ? cls : inactive}`}>
      {children}
    </button>
  )
}
