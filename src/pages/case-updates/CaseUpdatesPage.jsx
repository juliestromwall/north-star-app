import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchSurrogateProfilesByEmails, getRecordTrackingBatch, fetchCaseEmails, fetchCaseTasks, fetchCaseNotes, fetchInsurance, fetchInsurancePayments, fetchJourneyExpenses } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getAllChecklistSteps, getChecklistMilestones, deriveParentStatus } from '@/lib/checklistStore'
import { SURROGATE_STAGES, IP_STAGES } from '@/lib/constants'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronDown, X, Sparkles, Loader2, CalendarDays, Clock, FileText, CheckCircle, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import StageBadge from '@/components/shared/StageBadge'
import { getAppConfig, setAppConfig } from '@/lib/db'
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

// ── Appointments Badge + Modal ──
function AppointmentsBadge({ caseId, caseType, caseName }) {
  const { currentUser } = useRole()
  const userId = currentUser?.userId || currentUser?.id
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [apptMeta, setApptMeta] = useState({})
  const [notesModal, setNotesModal] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [count, setCount] = useState(null)

  // Lightweight count on mount (no full fetch)
  useEffect(() => {
    if (!caseId || !userId) return
    const doCount = async () => {
      try {
        const { listCaseEvents, listCalendars } = await import('@/lib/google')
        const now = new Date()
        const timeMin = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString()
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()).toISOString()
        const cals = await listCalendars(userId).catch(() => [])
        const apptCal = (cals || []).find(c => c.summary?.toLowerCase() === 'appointments')
        const calId = apptCal?.id || 'primary'
        const fetches = [listCaseEvents(userId, caseId, caseType, { calendarId: 'primary', timeMin, timeMax, maxResults: 50 })]
        if (apptCal) fetches.push(listCaseEvents(userId, caseId, caseType, { calendarId: calId, timeMin, timeMax, maxResults: 50 }))
        const results = await Promise.all(fetches)
        const all = results.flatMap(r => r.items || [])
        const seen = new Set()
        const deduped = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
        setCount(deduped.length)
        setEvents(deduped.sort((a, b) => (b.start?.dateTime || b.start?.date || '').localeCompare(a.start?.dateTime || a.start?.date || '')))
      } catch { setCount(0) }
    }
    doCount()
  }, [caseId, userId, caseType])

  async function handleOpen() {
    setOpen(true)
    // Load appointment meta
    try {
      const data = await getAppConfig(`appt_notes_${caseType}_${caseId}`)
      if (data) setApptMeta(data)
    } catch {}
  }

  async function handleSaveNotes() {
    if (!notesModal) return
    setSavingNote(true)
    try {
      const meta = { ...apptMeta, [notesModal.id]: { ...(apptMeta[notesModal.id] || {}), notes: noteText, notesBy: currentUser?.name || 'Admin', notesAt: new Date().toISOString() } }
      setApptMeta(meta)
      await setAppConfig(`appt_notes_${caseType}_${caseId}`, meta)
      setNotesModal(null); setNoteText('')
    } catch {} finally { setSavingNote(false) }
  }

  if (count === null || count === 0) return null

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <>
      <button onClick={handleOpen} className="inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-[#283693] transition-colors mt-0.5" title={`${count} appointments`}>
        <CalendarDays className="size-3" />
        <span>{count}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[#283693]" />
              Appointments — {caseName}
            </DialogTitle>
          </DialogHeader>

          {events.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">No appointments found.</p>
          ) : (
            <div className="space-y-2">
              {events.map(event => {
                const startDt = event.start?.dateTime || event.start?.date || ''
                const eventDate = startDt.substring(0, 10)
                const isPast = eventDate < todayStr
                const isAllDay = !!event.start?.date && !event.start?.dateTime
                const title = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
                const meta = apptMeta[event.id] || {}
                const isFollowedUp = meta.followedUp || title.startsWith('✅')
                return (
                  <div key={event.id} className={`rounded-lg border px-3 py-2.5 ${isPast ? 'border-stone-100' : 'border-[#283693]/20 bg-[#283693]/5'}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isPast ? 'text-stone-600' : 'text-[#283693]'}`}>{title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                          <span>{formatDate(startDt)}</span>
                          {!isAllDay && event.start?.dateTime && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="size-2.5" />
                              {new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                          {isPast && <span className="text-stone-300">Past</span>}
                          {!isPast && eventDate === todayStr && <span className="text-[#283693] font-semibold">Today</span>}
                          {isFollowedUp && (
                            <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="size-2.5" /> Followed Up
                              {meta.followedUpBy && <span className="text-stone-400 font-normal">by {meta.followedUpBy}</span>}
                            </span>
                          )}
                        </div>
                        {meta.notes && (
                          <div className="mt-1.5 text-xs text-stone-600 bg-stone-50 rounded px-2 py-1.5 border-l-2 border-[#283693]/30">
                            {meta.notes}
                            {meta.notesBy && <p className="text-[10px] text-stone-400 mt-1">— {meta.notesBy}, {meta.notesAt ? formatDate(meta.notesAt) : ''}</p>}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setNotesModal(event); setNoteText(meta.notes || '') }}
                        className="text-[9px] text-stone-400 hover:text-[#283693] flex items-center gap-0.5 shrink-0 mt-0.5"
                      >
                        <FileText className="size-3" />
                        {meta.notes ? 'Edit' : 'Note'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notes sub-modal */}
      <Dialog open={!!notesModal} onOpenChange={v => { if (!v) { setNotesModal(null); setNoteText('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#283693]" /> Appointment Notes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium text-stone-700">{notesModal?.summary?.includes(' — ') ? notesModal.summary.split(' — ')[0] : notesModal?.summary}</p>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add notes about this appointment..." rows={4} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSaveNotes} disabled={savingNote}>
              {savingNote ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function cellStatusColor(status) {
  if (status === 'complete' || status === 'partial_complete') return 'text-green-600 bg-green-50 border-green-200'
  if (status === 'na' || status === 'deactivated') return 'text-stone-400 bg-stone-50 border-stone-200'
  if (status === 'not_started') return 'text-stone-400 bg-white border-stone-200'
  if (status === 'records_received' || status === 'partial_received') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (status === 'followed_up') return 'text-sky-600 bg-sky-50 border-sky-200'
  if (status === 'faxed_request' || status === 'refaxed_request' || status === 'requested') return 'text-amber-600 bg-amber-50 border-amber-200'
  if (status === 'confirmed_fax_received' || status === 'records_sent_mail') return 'text-indigo-600 bg-indigo-50 border-indigo-200'
  if (status === 'started') return 'text-cyan-600 bg-cyan-50 border-cyan-200'
  if (status === 'in_progress') return 'text-blue-600 bg-blue-50 border-blue-200'
  if (status === 'reviewing') return 'text-purple-600 bg-purple-50 border-purple-200'
  return 'text-[#283693] bg-[#283693]/5 border-[#283693]/20'
}

function statusCellBg(status) {
  if (status === 'complete' || status === 'partial_complete') return '#f0fdf4'
  if (status === 'na' || status === 'deactivated') return '#fafaf9'
  if (status === 'records_received' || status === 'partial_received') return '#ecfdf5'
  if (status === 'followed_up') return '#f0f9ff'
  if (status === 'faxed_request' || status === 'refaxed_request' || status === 'requested') return '#fffbeb'
  if (status === 'confirmed_fax_received' || status === 'records_sent_mail') return '#eef2ff'
  if (status === 'started') return '#ecfeff'
  if (status === 'in_progress') return '#eff6ff'
  if (status === 'reviewing') return '#faf5ff'
  return 'transparent'
}

function StatusPill({ status, label }) {
  if (status === 'not_started') return <span className="text-[10px] text-stone-300">—</span>
  if (status === 'na' || status === 'deactivated') return <span className="text-[10px] text-stone-400 italic line-through">N/A</span>
  return <span className="text-[11px] font-semibold text-stone-700">{label}</span>
}

const SCREENING_STAGES = ['pre-qualification', 'screening', 'matching']
const JOURNEY_STAGE_IDS = ['journey-oversight']

// Re-export shared component for backward compat
import AISummaryButton from '@/components/shared/AISummaryButton'
import JourneyUpdateButton from '@/components/shared/JourneyUpdateButton'
import ProviderInfoButton from '@/components/shared/ProviderInfoButton'

export default function CaseUpdatesPage() {
  const { currentUser, isSuperAdmin, isMasterAdmin } = useRole()
  const showAll = isSuperAdmin || isMasterAdmin
  const myEmail = currentUser?.email

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

  // Exclude surrogates and IPs that are in a matched journey
  const matchedGcIds = useMemo(() => new Set(journeys.map(j => j.gc_case_id).filter(Boolean)), [journeys])
  const matchedIpIds = useMemo(() => new Set(journeys.map(j => j.ip_case_id).filter(Boolean)), [journeys])
  // Filter by assigned admin (unless super/master admin)
  const unmatchedSurrogates = useMemo(() => surrogates.filter(s => !matchedGcIds.has(s.id) && (showAll || s.assignedTo === myEmail)), [surrogates, matchedGcIds, showAll, myEmail])
  const unmatchedIps = useMemo(() => ips.filter(ip => !matchedIpIds.has(ip.id) && (showAll || ip.assignedTo === myEmail)), [ips, matchedIpIds, showAll, myEmail])

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
          <SurrogateUpdatesSheet surrogates={unmatchedSurrogates} />
        </TabsContent>

        <TabsContent value="ips" className="mt-4">
          <IPUpdatesSheet ips={unmatchedIps} />
        </TabsContent>

        <TabsContent value="journeys" className="mt-4">
          <JourneyUpdatesSheet journeys={showAll ? journeys : journeys.filter(j => j.assigned_to === myEmail)} surrogates={surrogates} ips={ips} />
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
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200">
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50/80 z-10 min-w-[160px] border-r border-stone-100">
                    Checklist Steps
                  </th>
                  {filtered.map(s => {
                    const ss = allStageStatuses[s.id] || {}
                    const stageLabel = SURROGATE_STAGES.find(st => st.id === ss.stage)?.label || ss.stage
                    return (
                      <th key={s.id} className="text-center px-3 py-3 min-w-[170px] border-r border-stone-100 last:border-r-0">
                        <Link to={`/surrogates/${s.id}`} className="text-[#ed148c] hover:underline font-semibold text-xs">{s.name}</Link>
                        <p className="text-[9px] text-stone-400 font-normal">
                          {s.location ? `${s.location.split(', ').pop()}` : ''}
                          {s.age ? ` · ${s.age}` : ''}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <AISummaryButton
                            caseId={s.id} caseName={s.name} caseType="surrogate"
                            stage={stageLabel} status={ss.status}
                            checklistSteps={sheetRows} tracking={allTracking[s.id]}
                          />
                          <AppointmentsBadge caseId={s.id} caseType="surrogate" caseName={s.name} />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(row => {
                  // Surrogate info rows
                  if (row.type === 'info_row' && row.source === 'surrogate') {
                    return (
                      <tr key={row.id} className="border-b border-stone-100 bg-stone-50/30">
                        <td className="px-4 py-2 font-medium text-stone-500 sticky left-0 bg-stone-50/30 z-10 border-r border-stone-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider">{row.label}</span>
                        </td>
                        {filtered.map(s => {
                          let value = '', secondary = ''
                          if (row.dataField === 'referralSource') {
                            const source = s.answers?.hearAboutUs || s.hearAboutUs || ''
                            if (source.toLowerCase().includes('friend') || source.toLowerCase().includes('family')) {
                              value = s.answers?.referralName || s.answers?.hearAboutUsOther || 'Friend/Family'
                              secondary = 'Referral'
                            } else if (source.toLowerCase() === 'other') {
                              value = s.answers?.hearAboutUsOther || 'Other'
                            } else {
                              value = source || ''
                            }
                          } else if (row.dataField === 'experiencedSurrogate') {
                            const profile = allProfiles[s.id]
                            const prev = profile?.preferences?.previousSurrogate
                            if (prev === 'yes' || prev === true) {
                              const times = profile?.preferences?.surrogacyTimes || ''
                              value = `Yes${times ? ` (${times})` : ''}`
                            } else {
                              value = prev === 'no' || prev === false ? 'No' : ''
                            }
                          } else if (row.dataField === 'gtpal') {
                            // GTPAL from pregnancy history
                            const profile = allProfiles[s.id]
                            const pregs = profile?.pregnancyHistory?.pregnancies || []
                            if (pregs.length > 0) {
                              const g = pregs.length
                              let t = 0, p = 0, a = 0, l = 0
                              for (const pr of pregs) {
                                const weeks = parseInt(pr.gestationWeeks) || 0
                                if (pr.outcome === 'Live Birth') { if (weeks >= 37) t++; else p++; l++ }
                                else if (pr.outcome === 'Miscarriage' || pr.outcome === 'Ectopic Pregnancy' || pr.outcome === 'Termination' || pr.outcome === 'Stillborn') a++
                                if (pr.singleOrMultiples === 'Twins') l++
                                if (pr.singleOrMultiples === 'Triplets+') l += 2
                              }
                              value = `G${g}P${t}${p}${a}${l}`
                            }
                          } else if (row.dataField === 'maritalStatus') {
                            const profile = allProfiles[s.id]
                            value = profile?.personal?.maritalStatus || s.maritalStatus || ''
                          } else if (row.dataField === 'profileComplete') {
                            const profile = allProfiles[s.id]
                            if (profile) {
                              const REQ = { personal: ['firstName','city','state','heightFt','weight','maritalStatus'], pregnancyHistory: ['numberOfPregnancies'], fertility: ['sameBioFather'], general: ['smokeVape','alcoholDrugs','typicalDiet','exerciseFrequency'], health: ['mentalHealthDiagnosis'], employment: ['currentlyEmployed'], interests: ['personality'], hopesWishes: ['reasonForSurrogacy','whenReadyToBegin','desiredCompensation'] }
                              let filled = 0, total = 0
                              for (const [sec, fields] of Object.entries(REQ)) {
                                for (const f of fields) { total++; const v = profile[sec]?.[f]; if (v !== undefined && v !== '' && v !== null) filled++ }
                              }
                              const pct = total > 0 ? Math.round((filled / total) * 100) : 0
                              value = `${pct}%`
                              if (pct === 100) secondary = 'Complete'
                              else if (pct > 0) secondary = `${filled}/${total} fields`
                            }
                          }
                          return (
                            <td key={s.id} className="px-3 py-2 text-center">
                              {value ? (
                                <div>
                                  <p className="text-xs font-medium text-[#283693]">{value}</p>
                                  {secondary && <p className="text-[10px] text-stone-400">{secondary}</p>}
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-300 italic">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }

                  return (
                  <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-stone-700 text-xs sticky left-0 bg-white z-10 border-r border-stone-100 text-center">{row.label}</td>
                    {filtered.map(s => {
                      const { status, lastEntry, history, activeRecords, isRecordType, doneCount, totalCount } = getCellData(s.id, row.id, row.label)
                      const rt = allTracking[s.id] || {}
                      const stepData = rt[row.id] || {}
                      const textVal = stepData._textValue || lastEntry?.textValue
                      const isLogOpen = logPopover?.surrogateId === s.id && logPopover?.stepId === row.id
                      const isDocOpen = docPopover?.surrogateId === s.id && docPopover?.stepId === row.id
                      const isComplete = status === 'complete'
                      const isNotNeeded = status === 'na' || status === 'deactivated'
                      return (
                        <td key={s.id} className={`px-3 py-2 relative cursor-pointer hover:bg-stone-50/50 transition-colors text-center ${isNotNeeded ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: statusCellBg(status) }}
                          onClick={() => { const hasDetails = history.length > 0 || (subtasksByParent[row.id] || []).length > 0 || Object.values(allTracking[s.id] || {}).some(v => v?._isCaseSubtask && !v?._deleted && v?._parentId === row.id) || (isRecordType && totalCount > 0); if (hasDetails) { setLogPopover(isLogOpen ? null : { surrogateId: s.id, stepId: row.id }); setDocPopover(null) } }}>
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="min-w-0">
                              <StatusPill status={status} label={textVal || stepData.optionLabel || lastEntry?.optionLabel || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                              {lastEntry?.date && status !== 'not_started' && status !== 'na' && (
                                <p className="text-[9px] text-stone-400 mt-0.5 truncate max-w-[150px]">{formatDate(lastEntry.date)}{lastEntry.note ? ` · ${lastEntry.note}` : ''}</p>
                              )}
                            </div>
                            {isRecordType && totalCount > 0 && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${doneCount === totalCount ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-500'}`}>{doneCount}/{totalCount}</span>
                            )}
                          </div>
                          {/* Unified details popover */}
                          {isLogOpen && (() => {
                            const rt = allTracking[s.id] || {}
                            const globalSubs = subtasksByParent[row.id] || []
                            const caseSubs = Object.entries(rt)
                              .filter(([, v]) => v?._isCaseSubtask && !v?._deleted && v?._parentId === row.id)
                              .map(([k, v]) => ({ id: k, label: v._label, parentId: v._parentId }))
                            const subs = [...globalSubs, ...caseSubs]
                            const manualLogs = [...history].reverse().filter(e => !e.auto)
                            return (
                            <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-100">
                                <p className="text-[11px] font-semibold text-stone-600">{row.label}</p>
                                <button onClick={() => setLogPopover(null)} className="p-0.5 text-stone-300 hover:text-stone-500 rounded"><X className="size-3.5" /></button>
                              </div>
                              <div className="max-h-[350px] overflow-y-auto">
                                {/* Subtasks */}
                                {subs.length > 0 && (
                                  <div className="px-3 py-2 space-y-1.5">
                                    <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">Subtasks</p>
                                    {subs.map(sub => {
                                      const subData = rt[sub.id] || {}
                                      const subStatus = subData.status || 'not_started'
                                      return (
                                        <div key={sub.id} className="flex items-center gap-2 text-xs py-0.5">
                                          {subStatus === 'complete' ? <CheckCircle2 className="size-3.5 text-green-500 shrink-0" /> : subStatus === 'na' ? <X className="size-3.5 text-stone-300 shrink-0" /> : <Circle className="size-3.5 text-stone-300 shrink-0" />}
                                          <span className={`flex-1 ${subStatus === 'complete' ? 'text-stone-500' : subStatus === 'na' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{sub.label}</span>
                                          <StatusPill status={subStatus} label={subData.optionLabel || subStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                {/* Medical records */}
                                {isRecordType && totalCount > 0 && (
                                  <div className={`px-3 py-2 space-y-1.5 ${subs.length > 0 ? 'border-t border-stone-100' : ''}`}>
                                    <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">Records ({doneCount}/{totalCount})</p>
                                    {activeRecords.map(rec => (
                                      <div key={rec.id} className="flex items-center gap-2 text-xs py-0.5">
                                        {rec.isComplete ? <CheckCircle2 className="size-3.5 text-green-500 shrink-0" /> : <Circle className="size-3.5 text-stone-300 shrink-0" />}
                                        <div className="flex items-center gap-1 flex-1 min-w-0">
                                          {rec.badge && <span className={`text-[8px] font-bold px-1 py-0 rounded ${rec.badge.color}`}>{rec.badge.label}</span>}
                                          <span className="text-stone-700 truncate">{rec.label}</span>
                                        </div>
                                        <StatusPill status={rec.status} label={rec.isComplete ? 'Done' : rec.status === 'not_started' ? '—' : rec.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* History */}
                                {manualLogs.length > 0 && (
                                  <div className={`px-3 py-2 space-y-1 ${(subs.length > 0 || (isRecordType && totalCount > 0)) ? 'border-t border-stone-100' : ''}`}>
                                    <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">History</p>
                                    {manualLogs.map((entry, i) => (
                                      <div key={i} className="text-[11px] py-1 border-b border-stone-50 last:border-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-medium shrink-0 ${cellStatusColor(entry.status).split(' ')[0]}`}>{entry.optionLabel || entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                          <span className="text-stone-400 shrink-0">{formatDate(entry.date)}</span>
                                          <span className="text-stone-300 ml-auto shrink-0 text-[10px]">{entry.by}</span>
                                        </div>
                                        {entry.note && <p className="text-stone-500 mt-0.5 whitespace-pre-wrap break-words">{entry.note}</p>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {manualLogs.length === 0 && subs.length === 0 && !(isRecordType && totalCount > 0) && (
                                  <div className="px-3 py-4 text-center text-[11px] text-stone-400">No details to show</div>
                                )}
                              </div>
                            </div>
                            )
                          })()}
                        </td>
                      )
                    })}
                  </tr>
                  )
                })}
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

  const ipStageIds = IP_STAGES.filter(s => !s.hidden).map(s => s.id)

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const stage of IP_STAGES) counts[stage.id] = 0
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
          {ipStageIds.map(stageId => {
            const stage = IP_STAGES.find(s => s.id === stageId)
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
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200">
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50/80 z-10 min-w-[140px] border-r border-stone-100">
                    Checklist Steps
                  </th>
                  {filtered.map(ip => {
                    const ss = allStageStatuses[ip.id] || {}
                    const stageLabel = IP_STAGES.find(st => st.id === ss.stage)?.label || ss.stage
                    return (
                      <th key={ip.id} className="text-center px-3 py-3 min-w-[140px] border-r border-stone-100 last:border-r-0">
                        <Link to={`/intended-parents/${ip.id}`} className="text-[#283693] hover:underline font-semibold text-xs">{ip.names}</Link>
                        <p className="text-[9px] text-stone-400 font-normal">{ip.location || ''}</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <AISummaryButton
                            caseId={ip.id} caseName={ip.names} caseType="ip"
                            stage={stageLabel} status={ss.status}
                            checklistSteps={sheetRows} tracking={allTracking[ip.id]}
                          />
                          <AppointmentsBadge caseId={ip.id} caseType="ip" caseName={ip.names} />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => (
                  <tr key={step.id} className="border-b border-stone-100 hover:bg-stone-50/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-stone-700 text-xs sticky left-0 bg-white z-10 border-r border-stone-100">{step.label}</td>
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
                      const isNA = effectiveStatus === 'na'
                      const isLogOpen = logPopover?.caseId === ip.id && logPopover?.stepId === step.id
                      const manualHistory = history.filter(e => !e.auto)
                      const lastManual = manualHistory.length > 0 ? manualHistory[manualHistory.length - 1] : null
                      const displayStatus = hasChildren ? effectiveStatus : (lastManual?.status || effectiveStatus)
                      const displayDate = lastManual?.date
                      const textValue = d._textValue || lastManual?.textValue
                      const statusLabel = textValue || lastManual?.optionLabel || displayStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      return (
                        <td key={ip.id} className={`px-3 py-2 relative cursor-pointer hover:bg-stone-50/50 transition-colors text-center ${isNA ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: statusCellBg(displayStatus) }}
                          onClick={() => { if (manualHistory.length > 0 || hasChildren) setLogPopover(isLogOpen ? null : { caseId: ip.id, stepId: step.id }) }}>
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="min-w-0">
                              <StatusPill status={displayStatus} label={statusLabel} />
                              {displayDate && displayStatus !== 'not_started' && displayStatus !== 'na' && (
                                <p className="text-[9px] text-stone-400 mt-0.5 truncate max-w-[150px]">{formatDate(displayDate)}{lastManual?.note ? ` · ${lastManual.note}` : ''}</p>
                              )}
                            </div>
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
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200">
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50/80 z-10 min-w-[160px] border-r border-stone-100">
                    Checklist Steps
                  </th>
                  {filtered.map(j => {
                    const ip = ips.find(i => i.id === j.ip_case_id)
                    const gc = surrogates.find(s => s.id === j.gc_case_id)
                    const journeyName = `${ip?.names || 'IP'} + ${gc?.name || 'GC'}`
                    const jd = j.journey_data || {}
                    const gestAge = calcGestationalAge(jd.dueDate)
                    const isPregnant = jd.pregnant === 'yes'
                    return (
                      <th key={j.id} className="text-center px-3 py-3 min-w-[180px] border-r border-stone-100 last:border-r-0">
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
                        <div className="flex items-center justify-center gap-2 mt-0.5">
                          <AISummaryButton
                            caseId={j.id} caseName={journeyName} caseType="journey"
                            stage={j.stage} status={j.status}
                            checklistSteps={sheetRows} tracking={allTracking[j.id]}
                            journeyData={j.journey_data}
                            iconOnly
                          />
                          <JourneyUpdateButton caseId={j.id} caseType="journey" caseName={journeyName} compact />
                          <ProviderInfoButton journeyData={j.journey_data || {}} gcInsurance={null} compact />
                          <AppointmentsBadge caseId={j.id} caseType="journey" caseName={journeyName} />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => {
                  const isInfoRow = step.type === 'info_row'

                  if (isInfoRow) {
                    return (
                      <tr key={step.id} className="border-b border-stone-100 bg-stone-50/30">
                        <td className="px-4 py-2 font-medium text-stone-500 sticky left-0 bg-stone-50/30 z-10 border-r border-stone-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider">{step.label}</span>
                        </td>
                        {filtered.map(j => {
                          const jd = j.journey_data || {}
                          const primary = jd[step.dataPath] || ''
                          const secondary = step.secondaryPath ? jd[step.secondaryPath] || '' : ''
                          return (
                            <td key={j.id} className="px-3 py-2 text-center">
                              {primary ? (
                                <div>
                                  <p className="text-xs font-medium text-[#283693]">{primary}</p>
                                  {secondary && <p className="text-[10px] text-stone-400">{secondary}</p>}
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-300 italic">Not set</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }

                  return (
                  <tr key={step.id} className="border-b border-stone-100 hover:bg-stone-50/30 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-stone-700 text-xs sticky left-0 bg-white z-10 border-r border-stone-100">{step.label}</td>
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
                      const isNA = effectiveStatus === 'na'
                      const isLogOpen = logPopover?.caseId === j.id && logPopover?.stepId === step.id
                      const manualHistory = history.filter(e => !e.auto)
                      const lastManual = manualHistory.length > 0 ? manualHistory[manualHistory.length - 1] : null
                      const displayStatus = hasChildren ? effectiveStatus : (lastManual?.status || effectiveStatus)
                      const displayDate = lastManual?.date
                      const textValue = d._textValue || lastManual?.textValue
                      const statusLabel = textValue || lastManual?.optionLabel || displayStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      return (
                        <td key={j.id} className={`px-3 py-2 relative cursor-pointer hover:bg-stone-50/50 transition-colors text-center ${isNA ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: statusCellBg(displayStatus) }}
                          onClick={() => { if (manualHistory.length > 0 || hasChildren) setLogPopover(isLogOpen ? null : { caseId: j.id, stepId: step.id }) }}>
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="min-w-0">
                              <StatusPill status={displayStatus} label={statusLabel} />
                              {displayDate && displayStatus !== 'not_started' && displayStatus !== 'na' && (
                                <p className="text-[9px] text-stone-400 mt-0.5 truncate max-w-[150px]">{formatDate(displayDate)}{lastManual?.note ? ` · ${lastManual.note}` : ''}</p>
                              )}
                            </div>
                          </div>
                          {isLogOpen && <LogPopover history={history} onClose={() => setLogPopover(null)} subtasks={subs} tracking={rt} />}
                        </td>
                      )
                    })}
                  </tr>
                  )
                })}
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
    <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-100">
        <p className="text-[11px] font-semibold text-stone-600">Details</p>
        <button onClick={onClose} className="p-0.5 text-stone-300 hover:text-stone-500 rounded"><X className="size-3.5" /></button>
      </div>
      <div className="max-h-[350px] overflow-y-auto">
        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div className="px-3 py-2 space-y-1.5">
            <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">Subtasks</p>
            {subtasks.map(sub => {
              const subData = tracking[sub.id] || {}
              const subStatus = subData.status || 'not_started'
              return (
                <div key={sub.id} className="flex items-center gap-2 text-xs py-0.5">
                  {subStatus === 'complete' ? <CheckCircle2 className="size-3.5 text-green-500 shrink-0" /> : subStatus === 'na' ? <X className="size-3.5 text-stone-300 shrink-0" /> : <Circle className="size-3.5 text-stone-300 shrink-0" />}
                  <span className={`flex-1 ${subStatus === 'complete' ? 'text-stone-500' : subStatus === 'na' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{sub.label}</span>
                  <StatusPill status={subStatus} label={subData.optionLabel || subStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                </div>
              )
            })}
          </div>
        )}
        {/* History */}
        {manualHistory.length > 0 && (
          <div className={`px-3 py-2 space-y-1 ${subtasks.length > 0 ? 'border-t border-stone-100' : ''}`}>
            <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">History</p>
            {manualHistory.map((entry, i) => (
              <div key={i} className="text-[11px] py-1 border-b border-stone-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium shrink-0 ${cellStatusColor(entry.status).split(' ')[0]}`}>{entry.optionLabel || entry.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <span className="text-stone-400 shrink-0">{formatDate(entry.date)}</span>
                  <span className="text-stone-300 ml-auto shrink-0 text-[10px]">{entry.by}</span>
                </div>
                {entry.note && <p className="text-stone-500 mt-0.5 whitespace-pre-wrap break-words">{entry.note}</p>}
              </div>
            ))}
          </div>
        )}
        {manualHistory.length === 0 && subtasks.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-stone-400">No details to show</div>
        )}
      </div>
    </div>
  )
}
