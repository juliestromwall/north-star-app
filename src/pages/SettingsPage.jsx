import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { fetchAllAdminNotes, insertAdminNote, updateAdminNote, deleteAdminNote } from '@/lib/db'
import { ROLES, ROLE_LABELS, SURROGATE_STAGES, DEFAULT_STATUSES_BY_STAGE, IP_STAGE_LABELS } from '@/lib/constants'
import { getStatusConfig, addStatus, editStatus, deleteStatus, getStatusesInUse, reorderStatuses } from '@/lib/stageStatusStore'
import { getChecklistConfig, setChecklistSteps, addChecklistStep, addChecklistSubtask, editChecklistStep, deleteChecklistStep, resetChecklistToDefaults, addChecklistMilestone, editChecklistMilestone, deleteChecklistMilestone, toggleStepInMilestone, setChecklistMilestones, normalizeOptions, addInfoRow, INFO_ROW_FIELDS, SURROGATE_INFO_ROW_FIELDS } from '@/lib/checklistStore'
import PageHeader from '@/components/shared/PageHeader'
import RichTextEditor from '@/components/shared/RichTextEditor'
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
import { Plus, Megaphone, Trash2, Eye, EyeOff, GripVertical, Pencil, Check, X, ClipboardList, RotateCcw, Milestone, ChevronDown, ChevronUp, Users, Shield, UserCog, Tag, AlertTriangle, Mail, Calendar, Unplug, Loader2, CheckCircle2, XCircle, CornerDownRight, Phone } from 'lucide-react'
import { mockUsers, loadAdminUsers } from '@/data/mock/users'
import { connectGoogle, getGoogleStatus, disconnectGoogle } from '@/lib/google'
import { getAppConfig, setAppConfig, uploadProfilePhoto } from '@/lib/db'
import { getAuthHeaders } from '@/lib/authHeaders'
import ProfileAvatar from '@/components/shared/ProfileAvatar'

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
]

