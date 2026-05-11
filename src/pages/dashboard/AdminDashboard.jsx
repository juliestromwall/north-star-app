import { useState, useEffect, useRef, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchMyTasks, fetchMyCompletedTasks, updateCaseTask, createCaseTask, deleteCaseTask, fetchAllOpenTasks, fetchSurrogateProfilesByEmails, getRecordTrackingBatch, getAppConfig, setAppConfig, fetchActiveAdminNotes, insertAdminNoteReply } from '@/lib/db'
import { updateEvent } from '@/lib/google'
import { fetchMatchedJourneys, isJourneyActive } from '@/lib/matching'
import { getAccessToken } from '@/lib/google'
import { getAdminStaff, loadAdminUsers } from '@/data/mock/users'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge, { JourneyStatusPill } from '@/components/shared/StageBadge'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { JourneyTileCard, journeyManagerOutlineColor } from '@/pages/journeys/MatchedJourneysPage'
import { SurrogateCard } from '@/pages/surrogates/SurrogateListPage'
import { IPTileCard } from '@/pages/intended-parents/IPListPage'
import { AdminNotesSection } from '@/pages/SettingsPage'
import { formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import {
  Heart, HeartHandshake, Route, Megaphone, X, Calendar, Clock, CheckCircle2, Circle,
  LayoutGrid, List as ListIcon, Quote, Calculator, StickyNote, Plus, Trash2, Check, CheckSquare,
  ChevronDown, ChevronRight, MapPin, History, FileText, Loader2, Pencil, RotateCcw, Search, Sparkles,
} from 'lucide-react'

// Renders the reply list + reply form for an admin note. Visibility rules are
// enforced by RLS on admin_note_replies: the replier sees their own reply, the
// note author sees all replies, everyone else sees nothing.
function NoteReplyBlock({ note, currentUser, onReplied }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const isAuthor = !!currentUser?.id && note.created_by === currentUser.id
  const replies = (note.admin_note_replies || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  async function submit() {
    const msg = text.trim()
    if (!msg) return
    setSending(true)
    setError(null)
    try {
      const saved = await insertAdminNoteReply({ noteId: note.id, message: msg, repliedByName: currentUser?.name || '' })
      if (saved && onReplied) onReplied(note.id, saved)
      setText('')
    } catch (err) {
      setError(err?.message || 'Failed to send')
    }
    setSending(false)
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/60 space-y-2">
      {replies.length > 0 && (
        <div className="space-y-1.5">
          {replies.map(r => (
            <div key={r.id} className="rounded-lg bg-white/70 px-3 py-2 text-xs">
              <p className="font-semibold text-[#1A3638] text-[11px]">{r.replied_by_name || 'Admin'} <span className="text-stone-400 font-normal ml-1">{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></p>
              <p className="text-stone-700 whitespace-pre-wrap">{r.message}</p>
            </div>
          ))}
        </div>
      )}
      {!isAuthor && (
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Reply privately to the author..."
            rows={2}
            className="bg-white/80 text-xs min-h-0 resize-none"
          />
          <Button size="sm" onClick={submit} disabled={sending || !text.trim()} className="gap-1.5 shrink-0" style={{ backgroundColor: '#1A3638' }}>
            {sending ? <Loader2 className="size-3 animate-spin" /> : 'Reply'}
          </Button>
        </div>
      )}
      {error && <p className="text-[10px] text-rose-500">{error}</p>}
    </div>
  )
}

function getAppointmentCaseInfo(event, { surrogates = [], ips = [], journeys = [] } = {}) {
  const caseIdProp = event.extendedProperties?.private?.caseId || ''
  const caseType = event.extendedProperties?.private?.caseType || ''
  const caseId = caseIdProp.includes('_') ? caseIdProp.split('_').slice(1).join('_') : caseIdProp
  if (caseId && caseType) return { caseId, caseType }

  const text = [event.description, event.summary, event.location]
    .filter(Boolean)
    .join('\n')

  const journeyLink = text.match(/\/journeys\/(\d+)/i)
  if (journeyLink) return { caseId: journeyLink[1], caseType: 'journey' }

  const surrogateLink = text.match(/\/surrogates\/(\d+)/i)
  if (surrogateLink) return { caseId: surrogateLink[1], caseType: 'surrogate' }

  const ipLink = text.match(/\/intended-parents\/(\d+)/i)
  if (ipLink) return { caseId: ipLink[1], caseType: 'ip' }

  const lower = text.toLowerCase()
  const activeJourneys = journeys.filter(isJourneyActive)
  const matchedJourney = activeJourneys.find(j =>
    [j.label, j.gc_name, j.ip_name].some(v => v && lower.includes(String(v).toLowerCase()))
  )
  if (matchedJourney) return { caseId: String(matchedJourney.id), caseType: 'journey' }

  const matchedSurrogate = surrogates.find(s => s.name && lower.includes(String(s.name).toLowerCase()))
  if (matchedSurrogate) return { caseId: String(matchedSurrogate.id), caseType: 'surrogate' }

  const matchedIp = ips.find(i => (i.names || i.name) && lower.includes(String(i.names || i.name).toLowerCase()))
  if (matchedIp) return { caseId: String(matchedIp.id), caseType: 'ip' }

  return { caseId: '', caseType: '' }
}

function isAppointmentForAdmin(event, { surrogates, ips, journeys, adminEmail, showAllCases }) {
  const { caseId, caseType } = getAppointmentCaseInfo(event, { surrogates, ips, journeys })
  if (!caseId || !caseType) return false
  if (showAllCases) return true
  if (!adminEmail) return false

  const normalizedType = caseType === 'gc' ? 'surrogate' : caseType
  const caseIdStr = String(caseId)
  const activeJourneys = (journeys || []).filter(isJourneyActive)

  if (normalizedType === 'journey') {
    const journey = activeJourneys.find(j => String(j.id) === caseIdStr)
    return journey?.assigned_to === adminEmail
  }

  if (normalizedType === 'surrogate') {
    const journey = activeJourneys.find(j => String(j.gc_case_id) === caseIdStr)
    if (journey) return journey.assigned_to === adminEmail
    const surrogate = (surrogates || []).find(s => String(s.id) === caseIdStr)
    return surrogate?.assignedTo === adminEmail
  }

  if (normalizedType === 'ip') {
    const journey = activeJourneys.find(j => String(j.ip_case_id) === caseIdStr)
    if (journey) return journey.assigned_to === adminEmail
    const ip = (ips || []).find(i => String(i.id) === caseIdStr)
    return ip?.assignedTo === adminEmail
  }

  return false
}

async function listDashboardCalendarEvents(token, calendarId, baseParams) {
  const items = []
  let pageToken = null
  let pageCount = 0

  do {
    const params = new URLSearchParams(baseParams)
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) break
    items.push(...(data?.items || []))
    pageToken = data?.nextPageToken || null
    pageCount += 1
  } while (pageToken && pageCount < 10)

  return items
}

export default function AdminDashboard() {
  const { currentUser, isSuperAdmin, isMasterAdmin } = useRole()
  const showAllCases = isSuperAdmin || isMasterAdmin
  const [adminNotes, setAdminNotes] = useState([])
  const [expandedReadNotes, setExpandedReadNotes] = useState({})
  // A note is visible on this dashboard only when it's active AND either targets everyone (null/empty)
  // or explicitly lists the current user. Master admins still manage all notes via Settings.
  const activeNotes = (adminNotes || []).filter(n => {
    if (!n.is_active) return false
    const targets = n.target_user_ids
    if (!targets || targets.length === 0) return true
    return !!currentUser?.id && targets.includes(currentUser.id)
  })
  const unreadNotes = activeNotes.filter(n => {
    const dismissals = n.admin_note_dismissals || []
    return !dismissals.some(d => d.user_id === currentUser?.id)
  })
  const readNotes = activeNotes.filter(n => {
    const dismissals = n.admin_note_dismissals || []
    return dismissals.some(d => d.user_id === currentUser?.id)
  })

  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [ipStageStatuses, setIpStageStatuses] = useState({})
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', due_date: new Date().toISOString().split('T')[0], priority: 'normal', description: '', assigned_to: '' })
  const [editingTask, setEditingTask] = useState(null)
  const [completedTasks, setCompletedTasks] = useState([])
  const [completedOpen, setCompletedOpen] = useState(false)
  const [futureOpen, setFutureOpen] = useState(false)
  // Per-task explicit expand/collapse overrides. Undefined = use default (expanded if task has a note).
  const [taskExpansions, setTaskExpansions] = useState({})
  const getTaskExpanded = (t) => taskExpansions[t.id] !== undefined ? taskExpansions[t.id] : !!t.description
  const toggleTaskExpanded = (t) => setTaskExpansions(prev => ({ ...prev, [t.id]: !getTaskExpanded(t) }))
  const [caseView, setCaseView] = useState('grid')
  const [caseSearch, setCaseSearch] = useState('')
  // For master/super admins picking whose cases to view + summarize. The
  // selected scope filters the case lists below AND drives the AI summary
  // target. Default '__all__' preserves the legacy "see everything" behavior
  // for super/master admins.
  const [summaryAdminEmail, setSummaryAdminEmail] = useState('__all__')
  // getAdminStaff() reads from a module-level array that loadAdminUsers()
  // populates async on AppLayout mount. If we render before that fetch
  // resolves, the picker dropdown only shows "My cases". Bump this whenever
  // the load finishes so the dropdown re-renders with the full admin list.
  const [adminListVersion, setAdminListVersion] = useState(0)
  useEffect(() => {
    loadAdminUsers().then(() => setAdminListVersion(v => v + 1)).catch(() => {})
  }, [])
  const [appointmentsOpen, setAppointmentsOpen] = useState(true)
  const [pastApptOpen, setPastApptOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(true)
  const [apptTasksSectionOpen, setApptTasksSectionOpen] = useState(() => {
    try { return localStorage.getItem('abc_dashboard_appt_tasks_open') !== '0' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('abc_dashboard_appt_tasks_open', apptTasksSectionOpen ? '1' : '0') } catch {}
  }, [apptTasksSectionOpen])
  // Task tab: 'mine' (assigned to me), 'cases' (tasks on cases I manage),
  // 'all' (every open task — master/super only). Defaults to 'mine'.
  const [taskTab, setTaskTab] = useState('mine')
  const [apptMeta, setApptMeta] = useState({}) // { configKey: { eventId: { followedUp, notes, ... } } }
  const [notesModal, setNotesModal] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [followingUp, setFollowingUp] = useState(null)

  // Load user preferences (default view)
  useEffect(() => {
    if (!currentUser?.id) return
    getAppConfig(`user_prefs_${currentUser.id}`).then(data => {
      if (data?.defaultView) setCaseView(data.defaultView)
      else setCaseView('grid')
    }).catch(() => setCaseView('grid'))
  }, [currentUser?.id])

  useEffect(() => {
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
      fetchMatchedJourneys(),
      // Pull ALL open tasks once and filter client-side into the three
      // tabs (My Tasks / My Cases / All Tasks). Avoids a second round-trip
      // when admins flip tabs and lets the bucket counts render upfront.
      fetchAllOpenTasks().catch(() => []),
      fetchMyCompletedTasks(currentUser?.email).catch(() => []),
    ]).then(([gcs, allIps, js, openTasks, myCompleted]) => {
      setSurrogates(gcs || [])
      setIps(allIps || [])
      setJourneys(js || [])
      setTasks(openTasks || [])
      setCompletedTasks(myCompleted || [])
      // Load profile data for surrogate cards
      const emails = (gcs || []).map(s => s.email).filter(Boolean)
      if (emails.length) {
        fetchSurrogateProfilesByEmails(emails).then(map => {
          const byId = {}
          for (const s of (gcs || [])) {
            if (s.email && map[s.email.trim().toLowerCase()]) byId[s.id] = map[s.email.trim().toLowerCase()]
          }
          setProfileMap(byId)
        }).catch(() => {})
      }
      // Fetch calendar events: past 7 days + next 7 days
      try {
        const userId = currentUser?.id
        if (userId) {
          const now = new Date()
          const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
          const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
          getAccessToken(userId).then(async token => {
            const baseParams = { maxResults: '250', singleEvents: 'true', orderBy: 'startTime', timeMin, timeMax }
            let calIds = ['primary']
            try {
              const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: `Bearer ${token}` } })
              const calData = await calRes.json()
              const apptCal = (calData.items || []).find(c => c.summary?.toLowerCase() === 'appointments')
              if (apptCal) calIds.push(apptCal.id)
            } catch {}
            const results = await Promise.all(calIds.map(calId =>
              listDashboardCalendarEvents(token, calId, baseParams).catch(() => [])
            ))
            const all = results.flat()
            const seen = new Set()
            const deduped = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
              .filter(e => isAppointmentForAdmin(e, {
                surrogates: gcs || [],
                ips: allIps || [],
                journeys: js || [],
                adminEmail: currentUser?.email,
                showAllCases,
              }))
              .sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || ''))
            setEvents(deduped)

            const caseKeys = new Set()
            for (const e of deduped) {
              const { caseId: cid, caseType: ct } = getAppointmentCaseInfo(e, { surrogates: gcs || [], ips: allIps || [], journeys: js || [] })
              if (cid && ct) {
                caseKeys.add(`appt_notes_${ct}_${cid}`)
              }
            }
            if (caseKeys.size > 0) {
              const metaResults = await Promise.all([...caseKeys].map(key =>
                getAppConfig(key).then(data => ({ key, data })).catch(() => ({ key, data: null }))
              ))
              const merged = {}
              for (const { data } of metaResults) {
                if (data) Object.assign(merged, data)
              }
              setApptMeta(merged)
            }
          }).catch(() => {})
        }
      } catch {}
    }).finally(() => setLoading(false))

    // Fetch quote of the day
    try {
      fetch('/api/quote')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.[0]?.q) setQuote({ text: data[0].q, author: data[0].a }) })
        .catch(() => setQuote({ text: 'Every day is a chance to begin again.', author: 'Unknown' }))
    } catch {
      setQuote({ text: 'Every day is a chance to begin again.', author: 'Unknown' })
    }

    // Fetch published admin notes from Supabase
    fetchActiveAdminNotes().then(notes => setAdminNotes(notes || [])).catch(() => {})
  }, [currentUser?.id, currentUser?.email, showAllCases])


  // Build cases — super/master admins see all, others see only assigned
  const myEmail = currentUser?.email
  // Only *active* (non-archived) journeys block a surrogate/IP from appearing as a standalone case
  const activeJourneysForFilter = journeys.filter(isJourneyActive)
  const matchedGcIds = new Set(activeJourneysForFilter.map(j => j.gc_case_id))
  const matchedIpIds = new Set(activeJourneysForFilter.map(j => j.ip_case_id))

  // Hide inactive cases from the dashboard:
  //   Surrogates: holding, withdrawn, not-qualified
  //   IPs: holding, withdrawn
  //   Journeys: status === 'Complete' OR _archivedAt is set (broken/finished matches)
  const HIDDEN_GC_STAGES = new Set(['holding', 'withdrawn', 'not-qualified'])
  const HIDDEN_IP_STAGES = new Set(['holding', 'withdrawn'])
  const HIDDEN_JOURNEY_STATUSES = new Set(['Complete'])

  // Resolve the dropdown selection to a Set of admin emails to scope the
  // dashboard to. null = no scoping (show everyone).
  const scopedEmails = useMemo(() => {
    if (!showAllCases) return new Set([(myEmail || '').toLowerCase()])
    if (!summaryAdminEmail || summaryAdminEmail === '__all__') return null
    // Journey-manager portfolio views don't filter the dashboard My Cases
    // list — they only affect what the AI summary button generates. Treat
    // them as no-scope here so the dashboard stays visible.
    if (summaryAdminEmail.startsWith('__journeyManager:')) return null
    if (summaryAdminEmail === '__team__') {
      // Mirror AdminCasesSummaryPage's team logic: every admin EXCEPT intake;
      // for master admins the requester is included but other masters are not.
      const myRole = currentUser?.role
      return new Set(
        getAdminStaff()
          .filter(a => a.email !== 'intake@northstarsurrogacy.com')
          .filter(a => {
            if (myRole === 'master_admin' && a.role === 'master_admin' && a.email?.toLowerCase() !== (myEmail || '').toLowerCase()) return false
            return true
          })
          .map(a => (a.email || '').toLowerCase())
      )
    }
    return new Set([summaryAdminEmail.toLowerCase()])
  }, [showAllCases, summaryAdminEmail, currentUser?.role, myEmail, adminListVersion])

  const inScope = (assignedEmail) => {
    if (!scopedEmails) return true
    return scopedEmails.has((assignedEmail || '').toLowerCase())
  }

  const visibleJourneys = journeys.filter(j => isJourneyActive(j) && !HIDDEN_JOURNEY_STATUSES.has(j.status))
  const allMyJourneys = visibleJourneys.filter(j => inScope(j.assigned_to))
  const allMySurrogates = surrogates.filter(s => {
    if (!inScope(s.assignedTo)) return false
    if (matchedGcIds.has(s.id)) return false
    const ss = getSurrogateStageStatus(s.id)
    return !HIDDEN_GC_STAGES.has(ss?.stage)
  })
  const allMyIPs = ips.filter(ip => {
    if (!inScope(ip.assignedTo)) return false
    if (matchedIpIds.has(ip.id)) return false
    const ss = getSurrogateStageStatus(ip.id)
    return !HIDDEN_IP_STAGES.has(ss?.stage)
  })

  // Apply search filter
  const q = caseSearch.trim().toLowerCase()
  const myJourneys = q ? allMyJourneys.filter(j => (j.gc_name || '').toLowerCase().includes(q) || (j.ip_name || '').toLowerCase().includes(q) || (j.label || '').toLowerCase().includes(q)) : allMyJourneys
  const mySurrogates = q ? allMySurrogates.filter(s => (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q)) : allMySurrogates
  const myIPs = q ? allMyIPs.filter(ip => (ip.names || '').toLowerCase().includes(q) || (ip.email || '').toLowerCase().includes(q) || (ip.location || '').toLowerCase().includes(q)) : allMyIPs

  async function completeTask(taskId) {
    try {
      const updated = await updateCaseTask(taskId, { status: 'complete', completed_at: new Date().toISOString(), completed_by: currentUser?.email })
      setTasks(prev => prev.filter(t => t.id !== taskId))
      if (updated) setCompletedTasks(prev => [updated, ...prev])
    } catch {}
  }

  async function uncompleteTask(taskId) {
    try {
      const updated = await updateCaseTask(taskId, { status: 'open', completed_at: null, completed_by: null })
      setCompletedTasks(prev => prev.filter(t => t.id !== taskId))
      if (updated) setTasks(prev => [updated, ...prev])
    } catch {}
  }

  async function removeTask(taskId) {
    if (!confirm('Delete this task?')) return
    try {
      await deleteCaseTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setCompletedTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {}
  }

  async function saveEditTask() {
    if (!editingTask) return
    try {
      const updated = await updateCaseTask(editingTask.id, {
        title: editingTask.title,
        due_date: editingTask.due_date || null,
        priority: editingTask.priority,
        description: editingTask.description || null,
        assigned_to: editingTask.assigned_to,
      })
      if (updated) {
        // If reassigned to someone else, remove from my list
        if (updated.assigned_to !== currentUser?.email) {
          setTasks(prev => prev.filter(t => t.id !== updated.id))
        } else {
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
        }
      }
      setEditingTask(null)
    } catch {}
  }

  // Appointment follow-up and notes helpers
  function getEventCaseInfo(event) {
    const { caseId: cid, caseType: ct } = getAppointmentCaseInfo(event, { surrogates, ips, journeys })
    const configKey = ct && cid ? `appt_notes_${ct}_${cid}` : null
    const normalizedType = ct === 'gc' ? 'surrogate' : ct
    let caseName = event.summary?.includes(' — ') ? event.summary.split(' — ').slice(1).join(' — ') : ''
    if (!caseName && cid && normalizedType === 'journey') {
      const journey = journeys.find(j => String(j.id) === String(cid))
      caseName = journey?.label || journey?.gc_name || ''
    } else if (!caseName && cid && normalizedType === 'surrogate') {
      caseName = surrogates.find(s => String(s.id) === String(cid))?.name || ''
    } else if (!caseName && cid && normalizedType === 'ip') {
      const ip = ips.find(i => String(i.id) === String(cid))
      caseName = ip?.names || ip?.name || ''
    }
    const caseLink = ct === 'journey' ? `/journeys/${cid}` : ct === 'ip' ? `/intended-parents/${cid}` : ct === 'surrogate' ? `/surrogates/${cid}` : ''
    return { caseType: ct, caseId: cid, configKey, caseName, caseLink }
  }

  async function handleFollowUp(event) {
    const { caseType: ct, caseId: cid, configKey, caseName } = getEventCaseInfo(event)
    if (!configKey) return
    setFollowingUp(event.id)
    try {
      const userId = currentUser?.id
      const currentTitle = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
      const cleanTitle = currentTitle.replace(/^✅\s*/, '')
      const newSummary = `✅ ${cleanTitle} — ${caseName || ''}`
      // Try to update on Appointments calendar first, then primary
      const token = await getAccessToken(userId)
      const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: `Bearer ${token}` } })
      const calData = await calRes.json()
      const apptCal = (calData.items || []).find(c => c.summary?.toLowerCase() === 'appointments')
      const calIds = apptCal ? [apptCal.id, 'primary'] : ['primary']
      let updated = null
      for (const calId of calIds) {
        try { updated = await updateEvent(userId, calId, event.id, { summary: newSummary }); break } catch {}
      }
      if (updated) setEvents(prev => prev.map(e => e.id === event.id ? updated : e))
      // Save metadata
      const existing = await getAppConfig(configKey).catch(() => null) || {}
      const meta = { ...existing, [event.id]: { ...(existing[event.id] || {}), followedUp: true, followedUpBy: currentUser?.name || 'Admin', followedUpAt: new Date().toISOString() } }
      await setAppConfig(configKey, meta).catch(() => {})
      setApptMeta(prev => ({ ...prev, ...meta }))
    } catch (err) { console.error('Follow up failed:', err) }
    finally { setFollowingUp(null) }
  }

  async function handleSaveApptNotes() {
    if (!notesModal) return
    const { configKey } = getEventCaseInfo(notesModal)
    if (!configKey) return
    setSavingNote(true)
    try {
      const existing = await getAppConfig(configKey).catch(() => null) || {}
      const meta = { ...existing, [notesModal.id]: { ...(existing[notesModal.id] || {}), notes: noteText, notesBy: currentUser?.name || 'Admin', notesAt: new Date().toISOString() } }
      await setAppConfig(configKey, meta).catch(() => {})
      setApptMeta(prev => ({ ...prev, ...meta }))
      setNotesModal(null)
      setNoteText('')
    } catch {} finally { setSavingNote(false) }
  }

  // Split events into upcoming and past
  const todayStr = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter(e => (e.start?.dateTime || e.start?.date || '').substring(0, 10) >= todayStr)
  const pastEvents = [...events.filter(e => (e.start?.dateTime || e.start?.date || '').substring(0, 10) < todayStr)].reverse()

  // Cases the logged-in admin manages (their email is the case's assigned_to).
  // Used by the "My Cases" tab — shows tasks attached to those cases even
  // when the admin isn't personally the assignee.
  const managedCases = useMemo(() => {
    const myEmail = (currentUser?.email || '').toLowerCase()
    if (!myEmail) return { surrogate: new Set(), ip: new Set(), journey: new Set() }
    const matchEmail = (val) => {
      if (!val) return false
      // assigned_to may be a single email or comma-separated list
      return String(val).toLowerCase().split(',').map(s => s.trim()).includes(myEmail)
    }
    const surrogate = new Set(surrogates.filter(s => matchEmail(s.assignedTo || s.assigned_to)).map(s => Number(s.id)))
    const ip = new Set(ips.filter(i => matchEmail(i.assignedTo || i.assigned_to)).map(i => Number(i.id)))
    const journey = new Set(journeys.filter(j => matchEmail(j.assigned_to || j.journey_data?.assigned_to)).map(j => Number(j.id)))
    return { surrogate, ip, journey }
  }, [currentUser?.email, surrogates, ips, journeys])

  // Bucket open tasks per tab. "mine" = assignee is me; "cases" = tasks on a
  // case I manage but I'm not the assignee; "all" = everything (master/super
  // only). A future-tasks toggle on each tab still controls >7-day items.
  const taskBuckets = useMemo(() => {
    const myEmail = (currentUser?.email || '').toLowerCase()
    const isMine = (t) => myEmail && String(t.assigned_to || '').toLowerCase().split(',').map(s => s.trim()).includes(myEmail)
    const onMyCase = (t) => {
      if (!t.case_id || !t.case_type) return false
      const cid = Number(t.case_id)
      if (t.case_type === 'surrogate' || t.case_type === 'gc') return managedCases.surrogate.has(cid)
      if (t.case_type === 'ip') return managedCases.ip.has(cid)
      if (t.case_type === 'journey') return managedCases.journey.has(cid)
      return false
    }
    const mine = tasks.filter(isMine)
    // Exclude tasks already in "mine" so an admin's own task isn't double-listed
    // when they also manage the case.
    const cases = tasks.filter(t => !isMine(t) && onMyCase(t))
    return { mine, cases, all: tasks }
  }, [tasks, currentUser?.email, managedCases])

  if (loading) return <div className="p-6 text-center text-stone-400">Loading dashboard...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Here's what's happening at North Star Surrogacy today"
      />

      {/* Admin Notes — announcement style */}
      <style>{`
        .admin-note-content ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
        .admin-note-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
        .admin-note-content li { margin: 0.15em 0; }
        .admin-note-content li p { margin: 0; }
        .admin-note-content p { margin: 0.15em 0; }
        .admin-note-content mark { border-radius: 2px; padding: 1px 2px; }
        .admin-note-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
        .admin-note-content::after { content: ''; display: table; clear: both; }
      `}</style>
      {/* Unread notes — full display */}
      {unreadNotes.map((note) => (
        <div key={note.id} className="relative rounded-2xl overflow-hidden border-2 border-[#D4A853]/20" style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fff1f2 100%)' }}>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#D4A853]" />
          <div className="px-5 py-4 pl-6">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-9 rounded-full bg-[#D4A853]/10 shrink-0 mt-0.5">
                <Megaphone className="size-4 text-[#D4A853]" />
              </div>
              <div className="flex-1 min-w-0">
                {note.title && <p className="font-bold text-[#1A3638] text-base">{note.title}</p>}
                <div className="text-sm text-stone-600 mt-0.5 leading-relaxed admin-note-content" dangerouslySetInnerHTML={{ __html: note.message }} />
                <p className="text-[10px] text-stone-400 mt-1.5">
                  {note.created_by || 'Admin'} · {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={async () => {
                if (supabase && currentUser?.id) {
                  try {
                    await supabase.from('admin_note_dismissals').insert({ note_id: note.id, user_id: currentUser.id })
                    setAdminNotes(prev => prev.map(n => n.id === note.id ? { ...n, admin_note_dismissals: [...(n.admin_note_dismissals || []), { user_id: currentUser.id }] } : n))
                  } catch {}
                }
              }} className="text-[10px] text-stone-400 hover:text-[#1A3638] font-medium px-2 py-1 rounded-lg hover:bg-white/50 transition-colors shrink-0">
                Mark as Read
              </button>
            </div>
            <NoteReplyBlock note={note} currentUser={currentUser} onReplied={(noteId, reply) => setAdminNotes(prev => prev.map(n => n.id === noteId ? { ...n, admin_note_replies: [...(n.admin_note_replies || []), reply] } : n))} />
          </div>
        </div>
      ))}

      {/* Read notes — collapsed */}
      {readNotes.length > 0 && (
        <div className="space-y-1.5">
          {readNotes.map((note) => {
            const isExpanded = expandedReadNotes[note.id]
            return (
              <div key={note.id} className="rounded-xl border border-stone-200 overflow-hidden">
                <button onClick={() => setExpandedReadNotes(prev => ({ ...prev, [note.id]: !prev[note.id] }))}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-stone-50 transition-colors">
                  <Megaphone className="size-3.5 text-stone-400 shrink-0" />
                  <span className="text-sm font-medium text-stone-500 truncate flex-1">{note.title || 'Note'}</span>
                  <span className="text-[10px] text-stone-300">{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <ChevronDown className={`size-3.5 text-stone-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-stone-100">
                    <div className="text-sm text-stone-600 leading-relaxed admin-note-content" dangerouslySetInnerHTML={{ __html: note.message }} />
                    <p className="text-[10px] text-stone-400 mt-1.5">{note.created_by || 'Admin'}</p>
                    <NoteReplyBlock note={note} currentUser={currentUser} onReplied={(noteId, reply) => setAdminNotes(prev => prev.map(n => n.id === noteId ? { ...n, admin_note_replies: [...(n.admin_note_replies || []), reply] } : n))} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Quote of the Day */}
      {quote && (
        <div className="rounded-xl border border-stone-100 bg-gradient-to-r from-[#1A3638]/5 to-pink-50/50 px-6 py-4">
          <div className="flex items-start gap-3">
            <Quote className="size-5 text-[#1A3638]/30 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm italic text-stone-600 leading-relaxed">"{quote.text}"</p>
              <p className="text-xs text-stone-400 mt-1">— {quote.author}</p>
            </div>
          </div>
        </div>
      )}

      {/* Appointments + Tasks */}
      {!apptTasksSectionOpen ? (
        <button
          onClick={() => setApptTasksSectionOpen(true)}
          className="group w-full rounded-2xl border border-stone-200 bg-white hover:border-[#D4A853]/30 hover:shadow-sm transition-all px-5 py-3.5 flex items-center gap-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-[#D4A853]/10 flex items-center justify-center shrink-0">
              <Calendar className="size-4 text-[#D4A853]" />
            </div>
            <div className="size-8 rounded-full bg-[#1A3638]/10 flex items-center justify-center shrink-0 -ml-3 ring-2 ring-white">
              <CheckSquare className="size-4 text-[#1A3638]" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-heading font-black text-[#1A3638] leading-tight tracking-tight">Appointments &amp; Tasks</h3>
            <p className="text-[11px] text-stone-400 font-medium">
              {upcomingEvents.length} upcoming · {taskBuckets.mine.length} mine · {taskBuckets.cases.length} on my cases
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[#D4A853] group-hover:underline">Show</span>
          <ChevronRight className="size-4 text-stone-400 group-hover:text-[#D4A853] transition-colors" />
        </button>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setApptTasksSectionOpen(false)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-stone-500 bg-white border border-stone-200 hover:text-[#D4A853] hover:border-[#D4A853]/30 transition-colors"
          >
            <ChevronDown className="size-3.5" />
            Hide section
          </button>
        </div>
      )}

      {apptTasksSectionOpen && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments — same visual language as the new Tasks card:
            left-border accent ("today" = indigo, past = neutral), bigger
            title, full-width chip metadata row, always-visible action
            buttons sized to match the Tasks edit/delete icons. */}
        {(() => {
          const renderAppointment = (event, { isPast = false } = {}) => {
            const startDt = event.start?.dateTime || event.start?.date || ''
            const isAllDay = !!event.start?.date && !event.start?.dateTime
            const today = new Date().toDateString() === new Date(startDt).toDateString()
            const { caseName, caseLink } = getEventCaseInfo(event)
            const meta = apptMeta[event.id] || {}
            const title = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
            const isFollowedUp = meta.followedUp || title.startsWith('✅')
            // Profile-inspired tinted backgrounds: indigo wash for today,
            // emerald wash for already-followed-up, otherwise white.
            const tint = today
              ? 'bg-[#88C0C4]/[0.20] border-[#1A3638]/20'
              : isFollowedUp
                ? 'bg-emerald-50/40 border-emerald-200/60'
                : 'bg-white border-stone-200'
            return (
              <div key={event.id} className={`group rounded-xl border ${tint} ${isPast ? 'opacity-75' : ''} hover:shadow-sm transition-all`}>
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className={`text-[14px] font-semibold leading-snug ${today ? 'text-[#1A3638]' : 'text-stone-800'}`}>
                      {title.replace(/^✅\s*/, '')}
                    </p>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${today ? 'text-[#1A3638]' : 'text-stone-500'}`}>
                        <Calendar className="size-3" />
                        {today ? 'Today' : formatDate(startDt)}
                      </span>
                      {!isAllDay && event.start?.dateTime && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                          <Clock className="size-3" />
                          {new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                      {isFollowedUp && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="size-3" /> Followed Up
                        </span>
                      )}
                      {caseName && caseLink && (
                        <Link to={caseLink} className="text-[11px] font-semibold text-[#D4A853] hover:underline truncate max-w-[180px]">
                          {caseName}
                        </Link>
                      )}
                    </div>
                    {meta.notes && (
                      <p className="text-[11px] text-stone-500 italic border-l-2 border-stone-300 pl-2.5 line-clamp-2">
                        {meta.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 items-end">
                    {!isFollowedUp && (
                      <button
                        onClick={() => handleFollowUp(event)}
                        disabled={followingUp === event.id}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 transition-colors"
                        title="Mark as followed up"
                      >
                        {followingUp === event.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                        Follow Up
                      </button>
                    )}
                    <button
                      onClick={() => { setNotesModal(event); setNoteText(apptMeta[event.id]?.notes || '') }}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500 hover:text-[#1A3638] hover:bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200 transition-colors"
                      title={meta.notes ? 'Edit notes' : 'Add notes'}
                    >
                      <FileText className="size-3" />
                      {meta.notes ? 'Edit notes' : 'Add notes'}
                    </button>
                  </div>
                </div>
              </div>
            )
          }
          return (
            <Card className="rounded-2xl border-stone-200 shadow-sm">
              {/* Magazine-style header borrowed from the profile pages: pink
                  icon dot + indigo serif title, divider tinted with the same
                  pink as the profile section breaks. */}
              <CardHeader className="pb-3 cursor-pointer border-b border-[#D4A853]/15" onClick={() => setAppointmentsOpen(o => !o)}>
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-[#D4A853]/10 flex items-center justify-center shrink-0">
                    <Calendar className="size-4 text-[#D4A853]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-heading font-black text-[#1A3638] leading-tight tracking-tight">Appointments</h3>
                    {upcomingEvents.length > 0 && (
                      <p className="text-[11px] text-stone-400 font-medium">{upcomingEvents.length} upcoming this week</p>
                    )}
                  </div>
                  {appointmentsOpen ? <ChevronDown className="size-4 text-stone-400" /> : <ChevronRight className="size-4 text-stone-400" />}
                </div>
              </CardHeader>
              {appointmentsOpen && (
                <CardContent className="pt-4">
                  {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-6">No appointments this week.</p>
                  ) : (
                    <div className="space-y-4">
                      {upcomingEvents.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-stone-500 uppercase tracking-[0.12em] font-bold pl-1">Upcoming</p>
                          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                            {upcomingEvents.map(event => renderAppointment(event))}
                          </div>
                        </div>
                      )}
                      {pastEvents.length > 0 && (
                        <div className="space-y-2">
                          <button onClick={() => setPastApptOpen(o => !o)} className="flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-[0.12em] font-bold hover:text-stone-700 transition-colors pl-1">
                            {pastApptOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                            <History className="size-3" /> Past 7 Days ({pastEvents.length})
                          </button>
                          {pastApptOpen && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {pastEvents.map(event => renderAppointment(event, { isPast: true }))}
                            </div>
                          )}
                        </div>
                      )}
                      <Link to="/calendar" className="text-xs font-semibold text-[#D4A853] hover:underline block text-center pt-1">View full calendar →</Link>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })()}

        {/* Tasks — tabbed: My Tasks / My Cases / All Tasks */}
        {(() => {
          // Hoisted task helpers — case name/link lookup, the row renderer
          // shared across all tabs and the completed list, and the
          // ≤7-day / >7-day split.
          const lookupCase = (task) => {
            if (!task.case_id || !task.case_type || task.case_type === 'personal') return { caseName: null, caseLink: null }
            const cid = Number(task.case_id)
            if (task.case_type === 'surrogate' || task.case_type === 'gc') {
              const gc = surrogates.find(s => Number(s.id) === cid)
              if (gc) return { caseName: gc.name, caseLink: `/surrogates/${gc.id}` }
            } else if (task.case_type === 'ip') {
              const ip = ips.find(i => Number(i.id) === cid)
              if (ip) return { caseName: ip.names || ip.name, caseLink: `/intended-parents/${ip.id}` }
            } else if (task.case_type === 'journey') {
              const j = journeys.find(j => Number(j.id) === cid)
              if (j) return { caseName: j.label || j.gc_name, caseLink: `/journeys/${j.id}` }
            }
            return { caseName: null, caseLink: null }
          }
          const formatAssignees = (val) => {
            if (!val) return ''
            return String(val).split(',').map(e => e.trim().split('@')[0]).join(' & ')
          }
          // Profile-inspired: tinted backgrounds for each state instead of
          // border-only accents. Urgent → rose wash, High → amber wash,
          // Today → indigo wash, Overdue → rose-200 wash with red text.
          const tintFor = (task, isOverdue, isToday) => {
            if (task.status === 'complete') return 'bg-stone-50 border-stone-200'
            if (isOverdue) return 'bg-rose-50/60 border-rose-200/70'
            if (task.priority === 'urgent') return 'bg-rose-50/60 border-rose-200/70'
            if (task.priority === 'high') return 'bg-amber-50/60 border-amber-200/70'
            if (isToday) return 'bg-[#88C0C4]/[0.20] border-[#1A3638]/20'
            return 'bg-white border-stone-200'
          }
          const todayIsoStr = new Date().toISOString().split('T')[0]
          const renderTask = (task) => {
            const { caseName, caseLink } = lookupCase(task)
            const isExpanded = getTaskExpanded(task)
            const isComplete = task.status === 'complete'
            const isOverdue = task.due_date && task.due_date < todayIsoStr && !isComplete
            const isToday = task.due_date === todayIsoStr && !isComplete
            return (
              <div key={task.id} className={`group rounded-xl border ${tintFor(task, isOverdue, isToday)} hover:shadow-sm transition-all ${isComplete ? 'opacity-70' : ''}`}>
                <div className="px-4 py-3 flex items-start gap-3">
                  {isComplete ? (
                    <button onClick={() => uncompleteTask(task.id)} className="text-emerald-500 hover:text-amber-500 shrink-0 mt-0.5" title="Mark incomplete">
                      <CheckCircle2 className="size-5" />
                    </button>
                  ) : (
                    <button onClick={() => completeTask(task.id)} className="text-stone-300 hover:text-emerald-500 shrink-0 mt-0.5" title="Mark complete">
                      <Circle className="size-5" />
                    </button>
                  )}
                  <button onClick={() => toggleTaskExpanded(task)} className="flex-1 min-w-0 text-left space-y-1.5">
                    <p className={`text-[14px] font-semibold leading-snug ${isComplete ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                      {task.due_date && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${isOverdue ? 'text-rose-600 font-bold' : isToday ? 'text-[#1A3638]' : 'text-stone-500'}`}>
                          <Calendar className="size-3" />
                          {isToday ? 'Today' : isOverdue ? `${formatDate(task.due_date)} · Overdue` : formatDate(task.due_date)}
                        </span>
                      )}
                      {isComplete && task.completed_at && (
                        <span className="text-[11px] text-stone-400">Completed {formatDate(task.completed_at)}</span>
                      )}
                      {task.priority === 'urgent' && !isComplete && (
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-[0.1em]">Urgent</span>
                      )}
                      {task.priority === 'high' && !isComplete && (
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.1em]">High</span>
                      )}
                      {caseName ? (
                        <span className="text-[11px] font-semibold text-[#D4A853] truncate max-w-[180px]">{caseName}</span>
                      ) : (task.case_type === 'personal' || !task.case_id) ? (
                        <span className="text-[10px] font-medium text-stone-400 italic">Personal</span>
                      ) : null}
                      {task.assigned_to && taskTab !== 'mine' && (
                        <span className="text-[11px] text-stone-500">→ {formatAssignees(task.assigned_to)}</span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!isComplete && (
                      <button onClick={() => setEditingTask({ ...task })} className="size-7 rounded-full flex items-center justify-center text-stone-400 hover:text-[#1A3638] hover:bg-[#1A3638]/10 transition-colors" title="Edit">
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    <button onClick={() => removeTask(task.id)} className="size-7 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors" title="Delete">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 pl-12 space-y-1 text-[11px] border-t border-stone-200/60 pt-2">
                    {caseName && caseLink && (
                      <p className="text-stone-400">Case: <Link to={caseLink} className="text-[#D4A853] hover:underline font-medium">{caseName}</Link></p>
                    )}
                    {task.assigned_to && <p className="text-stone-400">Assigned to: <span className="text-stone-700 font-medium">{formatAssignees(task.assigned_to)}</span></p>}
                    {task.created_by && <p className="text-stone-400">Created by: <span className="text-stone-700">{task.created_by.split('@')[0]}</span></p>}
                    {task.completed_by && <p className="text-stone-400">Completed by: <span className="text-stone-700">{task.completed_by.split('@')[0]}{task.completed_at ? ` on ${formatDate(task.completed_at)}` : ''}</span></p>}
                    {task.description && <p className="text-stone-600 whitespace-pre-wrap pt-1.5">{task.description}</p>}
                  </div>
                )}
              </div>
            )
          }
          // Bucket the active tab's task list into "due in next 7 days or
          // already overdue" vs "future" so the future toggle works the same
          // on every tab.
          const splitByHorizon = (list) => {
            const now = new Date(); now.setHours(0, 0, 0, 0)
            const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            const current = []
            const future = []
            for (const t of list) {
              if (t.due_date) {
                const due = new Date(t.due_date + 'T12:00:00')
                if (due > sevenDays) { future.push(t); continue }
              }
              current.push(t)
            }
            return { current, future }
          }
          const activeList = taskTab === 'all' ? taskBuckets.all : taskTab === 'cases' ? taskBuckets.cases : taskBuckets.mine
          const { current: currentTasks, future: futureTasks } = splitByHorizon(activeList)
          const showAllTab = isSuperAdmin || isMasterAdmin
          const tabs = [
            { id: 'mine', label: 'My Tasks', count: taskBuckets.mine.length },
            { id: 'cases', label: 'My Cases', count: taskBuckets.cases.length },
            ...(showAllTab ? [{ id: 'all', label: 'All Tasks', count: taskBuckets.all.length }] : []),
          ]
          return (
            <Card className="rounded-2xl border-stone-200 shadow-sm">
              {/* Magazine-style header — indigo icon dot for Tasks (matches
                  the pink Calendar dot on the Appointments card so the two
                  feel like a pair without being identical). */}
              <CardHeader className="pb-3 border-b border-[#88C0C4]/40">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-[#1A3638]/10 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => setTasksOpen(o => !o)}>
                    <CheckCircle2 className="size-4 text-[#1A3638]" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setTasksOpen(o => !o)}>
                    <h3 className="text-base font-heading font-black text-[#1A3638] leading-tight tracking-tight">Tasks</h3>
                    <p className="text-[11px] text-stone-400 font-medium">
                      {taskBuckets.mine.length} mine · {taskBuckets.cases.length} on my cases
                      {showAllTab ? ` · ${taskBuckets.all.length} total` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 shrink-0 text-[#D4A853] hover:text-[#D4A853] hover:bg-[#D4A853]/10" onClick={() => setAddTaskOpen(true)}>
                    <Plus className="size-3" /> Add
                  </Button>
                  {tasksOpen ? <ChevronDown className="size-4 text-stone-400 shrink-0 cursor-pointer" onClick={() => setTasksOpen(false)} /> : <ChevronRight className="size-4 text-stone-400 shrink-0 cursor-pointer" onClick={() => setTasksOpen(true)} />}
                </div>
                {/* Underline-style tab strip mirrors the section dividers
                    used throughout the profile preview (border-b accent). */}
                {tasksOpen && (
                  <div className="flex items-center gap-1 mt-3 border-b border-stone-200 -mb-3">
                    {tabs.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTaskTab(t.id)}
                        className={`px-3 pb-2 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                          taskTab === t.id
                            ? 'text-[#1A3638] border-[#D4A853]'
                            : 'text-stone-400 border-transparent hover:text-stone-600'
                        }`}
                      >
                        {t.label}
                        <span className={`ml-1.5 text-[10px] font-bold ${taskTab === t.id ? 'text-[#D4A853]' : 'text-stone-300'}`}>{t.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardHeader>
              {tasksOpen && (
                <CardContent className="pt-4 space-y-3">
                  {currentTasks.length === 0 && futureTasks.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-6">
                      {taskTab === 'mine'
                        ? 'No open tasks assigned to you.'
                        : taskTab === 'cases'
                          ? 'No tasks on cases you manage.'
                          : 'No open tasks.'}
                    </p>
                  ) : currentTasks.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-3">No tasks due in the next 7 days.</p>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {currentTasks.map(renderTask)}
                    </div>
                  )}
                  {futureTasks.length > 0 && (
                    <div>
                      <button onClick={() => setFutureOpen(o => !o)} className="flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-[0.12em] font-bold hover:text-stone-700 transition-colors w-full pt-2 pl-1">
                        {futureOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                        <Calendar className="size-3 text-[#1A3638]" />
                        Future Tasks ({futureTasks.length})
                      </button>
                      {futureOpen && (
                        <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
                          {futureTasks.map(renderTask)}
                        </div>
                      )}
                    </div>
                  )}
                  {taskTab === 'mine' && completedTasks.length > 0 && (
                    <div>
                      <button onClick={() => setCompletedOpen(o => !o)} className="flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-[0.12em] font-bold hover:text-stone-700 transition-colors w-full pt-2 pl-1">
                        {completedOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        Completed ({completedTasks.length})
                      </button>
                      {completedOpen && (
                        <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
                          {completedTasks.map(renderTask)}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })()}
      </div>
      )}

      {/* Add Task Dialog */}
      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={v => { if (!v) setAddTaskOpen(false); else { setNewTask({ title: '', due_date: new Date().toISOString().split('T')[0], priority: 'normal', description: '', assigned_to: currentUser?.email || '' }); setAddTaskOpen(true) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Title *</label>
              <Input value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="What needs to be done?" className="h-9" autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Assign To</label>
              <select value={newTask.assigned_to} onChange={e => setNewTask(t => ({ ...t, assigned_to: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                {getAdminStaff().map(a => (
                  <option key={a.email} value={a.email}>{a.name}{a.email === currentUser?.email ? ' (me)' : ''}</option>
                ))}
                {(() => { const s = getAdminStaff(); const j = s.find(a => a.email === 'julie@northstarsurrogacy.com'); const n = s.find(a => a.email === 'nicole@northstarsurrogacy.com'); return j && n ? <option value={`${j.email},${n.email}`}>{j.name} & {n.name}</option> : null })()}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Due Date</label>
                <Input type="date" value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Priority</label>
                <select value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Notes</label>
              <Input value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} placeholder="Optional details..." className="h-9" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={!newTask.title.trim()} style={{ backgroundColor: '#1A3638' }} className="gap-1" onClick={async () => {
                try {
                  const assignTo = newTask.assigned_to || currentUser?.email
                  const created = await createCaseTask({
                    title: newTask.title.trim(),
                    due_date: newTask.due_date || null,
                    priority: newTask.priority,
                    description: newTask.description || null,
                    assigned_to: assignTo,
                    created_by: currentUser?.email,
                    status: 'open',
                    case_type: 'personal',
                  })
                  if (created && assignTo === currentUser?.email) setTasks(prev => [created, ...prev])
                  setNewTask({ title: '', due_date: new Date().toISOString().split('T')[0], priority: 'normal', description: '', assigned_to: currentUser?.email || '' })
                  setAddTaskOpen(false)
                } catch (err) {
                  console.error('Failed to create task:', err)
                }
              }}>
                <Plus className="size-3" /> Add Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={v => { if (!v) setEditingTask(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          {editingTask && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Title *</label>
                <Input value={editingTask.title} onChange={e => setEditingTask(t => ({ ...t, title: e.target.value }))} className="h-9" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Assign To</label>
                <select value={editingTask.assigned_to || ''} onChange={e => setEditingTask(t => ({ ...t, assigned_to: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                  {getAdminStaff().map(a => (
                    <option key={a.email} value={a.email}>{a.name}{a.email === currentUser?.email ? ' (me)' : ''}</option>
                  ))}
                  {(() => { const s = getAdminStaff(); const j = s.find(a => a.email === 'julie@northstarsurrogacy.com'); const n = s.find(a => a.email === 'nicole@northstarsurrogacy.com'); return j && n ? <option value={`${j.email},${n.email}`}>{j.name} & {n.name}</option> : null })()}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">Due Date</label>
                  <Input type="date" value={editingTask.due_date || ''} onChange={e => setEditingTask(t => ({ ...t, due_date: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">Priority</label>
                  <select value={editingTask.priority || 'normal'} onChange={e => setEditingTask(t => ({ ...t, priority: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Notes</label>
                <Input value={editingTask.description || ''} onChange={e => setEditingTask(t => ({ ...t, description: e.target.value }))} placeholder="Optional details..." className="h-9" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingTask(null)}>Cancel</Button>
                <Button size="sm" disabled={!editingTask.title?.trim()} style={{ backgroundColor: '#1A3638' }} className="gap-1" onClick={saveEditTask}>
                  <Check className="size-3" /> Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Notes management — master/super admins only */}
      {(isSuperAdmin || isMasterAdmin) && (
        <Card className="rounded-2xl border-stone-100">
          <CardContent className="py-5">
            <AdminNotesSection />
          </CardContent>
        </Card>
      )}

      {/* My Cases — separated by type */}
      <div>
        <div className="mb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
                placeholder="Search by name, email, or location..."
                className="h-10 w-full pl-10 pr-4 text-sm border border-stone-200 rounded-xl bg-white outline-none focus:border-[#1A3638] focus:ring-1 focus:ring-[#1A3638]/20"
              />
            </div>
            {showAllCases && (
              <select
                value={summaryAdminEmail}
                onChange={e => setSummaryAdminEmail(e.target.value)}
                className="h-10 text-sm border border-stone-200 rounded-xl px-3 bg-white outline-none focus:border-[#1A3638] focus:ring-1 focus:ring-[#1A3638]/20 shrink-0"
                title="Filter cases (and pick whose to summarize)"
              >
                <option value="__all__">All cases</option>
                <option value={currentUser?.email || ''}>My cases</option>
                {/* Master-admin journey-portfolio views — pulls every matched
                    journey where journey_data.journeyManager matches, grouped
                    by the day-to-day assigned admin. Affects AI summary only;
                    the dashboard list still shows the user's selected scope. */}
                <option value="__journeyManager:julie">Julie's Journeys</option>
                <option value="__journeyManager:nicole">Nicole's Journeys</option>
                {getAdminStaff()
                  .filter(a => a.email !== currentUser?.email)
                  // Jennifer Rose is intake-only — never include her in admin summaries.
                  .filter(a => a.email !== 'intake@northstarsurrogacy.com')
                  .map(a => (
                    <option key={a.email} value={a.email}>{a.name}'s cases</option>
                  ))}
              </select>
            )}
            <Button
              size="sm"
              className="h-10 gap-1.5 shrink-0 text-white"
              style={{ background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }}
              onClick={() => {
                const sel = showAllCases ? summaryAdminEmail : currentUser?.email
                let url
                if (sel?.startsWith('__journeyManager:')) {
                  const name = sel.split(':')[1]
                  url = `/dashboard/cases-summary?journeyManager=${encodeURIComponent(name)}`
                } else if (sel === '__team__' || sel === '__all__') {
                  // Fallback for legacy team option (still in dashboard scope filter).
                  url = `/dashboard/cases-summary?team=1`
                } else {
                  url = `/dashboard/cases-summary?admin=${encodeURIComponent(sel || '')}`
                }
                window.open(url, '_blank', 'noopener,noreferrer')
              }}
            >
              <Sparkles className="size-4" />
              {summaryAdminEmail?.startsWith('__journeyManager:')
                ? `Summarize ${summaryAdminEmail.split(':')[1].replace(/^./, c => c.toUpperCase())}'s Journeys`
                : (summaryAdminEmail === '__team__' || summaryAdminEmail === '__all__')
                  ? 'Summarize Team'
                  : `Summarize ${showAllCases && summaryAdminEmail !== currentUser?.email ? 'Their' : 'My'} Cases`}
            </Button>
            <div className="flex items-center border rounded-md shrink-0">
              <Button variant={caseView === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-r-none size-9" onClick={() => setCaseView('grid')}>
                <LayoutGrid className="size-4" />
              </Button>
              <Button variant={caseView === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none size-9" onClick={() => setCaseView('list')}>
                <ListIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {myJourneys.length + mySurrogates.length + myIPs.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">No cases assigned to you yet.</p>
        ) : (
          <div className="space-y-6">
            {/* Matched Journeys */}
            {myJourneys.length > 0 && (
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                  <Route className="size-3" /> Matched Journeys ({myJourneys.length})
                </p>
                {caseView === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myJourneys.map(j => {
                      const gc = surrogates.find(s => s.id === j.gc_case_id)
                      const ip = ips.find(i => i.id === j.ip_case_id)
                      return <JourneyTileCard key={j.id} j={{ ...j, gc, ip }} />
                    })}
                  </div>
                ) : (
                  <Card className="rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-stone-50/50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Intended Parent</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Surrogate</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myJourneys.map(j => {
                          const gc = surrogates.find(s => s.id === j.gc_case_id)
                          const ip = ips.find(i => i.id === j.ip_case_id)
                          const outline = journeyManagerOutlineColor({ ...j, gc, ip })
                          return (
                            <tr
                              key={j.id}
                              className="border-b last:border-0 hover:bg-stone-50/50 cursor-pointer"
                              onClick={() => window.location.href = `/journeys/${j.id}`}
                            >
                              <td
                                className="px-4 py-3"
                                style={outline ? { boxShadow: `inset 4px 0 0 ${outline}` } : undefined}
                              >
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar name={ip?.names || '?'} size="sm" />
                                  <span className="font-medium text-stone-800">{ip?.names || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar name={gc?.name || '?'} size="sm" />
                                  <span className="font-medium text-stone-800">{gc?.name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3"><JourneyStatusPill stage={j.stage} status={j.status} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}

            {/* Surrogates */}
            {mySurrogates.length > 0 && (
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                  <Heart className="size-3" /> Surrogates ({mySurrogates.length})
                </p>
                {caseView === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {mySurrogates.map(s => (
                      <SurrogateCard key={s.id} surrogate={s} profileData={profileMap[s.id]} stageStatus={getSurrogateStageStatus(s.id)} onAssign={() => {}} />
                    ))}
                  </div>
                ) : (
                  <Card className="rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-stone-50/50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Location</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Age</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Stage</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Assigned To</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mySurrogates.map(s => {
                          const ss = getSurrogateStageStatus(s.id) || { stage: 'pre-qualification', status: 'New' }
                          const isNew = ss.stage === 'pre-qualification' && ss.status === 'New'
                          return (
                            <tr key={s.id} className={`border-b last:border-0 cursor-pointer ${isNew ? 'bg-pink-50/40 hover:bg-pink-50/70' : 'hover:bg-stone-50/50'}`} onClick={() => window.location.href = `/surrogates/${s.id}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar name={s.name} size="sm" />
                                  <span className="font-semibold text-stone-800">{s.name}</span>
                                  {isNew && (
                                    <span className="relative flex size-2.5 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A853] opacity-75" />
                                      <span className="relative inline-flex rounded-full size-2.5 bg-[#D4A853]" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-stone-500">
                                <div className="flex items-center gap-1">
                                  <MapPin className="size-3" />
                                  {s.location || s.state || '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium">{s.age || '—'}</td>
                              <td className="px-4 py-3"><StageBadge stage={ss.stage} /></td>
                              <td className="px-4 py-3 text-stone-600">{ss.status}</td>
                              <td className="px-4 py-3 text-stone-500 text-xs">{s.assignedTo ? (getAdminStaff().find(a => a.email === s.assignedTo)?.name || s.assignedTo.split('@')[0]) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}

            {/* IPs */}
            {myIPs.length > 0 && (
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                  <HeartHandshake className="size-3" /> Intended Parents ({myIPs.length})
                </p>
                {caseView === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myIPs.map(ip => (
                      <IPTileCard key={ip.id} ip={ip} stageStatus={getSurrogateStageStatus(ip.id)} />
                    ))}
                  </div>
                ) : (
                  <Card className="rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-stone-50/50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Location</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myIPs.map(ip => (
                          <tr key={ip.id} className="border-b last:border-0 hover:bg-stone-50/50 cursor-pointer" onClick={() => window.location.href = `/intended-parents/${ip.id}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ProfileAvatar name={ip.names || ip.name} size="sm" />
                                <div>
                                  <span className="font-medium text-stone-800">{ip.names || ip.name}</span>
                                  {ip.email && <p className="text-xs text-stone-400">{ip.email}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-stone-500">{ip.location || ip.state || '—'}</td>
                            <td className="px-4 py-3"><StageBadge stage={ip.stage || 'new'} caseType="ip" /></td>
                            <td className="px-4 py-3 text-stone-400 text-xs">{ip.submittedAt ? new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Appointment Notes Modal */}
      <Dialog open={!!notesModal} onOpenChange={v => { if (!v) { setNotesModal(null); setNoteText('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#1A3638]" />
              Appointment Notes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600 font-medium">
            {notesModal?.summary?.includes(' — ') ? notesModal.summary.split(' — ')[0] : notesModal?.summary || ''}
          </p>
          <p className="text-xs text-stone-400">{notesModal?.start?.dateTime ? formatDate(notesModal.start.dateTime) : notesModal?.start?.date ? formatDate(notesModal.start.date) : ''}</p>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add notes about this appointment..." rows={4} />
          {apptMeta[notesModal?.id]?.notesBy && (
            <p className="text-[10px] text-stone-400">Last edited by {apptMeta[notesModal?.id].notesBy} on {apptMeta[notesModal?.id].notesAt ? formatDate(apptMeta[notesModal.id].notesAt) : ''}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => { setNotesModal(null); setNoteText('') }}>Cancel</Button>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#1A3638' }} onClick={handleSaveApptNotes} disabled={savingNote}>
              {savingNote ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />} Save Notes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
