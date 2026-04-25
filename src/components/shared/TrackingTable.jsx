import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Check, X, ChevronDown, CheckCircle2, Clock, CornerDownRight, Plus, Trash2, Circle, Pencil, Calendar, MessageSquare, User, EyeOff, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { normalizeOptions, deriveParentStatus } from '@/lib/checklistStore'

export default function TrackingTable({ steps, statuses, tracking, onUpdate, title, currentUserName, onStatusLog }) {
  const [addingLogFor, setAddingLogFor] = useState(null)
  const [logStatus, setLogStatus] = useState('')
  const [logNote, setLogNote] = useState('')
  const [expandedStep, setExpandedStep] = useState(null)
  const [editingLog, setEditingLog] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editingLabel, setEditingLabel] = useState(null)
  const [labelValue, setLabelValue] = useState('')
  const [editDate, setEditDate] = useState('')
  const [logDate, setLogDate] = useState('')
  const [addingCaseSubtask, setAddingCaseSubtask] = useState(null) // parentId currently adding to
  const [caseSubtaskLabel, setCaseSubtaskLabel] = useState('')
  // Parents with subtasks are collapsible. Track which are explicitly toggled
  // by the user; default = collapsed when fully complete, expanded otherwise.
  const [collapsedParents, setCollapsedParents] = useState({})

  // Extract case-specific subtasks embedded in tracking data. These are
  // per-case subtasks added from the case page (not the global template).
  const caseSubtasks = useMemo(() => {
    const subs = []
    for (const [key, val] of Object.entries(tracking || {})) {
      if (val?._isCaseSubtask && !val?._deleted) {
        subs.push({ id: key, label: val._label || key, parentId: val._parentId, _isCaseSubtask: true })
      }
    }
    return subs
  }, [tracking])

  // Merge global template steps + case-specific subtasks
  const allSteps = useMemo(() => [...steps, ...caseSubtasks], [steps, caseSubtasks])

  // Build a flat render list that interleaves parents with their subtasks.
  // Each item carries _depth (0 = top-level, 1 = subtask) and parents carry
  // _children so the row can derive status from them.
  const renderableSteps = useMemo(() => {
    const childrenByParent = {}
    for (const s of allSteps) {
      if (s.parentId) {
        if (!childrenByParent[s.parentId]) childrenByParent[s.parentId] = []
        childrenByParent[s.parentId].push(s)
      }
    }
    const result = []
    const seen = new Set()
    for (const s of allSteps) {
      if (s.parentId) continue // children rendered under their parent
      if (seen.has(s.id)) continue
      seen.add(s.id)
      const children = childrenByParent[s.id] || []
      result.push({ ...s, _depth: 0, _children: children })
      for (const child of children) {
        seen.add(child.id)
        result.push({ ...child, _depth: 1 })
      }
    }
    // Sweep up any orphan subtasks (parent missing) so they still render
    for (const s of allSteps) {
      if (!seen.has(s.id)) {
        result.push({ ...s, _depth: 0, _children: [] })
        seen.add(s.id)
      }
    }
    return result
  }, [allSteps])

  // Progress count: only top-level steps count toward the bar.
  const topLevelSteps = allSteps.filter(s => !s.parentId)
  const activeSteps = topLevelSteps.filter(s => {
    const children = allSteps.filter(c => c.parentId === s.id)
    if (children.length > 0) {
      const derived = deriveParentStatus(children, tracking)
      return derived !== 'na'
    }
    return tracking[s.id]?.status !== 'na'
  })
  const completeCount = activeSteps.filter(s => {
    const children = allSteps.filter(c => c.parentId === s.id)
    if (children.length > 0) {
      return deriveParentStatus(children, tracking) === 'complete'
    }
    return tracking[s.id]?.status === 'complete'
  }).length
  const totalActive = activeSteps.length

  // Wrap onUpdate so logging on a subtask cascades a derived status update
  // to the parent. Without this, the progress bar / parent display would
  // stay stale until the next render path recomputed it.
  function updateStep(stepId, data) {
    onUpdate(stepId, data)
    const step = allSteps.find(s => s.id === stepId)
    if (!step?.parentId) return
    const parent = allSteps.find(s => s.id === step.parentId)
    if (!parent) return
    const siblings = allSteps.filter(s => s.parentId === parent.id)
    // Build the projected tracking with this update applied
    const projected = { ...tracking, [stepId]: { ...(tracking[stepId] || {}), ...data } }
    const newParentStatus = deriveParentStatus(siblings, projected)
    if (!newParentStatus) return
    const currentParentStatus = tracking[parent.id]?.status
    if (newParentStatus === currentParentStatus) return
    const parentData = tracking[parent.id] || { history: [] }
    const entry = {
      status: newParentStatus,
      date: new Date().toISOString().split('T')[0],
      note: 'Auto from subtasks',
      by: 'System',
      auto: true,
    }
    onUpdate(parent.id, {
      status: newParentStatus,
      history: [...(parentData.history || []), entry],
    })
  }

  function addCaseSubtask(parentId) {
    if (!caseSubtaskLabel.trim()) return
    const id = 'csub_' + Date.now()
    onUpdate(id, {
      status: 'not_started',
      history: [],
      _isCaseSubtask: true,
      _parentId: parentId,
      _label: caseSubtaskLabel.trim(),
    })
    setCaseSubtaskLabel('')
    setAddingCaseSubtask(null)
  }

  function deleteCaseSubtask(subtaskId) {
    onUpdate(subtaskId, { ...(tracking[subtaskId] || {}), _deleted: true })
  }

  function submitLog(stepId, overrideStatus) {
    // overrideStatus bypasses the stale closure from setTimeout — used
    // by the Complete/Deactivate/NA buttons that need to set a specific
    // status without waiting for React state to update.
    const effectiveLogStatus = overrideStatus || logStatus
    if (!effectiveLogStatus) return
    const step = allSteps.find(s => s.id === stepId)
    const current = tracking[stepId] || { history: [] }
    const history = current.history || []

    // For custom dropdown options, map the picked option label to its
    // underlying status (so colors + completion logic still work) but
    // remember the original label for display.
    let entryStatus = effectiveLogStatus
    let entryOptionLabel = null
    let textValue = null
    if (step?.logType === 'dropdown' && step.options?.length > 0) {
      const opts = normalizeOptions(step.options)
      const picked = opts.find(o => o.label === effectiveLogStatus)
      if (picked) {
        entryStatus = picked.mapsTo || 'in_progress'
        entryOptionLabel = picked.label
      }
    } else if (step?.logType === 'text') {
      // For text fields: the typed value is effectiveLogStatus, but we
      // need a proper status for lifecycle tracking. If the value is
      // 'complete' or 'na' it's a system status; otherwise it's the
      // user's text and the underlying status is 'in_progress'.
      if (effectiveLogStatus !== 'complete' && effectiveLogStatus !== 'na') {
        textValue = effectiveLogStatus
        entryStatus = 'in_progress'
      } else {
        entryStatus = effectiveLogStatus
        // Complete/NA — preserve text: use what's in the input field
        // (logStatus) if it's real text, otherwise fall back to stored value
        const inputText = logStatus && logStatus !== 'complete' && logStatus !== 'na' ? logStatus : null
        textValue = inputText || current._textValue || null
      }
    }

    const entry = {
      status: entryStatus,
      date: logDate || new Date().toISOString().split('T')[0],
      note: logNote.trim() || null,
      by: currentUserName || 'Admin',
      ...(entryOptionLabel ? { optionLabel: entryOptionLabel } : {}),
      ...(textValue ? { textValue } : {}),
    }
    updateStep(stepId, {
      status: entryStatus,
      ...(entryOptionLabel ? { optionLabel: entryOptionLabel } : { optionLabel: null }),
      ...(textValue !== null ? { _textValue: textValue } : {}),
      history: [...history, entry],
    })
    console.log('[TrackingTable] submitLog:', { stepId, status: entryStatus, optionLabel: entryOptionLabel, textValue, hasOnStatusLog: !!onStatusLog })
    if (onStatusLog) onStatusLog({ stepId, stepLabel: step?.label || stepId, status: entryStatus, optionLabel: entryOptionLabel, by: currentUserName, date: logDate || new Date().toISOString().split('T')[0] })
    setLogStatus('')
    setLogNote('')
    setAddingLogFor(null)
  }

  function deleteLog(stepId, index) {
    const current = tracking[stepId] || { history: [] }
    const history = [...(current.history || [])]
    history.splice(index, 1)
    const newStatus = history.length > 0 ? history[history.length - 1].status : 'not_started'
    updateStep(stepId, { status: newStatus, history })
  }

  function saveEditLog(stepId, index) {
    const current = tracking[stepId] || { history: [] }
    const history = [...(current.history || [])]
    history[index] = { ...history[index], status: editStatus, note: editNote.trim() || null, date: editDate || history[index].date }
    const newStatus = history[history.length - 1].status
    updateStep(stepId, { status: newStatus, history })
    setEditingLog(null)
  }

  function openAddLog(stepId) {
    setAddingLogFor(stepId)
    setExpandedStep(stepId)
    // For text steps, pre-fill with existing text value so user can edit it
    const step = allSteps.find(s => s.id === stepId)
    const data = tracking[stepId] || {}
    if (step?.logType === 'text' && data._textValue) {
      setLogStatus(data._textValue)
    } else {
      setLogStatus('')
    }
    setLogNote('')
    setLogDate(new Date().toISOString().split('T')[0])
    setEditingLog(null)
  }

  // One-click "Mark Complete" — appends a complete entry with today's date and
  // no note. The "+ Log" button is for when the admin wants a date/note.
  function quickComplete(stepId) {
    const current = tracking[stepId] || { history: [] }
    const today = new Date().toISOString().split('T')[0]
    const entry = { status: 'complete', date: today, note: null, by: currentUserName || 'Admin' }
    updateStep(stepId, {
      status: 'complete',
      history: [...(current.history || []), entry],
    })
    const step = allSteps.find(s => s.id === stepId)
    if (onStatusLog) onStatusLog({ stepId, stepLabel: step?.label || stepId, status: 'complete', by: currentUserName, date: today })
  }

  // Re-open a completed step — appends an in_progress entry so history still
  // shows the completion happened, but the step is no longer green.
  function reopen(stepId) {
    const current = tracking[stepId] || { history: [] }
    const today = new Date().toISOString().split('T')[0]
    const entry = { status: 'in_progress', date: today, note: 'Re-opened', by: currentUserName || 'Admin' }
    updateStep(stepId, {
      status: 'in_progress',
      history: [...(current.history || []), entry],
    })
  }

  // Default collapse state for a parent: collapsed when every child is
  // complete or N/A, expanded otherwise. User toggle overrides.
  function isParentCollapsed(parentId, children) {
    if (collapsedParents[parentId] !== undefined) return collapsedParents[parentId]
    if (!children?.length) return false
    return children.every(c => {
      const st = tracking[c.id]?.status
      return st === 'complete' || st === 'partial_complete' || st === 'na'
    })
  }
  function toggleCollapse(parentId, children) {
    const cur = isParentCollapsed(parentId, children)
    setCollapsedParents(prev => ({ ...prev, [parentId]: !cur }))
  }

  function getStatusLabel(statusId) {
    if (statusId === 'followed_up') return 'Followed Up'
    return statuses.find(s => s.id === statusId)?.label || statusId
  }

  function statusColor(statusId) {
    if (statusId === 'complete' || statusId === 'partial_complete') return 'text-green-600 bg-green-50 border-green-200'
    if (statusId === 'na') return 'text-stone-400 bg-stone-100 border-stone-300 italic'
    if (statusId === 'not_started') return 'text-stone-400 bg-stone-50 border-stone-200'
    if (statusId === 'records_received' || statusId === 'partial_received') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    if (statusId === 'followed_up') return 'text-sky-600 bg-sky-50 border-sky-200'
    if (statusId === 'faxed_request' || statusId === 'refaxed_request' || statusId === 'requested') return 'text-amber-600 bg-amber-50 border-amber-200'
    if (statusId === 'confirmed_fax_received' || statusId === 'records_sent_mail') return 'text-indigo-600 bg-indigo-50 border-indigo-200'
    if (statusId === 'started') return 'text-cyan-600 bg-cyan-50 border-cyan-200'
    if (statusId === 'submitted') return 'text-violet-600 bg-violet-50 border-violet-200'
    if (statusId === 'in_progress') return 'text-blue-600 bg-blue-50 border-blue-200'
    if (statusId === 'note') return 'text-stone-600 bg-stone-50 border-stone-200'
    if (statusId === 'reviewing') return 'text-purple-600 bg-purple-50 border-purple-200'
    return 'text-[#283693] bg-[#283693]/5 border-[#283693]/20'
  }

  const pct = totalActive > 0 ? Math.round((completeCount / totalActive) * 100) : 0

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      {/* Header + progress */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-stone-800">{title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-400">{pct}%</span>
            <span className="text-sm font-bold text-[#283693]">{completeCount}<span className="text-stone-300 font-normal">/{totalActive}</span></span>
          </div>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #283693, #ed148c)' }} />
        </div>
      </div>

      {/* Steps list */}
      <div className="divide-y divide-stone-100">
        {renderableSteps.map((step, stepIdx) => {
          const isSubtask = step._depth > 0
          const hasChildren = !isSubtask && step._children && step._children.length > 0
          // Hide subtasks of collapsed parents
          if (isSubtask) {
            const parent = renderableSteps.find(s => s._children?.some(c => c.id === step.id))
            if (parent && isParentCollapsed(parent.id, parent._children)) return null
          }
          const data = tracking[step.id] || {}
          const history = data.history || []
          const storedStatus = data.status || 'not_started'
          const currentStatus = hasChildren ? (deriveParentStatus(step._children, tracking) || 'not_started') : storedStatus
          const isDeactivated = currentStatus === 'na' || currentStatus === 'deactivated'
          const isComplete = currentStatus === 'complete' || currentStatus === 'partial_complete'
          const lastEntry = history.length > 0 ? history[history.length - 1] : null
          const isExpanded = expandedStep === step.id
          const isAddingLog = addingLogFor === step.id
          const collapsed = hasChildren ? isParentCollapsed(step.id, step._children) : false
          // Subtask completion for parent badge
          const childCompleteCount = hasChildren
            ? step._children.filter(c => {
                const st = tracking[c.id]?.status
                return st === 'complete' || st === 'partial_complete'
              }).length
            : 0

          return (
            <React.Fragment key={step.id ?? stepIdx}>
              {/* ── Step Row ── */}
              <div
                onClick={() => {
                  // Parent with subtasks: click body toggles collapse.
                  // Leaf row: click body toggles history view (does NOT open the log form;
                  //   that's the "+ Log" button — prevents accidental duplicate logs).
                  if (hasChildren) { toggleCollapse(step.id, step._children); return }
                  if (isExpanded) {
                    setExpandedStep(null); setAddingLogFor(null); setLogStatus(''); setLogNote('')
                  } else {
                    setExpandedStep(step.id); setAddingLogFor(null)
                  }
                }}
                className={`group relative cursor-pointer ${isDeactivated ? 'opacity-35' : ''} ${isExpanded ? 'bg-[#283693]/[0.02]' : ''} ${hasChildren ? 'bg-stone-50/40' : ''} transition-colors`}
              >
                {/* Left accent bar */}
                {isComplete && !isSubtask && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-green-400 rounded-r" />}
                {!isComplete && !isDeactivated && currentStatus !== 'not_started' && !isSubtask && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#283693] rounded-r" />}

                <div className={`flex items-center gap-3 ${isSubtask ? 'pl-12 pr-5 py-2.5' : 'pl-6 pr-5 py-3.5'}`}>
                  {/* Collapse chevron for parents with children */}
                  {hasChildren && (
                    <button onClick={e => { e.stopPropagation(); toggleCollapse(step.id, step._children) }}
                      className="text-stone-400 hover:text-[#283693] -ml-1.5 shrink-0" title={collapsed ? 'Expand' : 'Collapse'}>
                      <ChevronDown className={`size-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                    </button>
                  )}
                  {/* Indent guide for subtasks */}
                  {isSubtask && <CornerDownRight className="size-3 text-stone-300 shrink-0 -ml-4" />}
                  {/* Status circle */}
                  {isDeactivated ? (
                    <div className="size-5 rounded-full bg-stone-200 shrink-0 flex items-center justify-center"><X className="size-3 text-stone-400" /></div>
                  ) : isComplete ? (
                    <div className="size-5 rounded-full bg-green-500 shrink-0 flex items-center justify-center shadow-sm shadow-green-200"><Check className="size-3 text-white" /></div>
                  ) : currentStatus !== 'not_started' ? (
                    <div className="size-5 rounded-full border-2 border-[#283693] shrink-0 flex items-center justify-center"><div className="size-2 rounded-full bg-[#283693]" /></div>
                  ) : (
                    <div className="size-5 rounded-full border-2 border-stone-200 shrink-0 group-hover:border-stone-300 transition-colors" />
                  )}

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    {editingLabel === step.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input className="flex-1 rounded-lg border border-[#283693]/30 px-2.5 py-1 text-sm font-semibold bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none" value={labelValue} onChange={e => setLabelValue(e.target.value)} autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') { if (labelValue.trim()) onUpdate(step.id, { ...data, customLabel: labelValue.trim() }); setEditingLabel(null) } if (e.key === 'Escape') setEditingLabel(null) }} />
                        <button onClick={() => { if (labelValue.trim()) onUpdate(step.id, { ...data, customLabel: labelValue.trim() }); setEditingLabel(null) }} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="size-3.5" /></button>
                        <button onClick={() => setEditingLabel(null)} className="p-1 text-stone-400 hover:bg-stone-100 rounded"><X className="size-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`${isSubtask ? 'text-sm font-medium' : 'text-base font-bold'} ${isDeactivated ? 'text-stone-300 line-through' : isComplete ? 'text-stone-500' : 'text-stone-800'} ${step.logType === 'text' ? 'cursor-text' : ''}`}
                          onClick={e => { if (step.logType !== 'text') return; e.stopPropagation(); setEditingLabel(step.id); setLabelValue(data.customLabel || step.label) }}
                          title={step.logType === 'text' ? 'Click to rename' : undefined}>
                          {data.customLabel || step.label}
                        </span>
                        {step.badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${step.badge.color}`}>{step.badge.label}</span>}
                        {hasChildren && (
                          <span className="text-[11px] font-semibold text-stone-500 bg-white border border-stone-200 px-2 py-0.5 rounded-full">
                            {childCompleteCount}/{step._children.length}
                          </span>
                        )}
                        {/* + subtask (next to label) */}
                        {!isSubtask && !isDeactivated && (
                          <button onClick={(e) => { e.stopPropagation(); setAddingCaseSubtask(addingCaseSubtask === step.id ? null : step.id); setCaseSubtaskLabel('') }}
                            className="p-0.5 text-stone-300 hover:text-[#283693] hover:bg-[#283693]/5 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100" title="Add subtask">
                            <Plus className="size-3.5" />
                          </button>
                        )}
                        {/* Deactivate / Reactivate toggle */}
                        {!hasChildren && (
                          <button onClick={(e) => {
                            e.stopPropagation()
                            if (isDeactivated) {
                              const lastReal = [...history].reverse().find(h => h.status !== 'na' && !h._deactivate)
                              updateStep(step.id, { status: lastReal?.status || 'not_started' })
                            } else {
                              updateStep(step.id, { status: 'na' })
                            }
                          }}
                            className={`p-0.5 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100 ${isDeactivated ? 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}
                            title={isDeactivated ? 'Reactivate' : 'Deactivate (N/A)'}>
                            {isDeactivated ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          </button>
                        )}
                        {/* Delete case subtask */}
                        {isSubtask && step._isCaseSubtask && (
                          <button onClick={(e) => { e.stopPropagation(); deleteCaseSubtask(step.id) }}
                            className="p-0.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100" title="Remove subtask">
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {/* Last log preview — only on non-expanded rows */}
                    {lastEntry && !isExpanded && !hasChildren && (
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400">
                        {lastEntry.note && <span className="truncate max-w-[200px]">{lastEntry.note}</span>}
                        {lastEntry.date && <span>{formatDate(lastEntry.date)}</span>}
                        {lastEntry.by && <span>· {lastEntry.by}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right column: status + quick-action buttons */}
                  <div className="shrink-0 flex items-center gap-2">
                    {step.logType === 'date_completed' && currentStatus === 'complete' ? (
                      <span className="text-[11px] font-semibold text-emerald-600">{lastEntry?.date ? formatDate(lastEntry.date) : 'Done'}</span>
                    ) : step.logType === 'dropdown' && (data.optionLabel || lastEntry?.optionLabel) && currentStatus !== 'not_started' ? (
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusColor(currentStatus)}`}>{data.optionLabel || lastEntry?.optionLabel}</span>
                    ) : step.logType === 'text' && currentStatus !== 'na' && currentStatus !== 'not_started' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-stone-600 max-w-[120px] truncate">{data._textValue || currentStatus}</span>
                        {isComplete && <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />}
                      </div>
                    ) : (
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusColor(currentStatus)}`}>{getStatusLabel(currentStatus)}</span>
                    )}

                    {/* Quick Complete / Re-open — leaf rows only, no date_completed (it has its own UI) */}
                    {!hasChildren && !isDeactivated && step.logType !== 'date_completed' && (
                      isComplete ? (
                        <button onClick={(e) => { e.stopPropagation(); reopen(step.id) }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-amber-600 bg-white hover:bg-amber-50 px-2 py-1 rounded-full border border-stone-200 hover:border-amber-200 transition-colors"
                          title="Re-open this task">
                          <X className="size-3" /> Re-open
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); quickComplete(step.id) }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 rounded-full transition-colors shadow-sm"
                          title="Mark complete with today's date">
                          <Check className="size-3" /> Complete
                        </button>
                      )
                    )}

                    {/* + Log — leaf rows, opens the log form for date/note */}
                    {!hasChildren && !isDeactivated && (
                      <button onClick={(e) => { e.stopPropagation(); openAddLog(step.id) }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-[#283693] bg-white hover:bg-[#283693]/5 px-2 py-1 rounded-full border border-stone-200 hover:border-[#283693]/30 transition-colors"
                        title="Add a log entry with date + note">
                        <Plus className="size-3" /> Log
                      </button>
                    )}

                    {!hasChildren && currentStatus !== 'na' && history.length > 0 && (
                      <ChevronDown className={`size-4 text-stone-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>
              </div>

              {/* ── History entries ── */}
              {isExpanded && history.length > 0 && (
                <div className="bg-stone-50/80 border-t border-stone-100">
                  <div className="px-6 py-2">
                    <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mb-1">History</p>
                  </div>
                  {history.map((entry, i) => {
                    const isEditing = editingLog?.stepId === step.id && editingLog?.index === i
                    if (isEditing) {
                      return (
                        <div key={`h-${i}`} className="px-6 py-2 bg-white border-t border-stone-100">
                          <div className="flex items-center gap-2">
                            <select className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs bg-white flex-shrink-0" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                              {statuses.filter(s => s.id !== 'not_started').map(s => <option key={s.id} value={s.id}>{getStatusLabel(s.id)}</option>)}
                            </select>
                            <input type="date" className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs bg-white w-[130px]" value={editDate} onChange={e => setEditDate(e.target.value)} />
                            <input className="flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs bg-white" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note..." />
                            <button onClick={() => saveEditLog(step.id, i)} className="text-xs font-semibold text-[#283693] hover:underline">Save</button>
                            <button onClick={() => setEditingLog(null)} className="text-xs text-stone-400 hover:underline">Cancel</button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={`h-${i}`}
                        onClick={() => { setEditingLog({ stepId: step.id, index: i }); setEditStatus(entry.status); setEditNote(entry.note || ''); setEditDate(entry.date || '') }}
                        className="px-6 py-1.5 flex items-center gap-3 text-xs hover:bg-stone-100/70 cursor-pointer transition-colors"
                        title="Click to edit"
                      >
                        <span className={`shrink-0 font-medium ${statusColor(entry.status).split(' ')[0]}`}>{entry.optionLabel || getStatusLabel(entry.status)}</span>
                        <span className="text-stone-400 shrink-0">{formatDate(entry.date)}</span>
                        {entry.note && <span className="text-stone-500 truncate">{entry.note}</span>}
                        <span className="text-stone-300 ml-auto shrink-0">{entry.by}</span>
                        <span className="flex gap-1 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); setEditingLog({ stepId: step.id, index: i }); setEditStatus(entry.status); setEditNote(entry.note || ''); setEditDate(entry.date || '') }} className="p-0.5 text-stone-400 hover:text-[#283693]" title="Edit log"><Pencil className="size-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteLog(step.id, i) }} className="p-0.5 text-stone-400 hover:text-red-500" title="Delete log"><Trash2 className="size-3" /></button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Add Log Form ── */}
              {isAddingLog && (
                <div className="bg-[#283693]/[0.03] border-t border-[#283693]/10 px-6 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-wrap items-end gap-3">
                    {/* Status input */}
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mb-1 block">Status</label>
                      {step.logType === 'date_completed' ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => submitLog(step.id, 'complete')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-colors">
                            <Check className="size-3.5" /> Mark Complete
                          </button>
                          <button onClick={() => submitLog(step.id, 'na')} className="text-[10px] text-stone-400 hover:text-red-500 font-medium">N/A</button>
                        </div>
                      ) : step.logType === 'text' ? (
                        <input className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none" placeholder="Enter value..." value={logStatus} onChange={e => setLogStatus(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLog(step.id)} autoFocus />
                      ) : step.logType === 'dropdown' && step.options?.length > 0 ? (
                        <select className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" value={logStatus} onChange={e => setLogStatus(e.target.value)} autoFocus>
                          <option value="">Select...</option>
                          {normalizeOptions(step.options).map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                          <option value="complete">Complete</option>
                          <option value="na">N/A (Deactivate)</option>
                        </select>
                      ) : (
                        <select className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" value={logStatus} onChange={e => setLogStatus(e.target.value)} autoFocus>
                          <option value="">Select...</option>
                          {statuses.filter(s => s.id !== 'not_started').map(s => <option key={s.id} value={s.id}>{getStatusLabel(s.id)}</option>)}
                        </select>
                      )}
                    </div>
                    {/* Date */}
                    <div className="w-[130px]">
                      <label className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mb-1 block">Date</label>
                      <input type="date" className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" value={logDate} onChange={e => setLogDate(e.target.value)} />
                    </div>
                    {/* Note */}
                    <div className="flex-1 min-w-[160px]">
                      <label className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mb-1 block">Note</label>
                      <input className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none" placeholder="Add note..." value={logNote} onChange={e => setLogNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLog(step.id)} />
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => submitLog(step.id)} disabled={!logStatus}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#283693] hover:bg-[#1e2a6e] px-3 py-1.5 rounded-lg disabled:opacity-30 transition-colors shadow-sm">
                        <Check className="size-3" /> Save
                      </button>
                      {step.logType === 'text' && currentStatus !== 'na' && (
                        <>
                          {currentStatus !== 'complete' && (
                            <button onClick={() => submitLog(step.id, 'complete')} className="text-[10px] text-green-600 hover:text-green-700 font-semibold px-2 py-1.5 hover:bg-green-50 rounded-lg">Complete</button>
                          )}
                          <button onClick={() => submitLog(step.id, 'na')} className="text-[10px] text-stone-400 hover:text-red-500 font-medium px-2 py-1.5 hover:bg-red-50 rounded-lg">N/A</button>
                        </>
                      )}
                      <button onClick={() => { setAddingLogFor(null); setLogStatus(''); setLogNote('') }} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5">Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Add case subtask ── */}
              {!isSubtask && addingCaseSubtask === step.id && (
                <div className="bg-[#283693]/[0.02] border-t border-stone-100 px-6 py-2.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 pl-6">
                    <CornerDownRight className="size-3 text-stone-300 shrink-0" />
                    <input
                      className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none"
                      placeholder="Subtask name..."
                      value={caseSubtaskLabel}
                      onChange={e => setCaseSubtaskLabel(e.target.value)}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') addCaseSubtask(step.id); if (e.key === 'Escape') { setAddingCaseSubtask(null); setCaseSubtaskLabel('') } }}
                    />
                    <button onClick={() => addCaseSubtask(step.id)} disabled={!caseSubtaskLabel.trim()} className="text-xs font-semibold text-white bg-[#283693] hover:bg-[#1e2a6e] px-3 py-1.5 rounded-lg disabled:opacity-30 transition-colors">Add</button>
                    <button onClick={() => { setAddingCaseSubtask(null); setCaseSubtaskLabel('') }} className="text-xs text-stone-400 hover:underline">Cancel</button>
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </Card>
  )
}
