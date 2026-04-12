import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchSurrogateProfilesByEmails, getRecordTrackingBatch, fetchCaseEmails, fetchCaseTasks, fetchCaseNotes, fetchInsurance, fetchInsurancePayments, fetchJourneyExpenses } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getAllChecklistSteps, getChecklistMilestones, deriveParentStatus } from '@/lib/checklistStore'
import { SURROGATE_STAGES } from '@/lib/constants'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ScrollText, ClipboardPlus, X, Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import StageBadge from '@/components/shared/StageBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'

function calcGestationalAge(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const conception = new Date(due.getTime() - 280 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const diffMs = now - conception
  const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000))
  if (weeks < 0 || weeks > 42) return null
  return `${weeks}w ${days}d`
}

const SCREENING_STAGES = ['pre-qualification', 'screening', 'matching']
const JOURNEY_STAGE_IDS = ['journey-oversight']

// Re-export shared component for backward compat
import AISummaryButton from '@/components/shared/AISummaryButton'

export default function CaseUpdatesPage() {
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys()])
      .then(([gcs, allIps, js]) => {
        setSurrogates(gcs || [])
        setIps(allIps || [])
        setJourneys(js || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-center text-stone-400">Loading...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader title="Case Updates" subtitle="Track screening progress and case status across all case types" />

      <Tabs defaultValue="surrogates">
        <TabsList>
          <TabsTrigger value="surrogates">Surrogates</TabsTrigger>
          <TabsTrigger value="ips">Intended Parents</TabsTrigger>
          <TabsTrigger value="journeys">Matched Journeys</TabsTrigger>
        </TabsList>

        <TabsContent value="surrogates" className="mt-4">
          <SurrogateUpdatesSheet surrogates={surrogates} />
        </TabsContent>

        <TabsContent value="ips" className="mt-4">
          <IPUpdatesSheet ips={ips} />
        </TabsContent>

        <TabsContent value="journeys" className="mt-4">
          <JourneyUpdatesSheet journeys={journeys} surrogates={surrogates} ips={ips} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Record type helpers ──
const RECORD_PREFIXES = { 'ob records': 'ob_records_', 'delivery records': 'delivery_records_', 'ivf records': 'ivf_records_' }
function getRecordPrefix(stepLabel) {
  const lower = (stepLabel || '').toLowerCase()
  for (const [key, prefix] of Object.entries(RECORD_PREFIXES)) { if (lower.includes(key)) return prefix }
  return null
}
function getRecordTypeBadge(key) {
  if (key.startsWith('ob_records_')) return { label: 'OB', color: 'bg-blue-100 text-blue-700' }
  if (key.startsWith('delivery_records_')) return { label: 'Delivery', color: 'bg-purple-100 text-purple-700' }
  if (key.startsWith('ivf_records_')) return { label: 'IVF', color: 'bg-pink-100 text-pink-700' }
  return null
}

// ── Surrogate Updates ──
function SurrogateUpdatesSheet({ surrogates }) {
  const [stageFilter, setStageFilter] = useState('pre-qualification')
  const [logPopover, setLogPopover] = useState(null)
  const [docPopover, setDocPopover] = useState(null)
  const allSteps = useMemo(() => getAllChecklistSteps('gc').filter(s => s.stageId === stageFilter), [stageFilter])
  const sheetRows = useMemo(() => allSteps.filter(s => !s.parentId), [allSteps])
  const subtasksByParent = useMemo(() => {
    const map = {}
    for (const s of allSteps) { if (s.parentId) { if (!map[s.parentId]) map[s.parentId] = []; map[s.parentId].push(s) } }
    return map
  }, [allSteps])

  const allStageStatuses = useMemo(() => {
    const map = {}
    for (const s of surrogates) map[s.id] = getSurrogateStageStatus(s.id)
    return map
  }, [surrogates])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const stage of SURROGATE_STAGES) counts[stage.id] = 0
    for (const s of surrogates) {
      const stageId = allStageStatuses[s.id]?.stage || 'pre-qualification'
      if (counts[stageId] !== undefined) counts[stageId]++
    }
    return counts
  }, [surrogates, allStageStatuses])

  const filtered = useMemo(() => {
    return surrogates.filter(s => (allStageStatuses[s.id]?.stage || 'pre-qualification') === stageFilter)
  }, [surrogates, stageFilter, allStageStatuses])

  const [allTracking, setAllTracking] = useState({})
  useEffect(() => {
    const ids = filtered.map(s => s.id)
    if (ids.length === 0) { setAllTracking({}); return }
    getRecordTrackingBatch(ids).then(setAllTracking).catch(() => setAllTracking({}))
  }, [filtered])

  const [allProfiles, setAllProfiles] = useState({})
  useEffect(() => {
    const emails = filtered.map(s => s.email).filter(Boolean)
    if (emails.length === 0) { setAllProfiles({}); return }
    fetchSurrogateProfilesByEmails(emails).then(map => {
      const byId = {}
      for (const s of filtered) {
        if (s.email && map[s.email.trim().toLowerCase()]) byId[s.id] = map[s.email.trim().toLowerCase()]
      }
      setAllProfiles(byId)
    }).catch(() => {})
  }, [filtered])

  function buildExpectedRecords(surrogateId) {
    const profile = allProfiles[surrogateId]
    const pregnancies = profile?.pregnancyHistory?.pregnancies || []
    const numPreg = parseInt(profile?.pregnancyHistory?.numberOfPregnancies) || 0
    const steps = []
    for (let i = 0; i < Math.max(numPreg, pregnancies.length); i++) {
      const p = pregnancies[i] || {}
      const year = p.dob ? new Date(p.dob).getFullYear() : ''
      const yearLabel = year || `#${i + 1}`
      steps.push({ id: `ob_records_${i}`, label: `OB ${yearLabel}`, badge: { label: 'OB', color: 'bg-blue-100 text-blue-700' } })
      steps.push({ id: `delivery_records_${i}`, label: `Delivery ${yearLabel}`, badge: { label: 'Delivery', color: 'bg-purple-100 text-purple-700' } })
      if (p.wasSurrogacy === 'yes') steps.push({ id: `ivf_records_${i}`, label: `IVF ${yearLabel}`, badge: { label: 'IVF', color: 'bg-pink-100 text-pink-700' } })
    }
    const rt = allTracking[surrogateId] || {}
    for (const key of Object.keys(rt)) {
      if (key.startsWith('custom_record_') && !steps.some(s => s.id === key)) {
        const d = rt[key]
        steps.push({ id: key, label: d.customLabel || key, badge: getRecordTypeBadge(key) || { label: 'OB', color: 'bg-blue-100 text-blue-700' } })
      }
    }
    return steps
  }

  function getSubRecords(surrogateId, prefix) {
    const expected = buildExpectedRecords(surrogateId)
    const rt = allTracking[surrogateId] || {}
    return expected.filter(s => s.id.startsWith(prefix)).map(step => {
      const d = rt[step.id] || {}
      const lastEntry = d.history?.[d.history.length - 1]
      return { ...step, status: d.status || 'not_started', isComplete: d.status === 'complete' || d.status === 'na', isExcluded: d.status === 'na', lastDate: lastEntry?.date, lastNote: lastEntry?.note }
    })
  }

  function getCellData(surrogateId, stepId, stepLabel) {
    const rt = allTracking[surrogateId] || {}
    const data = rt[stepId] || {}
    const storedStatus = data.status || 'not_started'
    const history = data.history || []
    const lastEntry = history.length > 0 ? history[history.length - 1] : null
    const prefix = getRecordPrefix(stepLabel)
    let subRecords = []
    if (prefix) subRecords = getSubRecords(surrogateId, prefix)
    const activeRecords = subRecords.filter(r => !r.isExcluded)

    // Derive parent status from global subtasks + case-specific subtasks
    const globalSubs = subtasksByParent[stepId] || []
    const caseSubs = Object.entries(rt)
      .filter(([, v]) => v?._isCaseSubtask && !v?._deleted && v?._parentId === stepId)
      .map(([k, v]) => ({ id: k, label: v._label, parentId: v._parentId }))
    const allSubs = [...globalSubs, ...caseSubs]
    const status = allSubs.length > 0 ? (deriveParentStatus(allSubs, rt) || storedStatus) : storedStatus

    return { status, lastEntry, history, subRecords, activeRecords, isRecordType: !!prefix, doneCount: activeRecords.filter(r => r.isComplete).length, totalCount: activeRecords.length }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Surrogate Updates</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter surrogates</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {SCREENING_STAGES.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 px-6 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No surrogates in this stage</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[150px]">
                    Screening Step
                  </th>
                  {filtered.map(s => {
                    const ss = allStageStatuses[s.id] || {}
                    const stageLabel = SURROGATE_STAGES.find(st => st.id === ss.stage)?.label || ss.stage
                    return (
                      <th key={s.id} className="text-left px-3 py-2.5 min-w-[180px]">
                        <Link to={`/surrogates/${s.id}`} className="text-[#ed148c] hover:underline font-semibold text-xs">{s.name}</Link>
                        <p className="text-[9px] text-stone-400 font-normal">
                          {s.location ? `◎ ${s.location.split(', ').pop()}` : ''}
                          {s.age ? ` · ${s.age}y` : ''}
                        </p>
                        <AISummaryButton
                          caseId={s.id} caseName={s.name} caseType="surrogate"
                          stage={stageLabel} status={ss.status}
                          checklistSteps={sheetRows} tracking={allTracking[s.id]}
                        />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(row => (
                  <tr key={row.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 font-medium text-stone-700 sticky left-0 bg-white z-10">{row.label}</td>
                    {filtered.map(s => {
                      const { status, lastEntry, history, activeRecords, isRecordType, doneCount, totalCount } = getCellData(s.id, row.id, row.label)
                      const isLogOpen = logPopover?.surrogateId === s.id && logPopover?.stepId === row.id
                      const isDocOpen = docPopover?.surrogateId === s.id && docPopover?.stepId === row.id
                      const isComplete = status === 'complete'
                      const isNotNeeded = status === 'na' || status === 'deactivated'
                      return (
                        <td key={s.id} className={`px-3 py-2.5 relative ${isComplete ? 'bg-green-50/60' : isNotNeeded ? 'bg-stone-50/60' : ''}`}>
                          <div className="flex items-center gap-1.5">
                            {isComplete ? (
                              <span className="text-xs text-green-600 font-medium">Completed {lastEntry?.date ? formatDate(lastEntry.date) : ''}</span>
                            ) : isNotNeeded ? (
                              <span className="text-xs text-stone-400 italic">Not Needed</span>
                            ) : status === 'not_started' ? (
                              <span className="text-xs text-stone-300">Not Started</span>
                            ) : (
                              <span className={`text-xs ${status === 'in_progress' ? 'text-blue-600' : status === 'reviewing' ? 'text-purple-600' : status === 'requested' ? 'text-amber-600' : 'text-stone-600'} font-medium`}>
                                {lastEntry?.date ? formatDate(lastEntry.date) : ''}{' '}
                                <span className="font-medium">{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                              </span>
                            )}
                            {isRecordType && totalCount > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${doneCount === totalCount ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-500'}`}>{doneCount}/{totalCount}</span>
                            )}
                            {(history.length > 0 || (subtasksByParent[row.id] || []).length > 0 || Object.values(allTracking[s.id] || {}).some(v => v?._isCaseSubtask && !v?._deleted && v?._parentId === row.id)) && (
                              <button onClick={() => setLogPopover(isLogOpen ? null : { surrogateId: s.id, stepId: row.id })} className="text-stone-300 hover:text-[#283693] transition-colors" title="View checklist log">
                                <ScrollText className="size-3.5" />
                              </button>
                            )}
                            {isRecordType && totalCount > 0 && (
                              <button onClick={() => setDocPopover(isDocOpen ? null : { surrogateId: s.id, stepId: row.id })} className="text-stone-300 hover:text-stone-500 transition-colors" title="View medical records">
                                <ClipboardPlus className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Checklist log popover — shows parent step history + subtasks */}
                          {isLogOpen && (() => {
                            const rt = allTracking[s.id] || {}
                            const globalSubs = subtasksByParent[row.id] || []
                            const caseSubs = Object.entries(rt)
                              .filter(([, v]) => v?._isCaseSubtask && !v?._deleted && v?._parentId === row.id)
                              .map(([k, v]) => ({ id: k, label: v._label, parentId: v._parentId }))
                            const subs = [...globalSubs, ...caseSubs]
                            return (
                            <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-stone-200 p-3 space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase">Checklist Log</p>
                                <button onClick={() => setLogPopover(null)} className="text-stone-300 hover:text-stone-500"><X className="size-3" /></button>
                              </div>
                              {[...history].reverse().filter(e => !e.auto).map((entry, i) => (
                                <div key={i} className="text-xs border-b border-stone-50 pb-1 last:border-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium ${entry.status === 'complete' ? 'text-green-600' : entry.status === 'followed_up' ? 'text-blue-600' : entry.status === 'request_received' ? 'text-indigo-600' : entry.status === 'requested' ? 'text-amber-600' : 'text-stone-600'}`}>{entry.optionLabel || entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                    <span className="text-stone-400">{formatDate(entry.date)}</span>
                                  </div>
                                  {entry.note && <p className="text-stone-500 mt-0.5">{entry.note}</p>}
                                  {entry.by && <p className="text-stone-300 text-[10px]">— {entry.by}</p>}
                                </div>
                              ))}
                              {subs.length > 0 && (
                                <div className="border-t border-stone-100 mt-2 pt-2">
                                  <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1.5">Subtasks</p>
                                  {subs.map(sub => {
                                    const subData = rt[sub.id] || {}
                                    const subStatus = subData.status || 'not_started'
                                    const subHistory = (subData.history || []).filter(e => !e.auto)
                                    return (
                                      <div key={sub.id} className="mb-2 last:mb-0">
                                        <div className="flex items-center gap-2 text-xs">
                                          {subStatus === 'complete' || subStatus === 'na' ? (
                                            <CheckCircle2 className={`size-3.5 shrink-0 ${subStatus === 'complete' ? 'text-green-500' : 'text-stone-300'}`} />
                                          ) : (
                                            <Circle className={`size-3.5 shrink-0 ${subStatus === 'in_progress' ? 'text-blue-400' : subStatus === 'requested' ? 'text-amber-400' : 'text-stone-300'}`} />
                                          )}
                                          <span className={`flex-1 font-medium ${subStatus === 'complete' ? 'text-green-700' : subStatus === 'na' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{sub.label}</span>
                                          <span className={`text-[10px] font-medium whitespace-nowrap ${subStatus === 'complete' ? 'text-green-500' : subStatus === 'in_progress' ? 'text-blue-500' : subStatus === 'reviewing' ? 'text-purple-500' : subStatus === 'requested' ? 'text-amber-500' : subStatus === 'na' ? 'text-stone-400' : 'text-stone-300'}`}>
                                            {subData.optionLabel || (subStatus === 'not_started' ? '—' : subStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
                                          </span>
                                        </div>
                                        {subHistory.length > 0 && (
                                          <div className="ml-5.5 mt-1 space-y-0.5 border-l-2 border-stone-100 pl-2.5">
                                            {[...subHistory].reverse().map((entry, i) => (
                                              <div key={i} className="text-[11px]">
                                                <span className={`font-medium ${entry.status === 'complete' ? 'text-green-600' : entry.status === 'in_progress' ? 'text-blue-600' : entry.status === 'requested' ? 'text-amber-600' : 'text-stone-500'}`}>
                                                  {entry.optionLabel || entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                </span>
                                                <span className="text-stone-300 ml-1.5">{formatDate(entry.date)}</span>
                                                {entry.note && <span className="text-stone-400 ml-1">— {entry.note}</span>}
                                                {entry.by && <span className="text-stone-300 text-[9px] ml-1">({entry.by})</span>}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                            )
                          })()}
                          {/* Medical records popover — shows each sub-record with full log */}
                          {isDocOpen && (() => {
                            const rt = allTracking[s.id] || {}
                            return (
                              <div className="absolute z-20 top-full left-0 mt-1 w-96 max-h-[400px] overflow-y-auto bg-white rounded-xl shadow-xl border border-stone-200 p-3 space-y-3">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] font-semibold text-stone-400 uppercase">{row.label} ({doneCount}/{totalCount})</p>
                                  <button onClick={() => setDocPopover(null)} className="text-stone-300 hover:text-stone-500"><X className="size-3" /></button>
                                </div>
                                {activeRecords.map(rec => {
                                  const recData = rt[rec.id] || {}
                                  const recHistory = recData.history || []
                                  return (
                                    <div key={rec.id} className="border-b border-stone-100 pb-2 last:border-0">
                                      <div className="flex items-center gap-1.5 mb-1">
                                        {rec.badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rec.badge.color}`}>{rec.badge.label}</span>}
                                        <span className="font-semibold text-stone-700 text-xs flex-1">{rec.label}</span>
                                        <span className={`text-[10px] font-medium ${rec.isComplete ? 'text-green-600' : rec.status === 'not_started' ? 'text-stone-300' : 'text-amber-600'}`}>
                                          {rec.isComplete ? 'Complete' : rec.status === 'not_started' ? 'Not Started' : rec.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </span>
                                      </div>
                                      {recHistory.length > 0 ? (
                                        <div className="ml-7 space-y-1">
                                          {[...recHistory].reverse().map((entry, i) => (
                                            <div key={i} className="text-xs">
                                              <span className={`font-medium ${entry.status === 'complete' ? 'text-green-600' : entry.status === 'followed_up' ? 'text-blue-600' : entry.status === 'request_received' ? 'text-indigo-600' : entry.status === 'requested' ? 'text-amber-600' : 'text-stone-600'}`}>
                                                {entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                              </span>
                                              <span className="text-stone-400 ml-1.5">{formatDate(entry.date)}</span>
                                              {entry.note && <span className="text-stone-400 ml-1">— {entry.note}</span>}
                                              {entry.by && <span className="text-stone-300 text-[10px] ml-1">({entry.by})</span>}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-[10px] text-stone-300 ml-7">No logs yet</p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── IP Updates ──
function IPUpdatesSheet({ ips }) {
  const [stageFilter, setStageFilter] = useState('pre-qualification')
  const [logPopover, setLogPopover] = useState(null)
  const allIpSteps = useMemo(() => getAllChecklistSteps('ip').filter(s => s.stageId === stageFilter), [stageFilter])
  const sheetRows = useMemo(() => allIpSteps.filter(s => !s.parentId), [allIpSteps])
  const ipSubtasksByParent = useMemo(() => {
    const map = {}
    for (const s of allIpSteps) { if (s.parentId) { if (!map[s.parentId]) map[s.parentId] = []; map[s.parentId].push(s) } }
    return map
  }, [allIpSteps])

  const allStageStatuses = useMemo(() => {
    const map = {}
    for (const ip of ips) map[ip.id] = getSurrogateStageStatus(ip.id)
    return map
  }, [ips])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const stage of SURROGATE_STAGES) counts[stage.id] = 0
    for (const ip of ips) {
      const stageId = allStageStatuses[ip.id]?.stage || 'pre-qualification'
      if (counts[stageId] !== undefined) counts[stageId]++
    }
    return counts
  }, [ips, allStageStatuses])

  const filtered = useMemo(() => {
    return ips.filter(ip => (allStageStatuses[ip.id]?.stage || 'pre-qualification') === stageFilter)
  }, [ips, stageFilter, allStageStatuses])

  const [allTracking, setAllTracking] = useState({})
  useEffect(() => {
    const ids = filtered.map(ip => ip.id)
    if (ids.length === 0) { setAllTracking({}); return }
    getRecordTrackingBatch(ids).then(setAllTracking).catch(() => setAllTracking({}))
  }, [filtered])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Intended Parent Updates</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter intended parents</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {SCREENING_STAGES.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 px-6 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No intended parents in this stage</p>
        ) : sheetRows.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No checklist steps configured for this stage. Set them up in Settings → Checklists → Intended Parent (IP).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[120px]">
                    Checklist Step
                  </th>
                  {filtered.map(ip => {
                    const ss = allStageStatuses[ip.id] || {}
                    const stageLabel = SURROGATE_STAGES.find(st => st.id === ss.stage)?.label || ss.stage
                    return (
                      <th key={ip.id} className="text-left px-3 py-2.5 min-w-[130px]">
                        <Link to={`/intended-parents/${ip.id}`} className="text-[#283693] hover:underline font-semibold text-xs">{ip.names}</Link>
                        <p className="text-[9px] text-stone-400 font-normal">{ip.location || ''}</p>
                        <AISummaryButton
                          caseId={ip.id} caseName={ip.names} caseType="ip"
                          stage={stageLabel} status={ss.status}
                          checklistSteps={sheetRows} tracking={allTracking[ip.id]}
                        />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => (
                  <tr key={step.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 font-medium text-stone-700 sticky left-0 bg-white z-10">{step.label}</td>
                    {filtered.map(ip => {
                      const rt = allTracking[ip.id] || {}
                      const d = rt[step.id] || {}
                      const history = d.history || []
                      const globalSubs = ipSubtasksByParent[step.id] || []
                      const caseSubs = Object.entries(rt)
                        .filter(([, v]) => v?._isCaseSubtask && !v?._deleted && v?._parentId === step.id)
                        .map(([k, v]) => ({ id: k, label: v._label, parentId: v._parentId }))
                      const subs = [...globalSubs, ...caseSubs]
                      const hasChildren = subs.length > 0
                      const rawStatus = d.status || 'not_started'
                      const effectiveStatus = hasChildren ? (deriveParentStatus(subs, rt) || rawStatus) : rawStatus
                      const isComplete = effectiveStatus === 'complete' || effectiveStatus === 'na'
                      const isLogOpen = logPopover?.caseId === ip.id && logPopover?.stepId === step.id
                      return (
                        <td key={ip.id} className={`px-3 py-2.5 relative ${isComplete ? 'bg-green-50/60' : ''}`}>
                          <div className="space-y-1">
                            {history.length > 0 ? [...history].reverse().filter(e => !e.auto).map((entry, i) => (
                              <div key={i} className="text-xs">
                                <span className="text-stone-400">{formatDate(entry.date)}</span>{' '}
                                <span className={`font-medium ${effectiveStatus === 'complete' ? 'text-green-600' : effectiveStatus === 'in_progress' ? 'text-blue-600' : 'text-stone-600'}`}>{entry.optionLabel || effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                {entry.note && !entry.auto && <p className="text-[10px] text-stone-400 truncate max-w-[150px]">{entry.note}</p>}
                              </div>
                            )) : (
                              hasChildren ? (
                                <span className={`text-xs font-medium ${effectiveStatus === 'in_progress' ? 'text-blue-600' : effectiveStatus === 'complete' ? 'text-green-600' : 'text-stone-300'}`}>{effectiveStatus === 'not_started' ? 'Not Started' : effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                              ) : <span className="text-xs text-stone-300">Not Started</span>
                            )}
                            {(history.length > 0 || hasChildren) && (
                              <button onClick={() => setLogPopover(isLogOpen ? null : { caseId: ip.id, stepId: step.id })} className="text-stone-300 hover:text-[#283693] transition-colors" title="Full log">
                                <ScrollText className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {isLogOpen && <LogPopover history={history} onClose={() => setLogPopover(null)} subtasks={subs} tracking={rt} />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Journey Updates ──
function JourneyUpdatesSheet({ journeys, surrogates, ips }) {
  const [stageFilter, setStageFilter] = useState('journey-oversight')
  const [logPopover, setLogPopover] = useState(null)
  // Journey checklist steps are stored under 'gc' type with journey stage IDs
  const allJourneySteps = useMemo(() => getAllChecklistSteps('gc').filter(s => s.stageId === stageFilter), [stageFilter])
  const sheetRows = useMemo(() => allJourneySteps.filter(s => !s.parentId), [allJourneySteps])
  const journeySubtasksByParent = useMemo(() => {
    const map = {}
    for (const s of allJourneySteps) { if (s.parentId) { if (!map[s.parentId]) map[s.parentId] = []; map[s.parentId].push(s) } }
    return map
  }, [allJourneySteps])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const id of JOURNEY_STAGE_IDS) counts[id] = 0
    for (const j of journeys) { if (counts[j.stage] !== undefined) counts[j.stage]++ }
    return counts
  }, [journeys])

  const filtered = useMemo(() => {
    return journeys.filter(j => j.stage === stageFilter)
  }, [journeys, stageFilter])

  // Load checklist tracking from journey_data for each journey
  const allTracking = useMemo(() => {
    const map = {}
    for (const j of filtered) {
      map[j.id] = j.journey_data?._checklistTracking || {}
    }
    return map
  }, [filtered])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Matched Journey Updates</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter journeys</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {JOURNEY_STAGE_IDS.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 px-6 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No journeys in this stage</p>
        ) : sheetRows.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No checklist steps configured for this stage. Set them up in Settings → Checklists → Matched Journeys.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[150px]">
                    Checklist Step
                  </th>
                  {filtered.map(j => {
                    const ip = ips.find(i => i.id === j.ip_case_id)
                    const gc = surrogates.find(s => s.id === j.gc_case_id)
                    const journeyName = `${ip?.names || 'IP'} + ${gc?.name || 'GC'}`
                    const jd = j.journey_data || {}
                    const gestAge = calcGestationalAge(jd.dueDate)
                    const isPregnant = jd.pregnant === 'yes'
                    return (
                      <th key={j.id} className="text-left px-3 py-2.5 min-w-[180px]">
                        <Link to={`/journeys/${j.id}`} className="hover:opacity-80 block text-center">
                          <p className="text-xs font-semibold text-[#283693]">{ip?.names || 'IP'}</p>
                          <p className="text-[10px] text-stone-800 font-normal leading-tight">+</p>
                          <p className="text-xs font-semibold text-[#ed148c]">{gc?.name || 'GC'}</p>
                        </Link>
                        <p className="text-[9px] text-stone-400 font-normal mt-1 text-center">{j.status || ''}</p>
                        {jd.delivered ? (
                          <div className="text-center mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <img src={jd.babySexes?.[0] === 'girl' ? '/baby-girl.png' : '/baby-boy.png'} alt="" className="size-3.5 object-contain" />
                              Born {jd.deliveryDate ? formatDate(jd.deliveryDate) : ''}
                            </span>
                            {jd.babyNames?.some(n => n) && (
                              <p className="text-[9px] text-amber-600 mt-0.5">
                                {jd.babyNames.map((name, i) => {
                                  const sex = jd.babySexes?.[i]
                                  const emoji = sex === 'girl' ? '👧' : sex === 'boy' ? '👦' : '👶'
                                  return name ? `${emoji} ${name}` : null
                                }).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        ) : isPregnant && gestAge ? (
                          <div className="text-center mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded-full px-2 py-0.5">
                              🤰 {gestAge}
                            </span>
                            {jd.dueDate && <p className="text-[9px] text-stone-400 mt-0.5">Due {formatDate(jd.dueDate)}</p>}
                            {jd.babyNames?.some(n => n) && (
                              <p className="text-[9px] text-pink-500 mt-0.5">
                                {jd.babyNames.map((name, i) => {
                                  const sex = jd.babySexes?.[i]
                                  const emoji = sex === 'girl' ? '👧' : sex === 'boy' ? '👦' : '👶'
                                  return name ? `${emoji} ${name}` : null
                                }).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        ) : null}
                        <div className="text-center mt-0.5">
                          <AISummaryButton
                            caseId={j.id} caseName={journeyName} caseType="journey"
                            stage={j.stage} status={j.status}
                            checklistSteps={sheetRows} tracking={allTracking[j.id]}
                            journeyData={j.journey_data}
                          />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => (
                  <tr key={step.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 font-medium text-stone-700 sticky left-0 bg-white z-10">{step.label}</td>
                    {filtered.map(j => {
                      const rt = allTracking[j.id] || {}
                      const d = rt[step.id] || {}
                      const history = d.history || []
                      const globalSubs = journeySubtasksByParent[step.id] || []
                      const caseSubs = Object.entries(rt)
                        .filter(([, v]) => v?._isCaseSubtask && !v?._deleted && v?._parentId === step.id)
                        .map(([k, v]) => ({ id: k, label: v._label, parentId: v._parentId }))
                      const subs = [...globalSubs, ...caseSubs]
                      const hasChildren = subs.length > 0
                      const rawStatus = d.status || 'not_started'
                      const effectiveStatus = hasChildren ? (deriveParentStatus(subs, rt) || rawStatus) : rawStatus
                      const isComplete = effectiveStatus === 'complete' || effectiveStatus === 'na'
                      const isLogOpen = logPopover?.caseId === j.id && logPopover?.stepId === step.id
                      return (
                        <td key={j.id} className={`px-3 py-2.5 relative ${isComplete ? 'bg-green-50/60' : ''}`}>
                          <div className="space-y-1">
                            {history.length > 0 ? [...history].reverse().filter(e => !e.auto).map((entry, i) => (
                              <div key={i} className="text-xs">
                                <span className="text-stone-400">{formatDate(entry.date)}</span>{' '}
                                <span className={`font-medium ${effectiveStatus === 'complete' ? 'text-green-600' : effectiveStatus === 'in_progress' ? 'text-blue-600' : 'text-stone-600'}`}>{entry.optionLabel || effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                {entry.note && !entry.auto && <p className="text-[10px] text-stone-400 truncate max-w-[150px]">{entry.note}</p>}
                              </div>
                            )) : (
                              hasChildren ? (
                                <span className={`text-xs font-medium ${effectiveStatus === 'in_progress' ? 'text-blue-600' : effectiveStatus === 'complete' ? 'text-green-600' : 'text-stone-300'}`}>{effectiveStatus === 'not_started' ? 'Not Started' : effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                              ) : <span className="text-xs text-stone-300">Not Started</span>
                            )}
                            {(history.length > 0 || hasChildren) && (
                              <button onClick={() => setLogPopover(isLogOpen ? null : { caseId: j.id, stepId: step.id })} className="text-stone-300 hover:text-[#283693] transition-colors" title="Full log">
                                <ScrollText className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {isLogOpen && <LogPopover history={history} onClose={() => setLogPopover(null)} subtasks={subs} tracking={rt} />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Shared Components ──
function CellStatus({ status, lastEntry }) {
  if (status === 'complete') {
    return <span className="text-xs text-green-600 font-medium">Done {lastEntry?.date ? formatDate(lastEntry.date) : ''}</span>
  }
  if (status === 'na' || status === 'deactivated') {
    return <span className="text-xs text-stone-400 italic">Not Needed</span>
  }
  if (status === 'not_started') return <span className="text-xs text-stone-300">Not Started</span>
  return (
    <span className="text-xs text-stone-600">
      {lastEntry?.date ? formatDate(lastEntry.date) : ''}{' '}
      <span className="font-medium">{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
    </span>
  )
}

function LogPopover({ history, onClose, subtasks = [], tracking = {} }) {
  const manualHistory = [...history].reverse().filter(e => !e.auto)
  return (
    <div className="absolute z-20 top-full left-0 mt-1 w-80 max-h-[450px] overflow-y-auto bg-white rounded-xl shadow-xl border border-stone-200 p-3 space-y-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-stone-400 uppercase">Full Log History</p>
        <button onClick={onClose} className="text-stone-300 hover:text-stone-500"><X className="size-3" /></button>
      </div>
      {manualHistory.length > 0 ? manualHistory.map((entry, i) => (
        <div key={i} className="text-xs border-b border-stone-50 pb-1 last:border-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-600">{entry.optionLabel || entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            <span className="text-stone-400">{formatDate(entry.date)}</span>
          </div>
          {entry.note && <p className="text-stone-500 mt-0.5">{entry.note}</p>}
          {entry.by && <p className="text-stone-300 text-[10px]">— {entry.by}</p>}
        </div>
      )) : subtasks.length === 0 ? (
        <p className="text-xs text-stone-300 py-1">No log entries</p>
      ) : null}
      {subtasks.length > 0 && (
        <div className="border-t border-stone-100 mt-2 pt-2">
          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1.5">Subtasks</p>
          {subtasks.map(sub => {
            const subData = tracking[sub.id] || {}
            const subStatus = subData.status || 'not_started'
            const subHistory = (subData.history || []).filter(e => !e.auto)
            return (
              <div key={sub.id} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2 text-xs">
                  {subStatus === 'complete' || subStatus === 'na' ? (
                    <CheckCircle2 className={`size-3.5 shrink-0 ${subStatus === 'complete' ? 'text-green-500' : 'text-stone-300'}`} />
                  ) : (
                    <Circle className={`size-3.5 shrink-0 ${subStatus === 'in_progress' ? 'text-blue-400' : subStatus === 'requested' ? 'text-amber-400' : 'text-stone-300'}`} />
                  )}
                  <span className={`flex-1 font-medium ${subStatus === 'complete' ? 'text-green-700' : subStatus === 'na' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{sub.label}</span>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${subStatus === 'complete' ? 'text-green-500' : subStatus === 'in_progress' ? 'text-blue-500' : subStatus === 'reviewing' ? 'text-purple-500' : subStatus === 'requested' ? 'text-amber-500' : subStatus === 'na' ? 'text-stone-400' : 'text-stone-300'}`}>
                    {subData.optionLabel || (subStatus === 'not_started' ? '—' : subStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
                  </span>
                </div>
                {subHistory.length > 0 && (
                  <div className="ml-5.5 mt-1 space-y-0.5 border-l-2 border-stone-100 pl-2.5">
                    {[...subHistory].reverse().map((entry, i) => (
                      <div key={i} className="text-[11px]">
                        <span className={`font-medium ${entry.status === 'complete' ? 'text-green-600' : entry.status === 'in_progress' ? 'text-blue-600' : entry.status === 'requested' ? 'text-amber-600' : 'text-stone-500'}`}>
                          {entry.optionLabel || entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="text-stone-300 ml-1.5">{formatDate(entry.date)}</span>
                        {entry.note && <span className="text-stone-400 ml-1">— {entry.note}</span>}
                        {entry.by && <span className="text-stone-300 text-[9px] ml-1">({entry.by})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
