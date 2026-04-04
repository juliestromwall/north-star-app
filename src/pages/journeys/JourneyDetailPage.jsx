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
import InsuranceTab, { InsuranceCardIcon } from '@/components/shared/InsuranceTab'
import TrackingTable from '@/components/shared/TrackingTable'
import MatchSheetsTab from '@/components/journeys/MatchSheetsTab'
import SortableTabsList from '@/components/shared/SortableTabsList'
import RichTextEditor, { RichTextDisplay } from '@/components/shared/RichTextEditor'
import { useRole } from '@/context/RoleContext'
import { useDrafts } from '@/context/DraftContext'
import { SURROGATE_STAGES } from '@/lib/constants'
import { getStatusesForStage } from '@/lib/stageStatusStore'
import { fetchMatchedJourney, updateMatchedJourney, fetchJourneyNotes, createJourneyNote, deleteJourneyNote, breakMatch } from '@/lib/matching'
import { getChecklistSteps, getChecklistMilestones, CHECKLIST_STEP_STATUSES } from '@/lib/checklistStore'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchInsurance } from '@/lib/db'
import { sendSMS } from '@/lib/sms'
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

// ── Fertilized Egg Icon (for embryos) ──────────────────
function FertilizedEggIcon({ size = 14, color = 'currentColor', className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <circle cx="12" cy="12" r="7.5" />
      <path d="M8 15 Q8 9, 14 8" />
      <circle cx="15" cy="14" r="1.8" />
      <circle cx="13.5" cy="16.5" r="1.2" />
      <circle cx="16.5" cy="16" r="1" />
    </svg>
  )
}

// ── Date formatter MM/DD/YYYY ──────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

