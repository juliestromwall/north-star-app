import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, CalendarDays, Clock, Trash2, Loader2, Pencil, History, CheckCircle2, FileText, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useRole } from '@/context/RoleContext'
import { listCaseEvents, createEvent, deleteEvent, updateEvent, listCalendars } from '@/lib/google'
import { getAppConfig, setAppConfig } from '@/lib/db'
import { formatDate } from '@/lib/utils'

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return ''
  return new Date(dateTimeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isToday(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
}

const APPT_NOTES_KEY_PREFIX = 'appt_notes_'

/**
 * Normalize an appointment-meta `notes` field into a list of entries.
 * Legacy shape was a single string at `meta.notes` plus `meta.notesBy/notesAt`.
 * New shape is `meta.notesEntries` = [{ id, body, date, by, at }, ...].
 * Returned list is OLDEST → NEWEST so callers can render top-to-bottom directly.
 */
export function normalizeApptNotes(meta) {
  if (!meta) return []
  if (Array.isArray(meta.notesEntries) && meta.notesEntries.length) {
    return [...meta.notesEntries].sort((a, b) => (a.at || a.date || '').localeCompare(b.at || b.date || ''))
  }
  if (typeof meta.notes === 'string' && meta.notes.trim()) {
    return [{
      id: 'legacy',
      body: meta.notes,
      date: (meta.notesAt || '').slice(0, 10) || null,
      by: meta.notesBy || '',
      at: meta.notesAt || null,
    }]
  }
  return []
}

export default function CaseCalendarWidget({ caseId, caseType, caseName, onAttentionCountChange }) {
  const { currentUser } = useRole()
  const userId = currentUser?.userId || currentUser?.id
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [calendars, setCalendars] = useState([])
  const [defaultCalId, setDefaultCalId] = useState('primary')
  const [apptMeta, setApptMeta] = useState({}) // { eventId: { followedUp, followedUpBy, followedUpAt, notes } }
  const [notesModal, setNotesModal] = useState(null) // event being noted
  const [noteText, setNoteText] = useState('')
  const [noteDate, setNoteDate] = useState('') // date attached to the note being added
  const [savingNote, setSavingNote] = useState(false)
  const [followingUp, setFollowingUp] = useState(null)
  // Editing an existing note entry
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')

  useEffect(() => {
    if (!caseId || !userId) { setLoading(false); return }
    // Load appointment metadata
    getAppConfig(`${APPT_NOTES_KEY_PREFIX}${caseType}_${caseId}`).then(data => {
      if (data) setApptMeta(data)
    }).catch(() => {})

    const now = new Date()
    const timeMin = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString()
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()).toISOString()
    listCalendars(userId).catch(() => []).then(cals => {
      const writable = (cals || []).filter(c => c.accessRole === 'owner' || c.accessRole === 'writer')
      setCalendars(writable)
      const apptCal = writable.find(c => c.summary?.toLowerCase() === 'appointments')
      const calId = apptCal?.id || 'primary'
      if (apptCal) setDefaultCalId(calId)
      const fetches = [listCaseEvents(userId, caseId, caseType, { calendarId: 'primary', timeMin, timeMax, maxResults: 50 })]
      if (apptCal) fetches.push(listCaseEvents(userId, caseId, caseType, { calendarId: calId, timeMin, timeMax, maxResults: 50 }))
      return Promise.all(fetches).then(async (results) => {
        let all = results.flatMap(r => r.items || [])
        if (all.length === 0 && caseName) {
          try {
            const params = new URLSearchParams({ timeMin, timeMax, maxResults: '50', singleEvents: 'true', orderBy: 'startTime', q: caseName })
            const token = await (await import('@/lib/google')).getAccessToken(userId)
            const calIds = [calId]
            if (calId !== 'primary') calIds.push('primary')
            for (const cid of calIds) {
              const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cid)}/events?${params}`, { headers: { Authorization: `Bearer ${token}` } })
              if (res.ok) { const data = await res.json(); all.push(...(data.items || [])) }
            }
          } catch {}
        }
        return all
      })
    }).then(all => {
      const seen = new Set()
      const deduped = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
      setEvents(deduped.sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || '')))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [caseId, userId])

  // Report count of today's events not yet followed up so the parent can show
  // an attention dot on a tab. Re-runs when events or apptMeta changes.
  useEffect(() => {
    if (!onAttentionCountChange) return
    const count = events.filter(ev => {
      const start = ev.start?.dateTime || ev.start?.date
      if (!start || !isToday(start)) return false
      const meta = apptMeta[ev.id] || {}
      const isFollowedUp = meta.followedUp || /^✅/.test(ev.summary || '')
      return !isFollowedUp
    }).length
    onAttentionCountChange(count)
  }, [events, apptMeta, onAttentionCountChange])

  async function saveApptMeta(updated) {
    setApptMeta(updated)
    await setAppConfig(`${APPT_NOTES_KEY_PREFIX}${caseType}_${caseId}`, updated).catch(() => {})
  }

  function getCaseUrl() {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    if (caseType === 'journey') return `${base}/journeys/${caseId}`
    if (caseType === 'ip') return `${base}/intended-parents/${caseId}`
    return `${base}/surrogates/${caseId}`
  }

  async function handleCreate(eventData) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const caseLabel = caseName || `${caseType} #${caseId}`
    const caseLink = getCaseUrl()
    const descParts = [caseLabel, caseLink]
    if (eventData.description) descParts.push('', eventData.description)
    const event = {
      summary: `${eventData.title} — ${caseLabel}`,
      description: descParts.join('\n'),
      start: eventData.allDay ? { date: eventData.date } : { dateTime: `${eventData.date}T${eventData.startTime}:00`, timeZone: tz },
      end: eventData.allDay ? { date: eventData.date } : { dateTime: `${eventData.date}T${eventData.endTime || eventData.startTime}:00`, timeZone: tz },
      extendedProperties: {
        private: { caseId: `${caseType}_${caseId}`, caseType, abcCase: 'true' },
      },
    }
    try {
      const calId = eventData.calendarId || defaultCalId
      const created = await createEvent(userId, calId, event)
      setEvents(prev => [...prev, created].sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || '')))
      setAddOpen(false)
    } catch (err) { alert('Failed to create: ' + err.message) }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    const eventId = deleteConfirm.id
    setDeleting(eventId)
    try {
      const calIds = [defaultCalId]
      if (defaultCalId !== 'primary') calIds.push('primary')
      let deleted = false
      for (const calId of calIds) {
        try { await deleteEvent(userId, calId, eventId); deleted = true; break } catch {}
      }
      if (!deleted) throw new Error('Event not found on any calendar')
      setEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (err) { alert('Failed to delete: ' + err.message) }
    finally { setDeleting(null); setDeleteConfirm(null) }
  }

  async function handleEdit(eventData) {
    if (!editEvent) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const updates = {
      summary: `${eventData.title} — ${caseName || ''}`,
      description: editEvent.description || '',
      start: eventData.allDay ? { date: eventData.date } : { dateTime: `${eventData.date}T${eventData.startTime}:00`, timeZone: tz },
      end: eventData.allDay ? { date: eventData.date } : { dateTime: `${eventData.date}T${eventData.endTime || eventData.startTime}:00`, timeZone: tz },
    }
    try {
      const calIds = [defaultCalId]
      if (defaultCalId !== 'primary') calIds.push('primary')
      let updated = null
      for (const calId of calIds) {
        try { updated = await updateEvent(userId, calId, editEvent.id, updates); break } catch {}
      }
      if (!updated) throw new Error('Event not found on any calendar')
      setEvents(prev => prev.map(e => e.id === editEvent.id ? updated : e).sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || '')))
      setEditEvent(null)
    } catch (err) { alert('Failed to update: ' + err.message) }
  }

  async function handleFollowUp(event) {
    setFollowingUp(event.id)
    try {
      // Update Google Calendar title to add ✅
      const currentTitle = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
      const cleanTitle = currentTitle.replace(/^✅\s*/, '') // remove if already there
      const newSummary = `✅ ${cleanTitle} — ${caseName || ''}`
      const calIds = [defaultCalId]
      if (defaultCalId !== 'primary') calIds.push('primary')
      let updated = null
      for (const calId of calIds) {
        try { updated = await updateEvent(userId, calId, event.id, { summary: newSummary }); break } catch {}
      }
      if (updated) {
        setEvents(prev => prev.map(e => e.id === event.id ? updated : e))
      }
      // Log follow-up metadata
      const meta = { ...apptMeta, [event.id]: { ...(apptMeta[event.id] || {}), followedUp: true, followedUpBy: currentUser?.name || 'Admin', followedUpAt: new Date().toISOString() } }
      await saveApptMeta(meta)
    } catch (err) { alert('Failed: ' + err.message) }
    finally { setFollowingUp(null) }
  }

  async function handleSaveEdit() {
    if (!notesModal || !editingId || !editText.trim()) return
    setSavingNote(true)
    try {
      const existing = normalizeApptNotes(apptMeta[notesModal.id])
      // If we're editing a legacy single-string note, give it a real id so future edits stay stable
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
      await saveApptMeta(meta)
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
          // Keep legacy fields in sync (latest note) for backwards compatibility
          notes: notesEntries[notesEntries.length - 1]?.body || '',
          notesBy: newEntry.by,
          notesAt: newEntry.at,
        },
      }
      await saveApptMeta(meta)
      // Clear input so admin can add another, but keep modal open so they can see history
      setNoteText('')
      setNoteDate(new Date().toISOString().split('T')[0])
    } catch {} finally { setSavingNote(false) }
  }

  const [pastOpen, setPastOpen] = useState(false)
  const ChevronDown = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
  const ChevronRight = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>

  function getEventDate(e) {
    const dt = e.start?.dateTime || e.start?.date || ''
    return dt.substring(0, 10)
  }
  const todayStr = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter(e => getEventDate(e) >= todayStr)
  const pastEvents = [...events.filter(e => getEventDate(e) < todayStr)].reverse()

  if (loading) return <div className="text-center py-8 text-stone-400 text-sm">Loading appointments...</div>

  function getDisplayTitle(event) {
    const raw = event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary || ''
    // Strip the legacy ✅ prefix — the followed-up state is shown as a styled
    // badge in the UI now instead of an emoji prepended to the title.
    return raw.replace(/^✅\s*/, '')
  }

  function EventRow({ event, isPast }) {
    const startDt = event.start?.dateTime || event.start?.date || ''
    const isAllDay = !!event.start?.date && !event.start?.dateTime
    const today = isToday(startDt)
    const meta = apptMeta[event.id] || {}
    const title = getDisplayTitle(event)
    // Detect via the meta flag OR the legacy ✅ prefix on the calendar title
    const isFollowedUp = meta.followedUp || /^✅/.test(event.summary || '')
    const noteEntries = normalizeApptNotes(meta)
    const latestNote = noteEntries[noteEntries.length - 1]

    return (
      <div className={`rounded-lg border px-3 py-2 ${isPast ? 'opacity-60' : today ? 'border-[#1A3638]/30 bg-[#1A3638]/5' : 'border-stone-100'}`}>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={`text-sm ${today ? 'font-semibold text-[#1A3638]' : 'text-stone-800'}`}>{title}</p>
              {isFollowedUp && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-semibold border border-emerald-200">
                  <CheckCircle2 className="size-2.5" /> Followed Up
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
              <span>{formatDate(startDt)}</span>
              {!isAllDay && event.start?.dateTime && (
                <span className="flex items-center gap-0.5">
                  <Clock className="size-2.5" />
                  {formatTime(event.start.dateTime)}
                  {event.end?.dateTime ? ` – ${formatTime(event.end.dateTime)}` : ''}
                </span>
              )}
              {today && <span className="text-[#1A3638] font-semibold">Today</span>}
              {noteEntries.length > 1 && <span className="text-stone-400">{noteEntries.length} notes</span>}
            </div>
            {latestNote && (
              <p className="text-[10px] text-stone-500 mt-1 italic border-l-2 border-stone-200 pl-2">{latestNote.body.slice(0, 120)}{latestNote.body.length > 120 ? '...' : ''}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0 items-end">
            <div className="flex gap-1">
              <button onClick={() => setEditEvent(event)} className="text-stone-300 hover:text-stone-600" title="Edit"><Pencil className="size-3" /></button>
              <button onClick={() => setDeleteConfirm(event)} className="text-stone-300 hover:text-red-500" disabled={deleting === event.id}>
                {deleting === event.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </button>
            </div>
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
              onClick={() => { setNotesModal(event); setNoteText(''); setNoteDate(new Date().toISOString().split('T')[0]) }}
              className="inline-flex items-center gap-1 text-[9px] font-medium text-stone-500 hover:text-[#1A3638] bg-stone-50 hover:bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200 transition-colors"
            >
              <FileText className="size-2.5" />
              {noteEntries.length > 0 ? 'Add Another Note' : 'Add Note'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
          <CalendarDays className="size-4 text-stone-400" /> Appointments
        </h3>
        <Button size="sm" className="gap-1 text-xs h-7" style={{ backgroundColor: '#1A3638' }} onClick={() => setAddOpen(true)}>
          <Plus className="size-3" /> Add Appointment
        </Button>
      </div>

      {upcomingEvents.length === 0 ? (
        <p className="text-xs text-stone-400 py-4 text-center">No upcoming appointments</p>
      ) : (
        <div className="space-y-1.5">
          {upcomingEvents.map(event => <EventRow key={event.id} event={event} />)}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => { if (!v) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="size-4" /> Delete Appointment
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            Are you sure you want to delete <strong>{getDisplayTitle(deleteConfirm || {})}</strong>?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting} className="gap-1">
              {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Past Appointments — collapsible inline */}
      {pastEvents.length > 0 && (
        <div className="space-y-1.5">
          <button onClick={() => setPastOpen(o => !o)} className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1 hover:text-stone-600 transition-colors">
            {pastOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <History className="size-3" /> Past Appointments ({pastEvents.length})
          </button>
          {pastOpen && (
            <div className="space-y-1.5">
              {pastEvents.map(event => <EventRow key={event.id} event={event} isPast />)}
            </div>
          )}
        </div>
      )}

      {/* Appointment Notes Modal — multi-entry */}
      <Dialog open={!!notesModal} onOpenChange={v => { if (!v) { setNotesModal(null); setNoteText(''); setNoteDate(''); setEditingId(null); setEditText(''); setEditDate('') } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-[#1A3638]" />
              Appointment Notes
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-stone-700 font-semibold">{getDisplayTitle(notesModal || {})}</p>
            {(apptMeta[notesModal?.id]?.followedUp || /^✅/.test(notesModal?.summary || '')) && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                <CheckCircle2 className="size-3" /> Followed Up
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400">{notesModal?.start?.dateTime ? formatDate(notesModal.start.dateTime) : notesModal?.start?.date ? formatDate(notesModal.start.date) : ''}</p>

          {/* Prior notes — oldest → newest, top to bottom. Each entry has an inline edit mode. */}
          {(() => {
            const entries = normalizeApptNotes(apptMeta[notesModal?.id])
            if (entries.length === 0) return null
            return (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Previous Notes</p>
                {entries.map(e => {
                  const isEditing = editingId === e.id
                  if (isEditing) {
                    return (
                      <div key={e.id} className="rounded-lg border border-[#1A3638]/30 bg-[#1A3638]/5 px-3 py-2 space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-stone-500">Note Date</label>
                          <Input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)} className="h-8 text-xs" />
                        </div>
                        <Textarea value={editText} onChange={ev => setEditText(ev.target.value)} rows={3} className="text-xs" />
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => { setEditingId(null); setEditText(''); setEditDate('') }}>
                            <X className="size-3" /> Cancel
                          </Button>
                          <Button size="sm" className="h-7 text-[11px] gap-1" style={{ backgroundColor: '#1A3638' }} onClick={handleSaveEdit} disabled={savingNote || !editText.trim()}>
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
                            className="text-stone-400 hover:text-[#1A3638]"
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

          {/* New note input */}
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
            <Textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Type your follow-up note..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Done</Button></DialogClose>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#1A3638' }} onClick={handleAppendNote} disabled={savingNote || !noteText.trim()}>
              {savingNote ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddAppointmentDialog open={addOpen} onOpenChange={setAddOpen} onSave={handleCreate} calendars={calendars} defaultCalId={defaultCalId} />
      <AddAppointmentDialog
        open={!!editEvent}
        onOpenChange={v => { if (!v) setEditEvent(null) }}
        onSave={handleEdit}
        initialData={editEvent ? {
          title: (editEvent.summary?.includes(' — ') ? editEvent.summary.split(' — ')[0] : editEvent.summary)?.replace(/^✅\s*/, '') || '',
          date: (editEvent.start?.dateTime || editEvent.start?.date || '').slice(0, 10),
          startTime: editEvent.start?.dateTime ? new Date(editEvent.start.dateTime).toTimeString().slice(0, 5) : '09:00',
          endTime: editEvent.end?.dateTime ? new Date(editEvent.end.dateTime).toTimeString().slice(0, 5) : '10:00',
          description: editEvent.description || '',
          allDay: !!editEvent.start?.date && !editEvent.start?.dateTime,
        } : null}
        editMode
      />
    </div>
  )
}

function AddAppointmentDialog({ open, onOpenChange, onSave, initialData, editMode, calendars = [], defaultCalId = 'primary' }) {
  const [form, setForm] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00', description: '', allDay: true, calendarId: defaultCalId })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({ title: initialData.title || '', date: initialData.date || '', startTime: initialData.startTime || '09:00', endTime: initialData.endTime || '10:00', description: initialData.description || '', allDay: initialData.allDay ?? true, calendarId: defaultCalId })
      } else {
        // New appointment defaults: empty date (forces user to pick) + All Day on
        setForm({ title: '', date: '', startTime: '09:00', endTime: '10:00', description: '', allDay: true, calendarId: defaultCalId })
      }
    }
  }, [open])

  async function handleSave() {
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    try { await onSave(form) } catch {} finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editMode ? 'Edit Appointment' : 'Add Appointment'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Title *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. OB Appointment, Transfer Date" className="h-9" autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Date *</label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-9" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="allDay" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} className="rounded" />
            <label htmlFor="allDay" className="text-xs text-stone-600">All day</label>
          </div>
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Start Time</label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">End Time</label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="h-9" />
              </div>
            </div>
          )}
          {calendars.length > 1 && !editMode && (
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Calendar</label>
              <select value={form.calendarId} onChange={e => setForm(f => ({ ...f, calendarId: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                {calendars.map(c => (
                  <option key={c.id} value={c.id}>{c.summary || c.id}{c.summary?.toLowerCase() === 'appointments' ? ' (default)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          {editMode ? (
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Calendar API Note</label>
              <div className="text-xs text-stone-400 bg-stone-50 border border-stone-200 rounded-md px-3 py-2 whitespace-pre-wrap min-h-[40px]">
                {form.description || <span className="italic">No calendar note</span>}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Notes</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={2} />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#1A3638' }} onClick={handleSave} disabled={saving || !form.title.trim() || !form.date}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <CalendarDays className="size-3" />}
              {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Add Appointment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
