import { useState, useEffect, useRef, Component } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Heart, Users, Baby, MapPin, Stethoscope, FileText,
  Milestone, Circle, UserCog, Mail, Phone, DollarSign, Droplets, Briefcase,
  Pencil, Save, Loader2, X, Crown, Copy, Check, Calendar, Home, MessageSquare,
  Hospital, Building2, ChevronDown, Printer, Scale, Plus, Trash2, Eye, Paperclip, HeartPulse, Sparkles, StickyNote,
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
import CaseTasksWidget from '@/components/shared/CaseTasksWidget'
import CaseCalendarWidget from '@/components/shared/CaseCalendarWidget'
import TrackingTable from '@/components/shared/TrackingTable'
import MatchSheetsTab from '@/components/journeys/MatchSheetsTab'
import GCApplicationTab from '@/components/surrogates/GCApplicationTab'
import IPApplicationTab from '@/components/intended-parents/IPApplicationTab'
import IPProfileTab from '@/components/intended-parents/IPProfileTab'
import { ProfilePreview } from '@/pages/profile/SurrogateProfilePage'
import { ProfileTab as GCProfileTab, DocumentsTab } from '@/pages/surrogates/SurrogateDetailPage'
import SortableTabsList from '@/components/shared/SortableTabsList'
import RichTextEditor, { RichTextDisplay } from '@/components/shared/RichTextEditor'
import { useRole } from '@/context/RoleContext'
import { useDrafts } from '@/context/DraftContext'
import { SURROGATE_STAGES } from '@/lib/constants'
import { getStatusesForStage } from '@/lib/stageStatusStore'
import { formatDate } from '@/lib/utils'
import { fetchMatchedJourney, updateMatchedJourney, fetchJourneyNotes, createJourneyNote, deleteJourneyNote, breakMatch } from '@/lib/matching'
import { getChecklistSteps, getChecklistMilestones, CHECKLIST_STEP_STATUSES } from '@/lib/checklistStore'
import { Textarea } from '@/components/ui/textarea'
import AISummaryButton from '@/components/shared/AISummaryButton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchInsurance, fetchIntakeByEmail, fetchSurrogateProfileByEmail, listProfilePhotos, getPortraitPhotoUrl, fetchJourneyExpenses, insertExpense, updateExpense, deleteExpense, uploadCaseDocument, getAppConfig, setAppConfig } from '@/lib/db'
import { sendSMS } from '@/lib/sms'
import { getAdminStaff } from '@/data/mock/users'
import ConfettiBurst, { useConfetti } from '@/components/effects/ConfettiBurst'

