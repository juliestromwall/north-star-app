import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Check, X, ChevronDown, CheckCircle2, Clock, CornerDownRight, Plus, Trash2 } from 'lucide-react'
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
    if (onStatusLog) onStatusLog({ stepId, stepLabel: step?.label || stepId, status: entryStatus, by: currentUserName })
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
    setLogDate('')
    setEditingLog(null)
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
    if (statusId === 'in_progress') return 'text-blue-600 bg-blue-50 border-blue-200'
    if (statusId === 'note') return 'text-stone-600 bg-stone-50 border-stone-200'
    if (statusId === 'reviewing') return 'text-purple-600 bg-purple-50 border-purple-200'
    return 'text-[#283693] bg-[#283693]/5 border-[#283693]/20'
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{title}</CardTitle>
        <span className="text-sm font-bold text-[#283693]">{completeCount}/{totalActive}</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-6 pb-5">
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${totalActive > 0 ? (completeCount / totalActive) * 100 : 0}%`, background: completeCount === totalActive && totalActive > 0 ? '#22c55e' : 'linear-gradient(90deg, #10b981, #22c55e)' }} />
          </div>
        </div>
        <table className="w-full border-t border-stone-200 text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider" style={{width:'35%'}}>Step</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider" style={{width:'11%'}}>Status</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider" style={{width:'10%'}}>Date</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider" style={{width:'28%'}}>Note</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider" style={{width:'12%'}}>By</th>
              <th style={{width:'30px'}} />
            </tr>
          </thead>
          <tbody>
            {renderableSteps.map((step, stepIdx) => {
              const isSubtask = step._depth > 0
              const hasChildren = !isSubtask && step._children && step._children.length > 0
              const data = tracking[step.id] || {}
              const history = data.history || []
              // Parents with children: status is derived from children, not stored.
              const storedStatus = data.status || 'not_started'
              const currentStatus = hasChildren
                ? (deriveParentStatus(step._children, tracking) || 'not_started')
                : storedStatus
              const isDeactivated = currentStatus === 'na' || currentStatus === 'deactivated'
              const isComplete = currentStatus === 'complete' || currentStatus === 'partial_complete'
              const lastEntry = history.length > 0 ? history[history.length - 1] : null
              const isExpanded = expandedStep === step.id
              const isAddingLog = addingLogFor === step.id
              const rowClickable = !hasChildren // parents-with-children are read-only

              return (
                <React.Fragment key={step.id ?? stepIdx}>
                  <tr
                    onClick={() => {
                      if (!rowClickable) return
                      if (isExpanded) { setExpandedStep(null); setAddingLogFor(null); setLogStatus(''); setLogNote('') }
                      else { openAddLog(step.id) }
                    }}
                    className={`border-b border-stone-100 ${rowClickable ? 'cursor-pointer' : 'cursor-default'} ${isDeactivated ? 'bg-stone-50/50 opacity-40' : isComplete ? 'bg-green-50/70 hover:bg-green-50' : isSubtask ? 'bg-stone-50/30 hover:bg-stone-50/60' : 'hover:bg-stone-50/50'} transition-colors`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2" style={{ paddingLeft: isSubtask ? 24 : 0 }}>
                        {isSubtask && <CornerDownRight className="size-3 text-stone-300 shrink-0 -ml-1" />}
                        {isDeactivated ? (
                          <div className="size-4 rounded-full bg-stone-200 shrink-0" />
                        ) : isComplete ? (
                          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                        ) : (
                          <div className="size-4 rounded-full border-2 border-stone-200 shrink-0" />
                        )}
                        {editingLabel === step.id ? (
                          <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                            <input className="flex-1 rounded border border-[#283693]/30 px-2 py-0.5 text-sm font-semibold bg-white focus:border-[#283693] outline-none" value={labelValue} onChange={e => setLabelValue(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') { if (labelValue.trim()) onUpdate(step.id, { ...data, customLabel: labelValue.trim() }); setEditingLabel(null) } if (e.key === 'Escape') setEditingLabel(null) }} />
                            <button onClick={() => { if (labelValue.trim()) onUpdate(step.id, { ...data, customLabel: labelValue.trim() }); setEditingLabel(null) }} className="p-0.5 text-emerald-600"><Check className="size-3.5" /></button>
                            <button onClick={() => setEditingLabel(null)} className="p-0.5 text-stone-400"><X className="size-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col">
                              <span className={`font-semibold cursor-text ${currentStatus === 'na' ? 'text-stone-300 line-through' : isComplete ? 'text-green-700' : 'text-stone-800'}`}
                                onClick={e => { e.stopPropagation(); setEditingLabel(step.id); setLabelValue(data.customLabel || step.label) }} title="Click to rename">
                                {data.customLabel || step.label}
                              </span>
                              {step.badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded self-start mt-0.5 ${step.badge.color}`}>{step.badge.label}</span>}
                              {hasChildren && <span className="text-[9px] font-medium text-stone-400 self-start mt-0.5">{step._children.length} subtask{step._children.length !== 1 ? 's' : ''}</span>}
                            </div>
                          </>
                        )}
                        {/* Add case subtask button — on all top-level rows */}
                        {!isSubtask && (
                          <button onClick={(e) => { e.stopPropagation(); setAddingCaseSubtask(addingCaseSubtask === step.id ? null : step.id); setCaseSubtaskLabel('') }}
                            className="text-stone-200 hover:text-[#283693] transition-colors shrink-0" title="Add subtask for this case">
                            <Plus className="size-3.5" />
                          </button>
                        )}
                        {/* Delete button for case-specific subtasks */}
                        {isSubtask && step._isCaseSubtask && (
                          <button onClick={(e) => { e.stopPropagation(); deleteCaseSubtask(step.id) }}
                            className="text-stone-200 hover:text-red-500 transition-colors shrink-0" title="Remove this subtask">
                            <Trash2 className="size-3" />
                          </button>
                        )}
                        {!hasChildren && currentStatus !== 'na' && <ChevronDown className={`size-3.5 text-stone-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {step.logType === 'date_completed' && currentStatus === 'complete' ? (
                        <span className="text-xs font-semibold text-emerald-600">Completed {lastEntry?.date ? new Date(lastEntry.date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}</span>
                      ) : step.logType === 'date_completed' && currentStatus !== 'complete' && currentStatus !== 'na' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const today = new Date().toISOString().split('T')[0]
                            const entry = { status: 'complete', date: today, note: '', by: currentUserName }
                            const updated = { ...data, status: 'complete', history: [...history, entry] }
                            updateStep(step.id, updated)
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Check className="size-3.5" /> Complete
                        </button>
                      ) : step.logType === 'dropdown' && (data.optionLabel || lastEntry?.optionLabel) && currentStatus !== 'not_started' ? (
                        <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full border ${statusColor(currentStatus)}`}>{data.optionLabel || lastEntry?.optionLabel}</span>
                      ) : step.logType === 'text' && currentStatus !== 'na' && currentStatus !== 'not_started' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-800">{data._textValue || currentStatus}</span>
                          {currentStatus === 'complete' && <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />}
                        </div>
                      ) : (
                        <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full border ${statusColor(currentStatus)}`}>{getStatusLabel(currentStatus)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-stone-500">{formatDate(lastEntry?.date)}</td>
                    <td className="px-3 py-3.5 text-stone-500 text-xs break-words">{lastEntry?.note || ''}</td>
                    <td className="px-4 py-3.5 text-stone-400 text-right text-xs">{lastEntry?.by || ''}</td>
                    <td className="px-3 py-3.5" />
                  </tr>

                  {isExpanded && history.map((entry, i) => {
                    const isEditing = editingLog?.stepId === step.id && editingLog?.index === i
                    if (isEditing) {
                      return (
                        <tr key={`h-${i}`} className="bg-white border-b border-stone-100">
                          <td className="px-6 py-2" />
                          <td className="px-3 py-2">
                            <select className="rounded-lg border border-stone-200 px-2 py-1 text-sm bg-white w-full" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                              {statuses.filter(s => s.id !== 'not_started').map(s => <option key={s.id} value={s.id}>{getStatusLabel(s.id)}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" className="rounded-lg border border-stone-200 px-2 py-1 text-sm bg-white w-[130px]" value={editDate} onChange={e => setEditDate(e.target.value)} />
                          </td>
                          <td className="px-3 py-2"><input className="w-full rounded-lg border border-stone-200 px-2 py-1 text-sm bg-white" value={editNote} onChange={e => setEditNote(e.target.value)} /></td>
                          <td className="px-3 py-2 text-stone-400">{entry.by || ''}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => saveEditLog(step.id, i)} className="text-xs font-semibold text-[#283693] hover:underline mr-2">Save</button>
                            <button onClick={() => setEditingLog(null)} className="text-xs text-stone-400 hover:underline">Cancel</button>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={`h-${i}`} className="bg-stone-50/60 border-b border-stone-100/50 group">
                        <td className="px-6 py-2" />
                        <td className={`px-3 py-2 font-medium ${statusColor(entry.status).split(' ')[0]}`}>{entry.optionLabel || getStatusLabel(entry.status)}</td>
                        <td className="px-3 py-2 text-stone-400">{formatDate(entry.date)}</td>
                        <td className="px-3 py-2 text-stone-500">{entry.note || ''}</td>
                        <td className="px-3 py-2 text-stone-400">{entry.by || ''}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingLog({ stepId: step.id, index: i }); setEditStatus(entry.status); setEditNote(entry.note || ''); setEditDate(entry.date || '') }} className="text-[10px] text-stone-400 hover:text-[#283693] mr-2">Edit</button>
                            <button onClick={() => deleteLog(step.id, i)} className="text-[10px] text-stone-400 hover:text-red-500">Delete</button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {isAddingLog && (
                    <tr className="bg-[#283693]/[0.02] border-b border-stone-200" onClick={e => e.stopPropagation()}>
                      <td className="px-6 py-3 text-xs font-semibold text-[#283693]">New Log</td>
                      <td className="px-3 py-3">
                        {step.logType === 'date_completed' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { submitLog(step.id, 'complete') }}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Check className="size-3.5" /> Mark Complete
                            </button>
                            <button
                              onClick={() => { submitLog(step.id, 'na') }}
                              className="text-[10px] text-stone-400 hover:text-red-500"
                            >
                              N/A
                            </button>
                          </div>
                        ) : step.logType === 'text' ? (
                          <input className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" placeholder="Enter value..." value={logStatus} onChange={e => setLogStatus(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLog(step.id)} />
                        ) : step.logType === 'dropdown' && step.options?.length > 0 ? (
                          <select className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" value={logStatus} onChange={e => setLogStatus(e.target.value)}>
                            <option value="">Select...</option>
                            {normalizeOptions(step.options).map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                            <option value="complete">Complete</option>
                            <option value="na">N/A (Deactivate)</option>
                          </select>
                        ) : (
                          <select className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" value={logStatus} onChange={e => setLogStatus(e.target.value)}>
                            <option value="">Select...</option>
                            {statuses.filter(s => s.id !== 'not_started').map(s => <option key={s.id} value={s.id}>{getStatusLabel(s.id)}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" className="rounded-lg border border-stone-200 px-2 py-1 text-xs bg-white w-[120px]" value={logDate} onChange={e => setLogDate(e.target.value)} placeholder="Today" />
                      </td>
                      <td className="px-3 py-3">
                        <input className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" placeholder="Add note..." value={logNote} onChange={e => setLogNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLog(step.id)} />
                      </td>
                      <td className="px-3 py-3 text-stone-400 text-xs">{currentUserName}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => submitLog(step.id)} disabled={!logStatus} className="text-xs font-semibold text-white bg-[#283693] hover:bg-[#283693]/90 px-2.5 py-1 rounded-lg disabled:opacity-40">Save</button>
                          {(step.logType === 'text') && currentStatus !== 'na' && (
                            <>
                              {currentStatus !== 'complete' && (
                                <button onClick={() => { submitLog(step.id, 'complete') }} className="text-[10px] text-green-600 hover:text-green-700 font-medium px-1.5 py-1">Complete</button>
                              )}
                              <button onClick={() => { submitLog(step.id, 'na') }} className="text-[10px] text-stone-400 hover:text-red-500 px-1.5 py-1">Deactivate</button>
                            </>
                          )}
                          <button onClick={() => { setAddingLogFor(null); setLogStatus(''); setLogNote('') }} className="text-xs text-stone-400 hover:underline">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Inline input for adding a case-specific subtask */}
                  {!isSubtask && addingCaseSubtask === step.id && (
                    <tr className="bg-[#283693]/[0.02] border-b border-stone-200" onClick={e => e.stopPropagation()}>
                      <td className="px-6 py-2.5" colSpan={6}>
                        <div className="flex items-center gap-2" style={{ paddingLeft: 24 }}>
                          <CornerDownRight className="size-3 text-stone-300 shrink-0" />
                          <input
                            className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] outline-none"
                            placeholder="Subtask name for this case..."
                            value={caseSubtaskLabel}
                            onChange={e => setCaseSubtaskLabel(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') addCaseSubtask(step.id); if (e.key === 'Escape') { setAddingCaseSubtask(null); setCaseSubtaskLabel('') } }}
                          />
                          <button onClick={() => addCaseSubtask(step.id)} disabled={!caseSubtaskLabel.trim()} className="text-xs font-semibold text-white bg-[#283693] hover:bg-[#283693]/90 px-2.5 py-1 rounded-lg disabled:opacity-40">Add</button>
                          <button onClick={() => { setAddingCaseSubtask(null); setCaseSubtaskLabel('') }} className="text-xs text-stone-400 hover:underline">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
