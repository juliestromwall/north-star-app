import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { useAdminNotes } from '@/context/AdminNotesContext'
import { ROLES, ROLE_LABELS } from '@/lib/constants'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Plus, Megaphone, Trash2, Eye, EyeOff } from 'lucide-react'

// Admin users who can be targeted with notes
const TARGETABLE_USERS = [
  { id: 'u2', name: 'Julie Thompson', role: ROLES.MASTER_ADMIN },
  { id: 'u3', name: 'Sarah Mitchell', role: ROLES.ADMIN },
]

export default function SettingsPage() {
  const { currentRole, currentUser, isMasterAdmin } = useRole()
  const { getAllNotes, addNote, toggleNote, removeNote } = useAdminNotes()

  if (!isMasterAdmin && currentRole !== ROLES.SUPER_ADMIN) {
    return <Navigate to="/dashboard" replace />
  }

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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  const getUserName = (id) => {
    const u = TARGETABLE_USERS.find((u) => u.id === id)
    return u ? u.name : id
  }

  const getTargetLabel = (note) => {
    if (!note.target_user_ids) return 'All admins'
    return note.target_user_ids.map(getUserName).join(', ')
  }

  const getDismissalCount = (note) => {
    const dismissals = note.dismissals?.length || 0
    const total = note.target_user_ids ? note.target_user_ids.length : TARGETABLE_USERS.length
    return `${dismissals}/${total} read`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage admin notes and app configuration"
      />

      {/* Notes Section */}
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
                  note.is_active
                    ? 'bg-abc-indigo/5 border-abc-indigo/20'
                    : 'bg-muted/50 border-border opacity-60'
                }`}
              >
                <Megaphone className={`size-4 shrink-0 mt-0.5 ${note.is_active ? 'text-abc-indigo' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {note.title && <span className="font-semibold text-sm">{note.title}</span>}
                    {!note.is_active && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{note.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(note.created_at)}</span>
                    <span>{getTargetLabel(note)}</span>
                    <span>{getDismissalCount(note)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleNote(note.id)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={note.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {note.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <button
                    onClick={() => removeNote(note.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Publish Note Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. System Update"
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message *</label>
              <textarea
                value={noteMessage}
                onChange={(e) => setNoteMessage(e.target.value)}
                placeholder="Write your note..."
                rows={3}
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="target"
                    checked={noteTarget === 'all'}
                    onChange={() => setNoteTarget('all')}
                    className="accent-abc-indigo"
                  />
                  All Admins
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="target"
                    checked={noteTarget === 'specific'}
                    onChange={() => setNoteTarget('specific')}
                    className="accent-abc-indigo"
                  />
                  Specific Admins
                </label>
              </div>
              {noteTarget === 'specific' && (
                <div className="space-y-1.5 mt-2 pl-1">
                  {TARGETABLE_USERS.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={(e) => {
                          setSelectedUserIds((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                          )
                        }}
                        className="accent-abc-indigo"
                      />
                      {u.name}
                      <span className="text-xs text-muted-foreground">({ROLE_LABELS[u.role]})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handlePublish}
              disabled={!noteMessage.trim() || (noteTarget === 'specific' && selectedUserIds.length === 0)}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
