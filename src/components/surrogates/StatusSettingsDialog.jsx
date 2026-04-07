import { useState } from 'react'
import { Settings, Plus, Pencil, Trash2, AlertTriangle, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { SURROGATE_STAGES } from '@/lib/constants'
import {
  getStatusConfig, addStatus, editStatus, deleteStatus, getStatusesInUse,
} from '@/lib/stageStatusStore'

export default function StatusSettingsDialog() {
  const [open, setOpen] = useState(false)
  const [activeStage, setActiveStage] = useState(SURROGATE_STAGES[0].id)
  const [config, setConfig] = useState(() => getStatusConfig())
  const [newStatus, setNewStatus] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { label, inUseCount }

  const userType = activeStage === 'journey-oversight' ? 'journey' : 'gc'
  const statuses = config[userType]?.[activeStage] || config[activeStage] || []
  const stageObj = SURROGATE_STAGES.find(s => s.id === activeStage)

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Manage Statuses">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0">
        <div className="flex h-[70vh]">
          {/* Stage tabs */}
          <div className="w-48 shrink-0 border-r bg-stone-50/50 p-3 space-y-1 overflow-y-auto">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold px-2 mb-2">Stages</p>
            {SURROGATE_STAGES.map(stage => (
              <button
                key={stage.id}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  activeStage === stage.id ? 'font-semibold text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
                style={activeStage === stage.id ? { backgroundColor: stage.color } : {}}
                onClick={() => { setActiveStage(stage.id); setEditingIdx(null); setDeleteConfirm(null) }}
              >
                {stage.label}
              </button>
            ))}
          </div>

          {/* Status list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b">
              <h3 className="text-lg font-bold" style={{ color: stageObj?.color }}>
                {stageObj?.label} Statuses
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">Manage available statuses for this stage</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {/* Delete confirmation */}
              {deleteConfirm && (
                <div className="mb-3 p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="size-4" />
                    <span className="text-sm font-semibold">
                      "{deleteConfirm.label}" is used by {deleteConfirm.inUseCount} surrogate{deleteConfirm.inUseCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => handleDeleteConfirm('remove_from_all')}>
                      Remove from all
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleDeleteConfirm('soft_delete')}>
                      Just hide from picker
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDeleteConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {statuses.map((status, idx) => (
                  <div
                    key={`${status}-${idx}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-50 group"
                  >
                    {editingIdx === idx ? (
                      <>
                        <Input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="h-7 text-sm flex-1"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(idx); if (e.key === 'Escape') setEditingIdx(null) }}
                        />
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => handleSaveEdit(idx)}>
                          <Check className="size-3.5 text-emerald-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingIdx(null)}>
                          <X className="size-3.5 text-stone-400" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: stageObj?.color }}
                        />
                        <span className="flex-1 text-sm text-stone-700">{status}</span>
                        {idx === 0 && (
                          <span className="text-[10px] text-stone-300 uppercase tracking-wider">Default</span>
                        )}
                        <Button
                          size="icon" variant="ghost"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleStartEdit(idx)}
                        >
                          <Pencil className="size-3 text-stone-400" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteClick(status)}
                        >
                          <Trash2 className="size-3 text-stone-400" />
                        </Button>
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
      </DialogContent>
    </Dialog>
  )
}
