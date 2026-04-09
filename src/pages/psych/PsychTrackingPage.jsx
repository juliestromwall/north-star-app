import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Share2, Copy, Check, ExternalLink, Plus } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, getAppConfig, setAppConfig } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { formatDate } from '@/lib/utils'

const TRACKING_KEY = 'psych_tracking'
const SHARE_KEY = 'psych_tracking_share'

const CHECKIN_COLS = [
  { key: 'week10', label: '10 Week' },
  { key: 'week20', label: '20 Week' },
  { key: 'week30', label: '30 Week' },
  { key: 'postDelivery', label: 'Post Delivery' },
]

function generateShareToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

export default function PsychTrackingPage() {
  const [surrogates, setSurrogates] = useState([])
  const [journeys, setJourneys] = useState([])
  const [tracking, setTracking] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ name: '', email: '', phone: '' })

  useEffect(() => {
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchMatchedJourneys(),
      getAppConfig(TRACKING_KEY),
    ]).then(([gcs, js, saved]) => {
      setSurrogates(gcs || [])
      setJourneys(js || [])
      setTracking(saved || {})
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveTracking = useCallback(async (updated) => {
    setTracking(updated)
    await setAppConfig(TRACKING_KEY, updated).catch(() => {})
  }, [])

  // Build rows: only surrogates with an active pregnancy tracker
  const rows = useMemo(() => {
    const pregnantRows = journeys
      .filter(j => j.journey_data?.pregnant === 'yes')
      .map(j => {
        const gc = surrogates.find(s => s.id === j.gc_case_id)
        if (!gc) return null
        const t = tracking[gc.id] || {}
        return {
          id: gc.id,
          name: gc.name,
          email: gc.email || '',
          phone: gc.phone || '',
          journeyId: j.id,
          journeyPath: `/journeys/${j.id}`,
          casePath: `/surrogates/${gc.id}`,
          week10: t.week10 || null,
          week20: t.week20 || null,
          week30: t.week30 || null,
          postDelivery: t.postDelivery || null,
        }
      }).filter(Boolean)

    // Add manual entries from tracking data
    const manualRows = Object.entries(tracking)
      .filter(([key, val]) => key.startsWith('manual_') && val._manual)
      .map(([key, val]) => ({
        id: key,
        name: val.name || 'Unknown',
        email: val.email || '',
        phone: val.phone || '',
        journeyPath: null,
        casePath: null,
        manual: true,
        week10: val.week10 || null,
        week20: val.week20 || null,
        week30: val.week30 || null,
        postDelivery: val.postDelivery || null,
      }))

    return [...pregnantRows, ...manualRows]
  }, [surrogates, journeys, tracking])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
  }, [rows, search])

  async function updateDate(surrogateId, field, value) {
    const updated = { ...tracking, [surrogateId]: { ...tracking[surrogateId], [field]: value } }
    await saveTracking(updated)
  }

  async function handleShare() {
    let shareData = await getAppConfig(SHARE_KEY).catch(() => null)
    if (!shareData?.token) {
      const token = generateShareToken()
      shareData = { token, createdAt: new Date().toISOString() }
      await setAppConfig(SHARE_KEY, shareData).catch(() => {})
    }
    const url = `${window.location.origin}/psych-tracking/share/${shareData.token}`
    setShareUrl(url)
    setShareOpen(true)
    setCopied(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveManualEntry() {
    if (!manualForm.name.trim()) return
    const id = `manual_${Date.now()}`
    const updated = {
      ...tracking,
      [id]: {
        _manual: true,
        name: manualForm.name.trim(),
        email: manualForm.email.trim(),
        phone: manualForm.phone.trim(),
      },
    }
    await saveTracking(updated)
    setAddOpen(false)
    setManualForm({ name: '', email: '', phone: '' })
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Psych Tracking"
        subtitle={`${rows.length} pregnant surrogates tracked`}
        actions={<>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setManualForm({ name: '', email: '', phone: '' }); setAddOpen(true) }}>
            <Plus className="size-3.5" /> Add Surrogate
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleShare}>
            <Share2 className="size-3.5" /> Share Link
          </Button>
        </>}
      />

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <PsychTable rows={filtered} onDateChange={updateDate} />

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 text-violet-500" /> Share Psych Tracking
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            Anyone with this link can view and update the psych check-in dates. No login required.
          </p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="text-xs" />
            <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={copyLink}>
              {copied ? <><Check className="size-3.5 text-emerald-500" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Done</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Surrogate Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Surrogate to Psych Tracking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Name *</label>
              <Input value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Email</label>
              <Input value={manualForm.email} onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Phone</label>
              <Input value={manualForm.phone} onChange={e => setManualForm(f => ({ ...f, phone: e.target.value }))} placeholder="xxx-xxx-xxxx" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveManualEntry} disabled={!manualForm.name.trim()} className="bg-[#ed148c] hover:bg-[#d4127d] text-white gap-1">
              <Plus className="size-3.5" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Editable Date Cell ──
function EditableDateCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)

  if (value && !editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600 font-medium cursor-pointer hover:underline" onClick={() => setEditing(true)} title="Click to edit">
          {formatDate(value)}
        </span>
      </div>
    )
  }

  if (editing || !value) {
    return editing ? (
      <input
        type="date"
        autoFocus
        defaultValue={value || ''}
        className="text-xs border border-stone-300 rounded px-1.5 py-1 w-[130px]"
        onBlur={(e) => { if (e.target.value) onSave(e.target.value); setEditing(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { onSave(e.target.value); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      />
    ) : (
      <button onClick={() => setEditing(true)} className="text-stone-400 hover:text-violet-500 text-xs transition-colors">
        + Add date
      </button>
    )
  }

  return <span className="text-stone-300">—</span>
}

// ── Table ──
export function PsychTable({ rows, onDateChange, isSharedView = false }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-16 text-center text-stone-400">
            <p className="text-sm">No surrogates found.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-20 min-w-[180px] border-r border-stone-200">
                  Surrogate
                </th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Email</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Phone</th>
                {CHECKIN_COLS.map(col => (
                  <th key={col.key} className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100 last:border-r-0">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    {!isSharedView && row.casePath ? (
                      <Link to={row.casePath} className="text-[#ed148c] hover:underline font-semibold text-xs">{row.name}</Link>
                    ) : (
                      <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                    )}
                    {row.manual && !isSharedView && <span className="text-[10px] text-violet-400 ml-1">(manual)</span>}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.email || '—'}</td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.phone || '—'}</td>
                  {CHECKIN_COLS.map(col => (
                    <td key={col.key} className={`px-4 py-3 border-r border-stone-100 last:border-r-0 ${row[col.key] ? 'bg-green-50/60' : ''}`}>
                      <EditableDateCell
                        value={row[col.key]}
                        onSave={(date) => onDateChange(row.id, col.key, date)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
