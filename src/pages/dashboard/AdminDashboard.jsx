import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import { useAdminNotes } from '@/context/AdminNotesContext'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchSurrogatesFromIntake, fetchSurrogateProfilesByEmails, getRecordTrackingBatch } from '@/lib/db'
import { matchPipelineCounts } from '@/data/mock/matches'
import { MATCH_STAGES, SURROGATE_STAGES } from '@/lib/constants'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getAllChecklistSteps } from '@/lib/checklistStore'
import { Heart, HeartHandshake, Puzzle, Route, Users, GitMerge, FileText, Plus, ArrowRight, Calendar, Clock, Megaphone, X, ScrollText, FileWarning, CheckCircle2, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/lib/utils'

const recentActivity = []
const upcomingMilestones = []

const SCREENING_STAGES = ['pre-qualification', 'screening', 'matching']

function SurrogateScreeningSheet({ surrogates }) {
  const [stageFilter, setStageFilter] = useState('pre-qualification')
  // Get checklist steps for the current stage filter
  const sheetRows = useMemo(() => getAllChecklistSteps('gc').filter(s => s.stageId === stageFilter), [stageFilter])
  const [logPopover, setLogPopover] = useState(null) // { surrogateId, stepId }
  const [docPopover, setDocPopover] = useState(null) // { surrogateId, stepId }

  // Get stage/status for each surrogate
  const allStageStatuses = useMemo(() => {
    const map = {}
    for (const s of surrogates) map[s.id] = getSurrogateStageStatus(s.id)
    return map
  }, [surrogates])

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts = {}
    for (const stage of SURROGATE_STAGES) counts[stage.id] = 0
    for (const s of surrogates) {
      const stageId = allStageStatuses[s.id]?.stage || 'pre-qualification'
      if (counts[stageId] !== undefined) counts[stageId]++
    }
    return counts
  }, [surrogates, allStageStatuses])

  // Filter surrogates by stage
  const filtered = useMemo(() => {
    return surrogates.filter(s => (allStageStatuses[s.id]?.stage || 'pre-qualification') === stageFilter)
  }, [surrogates, stageFilter, allStageStatuses])

  // Load record tracking from Supabase for each surrogate
  const [allTracking, setAllTracking] = useState({})
  useEffect(() => {
    const ids = filtered.map(s => s.id)
    if (ids.length === 0) { setAllTracking({}); return }
    getRecordTrackingBatch(ids).then(setAllTracking).catch(() => setAllTracking({}))
  }, [filtered])

  // Load profile data (pregnancy history) for filtered surrogates
  const [allProfiles, setAllProfiles] = useState({})
  useEffect(() => {
    const emails = filtered.map(s => s.email).filter(Boolean)
    if (emails.length === 0) { setAllProfiles({}); return }
    fetchSurrogateProfilesByEmails(emails).then(map => {
      // Re-key by surrogate id (match email from filtered list)
      const byId = {}
      for (const s of filtered) {
        if (s.email && map[s.email.trim().toLowerCase()]) {
          byId[s.id] = map[s.email.trim().toLowerCase()]
        }
      }
      setAllProfiles(byId)
    }).catch(() => {})
  }, [filtered])

  // Build expected medical records from pregnancy data (same logic as Medical Records tab)
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
      if (p.wasSurrogacy === 'yes') {
        steps.push({ id: `ivf_records_${i}`, label: `IVF ${yearLabel}`, badge: { label: 'IVF', color: 'bg-pink-100 text-pink-700' } })
      }
    }
    // Also include custom-added records from tracking
    const rt = allTracking[surrogateId] || {}
    for (const key of Object.keys(rt)) {
      if (key.startsWith('custom_record_') && !steps.some(s => s.id === key)) {
        const d = rt[key]
        const badgeType = d.recordType || 'OB'
        const BADGE_MAP = {
          'OB': { label: 'OB', color: 'bg-blue-100 text-blue-700' },
          'Delivery': { label: 'Delivery', color: 'bg-purple-100 text-purple-700' },
          'IVF': { label: 'IVF', color: 'bg-pink-100 text-pink-700' },
          'PAP': { label: 'PAP', color: 'bg-amber-100 text-amber-700' },
        }
        steps.push({ id: key, label: d.customLabel || key, badge: BADGE_MAP[badgeType] || BADGE_MAP['OB'] })
      }
    }
    return steps
  }

  // Get pending medical records for a surrogate (for document icon tooltip)
  function getPendingRecords(surrogateId) {
    const expected = buildExpectedRecords(surrogateId)
    const rt = allTracking[surrogateId] || {}
    const pending = []
    for (const step of expected) {
      const d = rt[step.id] || {}
      const status = d.status || 'not_started'
      if (status !== 'complete' && status !== 'na') {
        const lastEntry = d.history?.[d.history.length - 1]
        pending.push({ id: step.id, label: d.customLabel || step.label, status, lastDate: lastEntry?.date, lastNote: lastEntry?.note })
      }
    }
    return pending
  }

  // Map step labels to medical record prefixes
  const RECORD_PREFIXES = {
    'ob records': 'ob_records_',
    'delivery records': 'delivery_records_',
    'ivf records': 'ivf_records_',
  }

  function getRecordPrefix(stepLabel) {
    const lower = (stepLabel || '').toLowerCase()
    for (const [key, prefix] of Object.entries(RECORD_PREFIXES)) {
      if (lower.includes(key)) return prefix
    }
    return null
  }

  function getRecordTypeBadge(key) {
    if (key.startsWith('ob_records_')) return { label: 'OB', color: 'bg-blue-100 text-blue-700' }
    if (key.startsWith('delivery_records_')) return { label: 'Delivery', color: 'bg-purple-100 text-purple-700' }
    if (key.startsWith('ivf_records_')) return { label: 'IVF', color: 'bg-pink-100 text-pink-700' }
    return null
  }

  function getSubRecords(surrogateId, prefix) {
    // Build from pregnancy data so all records appear with correct labels
    const expected = buildExpectedRecords(surrogateId)
    const rt = allTracking[surrogateId] || {}
    const records = []
    // Add expected records that match the prefix
    for (const step of expected) {
      if (step.id.startsWith(prefix)) {
        const d = rt[step.id] || {}
        const lastEntry = d.history?.length > 0 ? d.history[d.history.length - 1] : null
        records.push({
          id: step.id,
          label: d.customLabel || step.label,
          badge: step.badge,
          status: d.status || 'not_started',
          lastDate: lastEntry?.date,
          lastNote: lastEntry?.note,
          lastBy: lastEntry?.by,
          isComplete: d.status === 'complete',
          isExcluded: d.status === 'na',
        })
      }
    }
    // Also pick up any tracking entries not in expected (custom records, legacy entries)
    for (const key of Object.keys(rt)) {
      if (key.startsWith(prefix) && !records.some(r => r.id === key)) {
        // Skip legacy timestamp-keyed records (real custom records use custom_record_ prefix)
        const idx = key.match(/\d+$/)?.[0]
        if (idx && idx.length > 4 && !rt[key]?.customLabel) continue
        const d = rt[key]
        const lastEntry = d.history?.length > 0 ? d.history[d.history.length - 1] : null
        const badge = getRecordTypeBadge(key)
        records.push({
          id: key,
          label: d.customLabel || badge?.label || key,
          badge,
          status: d.status || 'not_started',
          lastDate: lastEntry?.date,
          lastNote: lastEntry?.note,
          lastBy: lastEntry?.by,
          isComplete: d.status === 'complete',
          isExcluded: d.status === 'na',
        })
      }
    }
    return records
  }

  function getCellData(surrogateId, stepId, stepLabel) {
    const rt = allTracking[surrogateId] || {}
    const data = rt[stepId] || {}
    const status = data.status || 'not_started'
    const history = data.history || []
    const lastEntry = history.length > 0 ? history[history.length - 1] : null
    const isComplete = status === 'complete' || status === 'na'
    const prefix = getRecordPrefix(stepLabel)
    let subRecords = []
    let hasIncompleteRecords = false
    if (prefix) {
      subRecords = getSubRecords(surrogateId, prefix)
      hasIncompleteRecords = subRecords.some(r => !r.isComplete && r.status !== 'not_started')
    }
    return { status, lastEntry, isComplete, history, hasIncompleteRecords, subRecords, isRecordType: !!prefix }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Surrogate Screening Overview</CardTitle>
        <CardDescription>Click a stage to filter surrogates</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Stage filter buttons */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {SURROGATE_STAGES.filter(s => SCREENING_STAGES.includes(s.id)).map(stage => (
              <button
                key={stage.id}
                onClick={() => setStageFilter(stage.id)}
                className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${stageFilter === stage.id ? 'ring-2 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ backgroundColor: stage.color + '08', ...(stageFilter === stage.id ? { ringColor: stage.color, borderColor: stage.color + '50' } : {}) }}
              >
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stage.id]}</p>
                <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{stage.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Spreadsheet table */}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-stone-400 border-t border-stone-200">No surrogates in this stage</div>
        ) : (
        <div className="overflow-x-auto border-t border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[200px]">Screening Step</th>
                {filtered.map(s => (
                  <th key={s.id} className="text-left px-4 py-3.5 min-w-[210px] align-top">
                    <Link to={`/surrogates/${s.id}`} className="text-sm font-semibold text-[#283693] hover:underline">{s.name}</Link>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {s.location && (
                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                          <svg className="size-3 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                          {s.location}
                        </span>
                      )}
                      {s.age && <span className="text-xs text-stone-400">· {s.age}y</span>}
                      {s.referralPartner && <img src="/be-logo.png" alt="BE" className="h-4 w-auto ml-0.5" title="Be Surrogacy Referral" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetRows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-stone-700 sticky left-0 bg-white z-10">{row.label}</td>
                  {filtered.map(s => {
                    const { status, lastEntry, isComplete, history, hasIncompleteRecords, subRecords, isRecordType } = getCellData(s.id, row.id, row.label)
                    const isLogOpen = logPopover?.surrogateId === s.id && logPopover?.stepId === row.id
                    const isDocOpen = docPopover?.surrogateId === s.id && docPopover?.stepId === row.id
                    const activeRecords = subRecords.filter(r => !r.isExcluded)
                    const doneCount = activeRecords.filter(r => r.isComplete).length
                    const totalCount = activeRecords.length
                    return (
                      <td key={s.id} className={`px-4 py-3.5 relative ${isComplete ? 'bg-green-50/60' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {isComplete ? (
                            <span className="text-xs text-green-600 font-medium">
                              Completed {formatDate(lastEntry?.date)}
                            </span>
                          ) : status === 'not_started' ? (
                            <span className="text-xs text-stone-300">Not Started</span>
                          ) : (
                            <span className="text-xs text-stone-600">
                              {formatDate(lastEntry?.date)} <span className="font-medium">{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                            </span>
                          )}
                          {/* Record count badge for record-type steps */}
                          {isRecordType && totalCount > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${doneCount === totalCount ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-500'}`}>
                              {doneCount}/{totalCount}
                            </span>
                          )}
                          {/* Log icon */}
                          {history.length > 0 && (
                            <button onClick={() => setLogPopover(isLogOpen ? null : { surrogateId: s.id, stepId: row.id })} className="text-stone-300 hover:text-[#283693] transition-colors">
                              <ScrollText className="size-3.5" />
                            </button>
                          )}
                          {/* Records detail icon — show for record-type steps with sub-records */}
                          {isRecordType && totalCount > 0 && (
                            <button onClick={() => setDocPopover(isDocOpen ? null : { surrogateId: s.id, stepId: row.id })} className={`transition-colors ${hasIncompleteRecords ? 'text-amber-400 hover:text-amber-600' : 'text-stone-300 hover:text-stone-500'}`}>
                              <FileText className="size-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Log tooltip */}
                        {isLogOpen && (
                          <div className="absolute z-20 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-stone-200 p-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-semibold text-stone-400 uppercase">Log History</p>
                              <button onClick={() => setLogPopover(null)} className="text-stone-300 hover:text-stone-500"><X className="size-3" /></button>
                            </div>
                            {history.map((entry, i) => (
                              <div key={i} className="text-xs border-b border-stone-50 pb-1 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-stone-600">{entry.status === 'followed_up' ? 'Followed Up' : entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                  <span className="text-stone-400">{formatDate(entry.date)}</span>
                                </div>
                                {entry.note && <p className="text-stone-500 mt-0.5">{entry.note}</p>}
                                {entry.by && <p className="text-stone-300 text-[10px]">— {entry.by}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Sub-records detail tooltip */}
                        {isDocOpen && (
                          <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-stone-200 p-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-semibold text-stone-400 uppercase">{row.label} ({doneCount}/{totalCount} complete)</p>
                              <button onClick={() => setDocPopover(null)} className="text-stone-300 hover:text-stone-500"><X className="size-3" /></button>
                            </div>
                            {activeRecords.map(rec => (
                              <div key={rec.id} className={`text-xs border-b border-stone-50 pb-1.5 last:border-0 ${rec.isComplete ? 'opacity-60' : ''}`}>
                                <div className="flex items-center gap-1.5">
                                  {rec.badge && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rec.badge.color}`}>{rec.badge.label}</span>
                                  )}
                                  <span className="font-medium text-stone-600 flex-1">{rec.label}</span>
                                  <span className={`font-medium shrink-0 ${rec.isComplete ? 'text-green-600' : rec.status === 'not_started' ? 'text-stone-300' : 'text-amber-600'}`}>
                                    {rec.isComplete ? 'Complete' : rec.status === 'not_started' ? 'Not Started' : rec.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                  </span>
                                </div>
                                {rec.lastDate && !rec.isExcluded && (
                                  <p className="text-stone-400 mt-0.5 ml-7">
                                    {formatDate(rec.lastDate)}
                                    {rec.lastNote ? ` — ${rec.lastNote}` : ''}
                                  </p>
                                )}
                              </div>
                            ))}
                            {totalCount === 0 && <p className="text-xs text-stone-400">No individual records tracked yet</p>}
                          </div>
                        )}
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

export default function AdminDashboard() {
  const { currentUser } = useRole()
  const { getActiveNotes, dismissNote } = useAdminNotes()
  const [surrogateCount, setSurrogateCount] = useState(0)
  const [surrogates, setSurrogates] = useState([])
  const [dashView, setDashView] = useState('home') // 'home' | 'surrogates'

  useEffect(() => {
    fetchSurrogatesFromIntake().then(data => {
      setSurrogateCount(data.length)
      setSurrogates(data)
    }).catch(() => {})
  }, [])

  const visibleNotes = getActiveNotes().filter(
    (n) => !n.dismissals?.some((d) => d.user_id === currentUser?.id)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Here's what's happening at ABC Surrogacy today"
        actions={
          <Button asChild>
            <Link to="/forms"><Plus className="size-4" /> New Form</Link>
          </Button>
        }
      />

      {/* Admin Notes */}
      {visibleNotes.map((note) => (
        <div key={note.id} className="flex items-start gap-3 bg-abc-indigo/10 border border-abc-indigo/30 rounded-lg px-4 py-3">
          <Megaphone className="size-5 text-abc-indigo shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {note.title && <p className="font-semibold text-sm">{note.title}</p>}
            <p className="text-sm text-muted-foreground">{note.message}</p>
          </div>
          <button
            onClick={() => dismissNote(note.id, currentUser?.id)}
            className="p-1 rounded hover:bg-abc-indigo/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}

      {/* Stat Cards — clickable to switch views */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {dashView !== 'home' && (
          <button onClick={() => setDashView('home')} className="text-left">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <svg className="size-10 text-[#283693]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span className="text-sm font-bold text-[#283693] uppercase tracking-wider">Home</span>
              </CardContent>
            </Card>
          </button>
        )}
        <button onClick={() => { if (dashView !== 'surrogates') setDashView('surrogates') }} className="text-left">
          <Card className={`h-full transition-all ${dashView === 'surrogates' ? 'ring-2 ring-[#283693] shadow-md' : 'hover:shadow-sm'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="text-sm font-medium text-muted-foreground">Surrogates</p>
              <Heart className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold">{surrogateCount}</div>
              <p className="text-xs text-muted-foreground mt-1">In program</p>
            </CardContent>
          </Card>
        </button>
        <StatCard title="Intended Parents" value={0} icon={HeartHandshake} description="In program" />
        <StatCard title="Matches in Progress" value={0} icon={Puzzle} description="Across all stages" />
        <StatCard title="Matched Journeys" value={0} icon={Route} description="Active journeys" />
      </div>

      {dashView === 'surrogates' ? (
        /* Surrogate Screening Sheet */
        surrogates.length > 0 && <SurrogateScreeningSheet surrogates={surrogates} />
      ) : (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Match Pipeline</CardTitle>
            <CardDescription>Current distribution across journey stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MATCH_STAGES.map(stage => {
                const count = matchPipelineCounts[stage] || 0
                const maxCount = Math.max(...Object.values(matchPipelineCounts), 1)
                const width = (count / maxCount) * 100
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-36 shrink-0 truncate">{stage}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      {count > 0 && (
                        <div
                          className="h-full bg-abc-indigo/80 rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max(width, 12)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Milestones */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming milestones</p>
            ) : (
              <div className="space-y-3">
                {upcomingMilestones.map(milestone => (
                  <div key={milestone.id} className="flex items-start gap-3">
                    <div className={`size-2 rounded-full mt-2 shrink-0 ${milestone.urgency === 'high' ? 'bg-abc-coral' : 'bg-abc-indigo'}`} />
                    <div>
                      <p className="text-sm">{milestone.text}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3" />
                        {milestone.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="size-2 rounded-full mt-2 bg-abc-indigo/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.text}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/forms">
                  <FileText className="size-4" /> Review Applications
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/matching">
                  <Puzzle className="size-4" /> Match Queue
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/surrogates">
                  <Heart className="size-4" /> View Surrogates
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/calendar">
                  <Calendar className="size-4" /> Calendar
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  )
}
