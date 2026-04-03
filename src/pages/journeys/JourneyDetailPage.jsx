import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Heart, Users, Baby, MapPin, Stethoscope, FileText,
  Milestone, Circle, UserCog, Mail, Phone, DollarSign, Droplets, Briefcase,
  Pencil, Save, Loader2, X, Crown, Copy, Check, Calendar, Home, MessageSquare,
  Hospital, Building2, ChevronDown, Printer, Scale,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import CaseEmailsTab from '@/components/shared/CaseEmailsTab'
import TrackingTable from '@/components/shared/TrackingTable'
import MatchSheetsTab from '@/components/journeys/MatchSheetsTab'
import RichTextEditor, { RichTextDisplay } from '@/components/shared/RichTextEditor'
import { useRole } from '@/context/RoleContext'
import { useDrafts } from '@/context/DraftContext'
import { SURROGATE_STAGES } from '@/lib/constants'
import { getStatusesForStage } from '@/lib/stageStatusStore'
import { fetchMatchedJourney, updateMatchedJourney, fetchJourneyNotes, createJourneyNote, deleteJourneyNote, breakMatch } from '@/lib/matching'
import { getChecklistSteps, getChecklistMilestones, CHECKLIST_STEP_STATUSES } from '@/lib/checklistStore'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { mockUsers } from '@/data/mock/users'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))
const JOURNEY_MANAGERS = ADMIN_STAFF.filter(u => ['Julie Allgood', 'Nicole Lawson'].includes(u.name))
const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => ['journey-oversight', 'journey-ending', 'journey-closed'].includes(s.id))

// ── Currency with cents ─────────────────────────────────
function CurrencyInput({ value, onChange, className = '' }) {
  return <Input value={value || ''} onChange={e => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    const formatted = parts[0] ? '$' + Number(parts[0]).toLocaleString('en-US') + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '') : ''
    onChange(formatted)
  }} placeholder="$0.00" className={`h-8 text-sm ${className}`} />
}

function parseCurrency(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0
}

