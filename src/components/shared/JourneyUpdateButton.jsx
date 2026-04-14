import { useState, useEffect } from 'react'
import { Megaphone, Plus, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useRole } from '@/context/RoleContext'
import { getAppConfig, setAppConfig } from '@/lib/db'

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function JourneyUpdateButton({ caseId, caseType = 'journey', caseName, compact = false }) {
  const { currentUser } = useRole()
  const [open, setOpen] = useState(false)
  const [updates, setUpdates] = useState([])
  const [newUpdate, setNewUpdate] = useState('')
  const [saving, setSaving] = useState(false)
  const configKey = `journey_updates_${caseType}_${caseId}`

  useEffect(() => {
    if (!open || !caseId) return
    getAppConfig(configKey).then(saved => {
      if (saved && Array.isArray(saved)) setUpdates(saved)
    }).catch(() => {})
  }, [open, configKey])

  async function handleAdd() {
    if (!newUpdate.trim()) return
    setSaving(true)
    const entry = {
      id: Date.now().toString(),
      text: newUpdate.trim(),
      by: currentUser?.name || 'Admin',
      date: new Date().toISOString(),
    }
    const updated = [entry, ...updates]
    setUpdates(updated)
    setNewUpdate('')
    await setAppConfig(configKey, updated).catch(() => {})
    setSaving(false)
  }

  async function handleDelete(id) {
    const updated = updates.filter(u => u.id !== id)
    setUpdates(updated)
    await setAppConfig(configKey, updated).catch(() => {})
  }

  if (compact) {
    return (
      <>
        <button onClick={() => setOpen(true)} title="Journey Updates" className="text-stone-400 hover:text-[#283693] transition-colors">
          <Megaphone className="size-3.5" />
        </button>
        <UpdateDialog open={open} onOpenChange={setOpen} updates={updates} newUpdate={newUpdate} setNewUpdate={setNewUpdate} saving={saving} onAdd={handleAdd} onDelete={handleDelete} caseName={caseName} />
      </>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setOpen(true)}>
        <Megaphone className="size-3" /> Journey Update
      </Button>
      <UpdateDialog open={open} onOpenChange={setOpen} updates={updates} newUpdate={newUpdate} setNewUpdate={setNewUpdate} saving={saving} onAdd={handleAdd} onDelete={handleDelete} caseName={caseName} />
    </>
  )
}

function UpdateDialog({ open, onOpenChange, updates, newUpdate, setNewUpdate, saving, onAdd, onDelete, caseName }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-stone-400" /> Journey Updates {caseName ? `— ${caseName}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-y-auto">
          {/* Add new update */}
          <div className="flex gap-2">
            <Textarea
              value={newUpdate}
              onChange={e => setNewUpdate(e.target.value)}
              placeholder="Type a journey update..."
              rows={1}
              className="text-sm flex-1 resize-none border-stone-200 focus:border-stone-300 focus:ring-0"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAdd() } }}
            />
            <Button size="sm" className="gap-1 shrink-0 self-end" style={{ backgroundColor: '#283693' }} onClick={onAdd} disabled={saving || !newUpdate.trim()}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add
            </Button>
          </div>

          {/* Update history */}
          {updates.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-4">No updates yet.</p>
          ) : (
            <div className="space-y-2 border-t pt-3">
              {updates.map(u => (
                <div key={u.id} className="group rounded-lg border border-stone-100 px-3 py-2">
                  <p className="text-sm text-stone-700 whitespace-pre-wrap">{u.text}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-stone-400">
                      <Clock className="size-2.5" />
                      <span>{formatDate(u.date)}</span>
                      <span>by {u.by}</span>
                    </div>
                    <button onClick={() => onDelete(u.id)} className="text-[10px] text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
