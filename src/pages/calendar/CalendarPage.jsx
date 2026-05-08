import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Clock, User, Plus, Loader2, Trash2, Pencil, Calendar as CalendarIcon } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import {
  getGoogleStatus, connectGoogle, listCalendars, listEvents,
  createEvent, updateEvent, deleteEvent,
} from '@/lib/google'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MAX_VISIBLE_EVENTS = 2

// Event color mapping (Google Calendar uses colorId)
const EVENT_COLORS = {
  '1': 'bg-blue-100 text-blue-700 border-blue-200',
  '2': 'bg-green-100 text-green-700 border-green-200',
  '3': 'bg-purple-100 text-purple-700 border-purple-200',
  '4': 'bg-pink-100 text-pink-700 border-pink-200',
  '5': 'bg-amber-100 text-amber-700 border-amber-200',
  '6': 'bg-orange-100 text-orange-700 border-orange-200',
  '7': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  '8': 'bg-gray-100 text-gray-700 border-gray-200',
  '9': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '10': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '11': 'bg-red-100 text-red-700 border-red-200',
  default: 'bg-blue-100 text-blue-700 border-blue-200',
}

const DOT_COLORS = {
  '1': 'bg-blue-500',
  '2': 'bg-green-500',
  '3': 'bg-purple-500',
  '4': 'bg-pink-500',
  '5': 'bg-amber-500',
  '6': 'bg-orange-500',
  '7': 'bg-cyan-500',
  '8': 'bg-gray-500',
  '9': 'bg-indigo-500',
  '10': 'bg-emerald-500',
  '11': 'bg-red-500',
  default: 'bg-blue-500',
}

// Calendar background colors (Google uses hex)
const CALENDAR_COLORS = [
  '#4285f4', '#7cb342', '#8e24aa', '#e67c73', '#f6bf26',
  '#f4511e', '#039be5', '#616161', '#3f51b5', '#0b8043', '#d50000',
]

function getCalendarColor(index) {
  return CALENDAR_COLORS[index % CALENDAR_COLORS.length]
}

function getCalendarEventStyle(event, calendars) {
  const cal = calendars.find(c => c.id === event._calendarId)
  const bgColor = cal?.backgroundColor || getCalendarColor(calendars.indexOf(cal))
  if (!bgColor) return {}
  return { backgroundColor: bgColor + '20', color: bgColor, borderColor: bgColor + '40' }
}