// ── IVF Clinic Icon (matches match sheets) ─────────────
function EmbryoIcon({ size = 14, color = '#000', className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="12" r="8.5" />
      <ellipse cx="9.5" cy="13" rx="3.5" ry="4.5" transform="rotate(-20 9.5 13)" />
      <circle cx="8.5" cy="14.5" r="1.2" fill={color} stroke="none" />
      <line x1="19.5" y1="8" x2="14" y2="10.5" />
      <line x1="19.5" y1="8" x2="21.5" y2="7" />
      <line x1="19.5" y1="8" x2="20.5" y2="6" />
    </svg>
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
function AttorneyRow({ prefix, data, onSaveBatch, onEmail, color = 'pink' }) {
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
    onSaveBatch({
      [`${prefix}Name`]: form.name,
      [`${prefix}Firm`]: form.firm,
      [`${prefix}Email`]: form.email,
      [`${prefix}Phone`]: form.phone,
    })
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
      <button onClick={startEdit} className="font-medium text-stone-700 hover:text-[#283693] hover:underline cursor-pointer">{name}</button>
      {firm && <><span className="text-stone-300">·</span> <span>{firm}</span></>}
      {email && (
        <button
          className={`inline-flex items-center gap-1 rounded-full text-[10px] h-5 px-2 ml-1 border border-stone-200 text-stone-500 transition-all cursor-pointer ${color === 'indigo' ? 'hover:bg-[#283693] hover:border-[#283693] hover:text-white' : 'hover:bg-[#ed148c] hover:border-[#ed148c] hover:text-white'}`}
          onClick={() => onEmail(email, name)}>
          <Mail className="size-2.5" /> Email Attorney
        </button>
      )}
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
  const [gcInsurance, setGcInsurance] = useState(null)
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [ipFlip, setIpFlip] = useState({})
  const [emailConfirm, setEmailConfirm] = useState(null) // { name, email, caseId }
  const [smsOpen, setSmsOpen] = useState(null) // { phone, name }
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsResult, setSmsResult] = useState(null)
  const toggleGcFlip = (key) => setGcFlip(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleIpFlip = (key) => setIpFlip(prev => ({ ...prev, [key]: !prev[key] }))
  const { openDraft } = useDrafts()

  async function handleSendSMS() {
    if (!smsMessage.trim() || !smsOpen?.phone) return
    setSmsSending(true)
    try {
      await sendSMS(smsOpen.phone, smsMessage.trim())
      setSmsResult('sent')
      setSmsMessage('')
      setTimeout(() => setSmsOpen(null), 1500)
    } catch { setSmsResult('error') }
    finally { setSmsSending(false) }
  }

  useEffect(() => {
    async function load() {
      try {
        const j = await fetchMatchedJourney(Number(id))
        if (!j) { setLoading(false); return }
        setJourney(j)
        const [gcs, ips] = await Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
        setGcCase(gcs.find(g => g.id === j.gc_case_id) || null)
        setIpCase(ips.find(i => i.id === j.ip_case_id) || null)
        fetchInsurance(j.gc_case_id, 'surrogate').then(setGcInsurance).catch(() => {})
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [id])

  async function updateField(key, value) {
    const jd = { ...(journey.journey_data || {}), [key]: value }
    const updated = await updateMatchedJourney(journey.id, { journey_data: jd }).catch(() => null)
    if (updated) setJourney(updated)
  }

  async function updateFields(fields) {
    const jd = { ...(journey.journey_data || {}), ...fields }
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

      {/* ─── Hero: Journey left, GC/IP stacked right ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Journey Info Card (purple tint, 3 of 5 cols) */}
        <div className="lg:col-span-3 rounded-2xl border border-stone-200/80 overflow-hidden bg-white">
          <div className="p-6 space-y-5">

            {/* Stage + Status pill */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button onClick={() => { setStageOpen(!stageOpen); setStatusOpen(false) }}
                  className="flex items-center gap-2 text-xl font-heading font-bold hover:underline cursor-pointer" style={{ color: stageObj.color }}>
                  <Milestone className="size-6" /> {stageObj.label}
                </button>
                {stageOpen && (
                  <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border py-2">
                    {JOURNEY_STAGES.map((stage, i) => (
                      <button key={stage.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 flex items-center gap-2.5" onClick={() => changeStage(stage.id)}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: stage.color }}>{i + 4}</span>
                        {stage.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Status as a pill badge */}
              <div className="relative">
                <button onClick={() => { setStatusOpen(!statusOpen); setStageOpen(false) }}
                  className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border cursor-pointer hover:shadow-sm transition-all"
                  style={{ color: stageObj.color, backgroundColor: `${stageObj.color}12`, borderColor: `${stageObj.color}30` }}>
                  {journey.status}
                </button>
                {statusOpen && (
                  <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border py-2 max-h-64 overflow-y-auto">
                    {statuses.map(status => (
                      <button key={status} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 flex items-center gap-2.5" onClick={() => changeStatus(status)}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stageObj.color }} />{status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Pregnancy — only when Active Pregnancy or later */}
              {['Active Pregnancy', 'Monitoring', 'Delivery Scheduled', 'Delivered', 'Post-Partum'].includes(journey.status) && jd.dueDate && (
                <div className="flex items-center gap-2 ml-1">
                  <span className="text-2xl font-bold text-pink-600">{calcGestationalWeeks(jd.dueDate) || ''}</span>
                  <span className="text-sm text-stone-500">Due <EditableTileInline value={jd.dueDate} onSave={v => updateField('dueDate', v)} type="date" className="text-stone-700" /></span>
                </div>
              )}
            </div>

            {/* Key info row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-stone-500">LW: <button onClick={() => updateField('lostWages', jd.lostWages === 'yes' ? 'no' : 'yes')} className="font-bold text-stone-800 hover:underline cursor-pointer">{jd.lostWages === 'yes' ? 'Yes' : jd.lostWages === 'no' ? 'No' : '—'}</button></span>
              <span className="text-stone-500">Pumping: <button onClick={() => updateField('pumping', jd.pumping === 'yes' ? 'no' : 'yes')} className="font-bold text-stone-800 hover:underline cursor-pointer">{jd.pumping === 'yes' ? 'Yes' : jd.pumping === 'no' ? 'No' : '—'}</button></span>
              {gcInsurance?.has_insurance && gcInsurance.status === 'active' && (
                <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium" title="View insurance">
                  <InsuranceCardIcon size={15} color="currentColor" /> {gcInsurance.company || 'Insured'}
                </button>
              )}
            </div>

            {/* Escrow */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-stone-500">Escrow Min: <EditableTileInline value={jd.escrowMin} onSave={v => updateField('escrowMin', v)} type="currency" className="text-stone-800" /></span>
              <span className="text-stone-500">Balance: <EditableTileInline value={jd.escrowBalance} onSave={v => updateField('escrowBalance', v)} type="currency"
                className={jd.escrowBalance && jd.escrowMin ? (parseCurrency(jd.escrowBalance) >= parseCurrency(jd.escrowMin) ? 'text-emerald-600' : 'text-red-600') : 'text-stone-800'} /></span>
              <span className="text-stone-500 flex items-center gap-1.5"><Calendar className="size-3.5" /> <EditableTileInline value={jd.escrowClosingDate} onSave={v => updateField('escrowClosingDate', v)} type="date" placeholder="Escrow close" className="text-stone-800" /></span>
            </div>

            {/* Clinics / Hospital */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 text-stone-700"><EmbryoIcon size={15} color="#78716c" /> <EditableTileInline value={jd.ivfClinic} onSave={v => updateField('ivfClinic', v)} type="text" placeholder="Set fertility clinic" /></span>
              <span className="flex items-center gap-1.5 text-stone-700"><Stethoscope className="size-4 text-stone-400" /> <EditableTileInline value={jd.obClinic} onSave={v => updateField('obClinic', v)} type="text" placeholder="Set OB clinic" /></span>
              <span className="flex items-center gap-1.5 text-stone-700"><Hospital className="size-4 text-stone-400" /> <EditableTileInline value={jd.deliveryHospital} onSave={v => updateField('deliveryHospital', v)} type="text" placeholder="Set hospital" /></span>
            </div>

            {/* Managers */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <UserCog className="size-4 text-stone-400" />
                <span className="text-stone-500">Case Mgr:</span>
                <SelectUI value={journey.assigned_to || '_unassigned'} onValueChange={async val => {
                  const updated = await updateMatchedJourney(journey.id, { assigned_to: val === '_unassigned' ? null : val }).catch(() => null)
                  if (updated) setJourney(updated)
                }}>
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]"><SelectValueUI /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {ADMIN_STAFF.map(a => <SelectItemUI key={a.email} value={a.email}>{a.name}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
              </div>
              <div className="flex items-center gap-1.5">
                <Crown className="size-4 text-amber-500" />
                <span className="text-stone-500">Journey Mgr:</span>
                <SelectUI value={jd.journeyManager || '_unassigned'} onValueChange={async val => {
                  updateField('journeyManager', val === '_unassigned' ? '' : val)
                }}>
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]"><SelectValueUI /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {JOURNEY_MANAGERS.map(a => <SelectItemUI key={a.email} value={a.name}>{a.name}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>
          </div>
        </div>

        {/* GC + IP stacked (2 of 5 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">

        {/* GC Card (pink tint) */}
        <div className="rounded-2xl border border-stone-200/80 overflow-hidden flex-1" style={{ backgroundColor: '#ed148c0d' }}>
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest">Surrogate</p>
            {gcCase ? (() => {
              const gcA = gcCase.answers || {}
              const gcPartner = gcA.partnerName || gcA.spouseFullName || ''
              const gcAddr = [gcA.street, gcA.city, gcA.state, gcA.zipCode].filter(Boolean).join(', ') || gcCase.location || '—'
              return (<>
                <div className="flex items-center gap-2.5">
                  <ProfileAvatar name={gcCase.name} size="sm" className="ring-2 ring-white shadow" />
                  <div className="min-w-0">
                    <Link to={`/surrogates/${gcCase.id}`} className="text-sm font-heading font-bold hover:text-[#283693] transition-colors block truncate">{gcCase.name}</Link>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-500">
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('age')}>
                        {gcFlip.age ? fmtDate(gcCase.dob || gcA.dob) : `Age ${gcCase.age || '—'}`}
                      </span>
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('relationship')}>
                        <Heart className="size-2.5 inline" /> {gcFlip.relationship ? (gcPartner || '—') : (gcCase.maritalStatus || '—')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-stone-500 cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('address')}>
                  <Home className="size-2.5 inline mr-0.5" />{gcFlip.address ? gcAddr : (gcCase.location || '—')}
                </div>
                {gcInsurance?.has_insurance && gcInsurance.status === 'active' && (
                  <div className="text-[10px] text-emerald-600">
                    <InsuranceCardIcon size={11} color="currentColor" className="inline mr-0.5" /> {gcInsurance.company || 'Insured'}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {gcCase.phone && (
                    <Button variant={gcCase.preferredContact === 'Text' ? 'default' : 'outline'} size="sm"
                      className={`gap-1 rounded-full text-[10px] h-6 px-2 ${gcCase.preferredContact === 'Text' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                      onClick={() => { setSmsOpen({ phone: gcCase.phone, name: gcCase.name }); setSmsMessage(''); setSmsResult(null) }}>
                      <MessageSquare className="size-2.5" /> Text
                    </Button>
                  )}
                  <Button variant={gcCase.preferredContact === 'Email' ? 'default' : 'outline'} size="sm"
                    className={`gap-1 rounded-full text-[10px] h-6 px-2 ${gcCase.preferredContact === 'Email' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                    onClick={() => setEmailConfirm({ name: gcCase.name, email: gcCase.email, caseId: journey.id })}>
                    <Mail className="size-2.5" /> Email
                  </Button>
                  {gcCase.phone && <CopyFlipButton icon={Phone} label="Call" value={gcCase.phone} flipped={gcFlip.phone} onFlip={() => toggleGcFlip('phone')} preferred={gcCase.preferredContact === 'Phone'} />}
                </div>
                <AttorneyRow prefix="gcAttorney" data={jd} onSaveBatch={updateFields}
                  onEmail={(email, name) => setEmailConfirm({ name: name || 'GC Attorney', email, caseId: journey.id })} />
              </>)
            })() : <p className="text-xs text-stone-400">GC not found</p>}
          </div>
        </div>

        {/* IP Card (blue tint) */}
        <div className="rounded-2xl border border-stone-200/80 overflow-hidden flex-1" style={{ backgroundColor: '#2836930d' }}>
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-[#283693]/50 uppercase tracking-widest">Intended Parent{ipCase?.type === 'Couple' ? 's' : ''}</p>
            {ipCase ? (() => {
              const ipA = ipCase.answers || {}
              const ip1Age = ipCase.age
              const ip2Dob = ipA.ip2Dob ? new Date(ipA.ip2Dob) : null
              const ip2Age = ip2Dob ? Math.floor((Date.now() - ip2Dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
              const ageDisplay = ip2Age ? `${ip1Age} & ${ip2Age}` : `Age ${ip1Age || '—'}`
              const dobDisplay = ip2Dob ? `${fmtDate(ipA.primaryDob)} & ${fmtDate(ipA.ip2Dob)}` : fmtDate(ipA.primaryDob)
              const ipAddr = [ipA.street, ipA.city, ipA.stateProv, ipA.zipCode].filter(Boolean).join(', ') || ipCase.location || '—'
              const allPhones = [ipCase.phone, ipCase.ip2Phone].filter(Boolean).join(' / ')
              return (<>
                <div className="flex items-center gap-2.5">
                  <ProfileAvatar name={ipCase.names} size="sm" className="ring-2 ring-white shadow" />
                  <div className="min-w-0">
                    <Link to={`/intended-parents/${ipCase.id}`} className="text-sm font-heading font-bold hover:text-[#283693] transition-colors block truncate">{ipCase.names}</Link>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-500">
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleIpFlip('age')}>
                        {ipFlip.age ? dobDisplay : ageDisplay}
                      </span>
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleIpFlip('relationship')}>
                        <Heart className="size-2.5 inline" /> {ipFlip.relationship ? (ipCase.ip2Name || '—') : (ipA.maritalStatus || '—')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-500">
                  {ipCase.reDoctorName && <span><Stethoscope className="size-2.5 inline" /> {ipCase.reDoctorName}</span>}
                  {ipCase.hasFrozenEmbryos && <span><FertilizedEggIcon size={11} color="currentColor" className="inline" /> {ipCase.frozenEmbryoDetails || 'Embryos'}</span>}
                  <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleIpFlip('address')}>
                    <Home className="size-2.5 inline" /> {ipFlip.address ? ipAddr : (ipCase.location || '—')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ipCase.phone && (
                    <Button variant="outline" size="sm" className="gap-1 rounded-full text-[10px] h-6 px-2"
                      onClick={() => { setSmsOpen({ phone: ipCase.phone, name: ipCase.ip1Name || ipCase.names }); setSmsMessage(''); setSmsResult(null) }}>
                      <MessageSquare className="size-2.5" /> Text
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1 rounded-full text-[10px] h-6 px-2"
                    onClick={() => {
                      const emails = [ipCase.email, ipCase.ip2Email].filter(Boolean).join(', ')
                      setEmailConfirm({ name: ipCase.names, email: emails, caseId: journey.id })
                    }}>
                    <Mail className="size-2.5" /> Email
                  </Button>
                  {allPhones && <CopyFlipButton icon={Phone} label="Call" value={allPhones} flipped={ipFlip.phone} onFlip={() => toggleIpFlip('phone')} preferred={false} />}
                </div>
                <AttorneyRow prefix="ipAttorney" data={jd} onSaveBatch={updateFields} color="indigo"
                  onEmail={(email, name) => setEmailConfirm({ name: name || 'IP Attorney', email, caseId: journey.id })} />
              </>)
            })() : <p className="text-xs text-stone-400">IP not found</p>}
          </div>
        </div>

        </div>{/* end GC+IP stacked column */}
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <SortableTabsList configKey={`journey_${journey.id}`} tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'profiles', label: 'Profiles' },
          { value: 'checklist', label: 'Checklist' },
          { value: 'match-sheets', label: 'Match Sheets' },
          { value: 'documents', label: 'Documents' },
          { value: 'insurance', label: 'Insurance' },
          { value: 'notes', label: 'Notes' },
          { value: 'emails', label: 'Emails' },
          { value: 'texts', label: 'Texts' },
        ]} />

        <TabsContent value="overview" className="mt-4">
          <JourneyChecklistTab journey={journey} onUpdate={async (updates) => {
            const updated = await updateMatchedJourney(journey.id, updates).catch(() => null)
            if (updated) setJourney(updated)
          }} />
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
        <TabsContent value="insurance" className="mt-4">
          <InsuranceTab caseId={journey.gc_case_id} caseType="surrogate" surrogateNameForDisplay={gcCase?.name} />
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

      {/* SMS Dialog */}
      <Dialog open={!!smsOpen} onOpenChange={v => { if (!v) setSmsOpen(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Text {smsOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-stone-400">{smsOpen?.phone}</p>
            <Textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} placeholder="Type your message..." rows={3} />
            {smsResult === 'sent' && <p className="text-sm text-emerald-600 font-medium">Message sent!</p>}
            {smsResult === 'error' && <p className="text-sm text-red-600 font-medium">Failed to send</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setSmsOpen(null)}>Cancel</Button>
              <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleSendSMS} disabled={smsSending || !smsMessage.trim()}>
                {smsSending ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
                {smsSending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insurance Dialog */}
      <Dialog open={insuranceOpen} onOpenChange={setInsuranceOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><InsuranceCardIcon size={18} color="#283693" /> Insurance — {gcCase?.name}</DialogTitle>
          </DialogHeader>
          <InsuranceTab caseId={journey?.gc_case_id} caseType="surrogate" surrogateNameForDisplay={gcCase?.name} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
