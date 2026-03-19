import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { calendarEvents, EVENT_TYPES } from '@/data/mock/calendarEvents'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MAX_VISIBLE_EVENTS = 2

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function isToday(year, month, day) {
  const today = new Date()
  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
}

export default function CalendarPage() {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedEvent, setSelectedEvent] = useState(null)

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  // Build calendar grid
  const calendarGrid = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth === 0 ? 11 : currentMonth - 1)
    const cells = []

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, inMonth: false })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inMonth: true })
    }

    // Next month leading days
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false })
    }

    return cells
  }, [currentYear, currentMonth])

  // Events indexed by date string
  const eventsByDate = useMemo(() => {
    const map = {}
    calendarEvents.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    })
    return map
  }, [])

  // Upcoming events from today
  const upcomingEvents = useMemo(() => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return calendarEvents
      .filter(ev => ev.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7)
  }, [])

  const dateKey = (day) => {
    const m = String(currentMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${currentYear}-${m}-${d}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 border-t border-l">
              {calendarGrid.map((cell, i) => {
                const events = cell.inMonth ? (eventsByDate[dateKey(cell.day)] || []) : []
                const todayHighlight = cell.inMonth && isToday(currentYear, currentMonth, cell.day)
                const overflow = events.length > MAX_VISIBLE_EVENTS

                return (
                  <div
                    key={i}
                    className={`border-r border-b min-h-[90px] p-1 ${
                      cell.inMonth ? 'bg-card' : 'bg-muted/30'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-0.5 px-1 ${
                      todayHighlight
                        ? 'inline-flex items-center justify-center size-6 rounded-full bg-abc-indigo text-white'
                        : cell.inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/50'
                    }`}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, MAX_VISIBLE_EVENTS).map(ev => {
                        const type = EVENT_TYPES[ev.type]
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className={`block w-full text-left text-[10px] leading-tight font-medium px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80 ${type.pill}`}
                          >
                            {ev.title}
                          </button>
                        )
                      })}
                      {overflow && (
                        <button
                          onClick={() => setSelectedEvent(events[MAX_VISIBLE_EVENTS])}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 cursor-pointer"
                        >
                          +{events.length - MAX_VISIBLE_EVENTS} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(ev => {
                  const type = EVENT_TYPES[ev.type]
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="flex items-start gap-3 w-full text-left group cursor-pointer"
                    >
                      <div className={`size-2 rounded-full mt-1.5 shrink-0 ${type.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-abc-indigo transition-colors">
                          {ev.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(ev.date)}{ev.time ? ` \u00B7 ${ev.time}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${type.pill}`}>
                        {type.label}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.title}</DialogTitle>
                <DialogDescription className="sr-only">Event details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={EVENT_TYPES[selectedEvent.type].pill} variant="outline">
                    {EVENT_TYPES[selectedEvent.type].label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>{formatDate(selectedEvent.date)}{selectedEvent.time ? ` \u00B7 ${selectedEvent.time}` : ''}</span>
                </div>
                {selectedEvent.relatedName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="size-4" />
                    <span>{selectedEvent.relatedName}</span>
                  </div>
                )}
                {selectedEvent.description && (
                  <p className="text-sm">{selectedEvent.description}</p>
                )}
              </div>
              <DialogFooter showCloseButton />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