// ── Editable Tile ───────────────────────────────────────
function EditableTile({ icon: Icon, label, value, type, onSave, valueColor }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  function save() { onSave(val); setEditing(false) }

  if (editing) {
    return (
      <div className="rounded-xl bg-stone-50/80 border-2 border-[#283693]/30 p-3 text-center space-y-2">
        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{label}</p>
        {type === 'yesno' ? (
          <div className="flex gap-1.5 justify-center">
            <button onClick={() => { onSave('yes'); setEditing(false) }} className={`px-3 py-1 rounded-full text-xs font-medium ${val === 'yes' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Yes</button>
            <button onClick={() => { onSave('no'); setEditing(false) }} className={`px-3 py-1 rounded-full text-xs font-medium ${val === 'no' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>No</button>
          </div>
        ) : type === 'text' ? (
          <div className="flex gap-1 justify-center">
            <Input value={val || ''} onChange={e => setVal(e.target.value)} className="h-8 text-xs w-full" />
            <button onClick={save} className="p-1 rounded bg-[#283693] text-white shrink-0"><Save className="size-3" /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded bg-stone-200 text-stone-500 shrink-0"><X className="size-3" /></button>
          </div>
        ) : type === 'date' ? (
          <div className="flex gap-1 justify-center">
            <Input type="date" value={val || ''} onChange={e => setVal(e.target.value)} className="h-8 text-xs" />
            <button onClick={save} className="p-1 rounded bg-[#283693] text-white shrink-0"><Save className="size-3" /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded bg-stone-200 text-stone-500 shrink-0"><X className="size-3" /></button>
          </div>
        ) : (
          <div className="flex gap-1 justify-center">
            <CurrencyInput value={val} onChange={setVal} className="w-28" />
            <button onClick={save} className="p-1 rounded bg-[#283693] text-white shrink-0"><Save className="size-3" /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded bg-stone-200 text-stone-500 shrink-0"><X className="size-3" /></button>
          </div>
        )}
      </div>
    )
  }

  const display = type === 'yesno' ? (value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '—') : (value || '—')
  return (
    <div className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
      onClick={() => { setVal(value); setEditing(true) }}>
      <Icon className="size-4 text-stone-300 mx-auto mb-1" />
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-lg font-bold mt-0.5 leading-tight ${valueColor || 'text-stone-800'}`}>{display}</p>
    </div>
  )
}

// ── Inline Editable Field ───────────────────────────────
function EditableTileInline({ value, onSave, type = 'text', placeholder = 'Set...', className = '' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        {type === 'currency' ? (
          <CurrencyInput value={val} onChange={setVal} className="w-24 h-6 text-[11px]" />
        ) : type === 'date' ? (
          <Input type="date" value={val || ''} onChange={e => setVal(e.target.value)} className="h-6 text-[11px] w-32" />
        ) : (
          <Input value={val || ''} onChange={e => setVal(e.target.value)} className="h-6 text-[11px] w-28" placeholder={placeholder} />
        )}
        <button onClick={() => { onSave(val); setEditing(false) }} className="text-[#283693]"><Check className="size-3" /></button>
        <button onClick={() => setEditing(false)} className="text-stone-400"><X className="size-3" /></button>
      </span>
    )
  }

  return (
    <button onClick={() => { setVal(value); setEditing(true) }}
      className={`font-semibold hover:underline cursor-pointer ${className || 'text-stone-800'}`}>
      {value || <span className="text-stone-300 font-normal">{placeholder}</span>}
    </button>
  )
}

// ── Copy Flip Button (contact) ──────────────────────────
function CopyFlipButton({ icon: Icon, label, value, flipped, onFlip, preferred }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  if (!flipped) {
    return preferred ? (
      <Button size="sm" className="gap-1.5 rounded-full text-white shadow-md" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }} onClick={onFlip}>
        <Icon className="size-3.5" /> {label} ★
      </Button>
    ) : (
      <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={onFlip}><Icon className="size-3.5" /> {label}</Button>
    )
  }
  return (
    <div className="inline-flex items-center rounded-full border border-stone-200 bg-white text-sm h-8">
      <button className="flex items-center gap-1.5 pl-3 pr-1 hover:text-stone-900 transition-colors text-stone-600 font-medium" onClick={onFlip}>
        <Icon className="size-3.5 text-stone-400" /><span className="text-xs">{value}</span>
      </button>
      <button className="flex items-center justify-center size-8 rounded-full hover:bg-stone-100 transition-colors shrink-0" onClick={handleCopy}>
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-stone-300" />}
      </button>
    </div>
  )
}

// ── Flip Card (info tile) ───────────────────────────────
function FlipCard({ flipped, onClick, front, back }) {
  const side = flipped ? back : front
  const Icon = side.icon
  return (
    <div className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all select-none" onClick={onClick}>
      {Icon && <Icon className="size-4 text-stone-300 mx-auto mb-1" />}
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{side.label}</p>
      <p className={`text-lg font-bold mt-0.5 leading-tight ${side.color || 'text-stone-800'}`}>{side.value}</p>
    </div>
  )
}

// ── Address Tile (click to show full address with copy) ──
function AddressTile({ caseData }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const a = caseData?.answers || {}
  const addr = [a.street, a.street2, a.city, a.stateProv || a.state, a.zipCode].filter(Boolean).join(', ')
  const short = a.city && (a.stateProv || a.state) ? `${a.city}, ${a.stateProv || a.state}` : caseData?.location || '—'

  function handleCopy() {
    navigator.clipboard.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  if (!open) {
    return (
      <div className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all" onClick={() => setOpen(true)}>
        <Home className="size-4 text-stone-300 mx-auto mb-1" />
        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Address</p>
        <p className="text-sm font-bold mt-0.5 leading-tight text-stone-800 truncate">{short}</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-stone-50/80 border-2 border-[#283693]/30 p-3 text-center space-y-1">
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Address</p>
      <p className="text-xs text-stone-700">{addr || '—'}</p>
      <div className="flex gap-1 justify-center">
        <button onClick={handleCopy} className="text-[10px] text-[#283693] font-medium hover:underline">{copied ? 'Copied!' : 'Copy'}</button>
        <button onClick={() => setOpen(false)} className="text-[10px] text-stone-400 hover:underline ml-2">Close</button>
      </div>
    </div>
  )
}

// ── Gestational weeks calculator ────────────────────────
function calcGestationalWeeks(dueDate) {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const conception = new Date(due.getTime() - 280 * 24 * 60 * 60 * 1000) // 40 weeks before due
  const now = new Date()
  const diffMs = now - conception
  const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000))
  if (weeks < 0 || weeks > 42) return null
  return `${weeks}w ${days}d`
}

// ── Checklist Tab (uses shared TrackingTable) ─
function JourneyChecklistTab({ journey, onUpdate }) {
  const stageId = journey.stage || 'journey-oversight'
  const stageObj = JOURNEY_STAGES.find(s => s.id === stageId) || JOURNEY_STAGES[0]
  const steps = getChecklistSteps('gc', stageId)
  const tracking = journey.journey_data?._checklistTracking || {}
  const { currentUser } = useRole()

  async function handleUpdate(stepId, updates) {
    const ct = { ...(journey.journey_data?._checklistTracking || {}) }
    ct[stepId] = { ...(ct[stepId] || {}), ...updates }
    const jd = { ...(journey.journey_data || {}), _checklistTracking: ct }
    await onUpdate({ journey_data: jd })
  }

  return (
    <TrackingTable
      title={`${stageObj.label} Checklist`}
      steps={steps}
      statuses={CHECKLIST_STEP_STATUSES}
      tracking={tracking}
      onUpdate={handleUpdate}
      currentUserName={currentUser.name}
    />
  )
}

// ── Notes Tab ───────────────────────────────────────────
function NotesTab({ journeyId, currentUser }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('shared')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchJourneyNotes(journeyId, filter === 'all' ? null : filter).then(setNotes).catch(() => {}).finally(() => setLoading(false))
  }, [journeyId, filter])

  async function handleAdd() {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      const note = await createJourneyNote({ journeyId, noteType: filter === 'all' ? 'shared' : filter, content: newContent, createdBy: currentUser.name, createdByEmail: currentUser.email })
      setNotes(prev => [note, ...prev])
      setNewContent('')
    } catch {} finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this note permanently?')) return
    await deleteJourneyNote(id).catch(() => {})
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const NOTE_TYPES = [
    { key: 'shared', label: 'Shared Notes', color: 'bg-[#283693]' },
    { key: 'gc', label: 'GC Notes', color: 'bg-pink-500' },
    { key: 'ip', label: 'IP Notes', color: 'bg-[#283693]' },
    { key: 'all', label: 'All Notes', color: 'bg-stone-500' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {NOTE_TYPES.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === t.key ? `${t.color} text-white` : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
        <RichTextEditor content={newContent} onChange={setNewContent} placeholder="Add a note..." />
        <Button size="sm" onClick={handleAdd} disabled={saving || !newContent.trim()} style={{ backgroundColor: '#283693', color: '#fff' }}>{saving ? 'Saving...' : 'Add Note'}</Button>
      </CardContent></Card>
      {loading ? <p className="text-center py-8 text-stone-400">Loading...</p> : notes.length === 0 ? (
        <EmptyState title="No notes yet" description={`Add a note above.`} />
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <Card key={note.id} className="rounded-2xl"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${note.note_type === 'gc' ? 'bg-pink-500' : note.note_type === 'ip' ? 'bg-[#283693]' : 'bg-[#283693]'}`}>
                  {note.note_type === 'gc' ? 'GC' : note.note_type === 'ip' ? 'IP' : 'SHARED'}
                </span>
                <span className="text-xs text-stone-400">{note.created_by}</span>
                <span className="text-xs text-stone-300">{new Date(note.created_at).toLocaleString()}</span>
                <button onClick={() => handleDelete(note.id)} className="ml-auto text-xs text-stone-300 hover:text-red-500">Delete</button>
              </div>
              <RichTextDisplay content={note.content} />
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Attorney Row (inline in hero) ──────────────────────
function AttorneyRow({ prefix, data, onSave, onEmail }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const name = data[`${prefix}Name`] || ''
  const firm = data[`${prefix}Firm`] || ''
  const email = data[`${prefix}Email`] || ''
  const phone = data[`${prefix}Phone`] || ''

  function startEdit() {
    setForm({ name, firm, email, phone })
    setEditing(true)
  }

  function save() {
    onSave(`${prefix}Name`, form.name)
    onSave(`${prefix}Firm`, form.firm)
    onSave(`${prefix}Email`, form.email)
    onSave(`${prefix}Phone`, form.phone)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mt-2 rounded-lg bg-white/60 border border-stone-200 p-3 space-y-2">
        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1"><Scale className="size-3" /> Attorney</p>
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Attorney name" className="h-7 text-xs" />
          <Input value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} placeholder="Firm" className="h-7 text-xs" />
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="h-7 text-xs" />
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="h-7 text-xs" />
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" className="gap-1 h-6 text-[11px] rounded-full px-3" style={{ backgroundColor: '#283693' }} onClick={save}>
            <Save className="size-3" /> Save
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[11px] rounded-full px-3" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    )
  }

  if (!name) {
    return (
      <button onClick={startEdit} className="mt-1.5 flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 cursor-pointer">
        <Scale className="size-3" /> + Add attorney
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-500">
      <Scale className="size-3 text-stone-400" />
      <span className="font-medium text-stone-700">{name}</span>
      {firm && <><span className="text-stone-300">·</span> <span>{firm}</span></>}
      {email && (
        <Button variant="outline" size="sm" className="gap-1 rounded-full text-[10px] h-5 px-2 ml-1" onClick={() => onEmail(email, name)}>
          <Mail className="size-2.5" /> Email Attorney
        </Button>
      )}
      <button onClick={startEdit} className="text-stone-300 hover:text-stone-500 ml-0.5"><Pencil className="size-3" /></button>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────
export default function JourneyDetailPage() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [journey, setJourney] = useState(null)
  const [gcCase, setGcCase] = useState(null)
  const [ipCase, setIpCase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stageOpen, setStageOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [profileView, setProfileView] = useState('gc')
  const [breakOpen, setBreakOpen] = useState(false)
  const [breakReason, setBreakReason] = useState('')
  const [breaking, setBreaking] = useState(false)
  const [gcFlip, setGcFlip] = useState({})
  const [ipFlip, setIpFlip] = useState({})
  const [emailConfirm, setEmailConfirm] = useState(null) // { name, email, caseId }
  const toggleGcFlip = (key) => setGcFlip(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleIpFlip = (key) => setIpFlip(prev => ({ ...prev, [key]: !prev[key] }))
  const { openDraft } = useDrafts()

  useEffect(() => {
    async function load() {
      try {
        const j = await fetchMatchedJourney(Number(id))
        if (!j) { setLoading(false); return }
        setJourney(j)
        const [gcs, ips] = await Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
        setGcCase(gcs.find(g => g.id === j.gc_case_id) || null)
        setIpCase(ips.find(i => i.id === j.ip_case_id) || null)
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [id])

  async function updateField(key, value) {
    const jd = { ...(journey.journey_data || {}), [key]: value }
    const updated = await updateMatchedJourney(journey.id, { journey_data: jd }).catch(() => null)
    if (updated) setJourney(updated)
  }

  async function changeStage(stageId) {
    const status = getStatusesForStage(stageId, 'journey')[0] || 'Legal Review'
    const updated = await updateMatchedJourney(journey.id, { stage: stageId, status }).catch(() => null)
    if (updated) setJourney(updated)
    setStageOpen(false)
  }

  async function changeStatus(status) {
    const updated = await updateMatchedJourney(journey.id, { status }).catch(() => null)
    if (updated) setJourney(updated)
    setStatusOpen(false)
  }

  async function handleBreakMatch() {
    if (!breakReason.trim()) return
    setBreaking(true)
    try {
      await breakMatch(journey.id, {
        reason: breakReason,
        brokenBy: currentUser.name,
        gcCaseId: journey.gc_case_id,
        ipCaseId: journey.ip_case_id,
      })
      window.location.href = '/journeys'
    } catch (err) {
      alert('Failed to break match: ' + (err.message || ''))
      setBreaking(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-stone-400">Loading journey...</div>
  if (!journey) return (
    <div className="space-y-6">
      <Link to="/journeys" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to Journeys</Link>
      <EmptyState title="Journey not found" />
    </div>
  )

  const stageObj = JOURNEY_STAGES.find(s => s.id === journey.stage) || JOURNEY_STAGES[0]
  const statuses = getStatusesForStage(journey.stage, 'journey')
  const jd = journey.journey_data || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/journeys" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to Journeys</Link>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span>Match Created {new Date(journey.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <Button variant="outline" size="sm" className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => setBreakOpen(true)}>
            <X className="size-3" /> Break Match
          </Button>
        </div>
      </div>

      {/* Break Match Dialog */}
      <Dialog open={breakOpen} onOpenChange={setBreakOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Break Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <p className="font-semibold">Are you sure you want to break this match?</p>
              <p className="mt-1 text-xs">This will separate <strong>{gcCase?.name}</strong> and <strong>{ipCase?.names}</strong>. The journey record will be deleted, but notes and emails will be preserved in both case histories.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500 font-medium">Reason for breaking match *</label>
              <Textarea value={breakReason} onChange={e => setBreakReason(e.target.value)} placeholder="Explain why this match is being broken..." rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setBreakOpen(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleBreakMatch} disabled={breaking || !breakReason.trim()} className="gap-1">
                {breaking ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                {breaking ? 'Breaking...' : 'Break Match'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Hero Section ─────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden">

        {/* Journey Info — compact bar */}
        <div className="px-5 py-4 space-y-3">
          {/* Top row: pills left + managers right */}
          <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
          {/* Row 1: Stage/Status + toggles + pregnancy */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stage selector */}
            <div className="relative">
              <button onClick={() => { setStageOpen(!stageOpen); setStatusOpen(false) }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all hover:shadow-sm"
                style={{ color: stageObj.color, borderColor: stageObj.color }}>
                <Milestone className="size-4" /> {stageObj.label}
              </button>
              {stageOpen && (
                <div className="absolute z-30 top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border py-2">
                  {JOURNEY_STAGES.map((stage, i) => (
                    <button key={stage.id} className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2" onClick={() => changeStage(stage.id)}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: stage.color }}>{i + 4}</span>
                      {stage.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Status selector */}
            <div className="relative">
              <button onClick={() => { setStatusOpen(!statusOpen); setStageOpen(false) }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-stone-200 text-stone-700 hover:shadow-sm transition-all">
                <Circle className="size-4 text-stone-400" /> {journey.status}
              </button>
              {statusOpen && (
                <div className="absolute z-30 top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border py-2 max-h-64 overflow-y-auto">
                  {statuses.map(status => (
                    <button key={status} className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2" onClick={() => changeStatus(status)}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stageObj.color }} />{status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-stone-200" />

            <button onClick={() => updateField('lostWages', jd.lostWages === 'yes' ? 'no' : 'yes')}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-stone-200 hover:border-stone-300 transition-all cursor-pointer">
              Lost Wages: <span className="font-bold">{jd.lostWages === 'yes' ? 'Yes' : jd.lostWages === 'no' ? 'No' : '—'}</span>
            </button>
            <button onClick={() => updateField('pumping', jd.pumping === 'yes' ? 'no' : 'yes')}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-stone-200 hover:border-stone-300 transition-all cursor-pointer">
              Pumping: <span className="font-bold">{jd.pumping === 'yes' ? 'Yes' : jd.pumping === 'no' ? 'No' : '—'}</span>
            </button>
            <button onClick={() => updateField('pregnant', jd.pregnant === 'yes' ? 'no' : 'yes')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${jd.pregnant === 'yes' ? 'border-pink-300 bg-pink-50 text-pink-700' : 'border-stone-200'}`}>
              {jd.pregnant === 'yes' ? (jd.dueDate ? `🤰 ${calcGestationalWeeks(jd.dueDate) || ''} · Due ${new Date(jd.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}` : '🤰 Pregnant') : 'Not Pregnant'}
            </button>
          </div>

          {/* Row 2: Escrow + OB/Hospital */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">Escrow Min:</span>
                <EditableTileInline value={jd.escrowMin} onSave={v => updateField('escrowMin', v)} type="currency" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">Balance:</span>
                <EditableTileInline value={jd.escrowBalance} onSave={v => updateField('escrowBalance', v)} type="currency"
                  className={jd.escrowBalance && jd.escrowMin ? (parseCurrency(jd.escrowBalance) >= parseCurrency(jd.escrowMin) ? 'text-emerald-600' : 'text-red-600') : ''} />
              </div>
              {jd.pregnant === 'yes' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400">Due:</span>
                  <EditableTileInline value={jd.dueDate} onSave={v => updateField('dueDate', v)} type="date" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">OB Clinic:</span>
                <EditableTileInline value={jd.obClinic} onSave={v => updateField('obClinic', v)} type="text" placeholder="Set clinic" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">Hospital:</span>
                <EditableTileInline value={jd.deliveryHospital} onSave={v => updateField('deliveryHospital', v)} type="text" placeholder="Set hospital" />
              </div>
          </div>
          </div>

          {/* Managers — stacked, top right */}
          <div className="shrink-0 flex flex-col gap-1 text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <UserCog className="size-3.5 text-stone-400" />
              <span className="text-[10px] text-stone-400">Case Manager</span>
              <SelectUI value={journey.assigned_to || '_unassigned'} onValueChange={async val => {
                const updated = await updateMatchedJourney(journey.id, { assigned_to: val === '_unassigned' ? null : val }).catch(() => null)
                if (updated) setJourney(updated)
              }}>
                <SelectTriggerUI className="h-6 text-[11px] font-semibold border-none shadow-none px-1 w-auto min-w-20 text-[#283693]"><SelectValueUI /></SelectTriggerUI>
                <SelectContentUI>
                  <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                  {ADMIN_STAFF.map(a => <SelectItemUI key={a.email} value={a.email}>{a.name}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Crown className="size-3.5 text-amber-500" />
              <span className="text-[10px] text-stone-400">Journey Manager</span>
              <SelectUI value={jd.journeyManager || '_unassigned'} onValueChange={async val => {
                updateField('journeyManager', val === '_unassigned' ? '' : val)
              }}>
                <SelectTriggerUI className="h-6 text-[11px] font-semibold border-none shadow-none px-1 w-auto min-w-20 text-[#283693]"><SelectValueUI /></SelectTriggerUI>
                <SelectContentUI>
                  <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                  {JOURNEY_MANAGERS.map(a => <SelectItemUI key={a.email} value={a.name}>{a.name}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
          </div>
          </div>
        </div>

        {/* GC Section */}
        <div className="px-5 py-4 border-t" style={{ backgroundColor: '#ed148c08' }}>
          {gcCase ? (
            <div className="space-y-0">
              <p className="text-[11px] font-semibold text-pink-400 uppercase tracking-widest mb-2">Surrogate</p>
              <div className="flex items-center gap-3">
              <ProfileAvatar name={gcCase.name} size="md" className="ring-2 ring-white shadow" />
              <div className="flex-1 min-w-0">
                <Link to={`/surrogates/${gcCase.id}`} className="text-sm font-heading font-bold hover:text-[#283693] transition-colors">{gcCase.name}</Link>
                <div className="flex flex-wrap gap-2.5 mt-0.5 text-[11px] text-stone-500">
                  {gcCase.location && <span className="flex items-center gap-0.5"><MapPin className="size-3" />{gcCase.location}</span>}
                  {gcCase.age && (
                    <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('age')}>
                      {gcFlip.age ? `DOB: ${gcCase.dob || '—'}` : `Age ${gcCase.age}`}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('relationship')}>
                    <Heart className="size-3" />{gcFlip.relationship ? '—' : (gcCase.maritalStatus || '—')}
                  </span>
                  <span className="flex items-center gap-0.5 cursor-pointer hover:text-stone-700" onClick={() => { const a = gcCase.answers || {}; const addr = [a.city, a.state].filter(Boolean).join(', ') || gcCase.location; navigator.clipboard.writeText(addr) }} title="Click to copy address">
                    <Home className="size-3" />{gcCase.location || '—'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {gcCase.phone && (
                  <Button variant={gcCase.preferredContact === 'Text' ? 'default' : 'outline'} size="sm"
                    className={`gap-1 rounded-full text-xs h-7 ${gcCase.preferredContact === 'Text' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                    asChild><a href={`sms:${gcCase.phone}`}><MessageSquare className="size-3" /> Text</a>
                  </Button>
                )}
                <Button variant={gcCase.preferredContact === 'Email' ? 'default' : 'outline'} size="sm"
                  className={`gap-1 rounded-full text-xs h-7 ${gcCase.preferredContact === 'Email' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                  onClick={() => setEmailConfirm({ name: gcCase.name, email: gcCase.email, caseId: journey.id })}>
                  <Mail className="size-3" /> Email
                </Button>
                {gcCase.phone && <CopyFlipButton icon={Phone} label="Call" value={gcCase.phone} flipped={gcFlip.phone} onFlip={() => toggleGcFlip('phone')} preferred={gcCase.preferredContact === 'Phone'} />}
              </div>
              </div>
              <AttorneyRow prefix="gcAttorney" data={jd} onSave={updateField}
                onEmail={(email, name) => setEmailConfirm({ name: name || 'GC Attorney', email, caseId: journey.id })} />
            </div>
          ) : <p className="text-sm text-stone-400">GC case not found</p>}
        </div>

        {/* IP Section */}
        <div className="px-5 py-4 border-t" style={{ backgroundColor: '#28369308' }}>
          {ipCase ? (
            <div className="space-y-0">
              <p className="text-[11px] font-semibold text-[#283693]/50 uppercase tracking-widest mb-2">Intended Parent{ipCase.type === 'Couple' ? 's' : ''}</p>
              <div className="flex items-center gap-3">
              <ProfileAvatar name={ipCase.names} size="md" className="ring-2 ring-white shadow" />
              <div className="flex-1 min-w-0">
                <Link to={`/intended-parents/${ipCase.id}`} className="text-sm font-heading font-bold hover:text-[#283693] transition-colors">{ipCase.names}</Link>
                <div className="flex flex-wrap gap-2.5 mt-0.5 text-[11px] text-stone-500">
                  {ipCase.location && <span className="flex items-center gap-0.5"><MapPin className="size-3" />{ipCase.location}</span>}
                  {ipCase.age && (
                    <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleIpFlip('age')}>
                      {ipFlip.age ? `DOB: ${ipCase.answers?.primaryDob || '—'}` : `Age ${ipCase.age}`}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Heart className="size-3" />{ipCase.answers?.maritalStatus || '—'}
                  </span>
                  {ipCase.reDoctorName && <span className="flex items-center gap-0.5"><Stethoscope className="size-3" />{ipCase.reDoctorName}</span>}
                  {ipCase.hasFrozenEmbryos && <span className="flex items-center gap-0.5">🧬 {ipCase.frozenEmbryoDetails || 'Embryos'}</span>}
                  {ipCase.usingEggDonor && <span>🥚 Egg Donor</span>}
                  {ipCase.usingSpermDonor && <span>🧪 Sperm Donor</span>}
                  <span className="flex items-center gap-0.5 cursor-pointer hover:text-stone-700" onClick={() => { const a = ipCase.answers || {}; const addr = [a.city, a.stateProv].filter(Boolean).join(', ') || ipCase.location; navigator.clipboard.writeText(addr) }} title="Click to copy address">
                    <Home className="size-3" />{ipCase.location || '—'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {ipCase.phone && (
                  <Button size="sm" className="gap-1 rounded-full text-xs h-7" asChild>
                    <a href={`sms:${ipCase.phone}`}><MessageSquare className="size-3" /> Text</a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs h-7"
                  onClick={() => {
                    const emails = [ipCase.email, ipCase.ip2Email].filter(Boolean).join(', ')
                    setEmailConfirm({ name: ipCase.names, email: emails, caseId: journey.id })
                  }}>
                  <Mail className="size-3" /> Email
                </Button>
                {ipCase.phone && <CopyFlipButton icon={Phone} label="Call" value={ipCase.phone} flipped={ipFlip.phone} onFlip={() => toggleIpFlip('phone')} preferred={false} />}
              </div>
              </div>
              <AttorneyRow prefix="ipAttorney" data={jd} onSave={updateField}
                onEmail={(email, name) => setEmailConfirm({ name: name || 'IP Attorney', email, caseId: journey.id })} />
            </div>
          ) : <p className="text-sm text-stone-400">IP case not found</p>}
        </div>
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="match-sheets">Match Sheets</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="texts">Texts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-l-4 border-l-pink-400">
              <CardHeader><CardTitle className="flex items-center gap-2"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500 text-white">GC</span> Surrogate</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-stone-400">Name:</span> <span className="font-medium">{gcCase?.name || '—'}</span></p>
                <p><span className="text-stone-400">Location:</span> <span className="font-medium">{gcCase?.location || '—'}</span></p>
                <p><span className="text-stone-400">Age:</span> <span className="font-medium">{gcCase?.age || '—'}</span></p>
                <p><span className="text-stone-400">Email:</span> <span className="font-medium">{gcCase?.email || '—'}</span></p>
                <p><span className="text-stone-400">Phone:</span> <span className="font-medium">{gcCase?.phone || '—'}</span></p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-l-4 border-l-[#283693]">
              <CardHeader><CardTitle className="flex items-center gap-2"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#283693] text-white">IP</span> Intended Parent</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-stone-400">Name:</span> <span className="font-medium">{ipCase?.names || '—'}</span></p>
                <p><span className="text-stone-400">Location:</span> <span className="font-medium">{ipCase?.location || '—'}</span></p>
                <p><span className="text-stone-400">Type:</span> <span className="font-medium">{ipCase?.type || '—'}</span></p>
                <p><span className="text-stone-400">RE Doctor:</span> <span className="font-medium">{ipCase?.reDoctorName || '—'}</span></p>
                <p><span className="text-stone-400">Email:</span> <span className="font-medium">{ipCase?.email || '—'}</span></p>
              </CardContent>
            </Card>
          </div>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Journey Details</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-stone-400">Match Created:</span> <span className="font-medium">{new Date(journey.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></p>
              <p><span className="text-stone-400">Created By:</span> <span className="font-medium">{journey.created_by || '—'}</span></p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profiles Tab — toggle between GC and IP */}
        <TabsContent value="profiles" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <button onClick={() => setProfileView('gc')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${profileView === 'gc' ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              Surrogate Profile
            </button>
            <button onClick={() => setProfileView('ip')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${profileView === 'ip' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              IP Profile
            </button>
          </div>
          {profileView === 'gc' ? (
            <Card className="rounded-2xl border-l-4 border-l-pink-400">
              <CardContent className="py-6 text-center">
                <Link to={`/surrogates/${journey.gc_case_id}`} className="text-[#283693] font-semibold hover:underline">
                  Open {gcCase?.name || 'Surrogate'}'s Full Case →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-l-4 border-l-[#283693]">
              <CardContent className="py-6 text-center">
                <Link to={`/intended-parents/${journey.ip_case_id}`} className="text-[#283693] font-semibold hover:underline">
                  Open {ipCase?.names || 'Intended Parent'}'s Full Case →
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <JourneyChecklistTab journey={journey} onUpdate={async (updates) => {
            const updated = await updateMatchedJourney(journey.id, updates).catch(() => null)
            if (updated) setJourney(updated)
          }} />
        </TabsContent>
        <TabsContent value="match-sheets" className="mt-4">
          <MatchSheetsTab journey={journey} gcCase={gcCase} ipCase={ipCase} onUpdate={async (updates) => {
            const updated = await updateMatchedJourney(journey.id, updates).catch(() => null)
            if (updated) setJourney(updated)
          }} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <div className="flex justify-end gap-2 mb-4">
            <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}
              onClick={() => window.open(`/e-signature?journeyId=${journey.id}`, '_blank')}>
              <FileText className="size-4" /> Send for Signature
            </Button>
            <Button variant="outline" className="gap-1.5"
              onClick={() => window.open(`/fax?caseType=journey&caseId=${journey.id}`, '_blank')}>
              <Printer className="size-4" /> Send Fax
            </Button>
          </div>
          <EmptyState title="Journey Documents" description="Merged GC and IP documents with labels." />
        </TabsContent>
        <TabsContent value="notes" className="mt-4"><NotesTab journeyId={journey.id} currentUser={currentUser} /></TabsContent>
        <TabsContent value="emails" className="mt-4">
          <CaseEmailsTab caseId={journey.id} caseType="journey" additionalCaseIds={[journey.gc_case_id, journey.ip_case_id]} />
        </TabsContent>
        <TabsContent value="texts" className="mt-4"><EmptyState title="Text Messages" description="GC and IP text threads." /></TabsContent>
      </Tabs>

      {/* Email confirmation toast */}
      {emailConfirm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 px-6 py-4 flex items-center gap-4 max-w-xl">
            <div className="size-10 rounded-full bg-[#283693]/10 flex items-center justify-center shrink-0">
              <Mail className="size-5 text-[#283693]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800">Email {emailConfirm.name}?</p>
              <p className="text-xs text-stone-500">{emailConfirm.email}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={() => setEmailConfirm(null)}>
                Cancel
              </Button>
              <Button size="sm" className="rounded-full text-xs h-8 gap-1.5" style={{ backgroundColor: '#283693' }}
                onClick={() => {
                  const conf = emailConfirm
                  setEmailConfirm(null)
                  openDraft({ to: conf.email, caseId: conf.caseId, caseType: 'journey', userId: currentUser?.userId || currentUser?.id }).catch(() => {})
                }}>
                <Mail className="size-3.5" /> Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
