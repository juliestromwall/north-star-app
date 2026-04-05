import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import { useAdminNotes } from '@/context/AdminNotesContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchMyTasks, updateCaseTask, fetchAllOpenTasks } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { listEvents } from '@/lib/google'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge from '@/components/shared/StageBadge'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'
import {
  Heart, HeartHandshake, Route, Megaphone, X, Calendar, Clock, CheckCircle2, Circle,
  LayoutGrid, List as ListIcon, Quote, Calculator, StickyNote, Plus, Trash2, Check,
} from 'lucide-react'

export default function AdminDashboard() {
  const { currentUser } = useRole()
  const { notes: adminNotes, dismissNote } = useAdminNotes()
  const visibleNotes = (adminNotes || []).filter(n => !n.dismissed?.includes(currentUser?.id))

  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [caseView, setCaseView] = useState('grid')
  const [showCalc, setShowCalc] = useState(false)
  const [stickyNotes, setStickyNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('abc_sticky_notes') || '[]') } catch { return [] }
  })

  useEffect(() => {
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
      fetchMatchedJourneys(),
      fetchMyTasks(currentUser?.email).catch(() => []),
    ]).then(([gcs, allIps, js, myTasks]) => {
      setSurrogates(gcs || [])
      setIps(allIps || [])
      setJourneys(js || [])
      setTasks(myTasks || [])
    }).finally(() => setLoading(false))

    // Fetch upcoming calendar events (may fail if Google not connected)
    try {
      const userId = currentUser?.id
      if (userId) {
        const now = new Date()
        const timeMin = now.toISOString()
        const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        listEvents(userId, { timeMin, timeMax, maxResults: 10 })
          .then(data => setEvents(data?.items || []))
          .catch(() => {})
      }
    } catch {}

    // Fetch quote of the day (may be blocked by CORS)
    try {
      fetch('https://zenquotes.io/api/today')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.[0]?.q) setQuote({ text: data[0].q, author: data[0].a }) })
        .catch(() => setQuote({ text: 'Every day is a chance to begin again.', author: 'Unknown' }))
    } catch {
      setQuote({ text: 'Every day is a chance to begin again.', author: 'Unknown' })
    }
  }, [])

  // Save sticky notes to localStorage
  useEffect(() => {
    localStorage.setItem('abc_sticky_notes', JSON.stringify(stickyNotes))
  }, [stickyNotes])

  // Build "My Cases" — all surrogates, IPs, and journeys assigned to me
  const myCases = []
  const matchedGcIds = new Set(journeys.map(j => j.gc_case_id))
  const matchedIpIds = new Set(journeys.map(j => j.ip_case_id))

  for (const s of surrogates) {
    if (s.assignedTo === currentUser?.email || !s.assignedTo) {
      const matched = matchedGcIds.has(s.id)
      const journey = matched ? journeys.find(j => j.gc_case_id === s.id) : null
      myCases.push({
        id: matched ? journey.id : s.id,
        name: s.name,
        type: matched ? 'journey' : 'surrogate',
        link: matched ? `/journeys/${journey.id}` : `/surrogates/${s.id}`,
        stage: matched ? journey.stage : getSurrogateStageStatus(s.id)?.stage,
        status: matched ? journey.status : getSurrogateStageStatus(s.id)?.status,
        location: s.location,
        matchedWith: matched ? ips.find(i => i.id === journey.ip_case_id)?.names : null,
      })
    }
  }
  for (const ip of ips) {
    if (matchedIpIds.has(ip.id)) continue // already shown as journey via GC
    myCases.push({
      id: ip.id,
      name: ip.names,
      type: 'ip',
      link: `/intended-parents/${ip.id}`,
      location: ip.location,
    })
  }

  async function completeTask(taskId) {
    try {
      await updateCaseTask(taskId, { status: 'complete', completed_at: new Date().toISOString(), completed_by: currentUser?.email })
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {}
  }

  if (loading) return <div className="p-6 text-center text-stone-400">Loading dashboard...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Here's what's happening at ABC Surrogacy today"
      />

      {/* Admin Notes */}
      {visibleNotes.map((note) => (
        <div key={note.id} className="flex items-start gap-3 bg-abc-indigo/10 border border-abc-indigo/30 rounded-lg px-4 py-3">
          <Megaphone className="size-5 text-abc-indigo shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {note.title && <p className="font-semibold text-sm">{note.title}</p>}
            <p className="text-sm text-muted-foreground">{note.message}</p>
          </div>
          <button onClick={() => dismissNote(note.id, currentUser?.id)} className="p-1 rounded hover:bg-abc-indigo/10 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="size-4" />
          </button>
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
        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="size-4 text-stone-400" /> Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No upcoming appointments this week</p>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 8).map(event => {
                  const startDt = event.start?.dateTime || event.start?.date || ''
                  const isAllDay = !!event.start?.date && !event.start?.dateTime
                  const today = new Date().toDateString() === new Date(startDt).toDateString()
                  return (
                    <div key={event.id} className={`rounded-lg border px-3 py-2 ${today ? 'border-[#283693]/30 bg-[#283693]/5' : 'border-stone-100'}`}>
                      <p className={`text-sm ${today ? 'font-semibold text-[#283693]' : 'text-stone-800'}`}>
                        {event.summary?.includes(' — ') ? event.summary.split(' — ')[0] : event.summary}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                        <span>{formatDate(startDt)}</span>
                        {!isAllDay && event.start?.dateTime && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="size-2.5" />
                            {new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        )}
                        {today && <span className="text-[#283693] font-semibold">Today</span>}
                      </div>
                    </div>
                  )
                })}
                <Link to="/calendar" className="text-xs text-[#283693] hover:underline block text-center pt-1">View full calendar →</Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4 text-stone-400" /> My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No open tasks</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 8).map(task => (
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-700">My Cases ({myCases.length})</h3>
          <div className="flex items-center border rounded-md">
            <Button variant={caseView === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-r-none size-8" onClick={() => setCaseView('grid')}>
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button variant={caseView === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none size-8" onClick={() => setCaseView('list')}>
              <ListIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        {myCases.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">No cases assigned to you yet.</p>
        ) : caseView === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {myCases.map(c => (
              <Link key={`${c.type}-${c.id}`} to={c.link}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <ProfileAvatar name={c.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-800 truncate">{c.name}</p>
                        {c.matchedWith && <p className="text-[10px] text-stone-400 truncate">+ {c.matchedWith}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        c.type === 'journey' ? 'bg-purple-100 text-purple-700' :
                        c.type === 'surrogate' ? 'bg-pink-100 text-pink-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {c.type === 'journey' ? 'Journey' : c.type === 'surrogate' ? 'GC' : 'IP'}
                      </span>
                      {c.location && <span className="text-[10px] text-stone-400">{c.location}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Location</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Partner</th>
                  </tr>
                </thead>
                <tbody>
                  {myCases.map(c => (
                    <tr key={`${c.type}-${c.id}`} className="border-b border-stone-100 hover:bg-stone-50/50 cursor-pointer" onClick={() => window.location.href = c.link}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProfileAvatar name={c.name} size="sm" />
                          <span className="font-medium text-[#283693]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          c.type === 'journey' ? 'bg-purple-100 text-purple-700' :
                          c.type === 'surrogate' ? 'bg-pink-100 text-pink-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {c.type === 'journey' ? 'Journey' : c.type === 'surrogate' ? 'GC' : 'IP'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-stone-500 text-xs">{c.location || '—'}</td>
                      <td className="px-4 py-2.5 text-stone-500 text-xs">{c.matchedWith || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom row: Calculator + Sticky Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="size-4 text-stone-400" /> Calculator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuickCalculator />
          </CardContent>
        </Card>

        {/* Sticky Notes */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <StickyNote className="size-4 text-stone-400" /> Sticky Notes
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setStickyNotes(prev => [...prev, { id: Date.now(), text: '', color: ['bg-yellow-100', 'bg-pink-100', 'bg-blue-100', 'bg-green-100'][prev.length % 4] }])}>
              <Plus className="size-3" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {stickyNotes.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No sticky notes yet. Click + Add to create one.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {stickyNotes.map(note => (
                  <div key={note.id} className={`${note.color} rounded-lg p-3 relative group`}>
                    <button onClick={() => setStickyNotes(prev => prev.filter(n => n.id !== note.id))}
                      className="absolute top-1 right-1 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="size-3" />
                    </button>
                    <textarea
                      value={note.text}
                      onChange={e => setStickyNotes(prev => prev.map(n => n.id === note.id ? { ...n, text: e.target.value } : n))}
                      placeholder="Type a note..."
                      className="w-full bg-transparent text-xs text-stone-700 resize-none border-none focus:outline-none min-h-[60px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Simple Calculator ──
function QuickCalculator() {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState(null)
  const [op, setOp] = useState(null)
  const [reset, setReset] = useState(false)

  function input(val) {
    if (reset) { setDisplay(val); setReset(false); return }
    setDisplay(d => d === '0' ? val : d + val)
  }
  function decimal() {
    if (reset) { setDisplay('0.'); setReset(false); return }
    if (!display.includes('.')) setDisplay(d => d + '.')
  }
  function operate(nextOp) {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op)
      setDisplay(String(result))
      setPrev(result)
    } else {
      setPrev(parseFloat(display))
    }
    setOp(nextOp)
    setReset(true)
  }
  function equals() {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op)
      setDisplay(String(result))
      setPrev(null)
      setOp(null)
      setReset(true)
    }
  }
  function clear() { setDisplay('0'); setPrev(null); setOp(null); setReset(false) }
  function calc(a, b, operator) {
    if (operator === '+') return +(a + b).toFixed(10)
    if (operator === '-') return +(a - b).toFixed(10)
    if (operator === '×') return +(a * b).toFixed(10)
    if (operator === '÷') return b !== 0 ? +(a / b).toFixed(10) : 0
    return b
  }

  const btn = (label, onClick, className = '') => (
    <button onClick={onClick} className={`h-9 rounded-lg text-sm font-medium transition-colors ${className}`}>{label}</button>
  )

  return (
    <div className="space-y-2">
      <div className="bg-stone-50 rounded-lg px-3 py-2 text-right text-lg font-mono font-semibold text-stone-800 min-h-[40px] flex items-center justify-end">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {btn('C', clear, 'bg-stone-200 hover:bg-stone-300 text-stone-700')}
        {btn('±', () => setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d), 'bg-stone-200 hover:bg-stone-300 text-stone-700')}
        {btn('%', () => setDisplay(d => String(parseFloat(d) / 100)), 'bg-stone-200 hover:bg-stone-300 text-stone-700')}
        {btn('÷', () => operate('÷'), `${op === '÷' ? 'bg-[#283693] text-white' : 'bg-[#283693]/10 text-[#283693]'} hover:bg-[#283693]/20`)}
        {['7','8','9'].map(n => btn(n, () => input(n), 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-800'))}
        {btn('×', () => operate('×'), `${op === '×' ? 'bg-[#283693] text-white' : 'bg-[#283693]/10 text-[#283693]'} hover:bg-[#283693]/20`)}
        {['4','5','6'].map(n => btn(n, () => input(n), 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-800'))}
        {btn('-', () => operate('-'), `${op === '-' ? 'bg-[#283693] text-white' : 'bg-[#283693]/10 text-[#283693]'} hover:bg-[#283693]/20`)}
        {['1','2','3'].map(n => btn(n, () => input(n), 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-800'))}
        {btn('+', () => operate('+'), `${op === '+' ? 'bg-[#283693] text-white' : 'bg-[#283693]/10 text-[#283693]'} hover:bg-[#283693]/20`)}
        {btn('0', () => input('0'), 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 col-span-2')}
        {btn('.', decimal, 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-800')}
        {btn('=', equals, 'bg-[#283693] text-white hover:bg-[#283693]/90')}
      </div>
    </div>
  )
}