const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => s.id === 'journey-oversight')

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

  const display = type === 'date' && value ? formatDate(value) : value

  return (
    <button onClick={() => { setVal(value); setEditing(true) }}
      className={`font-semibold hover:underline cursor-pointer ${className || 'text-stone-800'}`}>
      {display || <span className="text-stone-300 font-normal">{placeholder}</span>}
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
const fmtDate = formatDate

// ── IVF Clinic Icon (matches match sheets) ─────────────
function PregnancyIcon({ size = 48, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8BC53F" />
          <stop offset="20%" stopColor="#29ABE2" />
          <stop offset="45%" stopColor="#ed148c" />
          <stop offset="70%" stopColor="#F7941D" />
          <stop offset="100%" stopColor="#FFC107" />
        </linearGradient>
      </defs>
      {/* Pregnant belly side profile — flowing line art */}
      <path
        d="M58 8 C56 6, 52 8, 50 14 C48 20, 46 22, 42 24 C38 26, 34 26, 30 30 C26 34, 22 42, 20 50 C18 58, 20 68, 26 76 C32 84, 40 90, 48 92 C56 94, 60 90, 62 86"
        stroke="url(#bellyGrad)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Back line */}
      <path
        d="M62 8 C64 6, 68 8, 70 14 C72 20, 74 30, 74 40 C74 50, 72 62, 68 72 C64 82, 62 86, 62 86"
        stroke="url(#bellyGrad)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

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

// ── Checklist History (read-only collapsed sections) ────
function ChecklistHistory({ history }) {
  const [openIdx, setOpenIdx] = useState(null)
  if (!history || history.length === 0) return null

  return (
    <div className="space-y-2 mt-6">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Previous Checklists</p>
      {history.map((snap, i) => {
        const isOpen = openIdx === i
        const steps = getChecklistSteps('gc', snap.stageId)
        const completed = steps.filter(s => snap.tracking[s.id]?.status === 'complete').length
        const total = steps.length
        return (
          <div key={i} className="rounded-xl border border-stone-100 overflow-hidden">
            <button onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                <span className="font-medium text-stone-700">{snap.stageLabel}</span>
                <span className="text-xs text-stone-400">{completed}/{total} completed</span>
              </div>
              <span className="text-xs text-stone-400">{fmtDate(snap.completedAt)}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 space-y-1.5">
                {steps.map(step => {
                  const s = snap.tracking[step.id] || {}
                  const isDone = s.status === 'complete'
                  const isNA = s.status === 'na'
                  return (
                    <div key={step.id} className={`flex items-center gap-2 text-xs py-1 ${isNA ? 'opacity-40' : ''}`}>
                      {isDone ? <Check className="size-3.5 text-emerald-500" /> : isNA ? <X className="size-3.5 text-stone-300" /> : <Circle className="size-3.5 text-stone-300" />}
                      <span className={isDone ? 'text-stone-700' : 'text-stone-400'}>{step.label}</span>
                      {s.updatedBy && <span className="text-stone-300 ml-auto">{s.updatedBy}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Journey Milestone Timeline ─
function JourneyMilestoneTimeline({ journey }) {
  const stageId = journey.stage || 'journey-oversight'
  const milestones = getChecklistMilestones('gc', stageId)
  const tracking = journey.journey_data?._checklistTracking || {}

  let completed = 0
  const milestoneData = milestones.map(ms => {
    const stepIds = ms.stepIds || []
    const relevantSteps = stepIds.filter(id => tracking[id]?.status || !id.startsWith('_'))
    const allComplete = relevantSteps.length > 0 && relevantSteps.every(id => tracking[id]?.status === 'complete' || tracking[id]?.status === 'na')
    const anyStarted = relevantSteps.some(id => tracking[id]?.status && tracking[id].status !== 'not_started')
    const status = allComplete ? 'complete' : anyStarted ? 'in_progress' : 'not_started'
    if (allComplete) completed++
    return { ...ms, status, stepCount: stepIds.length }
  })
  const total = milestones.length

  const getGradientColor = (index) => {
    if (total <= 1) return '#ed148c'
    const t = index / (total - 1)
    const r = Math.round(237 + (40 - 237) * t)
    const g = Math.round(20 + (54 - 20) * t)
    const b = Math.round(140 + (147 - 140) * t)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#283693]">Milestones</h3>
        <span className="text-sm font-semibold text-stone-400">{completed}/{total}</span>
      </div>

      {milestoneData.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-4">No milestones configured for this stage. Set them up in Settings.</p>
      ) : (
        <div className="relative pt-4 pb-2 overflow-x-auto">
          <div className="relative flex items-start" style={{ minWidth: `${Math.max(milestoneData.length * 120, 400)}px` }}>
            <div className="absolute top-[14px] left-[14px] right-[14px] h-[3px] bg-stone-200 rounded-full" />
            {completed > 0 && (
              <div
                className="absolute top-[14px] left-[14px] h-[3px] rounded-full transition-all duration-700"
                style={{
                  width: total <= 1 ? '100%' : `${((milestoneData.findLastIndex(m => m.status === 'complete') + 0.5) / (total - 1)) * 100}%`,
                  maxWidth: 'calc(100% - 28px)',
                  background: 'linear-gradient(90deg, #ed148c, #283693)',
                }}
              />
            )}
            {milestoneData.map((ms, i) => {
              const isComplete = ms.status === 'complete'
              const isActive = ms.status === 'in_progress'
              const color = getGradientColor(i)
              return (
                <div key={ms.id} className="flex-1 flex flex-col items-center relative z-10" style={{ minWidth: '80px' }}>
                  <div
                    className={`w-7 h-7 rounded-full border-[3px] transition-all duration-300 ${
                      isComplete ? 'scale-110' : isActive ? 'scale-105 shadow-md' : ''
                    }`}
                    style={{
                      backgroundColor: isComplete ? color : isActive ? color + '40' : '#e7e5e4',
                      borderColor: isComplete || isActive ? color : '#d6d3d1',
                    }}
                  />
                  <p className={`text-[11px] mt-2 text-center leading-tight font-medium max-w-[90px] ${isComplete ? 'text-stone-800' : isActive ? 'text-stone-600' : 'text-stone-400'}`}>
                    {ms.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
    <div>
      <TrackingTable
        title={`${stageObj.label} Checklist`}
        steps={steps}
        statuses={CHECKLIST_STEP_STATUSES}
        tracking={tracking}
        onUpdate={handleUpdate}
        currentUserName={currentUser.name}
      />
      <ChecklistHistory history={journey.journey_data?._checklistHistory} />
    </div>
  )
}

// ── Inline Editable Expense Row ─────────────────────────
function ExpenseRow({ exp, onUpdate, onDelete, fmtCurrency, onPreview, gcCaseId }) {
  const [editField, setEditField] = useState(null)
  const [editVal, setEditVal] = useState('')
  const fileRef = useRef(null)

  function startEdit(field, value) {
    if (exp.reconciled) return
    setEditField(field)
    setEditVal(value ?? '')
  }

  function saveEdit() {
    let val = editVal
    if (editField === 'amount') val = parseFloat(editVal) || null
    if (editField === 'cc_last4') val = (editVal || '').replace(/\D/g, '').slice(-4) || null
    if (editField === 'submitted_to_escrow') val = editVal === 'yes' || editVal === true
    onUpdate(exp.id, editField, val)
    setEditField(null)
  }

  function renderCell(field, display, className = '') {
    if (editField === field) {
      if (field === 'submitted_to_escrow') {
        return (
          <div className="flex items-center gap-1">
            <select value={editVal ? 'yes' : 'no'} onChange={e => setEditVal(e.target.value === 'yes')} className="h-7 text-xs border rounded px-1.5 bg-white" autoFocus>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <button onClick={saveEdit} className="text-green-600"><Check className="size-3" /></button>
            <button onClick={() => setEditField(null)} className="text-stone-400"><X className="size-3" /></button>
          </div>
        )
      }
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editVal}
            onChange={e => {
              if (field === 'cc_last4') setEditVal(e.target.value.replace(/\D/g, '').slice(0, 4))
              else if (field === 'amount') { const digits = e.target.value.replace(/[^\d]/g, ''); const cents = parseInt(digits || '0', 10); setEditVal((cents / 100).toFixed(2)) }
              else setEditVal(e.target.value)
            }}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditField(null) }}
            className="h-7 text-xs"
            type={field === 'expense_date' ? 'date' : 'text'}
            maxLength={field === 'cc_last4' ? 4 : undefined}
            autoFocus
          />
          <button onClick={saveEdit} className="text-green-600 shrink-0"><Check className="size-3" /></button>
          <button onClick={() => setEditField(null)} className="text-stone-400 shrink-0"><X className="size-3" /></button>
        </div>
      )
    }
    return (
      <button onClick={() => startEdit(field, exp[field])} className={`text-left cursor-text min-h-[20px] w-full ${exp.reconciled ? 'cursor-default' : ''} ${className}`}>
        {display}
      </button>
    )
  }

  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50/50">
      <td className="px-4 py-3 text-sm">{renderCell('expense_date', formatDate(exp.expense_date) || '—')}</td>
      <td className="px-4 py-3 text-sm font-medium">{renderCell('amount', fmtCurrency(exp.amount))}</td>
      <td className="px-4 py-3 text-sm">{renderCell('paid_to', exp.paid_to || '—')}</td>
      <td className="px-4 py-3 text-sm">{renderCell('cc_last4', exp.cc_last4 ? <span className="font-mono text-stone-500">••••{exp.cc_last4}</span> : '—')}</td>
      <td className="px-4 py-3 text-sm">{renderCell('submitted_to_escrow', exp.submitted_to_escrow ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-stone-400">No</span>)}</td>
      <td className="px-4 py-3 text-sm text-stone-500">{renderCell('notes', exp.notes || '—')}</td>
      <td className="px-3 py-3 text-center">
        {exp.attachment_url ? (
          <button onClick={() => onPreview(exp.attachment_url)} className="text-stone-400 hover:text-abc-indigo transition-colors" title="View attachment">
            <Eye className="size-4" />
          </button>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="text-stone-300 hover:text-abc-indigo transition-colors" title="Add attachment">
            <Paperclip className="size-3.5" />
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" onChange={async e => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            const doc = await uploadCaseDocument({ surrogateId: gcCaseId, category: 'Expenses', file, uploadedBy: 'Admin' })
            if (doc?.public_url) {
              await onUpdate(exp.id, 'attachment_url', doc.public_url)
            }
          } catch (err) {
            console.error('Upload failed:', err)
            alert('Failed to save attachment: ' + (err.message || 'Unknown error'))
          }
          e.target.value = ''
        }} />
      </td>
      <td className="px-4 py-3 text-center">
        {exp.reconciled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            <Check className="size-2.5" /> Reconciled
          </span>
        ) : (
          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>
        )}
      </td>
      <td className="px-2 py-3">
        {!exp.reconciled && (
          <button onClick={() => onDelete(exp.id)} className="text-stone-300 hover:text-red-500 transition-colors" title="Delete">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Journey Case Sticky Note (shared across all users) ──
function JourneyCaseNote({ journeyId, caseKey }) {
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const configKey = `journey_note_${journeyId}_${caseKey}`

  useEffect(() => {
    getAppConfig(configKey).then(val => {
      if (val) setNote(val)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [configKey])

  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => {
      setAppConfig(configKey, note).catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [note, loaded])

  return (
    <div className="mt-2 pt-2 border-t border-stone-100">
      <div className="flex items-center gap-1 mb-1">
        <StickyNote className="size-3 text-stone-300" />
        <span className="text-[10px] text-stone-400 font-medium">Quick Note</span>
        {saving && <Loader2 className="size-2.5 animate-spin text-stone-300" />}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a quick note..."
        className="w-full text-xs text-stone-600 bg-yellow-50/50 rounded-lg border border-stone-100 px-2.5 py-1.5 resize-none focus:outline-none focus:border-stone-300 min-h-[40px]"
        rows={2}
      />
    </div>
  )
}

// ── Pregnancy Tracker ───────────────────────────────────
// Ferring wheel: 5-day embryo transfer + 261 days = 40 weeks gestation
const TRANSFER_CALC_DAYS = 261

function PregnancyTracker({ journey, onUpdate, onPregnancyConfirmed, onStatusChange }) {
  const jd = journey.journey_data || {}
  const transfers = jd._transfers || []
  const [addOpen, setAddOpen] = useState(false)
  const [editIdx, setEditIdx] = useState(null)
  const [transferForm, setTransferForm] = useState({ date: '', embryoCount: '1', notes: '' })
  const [betaOpen, setBetaOpen] = useState(null)
  const [betaValue, setBetaValue] = useState('')
  const [needsSecondBeta, setNeedsSecondBeta] = useState(null) // null = not selected yet
  const [beta2Open, setBeta2Open] = useState(null)
  const [beta2Value, setBeta2Value] = useState('')
  const [heartbeatOpen, setHeartbeatOpen] = useState(false)
  const [heartbeatDate, setHeartbeatDate] = useState('')
  const [heartbeatDueDate, setHeartbeatDueDate] = useState('')
  const [heartbeatBabies, setHeartbeatBabies] = useState('1')
  const [babySexes, setBabySexes] = useState([])
  const [babyNames, setBabyNames] = useState([])
  const [babySexOpen, setBabySexOpen] = useState(false)
  const [lossOpen, setLossOpen] = useState(false)
  const [lossReason, setLossReason] = useState('')
  const [birthOpen, setBirthOpen] = useState(false)
  const [birthForm, setBirthForm] = useState({ date: '', deliveryType: '', notes: '' })
  const [birthBabies, setBirthBabies] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(null)
  const [saving, setSaving] = useState(false)

  const latestTransfer = transfers.length > 0 ? transfers[transfers.length - 1] : null
  const isPregnant = jd.pregnant === 'yes'
  const isLatestClosed = latestTransfer?.lossType || latestTransfer?.unsuccessful || latestTransfer?.betaResult === 'negative' || latestTransfer?.droppedCycle
  const hasActiveTransfer = latestTransfer && !isLatestClosed
  const hasPositiveBeta = hasActiveTransfer && latestTransfer?.betaResult === 'positive'
  const hasBeta2 = hasActiveTransfer && latestTransfer?.needsSecondBeta
  const hasBeta2Done = hasActiveTransfer && latestTransfer?.beta2Result === 'positive'
  const betaComplete = hasPositiveBeta && (!latestTransfer?.needsSecondBeta || hasBeta2Done)
  const hasHeartbeat = hasActiveTransfer && latestTransfer?.heartbeatConfirmed

  // Set active tab to latest transfer on mount
  useEffect(() => { if (transfers.length > 0 && activeTab === null) setActiveTab(transfers.length - 1) }, [transfers.length])

  async function handleAddTransfer() {
    if (!transferForm.date) return
    setSaving(true)
    const newTransfer = { date: transferForm.date, embryoCount: parseInt(transferForm.embryoCount) || 1, notes: transferForm.notes || '', betaResult: null, betaDate: null, heartbeatConfirmed: false, heartbeatDate: null }
    const updated = [...transfers, newTransfer]
    await onUpdate({ _transfers: updated })
    setTransferForm({ date: '', embryoCount: '1', notes: '' })
    setAddOpen(false)
    setActiveTab(updated.length - 1)
    setSaving(false)
  }

  async function handleEditTransfer() {
    if (editIdx === null) return
    setSaving(true)
    const updated = [...transfers]
    updated[editIdx] = {
      ...updated[editIdx],
      date: transferForm.date,
      embryoCount: parseInt(transferForm.embryoCount) || 1,
      notes: transferForm.notes || '',
      droppedCycle: transferForm.droppedCycle || false,
      betaResult: transferForm.betaResult || updated[editIdx].betaResult,
      betaValue: transferForm.betaValue || updated[editIdx].betaValue,
      betaDate: transferForm.betaDate || updated[editIdx].betaDate,
      needsSecondBeta: transferForm.needsSecondBeta ?? updated[editIdx].needsSecondBeta,
      beta2Result: transferForm.beta2Result || updated[editIdx].beta2Result,
      beta2Value: transferForm.beta2Value || updated[editIdx].beta2Value,
      beta2Date: transferForm.beta2Date || updated[editIdx].beta2Date,
      heartbeatConfirmed: transferForm.heartbeatConfirmed ?? updated[editIdx].heartbeatConfirmed,
      heartbeatDate: transferForm.heartbeatDate || updated[editIdx].heartbeatDate,
      babies: parseInt(transferForm.babies) || updated[editIdx].babies || 1,
    }
    if (transferForm.droppedCycle) {
      updated[editIdx].betaResult = null; updated[editIdx].heartbeatConfirmed = false
    }
    await onUpdate({ _transfers: updated })
    setEditIdx(null)
    setAddOpen(false)
    setSaving(false)
  }

  async function handleDeleteTransfer(idx) {
    setSaving(true)
    const updated = transfers.filter((_, i) => i !== idx)
    const wasPregnant = transfers[idx]?.heartbeatConfirmed
    const updates = { _transfers: updated }
    if (wasPregnant) { updates.pregnant = 'no'; updates.dueDate = null }
    await onUpdate(updates)
    setActiveTab(Math.max(0, updated.length - 1))
    setSaving(false)
  }

  async function handleBetaResult(idx, result) {
    setSaving(true)
    const updated = [...transfers]
    updated[idx] = { ...updated[idx], betaResult: result, betaDate: new Date().toISOString().split('T')[0], betaValue: betaValue || null, needsSecondBeta: result === 'positive' ? needsSecondBeta : false }
    await onUpdate({ _transfers: updated })
    setBetaOpen(null); setBetaValue(''); setNeedsSecondBeta(null)
    setSaving(false)
  }

  async function handleBeta2Result(idx, result) {
    setSaving(true)
    const updated = [...transfers]
    updated[idx] = { ...updated[idx], beta2Result: result, beta2Date: new Date().toISOString().split('T')[0], beta2Value: beta2Value || null }
    if (result === 'negative') updated[idx].betaResult = 'negative' // fail the whole thing
    await onUpdate({ _transfers: updated })
    setBeta2Open(null); setBeta2Value('')
    setSaving(false)
  }

  // ── Update babies born counter ──
  async function updateBabiesBornCounter(action, numBabies = 1) {
    try {
      const { getAppConfig, setAppConfig } = await import('@/lib/db')
      const data = await getAppConfig('babies_born')
      if (!data) return
      const currentYear = new Date().getFullYear()
      const updated = { ...data }
      if (action === 'pregnant') {
        updated.currentPregnant = (updated.currentPregnant || 0) + 1
      } else if (action === 'delivered') {
        updated.currentPregnant = Math.max(0, (updated.currentPregnant || 0) - 1)
        const yearIdx = updated.years.findIndex(y => y.year === currentYear)
        if (yearIdx >= 0) {
          updated.years = [...updated.years]
          updated.years[yearIdx] = { ...updated.years[yearIdx], births: (updated.years[yearIdx].births || 0) + numBabies }
          if (numBabies > 1) updated.years[yearIdx].twins = (updated.years[yearIdx].twins || 0) + 1
        } else {
          updated.years = [...updated.years, { year: currentYear, births: numBabies, twins: numBabies > 1 ? 1 : 0, notes: '' }]
        }
      } else if (action === 'loss') {
        updated.currentPregnant = Math.max(0, (updated.currentPregnant || 0) - 1)
      }
      await setAppConfig('babies_born', updated)
    } catch {}
  }

  async function handleHeartbeat() {
    if (!heartbeatDate) return
    setSaving(true)
    const updated = [...transfers]
    const idx = updated.length - 1
    const numBabies = parseInt(heartbeatBabies) || 1
    updated[idx] = { ...updated[idx], heartbeatConfirmed: true, heartbeatDate, babies: numBabies, babySexes: babySexes.slice(0, numBabies) }
    let dueDateStr = heartbeatDueDate
    if (!dueDateStr) {
      const transferDate = new Date(updated[idx].date)
      dueDateStr = new Date(transferDate.getTime() + TRANSFER_CALC_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
    await onUpdate({ _transfers: updated, pregnant: 'yes', dueDate: dueDateStr, babies: numBabies, babySexes: babySexes.slice(0, numBabies) })
    if (onStatusChange) await onStatusChange('Pregnant')
    await updateBabiesBornCounter('pregnant')
    setHeartbeatOpen(false); setHeartbeatDate(''); setHeartbeatDueDate(''); setHeartbeatBabies('1'); setBabySexes([])
    setSaving(false)
    setTimeout(() => onPregnancyConfirmed(), 300)
  }

  async function handlePregnancyLoss() {
    if (!lossReason) return
    setSaving(true)
    const updated = [...transfers]
    updated[updated.length - 1] = { ...updated[updated.length - 1], lossType: lossReason, lossDate: new Date().toISOString().split('T')[0] }
    await onUpdate({ _transfers: updated, pregnant: 'no', dueDate: null })
    await updateBabiesBornCounter('loss')
    setLossOpen(false); setLossReason('')
    setSaving(false)
  }

  async function handleLogBirth() {
    if (!birthForm.date) return
    setSaving(true)
    const updatedTransfers = [...transfers]
    updatedTransfers[updatedTransfers.length - 1] = {
      ...updatedTransfers[updatedTransfers.length - 1],
      delivered: true,
      deliveryDate: birthForm.date,
      deliveryType: birthForm.deliveryType,
      deliveryNotes: birthForm.notes,
    }
    // Update baby details from birth form
    const newBabyNames = birthBabies.map(b => b.name)
    const newBabySexes = birthBabies.map(b => b.sex)
    const newBabyWeights = birthBabies.map(b => b.weight)
    const newBabyLengths = birthBabies.map(b => b.length)
    await onUpdate({
      _transfers: updatedTransfers,
      delivered: true,
      deliveryDate: birthForm.date,
      deliveryType: birthForm.deliveryType,
      deliveryNotes: birthForm.notes,
      babyNames: newBabyNames,
      babySexes: newBabySexes,
      babyWeights: newBabyWeights,
      babyLengths: newBabyLengths,
    })
    if (!jd.delivered) {
      // Only update counters on first delivery, not when editing
      if (onStatusChange) await onStatusChange('Delivered')
      const numBabies = birthBabies.length || 1
      await updateBabiesBornCounter('delivered', numBabies)
    }
    setBirthOpen(false)
    setBirthForm({ date: '', deliveryType: '', notes: '' })
    setBirthBabies([])
    setSaving(false)
  }

  // Timeline steps
  const timelineSteps = [
    { key: 'transfer', label: 'Embryo Transfer', done: hasActiveTransfer },
    { key: 'beta', label: 'Beta HCG', done: hasPositiveBeta },
    ...(latestTransfer?.needsSecondBeta ? [{ key: 'beta2', label: 'Beta HCG #2', done: hasBeta2Done }] : []),
    { key: 'heartbeat', label: 'Heartbeat', done: hasHeartbeat },
    { key: 'pregnant', label: 'Pregnant!', done: isPregnant },
    { key: 'delivered', label: 'Delivered', done: !!jd.delivered },
  ]

  const currentTabTransfer = activeTab !== null ? transfers[activeTab] : null
  const currentTabIdx = activeTab

  return (
    <div className={`border-t pt-4 ${isPregnant ? 'border-pink-200' : 'border-stone-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <HeartPulse className="size-3" /> Pregnancy Tracker
        </p>
        {(!latestTransfer || isLatestClosed) && !isPregnant && (
          <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => { setEditIdx(null); setTransferForm({ date: '', embryoCount: '1', notes: '' }); setAddOpen(true) }}>
            <Plus className="size-3" /> Log Embryo Transfer
          </Button>
        )}
      </div>

      {/* Pregnancy / Delivered banner */}
      {(isPregnant || jd.delivered) && (
        <div className={`rounded-xl border p-4 mb-4 ${jd.delivered ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200' : 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200'}`}>
          <div className="flex items-center gap-3">
            {jd.delivered ? (
              <img
                src={jd.babySexes?.[0] === 'girl' ? '/baby-girl.png' : '/baby-boy.png'}
                alt="Baby"
                className="size-20 object-contain"
              />
            ) : (
              <span className="text-5xl">🤰</span>
            )}
            <div>
              {jd.delivered ? (
                <>
                  <p className="text-xl font-bold text-amber-700">Baby Born!</p>
                  <p className="text-sm text-stone-600">
                    Delivered {formatDate(jd.deliveryDate)}
                    {jd.deliveryType ? ` · ${jd.deliveryType}` : ''}
                    {jd.babies > 1 ? ` · ${jd.babies} babies` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-pink-600">{calcGestationalWeeks(jd.dueDate) || ''}</p>
                  <p className="text-sm text-stone-600">
                    Due {formatDate(jd.dueDate)}
                    {jd.babies > 1 ? ` · ${jd.babies} babies` : ''}
                  </p>
                </>
              )}
              {(jd.babySexes?.length > 0 || jd.babyNames?.length > 0) && (
                <p className="text-sm text-stone-600 mt-0.5">
                  {(jd.babyNames || []).map((name, i) => {
                    const sex = jd.babySexes?.[i]
                    const emoji = sex === 'boy' ? '👦' : sex === 'girl' ? '👧' : ''
                    const weight = jd.babyWeights?.[i]
                    const length = jd.babyLengths?.[i]
                    const details = [weight ? `${weight}` : '', length ? `${length}"` : ''].filter(Boolean).join(', ')
                    return [emoji, name, details ? `(${details})` : ''].filter(Boolean).join(' ')
                  }).filter(Boolean).join(' · ')}
                  {(!jd.babyNames?.some(n => n) && jd.babySexes?.every(s => s === 'unknown')) && <span className="text-stone-400 text-xs ml-1">(details unknown)</span>}
                </p>
              )}
              {jd.deliveryNotes && <p className="text-xs text-stone-500 mt-1 italic">{jd.deliveryNotes}</p>}
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              {!jd.delivered && (
                <button onClick={() => {
                  const numBabies = jd.babies || 1
                  setBirthBabies(Array.from({ length: numBabies }, (_, i) => ({
                    name: jd.babyNames?.[i] || '',
                    sex: jd.babySexes?.[i] || 'unknown',
                    weight: jd.babyWeights?.[i] || '',
                    length: jd.babyLengths?.[i] || '',
                  })))
                  setBirthForm({ date: '', deliveryType: '', notes: '' })
                  setBirthOpen(true)
                }} className="text-[10px] text-emerald-600 hover:underline font-medium">
                  Log Birth
                </button>
              )}
              <button onClick={() => {
                const numBabies = jd.babies || 1
                if (jd.delivered) {
                  // Open full birth edit dialog pre-filled
                  setBirthBabies(Array.from({ length: numBabies }, (_, i) => ({
                    name: jd.babyNames?.[i] || '',
                    sex: jd.babySexes?.[i] || 'unknown',
                    weight: jd.babyWeights?.[i] || '',
                    length: jd.babyLengths?.[i] || '',
                  })))
                  setBirthForm({
                    date: jd.deliveryDate || '',
                    deliveryType: jd.deliveryType || '',
                    notes: jd.deliveryNotes || '',
                  })
                  setBirthOpen(true)
                } else {
                  setBabySexes(jd.babySexes || Array(numBabies).fill('unknown'))
                  setBabyNames(jd.babyNames || Array(numBabies).fill(''))
                  setBabySexOpen(true)
                }
              }} className="text-[10px] text-[#283693] hover:underline">
                {jd.delivered ? 'Edit Birth Details' : jd.babySexes?.some(s => s !== 'unknown') ? 'Edit Baby Details' : '+ Add Baby Sex'}
              </button>
              {!jd.delivered && (
                <button onClick={() => setLossOpen(true)} className="text-[10px] text-stone-400 hover:text-red-500 transition-colors">
                  Record Loss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Baby Sex Edit Dialog */}
      <Dialog open={babySexOpen} onOpenChange={setBabySexOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Baby Details</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {Array.from({ length: jd.babies || 1 }, (_, i) => (
              <div key={i} className="space-y-2 pb-3 border-b border-stone-100 last:border-0 last:pb-0">
                {(jd.babies || 1) > 1 && <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Baby {i + 1}</p>}
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">Name</label>
                  <Input value={babyNames[i] || ''} onChange={e => { const n = [...babyNames]; n[i] = e.target.value; setBabyNames(n) }}
                    placeholder="Baby's name" className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">Sex</label>
                  <select value={babySexes[i] || 'unknown'} onChange={e => { const s = [...babySexes]; s[i] = e.target.value; setBabySexes(s) }}
                    className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                    <option value="unknown">Unknown</option>
                    <option value="boy">👦 Boy</option>
                    <option value="girl">👧 Girl</option>
                  </select>
                </div>
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setBabySexOpen(false)}>Cancel</Button>
              <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={async () => {
                setSaving(true)
                const updated = [...transfers]
                const idx = updated.length - 1
                if (idx >= 0) updated[idx] = { ...updated[idx], babySexes: [...babySexes], babyNames: [...babyNames] }
                await onUpdate({ _transfers: updated, babySexes: [...babySexes], babyNames: [...babyNames] })
                setBabySexOpen(false)
                setSaving(false)
              }} disabled={saving}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Timeline */}
      <div className="flex items-center gap-0 mb-4">
        {timelineSteps.map((step, i) => {
          const done = step.done
          const isLast = i === timelineSteps.length - 1
          // Pregnant step color based on baby sex
          const babySex = jd.babySexes?.[0]
          const pregnantBg = babySex === 'girl' ? 'bg-pink-500 border-pink-500' : babySex === 'boy' ? 'bg-blue-500 border-blue-500' : 'bg-green-500 border-green-500'
          const pregnantText = babySex === 'girl' ? 'text-pink-600' : babySex === 'boy' ? 'text-blue-600' : 'text-green-600'
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`size-7 rounded-full border-[3px] flex items-center justify-center transition-all ${done ? step.key === 'delivered' ? 'bg-amber-500 border-amber-500 scale-110' : step.key === 'pregnant' ? `${pregnantBg} scale-110` : 'bg-green-500 border-green-500' : 'bg-white border-stone-200'}`}>
                  {done && (step.key === 'delivered' ? '🎉' : <Check className="size-3.5 text-white" />)}
                </div>
                <p className={`text-[10px] mt-1 text-center font-medium ${done ? step.key === 'delivered' ? 'text-amber-600' : step.key === 'pregnant' ? pregnantText : 'text-green-600' : 'text-stone-400'}`}>{step.label}</p>
              </div>
              {!isLast && <div className={`flex-1 h-[3px] mx-1 mt-[-16px] rounded-full ${done && timelineSteps[i + 1]?.done ? 'bg-green-400' : done ? 'bg-green-200' : 'bg-stone-100'}`} />}
            </div>
          )
        })}
      </div>

      {/* Transfer tabs */}
      {transfers.length > 0 && (
        <div>
          {transfers.length > 1 && (
            <div className="flex gap-1 mb-2 border-b border-stone-100">
              {[...transfers].reverse().map((t, ri) => {
                const i = transfers.length - 1 - ri
                const isClosed = t.lossType || t.unsuccessful || t.betaResult === 'negative' || t.droppedCycle
                return (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${activeTab === i ? 'bg-white border border-b-0 border-stone-200 text-stone-800' : 'text-stone-400 hover:text-stone-600'} ${isClosed ? 'opacity-50' : ''}`}>
                    Transfer #{i + 1}
                  </button>
                )
              })}
            </div>
          )}

          {currentTabTransfer && (() => {
            const t = currentTabTransfer
            const i = currentTabIdx
            const isClosed = t.lossType || t.unsuccessful || t.betaResult === 'negative' || t.droppedCycle
            const isLatest = i === transfers.length - 1
            return (
              <div className={`rounded-lg border p-3 text-sm ${isClosed ? 'border-stone-200 bg-stone-50 opacity-70' : t.heartbeatConfirmed ? 'border-pink-200 bg-pink-50/30' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-700">Transfer #{i + 1}</span>
                    <span className="text-xs text-stone-400">{formatDate(t.date)}</span>
                    <span className="text-[10px] text-stone-400">{t.embryoCount} embryo{t.embryoCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.betaResult === 'positive' && <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Beta + {t.betaValue ? `(${t.betaValue})` : ''}</span>}
                    {t.beta2Result === 'positive' && <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Beta #2 + {t.beta2Value ? `(${t.beta2Value})` : ''}</span>}
                    {t.betaResult === 'negative' && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Beta −</span>}
                    {t.heartbeatConfirmed && <span className="text-[10px] font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full flex items-center gap-0.5"><HeartPulse className="size-2.5" /> {t.babies > 1 ? `${t.babies} babies` : 'Heartbeat'}</span>}
                    {t.unsuccessful && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Unsuccessful</span>}
                    {t.droppedCycle && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Dropped Cycle</span>}
                    {t.lossType && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{t.lossType === 'miscarriage' ? 'Miscarriage' : t.lossType === 'ectopic' ? 'Ectopic' : t.lossType === 'chemical' ? 'Chemical' : 'Loss'}</span>}
                    {/* Edit / Delete */}
                    <button onClick={() => { setEditIdx(i); setTransferForm({ date: t.date, embryoCount: String(t.embryoCount), notes: t.notes || '', droppedCycle: t.droppedCycle || false, betaResult: t.betaResult, betaValue: t.betaValue || '', betaDate: t.betaDate || '', needsSecondBeta: t.needsSecondBeta || false, beta2Result: t.beta2Result || '', beta2Value: t.beta2Value || '', beta2Date: t.beta2Date || '', heartbeatConfirmed: t.heartbeatConfirmed || false, heartbeatDate: t.heartbeatDate || '', babies: String(t.babies || 1) }); setAddOpen(true) }} className="text-stone-300 hover:text-stone-500 transition-colors" title="Edit"><Pencil className="size-3" /></button>
                    <button onClick={() => setDeleteConfirmIdx(i)} className="text-stone-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="size-3" /></button>
                  </div>
                </div>
                {t.notes && <p className="text-xs text-stone-400 mt-1">{t.notes}</p>}
                {t.lossType && <p className="text-xs text-red-400 mt-1">Transfer resulted in {t.lossType === 'miscarriage' ? 'a miscarriage' : t.lossType === 'ectopic' ? 'an ectopic pregnancy' : t.lossType === 'chemical' ? 'a chemical pregnancy' : 'a loss'} ({formatDate(t.lossDate)})</p>}
                {t.unsuccessful && <p className="text-xs text-red-400 mt-1">Transfer was unsuccessful</p>}
                {t.droppedCycle && <p className="text-xs text-amber-500 mt-1">Cycle was dropped</p>}

                {/* Actions for latest active transfer */}
                {isLatest && !isClosed && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!t.betaResult && (
                      <>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => { setBetaOpen(i); setBetaValue(''); setNeedsSecondBeta(null) }}>Log Beta Results</Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-red-500 hover:bg-red-50" onClick={async () => { setSaving(true); const u = [...transfers]; u[i] = { ...u[i], unsuccessful: true }; await onUpdate({ _transfers: u }); setSaving(false) }}>Mark Unsuccessful</Button>
                      </>
                    )}
                    {t.betaResult === 'positive' && t.needsSecondBeta && !t.beta2Result && (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => { setBeta2Open(i); setBeta2Value('') }}>Log Beta #2 Results</Button>
                    )}
                    {betaComplete && !t.heartbeatConfirmed && (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-pink-200 text-pink-600 hover:bg-pink-50" onClick={() => setHeartbeatOpen(true)}>
                        <HeartPulse className="size-3" /> Confirm Heartbeat
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Add/Edit Transfer Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editIdx !== null ? 'Edit Transfer' : 'Log Embryo Transfer'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Transfer Date *</label>
                <Input type="date" value={transferForm.date} onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Embryos Transferred</label>
                <select value={transferForm.embryoCount} onChange={e => setTransferForm(f => ({ ...f, embryoCount: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Notes</label>
              <Input value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} placeholder="Clinic, doctor, embryo details..." className="h-9" />
            </div>
            {editIdx !== null && (
              <div className="space-y-3 border-t border-stone-100 pt-3">
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-stone-400 font-medium">Dropped Cycle</label>
                  <button onClick={() => setTransferForm(f => ({ ...f, droppedCycle: !f.droppedCycle }))}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${transferForm.droppedCycle ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                    {transferForm.droppedCycle ? 'Yes' : 'No'}
                  </button>
                </div>
                {!transferForm.droppedCycle && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-400 font-medium">Beta Result</label>
                        <select value={transferForm.betaResult || ''} onChange={e => setTransferForm(f => ({ ...f, betaResult: e.target.value || null }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                          <option value="">Not yet</option>
                          <option value="positive">Positive</option>
                          <option value="negative">Negative</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-400 font-medium">Beta Value</label>
                        <Input value={transferForm.betaValue} onChange={e => setTransferForm(f => ({ ...f, betaValue: e.target.value }))} placeholder="e.g. 250" className="h-9" />
                      </div>
                    </div>
                    {transferForm.betaResult === 'positive' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-stone-400 font-medium">Beta #2 Result</label>
                            <select value={transferForm.beta2Result || ''} onChange={e => setTransferForm(f => ({ ...f, beta2Result: e.target.value || null }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                              <option value="">N/A</option>
                              <option value="positive">Positive</option>
                              <option value="negative">Negative</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-stone-400 font-medium">Beta #2 Value</label>
                            <Input value={transferForm.beta2Value} onChange={e => setTransferForm(f => ({ ...f, beta2Value: e.target.value }))} placeholder="e.g. 580" className="h-9" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-stone-400 font-medium">Heartbeat Date</label>
                            <Input type="date" value={transferForm.heartbeatDate} onChange={e => setTransferForm(f => ({ ...f, heartbeatDate: e.target.value, heartbeatConfirmed: !!e.target.value }))} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-stone-400 font-medium">Babies</label>
                            <select value={transferForm.babies} onChange={e => setTransferForm(f => ({ ...f, babies: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setEditIdx(null) }}>Cancel</Button>
              <Button size="sm" disabled={saving || !transferForm.date} style={{ backgroundColor: '#283693' }} className="gap-1" onClick={editIdx !== null ? handleEditTransfer : handleAddTransfer}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : editIdx !== null ? <Save className="size-3" /> : <Plus className="size-3" />}
                {editIdx !== null ? 'Save Changes' : 'Log Transfer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Beta Results Dialog */}
      <Dialog open={betaOpen !== null} onOpenChange={() => setBetaOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Beta HCG Results</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Beta Value</label>
              <Input value={betaValue} onChange={e => setBetaValue(e.target.value)} placeholder="e.g. 250" className="h-9" type="number" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Will there be a second beta test? *</label>
              <div className="flex gap-2">
                <button onClick={() => setNeedsSecondBeta(true)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${needsSecondBeta === true ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-stone-100 text-stone-500'}`}>
                  Yes
                </button>
                <button onClick={() => setNeedsSecondBeta(false)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${needsSecondBeta === false ? 'bg-stone-200 text-stone-700 ring-2 ring-stone-300' : 'bg-stone-100 text-stone-500'}`}>
                  No
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white" size="sm" disabled={saving || needsSecondBeta === null} onClick={() => handleBetaResult(betaOpen, 'positive')}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Positive
              </Button>
              <Button className="flex-1 gap-1" variant="outline" size="sm" disabled={saving} onClick={() => handleBetaResult(betaOpen, 'negative')}>
                <X className="size-3" /> Negative
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Beta #2 Results Dialog */}
      <Dialog open={beta2Open !== null} onOpenChange={() => setBeta2Open(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Beta HCG #2 Results</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Beta #2 Value</label>
              <Input value={beta2Value} onChange={e => setBeta2Value(e.target.value)} placeholder="e.g. 580" className="h-9" type="number" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white" size="sm" disabled={saving} onClick={() => handleBeta2Result(beta2Open, 'positive')}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Positive
              </Button>
              <Button className="flex-1 gap-1" variant="outline" size="sm" disabled={saving} onClick={() => handleBeta2Result(beta2Open, 'negative')}>
                <X className="size-3" /> Negative
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Heartbeat Confirmation Dialog */}
      <Dialog open={heartbeatOpen} onOpenChange={setHeartbeatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><HeartPulse className="size-5 text-pink-500" /> Confirm Heartbeat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-pink-50 border border-pink-200 p-3">
              <p className="text-sm text-pink-800">Confirming a heartbeat will mark this journey as <strong>pregnant</strong>.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Heartbeat Date *</label>
                <Input type="date" value={heartbeatDate} onChange={e => setHeartbeatDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Number of Babies</label>
                <select value={heartbeatBabies} onChange={e => setHeartbeatBabies(e.target.value)} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            {/* Baby sex — optional */}
            <div className="space-y-2">
              <label className="text-[11px] text-stone-400 font-medium">Baby Sex (optional — can update later)</label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: parseInt(heartbeatBabies) || 1 }, (_, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {parseInt(heartbeatBabies) > 1 && <span className="text-[10px] text-stone-400">Baby {i + 1}:</span>}
                    <select value={babySexes[i] || 'unknown'} onChange={e => { const s = [...babySexes]; s[i] = e.target.value; setBabySexes(s) }}
                      className="h-8 text-xs border border-stone-200 rounded-md px-2 bg-white">
                      <option value="unknown">Unknown</option>
                      <option value="boy">👦 Boy</option>
                      <option value="girl">👧 Girl</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
            {latestTransfer && (
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-2">
                <p className="text-xs text-stone-500">
                  Calculated due date (5-day embryo): <strong className="text-pink-600">{formatDate(new Date(new Date(latestTransfer.date).getTime() + TRANSFER_CALC_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0])}</strong>
                </p>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">Override due date (optional)</label>
                  <Input type="date" value={heartbeatDueDate} onChange={e => setHeartbeatDueDate(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setHeartbeatOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={saving || !heartbeatDate} className="gap-1 bg-pink-600 hover:bg-pink-700 text-white" onClick={handleHeartbeat}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <HeartPulse className="size-3" />}
                Confirm Heartbeat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pregnancy Loss Dialog */}
      <Dialog open={lossOpen} onOpenChange={setLossOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Record Pregnancy Loss</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">This will clear the pregnancy status for this journey.</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Type *</label>
              <select value={lossReason} onChange={e => setLossReason(e.target.value)} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                <option value="">Select...</option>
                <option value="miscarriage">Miscarriage</option>
                <option value="ectopic">Ectopic Pregnancy</option>
                <option value="chemical">Chemical Pregnancy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setLossOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={saving || !lossReason} variant="destructive" className="gap-1" onClick={handlePregnancyLoss}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                Record Loss
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Birth Dialog */}
      <Dialog open={birthOpen} onOpenChange={setBirthOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-700">{jd.delivered ? '✏️ Edit Birth Details' : '🎉 Log Birth'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Delivery Date *</label>
                <input type="date" value={birthForm.date} onChange={e => setBirthForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Delivery Type</label>
                <select value={birthForm.deliveryType} onChange={e => setBirthForm(f => ({ ...f, deliveryType: e.target.value }))}
                  className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                  <option value="">Select...</option>
                  <option value="Vaginal">Vaginal</option>
                  <option value="C-Section">C-Section</option>
                  <option value="C-Section (Scheduled)">C-Section (Scheduled)</option>
                  <option value="C-Section (Emergency)">C-Section (Emergency)</option>
                  <option value="VBAC">VBAC</option>
                </select>
              </div>
            </div>

            {/* Per-baby details */}
            {birthBabies.map((baby, i) => (
              <div key={i} className="rounded-lg border border-stone-200 p-3 space-y-3">
                <p className="text-xs font-semibold text-stone-500 uppercase">Baby {birthBabies.length > 1 ? i + 1 : ''}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-stone-400 font-medium">Name</label>
                    <input value={baby.name} onChange={e => { const u = [...birthBabies]; u[i] = { ...u[i], name: e.target.value }; setBirthBabies(u) }}
                      className="w-full h-9 text-sm border border-stone-200 rounded-md px-2" placeholder="Baby's name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-stone-400 font-medium">Sex</label>
                    <select value={baby.sex} onChange={e => { const u = [...birthBabies]; u[i] = { ...u[i], sex: e.target.value }; setBirthBabies(u) }}
                      className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                      <option value="unknown">Unknown</option>
                      <option value="boy">Boy</option>
                      <option value="girl">Girl</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-stone-400 font-medium">Weight (lbs oz)</label>
                    <input value={baby.weight} onChange={e => { const u = [...birthBabies]; u[i] = { ...u[i], weight: e.target.value }; setBirthBabies(u) }}
                      className="w-full h-9 text-sm border border-stone-200 rounded-md px-2" placeholder="e.g. 7 lbs 4 oz" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-stone-400 font-medium">Length (inches)</label>
                    <input value={baby.length} onChange={e => { const u = [...birthBabies]; u[i] = { ...u[i], length: e.target.value }; setBirthBabies(u) }}
                      className="w-full h-9 text-sm border border-stone-200 rounded-md px-2" placeholder="e.g. 20.5" />
                  </div>
                </div>
              </div>
            ))}

            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Post-Delivery Notes / Complications</label>
              <textarea value={birthForm.notes} onChange={e => setBirthForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full h-20 text-sm border border-stone-200 rounded-md px-2 py-1.5 resize-none" placeholder="Any complications or notes..." />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setBirthOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={saving || !birthForm.date} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleLogBirth}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : jd.delivered ? '✓' : '🎉'}
                {jd.delivered ? 'Save Changes' : 'Log Birth'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Transfer Confirmation */}
      <Dialog open={deleteConfirmIdx !== null} onOpenChange={() => setDeleteConfirmIdx(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Delete Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p>Are you sure you want to delete <strong>Transfer #{deleteConfirmIdx !== null ? deleteConfirmIdx + 1 : ''}</strong>? This cannot be undone.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmIdx(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" className="gap-1" disabled={saving} onClick={async () => { await handleDeleteTransfer(deleteConfirmIdx); setDeleteConfirmIdx(null) }}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Delete Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Expenses Tab ────────────────────────────────────────
function JourneyExpensesTab({ journeyId, gcCaseId }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [newExpense, setNewExpense] = useState({ expense_date: '', amount: '', paid_to: '', notes: '' })
  const [tabExpenseFile, setTabExpenseFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const { currentUser } = useRole()

  useEffect(() => {
    fetchJourneyExpenses(journeyId).then(data => {
      setExpenses(data || [])
      setLoading(false)
    })
  }, [journeyId])

  async function handleAdd() {
    if (!newExpense.amount) return
    setSaving(true)
    try {
      let attachmentUrl = null
      if (tabExpenseFile) {
        const doc = await uploadCaseDocument({ surrogateId: gcCaseId, category: 'Expenses', file: tabExpenseFile, uploadedBy: currentUser?.name || 'Admin' })
        attachmentUrl = doc?.public_url || null
      }
      const created = await insertExpense({
        journey_id: journeyId,
        expense_date: newExpense.expense_date || new Date().toISOString().split('T')[0],
        amount: parseFloat(newExpense.amount) || 0,
        paid_to: newExpense.paid_to || null,
        cc_last4: newExpense.cc_last4 || null,
        submitted_to_escrow: newExpense.submitted_to_escrow || false,
        notes: newExpense.notes || null,
        attachment_url: attachmentUrl,
        created_by: currentUser?.email || '',
      })
      if (created) setExpenses(prev => [created, ...prev])
      setNewExpense({ expense_date: '', amount: '', paid_to: '', notes: '', cc_last4: '', submitted_to_escrow: false })
      setTabExpenseFile(null)
      setAddOpen(false)
    } catch (err) {
      console.error('Failed to add expense:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id, field, value) {
    const updated = await updateExpense(id, { [field]: value })
    if (updated) setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return
    try {
      await deleteExpense(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      console.error('Failed to delete expense:', err)
    }
  }

  const fmtCurrency = (val) => {
    if (!val && val !== 0) return '—'
    return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Expenses</h3>
        <Button size="sm" className="gap-1 text-xs" style={{ backgroundColor: '#283693' }} onClick={() => setAddOpen(true)}>
          <Plus className="size-3" /> Add Expense
        </Button>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Date *</label>
                <Input type="date" value={newExpense.expense_date} onChange={e => setNewExpense(p => ({ ...p, expense_date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Amount *</label>
                <Input value={newExpense.amount} onChange={e => { const digits = e.target.value.replace(/[^\d]/g, ''); const cents = parseInt(digits || '0', 10); setNewExpense(p => ({ ...p, amount: (cents / 100).toFixed(2) })) }} placeholder="0.00" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Paid To</label>
                <Input value={newExpense.paid_to} onChange={e => setNewExpense(p => ({ ...p, paid_to: e.target.value }))} placeholder="Vendor or recipient" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">CC Last 4</label>
                <Input value={newExpense.cc_last4 || ''} onChange={e => setNewExpense(p => ({ ...p, cc_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="1234" maxLength={4} className="h-9" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-stone-400 font-medium">Submitted to Escrow</label>
              <button onClick={() => setNewExpense(p => ({ ...p, submitted_to_escrow: !p.submitted_to_escrow }))}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${newExpense.submitted_to_escrow ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                {newExpense.submitted_to_escrow ? 'Yes' : 'No'}
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Notes</label>
              <Input value={newExpense.notes} onChange={e => setNewExpense(p => ({ ...p, notes: e.target.value }))} placeholder="Description or details" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Attachment</label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setTabExpenseFile(e.target.files?.[0] || null)} className="h-9 text-xs" />
              {tabExpenseFile && <p className="text-[10px] text-stone-400">{tabExpenseFile.name} ({(tabExpenseFile.size / 1024).toFixed(0)}KB)</p>}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setTabExpenseFile(null) }}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={saving || !newExpense.amount} style={{ backgroundColor: '#283693' }} className="gap-1">
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                {saving ? 'Adding...' : 'Add Expense'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Attachment Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)
              ? <img src={previewUrl} alt="Expense attachment" className="w-full rounded-lg" />
              : <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border" title="Attachment" />
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-stone-400 py-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading expenses...
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <DollarSign className="size-8 mx-auto mb-2 text-stone-300" />
          <p className="text-sm">No expenses recorded yet.</p>
          <p className="text-xs mt-1">Click "+ Add Expense" to get started.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Paid To</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">CC Last 4</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Escrow</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Notes</th>
                    <th className="text-center px-3 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Doc</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <ExpenseRow key={exp.id} exp={exp} onUpdate={handleUpdate} onDelete={handleDelete} fmtCurrency={fmtCurrency} onPreview={setPreviewUrl} gcCaseId={gcCaseId} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
    <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500">
      <Scale className="size-3.5 text-stone-400" />
      <button onClick={startEdit} className="font-semibold text-stone-700 hover:text-[#283693] hover:underline cursor-pointer">{name}</button>
      {firm && <><span className="text-stone-300">·</span> <span className="font-medium">{firm}</span></>}
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

// ── Profiles Tab (isolated to prevent crashes) ─────────
class ProfileErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(err) { console.error('Profile tab crashed:', err) }
  render() {
    if (this.state.hasError) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">Something went wrong loading the profile. <button className="underline ml-1" onClick={() => this.setState({ hasError: false, error: null })}>Try again</button></div>
    return this.props.children
  }
}

function ProfilesTabContent({ profileView, gcCase, setGcCase, gcProfileData, setGcProfileData, gcProfileStatus, setGcProfileStatus, gcPhotos, setGcPhotos, gcPortraitUrl, gcQuizAnswers, setGcQuizAnswers, ipCase, setIpCase }) {
  const heightStr = gcCase ? `${gcCase.heightFt || ''}\'${gcCase.heightIn || ''}"` : ''
  if (profileView === 'gc') {
    if (!gcCase) return <EmptyState title="No surrogate data" />
    return <ProfileErrorBoundary key="gc"><GCProfileTab
      surrogate={gcCase} setSurrogate={setGcCase}
      profileData={gcProfileData || {}} setProfileData={setGcProfileData}
      profileStatus={gcProfileStatus} setProfileStatus={setGcProfileStatus}
      photos={gcPhotos} setPhotos={setGcPhotos}
      portraitUrl={gcPortraitUrl} heightStr={heightStr}
      quizAnswers={gcQuizAnswers} setQuizAnswers={setGcQuizAnswers}
    /></ProfileErrorBoundary>
  }
  if (!ipCase) return <EmptyState title="No IP profile data" />
  return <ProfileErrorBoundary key="ip"><IPProfileTab ip={ipCase} onUpdate={async (updates) => {
    try {
      const { updateIntakeSubmission } = await import('@/lib/db')
      await updateIntakeSubmission(ipCase.id, updates)
      setIpCase(prev => ({ ...prev, ...updates }))
    } catch {}
  }} /></ProfileErrorBoundary>
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
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const { fire: fireConfetti, ref: confettiRef } = useConfetti()
  const [newExpense, setNewExpense] = useState({ expense_date: '', amount: '', paid_to: '', notes: '' })
  const [expenseFile, setExpenseFile] = useState(null)
  const [savingExpense, setSavingExpense] = useState(false)
  const [gcFlip, setGcFlip] = useState({})
  const [gcInsurance, setGcInsurance] = useState(null)
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [gcQuizAnswers, setGcQuizAnswers] = useState(null)
  const [gcProfileData, setGcProfileData] = useState(null)
  const [gcProfileStatus, setGcProfileStatus] = useState('draft')
  const [gcPhotos, setGcPhotos] = useState([])
  const [gcPortraitUrl, setGcPortraitUrl] = useState(null)
  const [appView, setAppView] = useState('gc') // gc | ip
  const [providerEdit, setProviderEdit] = useState(null) // 'ivf' | 'ob' | 'hospital' | null
  const [providerForm, setProviderForm] = useState({})
  const [ipFlip, setIpFlip] = useState({})
  const [emailConfirm, setEmailConfirm] = useState(null) // { name, email, caseId, party: 'gc'|'ip' }
  const [smsConfirm, setSmsConfirm] = useState(null) // { phone, name, party: 'gc'|'ip' }
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

  function openProviderEdit(type) {
    const base = { street: '', city: '', state: '', zip: '', website: '' }
    if (type === 'hospital') {
      setProviderForm({ ...base, name: jd.deliveryHospital || '', phone: jd.deliveryHospitalPhone || '', street: jd.deliveryHospitalStreet || '', city: jd.deliveryHospitalCity || '', state: jd.deliveryHospitalState || '', zip: jd.deliveryHospitalZip || '', website: jd.deliveryHospitalWebsite || '' })
    } else if (type === 'ob') {
      setProviderForm({ ...base, name: jd.obClinic || '', doctor: jd.obDoctor || '', phone: jd.obPhone || '', street: jd.obStreet || '', city: jd.obCity || '', state: jd.obState || '', zip: jd.obZip || '', website: jd.obWebsite || '' })
    } else {
      setProviderForm({ ...base, name: jd.ivfClinic || '', doctor: jd.ivfDoctor || '', street: jd.ivfStreet || '', city: jd.ivfCity || '', state: jd.ivfState || '', zip: jd.ivfZip || '', website: jd.ivfWebsite || '', coordinator: jd.ivfCoordinator || '', coordinatorEmail: jd.ivfCoordinatorEmail || '' })
    }
    setProviderEdit(type)
  }

  async function saveProvider() {
    const f = providerForm
    const fields = {}
    if (providerEdit === 'ivf') {
      Object.assign(fields, { ivfClinic: f.name, ivfDoctor: f.doctor, ivfStreet: f.street, ivfCity: f.city, ivfState: f.state, ivfZip: f.zip, ivfWebsite: f.website, ivfCoordinator: f.coordinator, ivfCoordinatorEmail: f.coordinatorEmail })
    } else if (providerEdit === 'ob') {
      Object.assign(fields, { obClinic: f.name, obDoctor: f.doctor, obPhone: f.phone, obStreet: f.street, obCity: f.city, obState: f.state, obZip: f.zip, obWebsite: f.website })
    } else {
      Object.assign(fields, { deliveryHospital: f.name, deliveryHospitalPhone: f.phone, deliveryHospitalStreet: f.street, deliveryHospitalCity: f.city, deliveryHospitalState: f.state, deliveryHospitalZip: f.zip, deliveryHospitalWebsite: f.website })
    }
    await updateFields(fields)
    setProviderEdit(null)
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
        // Load GC quiz answers + profile + photos for Application/Profile tabs
        const gc = gcs.find(g => g.id === j.gc_case_id)
        if (gc?.email) {
          fetchIntakeByEmail(gc.email).then(d => { if (d) setGcQuizAnswers(d.answers || {}) }).catch(() => {})
          fetchSurrogateProfileByEmail(gc.email).then(d => {
            if (d?.profile_data) setGcProfileData(d.profile_data)
            if (d?.status) setGcProfileStatus(d.status)
          }).catch(() => {})
        }
        if (gc?.userId) {
          Promise.all([
            listProfilePhotos(gc.userId).catch(() => []),
            listProfilePhotos(`${gc.userId}/portrait`).catch(() => []),
          ]).then(([gallery, portraits]) => setGcPhotos([...portraits, ...gallery]))
          getPortraitPhotoUrl(gc.userId).then(url => { if (url) setGcPortraitUrl(url) }).catch(() => {})
        }
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
    // Snapshot current checklist before changing stage
    const currentTracking = journey.journey_data?._checklistTracking || {}
    const currentStage = journey.stage || 'journey-oversight'
    const currentStageObj = JOURNEY_STAGES.find(s => s.id === currentStage)
    const hasTracking = Object.keys(currentTracking).length > 0

    let journeyDataUpdates = {}
    if (hasTracking) {
      const snapshot = {
        stageId: currentStage,
        stageLabel: currentStageObj?.label || currentStage,
        completedAt: new Date().toISOString(),
        tracking: { ...currentTracking },
      }
      const history = [...(journey.journey_data?._checklistHistory || []), snapshot]
      journeyDataUpdates = { _checklistHistory: history, _checklistTracking: {} }
    }

    const jd = { ...(journey.journey_data || {}), ...journeyDataUpdates }
    const status = getStatusesForStage(stageId, 'journey')[0] || 'Legal Review'
    const updated = await updateMatchedJourney(journey.id, { stage: stageId, status, journey_data: jd }).catch(() => null)
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
        gcName: gcCase?.name,
        ipName: ipCase?.names,
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
      <Link to="/journeys" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to Journeys</Link>

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

      {/* Add Expense Dialog (hero-level) */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Date *</label>
                <Input type="date" value={newExpense.expense_date} onChange={e => setNewExpense(p => ({ ...p, expense_date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Amount *</label>
                <Input value={newExpense.amount} onChange={e => { const digits = e.target.value.replace(/[^\d]/g, ''); const cents = parseInt(digits || '0', 10); setNewExpense(p => ({ ...p, amount: (cents / 100).toFixed(2) })) }} placeholder="0.00" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Paid To</label>
                <Input value={newExpense.paid_to} onChange={e => setNewExpense(p => ({ ...p, paid_to: e.target.value }))} placeholder="Vendor or recipient" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">CC Last 4</label>
                <Input value={newExpense.cc_last4 || ''} onChange={e => setNewExpense(p => ({ ...p, cc_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="1234" maxLength={4} className="h-9" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-stone-400 font-medium">Submitted to Escrow</label>
              <button onClick={() => setNewExpense(p => ({ ...p, submitted_to_escrow: !p.submitted_to_escrow }))}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${newExpense.submitted_to_escrow ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                {newExpense.submitted_to_escrow ? 'Yes' : 'No'}
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Notes</label>
              <Input value={newExpense.notes} onChange={e => setNewExpense(p => ({ ...p, notes: e.target.value }))} placeholder="Description or details" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Attachment</label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setExpenseFile(e.target.files?.[0] || null)} className="h-9 text-xs" />
              {expenseFile && <p className="text-[10px] text-stone-400">{expenseFile.name} ({(expenseFile.size / 1024).toFixed(0)}KB)</p>}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => { setExpenseOpen(false); setExpenseFile(null) }}>Cancel</Button>
              <Button size="sm" disabled={savingExpense || !newExpense.amount} style={{ backgroundColor: '#283693' }} className="gap-1" onClick={async () => {
                setSavingExpense(true)
                try {
                  let attachmentUrl = null
                  if (expenseFile) {
                    const doc = await uploadCaseDocument({ surrogateId: journey.gc_case_id, category: 'Expenses', file: expenseFile, uploadedBy: currentUser?.name || 'Admin' })
                    attachmentUrl = doc?.public_url || null
                  }
                  await insertExpense({
                    journey_id: journey.id,
                    expense_date: newExpense.expense_date || new Date().toISOString().split('T')[0],
                    amount: parseFloat(newExpense.amount) || 0,
                    paid_to: newExpense.paid_to || null,
                    cc_last4: newExpense.cc_last4 || null,
                    submitted_to_escrow: newExpense.submitted_to_escrow || false,
                    notes: newExpense.notes || null,
                    attachment_url: attachmentUrl,
                    created_by: currentUser?.email || '',
                  })
                  setNewExpense({ expense_date: '', amount: '', paid_to: '', notes: '', cc_last4: '', submitted_to_escrow: false })
                  setExpenseFile(null)
                  setExpenseOpen(false)
                } catch (err) {
                  console.error('Failed to add expense:', err)
                } finally {
                  setSavingExpense(false)
                }
              }}>
                {savingExpense ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                {savingExpense ? 'Adding...' : 'Add Expense'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Hero: Journey left, GC/IP stacked right ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Journey Info Card (white, 3 of 5 cols) */}
        <div className={`lg:col-span-3 rounded-2xl border-2 overflow-hidden bg-white ${(journey.journey_data?.pregnant === 'yes') ? 'border-pink-400 shadow-pink-100 shadow-lg' : 'border-stone-200/80'}`}>
          <div className="p-6 space-y-5">

            {/* Top row: Stage + Status pill | Match date + Break Match */}
            <div className="flex items-start justify-between">
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
                <AISummaryButton caseId={journey.id} caseName={journey.label || `${journey.gc_name} & ${journey.ip_name}`} caseType="journey" stage={stageObj.label} status={journey.status} journeyData={jd} />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-stone-400">Matched {fmtDate(journey.created_at)}</span>
                <Button variant="outline" size="sm" className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => setBreakOpen(true)}>
                  <X className="size-3" /> Break Match
                </Button>
              </div>
            </div>

            {/* Key info row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-stone-500">Lost Wages: <button onClick={() => updateField('lostWages', jd.lostWages === 'yes' ? 'no' : 'yes')} className="font-bold text-stone-800 hover:underline cursor-pointer">{jd.lostWages === 'yes' ? 'Yes' : jd.lostWages === 'no' ? 'No' : '—'}</button></span>
              <span className="text-stone-500">Pumping: <button onClick={() => updateField('pumping', jd.pumping === 'yes' ? 'no' : 'yes')} className="font-bold text-stone-800 hover:underline cursor-pointer">{jd.pumping === 'yes' ? 'Yes' : jd.pumping === 'no' ? 'No' : '—'}</button></span>
              {gcInsurance && (() => {
                const st = gcInsurance.insurance_status
                const isVerified = gcInsurance.has_insurance && gcInsurance.status === 'active' && (st === 'active_policy' || st === 'verified_open_enrollment' || st === 'complete')
                const isChecking = gcInsurance.has_insurance && st === 'policy_check'
                const isApplying = st === 'open_enrollment'
                const isNotFriendly = st === 'complete_not_friendly'
                if (isVerified) return (
                  <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium">
                    <InsuranceCardIcon size={15} color="currentColor" /> {gcInsurance.company || 'Verified'}
                  </button>
                )
                if (isChecking) return (
                  <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1.5 text-yellow-500 hover:text-yellow-600 cursor-pointer font-medium">
                    <InsuranceCardIcon size={15} color="currentColor" /> {gcInsurance.company || 'Checking'}
                  </button>
                )
                if (isApplying) return (
                  <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1.5 text-amber-500 hover:text-amber-600 cursor-pointer font-medium">
                    <InsuranceCardIcon size={15} color="currentColor" /> Applying
                  </button>
                )
                if (isNotFriendly) return (
                  <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1.5 text-red-500 hover:text-red-600 cursor-pointer font-medium">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5"/></svg>
                    Not Surrogacy Friendly
                  </button>
                )
                return null
              })()}
            </div>

            {/* ── Escrow ── */}
            <div className="border-t border-stone-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Escrow</p>
                <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setExpenseOpen(true)}>
                  <Plus className="size-3" /> Add Expense
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-stone-500">Min: <EditableTileInline value={jd.escrowMin} onSave={v => updateField('escrowMin', v)} type="currency" className="text-stone-800" /></span>
                <span className="text-stone-500">
                  Balance: <EditableTileInline value={jd.escrowBalance} onSave={v => updateFields({ escrowBalance: v, escrowBalanceUpdatedAt: new Date().toISOString() })} type="currency"
                  className={jd.escrowBalance && jd.escrowMin ? (parseCurrency(jd.escrowBalance) >= parseCurrency(jd.escrowMin) ? 'text-emerald-600' : 'text-red-600') : 'text-stone-800'} />
                  {jd.escrowBalanceUpdatedAt && <span className="text-[10px] text-stone-400 ml-1">({formatDate(jd.escrowBalanceUpdatedAt)})</span>}
                </span>
                <span className="text-stone-500 flex items-center gap-1.5">Escrow Close Date: <EditableTileInline value={jd.escrowClosingDate} onSave={v => updateField('escrowClosingDate', v)} type="date" placeholder="Set date" className="text-stone-800" /></span>
              </div>
            </div>

            {/* ── Pregnancy Tracker ── */}
            <PregnancyTracker
              journey={journey}
              onUpdate={async (fields) => { await updateFields(fields) }}
              onStatusChange={async (status) => {
                const updated = await updateMatchedJourney(journey.id, { status }).catch(() => null)
                if (updated) setJourney(updated)
              }}
              onPregnancyConfirmed={() => {
                setShowConfetti(true)
                setTimeout(() => fireConfetti({
                  particleCount: 260,
                  spread: 360,
                  startVelocity: 55,
                  gravity: 0.25,
                  decay: 0.94,
                  lifetime: 160,
                  scalar: 14,
                  iconScalar: 38,
                  iconRate: 0.2,
                  colors: ['#FFB3AB', '#464DA0', '#FDE047', '#F97316', '#EC4899', '#10B981', '#38BDF8'],
                  origin: { x: 0.5, y: 0.45 },
                }), 500)
              }}
            />

            {/* ── Providers (clickable to edit via modal) ── */}
            <div className="border-t border-stone-100 pt-4">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-3">Providers</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Fertility Clinic */}
                <button onClick={() => openProviderEdit('ivf')} className="text-left rounded-xl border border-stone-100 p-3 hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1"><EmbryoIcon size={12} color="#a8a29e" /> Fertility Clinic</p>
                  <p className="text-sm font-semibold text-stone-800 truncate">{jd.ivfClinic || <span className="text-stone-300 font-normal">+ Add clinic</span>}</p>
                  {jd.ivfDoctor && <p className="text-xs text-stone-500">Dr. {jd.ivfDoctor}</p>}
                  {jd.ivfCoordinator && <p className="text-xs text-stone-500">{jd.ivfCoordinator}</p>}
                  {jd.ivfCity && <p className="text-[11px] text-stone-400">{[jd.ivfCity, jd.ivfState].filter(Boolean).join(', ')}</p>}
                </button>
                {/* OB Clinic */}
                <button onClick={() => openProviderEdit('ob')} className="text-left rounded-xl border border-stone-100 p-3 hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1"><Stethoscope className="size-3" /> OB Clinic</p>
                  <p className="text-sm font-semibold text-stone-800 truncate">{jd.obClinic || <span className="text-stone-300 font-normal">+ Add clinic</span>}</p>
                  {jd.obDoctor && <p className="text-xs text-stone-500">Dr. {jd.obDoctor}</p>}
                  {jd.obPhone && <p className="text-xs text-stone-500">{jd.obPhone}</p>}
                  {jd.obCity && <p className="text-[11px] text-stone-400">{[jd.obCity, jd.obState].filter(Boolean).join(', ')}</p>}
                </button>
                {/* Hospital */}
                <button onClick={() => openProviderEdit('hospital')} className="text-left rounded-xl border border-stone-100 p-3 hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1"><Hospital className="size-3" /> Delivery Hospital</p>
                  <p className="text-sm font-semibold text-stone-800 truncate">{jd.deliveryHospital || <span className="text-stone-300 font-normal">+ Add hospital</span>}</p>
                  {jd.deliveryHospitalPhone && <p className="text-xs text-stone-500">{jd.deliveryHospitalPhone}</p>}
                  {jd.deliveryHospitalCity && <p className="text-[11px] text-stone-400">{[jd.deliveryHospitalCity, jd.deliveryHospitalState].filter(Boolean).join(', ')}</p>}
                </button>
              </div>
            </div>

            {/* Managers — bottom */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm pt-2 border-t border-stone-100">
              <div className="flex items-center gap-1.5">
                <UserCog className="size-4 text-stone-400" />
                <span className="text-stone-500">Case Manager:</span>
                <SelectUI value={journey.assigned_to || '_unassigned'} onValueChange={async val => {
                  const updated = await updateMatchedJourney(journey.id, { assigned_to: val === '_unassigned' ? null : val }).catch(() => null)
                  if (updated) setJourney(updated)
                }}>
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]"><SelectValueUI /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {getAdminStaff().map(a => <SelectItemUI key={a.email} value={a.email}>{a.name}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
              </div>
              <div className="flex items-center gap-1.5">
                <Crown className="size-4 text-amber-500" />
                <span className="text-stone-500">Journey Manager:</span>
                <SelectUI value={jd.journeyManager || '_unassigned'} onValueChange={async val => {
                  updateField('journeyManager', val === '_unassigned' ? '' : val)
                }}>
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]"><SelectValueUI /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {getAdminStaff().map(a => <SelectItemUI key={a.email} value={a.name}>{a.name}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>
          </div>
        </div>

        {/* GC + IP stacked (2 of 5 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">

        {/* GC Card (pink tint) */}
        <div className="rounded-2xl border border-stone-200/80 overflow-hidden flex-1" style={{ backgroundColor: '#fef9fb' }}>
          <div className="p-5 space-y-3">
            {gcCase ? (() => {
              const gcA = gcCase.answers || {}
              const gcPartner = gcA.partnerName || gcA.spouseFullName || ''
              const gcAddr = [gcA.street, gcA.city, gcA.state, gcA.zipCode].filter(Boolean).join(', ') || gcCase.location || '—'
              return (<>
                {/* Header: label + contact buttons */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-pink-400 uppercase tracking-widest">Surrogate</p>
                  <div className="flex gap-1.5">
                    {gcCase.phone && (
                      <Button variant={gcCase.preferredContact === 'Text' ? 'default' : 'outline'} size="sm"
                        className={`gap-1 rounded-full text-xs h-7 px-2.5 ${gcCase.preferredContact === 'Text' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                        onClick={() => setSmsConfirm({ phone: gcCase.phone, name: gcCase.name, party: 'gc' })}>
                        <MessageSquare className="size-3" /> Text
                      </Button>
                    )}
                    <Button variant={gcCase.preferredContact === 'Email' ? 'default' : 'outline'} size="sm"
                      className={`gap-1 rounded-full text-xs h-7 px-2.5 ${gcCase.preferredContact === 'Email' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                      onClick={() => setEmailConfirm({ name: gcCase.name, email: gcCase.email, caseId: journey.id, party: 'gc' })}>
                      <Mail className="size-3" /> Email
                    </Button>
                    {gcCase.phone && (
                      <Button variant={gcCase.preferredContact === 'Phone' ? 'default' : 'outline'} size="sm"
                        className={`gap-1 rounded-full text-xs h-7 px-2.5 ${gcCase.preferredContact === 'Phone' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                        onClick={() => toggleGcFlip('phone')}>
                        <Phone className="size-3" /> Call
                      </Button>
                    )}
                  </div>
                </div>
                {gcFlip.phone && gcCase.phone && (
                  <div className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Phone className="size-3" /> {gcCase.phone}
                    <button onClick={() => { navigator.clipboard.writeText(gcCase.phone) }} className="text-stone-400 hover:text-stone-600"><Copy className="size-3" /></button>
                  </div>
                )}
                {/* Name + info */}
                <div className="flex items-center gap-3">
                  <ProfileAvatar name={gcCase.name} size="md" className="ring-2 ring-white shadow" />
                  <div className="min-w-0">
                    <span className="text-base font-heading font-bold text-stone-900 block truncate">{gcCase.name}</span>
                    <div className="flex flex-wrap gap-2.5 text-xs text-stone-500 mt-0.5">
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('age')}>
                        {gcFlip.age ? fmtDate(gcCase.dob || gcA.dob) : `Age ${gcCase.age || '—'}`}
                      </span>
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('relationship')}>
                        <Heart className="size-3.5 inline" /> {gcFlip.relationship ? (gcPartner || '—') : (gcCase.maritalStatus || '—')}
                      </span>
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleGcFlip('address')}>
                        <Home className="size-3.5 inline" /> {gcFlip.address ? gcAddr : (gcCase.location || '—')}
                      </span>
                    </div>
                  </div>
                </div>
                <AttorneyRow prefix="gcAttorney" data={jd} onSaveBatch={updateFields}
                  onEmail={(email, name) => setEmailConfirm({ name: name || 'GC Attorney', email, caseId: journey.id })} />
              </>)
            })() : <p className="text-xs text-stone-400">GC not found</p>}
            {/* GC Sticky Note */}
            <JourneyCaseNote journeyId={journey.id} caseKey="gc" />
          </div>
        </div>

        {/* IP Card (blue tint) */}
        <div className="rounded-2xl border border-stone-200/80 overflow-hidden flex-1" style={{ backgroundColor: '#f8f9fb' }}>
          <div className="p-5 space-y-3">
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
                {/* Header: label + contact buttons */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#283693]/50 uppercase tracking-widest">Intended Parent{ipCase.type === 'Couple' ? 's' : ''}</p>
                  <div className="flex gap-1.5">
                    {ipCase.phone && (
                      <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs h-7 px-2.5"
                        onClick={() => setSmsConfirm({ phone: ipCase.phone, name: ipCase.ip1Name || ipCase.names, party: 'ip' })}>
                        <MessageSquare className="size-3" /> Text
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs h-7 px-2.5"
                      onClick={() => {
                        const emails = [ipCase.email, ipCase.ip2Email].filter(Boolean).join(', ')
                        setEmailConfirm({ name: ipCase.names, email: emails, caseId: journey.id, party: 'ip' })
                      }}>
                      <Mail className="size-3" /> Email
                    </Button>
                    {allPhones && (
                      <Button variant="outline" size="sm" className="gap-1 rounded-full text-xs h-7 px-2.5"
                        onClick={() => toggleIpFlip('phone')}>
                        <Phone className="size-3" /> Call
                      </Button>
                    )}
                  </div>
                </div>
                {ipFlip.phone && allPhones && (
                  <div className="text-xs text-stone-500 flex items-center gap-1.5">
                    <Phone className="size-3" /> {allPhones}
                    <button onClick={() => { navigator.clipboard.writeText(allPhones.split(' / ')[0]) }} className="text-stone-400 hover:text-stone-600"><Copy className="size-3" /></button>
                  </div>
                )}
                {/* Name + info */}
                <div className="flex items-center gap-3">
                  <ProfileAvatar name={ipCase.names} size="md" className="ring-2 ring-white shadow" />
                  <div className="min-w-0">
                    <span className="text-base font-heading font-bold text-stone-900 block truncate">{ipCase.names}</span>
                    <div className="flex flex-wrap gap-2.5 text-xs text-stone-500 mt-0.5">
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleIpFlip('age')}>
                        {ipFlip.age ? dobDisplay : ageDisplay}
                      </span>
                      <span><Heart className="size-3.5 inline" /> {ipA.maritalStatus || '—'}</span>
                      <span className="cursor-pointer hover:text-stone-700" onClick={() => toggleIpFlip('address')}>
                        <Home className="size-3.5 inline" /> {ipFlip.address ? ipAddr : (ipCase.location || '—')}
                      </span>
                    </div>
                  </div>
                </div>
                {ipCase.hasFrozenEmbryos && (
                  <div className="text-xs text-stone-500">
                    <FertilizedEggIcon size={13} color="currentColor" className="inline mr-1" /> {ipCase.frozenEmbryoDetails || 'Embryos'}
                  </div>
                )}
                <AttorneyRow prefix="ipAttorney" data={jd} onSaveBatch={updateFields} color="indigo"
                  onEmail={(email, name) => setEmailConfirm({ name: name || 'IP Attorney', email, caseId: journey.id })} />
              </>)
            })() : <p className="text-xs text-stone-400">IP not found</p>}
            {/* IP Sticky Note */}
            <JourneyCaseNote journeyId={journey.id} caseKey="ip" />
          </div>
        </div>

        </div>{/* end GC+IP stacked column */}
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <SortableTabsList configKey={`journey_${journey.id}`} tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'application', label: 'Application' },
          { value: 'profiles', label: 'Profiles' },
          { value: 'checklist', label: 'Checklist' },
          { value: 'match-sheets', label: 'Match Sheets' },
          { value: 'documents', label: 'Documents' },
          { value: 'insurance', label: 'Insurance' },
          { value: 'expenses', label: 'Expenses' },
          { value: 'notes', label: 'Notes' },
          { value: 'emails', label: 'Emails' },
          { value: 'texts', label: 'Texts' },
        ]} />

        <TabsContent value="overview" className="mt-4 space-y-6">
          <JourneyMilestoneTimeline journey={journey} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CaseCalendarWidget caseId={journey.id} caseType="journey" caseName={`${ipCase?.names || 'IP'} + ${gcCase?.name || 'GC'}`} />
            <CaseTasksWidget caseId={journey.id} caseType="journey" caseName={`${ipCase?.names || 'IP'} + ${gcCase?.name || 'GC'}`} />
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <JourneyChecklistTab journey={journey} onUpdate={async (updates) => {
            const updated = await updateMatchedJourney(journey.id, updates).catch(() => null)
            if (updated) setJourney(updated)
          }} />
        </TabsContent>

        {/* Application Tab — GC/IP sub-tabs */}
        <TabsContent value="application" className="mt-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAppView('gc')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${appView === 'gc' ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              GC Application
            </button>
            <button onClick={() => setAppView('ip')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${appView === 'ip' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              IP Application
            </button>
          </div>
          {appView === 'gc' ? (
            gcCase ? <GCApplicationTab surrogate={gcCase} setSurrogate={setGcCase} quizAnswers={gcQuizAnswers || gcCase.answers || {}} setQuizAnswers={setGcQuizAnswers} profileData={gcProfileData} />
              : <EmptyState title="GC data not found" />
          ) : (
            ipCase ? <IPApplicationTab ip={ipCase} setIp={setIpCase} />
              : <EmptyState title="IP data not found" />
          )}
        </TabsContent>

        {/* Profiles Tab — GC/IP sub-tabs */}
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
          <ProfilesTabContent
            profileView={profileView}
            gcCase={gcCase} setGcCase={setGcCase}
            gcProfileData={gcProfileData} setGcProfileData={setGcProfileData}
            gcProfileStatus={gcProfileStatus} setGcProfileStatus={setGcProfileStatus}
            gcPhotos={gcPhotos} setGcPhotos={setGcPhotos}
            gcPortraitUrl={gcPortraitUrl}
            gcQuizAnswers={gcQuizAnswers} setGcQuizAnswers={setGcQuizAnswers}
            ipCase={ipCase} setIpCase={setIpCase}
          />
        </TabsContent>

        <TabsContent value="match-sheets" className="mt-4">
          <MatchSheetsTab journey={journey} gcCase={gcCase} ipCase={ipCase} onUpdate={async (updates) => {
            const updated = await updateMatchedJourney(journey.id, updates).catch(() => null)
            if (updated) setJourney(updated)
          }} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            surrogateId={journey.gc_case_id}
            additionalCaseIds={[journey.ip_case_id]}
            caseLabels={{
              [journey.gc_case_id]: `GC — ${gcCase?.name || 'Surrogate'}`,
              [journey.ip_case_id]: `IP — ${ipCase?.names || 'Intended Parent'}`,
            }}
          />
        </TabsContent>
        <TabsContent value="insurance" className="mt-4">
          <InsuranceTab caseId={journey.gc_case_id} caseType="surrogate" surrogateNameForDisplay={gcCase?.name} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <JourneyExpensesTab journeyId={journey.id} gcCaseId={journey.gc_case_id} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4"><NotesTab journeyId={journey.id} currentUser={currentUser} /></TabsContent>
        <TabsContent value="emails" className="mt-4">
          <CaseEmailsTab caseId={journey.id} caseType="journey" additionalCaseIds={[journey.gc_case_id, journey.ip_case_id]} />
        </TabsContent>
        <TabsContent value="texts" className="mt-4"><EmptyState title="Text Messages" description="GC and IP text threads." /></TabsContent>
      </Tabs>

      {/* Email confirmation toast — positioned near the card that triggered it */}
      {emailConfirm && (
        <div className={`fixed z-50 animate-in fade-in duration-200 ${emailConfirm.party === 'ip' ? 'top-[340px] right-8' : 'top-[140px] right-8'}`}>
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 px-5 py-3 flex items-center gap-3 max-w-md">
            <div className="size-9 rounded-full bg-[#283693]/10 flex items-center justify-center shrink-0">
              <Mail className="size-4 text-[#283693]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800">Email {emailConfirm.name}?</p>
              {emailConfirm.email.split(', ').map((e, i) => <p key={i} className="text-xs text-stone-500">{e}</p>)}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="rounded-full text-xs h-7" onClick={() => setEmailConfirm(null)}>Cancel</Button>
              <Button size="sm" className="rounded-full text-xs h-7 gap-1" style={{ backgroundColor: '#283693' }}
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  const conf = emailConfirm
                  setEmailConfirm(null)
                  openDraft({ to: conf.email, caseId: conf.caseId, caseType: 'journey', userId: currentUser?.userId || currentUser?.id })
                }}
                type="button">
                <Mail className="size-3" /> Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Text confirmation toast */}
      {smsConfirm && (
        <div className={`fixed z-50 animate-in fade-in duration-200 ${smsConfirm.party === 'ip' ? 'top-[340px] right-8' : 'top-[140px] right-8'}`}>
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 px-5 py-3 flex items-center gap-3 max-w-md">
            <div className="size-9 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0">
              <MessageSquare className="size-4 text-pink-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800">Text {smsConfirm.name}?</p>
              <p className="text-xs text-stone-500">{smsConfirm.phone}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="rounded-full text-xs h-7" onClick={() => setSmsConfirm(null)}>Cancel</Button>
              <Button size="sm" className="rounded-full text-xs h-7 gap-1" style={{ backgroundColor: '#ed148c' }}
                onClick={() => {
                  const conf = smsConfirm
                  setSmsConfirm(null)
                  setSmsOpen({ phone: conf.phone, name: conf.name }); setSmsMessage(''); setSmsResult(null)
                }}>
                <MessageSquare className="size-3" /> Confirm
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

      {/* Confetti */}
      {showConfetti && <ConfettiBurst ref={confettiRef} iconSrc="/abc-favicon.png" zIndex={40} />}

      {/* Insurance Dialog */}
      <Dialog open={insuranceOpen} onOpenChange={setInsuranceOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><InsuranceCardIcon size={18} color="#283693" /> Insurance — {gcCase?.name}</DialogTitle>
          </DialogHeader>
          <InsuranceTab caseId={journey?.gc_case_id} caseType="surrogate" surrogateNameForDisplay={gcCase?.name} />
        </DialogContent>
      </Dialog>

      {/* Provider Edit Modal */}
      <Dialog open={!!providerEdit} onOpenChange={v => { if (!v) setProviderEdit(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {providerEdit === 'ivf' && <><EmbryoIcon size={18} color="#283693" /> Fertility Clinic</>}
              {providerEdit === 'ob' && <><Stethoscope className="size-5 text-[#283693]" /> OB Clinic</>}
              {providerEdit === 'hospital' && <><Hospital className="size-5 text-[#283693]" /> Delivery Hospital</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">{providerEdit === 'hospital' ? 'Hospital Name' : 'Clinic Name'}</label>
              <Input value={providerForm.name || ''} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="h-9" />
            </div>
            {(providerEdit === 'ivf' || providerEdit === 'ob') && (
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Doctor Name</label>
                <Input value={providerForm.doctor || ''} onChange={e => setProviderForm(f => ({ ...f, doctor: e.target.value }))} placeholder="Dr. Last Name" className="h-9" />
              </div>
            )}
            {(providerEdit === 'ob' || providerEdit === 'hospital') && (
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Phone Number</label>
                <Input value={providerForm.phone || ''} onChange={e => setProviderForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 555-5555" className="h-9" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Street Address</label>
              <Input value={providerForm.street || ''} onChange={e => setProviderForm(f => ({ ...f, street: e.target.value }))} placeholder="123 Main St" className="h-9" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1 col-span-1">
                <label className="text-[11px] text-stone-400 font-medium">City</label>
                <Input value={providerForm.city || ''} onChange={e => setProviderForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">State</label>
                <Input value={providerForm.state || ''} onChange={e => setProviderForm(f => ({ ...f, state: e.target.value }))} placeholder="CA" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Zip Code</label>
                <Input value={providerForm.zip || ''} onChange={e => setProviderForm(f => ({ ...f, zip: e.target.value }))} placeholder="90210" className="h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Website</label>
              <Input value={providerForm.website || ''} onChange={e => setProviderForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." className="h-9" />
            </div>
            {providerEdit === 'ivf' && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">3rd Party Coordinator Name</label>
                  <Input value={providerForm.coordinator || ''} onChange={e => setProviderForm(f => ({ ...f, coordinator: e.target.value }))} placeholder="Coordinator name" className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">Coordinator Email</label>
                  <Input value={providerForm.coordinatorEmail || ''} onChange={e => setProviderForm(f => ({ ...f, coordinatorEmail: e.target.value }))} placeholder="email@clinic.com" type="email" className="h-9" />
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setProviderEdit(null)}>Cancel</Button>
              <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={saveProvider}>
                <Save className="size-3" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
