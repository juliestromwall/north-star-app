import { useState, useEffect } from 'react'
import { Plus, CalendarDays, Clock, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRole } from '@/context/RoleContext'
import { listCaseEvents, createEvent, deleteEvent } from '@/lib/google'
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

export default function CaseCalendarWidget({ caseId, caseType }) {
  const { currentUser } = useRole()
  const userId = currentUser?.userId || currentUser?.id
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!caseId || !userId) { setLoading(false); return }
    const now = new Date()
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString()
    listCaseEvents(userId, caseId, caseType, { timeMin, timeMax, maxResults: 20 })
      .then(data => setEvents(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId, userId])

  async function handleCreate(eventData) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const event = {
      summary: eventData.title,
      description: eventData.description || '',
      start: eventData.allDay ? { date: eventData.date } : { dateTime: `${eventData.date}T${eventData.startTime}:00`, timeZone: tz },
      end: eventData.allDay ? { date: eventData.date } : { dateTime: `${eventData.date}T${eventData.endTime || eventData.startTime}:00`, timeZone: tz },
      extendedProperties: {
        private: { caseId: `${caseType}_${caseId}`, caseType, abcCase: 'true' },
      },
    }
    try {
      const created = await createEvent(userId, 'primary', event)
      setEvents(prev => [...prev, created].sort((a, b) => (a.start?.dateTime || a.start?.date || '').localeCompare(b.start?.dateTime || b.start?.date || '')))
      setAddOpen(false)
    } catch (err) { alert('Failed to create: ' + err.message) }
  }

  async function handleDelete(eventId) {
    setDeleting(eventId)
    try {
      await deleteEvent(userId, 'primary', eventId)
      setEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (err) { alert('Failed to delete: ' + err.message) }
    finally { setDeleting(null) }
  }

  if (loading) return <div className="text-center py-8 text-stone-400 text-sm">Loading appointments...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
          <CalendarDays className="size-4 text-stone-400" /> Appointments
        </h3>
        <Button size="sm" className="gap-1 text-xs h-7" style={{ backgroundColor: '#283693' }} onClick={() => setAddOpen(true)}>
          <Plus className="size-3" /> Add Appointment
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-stone-400 py-4 text-center">No upcoming appointments</p>
      ) : (
        <div className="space-y-1.5">
          {events.map(event => {
            const startDt = event.start?.dateTime || event.start?.date || ''
            const isAllDay = !!event.start?.date && !event.start?.dateTime
            const today = isToday(startDt)
            return (
              <div key={event.id} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${today ? 'border-[#283693]/30 bg-[#283693]/5' : 'border-stone-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${today ? 'font-semibold text-[#283693]' : 'text-stone-800'}`}>{event.summary}</p>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                    <span>{formatDate(startDt)}</span>
                    {!isAllDay && event.start?.dateTime && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="size-2.5" />
                        {formatTime(event.start.dateTime)}
                        {event.end?.dateTime ? ` – ${formatTime(event.end.dateTime)}` : ''}
                      </span>
                    )}
                    {today && <span className="text-[#283693] font-semibold">Today</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(event.id)} className="text-stone-300 hover:text-red-500 shrink-0" disabled={deleting === event.id}>
                  {deleting === event.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <AddAppointmentDialog open={addOpen} onOpenChange={setAddOpen} onSave={handleCreate} />
    </div>
  )
}

function AddAppointmentDialog({ open, onOpenChange, onSave }) {
  const [form, setForm] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00', description: '', allDay: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', description: '', allDay: false })
  }, [open])

  async function handleSave() {
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    try { await onSave(form) } catch {} finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Appointment</DialogTitle></DialogHeader>
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
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Notes</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={2} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSave} disabled={saving || !form.title.trim() || !form.date}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <CalendarDays className="size-3" />}
              {saving ? 'Adding...' : 'Add Appointment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
