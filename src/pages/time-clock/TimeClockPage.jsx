import { useState, useEffect, useRef, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { Clock, ChevronLeft, ChevronRight, Pencil, Play, Square } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import {
  STAFF, PAY_PERIODS, INITIAL_TIME_ENTRIES,
  getCurrentPayPeriod, calculateHours, formatTime12h,
} from '@/data/mock/timeClockData'

export default function TimeClockPage() {
  const { currentUser, isAdmin, isMasterAdmin, isSuperAdmin } = useRole()

  // Guard: admin roles only
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  const canViewAllStaff = isMasterAdmin || isSuperAdmin
  const currentPeriod = getCurrentPayPeriod()

  // State
  const [timeEntries, setTimeEntries] = useState(INITIAL_TIME_ENTRIES)
  const [selectedPeriodId, setSelectedPeriodId] = useState(currentPeriod.id)
  const [selectedStaffId, setSelectedStaffId] = useState(currentUser.id)
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef(null)

  // Edit dialog state
  const [editingEntry, setEditingEntry] = useState(null)
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')

  const nextIdRef = useRef(100)

  // Check for active shift on staff change
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const activeEntry = timeEntries.find(
      (e) => e.staffId === selectedStaffId && e.date === today && !e.clockOut
    )
    if (activeEntry) {
      setIsClockedIn(true)
      setClockInTime(activeEntry.clockIn)
      const [h, m] = activeEntry.clockIn.split(':').map(Number)
      const now = new Date()
      const clockInDate = new Date()
      clockInDate.setHours(h, m, 0, 0)
      setElapsedSeconds(Math.max(0, Math.floor((now - clockInDate) / 1000)))
    } else {
      setIsClockedIn(false)
      setClockInTime(null)
      setElapsedSeconds(0)
    }
  }, [selectedStaffId])

  // Live timer
  useEffect(() => {
    if (isClockedIn) {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isClockedIn])

  const formatTimer = (totalSec) => {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Clock In
  const handleClockIn = () => {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)
    setTimeEntries((prev) => [...prev, {
      id: `t_new_${nextIdRef.current++}`,
      staffId: selectedStaffId,
      date: today,
      clockIn: timeStr,
      clockOut: null,
      status: 'pending',
    }])
    setClockInTime(timeStr)
    setIsClockedIn(true)
    setElapsedSeconds(0)
  }

  // Clock Out
  const handleClockOut = () => {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)
    setTimeEntries((prev) =>
      prev.map((e) =>
        e.staffId === selectedStaffId && e.date === today && !e.clockOut
          ? { ...e, clockOut: timeStr }
          : e
      )
    )
    setIsClockedIn(false)
    setClockInTime(null)
    setElapsedSeconds(0)
  }

  // Pay period navigation
  const periodIndex = PAY_PERIODS.findIndex((p) => p.id === selectedPeriodId)
  const selectedPeriod = PAY_PERIODS[periodIndex]
  const canGoPrev = periodIndex > 0
  const canGoNext = periodIndex < PAY_PERIODS.length - 1

  // Filter entries for selected period + staff
  const periodEntries = useMemo(() => {
    return timeEntries
      .filter((e) => {
        const inPeriod = e.date >= selectedPeriod.startDate && e.date <= selectedPeriod.endDate
        return inPeriod && e.staffId === selectedStaffId
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.clockIn.localeCompare(b.clockIn))
  }, [timeEntries, selectedPeriod, selectedStaffId])

  // Summary
  const totalHours = periodEntries.reduce((sum, e) => sum + calculateHours(e.clockIn, e.clockOut), 0)
  const daysWorked = new Set(periodEntries.map((e) => e.date)).size
  const avgDailyHours = daysWorked > 0 ? (totalHours / daysWorked).toFixed(1) : '0.0'

  // Edit handlers
  const openEditDialog = (entry) => {
    setEditingEntry(entry)
    setEditClockIn(entry.clockIn || '')
    setEditClockOut(entry.clockOut || '')
  }

  const handleSaveEdit = () => {
    if (!editingEntry) return
    setTimeEntries((prev) =>
      prev.map((e) =>
        e.id === editingEntry.id
          ? { ...e, clockIn: editClockIn, clockOut: editClockOut || null, status: 'edited' }
          : e
      )
    )
    setEditingEntry(null)
  }

  const editPreviewHours = editClockIn && editClockOut
    ? calculateHours(editClockIn, editClockOut)
    : null

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const staffName = STAFF.find((s) => s.id === selectedStaffId)?.name || ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Clock"
        subtitle="Track hours and manage time entries"
        actions={
          canViewAllStaff && (
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )
        }
      />

      {/* Top row: Clock In/Out + Pay Period Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clock In/Out Card */}
        <Card className={isClockedIn ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              {isClockedIn ? 'Currently Clocked In' : 'Clock In'}
            </CardTitle>
            <CardDescription>
              {isClockedIn
                ? `${staffName} clocked in at ${formatTime12h(clockInTime)}`
                : `${staffName} is not clocked in`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isClockedIn ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                  <span className="text-4xl font-mono font-bold tracking-wider tabular-nums">
                    {formatTimer(elapsedSeconds)}
                  </span>
                </div>
                <Button variant="destructive" onClick={handleClockOut} className="w-full">
                  <Square className="size-4 mr-2" />
                  Clock Out
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="size-4 mr-2" />
                Clock In
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pay Period Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pay Period Summary</CardTitle>
            <CardDescription>{selectedPeriod.label}, 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-3xl font-bold tabular-nums">{totalHours.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Worked</p>
                <p className="text-3xl font-bold tabular-nums">{daysWorked}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Daily</p>
                <p className="text-3xl font-bold tabular-nums">{avgDailyHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between w-full">
            <CardTitle>Time Entries</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedPeriodId(PAY_PERIODS[periodIndex - 1].id)}
                disabled={!canGoPrev}
                className="size-8"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {selectedPeriod.label}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedPeriodId(PAY_PERIODS[periodIndex + 1].id)}
                disabled={!canGoNext}
                className="size-8"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {periodEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No time entries for this period.
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodEntries.map((entry) => {
                    const hours = calculateHours(entry.clockIn, entry.clockOut)
                    const isActive = !entry.clockOut

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{formatDate(entry.date)}</TableCell>
                        <TableCell>{formatTime12h(entry.clockIn)}</TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Active
                            </Badge>
                          ) : (
                            formatTime12h(entry.clockOut)
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {isActive ? '—' : `${hours.toFixed(1)}h`}
                        </TableCell>
                        <TableCell>
                          {entry.status === 'edited' ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-medium">
                              Edited
                            </Badge>
                          ) : (
                            <StatusBadge status={entry.status} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              {editingEntry && formatDate(editingEntry.date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-clock-in">Clock In</Label>
              <Input
                id="edit-clock-in"
                type="time"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clock-out">Clock Out</Label>
              <Input
                id="edit-clock-out"
                type="time"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
              />
            </div>
            {editPreviewHours !== null && (
              <div className="rounded-md bg-muted p-3 text-center">
                <span className="text-sm text-muted-foreground">Total Hours: </span>
                <span className="font-bold text-lg">{editPreviewHours.toFixed(1)}h</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
