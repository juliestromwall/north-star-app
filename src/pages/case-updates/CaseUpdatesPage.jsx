import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchSurrogateProfilesByEmails, getRecordTrackingBatch, fetchCaseEmails, fetchCaseTasks, fetchCaseNotes, fetchInsurance, fetchInsurancePayments, fetchJourneyExpenses } from '@/lib/db'
import { fetchMatchedJourneys, isJourneyActive } from '@/lib/matching'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getAllChecklistSteps, getChecklistMilestones, deriveParentStatus } from '@/lib/checklistStore'
import { SURROGATE_STAGES, IP_STAGES } from '@/lib/constants'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronDown, X, Sparkles, Loader2, CalendarDays, Clock, FileText, CheckCircle, Eye, Pencil, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { normalizeApptNotes } from '@/components/shared/CaseCalendarWidget'
import StageBadge from '@/components/shared/StageBadge'
import { getAppConfig, setAppConfig } from '@/lib/db'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { journeyManagerOutlineColor, JOURNEY_MANAGERS } from '@/pages/journeys/MatchedJourneysPage'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAdminStaff } from '@/data/mock/users'

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
  const [noteDate, setNoteDate] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [count, setCount] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')

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

  async function handleSaveEdit() {
    if (!notesModal || !editingId || !editText.trim()) return
    setSavingNote(true)
    try {
      const existing = normalizeApptNotes(apptMeta[notesModal.id])
      const newId = editingId === 'legacy' ? `n_${Date.now()}_legacy` : editingId
      const notesEntries = existing.map(e => e.id === editingId ? {
        ...e,
        id: newId,
        body: editText.trim(),
        date: editDate || e.date || (e.at || '').slice(0, 10) || new Date().toISOString().split('T')[0],
        editedBy: currentUser?.name || 'Admin',
        editedAt: new Date().toISOString(),
      } : e)
        .sort((a, b) => (a.at || a.date || '').localeCompare(b.at || b.date || ''))
      const meta = {
        ...apptMeta,
        [notesModal.id]: {
          ...(apptMeta[notesModal.id] || {}),
          notesEntries,
          notes: notesEntries[notesEntries.length - 1]?.body || '',
        },
      }
      setApptMeta(meta)
      await setAppConfig(`appt_notes_${caseType}_${caseId}`, meta)
      setEditingId(null)
      setEditText('')
      setEditDate('')
    } catch {} finally { setSavingNote(false) }
  }

  async function handleAppendNote() {
    if (!notesModal || !noteText.trim()) return
    setSavingNote(true)
    try {
      const existing = normalizeApptNotes(apptMeta[notesModal.id])
      const newEntry = {
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        body: noteText.trim(),
        date: noteDate || new Date().toISOString().split('T')[0],
        by: currentUser?.name || 'Admin',
        at: new Date().toISOString(),
      }
      const notesEntries = [...existing.filter(e => e.id !== 'legacy'), ...existing.filter(e => e.id === 'legacy'), newEntry]
        .sort((a, b) => (a.at || a.date || '').localeCompare(b.at || b.date || ''))
      const meta = {
        ...apptMeta,
        [notesModal.id]: {
          ...(apptMeta[notesModal.id] || {}),
          notesEntries,
          notes: notesEntries[notesEntries.length - 1]?.body || '',
          notesBy: newEntry.by,
          notesAt: newEntry.at,
        },
      }
      setApptMeta(meta)
      await setAppConfig(`appt_notes_${caseType}_${caseId}`, meta)
      setNoteText('')
      setNoteDate(new Date().toISOString().split('T')[0])
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
                const rawTitle = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
                const title = rawTitle.replace(/^✅\s*/, '')
                const meta = apptMeta[event.id] || {}
                const isFollowedUp = meta.followedUp || /^✅/.test(rawTitle)
                const noteEntries = normalizeApptNotes(meta)
                return (
                  <div key={event.id} className={`rounded-lg border px-3 py-2.5 ${isPast ? 'border-stone-100' : 'border-[#283693]/20 bg-[#283693]/5'}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-sm font-medium ${isPast ? 'text-stone-600' : 'text-[#283693]'}`}>{title}</p>
                          {isFollowedUp && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                              <CheckCircle2 className="size-2.5" /> Followed Up
                            </span>
                          )}
                        </div>
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
                          {isFollowedUp && meta.followedUpBy && <span className="text-stone-400">by {meta.followedUpBy}</span>}
                        </div>
                        {noteEntries.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {noteEntries.map(e => (
                              <div key={e.id} className="text-xs text-stone-600 bg-stone-50 rounded px-2 py-1.5 border-l-2 border-[#283693]/30">
                                <div className="flex items-center justify-between text-[10px] text-stone-400 mb-0.5">
                                  <span className="font-medium text-stone-500">{e.date ? formatDate(e.date) : (e.at ? formatDate(e.at) : '')}</span>
                                  <span>{e.by}</span>
                                </div>
                                <p className="whitespace-pre-line">{e.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setNotesModal(event); setNoteText(''); setNoteDate(new Date().toISOString().split('T')[0]) }}
                        className="text-[9px] text-stone-400 hover:text-[#283693] flex items-center gap-0.5 shrink-0 mt-0.5"
                      >
                        <FileText className="size-3" />
                        {noteEntries.length > 0 ? 'Add Another' : 'Add Note'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notes sub-modal — multi-entry */}
      <Dialog open={!!notesModal} onOpenChange={v => { if (!v) { setNotesModal(null); setNoteText(''); setNoteDate(''); setEditingId(null); setEditText(''); setEditDate('') } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#283693]" /> Appointment Notes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-semibold text-stone-700">
            {(notesModal?.summary?.includes(' — ') ? notesModal.summary.split(' — ')[0] : notesModal?.summary || '').replace(/^✅\s*/, '')}
          </p>

          {(() => {
            const entries = normalizeApptNotes(apptMeta[notesModal?.id])
            if (entries.length === 0) return null
            return (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Previous Notes</p>
                {entries.map(e => {
                  const isEditing = editingId === e.id
                  if (isEditing) {
                    return (
                      <div key={e.id} className="rounded-lg border border-[#283693]/30 bg-[#283693]/5 px-3 py-2 space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-stone-500">Note Date</label>
                          <Input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)} className="h-8 text-xs" />
                        </div>
                        <Textarea value={editText} onChange={ev => setEditText(ev.target.value)} rows={3} className="text-xs" />
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => { setEditingId(null); setEditText(''); setEditDate('') }}>
                            <X className="size-3" /> Cancel
                          </Button>
                          <Button size="sm" className="h-7 text-[11px] gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSaveEdit} disabled={savingNote || !editText.trim()}>
                            {savingNote ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save
                          </Button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={e.id} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                      <div className="flex items-center justify-between text-[10px] text-stone-400 mb-0.5">
                        <span className="font-medium text-stone-500">{e.date ? formatDate(e.date) : (e.at ? formatDate(e.at) : '')}</span>
                        <div className="flex items-center gap-2">
                          <span>{e.by}</span>
                          <button
                            onClick={() => { setEditingId(e.id); setEditText(e.body); setEditDate(e.date || (e.at || '').slice(0, 10) || '') }}
                            className="text-stone-400 hover:text-[#283693]"
                            title="Edit note"
                          >
                            <Pencil className="size-3" />
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-line">{e.body}</p>
                      {e.editedBy && (
                        <p className="text-[9px] text-stone-400 italic mt-1">edited by {e.editedBy}{e.editedAt ? ` on ${formatDate(e.editedAt)}` : ''}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div className="space-y-2 pt-2 border-t">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Add Another Note</p>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-500">Note Date</label>
              <Input
                type="date"
                value={noteDate || new Date().toISOString().split('T')[0]}
                onChange={e => setNoteDate(e.target.value)}
                className="h-9"
              />
            </div>
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your follow-up note..." rows={4} />
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Done</Button></DialogClose>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleAppendNote} disabled={savingNote || !noteText.trim()}>
              {savingNote ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />} Save Note
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
  // Only active (non-archived) journeys block a case from the unmatched list
  const matchedGcIds = useMemo(() => new Set(journeys.filter(isJourneyActive).map(j => j.gc_case_id).filter(Boolean)), [journeys])
  const matchedIpIds = useMemo(() => new Set(journeys.filter(isJourneyActive).map(j => j.ip_case_id).filter(Boolean)), [journeys])
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
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[160px] border-r border-stone-100">
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
                          <JourneyUpdateButton caseId={s.id} caseType="surrogate" caseName={s.name} compact />
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
                        <td className="px-4 py-2 font-medium text-stone-500 sticky left-0 bg-stone-50 z-10 border-r border-stone-100 text-center">
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
                            // Check profile section, then quiz answers
                            const prev = profile?.experiencedSurrogate?.previousSurrogate || profile?.preferences?.previousSurrogate || s.answers?.experiencedSurrogate
                            if (prev === 'yes' || prev === true) {
                              const times = profile?.experiencedSurrogate?.surrogacyTimes || profile?.preferences?.surrogacyTimes || ''
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
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[140px] border-r border-stone-100">
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
                          <JourneyUpdateButton caseId={ip.id} caseType="ip" caseName={ip.names} compact hideIfEmpty />
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
  const [caseManagerFilter, setCaseManagerFilter] = useState('all')
  const [journeyManagerFilter, setJourneyManagerFilter] = useState('all')
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
    return journeys.filter(j => {
      if (j.stage !== stageFilter) return false
      if (caseManagerFilter !== 'all') {
        const matchCm = caseManagerFilter === '_unassigned' ? !j.assigned_to : j.assigned_to === caseManagerFilter
        if (!matchCm) return false
      }
      if (journeyManagerFilter !== 'all') {
        const jm = j.journey_data?.journeyManager || ''
        const matchJm = journeyManagerFilter === '_unassigned' ? !jm : jm === journeyManagerFilter
        if (!matchJm) return false
      }
      return true
    })
  }, [journeys, stageFilter, caseManagerFilter, journeyManagerFilter])

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

        <div className="flex flex-wrap gap-2 mb-4">
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

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Case Manager</span>
            <Select value={caseManagerFilter} onValueChange={setCaseManagerFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="_unassigned">Unassigned</SelectItem>
                {getAdminStaff().map(a => <SelectItem key={a.email} value={a.email}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Journey Manager</span>
            <Select value={journeyManagerFilter} onValueChange={setJourneyManagerFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="_unassigned">Unassigned</SelectItem>
                {JOURNEY_MANAGERS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(caseManagerFilter !== 'all' || journeyManagerFilter !== 'all') && (
            <button
              className="text-[10px] text-stone-400 hover:text-[#283693] underline"
              onClick={() => { setCaseManagerFilter('all'); setJourneyManagerFilter('all') }}
            >
              Clear
            </button>
          )}
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
                  <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[160px] border-r border-stone-100">
                    Checklist Steps
                  </th>
                  {filtered.map(j => {
                    const ip = ips.find(i => i.id === j.ip_case_id)
                    const gc = surrogates.find(s => s.id === j.gc_case_id)
                    const journeyName = `${ip?.names || 'IP'} + ${gc?.name || 'GC'}`
                    const jd = j.journey_data || {}
                    const gestAge = calcGestationalAge(jd.dueDate)
                    const isPregnant = jd.pregnant === 'yes'
                    const outline = journeyManagerOutlineColor(j)
                    return (
                      <th
                        key={j.id}
                        className="text-center px-3 py-3 min-w-[180px] border-r border-stone-100 last:border-r-0"
                        style={outline ? { borderTop: `4px solid ${outline}` } : undefined}
                      >
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
                          <JourneyUpdateButton caseId={j.id} caseType="journey" caseName={journeyName} compact hideIfEmpty />
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
                        <td className="px-4 py-2 font-medium text-stone-500 sticky left-0 bg-stone-50 z-10 border-r border-stone-100 text-center">
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
    <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden text-left" onClick={e => e.stopPropagation()}>
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
              const subHistory = (subData.history || []).filter(e => !e.auto && e.note)
              const latestNote = subHistory.length > 0 ? subHistory[subHistory.length - 1] : null
              return (
                <div key={sub.id} className="py-0.5">
                  <div className="flex items-center gap-2 text-xs text-left">
                    {subStatus === 'complete' ? <CheckCircle2 className="size-3.5 text-green-500 shrink-0" /> : subStatus === 'na' ? <X className="size-3.5 text-stone-300 shrink-0" /> : <Circle className="size-3.5 text-stone-300 shrink-0" />}
                    <span className={`flex-1 text-left ${subStatus === 'complete' ? 'text-stone-500' : subStatus === 'na' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{sub.label}</span>
                    <StatusPill status={subStatus} label={subData.optionLabel || subStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                  </div>
                  {latestNote && (
                    <div className="ml-[22px] mt-0.5 text-[10px] text-stone-500 bg-stone-50 rounded px-2 py-1 text-left whitespace-pre-wrap break-words">
                      <span className="block">{latestNote.note}</span>
                      <span className="block text-[9px] text-stone-400 mt-0.5">{latestNote.by || ''}{latestNote.date ? ` · ${formatDate(latestNote.date)}` : ''}</span>
                    </div>
                  )}
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
