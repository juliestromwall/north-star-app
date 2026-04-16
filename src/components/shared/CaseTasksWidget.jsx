import { useState, useEffect } from 'react'
import { Plus, Check, Circle, Clock, Trash2, ChevronDown, AlertTriangle, CalendarDays, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRole } from '@/context/RoleContext'
import { fetchCaseTasks, createCaseTask, updateCaseTask, deleteCaseTask } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { getAdminStaff } from '@/data/mock/users'

const STATUSES = [
  { value: 'open', label: 'Open', icon: Circle, color: 'text-stone-400' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-amber-500' },
  { value: 'complete', label: 'Complete', icon: Check, color: 'text-emerald-500' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-stone-400' },
  { value: 'normal', label: 'Normal', color: 'text-blue-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
]

function priorityBadge(priority) {
  const p = PRIORITIES.find(pr => pr.value === priority) || PRIORITIES[1]
  if (p.value === 'normal') return null
  return <span className={`text-[10px] font-bold uppercase ${p.color}`}>{p.label}</span>
}

function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate + 'T23:59:59') < new Date()
}

export default function CaseTasksWidget({ caseId, caseType, caseName }) {
  const { currentUser } = useRole()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showFuture, setShowFuture] = useState(false)

  useEffect(() => {
    if (!caseId) return
    fetchCaseTasks(caseId, caseType).then(setTasks).catch(() => {}).finally(() => setLoading(false))
  }, [caseId, caseType])

  async function handleCreate(task) {
    const created = await createCaseTask({ ...task, case_id: caseId, case_type: caseType, created_by: currentUser?.name })
    setTasks(prev => [created, ...prev])
    setAddOpen(false)
  }

  async function handleStatusChange(taskId, status) {
    const updates = { status }
    if (status === 'complete') { updates.completed_at = new Date().toISOString(); updates.completed_by = currentUser?.name }
    else { updates.completed_at = null; updates.completed_by = null }
    const updated = await updateCaseTask(taskId, updates)
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
  }

  async function handleDelete(taskId) {
    await deleteCaseTask(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const openTasks = tasks.filter(t => t.status !== 'complete')
  const completedTasks = tasks.filter(t => t.status === 'complete')

  // Split open tasks into current (≤7 days or no due date) and future (>7 days)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const currentTasks = []
  const futureTasks = []
  for (const task of openTasks) {
    if (task.due_date) {
      const due = new Date(task.due_date + 'T12:00:00')
      if (due > sevenDaysFromNow) { futureTasks.push(task); continue }
    }
    currentTasks.push(task)
  }

  if (loading) return <div className="text-center py-8 text-stone-400 text-sm">Loading tasks...</div>

  const updateRow = async (id, updates) => {
    const updated = await updateCaseTask(id, updates)
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Tasks ({openTasks.length})</h3>
        <Button size="sm" className="gap-1 text-xs h-7" style={{ backgroundColor: '#283693' }} onClick={() => setAddOpen(true)}>
          <Plus className="size-3" /> Add Task
        </Button>
      </div>

      {openTasks.length === 0 && <p className="text-xs text-stone-400 py-4 text-center">No open tasks</p>}

      <div className="space-y-1.5">
        {currentTasks.map(task => (
          <TaskRow key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} onUpdate={updateRow} />
        ))}
      </div>

      {futureTasks.length > 0 && (
        <div>
          <button onClick={() => setShowFuture(!showFuture)} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600">
            <ChevronDown className={`size-3 transition-transform ${showFuture ? 'rotate-180' : ''}`} />
            <CalendarDays className="size-3 text-blue-500" />
            Future Tasks ({futureTasks.length})
          </button>
          {showFuture && (
            <div className="space-y-1.5 mt-2">
              {futureTasks.map(task => (
                <TaskRow key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} onUpdate={updateRow} />
              ))}
            </div>
          )}
        </div>
      )}

      {completedTasks.length > 0 && (
        <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600">
          <ChevronDown className={`size-3 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
          {completedTasks.length} completed
        </button>
      )}
      {showCompleted && (
        <div className="space-y-1.5 opacity-60">
          {completedTasks.map(task => (
            <TaskRow key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} onUpdate={async (id, updates) => {
              const updated = await updateCaseTask(id, updates)
              setTasks(prev => prev.map(t => t.id === id ? updated : t))
            }} />
          ))}
        </div>
      )}

      <AddTaskDialog open={addOpen} onOpenChange={setAddOpen} onSave={handleCreate} currentUser={currentUser} />
    </div>
  )
}

function TaskRow({ task, onStatusChange, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState(task.description || '')

  const statusObj = STATUSES.find(s => s.value === task.status) || STATUSES[0]
  const StatusIcon = statusObj.icon
  const overdue = task.status !== 'complete' && isOverdue(task.due_date)

  function cycleStatus() {
    const order = ['open', 'in_progress', 'complete']
    const next = order[(order.indexOf(task.status) + 1) % order.length]
    onStatusChange(task.id, next)
  }

  return (
    <div className={`rounded-lg border ${overdue ? 'border-red-200 bg-red-50/50' : 'border-stone-100'} px-3 py-2`}>
      <div className="flex items-center gap-2">
        <button onClick={cycleStatus} className={`shrink-0 ${statusObj.color}`} title={`Status: ${statusObj.label}`}>
          <StatusIcon className="size-4" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className={`flex-1 text-left text-sm ${task.status === 'complete' ? 'line-through text-stone-400' : 'text-stone-800'}`}>
          {task.title}
        </button>
        {priorityBadge(task.priority)}
        {task.due_date && (
          <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-stone-400'}`}>
            {overdue && <AlertTriangle className="size-2.5" />}
            {formatDate(task.due_date)}
          </span>
        )}
        <button onClick={() => onDelete(task.id)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 className="size-3" /></button>
      </div>
      {expanded && (
        <div className="mt-2 pl-6 space-y-2 text-xs">
          {task.assigned_to && <p className="text-stone-400">Assigned to: <span className="text-stone-600">{
            task.assigned_to.includes(',')
              ? task.assigned_to.split(',').map(e => getAdminStaff().find(a => a.email === e.trim())?.name || e.trim()).join(' & ')
              : getAdminStaff().find(a => a.email === task.assigned_to)?.name || task.assigned_to
          }</span></p>}
          {task.created_by && <p className="text-stone-400">Created by: <span className="text-stone-600">{task.created_by}</span></p>}
          {task.completed_by && <p className="text-stone-400">Completed by: <span className="text-stone-600">{task.completed_by} on {formatDate(task.completed_at)}</span></p>}
          {editing ? (
            <div className="space-y-1">
              <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="text-xs" placeholder="Add a note..." />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-[10px]" style={{ backgroundColor: '#283693' }} onClick={() => { onUpdate(task.id, { description: desc }); setEditing(false) }}>Save</Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              {task.description ? <p className="text-stone-600 whitespace-pre-wrap">{task.description}</p> : null}
              <button onClick={() => { setDesc(task.description || ''); setEditing(true) }} className="text-stone-400 hover:text-stone-600 text-[10px] mt-1">
                {task.description ? 'Edit note' : '+ Add note'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const JULIE_EMAIL = 'julie@abcsurrogacy.com'
const NICOLE_EMAIL = 'nicole@abcsurrogacy.com'

function buildAssignOptions() {
  const staff = getAdminStaff()
  const options = staff.map(a => ({ value: a.email, label: a.name }))
  // Add "Julie & Nicole" combo option
  const julie = staff.find(a => a.email === JULIE_EMAIL)
  const nicole = staff.find(a => a.email === NICOLE_EMAIL)
  if (julie && nicole) {
    options.push({ value: `${JULIE_EMAIL},${NICOLE_EMAIL}`, label: `${julie.name} & ${nicole.name}` })
  }
  return options
}

function AddTaskDialog({ open, onOpenChange, onSave, currentUser }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', due_date: '', assigned_to: currentUser?.email || '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ title: '', description: '', priority: 'normal', due_date: '', assigned_to: currentUser?.email || '' })
  }, [open])

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
      })
    } catch {} finally { setSaving(false) }
  }

  const assignOptions = buildAssignOptions()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Task *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" className="h-9" autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Notes</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Due Date</label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Assign To</label>
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
              <option value="">Unassigned</option>
              {assignOptions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              {saving ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Dashboard version — shows tasks across all cases
export function DashboardTasksWidget({ userEmail }) {
  const { currentUser } = useRole()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [cases, setCases] = useState([])
  const [showFuture, setShowFuture] = useState(false)

  useEffect(() => {
    Promise.all([
      userEmail ? import('@/lib/db').then(m => m.fetchMyTasks(userEmail)) : Promise.resolve([]),
      import('@/lib/db').then(m => m.fetchSurrogatesFromIntake()),
      import('@/lib/db').then(m => m.fetchIPsFromIntake()),
      import('@/lib/matching').then(m => m.fetchMatchedJourneys()),
    ]).then(([taskData, gcs, ips, journeys]) => {
      setTasks(taskData || [])
      const allCases = [
        ...(gcs || []).map(c => ({ id: c.id, name: c.name, type: 'surrogate' })),
        ...(ips || []).map(c => ({ id: c.id, name: c.names, type: 'ip' })),
        ...(journeys || []).map(j => ({ id: j.id, name: `Journey #${j.id}`, type: 'journey' })),
      ]
      setCases(allCases)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [userEmail])

  function getCaseName(task) {
    const c = cases.find(c => c.id === task.case_id && c.type === task.case_type)
    return c?.name || `${task.case_type} #${task.case_id}`
  }

  function getCaseLink(task) {
    if (task.case_type === 'journey') return `/journeys/${task.case_id}`
    if (task.case_type === 'ip') return `/intended-parents/${task.case_id}`
    return `/surrogates/${task.case_id}`
  }

  async function handleStatusChange(taskId, status) {
    const updates = { status }
    if (status === 'complete') { updates.completed_at = new Date().toISOString(); updates.completed_by = currentUser?.name }
    else { updates.completed_at = null; updates.completed_by = null }
    try {
      const updated = await updateCaseTask(taskId, updates)
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    } catch {}
  }

  async function handleCreate(task) {
    const created = await createCaseTask({ ...task, created_by: currentUser?.name })
    setTasks(prev => [created, ...prev])
    setAddOpen(false)
  }

  if (loading) return <Card className="rounded-2xl"><CardContent className="py-8 text-center text-stone-400 text-sm">Loading tasks...</CardContent></Card>

  const openTasks = tasks.filter(t => t.status !== 'complete')

  // Split into current (≤7 days) and future (>7 days)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const currentTasks = []
  const futureTasks = []
  for (const task of openTasks) {
    if (task.due_date) {
      const due = new Date(task.due_date + 'T12:00:00')
      if (due > sevenDaysFromNow) { futureTasks.push(task); continue }
    }
    currentTasks.push(task)
  }

  const renderTaskRow = (task) => {
    const statusObj = STATUSES.find(s => s.value === task.status) || STATUSES[0]
    const StatusIcon = statusObj.icon
    const overdue = isOverdue(task.due_date)
    return (
      <div key={task.id} className={`rounded-lg border ${overdue ? 'border-red-200 bg-red-50/50' : 'border-stone-100'} px-3 py-2 flex items-center gap-2`}>
        <button onClick={() => handleStatusChange(task.id, task.status === 'open' ? 'in_progress' : 'complete')} className={`shrink-0 ${statusObj.color}`}>
          <StatusIcon className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-800 truncate">{task.title}</p>
          <a href={getCaseLink(task)} className="text-[10px] text-[#283693] hover:underline">{getCaseName(task)}</a>
        </div>
        {priorityBadge(task.priority)}
        {task.due_date && (
          <span className={`text-[10px] ${overdue ? 'text-red-600 font-medium' : 'text-stone-400'}`}>
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">My Tasks ({openTasks.length})</CardTitle>
          <Button size="sm" className="gap-1 text-xs h-7" style={{ backgroundColor: '#283693' }} onClick={() => setAddOpen(true)}>
            <Plus className="size-3" /> Add Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {openTasks.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">No open tasks</p>
        ) : currentTasks.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-2">No tasks due in the next 7 days</p>
        ) : (
          <div className="space-y-1.5">
            {currentTasks.map(renderTaskRow)}
          </div>
        )}
        {futureTasks.length > 0 && (
          <div>
            <button onClick={() => setShowFuture(!showFuture)} className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600">
              <ChevronDown className={`size-3 transition-transform ${showFuture ? 'rotate-180' : ''}`} />
              <CalendarDays className="size-3 text-blue-500" />
              Future Tasks ({futureTasks.length})
            </button>
            {showFuture && (
              <div className="space-y-1.5 mt-2">
                {futureTasks.map(renderTaskRow)}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <DashboardAddTaskDialog open={addOpen} onOpenChange={setAddOpen} onSave={handleCreate} currentUser={currentUser} cases={cases} />
    </Card>
  )
}

function DashboardAddTaskDialog({ open, onOpenChange, onSave, currentUser, cases }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', due_date: '', assigned_to: '', case_id: '', case_type: '' })
  const [saving, setSaving] = useState(false)
  const [caseSearch, setCaseSearch] = useState('')

  useEffect(() => {
    if (open) setForm({ title: '', description: '', priority: 'normal', due_date: '', assigned_to: currentUser?.email || '', case_id: '', case_type: '' })
  }, [open])

  const filteredCases = caseSearch ? cases.filter(c => c.name.toLowerCase().includes(caseSearch.toLowerCase())) : cases.slice(0, 20)

  async function handleSave() {
    if (!form.title.trim() || !form.case_id) return
    setSaving(true)
    try {
      await onSave({
        case_id: Number(form.case_id),
        case_type: form.case_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
      })
    } catch {} finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Case *</label>
            <Input value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder="Search cases..." className="h-9" />
            {caseSearch && (
              <div className="max-h-32 overflow-y-auto border rounded-md mt-1">
                {filteredCases.map(c => (
                  <button key={`${c.type}-${c.id}`} onClick={() => { setForm(f => ({ ...f, case_id: c.id, case_type: c.type })); setCaseSearch(c.name) }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-stone-50 flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded text-white ${c.type === 'surrogate' ? 'bg-pink-500' : c.type === 'ip' ? 'bg-[#283693]' : 'bg-purple-500'}`}>
                      {c.type === 'surrogate' ? 'GC' : c.type === 'ip' ? 'IP' : 'J'}
                    </span>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Task *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Notes</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Due Date</label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Assign To</label>
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
              <option value="">Unassigned</option>
              {buildAssignOptions().map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSave} disabled={saving || !form.title.trim() || !form.case_id}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              {saving ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
