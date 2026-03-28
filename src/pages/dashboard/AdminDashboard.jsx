import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import { useAdminNotes } from '@/context/AdminNotesContext'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchSurrogatesFromIntake } from '@/lib/db'
import { matchPipelineCounts } from '@/data/mock/matches'
import { MATCH_STAGES, SURROGATE_STAGES } from '@/lib/constants'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { Heart, Users, GitMerge, FileText, Plus, ArrowRight, Calendar, Clock, Megaphone, X, ScrollText, FileWarning, CheckCircle2, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'

const recentActivity = []
const upcomingMilestones = []

const SCREENING_SHEET_ROWS = [
  { id: '_ob_summary', label: 'OB Records' },
  { id: '_del_summary', label: 'Delivery Records' },
  { id: '_ivf_summary', label: 'IVF Records' },
  { id: 'pap', label: 'PAP' },
  { id: 'ob_clearance', label: 'OB Clearance Letter' },
  { id: 'records_reviewed', label: 'Records Reviewed' },
  { id: 'background_check', label: 'Background Check' },
  { id: 'psych_screening', label: 'Psych Screening' },
  { id: 'mitera', label: 'Mitera' },
  { id: 'insurance', label: 'Insurance' },
]

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`
}

function SurrogateScreeningSheet({ surrogates }) {
  const [stageFilter, setStageFilter] = useState('all')
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
    if (stageFilter === 'all') return surrogates
    return surrogates.filter(s => (allStageStatuses[s.id]?.stage || 'pre-qualification') === stageFilter)
  }, [surrogates, stageFilter, allStageStatuses])

  // Load record tracking for each surrogate
  const allTracking = useMemo(() => {
    const map = {}
    for (const s of filtered) {
      try {
        const d = localStorage.getItem(`abc_records_${s.id}`)
        map[s.id] = d ? JSON.parse(d) : {}
      } catch { map[s.id] = {} }
    }
    return map
  }, [filtered])

  // Get pending medical records for a surrogate (for document icon tooltip)
  function getPendingRecords(surrogateId) {
    const rt = allTracking[surrogateId] || {}
    const pending = []
    // Check all ob/delivery/ivf records in localStorage
    for (const key of Object.keys(rt)) {
      if ((key.startsWith('ob_records_') || key.startsWith('delivery_records_') || key.startsWith('ivf_records_')) && rt[key]?.status && rt[key].status !== 'complete') {
        const lastEntry = rt[key].history?.[rt[key].history.length - 1]
        pending.push({ id: key, label: key.replace(/_/g, ' ').replace(/\d+$/, '').trim(), status: rt[key].status, lastDate: lastEntry?.date, lastNote: lastEntry?.note })
      }
    }
    return pending
  }

  function getCellData(surrogateId, stepId) {
    const rt = allTracking[surrogateId] || {}
    const data = rt[stepId] || {}
    const status = data.status || 'not_started'
    const history = data.history || []
    const lastEntry = history.length > 0 ? history[history.length - 1] : null
    const isComplete = status === 'complete' || status === 'na'
    const isRecordStep = stepId.startsWith('_')
    // For summary rows, check if any underlying records are incomplete
    let hasIncompleteRecords = false
    if (isRecordStep) {
      const prefix = stepId === '_ob_summary' ? 'ob_records_' : stepId === '_del_summary' ? 'delivery_records_' : 'ivf_records_'
      for (const key of Object.keys(rt)) {
        if (key.startsWith(prefix) && rt[key]?.status && rt[key].status !== 'complete' && rt[key].status !== 'not_started') {
          hasIncompleteRecords = true
          break
        }
      }
    }
    return { status, lastEntry, isComplete, history, hasIncompleteRecords }
  }

  if (filtered.length === 0) return null

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Surrogate Screening Overview</CardTitle>
        <CardDescription>Click a stage to filter surrogates</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Stage filter tiles */}
        <div className="px-6 pb-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setStageFilter('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${stageFilter === 'all' ? 'bg-[#283693] text-white border-[#283693]' : 'text-stone-500 border-stone-200 hover:border-stone-300'}`}>
              All ({surrogates.length})
            </button>
            {SURROGATE_STAGES.map(stage => (
              <button key={stage.id} onClick={() => setStageFilter(stageFilter === stage.id ? 'all' : stage.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${stageFilter === stage.id ? 'text-white border-transparent' : 'text-stone-500 border-stone-200 hover:border-stone-300'}`}
                style={stageFilter === stage.id ? { backgroundColor: stage.color, borderColor: stage.color } : {}}>
                {stage.label} ({stageCounts[stage.id]})
              </button>
            ))}
          </div>
        </div>

        {/* Spreadsheet table */}
        <div className="overflow-x-auto border-t border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[180px]">Screening Step</th>
                {filtered.map(s => (
                  <th key={s.id} className="text-left px-3 py-2.5 min-w-[200px]">
                    <Link to={`/surrogates/${s.id}`} className="text-xs font-semibold text-[#283693] hover:underline">{s.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCREENING_SHEET_ROWS.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-700 sticky left-0 bg-white z-10">{row.label}</td>
                  {filtered.map(s => {
                    const { status, lastEntry, isComplete, history, hasIncompleteRecords } = getCellData(s.id, row.id)
                    const isLogOpen = logPopover?.surrogateId === s.id && logPopover?.stepId === row.id
                    const isDocOpen = docPopover?.surrogateId === s.id && docPopover?.stepId === row.id
                    return (
                      <td key={s.id} className={`px-3 py-3 relative ${isComplete ? 'bg-green-50/60' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {isComplete ? (
                            <span className="text-xs text-green-600 font-medium">
                              Completed {formatDateShort(lastEntry?.date)}
                            </span>
                          ) : status === 'not_started' ? (
                            <span className="text-xs text-stone-300">Not Started</span>
                          ) : (
                            <span className="text-xs text-stone-600">
                              {formatDateShort(lastEntry?.date)} <span className="font-medium">{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                            </span>
                          )}
                          {/* Log icon */}
                          {history.length > 0 && (
                            <button onClick={() => setLogPopover(isLogOpen ? null : { surrogateId: s.id, stepId: row.id })} className="text-stone-300 hover:text-[#283693] transition-colors">
                              <ScrollText className="size-3.5" />
                            </button>
                          )}
                          {/* Document icon — show when records are in progress but not complete */}
                          {hasIncompleteRecords && (
                            <button onClick={() => setDocPopover(isDocOpen ? null : { surrogateId: s.id, stepId: row.id })} className="text-amber-400 hover:text-amber-600 transition-colors">
                              <FileWarning className="size-3.5" />
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
                                  <span className="text-stone-400">{formatDateShort(entry.date)}</span>
                                </div>
                                {entry.note && <p className="text-stone-500 mt-0.5">{entry.note}</p>}
                                {entry.by && <p className="text-stone-300 text-[10px]">— {entry.by}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Document tooltip */}
                        {isDocOpen && (
                          <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-stone-200 p-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-semibold text-stone-400 uppercase">Pending Records</p>
                              <button onClick={() => setDocPopover(null)} className="text-stone-300 hover:text-stone-500"><X className="size-3" /></button>
                            </div>
                            {getPendingRecords(s.id).map(rec => (
                              <div key={rec.id} className="text-xs border-b border-stone-50 pb-1 last:border-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-stone-600 capitalize">{rec.label}</span>
                                  <span className="text-stone-400">{rec.status?.replace(/_/g, ' ')}</span>
                                </div>
                                {rec.lastDate && <p className="text-stone-400 mt-0.5">{formatDateShort(rec.lastDate)}{rec.lastNote ? ` — ${rec.lastNote}` : ''}</p>}
                              </div>
                            ))}
                            {getPendingRecords(s.id).length === 0 && <p className="text-xs text-stone-400">No pending records</p>}
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
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const { currentUser } = useRole()
  const { getActiveNotes, dismissNote } = useAdminNotes()
  const [surrogateCount, setSurrogateCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [surrogates, setSurrogates] = useState([])

  useEffect(() => {
    fetchSurrogatesFromIntake().then(data => {
      setSurrogateCount(data.length)
      setPendingCount(data.filter(s => s.status === 'pending').length)
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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Surrogates" value={surrogateCount} icon={Heart} description="In program" />
        <StatCard title="Active IPs" value={0} icon={Users} description="In program" />
        <StatCard title="Matches in Progress" value={0} icon={GitMerge} description="Across all stages" />
        <StatCard title="Pending Review" value={pendingCount} icon={FileText} description="Needs review" />
      </div>

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
                  <GitMerge className="size-4" /> Match Queue
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

      {/* Surrogate Screening Sheet */}
      {surrogates.length > 0 && <SurrogateScreeningSheet surrogates={surrogates} />}
    </div>
  )
}
