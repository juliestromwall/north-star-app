import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Check, X, ChevronDown, CheckCircle2, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

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

  const activeSteps = steps.filter(s => tracking[s.id]?.status !== 'na')
  const completeCount = activeSteps.filter(s => tracking[s.id]?.status === 'complete').length
  const totalActive = activeSteps.length

  function submitLog(stepId) {
    if (!logStatus) return
    const current = tracking[stepId] || { history: [] }
    const history = current.history || []
    const entry = { status: logStatus, date: new Date().toISOString().split('T')[0], note: logNote.trim() || null, by: currentUserName || 'Admin' }
    onUpdate(stepId, { status: logStatus, history: [...history, entry] })
    const step = steps.find(s => s.id === stepId)
    console.log('[TrackingTable] submitLog:', { stepId, status: logStatus, hasOnStatusLog: !!onStatusLog })
    if (onStatusLog) onStatusLog({ stepId, stepLabel: step?.label || stepId, status: logStatus, by: currentUserName })
    setLogStatus('')
    setLogNote('')
    setAddingLogFor(null)
  }

  function deleteLog(stepId, index) {
    const current = tracking[stepId] || { history: [] }
    const history = [...(current.history || [])]
    history.splice(index, 1)
    const newStatus = history.length > 0 ? history[history.length - 1].status : 'not_started'
    onUpdate(stepId, { status: newStatus, history })
  }

  function saveEditLog(stepId, index) {
    const current = tracking[stepId] || { history: [] }
    const history = [...(current.history || [])]
    history[index] = { ...history[index], status: editStatus, note: editNote.trim() || null }
    const newStatus = history[history.length - 1].status
    onUpdate(stepId, { status: newStatus, history })
    setEditingLog(null)
  }

  function openAddLog(stepId) {
    setAddingLogFor(stepId)
    setExpandedStep(stepId)
    setLogStatus('')
    setLogNote('')
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
    if (statusId === 'in_progress') return 'text-blue-600 bg-blue-50 border-blue-200'
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
            {steps.map((step, stepIdx) => {
              const data = tracking[step.id] || {}
              const history = data.history || []
              const currentStatus = data.status || 'not_started'
              const isDeactivated = currentStatus === 'na' || currentStatus === 'deactivated'
              const isComplete = currentStatus === 'complete' || currentStatus === 'partial_complete'
              const lastEntry = history.length > 0 ? history[history.length - 1] : null
              const isExpanded = expandedStep === step.id
              const isAddingLog = addingLogFor === step.id

              return (
                <React.Fragment key={step.id ?? stepIdx}>
                  <tr
                    onClick={() => { if (isExpanded) { setExpandedStep(null); setAddingLogFor(null); setLogStatus(''); setLogNote('') } else { openAddLog(step.id) } }}
                    className={`border-b border-stone-100 cursor-pointer ${isDeactivated ? 'bg-stone-50/50 opacity-40' : isComplete ? 'bg-green-50/70 hover:bg-green-50' : 'hover:bg-stone-50/50'} transition-colors`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
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
                            </div>
                          </>
                        )}
                        {currentStatus !== 'na' && <ChevronDown className={`size-3.5 text-stone-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
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
                            onUpdate(step.id, updated)
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Check className="size-3.5" /> Complete
                        </button>
                      ) : (step.logType === 'text' || step.logType === 'dropdown') && currentStatus !== 'na' && currentStatus !== 'not_started' && currentStatus !== 'complete' ? (
                        <span className="text-sm font-medium text-stone-800">{currentStatus}</span>
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
                          <td className="px-3 py-2 text-stone-400">{formatDate(entry.date)}</td>
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
                        <td className={`px-3 py-2 font-medium ${statusColor(entry.status).split(' ')[0]}`}>{getStatusLabel(entry.status)}</td>
                        <td className="px-3 py-2 text-stone-400">{formatDate(entry.date)}</td>
                        <td className="px-3 py-2 text-stone-500">{entry.note || ''}</td>
                        <td className="px-3 py-2 text-stone-400">{entry.by || ''}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingLog({ stepId: step.id, index: i }); setEditStatus(entry.status); setEditNote(entry.note || '') }} className="text-[10px] text-stone-400 hover:text-[#283693] mr-2">Edit</button>
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
                              onClick={() => { setLogStatus('complete'); setLogNote(''); setTimeout(() => submitLog(step.id), 50) }}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Check className="size-3.5" /> Mark Complete
                            </button>
                            <button
                              onClick={() => { setLogStatus('na'); setTimeout(() => submitLog(step.id), 50) }}
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
                            {step.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                      <td className="px-3 py-3 text-stone-400 text-xs">Today</td>
                      <td className="px-3 py-3">
                        <input className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm bg-white focus:border-[#283693] outline-none" placeholder="Add note..." value={logNote} onChange={e => setLogNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLog(step.id)} />
                      </td>
                      <td className="px-3 py-3 text-stone-400 text-xs">{currentUserName}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => submitLog(step.id)} disabled={!logStatus} className="text-xs font-semibold text-white bg-[#283693] hover:bg-[#283693]/90 px-2.5 py-1 rounded-lg disabled:opacity-40">Save</button>
                          {(step.logType === 'text') && currentStatus !== 'na' && currentStatus !== 'complete' && (
                            <>
                              <button onClick={() => { setLogStatus('complete'); setLogNote(logNote || logStatus); setTimeout(() => submitLog(step.id), 50) }} className="text-[10px] text-green-600 hover:text-green-700 font-medium px-1.5 py-1">Complete</button>
                              <button onClick={() => { setLogStatus('na'); setTimeout(() => submitLog(step.id), 50) }} className="text-[10px] text-stone-400 hover:text-red-500 px-1.5 py-1">Deactivate</button>
                            </>
                          )}
                          <button onClick={() => { setAddingLogFor(null); setLogStatus(''); setLogNote('') }} className="text-xs text-stone-400 hover:underline">Cancel</button>
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
