import { useState, useEffect, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchMyTasks, fetchMyCompletedTasks, updateCaseTask, createCaseTask, fetchAllOpenTasks, fetchSurrogateProfilesByEmails, getRecordTrackingBatch, getAppConfig, setAppConfig, fetchActiveAdminNotes } from '@/lib/db'
import { updateEvent } from '@/lib/google'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getAccessToken } from '@/lib/google'
import { getAdminStaff } from '@/data/mock/users'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge from '@/components/shared/StageBadge'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { JourneyTileCard } from '@/pages/journeys/MatchedJourneysPage'
import { SurrogateCard } from '@/pages/surrogates/SurrogateListPage'
import { IPTileCard } from '@/pages/intended-parents/IPListPage'
import { formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import {
  Heart, HeartHandshake, Route, Megaphone, X, Calendar, Clock, CheckCircle2, Circle,
  LayoutGrid, List as ListIcon, Quote, Calculator, StickyNote, Plus, Trash2, Check,
  ChevronDown, ChevronRight, MapPin, History, FileText, Loader2, Pencil,
} from 'lucide-react'

export default function AdminDashboard() {
  const { currentUser, isSuperAdmin, isMasterAdmin } = useRole()
  const showAllCases = isSuperAdmin || isMasterAdmin
  const [adminNotes, setAdminNotes] = useState([])
  const visibleNotes = (adminNotes || []).filter(n => {
    if (!n.is_active) return false
    const dismissals = n.admin_note_dismissals || []
    return !dismissals.some(d => d.user_id === currentUser?.id)
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
  const [caseView, setCaseView] = useState('grid')
  const [appointmentsOpen, setAppointmentsOpen] = useState(true)
  const [pastApptOpen, setPastApptOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(true)
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
      fetchMyTasks(currentUser?.email).catch(() => []),
      fetchMyCompletedTasks(currentUser?.email).catch(() => []),
    ]).then(([gcs, allIps, js, myTasks, myCompleted]) => {
      setSurrogates(gcs || [])
      setIps(allIps || [])
      setJourneys(js || [])
      setTasks(myTasks || [])
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
    }).finally(() => setLoading(false))

    // Fetch calendar events: past 7 days + next 7 days
    try {
      const userId = currentUser?.id
      if (userId) {
        const now = new Date()
        const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        getAccessToken(userId).then(async token => {
          const baseParams = { maxResults: '40', singleEvents: 'true', orderBy: 'startTime', timeMin, timeMax, privateExtendedProperty: 'abcCase=true' }
          let calIds = ['primary']
          try {
            const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: `Bearer ${token}` } })
            const calData = await calRes.json()
            const apptCal = (calData.items || []).find(c => c.summary?.toLowerCase() === 'appointments')
            if (apptCal) calIds.push(apptCal.id)
          } catch {}
          const results = await Promise.all(calIds.map(calId =>
            fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${new URLSearchParams(baseParams)}`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json()).then(d => d?.items || []).catch(() => [])
          ))
          const all = results.flat()
          const seen = new Set()
          const deduped = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
            .sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || ''))
          setEvents(deduped)

          // Load appointment metadata for all unique cases in these events
          const caseKeys = new Set()
          for (const e of deduped) {
            const caseIdProp = e.extendedProperties?.private?.caseId || ''
            const ct = e.extendedProperties?.private?.caseType || ''
            if (caseIdProp && ct) {
              const cid = caseIdProp.includes('_') ? caseIdProp.split('_').slice(1).join('_') : caseIdProp
              caseKeys.add(`appt_notes_${ct}_${cid}`)
            }
          }
          if (caseKeys.size > 0) {
            const metaResults = await Promise.all([...caseKeys].map(key =>
              getAppConfig(key).then(data => ({ key, data })).catch(() => ({ key, data: null }))
            ))
            const merged = {}
            for (const { key, data } of metaResults) {
              if (data) Object.assign(merged, data)
            }
            setApptMeta(merged)
          }
        }).catch(() => {})
      }
    } catch {}

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
  }, [])


  // Build cases — super/master admins see all, others see only assigned
  const myEmail = currentUser?.email
  const matchedGcIds = new Set(journeys.map(j => j.gc_case_id))
  const matchedIpIds = new Set(journeys.map(j => j.ip_case_id))

  const myJourneys = showAllCases ? journeys : journeys.filter(j => j.assigned_to === myEmail)
  const mySurrogates = surrogates.filter(s => (showAllCases || s.assignedTo === myEmail) && !matchedGcIds.has(s.id))
  const myIPs = ips.filter(ip => (showAllCases || ip.assignedTo === myEmail) && !matchedIpIds.has(ip.id))

  async function completeTask(taskId) {
    try {
      const updated = await updateCaseTask(taskId, { status: 'complete', completed_at: new Date().toISOString(), completed_by: currentUser?.email })
      setTasks(prev => prev.filter(t => t.id !== taskId))
      if (updated) setCompletedTasks(prev => [updated, ...prev])
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
    const caseIdProp = event.extendedProperties?.private?.caseId || ''
    const ct = event.extendedProperties?.private?.caseType || ''
    const cid = caseIdProp.includes('_') ? caseIdProp.split('_').slice(1).join('_') : caseIdProp
    const configKey = ct && cid ? `appt_notes_${ct}_${cid}` : null
    const caseName = event.summary?.includes(' — ') ? event.summary.split(' — ').slice(1).join(' — ') : ''
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

  if (loading) return <div className="p-6 text-center text-stone-400">Loading dashboard...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Here's what's happening at ABC Surrogacy today"
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
      `}</style>
      {visibleNotes.map((note) => (
        <div key={note.id} className="relative rounded-2xl overflow-hidden border-2 border-[#ed148c]/20" style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fff1f2 100%)' }}>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ed148c]" />
          <div className="flex items-start gap-3 px-5 py-4 pl-6">
            <div className="flex items-center justify-center size-9 rounded-full bg-[#ed148c]/10 shrink-0 mt-0.5">
              <Megaphone className="size-4 text-[#ed148c]" />
            </div>
            <div className="flex-1 min-w-0">
              {note.title && <p className="font-bold text-[#283693] text-base">{note.title}</p>}
              <div className="text-sm text-stone-600 mt-0.5 leading-relaxed admin-note-content" dangerouslySetInnerHTML={{ __html: note.message }} />
              <p className="text-[10px] text-stone-400 mt-1.5">
                {note.created_by || 'Admin'} · {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button onClick={async () => {
              setAdminNotes(prev => prev.filter(n => n.id !== note.id))
              if (supabase && currentUser?.id) {
                try { await supabase.from('admin_note_dismissals').insert({ note_id: note.id, user_id: currentUser.id }) } catch {}
              }
            }} className="p-1.5 rounded-full hover:bg-stone-200/60 text-stone-400 hover:text-stone-600 transition-colors shrink-0">
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Quote of the Day */}
      {quote && (
        <div className="rounded-xl border border-stone-100 bg-gradient-to-r from-[#283693]/5 to-pink-50/50 px-6 py-4">
          <div className="flex items-start gap-3">
            <Quote className="size-5 text-[#283693]/30 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm italic text-stone-600 leading-relaxed">"{quote.text}"</p>
              <p className="text-xs text-stone-400 mt-1">— {quote.author}</p>
            </div>
          </div>
        </div>
      )}

      {/* Appointments + Tasks — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments (Upcoming + Recent Past) */}
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setAppointmentsOpen(o => !o)}>
            <CardTitle className="text-sm flex items-center gap-2">
              {appointmentsOpen ? <ChevronDown className="size-4 text-stone-400" /> : <ChevronRight className="size-4 text-stone-400" />}
              <Calendar className="size-4 text-stone-400" /> Appointments
            </CardTitle>
          </CardHeader>
          {appointmentsOpen && <CardContent>
            {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No appointments this week</p>
            ) : (
              <div className="space-y-3">
                {/* Upcoming */}
                {upcomingEvents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Upcoming</p>
                    {upcomingEvents.slice(0, 6).map(event => {
                      const startDt = event.start?.dateTime || event.start?.date || ''
                      const isAllDay = !!event.start?.date && !event.start?.dateTime
                      const today = new Date().toDateString() === new Date(startDt).toDateString()
                      const { caseName, caseLink } = getEventCaseInfo(event)
                      const meta = apptMeta[event.id] || {}
                      const title = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
                      const isFollowedUp = meta.followedUp || title.startsWith('✅')
                      return (
                        <div key={event.id} className={`rounded-lg border px-3 py-2 ${today ? 'border-[#283693]/30 bg-[#283693]/5' : 'border-stone-100'}`}>
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${today ? 'font-semibold text-[#283693]' : 'text-stone-800'}`}>
                                {title.replace(/^✅\s*/, '')}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5 flex-wrap">
                                <span>{formatDate(startDt)}</span>
                                {!isAllDay && event.start?.dateTime && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="size-2.5" />
                                    {new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </span>
                                )}
                                {today && <span className="text-[#283693] font-semibold">Today</span>}
                                {isFollowedUp && <span className="text-emerald-600 font-semibold">✅ Followed Up</span>}
                                {caseName && caseLink && (
                                  <Link to={caseLink} className="text-[#283693] hover:underline font-medium">{caseName}</Link>
                                )}
                              </div>
                              {meta.notes && (
                                <p className="text-[10px] text-stone-500 mt-1 italic border-l-2 border-stone-200 pl-2">{meta.notes.slice(0, 100)}{meta.notes.length > 100 ? '...' : ''}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 shrink-0 items-end">
                              {!isFollowedUp && (
                                <button
                                  onClick={() => handleFollowUp(event)}
                                  disabled={followingUp === event.id}
                                  className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 transition-colors"
                                >
                                  {followingUp === event.id ? <Loader2 className="size-2.5 animate-spin" /> : <CheckCircle2 className="size-2.5" />}
                                  Follow Up
                                </button>
                              )}
                              <button
                                onClick={() => { setNotesModal(event); setNoteText(apptMeta[event.id]?.notes || '') }}
                                className="inline-flex items-center gap-1 text-[9px] font-medium text-stone-500 hover:text-[#283693] bg-stone-50 hover:bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200 transition-colors"
                              >
                                <FileText className="size-2.5" />
                                {meta.notes ? 'Edit Notes' : 'Add Notes'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Past 7 Days — collapsible */}
                {pastEvents.length > 0 && (
                  <div className="space-y-2">
                    <button onClick={() => setPastApptOpen(o => !o)} className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1 hover:text-stone-600 transition-colors">
                      {pastApptOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      <History className="size-3" /> Past 7 Days ({pastEvents.length})
                    </button>
                    {pastApptOpen && pastEvents.slice(0, 6).map(event => {
                      const startDt = event.start?.dateTime || event.start?.date || ''
                      const isAllDay = !!event.start?.date && !event.start?.dateTime
                      const { caseName, caseLink } = getEventCaseInfo(event)
                      const meta = apptMeta[event.id] || {}
                      const title = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
                      const isFollowedUp = meta.followedUp || title.startsWith('✅')
                      return (
                        <div key={event.id} className="rounded-lg border border-stone-100 px-3 py-2 opacity-80">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-stone-700">{title.replace(/^✅\s*/, '')}</p>
                              <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5 flex-wrap">
                                <span>{formatDate(startDt)}</span>
                                {!isAllDay && event.start?.dateTime && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="size-2.5" />
                                    {new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </span>
                                )}
                                {isFollowedUp && <span className="text-emerald-600 font-semibold">✅ Followed Up</span>}
                                {caseName && caseLink && (
                                  <Link to={caseLink} className="text-[#283693] hover:underline font-medium">{caseName}</Link>
                                )}
                              </div>
                              {meta.notes && (
                                <p className="text-[10px] text-stone-500 mt-1 italic border-l-2 border-stone-200 pl-2">{meta.notes.slice(0, 100)}{meta.notes.length > 100 ? '...' : ''}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 shrink-0 items-end">
                              {!isFollowedUp && (
                                <button
                                  onClick={() => handleFollowUp(event)}
                                  disabled={followingUp === event.id}
                                  className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 transition-colors"
                                >
                                  {followingUp === event.id ? <Loader2 className="size-2.5 animate-spin" /> : <CheckCircle2 className="size-2.5" />}
                                  Follow Up
                                </button>
                              )}
                              <button
                                onClick={() => { setNotesModal(event); setNoteText(apptMeta[event.id]?.notes || '') }}
                                className="inline-flex items-center gap-1 text-[9px] font-medium text-stone-500 hover:text-[#283693] bg-stone-50 hover:bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200 transition-colors"
                              >
                                <FileText className="size-2.5" />
                                {meta.notes ? 'Edit Notes' : 'Add Notes'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <Link to="/calendar" className="text-xs text-[#283693] hover:underline block text-center pt-1">View full calendar →</Link>
              </div>
            )}
          </CardContent>}
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 cursor-pointer" onClick={() => setTasksOpen(o => !o)}>
                {tasksOpen ? <ChevronDown className="size-4 text-stone-400" /> : <ChevronRight className="size-4 text-stone-400" />}
                <CheckCircle2 className="size-4 text-stone-400" /> My Tasks
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAddTaskOpen(true)}>
                <Plus className="size-3" /> Add Task
              </Button>
            </div>
          </CardHeader>
          {tasksOpen && <CardContent className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No open tasks</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 8).map(task => {
                  // Resolve case name and link
                  let caseName = null, caseLink = null
                  if (task.case_id && task.case_type && task.case_type !== 'personal') {
                    const cid = Number(task.case_id)
                    if (task.case_type === 'surrogate' || task.case_type === 'gc') {
                      const gc = surrogates.find(s => Number(s.id) === cid)
                      if (gc) { caseName = gc.name; caseLink = `/surrogates/${gc.id}` }
                    } else if (task.case_type === 'ip') {
                      const ip = ips.find(i => Number(i.id) === cid)
                      if (ip) { caseName = ip.names || ip.name; caseLink = `/intended-parents/${ip.id}` }
                    } else if (task.case_type === 'journey') {
                      const j = journeys.find(j => Number(j.id) === cid)
                      if (j) { caseName = j.label || j.gc_name; caseLink = `/journeys/${j.id}` }
                    }
                  }
                  return (
                  <div key={task.id} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${task.priority === 'high' || task.priority === 'urgent' ? 'border-red-200 bg-red-50/50' : 'border-stone-100'}`}>
                    <button onClick={() => completeTask(task.id)} className="text-stone-300 hover:text-green-600 shrink-0" title="Complete">
                      <Circle className="size-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                        {task.due_date && <span>{formatDate(task.due_date)}</span>}
                        {task.priority === 'high' && <span className="text-red-500 font-semibold">High</span>}
                        {task.priority === 'urgent' && <span className="text-red-600 font-semibold">Urgent</span>}
                        {caseName ? (
                          <Link to={caseLink} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors truncate max-w-[140px]">
                            {caseName}
                          </Link>
                        ) : (task.case_type === 'personal' || !task.case_id) ? (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">Personal</span>
                        ) : (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Case</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setEditingTask({ ...task })} className="text-stone-300 hover:text-[#283693] shrink-0" title="Edit">
                      <Pencil className="size-3" />
                    </button>
                  </div>
                  )
                })}
              </div>
            )}
            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <button onClick={() => setCompletedOpen(o => !o)} className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors w-full">
                  {completedOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Completed ({completedTasks.length})
                </button>
                {completedOpen && (
                  <div className="space-y-1.5 mt-2">
                    {completedTasks.map(task => (
                      <div key={task.id} className="rounded-lg border border-stone-100 px-3 py-2 flex items-center gap-2 opacity-60">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-500 line-through truncate">{task.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                            {task.completed_at && <span>Completed {formatDate(task.completed_at)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>}
        </Card>
      </div>

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
              <Button size="sm" disabled={!newTask.title.trim()} style={{ backgroundColor: '#283693' }} className="gap-1" onClick={async () => {
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
                <Button size="sm" disabled={!editingTask.title?.trim()} style={{ backgroundColor: '#283693' }} className="gap-1" onClick={saveEditTask}>
                  <Check className="size-3" /> Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* My Cases — separated by type */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-700">{showAllCases ? 'All Cases' : 'My Cases'} ({myJourneys.length + mySurrogates.length + myIPs.length})</h3>
          <div className="flex items-center border rounded-md">
            <Button variant={caseView === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-r-none size-8" onClick={() => setCaseView('grid')}>
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button variant={caseView === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none size-8" onClick={() => setCaseView('list')}>
              <ListIcon className="size-3.5" />
            </Button>
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
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Stage</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500">Manager</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myJourneys.map(j => {
                          const gc = surrogates.find(s => s.id === j.gc_case_id)
                          const ip = ips.find(i => i.id === j.ip_case_id)
                          return (
                            <tr key={j.id} className="border-b last:border-0 hover:bg-stone-50/50 cursor-pointer" onClick={() => window.location.href = `/journeys/${j.id}`}>
                              <td className="px-4 py-3">
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
                              <td className="px-4 py-3"><StageBadge stage={j.stage} status={j.status} /></td>
                              <td className="px-4 py-3 font-medium text-stone-600">{j.status || '—'}</td>
                              <td className="px-4 py-3 text-stone-500 text-xs">{getAdminStaff().find(a => a.email === j.assigned_to)?.name || '—'}</td>
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
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full size-2.5 bg-pink-500" />
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
              <FileText className="size-4 text-[#283693]" />
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
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSaveApptNotes} disabled={savingNote}>
              {savingNote ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />} Save Notes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