function getCalendarDotColor(event, calendars) {
  const cal = calendars.find(c => c.id === event._calendarId)
  return cal?.backgroundColor || getCalendarColor(calendars.indexOf(cal)) || '#4285f4'
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function isToday(year, month, day) {
  const today = new Date()
  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
}

function formatEventTime(event) {
  if (event.start?.date) return 'All day'
  if (event.start?.dateTime) {
    const d = new Date(event.start.dateTime)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return ''
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function getEventDateKey(event) {
  if (event.start?.date) return event.start.date
  if (event.start?.dateTime) return event.start.dateTime.split('T')[0]
  return ''
}

// ── Not Connected State ─────────────────────────────────

function NotConnectedState({ userId }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <CalendarIcon className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Connect your Google account</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Connect your Google Calendar to view and manage events.
      </p>
      <Button onClick={() => connectGoogle(userId)}>
        Connect Google Account
      </Button>
    </div>
  )
}

// ── Create/Edit Event Dialog ────────────────────────────

function EventFormDialog({ open, onOpenChange, userId, editEvent, calendars, onSaved }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [calendarId, setCalendarId] = useState('primary')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editEvent) {
      setTitle(editEvent.summary || '')
      setDescription(editEvent.description || '')
      setLocation(editEvent.location || '')
      setAllDay(!!editEvent.start?.date)
      if (editEvent.start?.date) {
        setDate(editEvent.start.date)
        setStartTime('')
        setEndTime('')
      } else if (editEvent.start?.dateTime) {
        const start = new Date(editEvent.start.dateTime)
        const end = editEvent.end?.dateTime ? new Date(editEvent.end.dateTime) : null
        setDate(start.toISOString().split('T')[0])
        setStartTime(start.toTimeString().slice(0, 5))
        setEndTime(end ? end.toTimeString().slice(0, 5) : '')
      }
      setCalendarId(editEvent._calendarId || 'primary')
    } else {
      const now = new Date()
      setTitle('')
      setDate(now.toISOString().split('T')[0])
      setStartTime('09:00')
      setEndTime('10:00')
      setAllDay(false)
      setDescription('')
      setLocation('')
      setCalendarId('primary')
    }
  }, [open, editEvent])

  const handleSave = async () => {
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      const eventData = {
        summary: title.trim(),
        description: description || undefined,
        location: location || undefined,
      }

      if (allDay) {
        eventData.start = { date }
        // Google Calendar all-day end is exclusive (next day)
        const endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 1)
        eventData.end = { date: endDate.toISOString().split('T')[0] }
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        eventData.start = { dateTime: `${date}T${startTime || '09:00'}:00`, timeZone: tz }
        eventData.end = { dateTime: `${date}T${endTime || '10:00'}:00`, timeZone: tz }
      }

      if (editEvent) {
        await updateEvent(userId, editEvent._calendarId || 'primary', editEvent.id, eventData)
      } else {
        await createEvent(userId, calendarId, eventData)
      }
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      alert('Failed to save event: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" />

          {!editEvent && calendars.length > 1 && (
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger>
                <SelectValue placeholder="Calendar" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.summary}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="accent-abc-indigo" />
            All day
          </label>

          {!allDay && (
            <div className="flex items-center gap-2">
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          )}

          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" />

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {editEvent ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Calendar Page ──────────────────────────────────

export default function CalendarPage() {
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [connected, setConnected] = useState(null)
  const [calendars, setCalendars] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [visibleCalendars, setVisibleCalendars] = useState(new Set())
  const [view, setView] = useState('month') // 'month' | 'week'

  function toggleCalendar(calId) {
    setVisibleCalendars(prev => {
      const next = new Set(prev)
      if (next.has(calId)) next.delete(calId)
      else next.add(calId)
      return next
    })
  }

  // Check connection
  useEffect(() => {
    if (!userId) return
    getGoogleStatus(userId)
      .then(s => setConnected(s.connected))
      .catch(() => setConnected(false))
  }, [userId])

  // Fetch calendars on connect
  useEffect(() => {
    if (!connected || !userId) return
    listCalendars(userId)
      .then(cals => {
        const writable = cals.filter(c => c.accessRole === 'owner' || c.accessRole === 'writer' || c.accessRole === 'reader')
        setCalendars(writable)
        setVisibleCalendars(new Set(writable.map(c => c.id)))
      })
      .catch(() => {})
  }, [connected, userId])

  // Fetch events for current month
  const fetchMonthEvents = useCallback(async () => {
    if (!connected || !userId) return
    setLoading(true)
    try {
      const timeMin = new Date(currentYear, currentMonth, 1).toISOString()
      const timeMax = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString()

      // Fetch from all writable calendars
      const calIds = calendars.length > 0 ? calendars.map(c => c.id) : ['primary']
      const allEvents = []

      for (const calId of calIds) {
        try {
          const data = await listEvents(userId, { calendarId: calId, timeMin, timeMax, maxResults: 200 })
          const items = (data.items || []).map(e => ({ ...e, _calendarId: calId, _calendarName: calendars.find(c => c.id === calId)?.summary || 'Calendar' }))
          allEvents.push(...items)
        } catch {}
      }

      // Deduplicate by event id
      const unique = []
      const seen = new Set()
      for (const e of allEvents) {
        if (!seen.has(e.id)) {
          seen.add(e.id)
          unique.push(e)
        }
      }

      setEvents(unique)
    } catch (err) {
      console.error('Failed to fetch events:', err)
    }
    setLoading(false)
  }, [connected, userId, currentYear, currentMonth, calendars])

  useEffect(() => {
    fetchMonthEvents()
  }, [fetchMonthEvents])

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const calendarGrid = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth === 0 ? 11 : currentMonth - 1)
    const cells = []
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, inMonth: false })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true })
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) cells.push({ day: d, inMonth: false })
    return cells
  }, [currentYear, currentMonth])

  const filteredEvents = useMemo(() => {
    if (visibleCalendars.size === 0) return events
    return events.filter(ev => visibleCalendars.has(ev._calendarId))
  }, [events, visibleCalendars])

  const eventsByDate = useMemo(() => {
    const map = {}
    filteredEvents.forEach(ev => {
      const key = getEventDateKey(ev)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })
    return map
  }, [filteredEvents])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return filteredEvents
      .filter(ev => {
        const d = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date + 'T23:59:59') : null
        return d && d >= now
      })
      .sort((a, b) => {
        const da = a.start?.dateTime || a.start?.date || ''
        const db = b.start?.dateTime || b.start?.date || ''
        return da.localeCompare(db)
      })
      .slice(0, 7)
  }, [events])

  const dateKey = (day) => {
    const m = String(currentMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${currentYear}-${m}-${d}`
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !userId) return
    if (!confirm('Delete this event?')) return
    setDeleting(true)
    try {
      await deleteEvent(userId, selectedEvent._calendarId || 'primary', selectedEvent.id)
      setSelectedEvent(null)
      fetchMonthEvents()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
    setDeleting(false)
  }

  const handleEditEvent = () => {
    setEditEvent(selectedEvent)
    setSelectedEvent(null)
    setCreateOpen(true)
  }

  // Loading / not connected
  if (connected === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendar" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendar" />
        <NotConnectedState userId={userId} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditEvent(null); setCreateOpen(true) }}>
              <Plus className="size-4" />
              New Event
            </Button>
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-lg font-heading font-semibold min-w-[180px] text-center">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      {loading && events.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="flex gap-6">
        {/* Left Sidebar — My Calendars */}
        <div className="w-56 shrink-0 space-y-4 hidden lg:block">
          {/* Today button */}
          <Button variant="outline" size="sm" className="w-full" onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }}>
            Today
          </Button>

          {/* My Calendars */}
          {calendars.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">My Calendars</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {calendars.map((cal, idx) => {
                  const color = cal.backgroundColor || getCalendarColor(idx)
                  const isVisible = visibleCalendars.has(cal.id)
                  return (
                    <label key={cal.id} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                      <div
                        className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center transition-colors ${isVisible ? '' : 'opacity-30'}`}
                        style={{ borderColor: color, backgroundColor: isVisible ? color : 'transparent' }}
                        onClick={() => toggleCalendar(cal.id)}
                      >
                        {isVisible && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className={`text-xs truncate group-hover:text-foreground transition-colors ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {cal.summary || 'Calendar'}
                      </span>
                    </label>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Upcoming */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No upcoming events.</p>
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map(ev => {
                    const dotColor = getCalendarDotColor(ev, calendars)
                    return (
                      <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                        className="flex items-start gap-2 w-full text-left group cursor-pointer">
                        <div className="size-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: dotColor }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate group-hover:text-abc-indigo transition-colors">
                            {ev.summary || '(No title)'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {ev.start?.dateTime ? formatEventTime(ev) : 'All day'}
                            {ev.start?.date && ` · ${new Date(ev.start.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            {ev.start?.dateTime && ` · ${new Date(ev.start.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar Grid */}
        <Card className="flex-1 rounded-2xl">
          <CardContent>
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 border-t border-l">
              {calendarGrid.map((cell, i) => {
                const dayEvents = cell.inMonth ? (eventsByDate[dateKey(cell.day)] || []) : []
                const todayHighlight = cell.inMonth && isToday(currentYear, currentMonth, cell.day)
                const overflow = dayEvents.length > MAX_VISIBLE_EVENTS

                return (
                  <div
                    key={i}
                    className={`border-r border-b min-h-[100px] p-1 ${cell.inMonth ? 'bg-card' : 'bg-muted/30'}`}
                  >
                    <div className={`text-xs font-medium mb-0.5 px-1 ${
                      todayHighlight
                        ? 'inline-flex items-center justify-center size-6 rounded-full bg-[#4285f4] text-white'
                        : cell.inMonth ? 'text-foreground' : 'text-muted-foreground/50'
                    }`}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map(ev => {
                        const style = getCalendarEventStyle(ev, calendars)
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className="block w-full text-left text-[10px] leading-tight font-medium px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80 border"
                            style={style}
                          >
                            {ev.start?.dateTime ? formatEventTime(ev) + ' ' : ''}{ev.summary || '(No title)'}
                          </button>
                        )
                      })}
                      {overflow && (
                        <button
                          onClick={() => setSelectedDayEvents({
                            dateLabel: new Date(currentYear, currentMonth, cell.day).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            }),
                            events: dayEvents,
                          })}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 cursor-pointer font-medium"
                        >
                          +{dayEvents.length - MAX_VISIBLE_EVENTS} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={open => { if (!open) setSelectedEvent(null) }}>
        <DialogContent>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.summary || '(No title)'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>
                    {selectedEvent.start?.date
                      ? formatDateFull(selectedEvent.start.date + 'T00:00:00') + ' · All day'
                      : formatDateFull(selectedEvent.start?.dateTime) + ' · ' + formatEventTime(selectedEvent)
                    }
                    {selectedEvent.end?.dateTime && ` — ${new Date(selectedEvent.end.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>📍</span>
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent._calendarName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="size-4" />
                    <span>{selectedEvent._calendarName}</span>
                  </div>
                )}
                {selectedEvent.description && (
                  <div className="text-sm whitespace-pre-wrap">
                    {selectedEvent.description.split('\n').map((line, i) => {
                      // Auto-link URLs in description
                      const urlMatch = line.match(/^(https?:\/\/\S+)$/)
                      if (urlMatch) {
                        // Convert app URLs to internal links
                        const url = urlMatch[1]
                        const appPath = url.match(/app\.abcsurrogacy\.com(\/[^\s]+)/) || url.match(/localhost:\d+(\/[^\s]+)/)
                        if (appPath) {
                          return <a key={i} href={appPath[1]} className="text-[#1A3638] hover:underline block">{line}</a>
                        }
                        return <a key={i} href={url} target="_blank" rel="noopener" className="text-[#1A3638] hover:underline block">{line}</a>
                      }
                      return <span key={i}>{line}{i < selectedEvent.description.split('\n').length - 1 ? '\n' : ''}</span>
                    })}
                  </div>
                )}
                {selectedEvent.attendees?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Attendees</p>
                    <div className="space-y-1">
                      {selectedEvent.attendees.map((a, i) => (
                        <p key={i} className="text-sm">{a.displayName || a.email}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handleDeleteEvent} disabled={deleting} className="text-destructive hover:text-destructive">
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Delete
                </Button>
                <Button size="sm" onClick={handleEditEvent}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Day Overflow Dialog */}
      <Dialog open={!!selectedDayEvents} onOpenChange={open => { if (!open) setSelectedDayEvents(null) }}>
        <DialogContent className="max-w-lg">
          {selectedDayEvents && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDayEvents.dateLabel}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {selectedDayEvents.events.map((ev) => {
                  const style = getCalendarEventStyle(ev, calendars)
                  return (
                    <button
                      key={ev.id}
                      onClick={() => {
                        setSelectedDayEvents(null)
                        setSelectedEvent(ev)
                      }}
                      className="block w-full text-left rounded-lg border px-3 py-2 hover:opacity-80 transition-opacity"
                      style={style}
                    >
                      <div className="text-sm font-medium">{ev.summary || '(No title)'}</div>
                      <div className="text-xs opacity-80 mt-1">
                        {ev.start?.date
                          ? 'All day'
                          : `${formatEventTime(ev)}${ev.end?.dateTime ? ` - ${new Date(ev.end.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Event Dialog */}
      <EventFormDialog
        open={createOpen}
        onOpenChange={open => { setCreateOpen(open); if (!open) setEditEvent(null) }}
        userId={userId}
        editEvent={editEvent}
        calendars={calendars}
        onSaved={fetchMonthEvents}
      />
    </div>
  )
}