// ── Admin Profile Section ──────────────────────────────────
function AdminProfileSection() {
  const { currentUser } = useRole()
  const [prefs, setPrefs] = useState({ timezone: 'America/Los_Angeles', defaultView: 'grid', avatarUrl: '', twilioPhone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const prefsKey = `user_prefs_${currentUser?.id}`

  useEffect(() => {
    if (!currentUser?.id) return
    getAppConfig(prefsKey).then(data => {
      if (data) setPrefs(p => ({ ...p, ...data }))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.id])

  async function handleSave() {
    setSaving(true)
    try {
      await setAppConfig(prefsKey, prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error('Failed to save preferences:', err) }
    finally { setSaving(false) }
  }

  async function handleAvatarUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadProfilePhoto(currentUser.id, file)
      if (result?.url) {
        const updated = { ...prefs, avatarUrl: result.url }
        setPrefs(updated)
        await setAppConfig(prefsKey, updated)
      }
    } catch (err) { console.error('Upload failed:', err) }
    finally { setUploading(false) }
  }

  if (loading) return null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-stone-800 flex items-center gap-2">
          <UserCog className="size-5 text-[#1A3638]" /> Admin Settings
        </h3>
        <p className="text-sm text-stone-400 mt-0.5">Your personal profile and preferences</p>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-6">
          {/* Profile Image */}
          <div className="space-y-2">
            <label className="text-xs text-stone-500 font-semibold uppercase tracking-wider">Profile Image</label>
            <div className="flex items-center gap-4">
              <ProfileAvatar name={currentUser?.name || ''} avatar={prefs.avatarUrl || currentUser?.avatar} size="xl" />
              <div className="space-y-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#1A3638] text-white hover:bg-[#0F2628] transition-colors">
                  {uploading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleAvatarUpload(e.target.files?.[0])} disabled={uploading} />
                </label>
                {prefs.avatarUrl && (
                  <button onClick={() => setPrefs(p => ({ ...p, avatarUrl: '' }))} className="block text-[10px] text-stone-400 hover:text-red-500 transition-colors">
                    Remove photo
                  </button>
                )}
                <p className="text-[10px] text-stone-400">JPG, PNG, or GIF. Max 5MB.</p>
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-500 font-semibold uppercase tracking-wider">Timezone</label>
            <select
              value={prefs.timezone}
              onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
              className="w-full max-w-sm h-9 text-sm border border-stone-200 rounded-md px-2 bg-white"
            >
              <option value="">Auto-detect</option>
              {US_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Default View */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-500 font-semibold uppercase tracking-wider">Default Case View</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrefs(p => ({ ...p, defaultView: 'grid' }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${prefs.defaultView === 'grid' ? 'border-[#1A3638] bg-[#1A3638]/5 text-[#1A3638]' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                Card View
              </button>
              <button
                onClick={() => setPrefs(p => ({ ...p, defaultView: 'list' }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${prefs.defaultView === 'list' ? 'border-[#1A3638] bg-[#1A3638]/5 text-[#1A3638]' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                List View
              </button>
            </div>
          </div>

          {/* Twilio Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs text-stone-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="size-3.5" /> Twilio Phone Number
            </label>
            <Input
              value={prefs.twilioPhone || ''}
              onChange={e => setPrefs(p => ({ ...p, twilioPhone: e.target.value }))}
              placeholder="+1XXXXXXXXXX"
              className="max-w-sm"
            />
            <p className="text-[10px] text-stone-400">Your personal Twilio number for sending texts from the app</p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <Button size="sm" style={{ backgroundColor: '#1A3638' }} className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : saved ? <CheckCircle2 className="size-3" /> : <Check className="size-3" />}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
            </Button>
            {saved && <span className="text-xs text-green-600 font-medium">Preferences saved successfully</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Admin Notes Section (unchanged) ──────────────────────────

const TARGETABLE_USERS = [
  { id: 'u2', name: 'Julie Allgood', role: ROLES.MASTER_ADMIN },
  { id: 'u3', name: 'Nicole Lawson', role: ROLES.MASTER_ADMIN },
  { id: 'u4', name: 'Emily Rotter', role: ROLES.ADMIN },
  { id: 'u5', name: 'Stacie Adler', role: ROLES.ADMIN },
  { id: 'u6', name: 'Desiree Melchiori', role: ROLES.ADMIN },
  { id: 'u7', name: 'Jennifer Rose', role: ROLES.ADMIN },
]

export function AdminNotesSection() {
  const { currentUser } = useRole()
  const [notes, setNotes] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [noteTarget, setNoteTarget] = useState('all')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  useEffect(() => {
    fetchAllAdminNotes().then(data => setNotes(data || [])).catch(() => {})
  }, [])

  function openEditDialog(note) {
    setEditingNote(note)
    setNoteTitle(note.title || '')
    setNoteMessage(note.message || '')
    setNoteTarget(note.target_user_ids ? 'specific' : 'all')
    setSelectedUserIds(note.target_user_ids || [])
    setDialogOpen(true)
  }

  function openNewDialog() {
    setEditingNote(null)
    setNoteTitle('')
    setNoteMessage('')
    setNoteTarget('all')
    setSelectedUserIds([])
    setDialogOpen(true)
  }

  const handlePublish = async () => {
    if (!noteMessage.trim()) return
    try {
      if (editingNote) {
        // Update existing note
        const updates = { title: noteTitle.trim() || null, message: noteMessage.trim() }
        if (noteTarget === 'specific' && selectedUserIds.length > 0) updates.target_user_ids = selectedUserIds
        else updates.target_user_ids = null
        await updateAdminNote(editingNote.id, updates)
        setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, ...updates } : n))
      } else {
        // Create new note
        const insertData = {
          title: noteTitle.trim() || null,
          message: noteMessage.trim(),
          is_active: true,
          created_by: currentUser?.name || '',
        }
        if (noteTarget === 'specific' && selectedUserIds.length > 0) insertData.target_user_ids = selectedUserIds
        const note = await insertAdminNote(insertData)
        if (note) setNotes(prev => [note, ...prev])
      }
    } catch (err) { console.error('Failed to save note:', err) }
    setDialogOpen(false)
    setEditingNote(null)
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
          <Button size="sm" onClick={openNewDialog}>
            <Plus className="size-4" />
            Publish Note
          </Button>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No notes published yet.</p>
        ) : (
          <>
          <style>{`
            .admin-note-preview ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
            .admin-note-preview ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
            .admin-note-preview li { margin: 0.15em 0; }
            .admin-note-preview li p { margin: 0; }
            .admin-note-preview p { margin: 0.15em 0; }
            .admin-note-preview mark { border-radius: 2px; padding: 1px 2px; }
            .admin-note-preview img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
            .admin-note-preview::after { content: ''; display: table; clear: both; }
          `}</style>
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`relative rounded-2xl overflow-hidden border-2 ${
                  note.is_active ? 'border-[#D4A853]/20' : 'border-stone-200 opacity-50'
                }`}
                style={note.is_active ? { background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fff1f2 100%)' } : { background: '#f5f5f4' }}
              >
                {note.is_active && <div className="absolute top-0 left-0 w-1.5 h-full bg-[#D4A853]" />}
                <div className="flex items-start gap-3 px-5 py-4 pl-6">
                  <div className={`flex items-center justify-center size-9 rounded-full shrink-0 mt-0.5 ${note.is_active ? 'bg-[#D4A853]/10' : 'bg-stone-200'}`}>
                    <Megaphone className={`size-4 ${note.is_active ? 'text-[#D4A853]' : 'text-stone-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.title && <span className="font-bold text-[#1A3638] text-base">{note.title}</span>}
                      {!note.is_active && <span className="text-xs bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <div className="text-sm text-stone-600 mt-0.5 leading-relaxed admin-note-preview" dangerouslySetInnerHTML={{ __html: note.message }} />
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-stone-400">
                      <span>{formatDate(note.created_at)}</span>
                      <span>{getTargetLabel(note)}</span>
                      <span>{getDismissalCount(note)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditDialog(note)} className="p-1.5 rounded hover:bg-white/50 text-stone-400 hover:text-[#1A3638] transition-colors" title="Edit">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={async () => {
                      try {
                        await updateAdminNote(note.id, { is_active: !note.is_active })
                        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_active: !n.is_active } : n))
                      } catch {}
                    }} className="p-1.5 rounded hover:bg-white/50 text-stone-400 hover:text-stone-600 transition-colors" title={note.is_active ? 'Deactivate' : 'Activate'}>
                      {note.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button onClick={async () => {
                      try {
                        await deleteAdminNote(note.id)
                        setNotes(prev => prev.filter(n => n.id !== note.id))
                      } catch {}
                    }} className="p-1.5 rounded hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader className="shrink-0"><DialogTitle>{editingNote ? 'Edit Note' : 'Publish Note'}</DialogTitle></DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. System Update" className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message *</label>
              <RichTextEditor content={noteMessage} onChange={setNoteMessage} placeholder="Write your note..." minHeight="200px" />
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
          <DialogFooter className="shrink-0 border-t border-stone-100 pt-4">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handlePublish} disabled={!noteMessage.trim() || (noteTarget === 'specific' && selectedUserIds.length === 0)}>{editingNote ? 'Save Changes' : 'Publish'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Sortable Step Row ──────────────────────────────────────

const LOG_TYPE_LABELS = { status: 'Status Dropdown', text: 'Text Field', dropdown: 'Custom Dropdown', date_completed: 'Date Completed' }
const LOG_TYPE_COLORS = { status: 'bg-blue-50 text-blue-600', text: 'bg-amber-50 text-amber-600', dropdown: 'bg-purple-50 text-purple-600', date_completed: 'bg-emerald-50 text-emerald-600' }

// Status choices a custom dropdown option can map to (drives the color shown)
const OPTION_STATUS_CHOICES = [
  { id: 'requested',   label: 'Requested',   dot: 'bg-amber-500' },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { id: 'reviewing',   label: 'Reviewing',   dot: 'bg-purple-500' },
  { id: 'complete',    label: 'Complete',    dot: 'bg-green-500' },
  { id: 'na',          label: 'N/A',         dot: 'bg-stone-400' },
]

function DropdownOptionsEditor({ options, onChange }) {
  const opts = normalizeOptions(options)
  const update = (i, patch) => onChange(opts.map((o, idx) => idx === i ? { ...o, ...patch } : o))
  const remove = (i) => onChange(opts.filter((_, idx) => idx !== i))
  const add = () => onChange([...opts, { label: '', mapsTo: 'in_progress' }])

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Options</label>
      {opts.length === 0 && <p className="text-[11px] text-stone-400 italic">No options yet.</p>}
      {opts.map((opt, i) => {
        const choice = OPTION_STATUS_CHOICES.find(c => c.id === opt.mapsTo) || OPTION_STATUS_CHOICES[1]
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full shrink-0 ${choice.dot}`} />
            <Input
              value={opt.label}
              onChange={e => update(i, { label: e.target.value })}
              placeholder="Option label"
              className="h-7 text-xs flex-1"
            />
            <select
              value={opt.mapsTo}
              onChange={e => update(i, { mapsTo: e.target.value })}
              className="h-7 text-[10px] border rounded px-1.5 bg-white text-stone-600"
              title="Color / status"
            >
              {OPTION_STATUS_CHOICES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button onClick={() => remove(i)} className="p-1 text-stone-300 hover:text-red-500" title="Remove option">
              <X className="size-3" />
            </button>
          </div>
        )
      })}
      <button onClick={add} type="button" className="text-[11px] font-semibold text-[#1A3638] hover:underline">
        + Add option
      </button>
    </div>
  )
}

// Read-only by default. ChecklistsSection wraps its children in this provider
// and flips it true only after the admin clicks "Enable Edit Mode". Gates every
// mutation control in the checklist editor — guards against the 2026-05-03 wipe.
const ChecklistEditModeContext = createContext(false)
const useChecklistEditMode = () => useContext(ChecklistEditModeContext)

function SortableStepRow({ step, subtasks = [], onEdit, onDelete, onAddSubtask, onEditSubtask, onDeleteSubtask }) {
  const editMode = useChecklistEditMode()
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(step.label)
  const [editLogType, setEditLogType] = useState(step.logType || 'status')
  const [editOptions, setEditOptions] = useState(normalizeOptions(step.options))
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskLabel, setNewSubtaskLabel] = useState('')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = () => {
    const opts = editLogType === 'dropdown'
      ? editOptions.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), mapsTo: o.mapsTo || 'in_progress' }))
      : []
    onEdit(step.id, { label: editLabel.trim() || step.label, logType: editLogType, options: opts })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditLabel(step.label)
    setEditLogType(step.logType || 'status')
    setEditOptions(normalizeOptions(step.options))
    setEditing(false)
  }

  const logType = step.logType || 'status'

  const isInfoRow = step.type === 'info_row'

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border px-3 py-2.5 group ${isInfoRow ? 'bg-[#1A3638]/5 border-[#1A3638]/20' : 'bg-white'}`}>
      <div className="flex items-center gap-2">
        {editMode ? (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 shrink-0 touch-none">
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        {isInfoRow ? (
          <>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[9px] font-bold text-[#1A3638] bg-[#1A3638]/10 px-1.5 py-0.5 rounded">INFO</span>
              <span className="text-sm font-medium text-[#1A3638]">{step.label}</span>
            </div>
            {editMode && (
              <button onClick={() => onDelete(step.id)} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
            )}
          </>
        ) : editing ? (
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
                <option value="date_completed">Date Completed</option>
              </select>
            </div>
            {editLogType === 'dropdown' && (
              <DropdownOptionsEditor options={editOptions} onChange={setEditOptions} />
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
                <span className="text-[10px] text-stone-400 ml-1">({normalizeOptions(step.options).map(o => o.label).join(', ')})</span>
              )}
            </div>
            {editMode && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setAddingSubtask(true); setNewSubtaskLabel('') }} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-[#1A3638]" title="Add subtask"><CornerDownRight className="size-3.5" /></button>
                {step.locked ? (
                  <span className="text-[9px] text-stone-400 font-medium px-1.5 py-0.5 rounded bg-stone-100">🔒 Locked</span>
                ) : (
                  <>
                    <button onClick={() => { setEditLabel(step.label); setEditLogType(step.logType || 'status'); setEditOptions(normalizeOptions(step.options)); setEditing(true) }} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"><Pencil className="size-3.5" /></button>
                    <button onClick={() => onDelete(step.id)} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Subtasks — draggable within the parent group */}
      {(subtasks.length > 0 || addingSubtask) && (
        <div className="ml-6 mt-1.5 space-y-1 border-l-2 border-stone-100 pl-3">
          <SortableContext items={subtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {subtasks.map(sub => (
              <SubtaskRow
                key={sub.id}
                subtask={sub}
                onEdit={(updates) => onEditSubtask(sub.id, updates)}
                onDelete={() => onDeleteSubtask(sub.id)}
              />
            ))}
          </SortableContext>
          {addingSubtask && (
            <div className="flex items-center gap-1.5 py-1">
              <CornerDownRight className="size-3 text-stone-300 shrink-0" />
              <Input
                value={newSubtaskLabel}
                onChange={e => setNewSubtaskLabel(e.target.value)}
                placeholder="Subtask name"
                className="h-7 text-xs flex-1"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSubtaskLabel.trim()) {
                    onAddSubtask(step.id, newSubtaskLabel.trim())
                    setNewSubtaskLabel('')
                    setAddingSubtask(false)
                  }
                  if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskLabel('') }
                }}
              />
              <button
                onClick={() => {
                  if (newSubtaskLabel.trim()) { onAddSubtask(step.id, newSubtaskLabel.trim()); setNewSubtaskLabel(''); setAddingSubtask(false) }
                }}
                className="p-1 rounded hover:bg-emerald-50 text-emerald-600"
              ><Check className="size-3.5" /></button>
              <button onClick={() => { setAddingSubtask(false); setNewSubtaskLabel('') }} className="p-1 rounded hover:bg-stone-100 text-stone-400"><X className="size-3.5" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Subtask Row (draggable, full edit incl. custom dropdowns) ──────

function SubtaskRow({ subtask, onEdit, onDelete }) {
  const editMode = useChecklistEditMode()
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(subtask.label)
  const [editLogType, setEditLogType] = useState(subtask.logType || 'status')
  const [editOptions, setEditOptions] = useState(normalizeOptions(subtask.options))

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const save = () => {
    const opts = editLogType === 'dropdown'
      ? editOptions.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), mapsTo: o.mapsTo || 'in_progress' }))
      : []
    onEdit({ label: editLabel.trim() || subtask.label, logType: editLogType, options: opts })
    setEditing(false)
  }
  const cancel = () => {
    setEditLabel(subtask.label)
    setEditLogType(subtask.logType || 'status')
    setEditOptions(normalizeOptions(subtask.options))
    setEditing(false)
  }

  const logType = subtask.logType || 'status'

  return (
    <div ref={setNodeRef} style={style} className="group/sub py-0.5">
      <div className="flex items-start gap-1.5">
        {editMode ? (
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 shrink-0 touch-none mt-0.5" title="Drag to reorder">
            <GripVertical className="size-3.5" />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden />
        )}
        <CornerDownRight className="size-3 text-stone-300 shrink-0 mt-1" />
        {editing ? (
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="h-7 text-xs flex-1"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && editLogType !== 'dropdown') save(); if (e.key === 'Escape') cancel() }}
                placeholder="Subtask name"
              />
              <select value={editLogType} onChange={e => setEditLogType(e.target.value)} className="h-7 text-[10px] border rounded px-1.5 bg-white">
                <option value="status">Status Dropdown</option>
                <option value="text">Text Field</option>
                <option value="dropdown">Custom Dropdown</option>
                <option value="date_completed">Date Completed</option>
              </select>
            </div>
            {editLogType === 'dropdown' && (
              <DropdownOptionsEditor options={editOptions} onChange={setEditOptions} />
            )}
            <div className="flex gap-1">
              <button onClick={save} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-3.5" /></button>
              <button onClick={cancel} className="p-1 rounded hover:bg-stone-100 text-stone-400"><X className="size-3.5" /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-stone-600">{subtask.label}</span>
              {logType !== 'status' && (
                <span className={`ml-2 text-[8px] font-semibold px-1 py-0.5 rounded-full ${LOG_TYPE_COLORS[logType] || ''}`}>
                  {LOG_TYPE_LABELS[logType] || logType}
                </span>
              )}
              {logType === 'dropdown' && subtask.options?.length > 0 && (
                <span className="text-[9px] text-stone-400 ml-1">({normalizeOptions(subtask.options).map(o => o.label).join(', ')})</span>
              )}
            </div>
            {editMode && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                <button onClick={() => { setEditLabel(subtask.label); setEditLogType(subtask.logType || 'status'); setEditOptions(normalizeOptions(subtask.options)); setEditing(true) }} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"><Pencil className="size-3" /></button>
                <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Milestone Row ──────────────────────────────────────

function MilestoneRow({ milestone, steps, userType, stageId, onUpdate }) {
  const editMode = useChecklistEditMode()
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
                {editMode && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditLabel(milestone.label); setEditing(true) }} className="p-1 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600"><Pencil className="size-3" /></button>
                    <button onClick={() => { deleteChecklistMilestone(userType, stageId, milestone.id); onUpdate() }} className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
                  </div>
                )}
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
                <label key={step.id} className={`flex items-center gap-2 text-xs py-0.5 rounded px-1 -mx-1 ${editMode ? 'cursor-pointer hover:bg-stone-100' : 'cursor-default'}`}>
                  <Checkbox
                    checked={milestone.stepIds?.includes(step.id)}
                    onCheckedChange={() => editMode && handleToggleStep(step.id)}
                    disabled={!editMode}
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

function StageChecklistCard({ stage, userType, stageData, onUpdate, isJourney }) {
  const editMode = useChecklistEditMode()
  const steps = stageData?.steps || []
  const milestones = stageData?.milestones || []
  const [newStepLabel, setNewStepLabel] = useState('')
  const [newStepLogType, setNewStepLogType] = useState('status')
  const [newStepOptions, setNewStepOptions] = useState([])
  const [newMilestoneLabel, setNewMilestoneLabel] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [infoRowField, setInfoRowField] = useState('')

  // Which info row fields are already added
  const usedInfoFields = steps.filter(s => s.type === 'info_row').map(s => s.dataField)
  const isGcChecklist = userType === 'gc' && !isJourney
  const allInfoFields = isJourney ? INFO_ROW_FIELDS : isGcChecklist ? SURROGATE_INFO_ROW_FIELDS : []
  const availableInfoFields = allInfoFields.filter(f => !usedInfoFields.includes(f.key))
  const showInfoRows = (isJourney || isGcChecklist) && availableInfoFields.length > 0

  function handleAddInfoRow() {
    if (!infoRowField) return
    addInfoRow(userType, stage.id, infoRowField)
    setInfoRowField('')
    onUpdate()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Split into top-level steps and subtasks (children grouped by parent)
  const topLevelSteps = steps.filter(s => !s.parentId)
  const subtasksByParent = steps.reduce((acc, s) => {
    if (s.parentId) {
      if (!acc[s.parentId]) acc[s.parentId] = []
      acc[s.parentId].push(s)
    }
    return acc
  }, {})

  const handleDragEnd = (event) => {
    if (!editMode) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeStep = steps.find(s => s.id === active.id)
    const overStep = steps.find(s => s.id === over.id)
    if (!activeStep || !overStep) return

    // Subtask drag — reorder within the same parent group only.
    if (activeStep.parentId && overStep.parentId === activeStep.parentId) {
      const siblings = subtasksByParent[activeStep.parentId] || []
      const oldIdx = siblings.findIndex(s => s.id === active.id)
      const newIdx = siblings.findIndex(s => s.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(siblings, oldIdx, newIdx)
      const newSteps = []
      for (const parent of topLevelSteps) {
        newSteps.push(parent)
        if (parent.id === activeStep.parentId) {
          newSteps.push(...reordered)
        } else {
          newSteps.push(...(subtasksByParent[parent.id] || []))
        }
      }
      setChecklistSteps(userType, stage.id, newSteps)
      onUpdate()
      return
    }

    // Top-level step drag — reorder parents (children move with their parent).
    if (!activeStep.parentId && !overStep.parentId) {
      const oldIndex = topLevelSteps.findIndex(s => s.id === active.id)
      const newIndex = topLevelSteps.findIndex(s => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const reorderedTop = arrayMove(topLevelSteps, oldIndex, newIndex)
      const newSteps = []
      for (const parent of reorderedTop) {
        newSteps.push(parent)
        const children = subtasksByParent[parent.id] || []
        newSteps.push(...children)
      }
      setChecklistSteps(userType, stage.id, newSteps)
      onUpdate()
    }
    // Cross-parent or step↔subtask drags ignored — would change hierarchy.
  }

  const handleAddSubtask = (parentId, label) => {
    addChecklistSubtask(userType, stage.id, parentId, label)
    onUpdate()
  }

  const handleAddStep = () => {
    if (!newStepLabel.trim()) return
    const opts = newStepLogType === 'dropdown'
      ? newStepOptions.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), mapsTo: o.mapsTo || 'in_progress' }))
      : []
    addChecklistStep(userType, stage.id, newStepLabel.trim(), newStepLogType, opts)
    setNewStepLabel('')
    setNewStepLogType('status')
    setNewStepOptions([])
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
          {editMode && (
            confirmReset ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Reset to defaults?</span>
                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleReset}>Reset</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)} className="text-stone-400 hover:text-stone-600 p-1 rounded hover:bg-stone-100" title="Reset to defaults">
                <RotateCcw className="size-3.5" />
              </button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Steps */}
        <div className="space-y-2">
          <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Steps</p>
          {topLevelSteps.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={topLevelSteps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {topLevelSteps.map(step => (
                    <SortableStepRow
                      key={step.id}
                      step={step}
                      subtasks={subtasksByParent[step.id] || []}
                      onEdit={handleEditStep}
                      onDelete={handleDeleteStep}
                      onAddSubtask={handleAddSubtask}
                      onEditSubtask={handleEditStep}
                      onDeleteSubtask={handleDeleteStep}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-xs text-stone-400 py-2 text-center">No steps configured.</p>
          )}
          {editMode && (
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
                <div className="rounded-lg border bg-stone-50/50 p-2.5">
                  <DropdownOptionsEditor options={newStepOptions} onChange={setNewStepOptions} />
                </div>
              )}
            </div>
          )}

          {/* Info Rows — journey only */}
          {editMode && showInfoRows && (
            <div className="border-t border-stone-100 pt-3 mt-2">
              <p className="text-[10px] text-[#1A3638] uppercase tracking-wider font-semibold mb-2">{isJourney ? 'Provider Info Rows' : 'Screening Surrogate Info'}</p>
              <p className="text-[10px] text-stone-400 mb-2">These show data in Case Updates (not on the case checklist). Drag to reorder with steps above.</p>
              <div className="flex items-center gap-2">
                <select value={infoRowField} onChange={e => setInfoRowField(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white text-stone-600 flex-1">
                  <option value="">Select provider field...</option>
                  {availableInfoFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-[#1A3638]/30 text-[#1A3638] hover:bg-[#1A3638]/5" onClick={handleAddInfoRow} disabled={!infoRowField}>
                  <Plus className="size-3.5" /> Add Info Row
                </Button>
              </div>
            </div>
          )}
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
          {editMode && (
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Checklists Section (collapsible) ──────────────────────

const CASE_STAGES = ['pre-qualification', 'screening', 'matching', 'holding', 'not-qualified', 'withdrawn']
const JOURNEY_STAGES = ['journey-oversight']

function ChecklistsSection() {
  const [open, setOpen] = useState(false)
  const [userType, setUserType] = useState('gc')
  const [activeStage, setActiveStage] = useState('pre-qualification')
  const [editMode, setEditMode] = useState(false)
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick(t => t + 1), [])

  // Auto-lock when the section is collapsed so reopening starts read-only.
  useEffect(() => { if (!open && editMode) setEditMode(false) }, [open, editMode])

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
        <ChecklistEditModeContext.Provider value={editMode}>
        <div className="space-y-4 mt-3">
          <CardDescription>
            Configure the checklist steps that appear for each case stage. Each stage has one checklist per user type.
          </CardDescription>

          {/* Edit-mode gate — read-only by default. Prevents accidental wipes. */}
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${editMode ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-200'}`}>
            <div className="flex items-center gap-2 text-xs">
              {editMode ? (
                <>
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <span className="text-amber-800 font-medium">Edit mode is on — every add, edit, delete, drag, or reset writes to production immediately.</span>
                </>
              ) : (
                <>
                  <Eye className="size-4 text-stone-400 shrink-0" />
                  <span className="text-stone-500">Read-only. Click <span className="font-semibold text-stone-700">Edit Checklist</span> to make changes.</span>
                </>
              )}
            </div>
            {editMode ? (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setEditMode(false)}>
                <Check className="size-3.5" /> Done Editing
              </Button>
            ) : (
              <Button size="sm" className="h-7 text-xs gap-1.5 bg-[#1A3638] hover:bg-[#1A3638]/90" onClick={() => setEditMode(true)}>
                <Pencil className="size-3.5" /> Edit Checklist
              </Button>
            )}
          </div>

          <div className="flex gap-2 border-b pb-2">
            {[
              { key: 'gc', label: 'Surrogate (GC)' },
              { key: 'ip', label: 'Intended Parent (IP)' },
              { key: 'journey', label: 'Matched Journeys' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${userType === tab.key ? 'bg-[#1A3638] text-white' : 'text-stone-600 hover:bg-stone-100'}`}
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
              <StageChecklistCard key={activeStage} stage={activeStageObj} userType={configKey} stageData={stageData} onUpdate={forceUpdate} isJourney={userType === 'journey'} />
            </div>
          </div>
        </div>
        </ChecklistEditModeContext.Provider>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── User Management Section ──────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'master_admin', label: 'Master Admin' },
  { value: 'office_admin', label: 'Office Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'records_admin', label: 'Records Admin' },
]

const ROLE_BADGE_STYLES = {
  master_admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  office_admin: 'bg-violet-100 text-violet-700 border-violet-200',
  admin: 'bg-sky-100 text-sky-700 border-sky-200',
  marketing: 'bg-amber-100 text-amber-700 border-amber-200',
  records_admin: 'bg-purple-100 text-purple-700 border-purple-200',
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
      // Persist to Supabase Auth
      try {
        const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
        const res = await fetch('/api/update-admin', {
          method: 'POST',
          headers,
          body: JSON.stringify({ userId: editingId, name: form.name.trim(), email: form.email.trim(), role: form.role }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update')
        // Update local state + refresh cache
        setUsers(prev => prev.map(u => u.id === editingId ? { ...u, name: form.name.trim(), email: form.email.trim(), role: form.role } : u))
        await loadAdminUsers()
      } catch (err) {
        alert('Failed to save: ' + err.message)
        return
      }
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
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@northstarsurrogacy.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${form.role === opt.value ? 'border-[#1A3638] bg-[#1A3638]/5' : 'border-stone-200 hover:border-stone-300'}`}>
                    <input type="radio" name="role" value={opt.value} checked={form.role === opt.value} onChange={() => setForm(f => ({ ...f, role: opt.value }))} className="accent-[#1A3638]" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-stone-400">
                        {opt.value === 'master_admin' && 'Full access to all modules and settings'}
                        {opt.value === 'office_admin' && 'Admin access plus settings (notes, team, statuses, checklists)'}
                        {opt.value === 'admin' && 'Operations, clients, forms, and messaging'}
                        {opt.value === 'marketing' && 'Read-only analytics and intake submissions'}
                        {opt.value === 'records_admin' && 'Medical records summary only'}
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

  // Move a status one slot up or down. The first slot is the stage's "default"
  // status, so reordering also changes which one new cases auto-receive.
  function handleMove(idx, direction) {
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= statuses.length) return
    const next = [...statuses]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    const updated = reorderStatuses(activeStage, next, userType)
    setConfig({ ...updated })
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${userType === tab.key ? 'bg-[#1A3638] text-white' : 'text-stone-600 hover:bg-stone-100'}`}
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
                            <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0}
                              className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-[#1A3638] disabled:text-stone-200 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                              title={idx === 0 ? 'Already at top' : 'Move up'}>
                              <ChevronUp className="size-3" />
                            </button>
                            <button onClick={() => handleMove(idx, 'down')} disabled={idx === statuses.length - 1}
                              className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-[#1A3638] disabled:text-stone-200 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                              title={idx === statuses.length - 1 ? 'Already at bottom' : 'Move down'}>
                              <ChevronDown className="size-3" />
                            </button>
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
  const { currentRole, isMasterAdmin, canEditSettings } = useRole()

  if (!canEditSettings) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Manage team, statuses, checklists, and app configuration"
      />
      <AdminProfileSection />
      <div className="border-t border-stone-200" />
      <GoogleIntegrationSection />
      <div className="border-t border-stone-200" />
      <UserManagementSection />
      <div className="border-t border-stone-200" />
      <StageStatusesSection />
      <div className="border-t border-stone-200" />
      <ChecklistsSection />
    </div>
  )
}
