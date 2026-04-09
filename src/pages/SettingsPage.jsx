import { useState, useCallback, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { fetchAllAdminNotes, insertAdminNote, updateAdminNote, deleteAdminNote } from '@/lib/db'
import { ROLES, ROLE_LABELS, SURROGATE_STAGES, DEFAULT_STATUSES_BY_STAGE, IP_STAGE_LABELS } from '@/lib/constants'
import { getStatusConfig, addStatus, editStatus, deleteStatus, getStatusesInUse } from '@/lib/stageStatusStore'
import { getChecklistConfig, setChecklistSteps, addChecklistStep, editChecklistStep, deleteChecklistStep, resetChecklistToDefaults, addChecklistMilestone, editChecklistMilestone, deleteChecklistMilestone, toggleStepInMilestone, setChecklistMilestones } from '@/lib/checklistStore'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Megaphone, Trash2, Eye, EyeOff, GripVertical, Pencil, Check, X, ClipboardList, RotateCcw, Milestone, ChevronDown, Users, Shield, UserCog, Tag, AlertTriangle, Mail, Calendar, Unplug, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { mockUsers, loadAdminUsers } from '@/data/mock/users'
import { connectGoogle, getGoogleStatus, disconnectGoogle } from '@/lib/google'

// ── Admin Notes Section (unchanged) ──────────────────────────

const TARGETABLE_USERS = [
  { id: 'u2', name: 'Julie Allgood', role: ROLES.MASTER_ADMIN },
  { id: 'u3', name: 'Nicole Lawson', role: ROLES.MASTER_ADMIN },
  { id: 'u4', name: 'Emily Rotter', role: ROLES.ADMIN },
  { id: 'u5', name: 'Stacie Adler', role: ROLES.ADMIN },
  { id: 'u6', name: 'Desiree Melchiori', role: ROLES.ADMIN },
  { id: 'u7', name: 'Jennifer Rose', role: ROLES.ADMIN },
]

function AdminNotesSection() {
  const { currentUser } = useRole()
  const [notes, setNotes] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [noteTarget, setNoteTarget] = useState('all')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  useEffect(() => {
    fetchAllAdminNotes().then(data => setNotes(data || [])).catch(() => {})
  }, [])

  const handlePublish = async () => {
    if (!noteMessage.trim()) return
    try {
      const insertData = {
        title: noteTitle.trim() || null,
        message: noteMessage.trim(),
        is_active: true,
        created_by: currentUser?.name || '',
      }
      // Only include target_user_ids if targeting specific users (and column is text-compatible)
      if (noteTarget === 'specific' && selectedUserIds.length > 0) {
        insertData.target_user_ids = selectedUserIds
      }
      const note = await insertAdminNote(insertData)
      if (note) setNotes(prev => [note, ...prev])
    } catch (err) { console.error('Failed to publish note:', err) }
    setDialogOpen(false)
    setNoteTitle('')
    setNoteMessage('')
    setNoteTarget('all')
    setSelectedUserIds([])
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const getUserName = (id) => TARGETABLE_USERS.find((u) => u.id === id)?.name || id
  const getTargetLabel = (note) => !note.target_user_ids ? 'All admins' : note.target_user_ids.map(getUserName).join(', ')
  const getDismissalCount = (note) => {
    const dismissals = note.admin_note_dismissals?.length || note.dismissals?.length || 0
    const total = note.target_user_ids ? note.target_user_ids.length : TARGETABLE_USERS.length
    return `${dismissals}/${total} read`
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
            <Megaphone className="size-5" />
            Admin Notes
          </h2>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Publish Note
          </Button>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No notes published yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
                  note.is_active ? 'bg-abc-indigo/5 border-abc-indigo/20' : 'bg-muted/50 border-border opacity-60'
                }`}
              >
                <Megaphone className={`size-4 shrink-0 mt-0.5 ${note.is_active ? 'text-abc-indigo' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {note.title && <span className="font-semibold text-sm">{note.title}</span>}
                    {!note.is_active && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{note.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(note.created_at)}</span>
                    <span>{getTargetLabel(note)}</span>
                    <span>{getDismissalCount(note)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={async () => {
                    try {
                      await updateAdminNote(note.id, { is_active: !note.is_active })
                      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_active: !n.is_active } : n))
                    } catch {}
                  }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={note.is_active ? 'Deactivate' : 'Activate'}>
                    {note.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <button onClick={async () => {
                    try {
                      await deleteAdminNote(note.id)
                      setNotes(prev => prev.filter(n => n.id !== note.id))
                    } catch {}
                  }} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. System Update" className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message *</label>
              <textarea value={noteMessage} onChange={(e) => setNoteMessage(e.target.value)} placeholder="Write your note..." rows={3} className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="target" checked={noteTarget === 'all'} onChange={() => setNoteTarget('all')} className="accent-abc-indigo" /> All Admins
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="target" checked={noteTarget === 'specific'} onChange={() => setNoteTarget('specific')} className="accent-abc-indigo" /> Specific Admins
                </label>
              </div>
              {noteTarget === 'specific' && (
                <div className="space-y-1.5 mt-2 pl-1">
                  {TARGETABLE_USERS.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={(e) => setSelectedUserIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))} className="accent-abc-indigo" />
                      {u.name} <span className="text-xs text-muted-foreground">({ROLE_LABELS[u.role]})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handlePublish} disabled={!noteMessage.trim() || (noteTarget === 'specific' && selectedUserIds.length === 0)}>Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Sortable Step Row ──────────────────────────────────────

const LOG_TYPE_LABELS = { status: 'Status Dropdown', text: 'Text Field', dropdown: 'Custom Dropdown' }
const LOG_TYPE_COLORS = { status: 'bg-blue-50 text-blue-600', text: 'bg-amber-50 text-amber-600', dropdown: 'bg-purple-50 text-purple-600' }

function SortableStepRow({ step, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(step.label)
  const [editLogType, setEditLogType] = useState(step.logType || 'status')
  const [editOptions, setEditOptions] = useState((step.options || []).join(', '))

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = () => {
    const opts = editLogType === 'dropdown' ? editOptions.split(',').map(o => o.trim()).filter(Boolean) : []
    onEdit(step.id, { label: editLabel.trim() || step.label, logType: editLogType, options: opts })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditLabel(step.label)
    setEditLogType(step.logType || 'status')
    setEditOptions((step.options || []).join(', '))
    setEditing(false)
  }

  const logType = step.logType || 'status'

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white px-3 py-2.5 group">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 shrink-0 touch-none">
          <GripVertical className="size-4" />
        </button>
        {editing ? (
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="h-8 text-sm flex-1"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && editLogType !== 'dropdown') handleSave(); if (e.key === 'Escape') handleCancel() }}
                placeholder="Step name"
              />
              <select value={editLogType} onChange={e => setEditLogType(e.target.value)} className="h-8 text-xs border rounded px-2 bg-white">
                <option value="status">Status Dropdown</option>
                <option value="text">Text Field</option>
                <option value="dropdown">Custom Dropdown</option>
              </select>
            </div>
            {editLogType === 'dropdown' && (
              <div className="space-y-1">
                <label className="text-[10px] text-stone-400 font-medium">Options (comma-separated)</label>
                <Input
                  value={editOptions}
                  onChange={e => setEditOptions(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g. Active, Pending, Denied, N/A"
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
                />
              </div>
            )}
            <div className="flex gap-1">
              <button onClick={handleSave} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-4" /></button>
              <button onClick={handleCancel} className="p-1 rounded hover:bg-stone-100 text-stone-400"><X className="size-4" /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-stone-700">{step.label}</span>
              {logType !== 'status' && (
                <span className={`ml-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${LOG_TYPE_COLORS[logType] || ''}`}>
                  {LOG_TYPE_LABELS[logType] || logType}
                </span>
              )}
              {logType === 'dropdown' && step.options?.length > 0 && (
                <span className="text-[10px] text-stone-400 ml-1">({step.options.join(', ')})</span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {step.locked ? (
                <span className="text-[9px] text-stone-400 font-medium px-1.5 py-0.5 rounded bg-stone-100">🔒 Locked</span>
              ) : (
                <>
                  <button onClick={() => { setEditLabel(step.label); setEditLogType(step.logType || 'status'); setEditOptions((step.options || []).join(', ')); setEditing(true) }} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"><Pencil className="size-3.5" /></button>
                  <button onClick={() => onDelete(step.id)} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Milestone Row ──────────────────────────────────────

function MilestoneRow({ milestone, steps, userType, stageId, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(milestone.label)
  const [open, setOpen] = useState(false)

  const handleSave = () => {
    if (editLabel.trim() && editLabel.trim() !== milestone.label) {
      editChecklistMilestone(userType, stageId, milestone.id, editLabel.trim())
      onUpdate()
    }
    setEditing(false)
  }

  const handleToggleStep = (stepId) => {
    toggleStepInMilestone(userType, stageId, milestone.id, stepId)
    onUpdate()
  }

  const assignedCount = milestone.stepIds?.length || 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-stone-50 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-stone-100 transition-colors group">
            <Milestone className="size-3.5 text-stone-400 shrink-0" />
            {editing ? (
              <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditLabel(milestone.label); setEditing(false) } }}
                />
                <button onClick={handleSave} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-3.5" /></button>
                <button onClick={() => { setEditLabel(milestone.label); setEditing(false) }} className="p-1 rounded hover:bg-stone-200 text-stone-400"><X className="size-3.5" /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs font-semibold text-stone-600">{milestone.label}</span>
                <span className="text-[10px] text-stone-400">{assignedCount} step{assignedCount !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditLabel(milestone.label); setEditing(true) }} className="p-1 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600"><Pencil className="size-3" /></button>
                  <button onClick={() => { deleteChecklistMilestone(userType, stageId, milestone.id); onUpdate() }} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
                </div>
                <ChevronDown className={`size-3.5 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </>
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-2 pt-1 space-y-1 border-t border-stone-200">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Assign steps to this milestone:</p>
            {steps.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No steps to assign — add steps first.</p>
            ) : (
              steps.map(step => (
                <label key={step.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5 hover:bg-stone-100 rounded px-1 -mx-1">
                  <Checkbox
                    checked={milestone.stepIds?.includes(step.id)}
                    onCheckedChange={() => handleToggleStep(step.id)}
                    className="size-3.5"
                  />
                  <span className="text-stone-600">{step.label}</span>
                </label>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ── Stage Checklist Card ──────────────────────────────────

function StageChecklistCard({ stage, userType, stageData, onUpdate }) {
  const steps = stageData?.steps || []
  const milestones = stageData?.milestones || []
  const [newStepLabel, setNewStepLabel] = useState('')
  const [newStepLogType, setNewStepLogType] = useState('status')
  const [newStepOptions, setNewStepOptions] = useState('')
  const [newMilestoneLabel, setNewMilestoneLabel] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = steps.findIndex(s => s.id === active.id)
    const newIndex = steps.findIndex(s => s.id === over.id)
    const reordered = arrayMove(steps, oldIndex, newIndex)
    setChecklistSteps(userType, stage.id, reordered)
    onUpdate()
  }

  const handleAddStep = () => {
    if (!newStepLabel.trim()) return
    const opts = newStepLogType === 'dropdown' ? newStepOptions.split(',').map(o => o.trim()).filter(Boolean) : []
    addChecklistStep(userType, stage.id, newStepLabel.trim(), newStepLogType, opts)
    setNewStepLabel('')
    setNewStepLogType('status')
    setNewStepOptions('')
    onUpdate()
  }

  const handleEditStep = (stepId, updates) => {
    editChecklistStep(userType, stage.id, stepId, updates)
    onUpdate()
  }

  const handleDeleteStep = (stepId) => {
    deleteChecklistStep(userType, stage.id, stepId)
    onUpdate()
  }

  const handleAddMilestone = () => {
    if (!newMilestoneLabel.trim()) return
    addChecklistMilestone(userType, stage.id, newMilestoneLabel.trim())
    setNewMilestoneLabel('')
    onUpdate()
  }

  const handleReset = () => {
    resetChecklistToDefaults(userType, stage.id)
    setConfirmReset(false)
    onUpdate()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            <CardTitle className="text-base">{stage.label}</CardTitle>
            <span className="text-xs text-stone-400 font-normal">{steps.length} step{steps.length !== 1 ? 's' : ''} · {milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</span>
          </div>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Reset to defaults?</span>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleReset}>Reset</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="text-stone-400 hover:text-stone-600 p-1 rounded hover:bg-stone-100" title="Reset to defaults">
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Steps */}
        <div className="space-y-2">
          <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Steps</p>
          {steps.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {steps.map(step => (
                    <SortableStepRow key={step.id} step={step} onEdit={handleEditStep} onDelete={handleDeleteStep} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-xs text-stone-400 py-2 text-center">No steps configured.</p>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={newStepLabel}
                onChange={e => setNewStepLabel(e.target.value)}
                placeholder="Add a step..."
                className="h-8 text-sm flex-1"
                onKeyDown={e => { if (e.key === 'Enter' && newStepLogType !== 'dropdown') handleAddStep() }}
              />
              <select value={newStepLogType} onChange={e => setNewStepLogType(e.target.value)} className="h-8 text-[11px] border rounded px-1.5 bg-white text-stone-600">
                <option value="status">Status</option>
                <option value="text">Text</option>
                <option value="dropdown">Dropdown</option>
              </select>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleAddStep} disabled={!newStepLabel.trim()}>
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            {newStepLogType === 'dropdown' && (
              <Input
                value={newStepOptions}
                onChange={e => setNewStepOptions(e.target.value)}
                placeholder="Options (comma-separated): Active, Pending, Denied"
                className="h-8 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') handleAddStep() }}
              />
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-2 border-t border-stone-100 pt-4">
          <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <Milestone className="size-3.5" /> Milestones
            <span className="font-normal normal-case text-stone-400">— shown on case cards</span>
          </p>
          {milestones.length > 0 ? (
            <div className="space-y-1.5">
              {milestones.map(ms => (
                <MilestoneRow key={ms.id} milestone={ms} steps={steps} userType={userType} stageId={stage.id} onUpdate={onUpdate} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 py-2 text-center">No milestones configured.</p>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={newMilestoneLabel}
              onChange={e => setNewMilestoneLabel(e.target.value)}
              placeholder="Add a milestone..."
              className="h-8 text-sm flex-1"
              onKeyDown={e => { if (e.key === 'Enter') handleAddMilestone() }}
            />
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleAddMilestone} disabled={!newMilestoneLabel.trim()}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Checklists Section (collapsible) ──────────────────────

const CASE_STAGES = ['pre-qualification', 'screening', 'matching', 'holding', 'not-qualified']
const JOURNEY_STAGES = ['journey-oversight']

function ChecklistsSection() {
  const [open, setOpen] = useState(false)
  const [userType, setUserType] = useState('gc')
  const [activeStage, setActiveStage] = useState('pre-qualification')
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick(t => t + 1), [])

  const config = getChecklistConfig()
  const caseStages = SURROGATE_STAGES.filter(s => CASE_STAGES.includes(s.id))
  const journeyStages = SURROGATE_STAGES.filter(s => JOURNEY_STAGES.includes(s.id))
  const visibleStages = userType === 'journey' ? journeyStages : caseStages
  const configKey = userType === 'journey' ? 'gc' : userType

  function switchUserType(type) {
    setUserType(type)
    const stages = type === 'journey' ? journeyStages : caseStages
    setActiveStage(stages[0]?.id)
  }

  const activeStageObj = SURROGATE_STAGES.find(s => s.id === activeStage)
  const stageData = config[configKey]?.[activeStage]
  const stepCount = stageData?.steps?.length || 0
  const milestoneCount = stageData?.milestones?.length || 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer group py-1">
          <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
            <ClipboardList className="size-5" />
            Checklists
          </h2>
          <ChevronDown className={`size-5 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 mt-3">
          <CardDescription>
            Configure the checklist steps that appear for each case stage. Each stage has one checklist per user type.
          </CardDescription>

          <div className="flex gap-2 border-b pb-2">
            {[
              { key: 'gc', label: 'Surrogate (GC)' },
              { key: 'ip', label: 'Intended Parent (IP)' },
              { key: 'journey', label: 'Matched Journeys' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${userType === tab.key ? 'bg-[#283693] text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                onClick={() => switchUserType(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            {/* Stage quick-links */}
            <div className="w-48 shrink-0 space-y-1">
              {visibleStages.map(stage => {
                const label = userType === 'ip' && IP_STAGE_LABELS[stage.id] ? IP_STAGE_LABELS[stage.id] : stage.label
                const sd = config[configKey]?.[stage.id]
                const count = (sd?.steps?.length || 0)
                return (
                  <button
                    key={stage.id}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      activeStage === stage.id ? 'font-semibold text-white' : 'text-stone-600 hover:bg-stone-100'
                    }`}
                    style={activeStage === stage.id ? { backgroundColor: stage.color } : {}}
                    onClick={() => setActiveStage(stage.id)}
                  >
                    <div className="flex items-center justify-between">
                      {label}
                      <span className={`text-[10px] ${activeStage === stage.id ? 'text-white/70' : 'text-stone-400'}`}>
                        {count}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Active stage checklist */}
            <div className="flex-1">
              <StageChecklistCard key={activeStage} stage={activeStageObj} userType={configKey} stageData={stageData} onUpdate={forceUpdate} />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── User Management Section ──────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'master_admin', label: 'Master Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'marketing', label: 'Marketing' },
]

const ROLE_BADGE_STYLES = {
  master_admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  admin: 'bg-sky-100 text-sky-700 border-sky-200',
  marketing: 'bg-amber-100 text-amber-700 border-amber-200',
  super_admin: 'bg-red-100 text-red-700 border-red-200',
}

function UserManagementSection() {
  const { currentUser } = useRole()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState(() => mockUsers.filter(u => u.role !== 'super_admin'))

  // Refresh users when mockUsers updates (after loadAdminUsers)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = mockUsers.filter(u => u.role !== 'super_admin')
      if (current.length !== users.length) setUsers(current)
    }, 1000)
    return () => clearInterval(interval)
  }, [users.length])
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' })
  const [inviteStatus, setInviteStatus] = useState(null) // 'sending' | 'sent' | 'error'

  const startAdd = () => {
    setForm({ name: '', email: '', role: 'admin' })
    setAddOpen(true)
    setEditingId(null)
  }

  const startEdit = (user) => {
    setForm({ name: user.name, email: user.email, role: user.role })
    setEditingId(user.id)
    setAddOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    if (editingId) {
      setUsers(prev => prev.map(u => u.id === editingId ? { ...u, name: form.name.trim(), email: form.email.trim(), role: form.role } : u))
      setAddOpen(false)
      setEditingId(null)
    } else {
      const newId = 'u' + Date.now()
      setUsers(prev => [...prev, { id: newId, name: form.name.trim(), email: form.email.trim(), role: form.role, active: true }])
      setAddOpen(false)
      setEditingId(null)
      // Send invite email to new admin
      setInviteStatus('sending')
      try {
        const { inviteUser } = await import('@/lib/invite')
        await inviteUser(currentUser?.id, { email: form.email.trim(), name: form.name.trim(), role: form.role, portalType: 'admin' })
        setInviteStatus('sent')
        // Refresh admin users cache
        await loadAdminUsers()
      } catch (err) {
        console.warn('Invite failed:', err)
        setInviteStatus('error')
      }
      setTimeout(() => setInviteStatus(null), 4000)
    }
  }

  const toggleActive = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: u.active === false ? true : false } : u))
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer group py-1">
          <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
            <Users className="size-5" />
            Team Members
          </h2>
          <ChevronDown className={`size-5 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 mt-3">
          <div className="flex items-center justify-between">
            <CardDescription>Manage who has access to the system and their roles.</CardDescription>
            <Button size="sm" onClick={startAdd} className="gap-1">
              <Plus className="size-4" /> Add User
            </Button>
          </div>

          <div className="rounded-xl border border-stone-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-500">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className={`border-b border-stone-100 ${user.active === false ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4 font-medium text-stone-800">{user.name}</td>
                    <td className="py-3 px-4 text-stone-500">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE_STYLES[user.role] || 'bg-stone-100 text-stone-500'}`}>
                        {ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${user.active === false ? 'text-red-500' : 'text-emerald-600'}`}>
                        {user.active === false ? 'Deactivated' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startEdit(user)} className="p-1.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600" title="Edit">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => toggleActive(user.id)} className={`p-1.5 rounded text-stone-400 ${user.active === false ? 'hover:bg-emerald-50 hover:text-emerald-600' : 'hover:bg-red-50 hover:text-red-500'}`} title={user.active === false ? 'Reactivate' : 'Deactivate'}>
                          {user.active === false ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inviteStatus && (
            <p className={`text-xs font-medium mt-2 ${inviteStatus === 'sent' ? 'text-emerald-600' : inviteStatus === 'error' ? 'text-red-500' : 'text-stone-400'}`}>
              {inviteStatus === 'sending' ? 'Sending invite email...' : inviteStatus === 'sent' ? 'Invite email sent!' : 'Failed to send invite email'}
            </p>
          )}
        </div>
      </CollapsibleContent>

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@abcsurrogacy.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${form.role === opt.value ? 'border-[#283693] bg-[#283693]/5' : 'border-stone-200 hover:border-stone-300'}`}>
                    <input type="radio" name="role" value={opt.value} checked={form.role === opt.value} onChange={() => setForm(f => ({ ...f, role: opt.value }))} className="accent-[#283693]" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-stone-400">
                        {opt.value === 'master_admin' && 'Full access to all modules and settings'}
                        {opt.value === 'admin' && 'Operations, clients, forms, and messaging'}
                        {opt.value === 'marketing' && 'Read-only analytics and intake submissions'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.email.trim()}>{editingId ? 'Save Changes' : 'Add User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  )
}

// ── Stage Statuses Section ──────────────────────────────────

function StageStatusesSection() {
  const [open, setOpen] = useState(false)
  const [userType, setUserType] = useState('gc')
  const visibleStages = userType === 'journey'
    ? SURROGATE_STAGES.filter(s => s.id === 'journey-oversight')
    : SURROGATE_STAGES.filter(s => !s.hidden && s.id !== 'journey-oversight')
  const [activeStage, setActiveStage] = useState(visibleStages[0]?.id)
  const [config, setConfig] = useState(() => getStatusConfig())
  const [newStatus, setNewStatus] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const statuses = config[userType]?.[activeStage] || []
  const stageObj = SURROGATE_STAGES.find(s => s.id === activeStage)

  // Reset active stage when switching user type
  function switchUserType(type) {
    setUserType(type)
    const stages = type === 'journey'
      ? SURROGATE_STAGES.filter(s => s.id === 'journey-oversight')
      : SURROGATE_STAGES.filter(s => !s.hidden && s.id !== 'journey-oversight')
    setActiveStage(stages[0]?.id)
    setEditingIdx(null)
    setDeleteConfirm(null)
    setNewStatus('')
  }

  function handleAdd() {
    const trimmed = newStatus.trim()
    if (!trimmed || statuses.includes(trimmed)) return
    const updated = addStatus(activeStage, trimmed, userType)
    setConfig({ ...updated })
    setNewStatus('')
  }

  function handleStartEdit(idx) {
    setEditingIdx(idx)
    setEditValue(statuses[idx])
  }

  function handleSaveEdit(idx) {
    const trimmed = editValue.trim()
    if (!trimmed || (trimmed !== statuses[idx] && statuses.includes(trimmed))) {
      setEditingIdx(null)
      return
    }
    if (trimmed !== statuses[idx]) {
      const updated = editStatus(activeStage, statuses[idx], trimmed, userType)
      setConfig({ ...updated })
    }
    setEditingIdx(null)
  }

  function handleDeleteClick(label) {
    const inUseCount = getStatusesInUse(activeStage, label)
    if (inUseCount > 0) {
      setDeleteConfirm({ label, inUseCount })
    } else {
      const updated = deleteStatus(activeStage, label, 'remove_from_all', userType)
      setConfig({ ...updated })
    }
  }

  function handleDeleteConfirm(mode) {
    if (!deleteConfirm) return
    const updated = deleteStatus(activeStage, deleteConfirm.label, mode, userType)
    setConfig({ ...updated })
    setDeleteConfirm(null)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer group py-1">
          <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
            <Tag className="size-5" />
            Stage Statuses
          </h2>
          <ChevronDown className={`size-5 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 mt-3">
          <CardDescription>
            Configure available statuses for each journey stage. These appear in the status dropdown on surrogate and IP cases.
          </CardDescription>

          {/* GC / IP / Matched Journeys tabs */}
          <div className="flex gap-2 border-b pb-2">
            {[
              { key: 'gc', label: 'Surrogate (GC)' },
              { key: 'ip', label: 'Intended Parent (IP)' },
              { key: 'journey', label: 'Matched Journeys' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${userType === tab.key ? 'bg-[#283693] text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                onClick={() => switchUserType(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            {/* Stage tabs */}
            <div className="w-48 shrink-0 space-y-1">
              {visibleStages.map(stage => {
                const stageLabel = userType === 'ip' && IP_STAGE_LABELS[stage.id] ? IP_STAGE_LABELS[stage.id] : stage.label
                return (
                <button
                  key={stage.id}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                    activeStage === stage.id ? 'font-semibold text-white' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                  style={activeStage === stage.id ? { backgroundColor: stage.color } : {}}
                  onClick={() => { setActiveStage(stage.id); setEditingIdx(null); setDeleteConfirm(null) }}
                >
                  <div className="flex items-center justify-between">
                    {stageLabel}
                    <span className={`text-[10px] ${activeStage === stage.id ? 'text-white/70' : 'text-stone-400'}`}>
                      {(config[userType]?.[stage.id] || []).length}
                    </span>
                  </div>
                </button>
              )})}
            </div>

            {/* Status list */}
            <div className="flex-1 rounded-xl border bg-white overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b">
                <h3 className="text-base font-bold" style={{ color: stageObj?.color }}>
                  {userType === 'ip' && IP_STAGE_LABELS[activeStage] ? IP_STAGE_LABELS[activeStage] : stageObj?.label} Statuses
                </h3>
              </div>

              <div className="px-5 py-3">
                {/* Delete confirmation */}
                {deleteConfirm && (
                  <div className="mb-3 p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="size-4" />
                      <span className="text-sm font-semibold">
                        "{deleteConfirm.label}" is used by {deleteConfirm.inUseCount} case{deleteConfirm.inUseCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => handleDeleteConfirm('remove_from_all')}>
                        Delete for all cases
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => handleDeleteConfirm('soft_delete')}>
                        Just hide going forward
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {statuses.map((status, idx) => (
                    <div key={`${status}-${idx}`} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-50 group">
                      {editingIdx === idx ? (
                        <>
                          <Input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(idx); if (e.key === 'Escape') setEditingIdx(null) }}
                          />
                          <button onClick={() => handleSaveEdit(idx)} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-4" /></button>
                          <button onClick={() => setEditingIdx(null)} className="p-1 rounded hover:bg-stone-100 text-stone-400"><X className="size-4" /></button>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: stageObj?.color }} />
                          <span className="flex-1 text-sm text-stone-700">{status}</span>
                          {idx === 0 && <span className="text-[10px] text-stone-300 uppercase tracking-wider">Default</span>}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleStartEdit(idx)} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"><Pencil className="size-3" /></button>
                            <button onClick={() => handleDeleteClick(status)} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {statuses.length === 0 && (
                    <p className="text-sm text-stone-400 text-center py-6">No statuses configured for this stage.</p>
                  )}
                </div>
              </div>

              {/* Add new */}
              <div className="px-5 py-3 border-t bg-stone-50/50">
                <div className="flex gap-2">
                  <Input
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    placeholder="Add a new status..."
                    className="text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                  />
                  <Button size="sm" className="gap-1 shrink-0" style={{ backgroundColor: stageObj?.color, color: '#fff' }} onClick={handleAdd} disabled={!newStatus.trim()}>
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Main Settings Page ──────────────────────────────────────

// ── Google Integration Section ──────────────────────────────

function GoogleIntegrationSection() {
  const { currentUser } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [flash, setFlash] = useState(null) // 'success' | 'denied' | 'error'

  useEffect(() => {
    // Check for OAuth callback result in URL
    const googleParam = searchParams.get('google')
    if (googleParam) {
      setFlash(googleParam)
      searchParams.delete('google')
      setSearchParams(searchParams, { replace: true })
      // Auto-dismiss flash after 5s
      setTimeout(() => setFlash(null), 5000)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!currentUser?.id) return
    setLoading(true)
    getGoogleStatus(currentUser.id)
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false))
  }, [currentUser?.id, flash])

  const handleConnect = () => {
    if (!currentUser?.id) return
    connectGoogle(currentUser.id)
  }

  const handleDisconnect = async () => {
    if (!currentUser?.id) return
    setDisconnecting(true)
    try {
      await disconnectGoogle(currentUser.id)
      setStatus({ connected: false })
    } catch {}
    setDisconnecting(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
        <Mail className="size-5" />
        Google Integration
      </h2>
      <p className="text-sm text-muted-foreground">
        Connect your Google account to enable Gmail and Google Calendar features.
      </p>

      {flash === 'success' && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="size-4" />
          Google account connected successfully!
        </div>
      )}
      {flash === 'denied' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <XCircle className="size-4" />
          Google authorization was cancelled.
        </div>
      )}
      {flash === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle className="size-4" />
          Something went wrong connecting Google. Please try again.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="size-4 animate-spin" />
              Checking connection...
            </div>
          ) : status?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connected</p>
                  <p className="text-sm text-muted-foreground">{status.google_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="size-3.5" /> Gmail
                  <Calendar className="size-3.5 ml-2" /> Calendar
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Not connected</p>
                  <p className="text-sm text-muted-foreground">Sign in with Google to enable email and calendar</p>
                </div>
              </div>
              <Button onClick={handleConnect}>
                Connect Google Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  const { currentRole, isMasterAdmin } = useRole()

  if (!isMasterAdmin && currentRole !== ROLES.SUPER_ADMIN) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Manage team, statuses, checklists, and app configuration"
      />
      <GoogleIntegrationSection />
      <div className="border-t border-stone-200" />
      <AdminNotesSection />
      <div className="border-t border-stone-200" />
      <UserManagementSection />
      <div className="border-t border-stone-200" />
      <StageStatusesSection />
      <div className="border-t border-stone-200" />
      <ChecklistsSection />
    </div>
  )
}
