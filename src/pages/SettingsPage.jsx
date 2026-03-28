import { useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { useAdminNotes } from '@/context/AdminNotesContext'
import { ROLES, ROLE_LABELS, SURROGATE_STAGES } from '@/lib/constants'
import { getChecklistConfig, setChecklistSteps, addChecklistStep, editChecklistStep, deleteChecklistStep, resetChecklistToDefaults } from '@/lib/checklistStore'
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
import { Plus, Megaphone, Trash2, Eye, EyeOff, GripVertical, Pencil, Check, X, ClipboardList, RotateCcw } from 'lucide-react'

// ── Admin Notes Section (unchanged) ──────────────────────────

const TARGETABLE_USERS = [
  { id: 'u2', name: 'Julie Thompson', role: ROLES.MASTER_ADMIN },
  { id: 'u3', name: 'Sarah Mitchell', role: ROLES.ADMIN },
]

function AdminNotesSection() {
  const { currentUser } = useRole()
  const { getAllNotes, addNote, toggleNote, removeNote } = useAdminNotes()
  const notes = getAllNotes()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [noteTarget, setNoteTarget] = useState('all')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  const handlePublish = () => {
    if (!noteMessage.trim()) return
    addNote({
      title: noteTitle.trim() || null,
      message: noteMessage.trim(),
      target_user_ids: noteTarget === 'specific' ? selectedUserIds : null,
      created_by: currentUser?.id,
    })
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
    const dismissals = note.dismissals?.length || 0
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
                  <button onClick={() => toggleNote(note.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={note.is_active ? 'Deactivate' : 'Activate'}>
                    {note.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <button onClick={() => removeNote(note.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
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

function SortableStepRow({ step, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(step.label)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = () => {
    if (editLabel.trim() && editLabel.trim() !== step.label) {
      onEdit(step.id, editLabel.trim())
    }
    setEditing(false)
  }

  const handleCancel = () => {
    setEditLabel(step.label)
    setEditing(false)
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 shrink-0 touch-none">
        <GripVertical className="size-4" />
      </button>
      {editing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
          />
          <button onClick={handleSave} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-4" /></button>
          <button onClick={handleCancel} className="p-1 rounded hover:bg-stone-100 text-stone-400"><X className="size-4" /></button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium text-stone-700">{step.label}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => { setEditLabel(step.label); setEditing(true) }} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"><Pencil className="size-3.5" /></button>
            <button onClick={() => onDelete(step.id)} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Stage Checklist Card ──────────────────────────────────

function StageChecklistCard({ stage, userType, steps, onUpdate }) {
  const [newStepLabel, setNewStepLabel] = useState('')
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

  const handleAdd = () => {
    if (!newStepLabel.trim()) return
    addChecklistStep(userType, stage.id, newStepLabel.trim())
    setNewStepLabel('')
    onUpdate()
  }

  const handleEdit = (stepId, newLabel) => {
    editChecklistStep(userType, stage.id, stepId, newLabel)
    onUpdate()
  }

  const handleDelete = (stepId) => {
    deleteChecklistStep(userType, stage.id, stepId)
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
            <span className="text-xs text-stone-400 font-normal">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
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
      <CardContent className="space-y-2">
        {steps.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {steps.map(step => (
                  <SortableStepRow key={step.id} step={step} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-xs text-stone-400 py-3 text-center">No steps configured for this stage.</p>
        )}

        {/* Add step inline */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newStepLabel}
            onChange={e => setNewStepLabel(e.target.value)}
            placeholder="Add a step..."
            className="h-8 text-sm flex-1"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleAdd} disabled={!newStepLabel.trim()}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Screening Checklists Section ──────────────────────────

function ScreeningChecklistsSection() {
  const [userType, setUserType] = useState('gc')
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick(t => t + 1), [])

  const config = getChecklistConfig()
  const stages = SURROGATE_STAGES

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
          <ClipboardList className="size-5" />
          Screening Checklists
        </h2>
      </div>
      <CardDescription>
        Configure the checklist steps that appear for each case stage. Each stage has one checklist per user type.
      </CardDescription>

      <Tabs value={userType} onValueChange={setUserType}>
        <TabsList>
          <TabsTrigger value="gc">Surrogate (GC)</TabsTrigger>
          <TabsTrigger value="ip">Intended Parent (IP)</TabsTrigger>
        </TabsList>

        <TabsContent value="gc" className="space-y-4 mt-4">
          {stages.map(stage => (
            <StageChecklistCard
              key={stage.id}
              stage={stage}
              userType="gc"
              steps={config.gc?.[stage.id] || []}
              onUpdate={forceUpdate}
            />
          ))}
        </TabsContent>

        <TabsContent value="ip" className="space-y-4 mt-4">
          {stages.map(stage => (
            <StageChecklistCard
              key={stage.id}
              stage={stage}
              userType="ip"
              steps={config.ip?.[stage.id] || []}
              onUpdate={forceUpdate}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Main Settings Page ──────────────────────────────────────

export default function SettingsPage() {
  const { currentRole, isMasterAdmin } = useRole()

  if (!isMasterAdmin && currentRole !== ROLES.SUPER_ADMIN) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Manage admin notes, checklists, and app configuration"
      />
      <AdminNotesSection />
      <div className="border-t border-stone-200" />
      <ScreeningChecklistsSection />
    </div>
  )
}
