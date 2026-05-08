import { useState, useEffect } from 'react'
import { Megaphone, Plus, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useRole } from '@/context/RoleContext'
import { getAppConfig, setAppConfig } from '@/lib/db'
import { findJourneyByCaseId } from '@/lib/matching'

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function normalizeCaseType(caseType) {
  const t = String(caseType || 'journey').toLowerCase()
  if (t === 'surrogate') return 'gc'
  return t
}

function parseUpdates(saved) {
  if (Array.isArray(saved)) return saved
  if (typeof saved === 'string') {
    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function mergeUpdates(arrays) {
  const seen = new Set()
  const merged = []
  for (const arr of arrays) {
    for (const item of arr) {
      if (!item) continue
      const key = item.id || `${item.date || ''}__${item.by || ''}__${item.text || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
  }
  return merged.sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime())
}

function cleanCaseName(caseName) {
  const raw = String(caseName || '').trim()
  if (!raw) return ''
  const cleaned = raw
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^(?:&\s*)+|(?:\s*&)+$/g, '')
    .trim()
  return cleaned
}

export default function JourneyUpdateButton({ caseId, caseType = 'journey', caseName, compact = false, hideIfEmpty = false }) {
  const { currentUser } = useRole()
  const [open, setOpen] = useState(false)
  const [updates, setUpdates] = useState([])
  const [loadedOnMount, setLoadedOnMount] = useState(!hideIfEmpty)
  const [newUpdate, setNewUpdate] = useState('')
  const [saving, setSaving] = useState(false)
  const [configKey, setConfigKey] = useState(caseId ? `journey_updates_${normalizeCaseType(caseType)}_${caseId}` : '')
  const [candidateKeys, setCandidateKeys] = useState([])
  const displayCaseName = cleanCaseName(caseName)

  useEffect(() => {
    let cancelled = false
    async function resolveKeys() {
      if (!caseId) {
        if (!cancelled) {
          setConfigKey('')
          setCandidateKeys([])
          setLoadedOnMount(!hideIfEmpty)
        }
        return
      }
      const normalized = normalizeCaseType(caseType)
      let primaryKey = `journey_updates_${normalized}_${caseId}`
      const fallbacks = new Set()
      if (normalized === 'gc') {
        fallbacks.add(`journey_updates_surrogate_${caseId}`)
      }
      if (caseType === 'surrogate') {
        fallbacks.add(`journey_updates_gc_${caseId}`)
      }
      if (normalized === 'gc' || normalized === 'ip') {
        const journeyId = await findJourneyByCaseId(caseId).catch(() => null)
        if (journeyId) {
          primaryKey = `journey_updates_journey_${journeyId}`
          fallbacks.add(`journey_updates_${normalized}_${caseId}`)
          if (normalized === 'gc') fallbacks.add(`journey_updates_surrogate_${caseId}`)
        }
      }
      if (!cancelled) {
        setConfigKey(primaryKey)
        setCandidateKeys([primaryKey, ...Array.from(fallbacks).filter(k => k && k !== primaryKey)])
        setLoadedOnMount(!hideIfEmpty)
      }
    }
    if (hideIfEmpty) setLoadedOnMount(false)
    resolveKeys()
    return () => { cancelled = true }
  }, [caseId, caseType, hideIfEmpty])

  async function loadMergedUpdates() {
    if (!configKey) return []
    const keys = candidateKeys.length ? candidateKeys : [configKey]
    const values = await Promise.all(keys.map(k => getAppConfig(k).catch(() => null)))
    const merged = mergeUpdates(values.map(parseUpdates))
    if (keys[0] && JSON.stringify(parseUpdates(values[0])) !== JSON.stringify(merged)) {
      setAppConfig(keys[0], merged).catch(() => {})
    }
    return merged
  }

  // Pre-load on mount when the caller wants to hide on empty, so we can decide whether to render.
  useEffect(() => {
    if (!hideIfEmpty || !caseId || !configKey) return
    loadMergedUpdates().then(setUpdates).catch(() => {}).finally(() => setLoadedOnMount(true))
  }, [hideIfEmpty, caseId, configKey, candidateKeys])

  useEffect(() => {
    if (!open || !caseId || !configKey) return
    loadMergedUpdates().then(setUpdates).catch(() => {})
  }, [open, caseId, configKey, candidateKeys])

  async function handleAdd() {
    if (!newUpdate.trim() || !configKey) return
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
    const keys = candidateKeys.length ? candidateKeys : [configKey]
    await Promise.all(keys.map(async key => {
      const existing = parseUpdates(await getAppConfig(key).catch(() => null))
      const filtered = existing.filter(u => {
        const currentKey = u?.id || `${u?.date || ''}__${u?.by || ''}__${u?.text || ''}`
        return currentKey !== id && u?.id !== id
      })
      return setAppConfig(key, filtered).catch(() => {})
    }))
  }

  if (compact) {
    // When hideIfEmpty is on, wait for the mount-load to finish and skip rendering if there are no updates
    if (hideIfEmpty && (!loadedOnMount || updates.length === 0)) return null
    return (
      <>
        <button onClick={() => setOpen(true)} title="Journey Updates" className="text-stone-400 hover:text-[#1A3638] transition-colors">
          <Megaphone className="size-3.5" />
        </button>
        <UpdateDialog open={open} onOpenChange={setOpen} updates={updates} newUpdate={newUpdate} setNewUpdate={setNewUpdate} saving={saving} onAdd={handleAdd} onDelete={handleDelete} caseName={displayCaseName} />
      </>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setOpen(true)}>
        <Megaphone className="size-3" /> Journey Update
      </Button>
      <UpdateDialog open={open} onOpenChange={setOpen} updates={updates} newUpdate={newUpdate} setNewUpdate={setNewUpdate} saving={saving} onAdd={handleAdd} onDelete={handleDelete} caseName={displayCaseName} />
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
              rows={3}
              className="text-sm flex-1 resize-none border-stone-200 focus:border-stone-300 !ring-0 !outline-none !shadow-none"
              style={{ boxShadow: 'none' }}
            />
            <Button size="sm" className="gap-1 shrink-0 self-end" style={{ backgroundColor: '#D4A853' }} onClick={onAdd} disabled={saving || !newUpdate.trim()}>
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
