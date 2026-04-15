import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, Heart, Ruler, Weight, Activity,
  MessageSquare, Pencil, CheckCircle2, Clock, Circle, XCircle,
  MapPin, Calendar, ClipboardList, User, Baby, Milestone, Copy, Check, ChevronDown,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRole } from '@/context/RoleContext'
import RichTextEditor, { RichTextDisplay } from '@/components/shared/RichTextEditor'
import { SURROGATE_STAGES } from '@/lib/constants'
import { getSurrogateStageStatus, setSurrogateStageStatus, getStatusesForStage, getDefaultStatus } from '@/lib/stageStatusStore'
import { getChecklistSteps, getChecklistMilestones, CHECKLIST_STEP_STATUSES } from '@/lib/checklistStore'
import { getRecordTracking, setRecordTracking as setRecordTrackingDB } from '@/lib/db'
import StageBadge from '@/components/shared/StageBadge'
import AISummaryButton from '@/components/shared/AISummaryButton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { US_STATES as US_STATES_FULL, FIELD_LABELS } from '@/components/profile/profileConstants'
import GCApplicationTab from '@/components/surrogates/GCApplicationTab'
import { useDrafts } from '@/context/DraftContext'
import MatchNotesDialog, { MatchNotesPreview } from '@/components/shared/MatchNotesDialog'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import ScreeningStatusItem from '@/components/shared/ScreeningStatusItem'
import EmptyState from '@/components/shared/EmptyState'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchSurrogatesFromIntake, fetchIntakeByEmail, listProfilePhotos, getPortraitPhotoUrl, fetchSurrogateProfileByEmail, updateSurrogateProfileStatus, adminUpdateSurrogateProfile, assignSurrogateToAdmin, updateReferralPartner, updateIntakeSubmission, fetchCaseNotes, insertCaseNote, updateCaseNote, deleteCaseNote, fetchCaseDocuments, uploadCaseDocument, updateCaseDocument, deleteCaseDocument, fetchInsurance, createCaseTask, replaceProfilePhoto, uploadProfilePhoto, deleteProfilePhoto } from '@/lib/db'
import { SortablePhoto, PhotoEditor } from '@/pages/profile/IPProfilePage'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { sendSMS, fetchSMSMessages, fetchAdminPhones } from '@/lib/sms'
import { markSMSRead, isMessageRead } from '@/lib/smsReadState'
import { Trash2, AlertTriangle, Plus, Upload, FileText, FileImage, File, Download, FolderOpen, X, Eye, EyeOff, LayoutGrid, List as ListIcon, Search, FolderInput, GripVertical, Mail as MailIcon, Printer, RotateCw, ZoomIn, Crop, ChevronLeft, ChevronRight } from 'lucide-react'
import CaseEmailsTab from '@/components/shared/CaseEmailsTab'
import InsuranceTab, { InsuranceCardIcon } from '@/components/shared/InsuranceTab'
import PreviousMatchTab from '@/components/shared/PreviousMatchTab'
import CaseTasksWidget from '@/components/shared/CaseTasksWidget'
import CaseCalendarWidget from '@/components/shared/CaseCalendarWidget'
import { findJourneyByCaseId } from '@/lib/matching'
import { inviteUser } from '@/lib/invite'
import TrackingTable from '@/components/shared/TrackingTable'
import QuickNote from '@/components/shared/QuickNote'
import JourneyUpdateButton from '@/components/shared/JourneyUpdateButton'
import SortableTabsList from '@/components/shared/SortableTabsList'
import { CSS } from '@dnd-kit/utilities'
import { ShieldCheck, ShieldX, Save, Loader2, UserCog, UserPlus, Camera } from 'lucide-react'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { getAdminStaff } from '@/data/mock/users'
import { ProfilePreview } from '@/pages/profile/SurrogateProfilePage'

// ── GTPAL ──────────────────────────────────────────────────
function getGTPAL(profileData) {
  const ph = profileData?.pregnancyHistory
  if (!ph?.pregnancies || ph.pregnancies.length === 0) return null
  const pregnancies = ph.pregnancies
  const g = parseInt(ph.numberOfPregnancies) || pregnancies.length
  let term = 0, preterm = 0, abortions = 0, living = 0
  for (const p of pregnancies) {
    if (p.outcome === 'Live Birth') {
      const weeks = parseInt(p.gestationWeeks) || 40
      if (weeks >= 37) term++
      else preterm++
      living++
    } else {
      abortions++
    }
  }
  return { g, t: term, p: preterm, a: abortions, l: living }
}

// ── Screening helpers ──────────────────────────────────────
const SCREENING_STEPS = ['medical', 'psychological', 'background', 'homeStudy']
const SCREENING_LABELS = { medical: 'Medical', psychological: 'Psychological', background: 'Background Check', homeStudy: 'Home Study' }
const SCREENING_ICONS = { cleared: CheckCircle2, pending: Clock, failed: XCircle, not_started: Circle }
const SCREENING_COLORS = { cleared: 'text-emerald-500', pending: 'text-amber-500', failed: 'text-red-500', not_started: 'text-stone-300' }

// ── Medical Records statuses ──
const MEDICAL_RECORD_STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'faxed_request', label: 'Faxed Request' },
  { id: 'refaxed_request', label: 'Refaxed Request' },
  { id: 'confirmed_fax_received', label: 'Confirmed Fax Received' },
  { id: 'followed_up', label: 'Followed Up' },
  { id: 'records_sent_mail', label: 'Records Sent by Mail' },
  { id: 'fax_received', label: 'Fax Received' },
  { id: 'partial_complete', label: 'Partial Records Complete' },
  { id: 'complete', label: 'Records Complete' },
  { id: 'na', label: 'Not Needed' },
]

// ── Screening step statuses ──
const SCREENING_STEP_STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'waiting_surrogate', label: 'Waiting on Surrogate' },
  { id: 'waiting_provider', label: 'Waiting on Provider' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'followed_up', label: 'Follow Up' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'incomplete_resubmit', label: 'Incomplete — Needs Resubmission' },
  { id: 'complete', label: 'Complete' },
  { id: 'na', label: 'N/A' },
]

const SCREENING_RECORD_STEPS = [
  { id: 'pap', label: 'PAP' },
  { id: 'ob_clearance', label: 'OB Clearance Letter' },
  { id: 'records_reviewed', label: 'Records Reviewed' },
  { id: 'background_check', label: 'Background Check' },
  { id: 'psych_screening', label: 'Psych Screening' },
  { id: 'mitera', label: 'Mitera' },
  { id: 'insurance', label: 'Insurance' },
]

// Milestones group steps for the card/overview display
const SCREENING_MILESTONES = [
  { id: 'records_collection', label: 'Records', stepIds: ['_ob_summary', '_del_summary', '_ivf_summary', 'pap', 'ob_clearance'] },
  { id: 'records_review', label: 'Review', stepIds: ['records_reviewed'] },
  { id: 'background', label: 'BG', stepIds: ['background_check'] },
  { id: 'psych', label: 'Psych', stepIds: ['psych_screening'] },
  { id: 'mfm', label: 'MFM', stepIds: ['mitera'] },
  { id: 'insurance_ms', label: 'Insurance', stepIds: ['insurance'] },
]

const RECORD_TYPES = [
  { value: 'OB', label: 'OB', color: 'bg-blue-100 text-blue-700' },
  { value: 'Delivery', label: 'Delivery', color: 'bg-purple-100 text-purple-700' },
  { value: 'IVF', label: 'IVF', color: 'bg-pink-100 text-pink-700' },
  { value: 'PAP', label: 'PAP', color: 'bg-amber-100 text-amber-700' },
]

function MedicalRecordsSection({ medSteps, statuses, tracking, onUpdate, currentUserName, onStatusLog }) {
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addType, setAddType] = useState('OB')

  function handleAdd() {
    if (!addLabel.trim()) return
    const id = `custom_record_${Date.now()}`
    const badge = RECORD_TYPES.find(t => t.value === addType)
    onUpdate(id, {
      status: 'not_started',
      history: [],
      customLabel: addLabel.trim(),
      recordType: addType,
    })
    setAddLabel('')
    setAddType('OB')
    setAddOpen(false)
  }

  // Rebuild steps including any just-added custom ones
  const allSteps = [...medSteps]
  for (const key of Object.keys(tracking)) {
    if (key.startsWith('custom_record_') && !allSteps.some(s => s.id === key)) {
      const rt = tracking[key] || {}
      const badgeType = rt.recordType || 'OB'
      const badge = RECORD_TYPES.find(t => t.value === badgeType) || RECORD_TYPES[0]
      allSteps.push({
        id: key,
        label: rt.customLabel || 'Custom Record',
        canToggleNA: true,
        badge: { label: badge.label, color: badge.color },
      })
    }
  }

  return (
    <div className="space-y-4">
      <TrackingTable
        title="Medical Records"
        steps={allSteps}
        statuses={statuses}
        tracking={tracking}
        onUpdate={onUpdate}
        currentUserName={currentUserName}
        onStatusLog={onStatusLog}
      />
      {/* Add Record */}
      {addOpen ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-[#283693]">Add Medical Record</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-stone-500 font-medium">Record Name</label>
              <input
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none"
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                placeholder="e.g. Dr. Smith OB Records 2024"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddOpen(false) }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500 font-medium">Record Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {RECORD_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setAddType(t.value)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 transition-all ${addType === t.value ? `${t.color} border-current scale-105` : 'bg-stone-50 text-stone-400 border-transparent hover:bg-stone-100'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!addLabel.trim()} style={{ backgroundColor: '#283693', color: '#fff' }}>
              <Plus className="size-3.5 mr-1" /> Add Record
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add Record
        </Button>
      )}
    </div>
  )
}

export default function SurrogateDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useRole()
  const { openDraft } = useDrafts()
  const [surrogate, setSurrogate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emailMenuOpen, setEmailMenuOpen] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [profileStatus, setProfileStatus] = useState('draft')
  const [photos, setPhotos] = useState([])
  const [recordTracking, setRecordTracking] = useState(() => {
    try {
      const saved = localStorage.getItem(`abc_records_${id}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Load record tracking from Supabase on mount
  useEffect(() => {
    let cancelled = false
    async function loadTracking() {
      try {
        const remote = await getRecordTracking(id)
        if (cancelled) return
        if (remote && Object.keys(remote).length > 0) {
          setRecordTracking(remote)
          try { localStorage.removeItem(`abc_records_${id}`) } catch {}
        } else {
          // Migration: if localStorage has data, push to Supabase
          try {
            const local = localStorage.getItem(`abc_records_${id}`)
            if (local) {
              const parsed = JSON.parse(local)
              if (Object.keys(parsed).length > 0) {
                setRecordTrackingDB(id, parsed).catch(() => {})
                try { localStorage.removeItem(`abc_records_${id}`) } catch {}
              }
            }
          } catch {}
        }
      } catch {}
    }
    loadTracking()
    return () => { cancelled = true }
  }, [id])
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteAddOpen, setNoteAddOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [flipped, setFlipped] = useState({})
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsMessage, setSmsMessage] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [portalStatus, setPortalStatus] = useState(null) // { exists, lastSignIn }
  const [smsResult, setSmsResult] = useState(null)
  const [hasUnreadTexts, setHasUnreadTexts] = useState(false)
  const [unreadEmailCount, setUnreadEmailCount] = useState(0)
  const [portraitUrl, setPortraitUrl] = useState(null)
  const [insuranceStatus, setInsuranceStatus] = useState(null) // null=loading, {has_insurance, company, status}
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const [stageStatus, setStageStatus] = useState({ stage: 'pre-qualification', status: 'New' })
  const [stageOpen, setStageOpen] = useState(false)
  const [stageConfirm, setStageConfirm] = useState(null) // { stageId } for blocked-stage confirmation
  const [matchNotesOpen, setMatchNotesOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const toggleFlip = (key) => setFlipped(prev => ({ ...prev, [key]: !prev[key] }))

  // Persist record tracking to localStorage + Supabase
  useEffect(() => {
    if (Object.keys(recordTracking).length > 0) {
      localStorage.setItem(`abc_records_${id}`, JSON.stringify(recordTracking))
      setRecordTrackingDB(id, recordTracking).catch(() => {})
    }
  }, [recordTracking, id])

  function updateRecord(recordId, updates) {
    setRecordTracking(prev => ({ ...prev, [recordId]: { ...(prev[recordId] || {}), ...updates } }))
  }

  // Map medical record prefixes to checklist step label patterns
  const RECORD_PREFIXES = ['ob_records_', 'delivery_records_', 'ivf_records_', 'pap_']
  const PREFIX_LABELS = { 'ob_records_': 'ob records', 'delivery_records_': 'delivery records', 'ivf_records_': 'ivf records', 'pap_': 'pap' }

  // Auto-update ALL record-type checklist steps whenever tracking changes
  const autoUpdateInProgress = useRef(false)
  useEffect(() => {
    // Prevent infinite loop: skip if this effect itself caused the tracking change
    if (autoUpdateInProgress.current) return
    try {
    if (!recordTracking || Object.keys(recordTracking).length === 0) return

    const screeningSteps = getChecklistSteps('gc', 'screening')
    let needsUpdate = false
    const updates = {}

    for (const prefix of RECORD_PREFIXES) {
      const labelMatch = PREFIX_LABELS[prefix]
      const step = screeningSteps.find(s => s.label?.toLowerCase().includes(labelMatch))
      if (!step) { console.log('[AutoUpdate] No checklist step found for', labelMatch, '— available:', screeningSteps.map(s => s.label)); continue }

      // Filter record keys — exclude checklist steps (by ID match or timestamp suffix)
      // Real records: ob_records_0, ob_records_1 (short numeric suffix)
      // Checklist steps: ob_records, ob_records_1775016744351 (no suffix or long timestamp)
      const allStepIds = new Set(screeningSteps.map(s => s.id))
      const recordKeys = Object.keys(recordTracking).filter(k => {
        if (!k.startsWith(prefix)) return false
        if (allStepIds.has(k)) return false
        // Exclude keys with timestamp suffixes (10+ digits) — those are checklist steps
        const suffix = k.slice(prefix.length)
        if (/^\d{10,}$/.test(suffix)) return false
        return true
      })
      if (recordKeys.length === 0) continue

      // Separate active records from deactivated ones
      const isDeactivated = (st) => st === 'na' || st === 'deactivated'
      const activeRecordKeys = recordKeys.filter(k => !isDeactivated(recordTracking[k]?.status))
      const allActiveComplete = activeRecordKeys.length > 0 && activeRecordKeys.every(k => {
        const st = recordTracking[k]?.status
        return st === 'complete' || st === 'partial_complete' || st === 'records_complete'
      })
      // If ALL records are deactivated, mark checklist as "not needed" (na)
      const allDeactivated = recordKeys.every(k => isDeactivated(recordTracking[k]?.status))
      const anyStarted = recordKeys.some(k => {
        const st = recordTracking[k]?.status
        return st && st !== 'not_started'
      })
      const current = recordTracking[step.id]?.status || 'not_started'

      if (allDeactivated && current !== 'na') {
        // All records deactivated → mark checklist as "not needed"
        const entry = { status: 'na', date: new Date().toISOString().split('T')[0], note: 'Auto-deactivated: all records not needed', by: 'System' }
        updates[step.id] = { ...(recordTracking[step.id] || {}), status: 'na', history: [...(recordTracking[step.id]?.history || []), entry] }
        needsUpdate = true
      } else if (allActiveComplete && current !== 'complete') {
        // All active (non-deactivated) records are complete
        const entry = { status: 'complete', date: new Date().toISOString().split('T')[0], note: `Auto-completed: ${activeRecordKeys.length} of ${recordKeys.length} records done`, by: 'System' }
        updates[step.id] = { ...(recordTracking[step.id] || {}), status: 'complete', history: [...(recordTracking[step.id]?.history || []), entry] }
        needsUpdate = true
      } else if (anyStarted && !allActiveComplete && current !== 'in_progress' && current !== 'complete') {
        const entry = { status: 'in_progress', date: new Date().toISOString().split('T')[0], note: 'Auto-updated: records in progress', by: 'System' }
        updates[step.id] = { ...(recordTracking[step.id] || {}), status: 'in_progress', history: [...(recordTracking[step.id]?.history || []), entry] }
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      autoUpdateInProgress.current = true
      setRecordTracking(prev => ({ ...prev, ...updates }))
      // Reset the guard after React processes the state update
      setTimeout(() => { autoUpdateInProgress.current = false }, 100)
    }
    } catch (err) { console.error('Auto-update error:', err) }
  }, [recordTracking])

  useEffect(() => {
    // Check if this case is matched — redirect to journey
    findJourneyByCaseId(Number(id)).then(journeyId => {
      if (journeyId) { navigate(`/journeys/${journeyId}`, { replace: true }); return }
    }).catch(() => {})

    fetchSurrogatesFromIntake().then(all => {
      const found = all.find(s => String(s.id) === String(id))
      setSurrogate(found || null)
      if (found?.id) {
        fetchCaseNotes(found.id).then(setNotes).catch(() => {})
      }
      if (found?.email) {
        fetchIntakeByEmail(found.email).then(setQuizAnswers).catch(() => {})
        fetchSurrogateProfileByEmail(found.email).then(async result => {
          if (result?.profile_data) {
            setProfileData(result.profile_data)
            if (result?.status) setProfileStatus(result.status)
            const uid = result?.user_id || found.userId || found.user_id
            if (uid) loadPhotos(uid)
          } else {
            // Fallback: email might have changed — try looking up by user_id
            const uid = found.userId || found.user_id
            if (uid) {
              try {
                const { fetchSurrogateProfile } = await import('@/lib/db')
                const byId = await fetchSurrogateProfile(uid)
                if (byId?.profile_data) {
                  setProfileData(byId.profile_data)
                  if (byId?.status) setProfileStatus(byId.status)
                }
              } catch {}
              loadPhotos(uid)
            }
          }
        }).catch(() => {
          // Fallback: try userId from intake
          const uid = found.userId || found.user_id
          if (uid) loadPhotos(uid)
        })
      } else {
        const uid = found?.userId || found?.user_id
        if (uid) loadPhotos(uid)
      }

      function loadPhotos(uid) {
        const caseId = String(found?.id || '')
        const paths = [
          listProfilePhotos(uid).catch(() => []),
          listProfilePhotos(`${uid}/headshot`).catch(() => []),
          listProfilePhotos(`${uid}/portrait`).catch(() => []),
        ]
        // Also check intake case ID path if different from auth UUID
        if (caseId && caseId !== uid) {
          paths.push(
            listProfilePhotos(caseId).catch(() => []),
            listProfilePhotos(`${caseId}/headshot`).catch(() => []),
            listProfilePhotos(`${caseId}/portrait`).catch(() => []),
          )
        }
        Promise.all(paths).then(results => {
          let gallery = results[0], headshots = results[1], portraits = results[2]
          if (results.length > 3) {
            gallery = [...gallery, ...results[3]]
            headshots = [...headshots, ...results[4]]
            portraits = [...portraits, ...results[5]]
          }
          // Order: headshot (cover) first, then portrait, then gallery
          const all = [...headshots, ...portraits, ...gallery]
          setPhotos(all)
        })
        getPortraitPhotoUrl(uid).then(url => {
          if (url) setPortraitUrl(url)
        }).catch(() => {})
        if (caseId && caseId !== uid) {
          getPortraitPhotoUrl(caseId).then(url => {
            if (url) setPortraitUrl(prev => prev || url)
          }).catch(() => {})
        }
      }
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // Check portal status (has account / last login)
  useEffect(() => {
    if (surrogate?.email) {
      fetch('/api/user-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: surrogate.email }) })
        .then(r => r.json()).then(setPortalStatus).catch(() => {})
    }
  }, [surrogate?.email])

  // Load insurance status
  useEffect(() => {
    if (surrogate) {
      fetchInsurance(surrogate.id, 'surrogate').then(ins => {
        setInsuranceStatus(ins)
      }).catch(() => {})
    }
  }, [surrogate?.id])

  // Load stage/status from localStorage
  useEffect(() => {
    if (surrogate) {
      setStageStatus(getSurrogateStageStatus(surrogate.id))
      // Check for unread inbound texts
      if (surrogate.phone) {
        let cleanTo = surrogate.phone.replace(/[^\d+]/g, '')
        if (!cleanTo.startsWith('+')) cleanTo = '+1' + cleanTo.replace(/^1/, '')
        fetchSMSMessages(cleanTo).then(data => {
          const unread = (data.messages || []).some(m => m.direction === 'inbound' && !isMessageRead(m.sid))
          setHasUnreadTexts(unread)
        }).catch(() => {})
      }
    }
  }, [surrogate])

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  if (!surrogate) {
    return (
      <div className="space-y-6">
        <Link to="/surrogates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Surrogates
        </Link>
        <EmptyState title="Surrogate not found" description="This profile doesn't exist." />
      </div>
    )
  }

  const screening = surrogate.screening || {}
  const heightStr = surrogate.heightFt ? `${surrogate.heightFt}'${surrogate.heightIn || 0}"` : null
  const gtpal = getGTPAL(profileData)

  return (
    <div className="space-y-6">
      <Link to="/surrogates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Surrogates
      </Link>

      {/* ─── Hero Section ─────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200/80 bg-white">
        {/* Top banner area */}

        <div className="p-6 space-y-6">
          {/* Name row */}
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <ProfileAvatar name={surrogate.name} avatar={portraitUrl || profileData?.personal?.profilePhotoUrl} size="xl" className="ring-4 ring-white shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-stone-900">{surrogate.name}</h1>
                <StageBadge stage={stageStatus.stage} status={stageStatus.status} />
                <AISummaryButton caseId={surrogate.id} caseName={surrogate.name} caseType="surrogate" stage={stageStatus.stage} status={stageStatus.status} />
                {surrogate.referralPartner === 'be_surrogacy' && (
                  <img src="/be-logo.png" alt="Be Surrogacy" className="h-7 w-auto" title="Be Surrogacy Referral" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-stone-500">
                {surrogate.location && (
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {surrogate.location}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  Submitted {new Date(surrogate.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {insuranceStatus && (() => {
                  const ins = insuranceStatus
                  const st = ins.insurance_status
                  const isVerified = ins.has_insurance && ins.status === 'active' && (st === 'active_policy' || st === 'verified_open_enrollment' || st === 'complete')
                  const isChecking = ins.has_insurance && st === 'policy_check'
                  const isApplying = st === 'open_enrollment'
                  const isNotFriendly = st === 'complete_not_friendly'
                  if (isVerified) return (
                    <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1 text-emerald-600 hover:underline cursor-pointer">
                      <InsuranceCardIcon size={14} color="currentColor" /> {ins.company || 'Verified'}
                    </button>
                  )
                  if (isChecking) return (
                    <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1 text-yellow-500 hover:underline cursor-pointer">
                      <InsuranceCardIcon size={14} color="currentColor" /> {ins.company || 'Checking'}
                    </button>
                  )
                  if (isApplying) return (
                    <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1 text-amber-500 hover:underline cursor-pointer">
                      <InsuranceCardIcon size={14} color="currentColor" /> Applying
                    </button>
                  )
                  if (isNotFriendly) return (
                    <button onClick={() => setInsuranceOpen(true)} className="flex items-center gap-1 text-red-500 hover:underline cursor-pointer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5"/></svg>
                      Not Surrogacy Friendly
                    </button>
                  )
                  return null
                })()}
              </div>
              {/* Assignment */}
              <div className="flex items-center gap-1.5 mt-2">
                <UserCog className="size-3.5 text-stone-400" />
                <span className="text-xs text-stone-400">Assigned to</span>
                <SelectUI
                  value={surrogate.assignedTo || '_unassigned'}
                  onValueChange={async val => {
                    const email = val === '_unassigned' ? null : val
                    await assignSurrogateToAdmin(surrogate.id, email).catch(() => {})
                    setSurrogate(prev => ({ ...prev, assignedTo: email }))
                  }}
                >
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24">
                    <SelectValueUI />
                  </SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {getAdminStaff().map(a => (
                      <SelectItemUI key={a.email} value={a.email}>{a.name}</SelectItemUI>
                    ))}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {surrogate.phone && (
                <Button
                  variant={surrogate.preferredContact === 'Text' ? 'default' : 'outline'}
                  size="sm"
                  className={`gap-1.5 ${surrogate.preferredContact === 'Text' ? 'bg-gradient-to-r from-[#ed148c] to-[#283693] text-white border-0' : ''}`}
                  onClick={() => { setSmsOpen(true); setSmsResult(null); setSmsMessage('') }}
                >
                  <MessageSquare className="size-3.5" /> Text
                </Button>
              )}
              <div className="relative">
                {surrogate.preferredContact === 'Email' ? (
                  <Button size="sm" className="gap-1.5 rounded-full text-white shadow-md" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
                    onClick={() => setEmailMenuOpen(!emailMenuOpen)}>
                    <Mail className="size-3.5" /> Email ★
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setEmailMenuOpen(!emailMenuOpen)}>
                    <Mail className="size-3.5" /> Email
                  </Button>
                )}
                {emailMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setEmailMenuOpen(false)} />
                    <div className="absolute z-20 top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border py-1.5">
                      <button className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                        onClick={() => { openDraft({ to: surrogate.email, userId: currentUser.id, caseId: surrogate.id, caseType: 'gc' }); setEmailMenuOpen(false) }}>
                        <Mail className="size-3.5 text-[#283693]" /> Email {surrogate.name?.split(' ')[0]}
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                        onClick={() => { navigator.clipboard.writeText(surrogate.email); setEmailMenuOpen(false) }}>
                        <Copy className="size-3.5 text-stone-400" /> Copy Email Address
                      </button>
                    </div>
                  </>
                )}
              </div>
              {surrogate.phone && (
                <CopyFlipButton
                  icon={Phone}
                  label="Call"
                  value={surrogate.phone}
                  flipped={flipped.phone}
                  onFlip={() => toggleFlip('phone')}
                  preferred={surrogate.preferredContact === 'Phone'}
                />
              )}
              <JourneyUpdateButton caseId={surrogate.id} caseType="gc" caseName={surrogate.name} />
              {/* Invite / Portal status */}
              {portalStatus?.exists && portalStatus?.lastSignIn ? (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-emerald-600 font-medium">Portal Active</span>
                  <span className="text-[10px] text-stone-400">Last login {new Date(portalStatus.lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              ) : portalStatus?.exists && !portalStatus?.lastSignIn ? (
                <div className="flex flex-col items-center gap-0.5">
                  <Button variant="outline" size="sm" className="gap-1.5 text-[#283693] border-[#283693]/30 hover:bg-[#283693] hover:text-white" disabled={inviting}
                    onClick={async () => {
                      if (!surrogate.email) return
                      setInviting(true); setInviteResult(null)
                      try {
                        // Resend portal invite email
                        const res = await fetch('/api/reinvite', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: surrogate.email, firstName: surrogate.name?.split(' ')[0] || '' }),
                        })
                        const result = await res.json()
                        if (result.success) {
                          setInviteResult('sent')
                          // Log the invite timestamp
                          try {
                            const { supabase: sb } = await import('@/lib/supabase')
                            if (sb) {
                              const { data: row } = await sb.from('intake_submissions').select('answers').eq('id', surrogate.id).single()
                              if (row) {
                                await sb.from('intake_submissions').update({ answers: { ...(row.answers || {}), _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }).eq('id', surrogate.id)
                              }
                            }
                            setQuizAnswers(prev => ({ ...prev, _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name }))
                          } catch {}
                        } else {
                          setInviteResult('error')
                        }
                      } catch { setInviteResult('error') }
                      setInviting(false)
                      setTimeout(() => setInviteResult(null), 4000)
                    }}>
                    {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    {inviting ? 'Sending...' : inviteResult === 'sent' ? 'Sent!' : 'Resend Invite'}
                  </Button>
                  <span className="text-[10px] text-amber-500">Hasn't logged in yet</span>
                  {quizAnswers?._lastInvitedAt && (
                    <span className="text-[10px] text-stone-400">Invited {new Date(quizAnswers._lastInvitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={inviting}
                    onClick={async () => {
                      if (!surrogate.email) return
                      setInviting(true); setInviteResult(null)
                      try {
                        await inviteUser(currentUser.id, { email: surrogate.email, name: surrogate.name, role: 'surrogate', portalType: 'surrogate' })
                        setInviteResult('sent')
                        try {
                          const { supabase } = await import('@/lib/supabase')
                          if (supabase) {
                            const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', surrogate.id).single()
                            if (row) {
                              await supabase.from('intake_submissions').update({ answers: { ...(row.answers || {}), _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }).eq('id', surrogate.id)
                            }
                          }
                          setQuizAnswers(prev => ({ ...prev, _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name }))
                        } catch {}
                      } catch (err) {
                        setInviteResult(err.message?.includes('already') ? 'exists' : 'error')
                      }
                      setInviting(false)
                      setTimeout(() => setInviteResult(null), 4000)
                    }}>
                    {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    {inviting ? 'Inviting...' : inviteResult === 'sent' ? 'Invited!' : inviteResult === 'exists' ? 'Already has account' : 'Invite to Portal'}
                  </Button>
                  {quizAnswers?._lastInvitedAt && (
                    <span className="text-[10px] text-stone-400">Invited {new Date(quizAnswers._lastInvitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              )}
              {/* Release Application button */}
              <div className="flex flex-col items-center gap-0.5">
                {quizAnswers?._applicationSubmitted ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="size-3" /> Application Submitted</span>
                    {quizAnswers._applicationSubmittedAt && (
                      <span className="text-[10px] text-stone-400">{new Date(quizAnswers._applicationSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6 px-2 text-amber-600 border-amber-200 hover:bg-amber-50">
                          <Pencil className="size-2.5" /> Reopen for Updates
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Reopen Application?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          The surrogate will be able to edit their application and must re-submit when finished. No data will be erased.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                          <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
                          <DialogClose asChild>
                            <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={async () => {
                                try {
                                  const { supabase: sb } = await import('@/lib/supabase')
                                  if (!sb) return
                                  const { data: row } = await sb.from('intake_submissions').select('answers').eq('id', surrogate.id).single()
                                  if (row) {
                                    const updated = { ...(row.answers || {}), _applicationSubmitted: false, _applicationReopenedAt: new Date().toISOString(), _applicationReopenedBy: currentUser.name }
                                    await sb.from('intake_submissions').update({ answers: updated }).eq('id', surrogate.id)
                                    setQuizAnswers(prev => ({ ...prev, _applicationSubmitted: false, _applicationReopenedAt: new Date().toISOString() }))
                                  }
                                } catch (err) { console.error('Failed to reopen application:', err) }
                              }}>
                              <Pencil className="size-3" /> Reopen Application
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ) : quizAnswers?._applicationAvailable ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1"><Clock className="size-3" /> Application In Progress</span>
                    {quizAnswers._applicationReleasedAt && (
                      <span className="text-[10px] text-stone-400">Released {new Date(quizAnswers._applicationReleasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5 text-[10px] h-7 px-2"
                    onClick={async () => {
                      try {
                        const { supabase: sb } = await import('@/lib/supabase')
                        if (!sb) return
                        const { data: row } = await sb.from('intake_submissions').select('answers').eq('id', surrogate.id).single()
                        if (row) {
                          const updated = {
                            ...(row.answers || {}),
                            _applicationAvailable: true,
                            _applicationReleasedAt: new Date().toISOString(),
                            _applicationReleasedBy: currentUser.name,
                          }
                          await sb.from('intake_submissions').update({ answers: updated }).eq('id', surrogate.id)
                          setQuizAnswers(prev => ({ ...prev, _applicationAvailable: true, _applicationReleasedAt: new Date().toISOString() }))
                        }
                      } catch (err) { console.error('Failed to release application:', err) }
                    }}>
                    <ClipboardList className="size-3" /> Release Application
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stage change confirmation for portal-blocking stages */}
          <Dialog open={!!stageConfirm} onOpenChange={open => !open && setStageConfirm(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-red-600">Remove Portal Access?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-stone-600 leading-relaxed">
                Moving this case to <strong>{SURROGATE_STAGES.find(s => s.id === stageConfirm?.stageId)?.label}</strong> will remove the surrogate's access to the portal. They will see a message to contact the agency if they try to log in.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
                <DialogClose asChild>
                  <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      if (!stageConfirm) return
                      const newStatus = getDefaultStatus(stageConfirm.stageId, 'gc')
                      setSurrogateStageStatus(surrogate.id, stageConfirm.stageId, newStatus)
                      setStageStatus({ stage: stageConfirm.stageId, status: newStatus })
                      setStageConfirm(null)
                    }}>
                    <AlertTriangle className="size-3.5" /> Confirm
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          {/* Stats grid — interactive flip cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Age / DOB */}
            <FlipCard
              flipped={flipped.age}
              onClick={() => toggleFlip('age')}
              front={{ icon: Calendar, label: 'Age', value: surrogate.age || '—' }}
              back={{ icon: Calendar, label: 'DOB', value: quizAnswers?.dob ? new Date(quizAnswers.dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }}
            />
            {/* Height — imperial / metric */}
            <FlipCard
              flipped={flipped.height}
              onClick={() => toggleFlip('height')}
              front={{ icon: Ruler, label: 'Height', value: heightStr || '—' }}
              back={{ icon: Ruler, label: 'Height', value: heightStr ? `${Math.round(((parseInt(surrogate.heightFt) || 0) * 30.48) + ((parseInt(surrogate.heightIn) || 0) * 2.54))} cm` : '—' }}
            />
            {/* Weight — lbs / kg */}
            <FlipCard
              flipped={flipped.weight}
              onClick={() => toggleFlip('weight')}
              front={{ icon: Weight, label: 'Weight', value: surrogate.weightLbs ? `${surrogate.weightLbs} lbs` : '—' }}
              back={{ icon: Weight, label: 'Weight', value: surrogate.weightLbs ? `${(surrogate.weightLbs / 2.205).toFixed(1)} kg` : '—' }}
            />
            {/* BMI — value / over-under range */}
            {(() => {
              const bmiVal = parseFloat(surrogate.bmi)
              const bmiOk = bmiVal >= 19 && bmiVal <= 33
              const bmiColor = !surrogate.bmi ? '' : bmiOk ? 'text-emerald-600' : 'text-red-500'
              let bmiBack = '—'
              if (surrogate.bmi) {
                if (bmiVal < 19) bmiBack = `${(19 - bmiVal).toFixed(1)} under`
                else if (bmiVal > 33) bmiBack = `${(bmiVal - 33).toFixed(1)} over`
                else bmiBack = 'In range'
              }
              return (
                <FlipCard
                  flipped={flipped.bmi}
                  onClick={() => toggleFlip('bmi')}
                  front={{ icon: Activity, label: 'BMI', value: surrogate.bmi || '—', color: bmiColor }}
                  back={{ icon: Activity, label: 'BMI Range', value: bmiBack, color: bmiOk ? 'text-emerald-600' : 'text-red-500' }}
                />
              )
            })()}
            {/* Relationship / Partner name */}
            {(() => {
              const partnerName = profileData?.personal?.partnerName || profileData?.family?.partnerName
              const ms = profileData?.personal?.maritalStatus || surrogate.maritalStatus || '—'
              if (partnerName) {
                return (
                  <FlipCard
                    flipped={flipped.relationship}
                    onClick={() => toggleFlip('relationship')}
                    front={{ icon: Heart, label: 'Relationship', value: ms }}
                    back={{ icon: Heart, label: 'Partner', value: partnerName }}
                  />
                )
              }
              return <StatCard label="Relationship" value={ms} icon={Heart} />
            })()}
            {/* Stage — clickable selector */}
            {(() => {
              const currentStageObj = SURROGATE_STAGES.find(s => s.id === stageStatus.stage) || SURROGATE_STAGES[0]
              return (
                <div className="relative">
                  <div
                    className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                    onClick={() => { setStageOpen(!stageOpen); setStatusOpen(false) }}
                  >
                    <Milestone className="size-4 mx-auto mb-1" style={{ color: currentStageObj.color + '60' }} />
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Stage</p>
                    <p className="text-sm font-bold mt-0.5 leading-tight" style={{ color: currentStageObj.color }}>{currentStageObj.label}</p>
                  </div>
                  {stageOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setStageOpen(false)} />
                      <div className="absolute top-full right-0 mt-2 z-40 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden w-52">
                        <div className="py-1">
                          {SURROGATE_STAGES.filter(s => !s.hidden).map((stage, i) => (
                            <button
                              key={stage.id}
                              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                                stageStatus.stage === stage.id ? 'font-semibold' : 'text-stone-600 hover:bg-stone-50'
                              }`}
                              style={stageStatus.stage === stage.id ? { color: stage.color, backgroundColor: stage.color + '10' } : {}}
                              onClick={e => {
                                e.stopPropagation()
                                if (['not-qualified', 'withdrawn'].includes(stage.id)) {
                                  setStageConfirm({ stageId: stage.id })
                                  setStageOpen(false)
                                  return
                                }
                                const newStatus = getDefaultStatus(stage.id, 'gc')
                                setSurrogateStageStatus(surrogate.id, stage.id, newStatus)
                                setStageStatus({ stage: stage.id, status: newStatus })
                                setStageOpen(false)
                              }}
                            >
                              <span
                                className={`inline-flex items-center justify-center size-5 rounded-full text-[10px] font-bold text-white ${stageStatus.stage === stage.id ? '' : 'opacity-40'}`}
                                style={{ backgroundColor: stageStatus.stage === stage.id ? stage.color : '#a8a29e' }}
                              >
                                {i + 1}
                              </span>
                              {stage.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
            {/* Status — clickable selector */}
            {(() => {
              const currentStageObj = SURROGATE_STAGES.find(s => s.id === stageStatus.stage) || SURROGATE_STAGES[0]
              const availableStatuses = getStatusesForStage(stageStatus.stage, 'gc')
              return (
                <div className="relative">
                  <div
                    className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                    onClick={() => { setStatusOpen(!statusOpen); setStageOpen(false) }}
                  >
                    {stageStatus.status === 'New' ? (
                      <span className="relative flex size-4 mx-auto mb-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-4 bg-pink-500" />
                      </span>
                    ) : (
                      <Circle className="size-4 mx-auto mb-1" style={{ color: currentStageObj.color + '60' }} />
                    )}
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Status</p>
                    <p className="text-sm font-bold mt-0.5 leading-tight text-stone-800">{stageStatus.status}</p>
                  </div>
                  {statusOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setStatusOpen(false)} />
                      <div className="absolute top-full right-0 mt-2 z-40 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden w-56 max-h-64 overflow-y-auto">
                        <div className="py-1">
                          {availableStatuses.map(status => (
                            <button
                              key={status}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                                stageStatus.status === status ? 'font-semibold' : 'text-stone-600 hover:bg-stone-50'
                              }`}
                              style={stageStatus.status === status ? { color: currentStageObj.color, backgroundColor: currentStageObj.color + '10' } : {}}
                              onClick={e => {
                                e.stopPropagation()
                                setSurrogateStageStatus(surrogate.id, stageStatus.stage, status)
                                setStageStatus({ stage: stageStatus.stage, status })
                                setStatusOpen(false)
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: stageStatus.status === status ? currentStageObj.color : '#d6d3d1' }} />
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </div>

          {/* GTPAL + Pregnancy History */}
          {gtpal && (
            <div className="rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50/60 to-indigo-50/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Baby className="size-4 text-pink-400" />
                <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Pregnancy History</span>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <span className="font-mono text-xl font-bold tracking-wider" style={{ color: '#283693' }}>
                  G{gtpal.g}P{gtpal.t}{gtpal.p}{gtpal.a}{gtpal.l}
                </span>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <GTPALChip label="Pregnancies" value={gtpal.g} color="#283693" />
                  <GTPALChip label="Term" value={gtpal.t} color="#10b981" />
                  <GTPALChip label="Preterm" value={gtpal.p} color="#f59e0b" />
                  <GTPALChip label="Losses" value={gtpal.a} color="#ef4444" />
                  <GTPALChip label="Living" value={gtpal.l} color="#8b5cf6" />
                </div>
              </div>
            </div>
          )}

          {/* Match Notes */}
          <MatchNotesPreview
            notes={quizAnswers?._matchNotes}
            onClick={() => setMatchNotesOpen(true)}
          />
        </div>
      </div>

      {/* Match Notes Dialog */}
      <MatchNotesDialog
        open={matchNotesOpen}
        onOpenChange={setMatchNotesOpen}
        caseId={surrogate.id}
        answers={quizAnswers || {}}
        currentUser={currentUser}
        onSaved={(updated) => setQuizAnswers(updated)}
      />

      {/* Quick Note */}
      <QuickNote caseId={surrogate.id} caseType="gc" />

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <SortableTabsList configKey={`surrogate_${surrogate.id}`} tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'contact', label: 'Application' },
          { value: 'profile', label: 'Profile' },
          { value: 'records', label: (() => {
            const rt = recordTracking || {}
            const pregs = profileData?.pregnancyHistory?.pregnancies || []
            const numP = parseInt(profileData?.pregnancyHistory?.numberOfPregnancies) || 0
            let stepIds = []
            for (let i = 0; i < Math.max(numP, pregs.length); i++) {
              stepIds.push(`ob_records_${i}`, `delivery_records_${i}`)
              if (pregs[i]?.wasSurrogacy === 'yes') stepIds.push(`ivf_records_${i}`)
            }
            for (const k of Object.keys(rt)) {
              if (k.startsWith('custom_record_') && !stepIds.includes(k)) stepIds.push(k)
            }
            const active = stepIds.filter(k => rt[k]?.status !== 'na')
            const done = active.filter(k => rt[k]?.status === 'complete')
            return active.length > 0 ? <span>Medical Records <span className="text-[10px] text-stone-400">{done.length}/{active.length}</span></span> : 'Medical Records'
          })() },
          { value: 'documents', label: 'Documents' },
          { value: 'texts', label: <span className="flex items-center gap-1.5" onClick={() => setHasUnreadTexts(false)}>Texts{hasUnreadTexts && <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" /><span className="relative inline-flex rounded-full size-2 bg-pink-500" /></span>}</span> },
          { value: 'insurance', label: 'Insurance' },
          { value: 'emails', label: <span className="flex items-center gap-1.5">Emails{unreadEmailCount > 0 && <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" /><span className="relative inline-flex rounded-full size-2 bg-pink-500" /></span>}</span> },
          { value: 'notes', label: 'Notes' },
          ...(quizAnswers?._matchHistory?.length ? [{ value: 'previous-match', label: 'Previous Match' }] : []),
        ]} />

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <OverviewTab surrogate={surrogate} screening={screening} heightStr={heightStr} profileData={profileData} recordTracking={recordTracking} updateRecord={updateRecord} currentUserName={currentUser.name} stageId={stageStatus?.stage || 'pre-qualification'} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CaseCalendarWidget caseId={surrogate.id} caseType="surrogate" caseName={surrogate.name} />
            <CaseTasksWidget caseId={surrogate.id} caseType="surrogate" caseName={surrogate.name} />
          </div>
          {/* Checklist */}
          {(() => {
            const currentStageId = stageStatus?.stage || 'pre-qualification'
            const currentStageLabel = SURROGATE_STAGES.find(s => s.id === currentStageId)?.label || 'Pre-Qualification'
            const allSteps = getChecklistSteps('gc', currentStageId).filter(s => s.type !== 'info_row')
            return (
              <TrackingTable
                title={`${currentStageLabel} Checklist`}
                steps={allSteps}
                statuses={CHECKLIST_STEP_STATUSES}
                tracking={recordTracking}
                onUpdate={updateRecord}
                currentUserName={currentUser.name}
                onStatusLog={async ({ stepLabel, status, optionLabel, by, date }) => {
                  // Auto-email when Records Summary is requested
                  if (status === 'requested' && stepLabel.toLowerCase().includes('records summary')) {
                    try {
                      const gtp = getGTPAL(profileData)
                      const gtpalStr = gtp ? `G${gtp.g}P${gtp.t}${gtp.p}${gtp.a}${gtp.l}` : null
                      await fetch('/api/notify-records-summary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ surrogateName: surrogate.name, surrogateId: surrogate.id, gtpal: gtpalStr, gtpalData: gtp }),
                      })
                    } catch (err) { console.error('Records summary notify failed:', err) }
                  }
                  // Auto-create follow-up tasks for "Connect with Applicant" attempts
                  if (stepLabel.toLowerCase().includes('connect with applicant') && optionLabel) {
                    const name = surrogate.name || 'Surrogate'
                    const logDate = date || new Date().toISOString().split('T')[0]
                    const addDays = (d, n) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0] }
                    let taskTitle = null, daysOut = 0
                    const attempt = optionLabel.toLowerCase()
                    if (attempt.includes('1st')) { taskTitle = `Reach out to ${name} - 2nd Attempt`; daysOut = 2 }
                    else if (attempt.includes('2nd')) { taskTitle = `Reach out to ${name} - 3rd Attempt`; daysOut = 7 }
                    else if (attempt.includes('3rd')) { taskTitle = `Reach out to ${name} - 4th Attempt`; daysOut = 14 }
                    else if (attempt.includes('4th')) { taskTitle = `Mark ${name} as Withdrawn - Ghosted`; daysOut = 1 }
                    if (taskTitle) {
                      try {
                        await createCaseTask({
                          title: taskTitle,
                          due_date: addDays(logDate, daysOut),
                          priority: attempt.includes('4th') ? 'high' : 'normal',
                          assigned_to: currentUser?.email,
                          created_by: currentUser?.email,
                          status: 'open',
                          case_id: surrogate.id,
                          case_type: 'surrogate',
                        })
                      } catch (err) { console.error('Auto-task creation failed:', err) }
                    }
                  }
                  // Auto-create incentive payment tasks on Medical Clearance / Legal Clearance complete
                  if (status === 'complete') {
                    const julieEmail = 'julie@abcsurrogacy.com'
                    const sName = surrogate.name || 'Surrogate'
                    const logDt = date || new Date().toISOString().split('T')[0]
                    const lbl = stepLabel.toLowerCase()
                    const ans = surrogate.answers || {}
                    const src = ans.hearAboutUs || ''
                    const isRef = src.toLowerCase().includes('friend') || src.toLowerCase().includes('family')
                    const refName = ans.referralName || ans.hearAboutUsOther || 'Referrer'

                    if (lbl.includes('medical clearance')) {
                      if (isRef) {
                        try { await createCaseTask({ title: `Pay 1st Referral Incentive to ${refName} for ${sName}'s Medical Clearance`, due_date: logDt, priority: 'high', assigned_to: julieEmail, created_by: currentUser?.email, status: 'open', case_id: surrogate.id, case_type: 'surrogate' }) } catch {}
                      }
                      try { await createCaseTask({ title: `Pay 1st Screening Incentive to ${sName}`, due_date: logDt, priority: 'high', assigned_to: julieEmail, created_by: currentUser?.email, status: 'open', case_id: surrogate.id, case_type: 'surrogate' }) } catch {}
                    }

                    if (lbl.includes('legal clearance')) {
                      if (isRef) {
                        try { await createCaseTask({ title: `Pay 2nd Referral Incentive to ${refName} for ${sName}'s Legal Clearance`, due_date: logDt, priority: 'high', assigned_to: julieEmail, created_by: currentUser?.email, status: 'open', case_id: surrogate.id, case_type: 'surrogate' }) } catch {}
                      }
                      try { await createCaseTask({ title: `Pay 2nd Screening Incentive to ${sName}`, due_date: logDt, priority: 'high', assigned_to: julieEmail, created_by: currentUser?.email, status: 'open', case_id: surrogate.id, case_type: 'surrogate' }) } catch {}
                    }
                  }
                }}
              />
            )
          })()}
        </TabsContent>

        {/* Application Tab */}
        <TabsContent value="contact" className="mt-4 space-y-4">
          <GCApplicationTab surrogate={surrogate} setSurrogate={setSurrogate} quizAnswers={quizAnswers} setQuizAnswers={setQuizAnswers} profileData={profileData} />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          <ProfileTab
            surrogate={surrogate}
            setSurrogate={setSurrogate}
            profileData={profileData}
            setProfileData={setProfileData}
            profileStatus={profileStatus}
            setProfileStatus={setProfileStatus}
            photos={photos}
            setPhotos={setPhotos}
            portraitUrl={portraitUrl}
            heightStr={heightStr}
            quizAnswers={quizAnswers}
            setQuizAnswers={setQuizAnswers}
            insuranceStatus={insuranceStatus}
          />
        </TabsContent>

        {/* Checklist tab removed — now in Overview */}

        {/* Medical Records Tab */}
        <TabsContent value="records" className="mt-4 space-y-6">
          {(() => {
            const pregnancies = profileData?.pregnancyHistory?.pregnancies || []
            const numPreg = parseInt(profileData?.pregnancyHistory?.numberOfPregnancies) || 0
            if (numPreg === 0) {
              return (
                <Card className="rounded-2xl">
                  <CardContent className="py-12 text-center">
                    <Circle className="size-8 text-stone-200 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Complete the Pregnancy History in the Profile tab to auto-generate required medical records.</p>
                  </CardContent>
                </Card>
              )
            }
            const medSteps = []
            for (let i = 0; i < Math.max(numPreg, pregnancies.length); i++) {
              const p = pregnancies[i] || {}
              const year = p.dob ? new Date(p.dob).getFullYear() : ''
              const yearLabel = year || `#${i + 1}`
              medSteps.push({ id: `ob_records_${i}`, label: `OB ${yearLabel}`, canToggleNA: true, badge: { label: 'OB', color: 'bg-blue-100 text-blue-700' } })
              medSteps.push({ id: `delivery_records_${i}`, label: `Delivery ${yearLabel}`, canToggleNA: true, badge: { label: 'Delivery', color: 'bg-purple-100 text-purple-700' } })
              if (p.wasSurrogacy === 'yes') {
                medSteps.push({ id: `ivf_records_${i}`, label: `IVF ${yearLabel}`, canToggleNA: true, badge: { label: 'IVF', color: 'bg-pink-100 text-pink-700' } })
              }
            }
            // Also include any custom-added records from tracking data
            const customPrefix = 'custom_record_'
            for (const key of Object.keys(recordTracking)) {
              if (key.startsWith(customPrefix) && !medSteps.some(s => s.id === key)) {
                const rt = recordTracking[key] || {}
                const badgeType = rt.recordType || 'OB'
                const BADGE_MAP = {
                  'OB': { label: 'OB', color: 'bg-blue-100 text-blue-700' },
                  'Delivery': { label: 'Delivery', color: 'bg-purple-100 text-purple-700' },
                  'IVF': { label: 'IVF', color: 'bg-pink-100 text-pink-700' },
                  'PAP': { label: 'PAP', color: 'bg-amber-100 text-amber-700' },
                }
                medSteps.push({
                  id: key,
                  label: rt.customLabel || key.replace(customPrefix, '').replace(/_/g, ' '),
                  canToggleNA: true,
                  badge: BADGE_MAP[badgeType] || BADGE_MAP['OB'],
                })
              }
            }
            return (
              <MedicalRecordsSection
                medSteps={medSteps}
                statuses={MEDICAL_RECORD_STATUSES}
                tracking={recordTracking}
                onUpdate={updateRecord}
                currentUserName={currentUser.name}
                onStatusLog={async ({ stepLabel, status, by }) => {
                  if (status === 'fax_received') {
                    try {
                      const task = await createCaseTask({
                        case_id: Number(surrogate.id),
                        case_type: 'surrogate',
                        title: `Fax Received - Verify if ${stepLabel} are complete`,
                        assigned_to: currentUser?.email || '',
                        due_date: new Date().toISOString().split('T')[0],
                        priority: 'normal',
                        status: 'open',
                        created_by: currentUser?.email || '',
                      })
                      console.log('Auto-task created:', task)
                    } catch (err) {
                      console.error('Auto-task failed:', err)
                      alert('Task creation failed: ' + (err.message || 'Unknown error'))
                    }
                  }
                }}
              />
            )
          })()}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab surrogateId={surrogate.id} surrogateData={{ name: surrogate.name, dob: quizAnswers?._confidential?.dob || quizAnswers?.dob, answers: quizAnswers }} />
        </TabsContent>

        {/* Texts Tab */}
        <TabsContent value="texts" className="mt-4">
          <CaseTextsTab phone={surrogate.phone} caseName={surrogate.name} />
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance" className="mt-4">
          <InsuranceTab caseId={surrogate.id} caseType="surrogate" surrogateNameForDisplay={surrogate.name} />
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="mt-4">
          <CaseEmailsTab caseId={surrogate.id} caseType="gc" caseName={surrogate.name} caseEmail={surrogate.email} caseManagerName={getAdminStaff().find(a => a.email === surrogate.assignedTo)?.name} contactEmails={[surrogate.email].filter(Boolean)} onUnreadCount={setUnreadEmailCount} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Notes ({notes.length})</CardTitle>
              <Dialog open={noteAddOpen} onOpenChange={v => { setNoteAddOpen(v); if (!v) setNoteText('') }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
                    <Plus className="size-3.5" /> Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                  </DialogHeader>
                  <RichTextEditor
                    content={noteText}
                    onChange={setNoteText}
                    placeholder="Write a note..."
                  />
                  <Button
                    onClick={async () => {
                      if (!noteText || noteText === '<p></p>') return
                      setNoteSaving(true)
                      try {
                        const note = await insertCaseNote({
                          surrogateId: surrogate.id,
                          authorName: currentUser.name,
                          authorEmail: currentUser.email,
                          content: noteText,
                        })
                        if (note) setNotes(prev => [note, ...prev])
                        setNoteText('')
                        setNoteAddOpen(false)
                      } catch {} finally { setNoteSaving(false) }
                    }}
                    disabled={noteSaving || !noteText || noteText === '<p></p>'}
                    className="w-full"
                    style={{ backgroundColor: '#283693', color: '#fff' }}
                  >
                    {noteSaving ? 'Saving...' : 'Save Note'}
                  </Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
              ) : notes.map(note => (
                <div key={note.id} className="rounded-xl border border-stone-100 bg-stone-50/50 p-4 space-y-2">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <RichTextEditor
                        content={editNoteText}
                        onChange={setEditNoteText}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                        <Button
                          size="sm"
                          style={{ backgroundColor: '#283693', color: '#fff' }}
                          disabled={noteSaving || !editNoteText || editNoteText === '<p></p>'}
                          onClick={async () => {
                            setNoteSaving(true)
                            try {
                              await updateCaseNote(note.id, editNoteText)
                              setNotes(prev => prev.map(n => n.id === note.id ? { ...n, content: editNoteText, updated_at: new Date().toISOString() } : n))
                              setEditingNoteId(null)
                            } catch {} finally { setNoteSaving(false) }
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <RichTextDisplay content={note.content} />
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs text-stone-400">
                          <span className="font-medium text-stone-500">{note.author_name}</span>
                          {' · '}
                          {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {note.updated_at !== note.created_at && ' (edited)'}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content) }}
                          >
                            <Pencil className="size-3 text-stone-400" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            onClick={() => setDeleteConfirmId(note.id)}
                          >
                            <Trash2 className="size-3 text-stone-400" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Delete confirmation */}
          <Dialog open={deleteConfirmId !== null} onOpenChange={v => { if (!v) setDeleteConfirmId(null) }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="size-5" /> Delete Note
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-stone-600">This action is permanent and cannot be undone. Are you sure you want to delete this note?</p>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                <Button
                  variant="destructive" size="sm"
                  onClick={async () => {
                    try {
                      await deleteCaseNote(deleteConfirmId)
                      setNotes(prev => prev.filter(n => n.id !== deleteConfirmId))
                    } catch {} finally { setDeleteConfirmId(null) }
                  }}
                >
                  Delete Permanently
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Previous Match Tab */}
        {quizAnswers?._matchHistory?.length > 0 && (
          <TabsContent value="previous-match" className="mt-4">
            <PreviousMatchTab matchHistory={quizAnswers._matchHistory} />
          </TabsContent>
        )}
      </Tabs>

      {/* Insurance Dialog */}
      <Dialog open={insuranceOpen} onOpenChange={setInsuranceOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><InsuranceCardIcon size={18} color="#283693" /> Insurance — {surrogate.name}</DialogTitle>
          </DialogHeader>
          <InsuranceTab caseId={surrogate.id} caseType="surrogate" surrogateNameForDisplay={surrogate.name} />
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-4" />
              Text {surrogate.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-stone-500">
              To: <span className="font-medium text-stone-700">{surrogate.phone}</span>
            </div>
            <Textarea
              value={smsMessage}
              onChange={e => setSmsMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="resize-none"
              disabled={smsSending}
            />
            <p className="text-[11px] text-stone-400">Sent from ABC Surrogacy's Twilio number. Trial accounts can only text verified numbers.</p>
            {smsResult === 'sent' && (
              <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="size-4" /> Message sent successfully!
              </div>
            )}
            {smsResult && smsResult !== 'sent' && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {smsResult}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSmsOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!smsMessage.trim()) return
                setSmsSending(true)
                setSmsResult(null)
                try {
                  await sendSMS(surrogate.phone, smsMessage.trim())
                  setSmsResult('sent')
                  setSmsMessage('')
                } catch (err) {
                  setSmsResult(err.message || 'Failed to send. Check Twilio configuration.')
                }
                setSmsSending(false)
              }}
              disabled={!smsMessage.trim() || smsSending}
              className="gap-1.5"
              style={{ backgroundColor: '#283693' }}
            >
              {smsSending ? 'Sending...' : 'Send Text'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Documents Tab ──────────────────────────────────────────
const DOC_CATEGORIES = [
  { id: 'photo-id', label: 'Photo IDs', icon: FileImage, color: '#ed148c' },
  { id: 'agency-documents', label: 'Agency Documents', icon: FileText, color: '#283693' },
  { id: 'clinic', label: 'Clinic', icon: FileText, color: '#10b981' },
  { id: 'medical-records', label: 'Medical Records', icon: FileText, color: '#8b5cf6' },
  { id: 'insurance', label: 'Insurance', icon: FileText, color: '#f59e0b' },
  { id: 'legal', label: 'Legal Documents', icon: FileText, color: '#723bb4' },
  { id: 'background-check', label: 'Background Check', icon: FileText, color: '#c4219a' },
  { id: 'psych-evaluation', label: 'Psych Evaluation', icon: FileText, color: '#4d3da4' },
  { id: 'escrow', label: 'Escrow', icon: FileText, color: '#0ea5e9' },
  { id: 'expenses', label: 'Expenses', icon: FileText, color: '#f97316' },
  { id: 'photos', label: 'Photos', icon: FileImage, color: '#ec4899' },
  { id: 'e-signature', label: 'E-Signature', icon: FileText, color: '#283693' },
  { id: 'uploads', label: 'Client Uploads', icon: Upload, color: '#0891b2' },
  { id: 'other', label: 'Other', icon: File, color: '#6b7280' },
]

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType) {
  if (fileType?.startsWith('image/')) return FileImage
  return FileText
}

function SortableCategoryCard({ cat, catDocs, uploading, uploadCategory, onUploadClick, onFileDrop, DocRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto' }
  const Icon = cat.icon
  const [dragOver, setDragOver] = useState(false)

  function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
  function handleDragLeave(e) { e.preventDefault(); e.stopPropagation(); setDragOver(false) }
  function handleDrop(e) {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) onFileDrop(cat.id, files)
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`rounded-2xl overflow-hidden h-full transition-all ${dragOver ? 'ring-2 ring-[#283693] shadow-lg scale-[1.02]' : ''}`}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: cat.color + '0a' }}>
          <div className="flex items-center gap-2.5">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-white/50">
              <GripVertical className="size-4 text-stone-300" />
            </div>
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '18' }}>
              <Icon className="size-4" style={{ color: cat.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">{cat.label}</p>
              <p className="text-[10px] text-stone-400">{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-white/50" disabled={uploading}
            onClick={() => onUploadClick(cat.id)}>
            {uploading && uploadCategory === cat.id
              ? <Loader2 className="size-3.5 animate-spin text-stone-400" />
              : <Upload className="size-3.5" style={{ color: cat.color }} />}
          </Button>
        </div>
        <CardContent className="p-0">
          {catDocs.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {catDocs.map(doc => <DocRow key={doc.id} doc={doc} />)}
            </div>
          ) : (
            <div className={`px-4 py-6 text-center ${dragOver ? 'bg-[#283693]/5' : ''}`}>
              <FolderOpen className="size-6 text-stone-200 mx-auto mb-1.5" />
              <p className="text-[11px] text-stone-400">{dragOver ? 'Drop files here' : 'No files yet'}</p>
              <button className="text-[11px] font-medium mt-1 hover:underline" style={{ color: cat.color }}
                onClick={() => onUploadClick(cat.id)}>
                Upload
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function DocumentsTab({ surrogateId, additionalCaseIds, caseLabels, surrogateData }) {
  const { currentUser } = useRole()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState(null)
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [editingDoc, setEditingDoc] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [faxDoc, setFaxDoc] = useState(null)
  const [faxNumber, setFaxNumber] = useState('')
  const [faxSending, setFaxSending] = useState(false)
  const [faxResult, setFaxResult] = useState(null)
  const [faxIncludeDL, setFaxIncludeDL] = useState(true)
  const [faxSubject, setFaxSubject] = useState('')
  const [faxMessage, setFaxMessage] = useState('')
  const [faxToName, setFaxToName] = useState('')
  const [faxSignatureHtml, setFaxSignatureHtml] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docView, setDocView] = useState('grid') // 'grid' | 'list'
  const [categoryOrder, setCategoryOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('abc_doc_category_order')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DOC_CATEGORIES.map(c => c.id)
  })
  const uploadCategoryRef = useRef(null)
  const [zipFiles, setZipFiles] = useState(null) // extracted zip files awaiting assignment
  const [zipPreviewIdx, setZipPreviewIdx] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null) // { done: N, total: N }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor))

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setCategoryOrder(prev => {
      const oldIdx = prev.indexOf(active.id)
      const newIdx = prev.indexOf(over.id)
      const updated = arrayMove(prev, oldIdx, newIdx)
      localStorage.setItem('abc_doc_category_order', JSON.stringify(updated))
      return updated
    })
  }

  const orderedCategories = categoryOrder.map(id => DOC_CATEGORIES.find(c => c.id === id)).filter(Boolean)

  useEffect(() => {
    async function loadDocs() {
      try {
        const primary = await fetchCaseDocuments(surrogateId)
        let allDocs = (primary || []).map(d => ({ ...d, _source: caseLabels?.[surrogateId] || null }))
        if (additionalCaseIds?.length) {
          for (const caseId of additionalCaseIds) {
            const extra = await fetchCaseDocuments(caseId)
            if (extra?.length) {
              allDocs = [...allDocs, ...extra.map(d => ({ ...d, _source: caseLabels?.[caseId] || 'Other' }))]
            }
          }
        }
        setDocs(allDocs)
      } catch {} finally { setLoading(false) }
    }
    loadDocs()
  }, [surrogateId])

  // Filter by search
  const filteredDocs = docSearch
    ? docs.filter(d => d.file_name.toLowerCase().includes(docSearch.toLowerCase()) || DOC_CATEGORIES.find(c => c.id === d.category)?.label.toLowerCase().includes(docSearch.toLowerCase()))
    : docs

  const docsByCategory = {}
  for (const cat of DOC_CATEGORIES) docsByCategory[cat.id] = []
  for (const doc of filteredDocs) {
    if (docsByCategory[doc.category]) docsByCategory[doc.category].push(doc)
    else docsByCategory['other'].push(doc)
  }

  function triggerUpload(categoryId) {
    uploadCategoryRef.current = categoryId
    setUploadCategory(categoryId)
    document.getElementById('doc-upload-input')?.click()
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    const cat = uploadCategoryRef.current
    if (!files.length || !cat) return
    // Check for zip files
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip')
    if (zipFile) {
      await extractZip(zipFile)
      e.target.value = ''
      setUploading(false)
      setUploadCategory(null)
      return
    }
    setUploading(true)
    try {
      for (const file of files) {
        const doc = await uploadCaseDocument({ surrogateId, category: cat, file, uploadedBy: currentUser.name })
        if (doc) setDocs(prev => [doc, ...prev])
      }
    } catch {} finally { setUploading(false); setUploadCategory(null); uploadCategoryRef.current = null; e.target.value = '' }
  }

  async function handleFileDrop(categoryId, files) {
    // Check for zip
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip')
    if (zipFile) {
      await extractZip(zipFile)
      return
    }
    setUploadCategory(categoryId)
    setUploading(true)
    try {
      for (const file of files) {
        const doc = await uploadCaseDocument({ surrogateId, category: categoryId, file, uploadedBy: currentUser.name })
        if (doc) setDocs(prev => [doc, ...prev])
      }
    } catch {} finally { setUploading(false); setUploadCategory(null) }
  }

  async function extractZip(zipFile) {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(zipFile)
      const extracted = []
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || path.startsWith('__MACOSX') || path.includes('/.')) continue
        const blob = await entry.async('blob')
        const name = path.split('/').pop()
        if (!name) continue
        const ext = name.split('.').pop().toLowerCase()
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' }
        const mime = mimeMap[ext] || blob.type || 'application/octet-stream'
        const file = new window.File([blob], name, { type: mime })
        const previewUrl = ['jpg','jpeg','png','gif','webp','pdf'].includes(ext) ? URL.createObjectURL(file) : null
        extracted.push({ file, name, category: 'other', previewUrl, ext })
      }
      if (extracted.length > 0) setZipFiles(extracted)
    } catch (err) {
      console.error('ZIP extraction failed:', err)
    }
  }

  async function uploadBatch(files, getCategoryForItem) {
    const total = files.length
    let done = 0
    setUploadProgress({ done: 0, total })
    setUploading(true)
    const BATCH_SIZE = 5
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(item => {
          const file = item.file instanceof window.File ? item.file : new window.File([item.file], item.name, { type: item.file.type })
          return uploadCaseDocument({ surrogateId, category: getCategoryForItem(item), file, uploadedBy: currentUser.name })
        })
      )
      for (const r of results) {
        done++
        setUploadProgress({ done, total })
        if (r.status === 'fulfilled' && r.value) setDocs(prev => [r.value, ...prev])
      }
    }
    setUploading(false)
    setUploadProgress(null)
  }

  async function uploadZipFiles() {
    if (!zipFiles) return
    await uploadBatch(zipFiles, item => item.category)
    setZipFiles(null)
  }

  async function handleDelete() {
    if (!deleteConfirmDoc) return
    try {
      await deleteCaseDocument(deleteConfirmDoc.id, deleteConfirmDoc.storage_path)
      setDocs(prev => prev.filter(d => d.id !== deleteConfirmDoc.id))
      if (previewDoc?.id === deleteConfirmDoc.id) setPreviewDoc(null)
    } catch {} finally { setDeleteConfirmDoc(null) }
  }

  async function handleEditSave() {
    if (!editingDoc) return
    setEditSaving(true)
    try {
      const updates = {}
      if (editName !== editingDoc.file_name) updates.file_name = editName
      if (editCategory !== editingDoc.category) updates.category = editCategory
      if (editLabel !== (editingDoc.doc_label || '')) updates.doc_label = editLabel || null
      if (Object.keys(updates).length > 0) {
        await updateCaseDocument(editingDoc.id, updates)
        setDocs(prev => prev.map(d => d.id === editingDoc.id ? { ...d, ...updates } : d))
      }
      setEditingDoc(null)
    } catch {} finally { setEditSaving(false) }
  }

  function startEdit(doc) {
    setEditingDoc(doc)
    setEditName(doc.file_name)
    setEditCategory(doc.category)
    setEditLabel(doc.doc_label || '')
  }

  function isPreviewable(fileType) {
    return fileType?.startsWith('image/') || fileType === 'application/pdf'
  }

  // File row used in both grid and list
  function DocRow({ doc, compact }) {
    const DocIcon = getFileIcon(doc.file_type)
    const cat = DOC_CATEGORIES.find(c => c.id === doc.category)
    return (
      <div className={`flex items-center gap-3 group hover:bg-stone-50/50 transition-colors ${compact ? 'px-4 py-2' : 'px-4 py-2.5'}`}>
        <DocIcon className="size-4 text-stone-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-stone-700 truncate">{doc.file_name}</p>
          <p className="text-[10px] text-stone-400">
            {formatFileSize(doc.file_size)}
            {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ''}
            {' · '}
            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {doc.doc_label && <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{{ gc: 'GC', ip1: 'IP1', ip2: 'IP2', partner: 'Partner' }[doc.doc_label] || doc.doc_label}</span>}
            {compact && cat ? ` · ${cat.label}` : ''}
            {doc._source && <span className="ml-1.5 text-[9px] font-semibold px-1 py-0.5 rounded-full bg-stone-100 text-stone-500">{doc._source}</span>}
            {!doc._source && doc.uploaded_by?.startsWith('Previous Match') && <span className="ml-1.5 text-[9px] font-semibold px-1 py-0.5 rounded-full bg-amber-50 text-amber-600">Previous Match</span>}
          </p>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isPreviewable(doc.file_type) && (
            <button className="size-7 rounded-full flex items-center justify-center hover:bg-stone-100" onClick={() => setPreviewDoc(doc)} title="Preview">
              <Eye className="size-3 text-stone-400" />
            </button>
          )}
          <a href={doc.public_url} target="_blank" rel="noopener noreferrer"
            className="size-7 rounded-full flex items-center justify-center hover:bg-stone-100" onClick={e => e.stopPropagation()} title="Download">
            <Download className="size-3 text-stone-400" />
          </a>
          {doc.file_type === 'application/pdf' && (
            <button className="size-7 rounded-full flex items-center justify-center hover:bg-blue-50" onClick={() => {
              const sd = surrogateData || {}
              const name = sd.name || ''
              const dob = sd.dob ? new Date(sd.dob).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''
              setFaxDoc(doc)
              setFaxSubject(`STAT! ABC Surrogacy requesting ALL Medical Records for ${name}${dob ? ` (DOB: ${dob})` : ''}`)
              setFaxMessage(`Please find the attached medical records release form for patient ${name}${dob ? ` (DOB: ${dob})` : ''}. Please send <b><u>ALL</u></b> medical records, reports, lab reports, discharge notes, and Doctor notes to either desiree@abcsurrogacy.com or fax to: 323-843-9433.\n\nThank you so much!`)
              setFaxIncludeDL(true)
              // Fetch current user's Gmail signature
              import('@/lib/google').then(({ getGmailSignature }) => {
                if (currentUser?.id) getGmailSignature(currentUser.id).then(html => setFaxSignatureHtml(html || '')).catch(() => {})
              })
            }} title="Fax">
              <Printer className="size-3 text-stone-400" />
            </button>
          )}
          <button className="size-7 rounded-full flex items-center justify-center hover:bg-stone-100" onClick={() => startEdit(doc)} title="Edit">
            <Pencil className="size-3 text-stone-400" />
          </button>
          <button className="size-7 rounded-full flex items-center justify-center hover:bg-red-50" onClick={() => setDeleteConfirmDoc(doc)} title="Delete">
            <Trash2 className="size-3 text-stone-400" />
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading documents...</div>

  return (
    <div className="space-y-4">
      <input type="file" multiple className="hidden" id="doc-upload-input" onChange={handleUpload}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.webp,.txt,.xls,.xlsx,.zip" />

      {/* ZIP extraction assignment dialog */}
      {zipFiles && (
        <Card className="rounded-2xl border-2 border-[#283693]/30 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assign Extracted Files ({zipFiles.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setZipFiles(null)}>Cancel</Button>
              <Button size="sm" onClick={uploadZipFiles} disabled={uploading} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {uploadProgress ? `${uploadProgress.done}/${uploadProgress.total}` : 'Upload All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {uploadProgress && (
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Uploading {uploadProgress.done} of {uploadProgress.total} files...</span>
                  <span>{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
                </div>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr_auto] bg-gray-50 border-b border-gray-200 px-4 py-2 gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase w-8"></span>
                <span className="text-xs font-semibold text-gray-500 uppercase">File Name</span>
                <span className="text-xs font-semibold text-gray-500 uppercase">Folder</span>
                <span className="text-xs font-semibold text-gray-500 uppercase w-8"></span>
              </div>
              {zipFiles.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] items-center px-4 py-2 border-b border-gray-100 last:border-0 gap-2">
                  {item.previewUrl ? (
                    <button className="p-1 rounded hover:bg-[#283693]/10 text-[#283693]" onClick={() => setZipPreviewIdx(idx)} title="Preview">
                      <Eye className="size-4" />
                    </button>
                  ) : (
                    <div className="w-6" />
                  )}
                  <input
                    className="rounded border border-gray-200 px-2 py-1 text-sm bg-white"
                    value={item.name}
                    onChange={e => setZipFiles(prev => prev.map((f, i) => i === idx ? { ...f, name: e.target.value } : f))}
                  />
                  <SelectUI value={item.category} onValueChange={v => setZipFiles(prev => prev.map((f, i) => i === idx ? { ...f, category: v } : f))}>
                    <SelectTriggerUI className="h-8 text-xs"><SelectValueUI /></SelectTriggerUI>
                    <SelectContentUI>
                      {DOC_CATEGORIES.map(c => <SelectItemUI key={c.id} value={c.id}>{c.label}</SelectItemUI>)}
                    </SelectContentUI>
                  </SelectUI>
                  <button className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                    onClick={() => setZipFiles(prev => prev.filter((_, i) => i !== idx))}>
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {/* Zip file preview overlay */}
            {zipPreviewIdx !== null && zipFiles[zipPreviewIdx]?.previewUrl && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setZipPreviewIdx(null)}>
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-3 border-b">
                    <p className="text-sm font-semibold text-stone-800 truncate">{zipFiles[zipPreviewIdx].name}</p>
                    <div className="flex items-center gap-2">
                      {zipPreviewIdx > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setZipPreviewIdx(prev => { let n = prev - 1; while (n >= 0 && !zipFiles[n]?.previewUrl) n--; return n >= 0 ? n : prev })}>
                          ← Prev
                        </Button>
                      )}
                      {zipPreviewIdx < zipFiles.length - 1 && (
                        <Button variant="outline" size="sm" onClick={() => setZipPreviewIdx(prev => { let n = prev + 1; while (n < zipFiles.length && !zipFiles[n]?.previewUrl) n++; return n < zipFiles.length ? n : prev })}>
                          Next →
                        </Button>
                      )}
                      <button className="p-1.5 rounded-full hover:bg-stone-100" onClick={() => setZipPreviewIdx(null)}>
                        <X className="size-4 text-stone-500" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto flex items-center justify-center bg-stone-50 p-4">
                    {zipFiles[zipPreviewIdx].ext === 'pdf' ? (
                      <iframe src={zipFiles[zipPreviewIdx].previewUrl} className="w-full h-[80vh] border-0" />
                    ) : (
                      <img src={zipFiles[zipPreviewIdx].previewUrl} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-sm" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Toolbar: search + view toggle + send for signature */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={docSearch} onChange={e => setDocSearch(e.target.value)} className="pl-9" />
        </div>
        <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}
          onClick={() => window.open(`/e-signature?caseType=gc&caseId=${surrogateId}`, '_blank')}>
          <FileText className="size-4" /> Send for Signature
        </Button>
        <Button variant="outline" className="gap-1.5"
          onClick={() => window.open(`/fax?caseType=gc&caseId=${surrogateId}`, '_blank')}>
          <Printer className="size-4" /> Send Fax
        </Button>
        <div className="flex items-center border rounded-md">
          <Button variant={docView === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setDocView('grid')}>
            <LayoutGrid className="size-4" />
          </Button>
          <Button variant={docView === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setDocView('list')}>
            <ListIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Grid view — sortable cards per category */}
      {docView === 'grid' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categoryOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderedCategories.map(cat => {
                const catDocs = docsByCategory[cat.id]
                // Hide empty categories when searching
                if (docSearch && catDocs.length === 0) return null
                return <SortableCategoryCard key={cat.id} cat={cat} catDocs={catDocs} uploading={uploading} uploadCategory={uploadCategory} onUploadClick={triggerUpload} onFileDrop={handleFileDrop} DocRow={DocRow} />
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        /* List view — flat table */
        <Card className="rounded-2xl overflow-hidden">
          <div className="divide-y divide-stone-100">
            {filteredDocs.length > 0 ? filteredDocs.map(doc => (
              <DocRow key={doc.id} doc={doc} compact />
            )) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {docSearch ? 'No documents match your search.' : 'No documents yet.'}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Preview overlay ─────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-4 text-stone-400 shrink-0" />
                <p className="text-sm font-semibold text-stone-800 truncate">{previewDoc.file_name}</p>
                <span className="text-xs text-stone-400">{formatFileSize(previewDoc.file_size)}</span>
              </div>
              <div className="flex items-center gap-1">
                <a href={previewDoc.public_url} target="_blank" rel="noopener noreferrer"
                  className="size-8 rounded-full flex items-center justify-center hover:bg-stone-100">
                  <Download className="size-4 text-stone-500" />
                </a>
                <button className="size-8 rounded-full flex items-center justify-center hover:bg-stone-100" onClick={() => setPreviewDoc(null)}>
                  <X className="size-4 text-stone-500" />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto bg-stone-100 flex items-center justify-center">
              {previewDoc.file_type?.startsWith('image/') ? (
                <img src={previewDoc.public_url} alt={previewDoc.file_name} className="max-w-full max-h-[80vh] object-contain" />
              ) : previewDoc.file_type === 'application/pdf' ? (
                <iframe src={previewDoc.public_url} className="w-full h-[80vh]" title={previewDoc.file_name} />
              ) : (
                <div className="text-center py-20">
                  <File className="size-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-sm text-stone-500">Preview not available for this file type.</p>
                  <a href={previewDoc.public_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium mt-2 inline-block hover:underline" style={{ color: '#283693' }}>
                    Download to view
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit dialog (rename / move) ─────────────────────── */}
      <Dialog open={editingDoc !== null} onOpenChange={v => { if (!v) setEditingDoc(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">File Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <SelectUI value={editCategory} onValueChange={setEditCategory}>
                <SelectTriggerUI><SelectValueUI /></SelectTriggerUI>
                <SelectContentUI>
                  {DOC_CATEGORIES.map(c => (
                    <SelectItemUI key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.label}
                      </span>
                    </SelectItemUI>
                  ))}
                </SelectContentUI>
              </SelectUI>
            </div>
            {editCategory === 'photo-id' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ID Belongs To</Label>
                <SelectUI value={editLabel || '_none'} onValueChange={v => setEditLabel(v === '_none' ? '' : v)}>
                  <SelectTriggerUI><SelectValueUI /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_none">Not specified</SelectItemUI>
                    <SelectItemUI value="gc">GC (Surrogate)</SelectItemUI>
                    <SelectItemUI value="ip1">Intended Parent 1</SelectItemUI>
                    <SelectItemUI value="ip2">Intended Parent 2</SelectItemUI>
                    <SelectItemUI value="partner">Spouse / Partner</SelectItemUI>
                  </SelectContentUI>
                </SelectUI>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingDoc(null)}>Cancel</Button>
              <Button size="sm" style={{ backgroundColor: '#283693', color: '#fff' }} disabled={editSaving} onClick={handleEditSave}>
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────── */}
      <Dialog open={deleteConfirmDoc !== null} onOpenChange={v => { if (!v) setDeleteConfirmDoc(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" /> Delete Document
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            Permanently delete <strong>{deleteConfirmDoc?.file_name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmDoc(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete Permanently</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fax Document Dialog — with cover page */}
      <Dialog open={faxDoc !== null} onOpenChange={v => { if (!v) { setFaxDoc(null); setFaxResult(null); setFaxNumber(''); setFaxToName('') } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-5 text-[#283693]" /> Fax Document
            </DialogTitle>
          </DialogHeader>
          {faxResult?.success ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-stone-700">Fax queued successfully!</p>
              <p className="text-xs text-stone-400">Fax ID: {faxResult.faxId}</p>
              <Button variant="outline" size="sm" onClick={() => { setFaxDoc(null); setFaxResult(null); setFaxNumber(''); setFaxToName('') }}>Close</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-stone-600">
                Faxing: <strong>{faxDoc?.file_name}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">Fax Number *</label>
                  <Input type="tel" placeholder="xxx-xxx-xxxx" value={faxNumber}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      if (digits.length <= 3) setFaxNumber(digits)
                      else if (digits.length <= 6) setFaxNumber(`${digits.slice(0, 3)}-${digits.slice(3)}`)
                      else setFaxNumber(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`)
                    }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">To (Recipient Name)</label>
                  <Input value={faxToName} onChange={e => setFaxToName(e.target.value)} placeholder="Medical Records Dept." />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Subject</label>
                <Input value={faxSubject} onChange={e => setFaxSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Message</label>
                <textarea value={faxMessage} onChange={e => setFaxMessage(e.target.value)} rows={4}
                  className="w-full text-sm rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#283693]/30 resize-none" />
              </div>
              {/* Signature preview */}
              {faxSignatureHtml && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600">Your Signature (from Gmail)</label>
                  <div className="border rounded-lg p-3 bg-stone-50 text-xs" dangerouslySetInnerHTML={{ __html: faxSignatureHtml }} />
                </div>
              )}
              {!faxSignatureHtml && (
                <p className="text-[10px] text-amber-500">No Gmail signature found — a default signature will be used.</p>
              )}
              {/* Driver's License toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-700">
                <input type="checkbox" checked={faxIncludeDL} onChange={e => setFaxIncludeDL(e.target.checked)} className="size-4 accent-[#283693]" />
                Include Driver's License
                {faxIncludeDL && !docs.find(d => d.category === 'photo-id' && d.doc_label === 'gc') && (
                  <span className="text-[10px] text-amber-500 ml-1">(No GC Photo ID found — label one in Photo IDs folder)</span>
                )}
              </label>
              {faxResult?.error && <p className="text-xs text-red-500">{faxResult.error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => { setFaxDoc(null); setFaxResult(null); setFaxNumber(''); setFaxToName('') }}>Cancel</Button>
                <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}
                  disabled={faxSending || !/^\d{3}-\d{3}-\d{4}$/.test(faxNumber)}
                  onClick={async () => {
                    setFaxSending(true); setFaxResult(null)
                    try {
                      const { sendFax } = await import('@/lib/fax')
                      const html2canvas = (await import('html2canvas')).default
                      const { jsPDF } = await import('jspdf')

                      // Generate custom branded cover page as PDF
                      const coverHtml = `
                        <div style="font-family: Arial, sans-serif; width: 816px; padding: 50px; color: #000;">
                          <table style="width: 100%; border: 2px solid #000; border-collapse: collapse; margin-bottom: 30px;">
                            <tr>
                              <td style="text-align: center; padding: 25px; vertical-align: middle;">
                                <img src="${window.location.origin}/abc-logo.png" style="height: 90px; display: inline-block;" />
                                <p style="font-size: 12px; margin: 8px 0 0 0;">Tel: 323-207-5762 &nbsp;&nbsp; Fax: 323-843-9433</p>
                              </td>
                              <td style="border-left: 2px solid #000; padding: 20px 30px; font-size: 40px; font-weight: 700; text-align: center; width: 120px; vertical-align: middle;">Fax</td>
                            </tr>
                          </table>
                          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 10px 0; width: 50%;"><strong>To:</strong> &nbsp; ${faxToName || ''}</td>
                              <td style="padding: 10px 0;"><strong>From:</strong> &nbsp; ${currentUser?.name || 'ABC Surrogacy'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0;"><strong>Fax:</strong> &nbsp; ${faxNumber}</td>
                              <td style="padding: 10px 0;"><strong>Date:</strong> &nbsp; ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                            </tr>
                          </table>
                          <div style="margin-top: 10px; padding-top: 10px; border-top: 3px solid #000;">
                            <p style="font-size: 16px; font-weight: 700; margin: 10px 0;"><strong>Subject:</strong> ${faxSubject}</p>
                          </div>
                          <div style="border-top: 1px solid #000; margin-top: 10px; padding-top: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${faxMessage}</div>
                          <div style="margin-top: 40px;">
                            ${faxSignatureHtml || `<div style="display: flex; align-items: flex-start; gap: 16px;"><img src="/abc-logo.png" style="height: 50px;" onerror="this.style.display='none'" /><div style="font-size: 12px; line-height: 1.5;"><p style="margin: 0; font-weight: 700;">${currentUser?.name || 'ABC Surrogacy'}</p><p style="margin: 0; font-style: italic;">Case Manager</p><p style="margin: 0;">F: 323-843-9433</p></div></div>`}
                          </div>
                          <div style="margin-top: 30px; padding: 12px; border: 1px solid #000; font-size: 9px; line-height: 1.4;">
                            ABUNDANT BEGINNINGS COMPANY, LLC does not and cannot give medical, insurance or legal advice. Nothing in this document or any communication written or verbal should in any way be considered medical, insurance or legal advice. If you have any questions, you should consult a qualified specialist.
                          </div>
                        </div>
                      `

                      // Render cover page
                      const overlay = document.createElement('div')
                      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:99999;display:flex;align-items:center;justify-content:center;'
                      overlay.innerHTML = '<p style="color:#283693;font-size:18px;font-weight:600;">Preparing fax...</p>'
                      document.body.appendChild(overlay)

                      const coverEl = document.createElement('div')
                      coverEl.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;'
                      coverEl.innerHTML = coverHtml
                      document.body.appendChild(coverEl)
                      await new Promise(r => setTimeout(r, 800))

                      const coverCanvas = await html2canvas(coverEl, { scale: 2, useCORS: true, backgroundColor: '#fff' })
                      document.body.removeChild(coverEl)
                      document.body.removeChild(overlay)

                      const coverPdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' })
                      const cImg = coverCanvas.toDataURL('image/jpeg', 0.95)
                      const cHeight = (coverCanvas.height * 8.5) / coverCanvas.width
                      coverPdf.addImage(cImg, 'JPEG', 0, 0, 8.5, cHeight)
                      const coverBase64 = coverPdf.output('datauristring').split(',')[1]

                      // Fetch main document PDF
                      const response = await fetch(faxDoc.public_url)
                      const blob = await response.blob()
                      const docBase64 = await new Promise((resolve) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(reader.result.split(',')[1])
                        reader.readAsDataURL(blob)
                      })

                      // Find and attach driver's license if selected
                      const additionalFiles = []
                      // Document PDF as file 2
                      additionalFiles.push({ fileName: faxDoc.file_name, fileContent: docBase64 })
                      if (faxIncludeDL) {
                        const dlDoc = docs.find(d => d.category === 'photo-id' && d.doc_label === 'gc')
                        if (dlDoc?.public_url) {
                          try {
                            const dlResponse = await fetch(dlDoc.public_url)
                            const dlBlob = await dlResponse.blob()
                            const dlBase64 = await new Promise((resolve) => {
                              const r = new FileReader()
                              r.onload = () => resolve(r.result.split(',')[1])
                              r.readAsDataURL(dlBlob)
                            })
                            additionalFiles.push({ fileName: dlDoc.file_name, fileContent: dlBase64 })
                          } catch {}
                        }
                      }

                      const digits = faxNumber.replace(/\D/g, '')
                      // Send cover page as file 1, no SRFax built-in cover
                      const result = await sendFax({
                        to: digits,
                        fileName: 'cover_page.pdf',
                        fileContent: coverBase64,
                        additionalFiles,
                      })
                      setFaxResult({ success: true, faxId: result.faxId || result.Status })

                      // Log fax to case emails
                      try {
                        const { supabase: sb } = await import('@/lib/supabase')
                        if (sb && surrogateId) {
                          const attachList = [faxDoc.file_name]
                          if (faxIncludeDL) {
                            const dlDoc = docs.find(d => d.category === 'photo-id' && d.doc_label === 'gc')
                            if (dlDoc) attachList.push(dlDoc.file_name)
                          }
                          await sb.from('case_emails').insert({
                            gmail_message_id: 'fax-' + Date.now(),
                            case_id: surrogateId,
                            case_type: 'gc',
                            subject: `Fax Sent to ${faxNumber}`,
                            from_address: currentUser?.email || '',
                            to_address: faxNumber,
                            date: new Date().toISOString(),
                            snippet: `Faxed by ${currentUser?.name || 'Admin'} to ${faxNumber}${faxToName ? ` (${faxToName})` : ''}\n\nSubject: ${faxSubject}\n\nAttachments: ${attachList.join(', ')}\n\nFax ID: ${result.faxId || result.Status}`,
                            logged_by: currentUser?.id,
                            logged_by_name: currentUser?.name || '',
                            tag: 'fax',
                          })
                        }
                      } catch (logErr) { console.error('Fax log failed:', logErr) }
                    } catch (err) {
                      setFaxResult({ error: err.message || 'Failed to send fax' })
                    } finally {
                      setFaxSending(false)
                    }
                  }}>
                  {faxSending ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
                  {faxSending ? 'Sending...' : 'Send Fax'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Contact Tab (merged with quiz answers) ─────────────────
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']
const MARITAL_OPTIONS = ['Single', 'Married', 'Domestic Partnership', 'Divorced', 'Widowed']
const CONTACT_OPTIONS = ['Text', 'Email', 'Phone']
const HEAR_OPTIONS = ['Instagram', 'TikTok', 'Facebook', 'Google search', 'Friend or family', 'Doctor or clinic', 'Podcast or blog', 'Other']

function ContactTab({ surrogate, setSurrogate, quizAnswers, setQuizAnswers }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  // Merge surrogate + quiz data for display
  const qa = quizAnswers || {}
  const displayData = {
    firstName: qa.firstName || '', lastName: qa.lastName || '',
    email: surrogate.email || qa.email || '',
    phone: surrogate.phone || qa.phone || '',
    dob: qa.dob || '',
    state: qa.state || surrogate.location || '',
    usCitizen: qa.usCitizen,
    maritalStatus: surrogate.maritalStatus || qa.maritalStatus || '',
    preferredContact: surrogate.preferredContact || qa.preferredContact || '',
    heightFt: qa.heightFt || surrogate.heightFt || '',
    heightIn: qa.heightIn || surrogate.heightIn || '',
    weightLbs: qa.weightLbs || surrogate.weightLbs || '',
    healthyPregnancy: qa.healthyPregnancy,
    hearAboutUs: qa.hearAboutUs || '',
    hearAboutUsOther: qa.hearAboutUsOther || '',
  }

  function startEdit() {
    setForm({
      ...displayData,
      beReferral: surrogate.referralPartner === 'be_surrogacy',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updatedAnswers = {
        ...(qa || {}),
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, phone: form.phone, dob: form.dob,
        state: form.state, usCitizen: form.usCitizen,
        maritalStatus: form.maritalStatus, preferredContact: form.preferredContact,
        heightFt: form.heightFt, heightIn: form.heightIn, weightLbs: form.weightLbs,
        healthyPregnancy: form.healthyPregnancy,
        hearAboutUs: form.hearAboutUs, hearAboutUsOther: form.hearAboutUsOther,
      }
      const referralVal = form.beReferral ? 'be_surrogacy' : null
      const newName = `${form.firstName} ${form.lastName}`.trim()
      const oldEmail = (surrogate.email || '').trim().toLowerCase()
      const newEmail = form.email.trim().toLowerCase()
      await updateIntakeSubmission(surrogate.id, {
        applicant_name: newName,
        applicant_email: newEmail,
        applicant_phone: form.phone.trim(),
        answers: updatedAnswers,
        referral_partner: referralVal,
      })
      // If email changed, update surrogate_profiles and auth user too
      if (oldEmail && newEmail && oldEmail !== newEmail) {
        try {
          // Update surrogate_profiles email
          const { supabase: sb } = await import('@/lib/supabase')
          if (sb) {
            await sb.from('surrogate_profiles').update({ email: newEmail, updated_at: new Date().toISOString() }).eq('email', oldEmail)
          }
          // Update Supabase Auth user email via API
          await fetch('/api/update-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newEmail, oldEmail, name: newName, role: 'surrogate' }),
          }).catch(() => {})
        } catch (err) { console.error('Failed to sync email change:', err) }
      }
      setSurrogate(prev => ({
        ...prev,
        name: newName,
        email: form.email, phone: form.phone,
        location: form.state,
        maritalStatus: form.maritalStatus,
        preferredContact: form.preferredContact,
        referralPartner: referralVal,
        heightFt: form.heightFt, heightIn: form.heightIn,
        weightLbs: form.weightLbs,
      }))
      setQuizAnswers(updatedAnswers)
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  const SelectField = ({ label, value, onValueChange, options }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <SelectUI value={value || ''} onValueChange={onValueChange}>
        <SelectTriggerUI><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
        <SelectContentUI>
          {options.map(o => <SelectItemUI key={o} value={o}>{o}</SelectItemUI>)}
        </SelectContentUI>
      </SelectUI>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contact & Intake Details</CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" className="gap-1" onClick={startEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}
                onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">First Name</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Last Name</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Phone</Label><Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Date of Birth</Label><Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} /></div>
                <SelectField label="State" value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))} options={US_STATES} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">US Citizen / Resident</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant={form.usCitizen === true ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, usCitizen: true }))}>Yes</Button>
                    <Button size="sm" variant={form.usCitizen === false ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, usCitizen: false }))}>No</Button>
                  </div>
                </div>
                <SelectField label="Marital Status" value={form.maritalStatus} onValueChange={v => setForm(f => ({ ...f, maritalStatus: v }))} options={MARITAL_OPTIONS} />
                <SelectField label="Preferred Contact" value={form.preferredContact} onValueChange={v => setForm(f => ({ ...f, preferredContact: v }))} options={CONTACT_OPTIONS} />
              </div>

              <div className="border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">Health</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Height (ft)</Label>
                    <Input type="number" min="4" max="7" value={form.heightFt} onChange={e => setForm(f => ({ ...f, heightFt: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Height (in)</Label>
                    <Input type="number" min="0" max="11" value={form.heightIn} onChange={e => setForm(f => ({ ...f, heightIn: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Weight (lbs)</Label>
                    <Input type="number" value={form.weightLbs} onChange={e => setForm(f => ({ ...f, weightLbs: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <Label className="text-xs text-muted-foreground">Healthy Pregnancy History</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant={form.healthyPregnancy === true ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, healthyPregnancy: true }))}>Yes</Button>
                    <Button size="sm" variant={form.healthyPregnancy === false ? 'default' : 'outline'} onClick={() => setForm(f => ({ ...f, healthyPregnancy: false }))}>No</Button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">Other</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label="How did you hear about us?" value={form.hearAboutUs} onValueChange={v => setForm(f => ({ ...f, hearAboutUs: v }))} options={HEAR_OPTIONS} />
                  {form.hearAboutUs === 'Other' && (
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Please specify</Label><Input value={form.hearAboutUsOther} onChange={e => setForm(f => ({ ...f, hearAboutUsOther: e.target.value }))} /></div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                  <img src="/be-logo.png" alt="BE" className="h-6 w-auto" />
                  <span className="text-sm font-medium">Referral</span>
                </div>
                <Switch checked={form.beReferral} onCheckedChange={v => setForm(f => ({ ...f, beReferral: v }))} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-muted-foreground">Name</span><p className="font-medium">{displayData.firstName} {displayData.lastName}</p></div>
              <div><span className="text-muted-foreground">Email</span><p className="font-medium">{displayData.email || '—'}</p></div>
              <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{displayData.phone || '—'}</p></div>
              <div><span className="text-muted-foreground">Date of Birth</span><p className="font-medium">{displayData.dob || '—'}</p></div>
              <div><span className="text-muted-foreground">State</span><p className="font-medium">{displayData.state || '—'}</p></div>
              <div><span className="text-muted-foreground">US Citizen</span><p className="font-medium">{displayData.usCitizen === true ? 'Yes' : displayData.usCitizen === false ? 'No' : '—'}</p></div>
              <div><span className="text-muted-foreground">Marital Status</span><p className="font-medium">{displayData.maritalStatus || '—'}</p></div>
              <div><span className="text-muted-foreground">Preferred Contact</span><p className="font-medium">{displayData.preferredContact || '—'}</p></div>
              <div><span className="text-muted-foreground">Height</span><p className="font-medium">{displayData.heightFt ? `${displayData.heightFt}'${displayData.heightIn || 0}"` : '—'}</p></div>
              <div><span className="text-muted-foreground">Weight</span><p className="font-medium">{displayData.weightLbs ? `${displayData.weightLbs} lbs` : '—'}</p></div>
              <div><span className="text-muted-foreground">Healthy Pregnancy</span><p className="font-medium">{displayData.healthyPregnancy === true ? 'Yes' : displayData.healthyPregnancy === false ? 'No' : '—'}</p></div>
              <div><span className="text-muted-foreground">Heard About Us</span><p className="font-medium">{displayData.hearAboutUs || '—'}{displayData.hearAboutUsOther ? ` — ${displayData.hearAboutUsOther}` : ''}</p></div>
              <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <img src="/be-logo.png" alt="BE" className="h-5 w-auto" />
                  <span className="text-sm text-muted-foreground">Referral</span>
                </div>
                <span className={`text-sm font-medium ${surrogate.referralPartner === 'be_surrogacy' ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {surrogate.referralPartner === 'be_surrogacy' ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Copy-Flip Button ───────────────────────────────────────
function CopyFlipButton({ icon: Icon, label, value, flipped, onFlip, preferred }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!flipped) {
    return preferred ? (
      <Button
        size="sm"
        className="gap-1.5 rounded-full text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
        onClick={onFlip}
      >
        <Icon className="size-3.5" /> {label} ★
      </Button>
    ) : (
      <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={onFlip}>
        <Icon className="size-3.5" /> {label}
      </Button>
    )
  }

  return (
    <div className="inline-flex items-center rounded-full border border-stone-200 bg-white text-sm h-8">
      <button
        className="flex items-center gap-1.5 pl-3 pr-1 hover:text-stone-900 transition-colors text-stone-600 font-medium"
        onClick={onFlip}
        title="Click to hide"
      >
        <Icon className="size-3.5 text-stone-400" />
        <span className="text-xs">{value}</span>
      </button>
      <button
        className="flex items-center justify-center size-8 rounded-full hover:bg-stone-100 transition-colors shrink-0"
        onClick={handleCopy}
        title="Copy to clipboard"
      >
        {copied
          ? <Check className="size-3.5 text-emerald-500" />
          : <Copy className="size-3.5 text-stone-300 hover:text-stone-500" />
        }
      </button>
    </div>
  )
}

// ── Stat Card (non-interactive) ────────────────────────────
function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center">
      {Icon && <Icon className="size-4 text-stone-300 mx-auto mb-1" />}
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{value}</p>
    </div>
  )
}

// ── Flip Card (interactive) ────────────────────────────────
function FlipCard({ flipped, onClick, front, back }) {
  const side = flipped ? back : front
  const Icon = side.icon
  return (
    <div
      className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all select-none"
      onClick={onClick}
    >
      {Icon && <Icon className="size-4 text-stone-300 mx-auto mb-1" />}
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{side.label}</p>
      <p className={`text-lg font-bold mt-0.5 leading-tight ${side.color || 'text-stone-800'}`}>{side.value}</p>
    </div>
  )
}

// ── GTPAL Chip ─────────────────────────────────────────────
function GTPALChip({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center justify-center size-6 rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }}>
        {value}
      </span>
      <span className="text-xs text-stone-500">{label}</span>
    </div>
  )
}

// ── Profile section config ─────────────────────────────────
const SECTION_DESCRIPTIONS = {
  personal: 'Basic info, relationships, and household',
  pregnancyHistory: 'Previous pregnancies and deliveries',
  fertility: 'Reproductive health and fertility details',
  general: 'Housing, lifestyle, habits, and background',
  health: 'Medical history, medications, and conditions',
  employment: 'Work, income, and insurance details',
  interests: 'Favorites, hobbies, and personality',
  academic: 'Education and training',
  experiencedSurrogate: 'Previous surrogacy journey details',
  hopesWishes: 'Surrogacy goals, preferences, and compensation',
}

// Conditional fields: only show when parent field has a specific value
const CONDITIONAL_FIELDS = {
  otherLanguagesDetails: { parent: 'otherLanguages', showWhen: 'yes' },
  sameBioFatherDetails: { parent: 'sameBioFather', showWhen: 'no' },
  infertilityTreatmentDetails: { parent: 'infertilityTreatment', showWhen: 'yes' },
  gynecologicalProblemsDetails: { parent: 'gynecologicalProblems', showWhen: 'yes' },
  breastfeedingStopDate: { parent: 'breastfeeding', showWhen: 'yes' },
  cycleLengthDetails: { parent: 'cycleLength', showWhen: 'no' },
  pregnancyMedicationList: { parent: 'pregnancyMedication', showWhen: 'yes' },
  childrenFullTimeDetails: { parent: 'childrenFullTime', showWhen: 'no' },
  childrenSpecialNeedsDetails: { parent: 'childrenSpecialNeeds', showWhen: 'yes' },
  placedForAdoptionDetails: { parent: 'placedForAdoption', showWhen: 'yes' },
  planMoreChildrenDetails: { parent: 'planMoreChildren', showWhen: 'yes' },
  smokingHistoryDetails: { parent: 'smokingHistory', showWhen: 'yes' },
  householdSmokerDetails: { parent: 'householdSmoker', showWhen: 'yes' },
  alcoholDrugsDetails: { parent: 'alcoholDrugs', showWhen: 'yes' },
  advisedLimitDetails: { parent: 'advisedLimitSubstances', showWhen: 'yes' },
  householdSubstancesDetails: { parent: 'householdControlledSubstances', showWhen: 'yes' },
  householdSubstancesPurpose: { parent: 'householdControlledSubstances', showWhen: 'yes' },
  gunsDetails: { parent: 'gunsOwned', showWhen: 'yes' },
  piercingsTattoosDetails: { parent: 'piercingsTattoos', showWhen: 'yes' },
  lastTattooDate: { parent: 'piercingsTattoos', showWhen: 'yes' },
  eatingDisordersDetails: { parent: 'eatingDisorders', showWhen: 'yes' },
  criminalHistoryDetails: { parent: 'criminalHistory', showWhen: 'yes' },
  recentTravelDetails: { parent: 'recentTravel', showWhen: 'yes' },
  travelPlansDetails: { parent: 'travelPlans', showWhen: 'yes' },
  sleepIssuesDetails: { parent: 'sleepIssues', showWhen: 'yes' },
  mentalHealthDetails: { parent: 'mentalHealthDiagnosis', showWhen: 'yes' },
  mentalHealthHospDetails: { parent: 'mentalHealthHospitalization', showWhen: 'yes' },
  mentalHealthMedDetails: { parent: 'mentalHealthMedication', showWhen: 'yes' },
  counselingDetails: { parent: 'counselingTherapy', showWhen: 'yes' },
  familyMentalHealthDetails: { parent: 'familyMentalHealth', showWhen: 'yes' },
  domesticViolenceDetails: { parent: 'domesticViolence', showWhen: 'yes' },
  vaccinationReasons: { parent: 'openToVaccinations', showWhen: 'no' },
  governmentAssistanceDetails: { parent: 'governmentAssistance', showWhen: 'yes' },
  insuranceType: { parent: 'healthInsurance', showWhen: 'yes' },
  currentlyInSchoolDetails: { parent: 'currentlyInSchool', showWhen: 'yes' },
  lifestyleChangesDetails: { parent: 'lifestyleChanges', showWhen: 'yes' },
  ipsAtAppointmentsDetails: { parent: 'ipsAtAppointments', showWhen: 'No' },
  cvsAmnioDetails: { parent: 'cvsAmnio', showWhen: 'yes' },
  conditionsWontTerminate: { parent: 'willingnessToTerminate', showWhen: 'yes' },
  diseaseHistoryDetails: { parent: 'diseaseHistory', showWhen: '_array_has_value' },
}

function isConditionalVisible(fieldKey, sectionData) {
  const cond = CONDITIONAL_FIELDS[fieldKey]
  if (!cond) return true
  const parentVal = sectionData?.[cond.parent]
  if (cond.showWhen === '_array_has_value') {
    return Array.isArray(parentVal) && parentVal.some(d => d !== 'None of the Above')
  }
  return parentVal === cond.showWhen || parentVal === true
}

const PROFILE_SECTIONS = [
  { key: 'personal', title: 'Personal Information', fields: [
    'firstName', 'dob', 'city', 'state', 'heightFt', 'heightIn', 'weight',
    'usCitizen', 'realId', 'validPassport', 'otherLanguages', 'otherLanguagesDetails',
    'maritalStatus', 'monogamous', 'sexualPartners', 'relationshipLength', 'partnerName',
    'partnerDob', 'partnerUsCitizen', 'householdMembers'
  ] },
  { key: 'pregnancyHistory', title: 'Pregnancy History', fields: [
    'numberOfPregnancies', 'pregnancies'
  ] },
  { key: 'fertility', title: 'Fertility Information', fields: [
    'sameBioFather', 'sameBioFatherDetails', 'pregnancyDetails',
    'infertilityTreatment', 'infertilityTreatmentDetails',
    'gynecologicalProblems', 'gynecologicalProblemsDetails',
    'contraceptiveMethod', 'lastPeriod', 'cycleLength', 'cycleLengthDetails',
    'breastfeeding', 'breastfeedingStopDate', 'timeToConceive',
    'pregnancyMedication', 'pregnancyMedicationList',
    'nearestNICU', 'willingToTravelNICU'
  ] },
  { key: 'general', title: 'General Information', fields: [
    'homeOwnership', 'homeDuration', 'childrenFullTime', 'childrenFullTimeDetails',
    'childrenSpecialNeeds', 'childrenSpecialNeedsDetails',
    'placedForAdoption', 'placedForAdoptionDetails', 'divorcedRelationship',
    'planMoreChildren', 'planMoreChildrenDetails',
    'smokeVape', 'smokingHistory', 'smokingHistoryDetails',
    'householdSmoker', 'householdSmokerDetails',
    'alcoholDrugs', 'alcoholDrugsDetails',
    'advisedLimitSubstances', 'advisedLimitDetails',
    'householdControlledSubstances', 'householdSubstancesDetails', 'householdSubstancesPurpose',
    'gunsOwned', 'gunsDetails',
    'piercingsTattoos', 'piercingsTattoosDetails', 'lastTattooDate', 'nonSterilePiercing',
    'eatingDisorders', 'eatingDisordersDetails', 'typicalDiet',
    'partnerFdaTests', 'ethnicity', 'religion', 'religionImportance', 'differentReligion',
    'criminalHistory', 'criminalHistoryDetails',
    'recentTravel', 'recentTravelDetails', 'travelPlans', 'travelPlansDetails',
    'exerciseFrequency', 'sleepIssues', 'sleepIssuesDetails', 'sleepHours',
    'reliableVehicle', 'autoInsurance', 'validLicense'
  ] },
  { key: 'health', title: 'Health Information', fields: [
    'mentalHealthDiagnosis', 'mentalHealthDetails',
    'mentalHealthHospitalization', 'mentalHealthHospDetails',
    'mentalHealthMedication', 'mentalHealthMedDetails',
    'counselingTherapy', 'counselingDetails',
    'familyMentalHealth', 'familyMentalHealthDetails',
    'domesticViolence', 'domesticViolenceDetails',
    'nonPrescriptionMeds', 'prescriptionMeds', 'currentMeds',
    'allergies', 'medicalConditions', 'lastPhysical', 'lastPap',
    'surgeries', 'diseaseHistory', 'diseaseHistoryDetails',
    'openToVaccinations', 'vaccinationReasons',
    'covidVaccine', 'covidVaccineWilling', 'hadCovid', 'covidBooster', 'covidBoosterWilling'
  ] },
  { key: 'employment', title: 'Employment Information', fields: [
    'currentlyEmployed', 'employmentIndustry', 'workHours', 'occupation',
    'lengthAtEmployer', 'hourlyRate', 'weeklyIncome',
    'partnerOccupation', 'partnerWeeklyIncome',
    'healthInsurance', 'insuranceType',
    'governmentAssistance', 'governmentAssistanceDetails'
  ] },
  { key: 'interests', title: 'Interests', fields: [
    'favoriteMusic', 'favoriteMovie', 'favoriteBook', 'favoriteFoods',
    'favoriteColor', 'favoriteFlower', 'pets', 'catLitter',
    'hobbies', 'collections', 'dreamTravel', 'personality'
  ] },
  { key: 'academic', title: 'Academic Information', fields: [
    'educationLevel', 'currentlyInSchool', 'currentlyInSchoolDetails'
  ] },
  { key: 'experiencedSurrogate', title: 'Experienced Surrogate Info', fields: [
    'previousSurrogate', 'surrogacyTimes', 'journeys', 'overallExperience'
  ] },
  { key: 'hopesWishes', title: 'Journey Hopes & Wishes', fields: [
    'reasonForSurrogacy', 'compensationUse', 'surrogacyFit', 'supportSystem',
    'threeTransferAttempts', 'reduceCaffeine', 'lifestyleChanges', 'lifestyleChangesDetails',
    'pumpBreastmilk',
    'idealIPs', 'preferredCommunication', 'ipInvolvement',
    'ipsAtAppointments', 'ipsAtAppointmentsDetails', 'deliveryRoomOthers', 'ipsCantAttend',
    'ipsWithChildren', 'openLGBTQ', 'openSingleIP', 'transferAnotherState', 'ipsOutsideUS',
    'childCareTraveling',
    'whenReadyToBegin', 'postBirthRelationship',
    'cvsAmnio', 'cvsAmnioDetails', 'willingnessToTerminate',
    'partnerAgreesTermination', 'conditionsWontTerminate',
    'embryosToTransfer', 'carryTwins',
    'desiredCompensation', 'compensationNegotiable',
    'additionalComments'
  ] },
]

function countSectionFilled(data, section) {
  const sData = data?.[section.key] || {}

  // Map of "details" fields to their parent toggle fields
  // If the parent is 'no'/empty, the detail field is not required
  const CONDITIONAL_PAIRS = {
    otherLanguagesDetails: { parent: 'otherLanguages', show: 'yes' },
    sameBioFatherDetails: { parent: 'sameBioFather', show: 'no' },
    infertilityTreatmentDetails: { parent: 'infertilityTreatment', show: 'yes' },
    gynecologicalProblemsDetails: { parent: 'gynecologicalProblems', show: 'yes' },
    cycleLengthDetails: { parent: 'cycleLength', show: 'irregular' },
    breastfeedingStopDate: { parent: 'breastfeeding', show: 'yes' },
    pregnancyMedicationList: { parent: 'pregnancyMedication', show: 'yes' },
    childrenFullTimeDetails: { parent: 'childrenFullTime', show: 'no' },
    childrenSpecialNeedsDetails: { parent: 'childrenSpecialNeeds', show: 'yes' },
    placedForAdoptionDetails: { parent: 'placedForAdoption', show: 'yes' },
    planMoreChildrenDetails: { parent: 'planMoreChildren', show: 'yes' },
    smokingHistoryDetails: { parent: 'smokingHistory', show: 'yes' },
    householdSmokerDetails: { parent: 'householdSmoker', show: 'yes' },
    alcoholDrugsDetails: { parent: 'alcoholDrugs', show: 'yes' },
    advisedLimitDetails: { parent: 'advisedLimitSubstances', show: 'yes' },
    householdSubstancesDetails: { parent: 'householdControlledSubstances', show: 'yes' },
    householdSubstancesPurpose: { parent: 'householdControlledSubstances', show: 'yes' },
    gunsDetails: { parent: 'gunsOwned', show: 'yes' },
    piercingsTattoosDetails: { parent: 'piercingsTattoos', show: 'yes' },
    lastTattooDate: { parent: 'piercingsTattoos', show: 'yes' },
    nonSterilePiercing: { parent: 'piercingsTattoos', show: 'yes' },
    eatingDisordersDetails: { parent: 'eatingDisorders', show: 'yes' },
    criminalHistoryDetails: { parent: 'criminalHistory', show: 'yes' },
    recentTravelDetails: { parent: 'recentTravel', show: 'yes' },
    travelPlansDetails: { parent: 'travelPlans', show: 'yes' },
    sleepIssuesDetails: { parent: 'sleepIssues', show: 'yes' },
    mentalHealthDetails: { parent: 'mentalHealthDiagnosis', show: 'yes' },
    mentalHealthHospDetails: { parent: 'mentalHealthHospitalization', show: 'yes' },
    mentalHealthMedDetails: { parent: 'mentalHealthMedication', show: 'yes' },
    counselingDetails: { parent: 'counselingTherapy', show: 'yes' },
    familyMentalHealthDetails: { parent: 'familyMentalHealth', show: 'yes' },
    domesticViolenceDetails: { parent: 'domesticViolence', show: 'yes' },
    diseaseHistoryDetails: { parent: 'diseaseHistory', show: 'yes' },
    vaccinationReasons: { parent: 'openToVaccinations', show: 'no' },
    governmentAssistanceDetails: { parent: 'governmentAssistance', show: 'yes' },
    cvsAmnioDetails: { parent: 'cvsAmnio' },
    lifestyleChangesDetails: { parent: 'lifestyleChanges', show: 'yes' },
    ipsAtAppointmentsDetails: { parent: 'ipsAtAppointments' },
    currentlyInSchoolDetails: { parent: 'currentlyInSchool', show: 'yes' },
    // Partner fields — skip if not in a relationship
    partnerName: { parent: 'maritalStatus', show: '_partner' },
    partnerDob: { parent: 'maritalStatus', show: '_partner' },
    partnerUsCitizen: { parent: 'maritalStatus', show: '_partner' },
    relationshipLength: { parent: 'maritalStatus', show: '_partner' },
    monogamous: { parent: 'maritalStatus', show: '_partner' },
    sexualPartners: { parent: 'maritalStatus', show: '_partner' },
    partnerOccupation: { parent: 'maritalStatus', show: '_partner' },
    partnerWeeklyIncome: { parent: 'maritalStatus', show: '_partner' },
    partnerFdaTests: { parent: 'maritalStatus', show: '_partner' },
    partnerAgreesTermination: { parent: 'maritalStatus', show: '_partner' },
  }

  const PARTNER_STATUSES = ['In a Relationship', 'Married', 'Domestic Partnership']

  let filled = 0, total = 0
  for (const f of section.fields) {
    const cond = CONDITIONAL_PAIRS[f]
    if (cond) {
      const parentVal = sData[cond.parent]
      if (cond.show === '_partner') {
        if (!PARTNER_STATUSES.includes(parentVal)) continue // skip partner fields for singles
      } else if (cond.show) {
        if (parentVal !== cond.show) continue // skip if parent condition not met
      } else {
        // Generic: skip if parent is empty
        if (!parentVal || parentVal === 'no') continue
      }
    }
    total++
    const val = sData[f]
    if (val !== undefined && val !== '' && val !== null && !(Array.isArray(val) && val.length === 0)) filled++
  }
  return { filled, total }
}

// ── Case Texts Tab (multi-admin) ──────────────────────────
function CaseTextsTab({ phone, caseName }) {
  const { currentUser } = useRole()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [smsText, setSmsText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [adminPhones, setAdminPhones] = useState([]) // [{ id, name, phone }]
  const [sendFrom, setSendFrom] = useState('') // selected "Send as" phone

  // Load admin phone numbers
  useEffect(() => {
    fetchAdminPhones().then(list => {
      setAdminPhones(list || [])
      // Default to current user's number
      const mine = (list || []).find(a => a.id === currentUser?.id)
      if (mine) setSendFrom(mine.phone)
      else if (list?.length > 0) setSendFrom(list[0].phone)
    }).catch(() => {})
  }, [currentUser?.id])

  function cleanPhone(num) {
    if (!num) return ''
    let clean = num.replace(/[^\d+]/g, '')
    if (!clean.startsWith('+')) clean = '+1' + clean.replace(/^1/, '')
    return clean
  }

  // Build phone→admin name map
  const phoneToAdmin = useMemo(() => {
    const map = {}
    for (const a of adminPhones) {
      if (a.phone) {
        map[a.phone] = a.name
        // Also map without +1 prefix for flexible matching
        const digits = a.phone.replace(/[^\d]/g, '')
        map['+1' + digits.replace(/^1/, '')] = a.name
      }
    }
    return map
  }, [adminPhones])

  // Load messages from all admin numbers
  function loadMessages() {
    if (!phone) { setLoading(false); return }
    const cleanTo = cleanPhone(phone)
    const numbers = adminPhones.map(a => a.phone).filter(Boolean)
    fetchSMSMessages(cleanTo, numbers)
      .then(data => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (adminPhones.length > 0 || !phone) loadMessages()
  }, [phone, adminPhones]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!smsText.trim() || !phone) return
    setSending(true)
    setSendResult(null)
    try {
      await sendSMS(phone, smsText.trim(), sendFrom || null)
      setSendResult('sent')
      setSmsText('')
      setTimeout(loadMessages, 500) // refresh after short delay
    } catch (err) {
      setSendResult(err.message || 'Failed to send')
    }
    setSending(false)
  }

  if (!phone) return <p className="text-sm text-stone-400 py-8 text-center">No phone number on file for this case.</p>

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Text Messages</CardTitle>
        <span className="text-xs text-stone-400">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Send As selector */}
        {adminPhones.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 shrink-0">Send as:</span>
            <select
              value={sendFrom}
              onChange={e => setSendFrom(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 flex-1 max-w-xs"
            >
              {adminPhones.map(a => (
                <option key={a.id} value={a.phone}>
                  {a.name} ({a.phone})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* No phone configured warning */}
        {adminPhones.length === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            No Twilio numbers configured. Go to <a href="/settings" className="underline font-medium">Settings</a> to add your phone number.
          </div>
        )}

        {/* Compose */}
        <div className="flex gap-2">
          <Textarea
            value={smsText}
            onChange={e => setSmsText(e.target.value)}
            placeholder={`Text ${caseName || 'this contact'}...`}
            rows={2}
            className="resize-none flex-1"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          />
          <Button
            onClick={handleSend}
            disabled={!smsText.trim() || sending || !sendFrom}
            className="self-end"
            style={{ backgroundColor: '#283693' }}
          >
            {sending ? '...' : 'Send'}
          </Button>
        </div>
        {sendResult === 'sent' && <p className="text-xs text-emerald-600">Sent!</p>}
        {sendResult && sendResult !== 'sent' && <p className="text-xs text-red-500">{sendResult}</p>}

        {/* Thread */}
        {loading ? (
          <p className="text-sm text-stone-400 text-center py-6">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">No texts with this contact yet.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {messages.map(m => {
              const isOutbound = m.direction === 'outbound'
              const senderName = isOutbound ? (phoneToAdmin[m.from] || '') : ''
              if (!isOutbound && !isMessageRead(m.sid)) markSMSRead(m.sid)
              return (
                <div key={m.sid} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isOutbound ? 'bg-[#283693] text-white rounded-br-md' : 'bg-stone-100 text-stone-800 rounded-bl-md'}`}>
                    {isOutbound && senderName && (
                      <p className="text-[10px] text-white/50 font-medium mb-0.5">{senderName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${isOutbound ? 'text-white/60' : 'text-stone-400'}`}>
                      {new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' · '}
                      {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {isOutbound && m.status && ` · ${m.status}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Overview Tab ───────────────────────────────────────────
function OverviewTab({ surrogate, screening, heightStr, profileData, recordTracking, updateRecord, currentUserName, stageId }) {
  const milestones = getChecklistMilestones('gc', stageId || 'pre-qualification')
  const rt = recordTracking || {}

  let completed = 0
  const milestoneData = milestones.map(ms => {
    const stepIds = ms.stepIds || []
    const relevantSteps = stepIds.filter(id => rt[id]?.status || !id.startsWith('_'))
    const allComplete = relevantSteps.length > 0 && relevantSteps.every(id => rt[id]?.status === 'complete' || rt[id]?.status === 'na')
    const anyStarted = relevantSteps.some(id => rt[id]?.status && rt[id].status !== 'not_started')
    const status = allComplete ? 'complete' : anyStarted ? 'in_progress' : 'not_started'
    if (allComplete) completed++
    return { ...ms, status, stepCount: stepIds.length }
  })
  const total = milestones.length
  const pct = total > 0 ? (completed / total) * 100 : 0

  // Calculate gradient color per milestone based on position
  const getGradientColor = (index) => {
    if (total <= 1) return '#ed148c'
    const t = index / (total - 1)
    // pink #ed148c → blue #283693
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
        <p className="text-sm text-stone-400 text-center py-4">No milestones configured. Set them up in Settings.</p>
      ) : (
        <div className="relative pt-4 pb-2 overflow-x-auto">
          {/* Timeline track */}
          <div className="relative flex items-start" style={{ minWidth: `${Math.max(milestoneData.length * 120, 400)}px` }}>
            {/* Background line */}
            <div className="absolute top-[14px] left-[14px] right-[14px] h-[3px] bg-stone-200 rounded-full" />
            {/* Colored progress line */}
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
            {/* Milestone dots */}
            {milestoneData.map((ms, i) => {
              const isComplete = ms.status === 'complete'
              const isActive = ms.status === 'in_progress'
              const color = getGradientColor(i)
              return (
                <div key={ms.id} className="flex-1 flex flex-col items-center relative z-10" style={{ minWidth: '80px' }}>
                  <div
                    className={`w-7 h-7 rounded-full border-[3px] transition-all duration-300 ${
                      isComplete
                        ? 'scale-110'
                        : isActive
                          ? 'scale-105 shadow-md'
                          : ''
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

function formatFieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()
}

function formatFieldValue(value) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    if (typeof value[0] === 'object') return null
    return value.join(', ')
  }
  if (typeof value === 'object') return null
  return String(value)
}

function isBooleanField(value) {
  if (typeof value === 'boolean') return true
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'yes' || lower === 'no' || lower === 'true' || lower === 'false'
  }
  return false
}

function toBooleanDisplay(value) {
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    if (lower === 'true' || lower === 'yes') return 'yes'
    if (lower === 'false' || lower === 'no') return 'no'
  }
  return ''
}

// ── Photo upload slot (profile / cover) with crop/rotate ──
function AdminPhotoSlot({ label, hint, storagePath, onChange, cropAspect = 1 }) {
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!storagePath) return
    let cancelled = false
    listProfilePhotos(storagePath).then(list => {
      if (!cancelled && list.length > 0) setPhoto(list[0])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [storagePath])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
    setUploading(true); setError(null)
    try {
      if (photo) await deleteProfilePhoto(photo.path).catch(() => {})
      const result = await uploadProfilePhoto(storagePath, file)
      if (result) { setPhoto(result); if (onChange) onChange(result.url) }
    } catch (err) { setError(err.message || 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete() {
    if (!photo) return
    try { await deleteProfilePhoto(photo.path); setPhoto(null); if (onChange) onChange(null) }
    catch (err) { setError(err.message || 'Delete failed') }
  }

  async function handleCropSave(oldPhoto, croppedFile) {
    try {
      const result = await uploadProfilePhoto(storagePath, croppedFile)
      if (result) {
        await deleteProfilePhoto(oldPhoto.path).catch(() => {})
        setPhoto(result)
        if (onChange) onChange(result.url)
      }
      setEditing(false)
    } catch (err) { setError(err.message || 'Save failed') }
  }

  if (editing && photo) {
    return (
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-stone-700">{label}</p>
        </div>
        <PhotoEditor photo={photo} onSave={handleCropSave} onClose={() => setEditing(false)} aspect={cropAspect} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-stone-700">{label}</p>
        {hint && <p className="text-xs text-stone-400 mt-0.5">{hint}</p>}
      </div>
      {photo ? (
        <div className="relative group w-40 h-40">
          <img src={photo.url} alt={label} className="w-40 h-40 rounded-2xl object-cover border border-stone-200" />
          <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button onClick={() => setEditing(true)} className="p-2 rounded-full bg-white text-stone-700 hover:bg-stone-100" title="Crop / Rotate">
              <Crop className="w-4 h-4" />
            </button>
            <label className="p-2 rounded-full bg-white text-stone-700 cursor-pointer hover:bg-stone-100" title="Replace">
              <Upload className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex items-center justify-center w-40 h-40 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#283693]/50 hover:bg-[#283693]/5 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="text-center">
            {uploading ? <Loader2 className="w-6 h-6 mx-auto text-[#283693] animate-spin" /> : (
              <><Upload className="w-6 h-6 mx-auto text-stone-400" /><span className="text-xs text-stone-400 mt-1 block">Upload</span></>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <ConfirmDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} title="Delete photo?" message="This photo will be permanently deleted." onConfirm={handleDelete} />
    </div>
  )
}

// ── Admin gallery (drag-reorder, crop, rotate, multi-upload, delete) ──
function AdminGallery({ storagePath, onPhotosChange }) {
  const [galleryPhotos, setGalleryPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    if (!storagePath) return
    let cancelled = false
    listProfilePhotos(storagePath).then(list => {
      if (!cancelled) { setGalleryPhotos(list || []); if (onPhotosChange) onPhotosChange(list || []) }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [storagePath]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true); setError(null)
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { setError('Photos must be under 10MB each'); continue }
        const result = await uploadProfilePhoto(storagePath, file)
        if (result) setGalleryPhotos(prev => { const next = [...prev, result]; if (onPhotosChange) onPhotosChange(next); return next })
      }
    } catch (err) { setError(err.message || 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete(photo) {
    try {
      await deleteProfilePhoto(photo.path)
      setGalleryPhotos(prev => { const next = prev.filter(p => p.path !== photo.path); if (onPhotosChange) onPhotosChange(next); return next })
    } catch (err) { setError(err.message || 'Delete failed') }
  }

  async function handleCropSave(oldPhoto, croppedFile) {
    try {
      const result = await uploadProfilePhoto(storagePath, croppedFile)
      if (result) {
        await deleteProfilePhoto(oldPhoto.path).catch(() => {})
        setGalleryPhotos(prev => { const next = prev.map(p => p.path === oldPhoto.path ? result : p); if (onPhotosChange) onPhotosChange(next); return next })
      }
      setEditing(null)
    } catch (err) { setError(err.message || 'Save failed') }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setGalleryPhotos(prev => {
      const oldIndex = prev.findIndex(p => p.path === active.id)
      const newIndex = prev.findIndex(p => p.path === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      if (onPhotosChange) onPhotosChange(next)
      return next
    })
  }

  if (editing) return <PhotoEditor photo={editing} onSave={handleCropSave} onClose={() => setEditing(null)} />

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={galleryPhotos.map(p => p.path)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {galleryPhotos.map(photo => (
              <SortablePhoto key={photo.path} photo={photo} onEdit={setEditing} onDelete={setDeleteTarget} />
            ))}
            <label className={`flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#283693]/50 hover:bg-[#283693]/5 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="text-center">
                {uploading ? <Loader2 className="w-5 h-5 mx-auto text-[#283693] animate-spin" /> : (
                  <><Upload className="w-5 h-5 mx-auto text-stone-400" /><span className="text-[10px] text-stone-400 mt-1 block">Add</span></>
                )}
              </div>
              <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </SortableContext>
      </DndContext>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="Delete photo?" message="This photo will be permanently deleted." onConfirm={() => { handleDelete(deleteTarget); setDeleteTarget(null) }} />
    </>
  )
}

function AdminPhotosSection({ photos, setPhotos, profileData, setProfileData, portraitUrl, surrogate }) {
  const [editingPhoto, setEditingPhoto] = useState(null) // photo object being edited
  const [rotation, setRotation] = useState(0)
  const [scale, setScale] = useState(1)
  const [cropMode, setCropMode] = useState(false)
  const [cropStart, setCropStart] = useState(null)
  const [cropRect, setCropRect] = useState(null)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const hiddenPhotos = profileData?._hiddenPhotos || []
  const baseId = surrogate?.userId || surrogate?.id
  const [deletePhotoTarget, setDeletePhotoTarget] = useState(null)

  async function togglePhotoInactive(photoPath) {
    const current = profileData?._hiddenPhotos || []
    const updated = current.includes(photoPath)
      ? current.filter(p => p !== photoPath)
      : [...current, photoPath]
    const newData = { ...profileData, _hiddenPhotos: updated }
    setProfileData(newData)
    if (surrogate.email) {
      try { await adminUpdateSurrogateProfile(surrogate.email, newData) } catch {}
    }
  }

  async function handleDeletePhoto(photo) {
    try {
      await deleteProfilePhoto(photo.path)
      setPhotos(prev => prev.filter(p => p.path !== photo.path))
    } catch {}
  }

  function openEditor(photo) {
    setEditingPhoto(photo)
    setRotation(0)
    setScale(1)
    setCropMode(false)
    setCropRect(null)
    setCropStart(null)
  }

  function handleCropMouseDown(e) {
    if (!cropMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    setCropStart({ x, y })
    setCropRect({ x, y, w: 0, h: 0 })
  }

  function handleCropMouseMove(e) {
    if (!cropMode || !cropStart) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    setCropRect({
      x: Math.min(cropStart.x, x), y: Math.min(cropStart.y, y),
      w: Math.abs(x - cropStart.x), h: Math.abs(y - cropStart.y),
    })
  }

  function handleCropMouseUp() { setCropStart(null) }

  async function saveEdits() {
    if (!editingPhoto || !imgRef.current) return
    setSaving(true)
    try {
      const img = imgRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Handle rotation
      const isRotated = rotation % 180 !== 0
      const sw = img.naturalWidth, sh = img.naturalHeight
      let cw = sw, ch = sh
      if (isRotated) { cw = sh; ch = sw }

      // Handle crop (translate from display to natural coords)
      if (cropRect && cropRect.w > 10 && cropRect.h > 10) {
        const dispW = img.clientWidth, dispH = img.clientHeight
        const scaleX = (isRotated ? sh : sw) / dispW
        const scaleY = (isRotated ? sw : sh) / dispH
        const cx = cropRect.x * scaleX, cy = cropRect.y * scaleY
        const ccw = cropRect.w * scaleX, cch = cropRect.h * scaleY
        canvas.width = ccw; canvas.height = cch
        ctx.translate(ccw / 2, cch / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.scale(scale, scale)
        ctx.drawImage(img, -(sw / 2) + (isRotated ? -cy + (cch / 2 * (sw / cch)) * 0 : -cx), isRotated ? -cx : -cy)
        // Simpler approach: render full transformed image, then crop
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = cw * scale; tempCanvas.height = ch * scale
        const tctx = tempCanvas.getContext('2d')
        tctx.translate(tempCanvas.width / 2, tempCanvas.height / 2)
        tctx.rotate((rotation * Math.PI) / 180)
        tctx.scale(scale, scale)
        tctx.drawImage(img, -sw / 2, -sh / 2)

        const scaleX2 = tempCanvas.width / img.clientWidth
        const scaleY2 = tempCanvas.height / img.clientHeight
        canvas.width = cropRect.w * scaleX2
        canvas.height = cropRect.h * scaleY2
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(tempCanvas, cropRect.x * scaleX2, cropRect.y * scaleY2, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
      } else {
        canvas.width = cw * scale; canvas.height = ch * scale
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.scale(scale, scale)
        ctx.drawImage(img, -sw / 2, -sh / 2)
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      const result = await replaceProfilePhoto(editingPhoto.path, blob)
      if (result) {
        setPhotos(prev => prev.map(p => p.path === editingPhoto.path ? { ...p, url: result.url } : p))
      }
      setEditingPhoto(null)
    } catch (err) {
      console.error('Failed to save photo edits:', err)
    }
    setSaving(false)
  }

  // Combine all photos including virtual profile photo
  let allPhotos = [...photos]
  const profilePhotoUrl = profileData?.personal?.profilePhotoUrl || portraitUrl
  const hasPortraitInPhotos = photos.some(p => p.path?.includes('/portrait/'))
  if (!hasPortraitInPhotos && profilePhotoUrl) {
    allPhotos = [{ url: profilePhotoUrl, path: '_profile_photo', name: 'Profile Photo' }, ...allPhotos]
  }

  const activeCount = allPhotos.filter(p => !hiddenPhotos.includes(p.path)).length

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="w-4 h-4 text-[#283693]" /> Profile Photos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile + Cover upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AdminPhotoSlot
            label="Profile Photo"
            hint="A favorite recent photo of just them"
            storagePath={`${baseId}/portrait`}
          />
          <AdminPhotoSlot
            label="Cover Photo"
            hint="A favorite picture with family or doing something they love"
            storagePath={`${baseId}/headshot`}
            cropAspect={16 / 9}
          />
        </div>
        {/* Gallery */}
        <div>
          <p className="text-sm font-semibold text-stone-700 mb-1">Photo Gallery</p>
          <p className="text-xs text-stone-400 mb-3">Additional photos shown in the carousel. Drag to reorder. Click to crop or rotate.</p>
          <AdminGallery storagePath={baseId} onPhotosChange={(list) => setPhotos(list)} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ProfileTab({ surrogate, setSurrogate, profileData, setProfileData, profileStatus, setProfileStatus, photos, setPhotos, portraitUrl, heightStr, quizAnswers, setQuizAnswers, insuranceStatus }) {
  const [editingSection, setEditingSection] = useState(null)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPhotos, setPreviewPhotos] = useState([])
  const [downloading, setDownloading] = useState(false)
  const [openAdminSections, setOpenAdminSections] = useState({})
  const adminSaveTimer = useRef(null)
  const previewRef = useRef(null)

  // Load photos fresh for preview (headshot first, then portrait, then gallery)
  async function loadPreviewPhotos() {
    const uid = surrogate?.userId || surrogate?.user_id
    const caseId = String(surrogate?.id || '')
    const ids = [uid, caseId].filter(Boolean)
    const uniqueIds = [...new Set(ids)]
    let allHeadshots = [], allPortraits = [], allGallery = []
    for (const id of uniqueIds) {
      const [gallery, headshots, portraits] = await Promise.all([
        listProfilePhotos(id).catch(() => []),
        listProfilePhotos(`${id}/headshot`).catch(() => []),
        listProfilePhotos(`${id}/portrait`).catch(() => []),
      ])
      allHeadshots.push(...headshots)
      allPortraits.push(...portraits)
      allGallery.push(...gallery)
    }
    const ordered = [...allHeadshots, ...allPortraits, ...allGallery]
    setPreviewPhotos(ordered)
    return ordered
  }

  // Auto-save a section's data with debounce
  function autoSaveSection(sectionKey, sectionData) {
    const newData = { ...data, [sectionKey]: sectionData }
    setProfileData(newData)
    if (adminSaveTimer.current) clearTimeout(adminSaveTimer.current)
    adminSaveTimer.current = setTimeout(async () => {
      if (!surrogate.email) return
      try {
        await adminUpdateSurrogateProfile(surrogate.email, newData)
        if (sectionKey === 'personal' && surrogate.id) {
          const { supabase: sb } = await import('@/lib/supabase')
          if (sb) {
            const row = await sb.from('intake_submissions').select('answers').eq('id', surrogate.id).single()
            if (row.data) {
              const updated = { ...(row.data.answers || {}), _surrogateProfile: newData }
              await sb.from('intake_submissions').update({ answers: updated }).eq('id', surrogate.id)
            }
          }
        }
      } catch {}
    }, 1500)
  }

  function updateSectionField(sectionKey, fieldKey, value) {
    const sectionData = { ...(data[sectionKey] || {}), [fieldKey]: value }
    autoSaveSection(sectionKey, sectionData)
  }

  function updateSectionData(sectionKey, sectionData) {
    autoSaveSection(sectionKey, sectionData)
  }

  function downloadPDF() {
    if (!previewOpen) { loadPreviewPhotos(); setPreviewOpen(true) }
    setTimeout(() => {
      if (!previewRef.current) return
      const firstName = (data?.personal?.firstName || data?.about?.firstName || surrogate.name?.split(' ')[0] || 'Surrogate').replace(/[^a-zA-Z0-9]/g, '')
      const printWin = window.open('', '_blank')
      if (!printWin) { alert('Please allow popups to save as PDF'); return }
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML).join('\n')
      // Build photo grid HTML for bottom of PDF
      const photoGridHtml = previewPhotos.length > 1 ? `
        <div class="pdf-photo-grid">
          <div style="padding:12px 24px;border-bottom:1px solid #e5e7eb;background:linear-gradient(to right,rgba(40,54,147,0.05),transparent)">
            <h3 style="font-size:13px;font-weight:700;color:#283693;text-transform:uppercase;letter-spacing:0.05em;margin:0">Photos</h3>
          </div>
          <div style="padding:16px 24px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
            ${previewPhotos.slice(0, 10).map(ph => `<div style="aspect-ratio:1;border-radius:8px;overflow:hidden"><img src="${ph.url}" style="width:100%;height:100%;object-fit:cover" /></div>`).join('')}
          </div>
        </div>` : ''

      const html = `<!DOCTYPE html><html><head><title>${firstName} - Surrogate Profile</title>${styles}
        <style>
          @page { size: letter; margin: 0; }
          @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0 !important; padding: 0 !important; }
            .print-bar { display: none !important; }
            .print-container { max-width: 100% !important; padding: 0 !important; }
          }
          body { background: #fdf8f3; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
          .print-container { max-width: 100%; margin: 0; padding: 0; }
          .print-bar { position: sticky; top: 0; z-index: 100; padding: 14px 24px; background: #283693; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
          .print-bar button { background: white; color: #283693; border: none; padding: 8px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
          .print-bar button:hover { opacity: 0.9; }
          .print-bar .hint { font-size: 12px; opacity: 0.7; margin-left: 12px; }
          /* PDF-specific: fix cover image and hide interactive elements */
          [data-pdf="cover"] { height: auto !important; max-height: 320px !important; }
          [data-pdf="cover"] img { object-fit: contain !important; height: auto !important; max-height: 320px !important; }
          [data-pdf="cover"] > div { display: none !important; } /* hide gradient + badge */
          [data-pdf="thumbs"] { display: none !important; }
          [data-pdf="portrait"] { position: absolute !important; bottom: -32px !important; left: 16px !important; width: 96px !important; height: 96px !important; border-radius: 16px !important; object-fit: cover !important; border: 4px solid white !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; z-index: 20 !important; }
        </style></head><body>
        <div class="print-bar">
          <div>
            <strong>${firstName}'s Surrogate Profile</strong>
            <span class="hint">Use "Save as PDF" as destination for best results</span>
          </div>
          <button onclick="window.print()">Save as PDF</button>
        </div>
        <div class="print-container">${previewRef.current.innerHTML}</div>
        ${photoGridHtml}
        <script>setTimeout(function() {}, 500);</script>
        </body></html>`
      printWin.document.write(html)
      printWin.document.close()
    }, 300)
  }
  const [statusLoading, setStatusLoading] = useState(false)
  const isApproved = profileStatus === 'approved'
  const data = profileData || {}

  const hiddenFields = Array.isArray(data._hiddenFields) ? data._hiddenFields : []

  function isFieldHidden(sectionKey, fieldKey) {
    return hiddenFields.includes(`${sectionKey}.${fieldKey}`)
  }

  async function toggleFieldHidden(sectionKey, fieldKey) {
    const path = `${sectionKey}.${fieldKey}`
    const current = Array.isArray(data._hiddenFields) ? data._hiddenFields : []
    const updated = current.includes(path)
      ? current.filter(p => p !== path)
      : [...current, path]
    const newData = { ...data, _hiddenFields: updated }
    setProfileData(newData)
    if (surrogate.email) {
      try {
        await adminUpdateSurrogateProfile(surrogate.email, newData)
      } catch {}
    }
  }

  function HideToggle({ sectionKey, fieldKey }) {
    const hidden = isFieldHidden(sectionKey, fieldKey)
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggleFieldHidden(sectionKey, fieldKey) }}
        className={`shrink-0 p-0.5 rounded transition-colors ${hidden ? 'text-red-400 hover:text-red-600' : 'text-gray-300 hover:text-gray-500'}`}
        title={hidden ? 'Hidden from IPs — click to show' : 'Visible to IPs — click to hide'}
      >
        {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    )
  }

  function startSectionEdit(sec) {
    const sectionData = data[sec.key] || {}
    const merged = { ...sectionData }
    const arrayFieldNames = ['pregnancies', 'householdMembers', 'journeys', 'complicationsList', 'diseaseHistory', 'healthConditionsList']
    for (const f of sec.fields) {
      if (!(f in merged)) {
        merged[f] = arrayFieldNames.includes(f) ? [] : ''
      }
    }
    setEditData(merged)
    setEditingSection(sec)
    setTimeout(() => {
      document.getElementById(`admin-sec-${sec.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  function updateEditField(field, value) {
    setEditData(prev => {
      const next = { ...prev, [field]: value }
      // When numberOfPregnancies changes, auto-resize pregnancies array
      if (field === 'numberOfPregnancies') {
        const num = parseInt(value) || 0
        const current = Array.isArray(prev.pregnancies) ? prev.pregnancies : []
        if (num > current.length) {
          const newSlots = Array.from({ length: num - current.length }, () => ({
            outcome: '', wasSurrogacy: '', name: '', dob: '', gestationWeeks: '', gestationDays: '',
            deliveryType: '', sex: '', singleOrMultiples: '', weight: '', length: '', complications: '',
          }))
          next.pregnancies = [...current, ...newSlots]
        } else if (num < current.length) {
          next.pregnancies = current.slice(0, num)
        }
      }
      return next
    })
  }

  // Auto-save editData changes via debounce
  useEffect(() => {
    if (!editData || !editingSection) return
    if (adminSaveTimer.current) clearTimeout(adminSaveTimer.current)
    adminSaveTimer.current = setTimeout(() => {
      autoSaveSection(editingSection.key, editData)
    }, 1500)
  }, [editData]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSectionEdit() {
    if (!editingSection) return
    if (!surrogate.email) {
      alert('Cannot save: this surrogate has no email address. Please add an email in the Contact/Quiz section first.')
      return
    }
    setSaving(true)
    try {
      const updated = { ...data, [editingSection.key]: editData }
      await adminUpdateSurrogateProfile(surrogate.email, updated)
      setProfileData(updated)
      // Sync shared fields back to intake_submissions so hero/quiz stay in sync
      if (editingSection.key === 'personal' && surrogate.id) {
        const syncFields = {}
        const fieldMap = { maritalStatus: 'maritalStatus', city: 'city', state: 'state', heightFt: 'heightFt', heightIn: 'heightIn', weight: 'weightLbs' }
        for (const [profileKey, intakeKey] of Object.entries(fieldMap)) {
          if (editData[profileKey] !== undefined) syncFields[intakeKey] = editData[profileKey]
        }
        if (Object.keys(syncFields).length > 0) {
          // Merge into intake answers
          const currentAnswers = quizAnswers || {}
          const mergedAnswers = { ...currentAnswers, ...syncFields }
          await updateIntakeSubmission(surrogate.id, { answers: mergedAnswers }).catch(() => {})
          setQuizAnswers(mergedAnswers)
          // Update local surrogate state so hero refreshes
          setSurrogate(prev => ({ ...prev, ...syncFields, location: [syncFields.city || prev.location?.split(', ')[0], syncFields.state || prev.location?.split(', ')[1]].filter(Boolean).join(', ') }))
        }
      }
      setEditingSection(null)
    } catch (err) {
      console.error('Failed to save profile section:', err)
      alert('Failed to save: ' + (err.message || 'Unknown error'))
    } finally { setSaving(false) }
  }

  async function toggleApproval() {
    if (!surrogate.email) return
    setStatusLoading(true)
    try {
      await updateSurrogateProfileStatus(surrogate.email, isApproved ? 'draft' : 'approved')
      setProfileStatus(isApproved ? 'draft' : 'approved')
    } catch {} finally { setStatusLoading(false) }
  }

  function addArrayItem(field) {
    const current = editData[field] || []
    let newItem = {}
    if (field === 'pregnancies') {
      newItem = { id: Date.now(), name: '', dob: '', sex: '', outcome: '', deliveryType: '', singleOrMultiples: 'Single', weight: '', length: '', gestationWeeks: '', gestationDays: '', wasSurrogacy: '', complications: '' }
    } else if (field === 'householdMembers') {
      newItem = { id: Date.now(), name: '', relationship: '' }
    } else if (field === 'journeys') {
      newItem = { id: Date.now(), reName: '', reLocation: '', reDates: '', outcome: '', complications: '', weeksDelivered: '', transfers: '', embryoSource: '', unsuccessfulCycles: '' }
    } else {
      newItem = { id: Date.now() }
    }
    updateEditField(field, [...current, newItem])
  }

  function removeArrayItem(field, index) {
    const current = editData[field] || []
    updateEditField(field, current.filter((_, i) => i !== index))
  }

  let totalFields = 0, totalFilled = 0
  for (const sec of PROFILE_SECTIONS) {
    const { filled, total } = countSectionFilled(data, sec)
    totalFields += total
    totalFilled += filled
  }
  const overallPercent = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0

  const NUMBER_FIELDS = ['numberOfPregnancies', 'householdMemberCount', 'surrogacyTimes', 'sleepHours', 'heightFt', 'heightIn', 'weight', 'weightLbs']

  // Yes/No toggle fields (match surrogate YesNoField)
  const YES_NO_FIELDS = new Set([
    'usCitizen', 'realId', 'validPassport', 'otherLanguages', 'monogamous', 'partnerUsCitizen',
    'sameBioFather', 'infertilityTreatment', 'gynecologicalProblems', 'cycleLength', 'breastfeeding',
    'pregnancyMedication', 'willingToTravelNICU',
    'childrenFullTime', 'childrenSpecialNeeds', 'placedForAdoption', 'planMoreChildren',
    'smokeVape', 'smokingHistory', 'householdSmoker', 'alcoholDrugs', 'advisedLimitSubstances',
    'householdControlledSubstances', 'gunsOwned', 'piercingsTattoos', 'nonSterilePiercing',
    'eatingDisorders', 'criminalHistory', 'recentTravel', 'travelPlans', 'sleepIssues',
    'reliableVehicle', 'autoInsurance', 'validLicense', 'partnerFdaTests',
    'mentalHealthDiagnosis', 'mentalHealthHospitalization', 'mentalHealthMedication',
    'counselingTherapy', 'familyMentalHealth', 'domesticViolence',
    'openToVaccinations', 'covidVaccine', 'covidVaccineWilling', 'hadCovid', 'covidBooster', 'covidBoosterWilling',
    'currentlyEmployed', 'governmentAssistance', 'currentlyInSchool', 'previousSurrogate',
    'threeTransferAttempts', 'reduceCaffeine', 'lifestyleChanges', 'pumpBreastmilk',
    'ipsAtAppointments', 'ipsWithChildren', 'openLGBTQ', 'openSingleIP',
    'transferAnotherState', 'ipsOutsideUS', 'cvsAmnio', 'partnerAgreesTermination',
    'carryTwins', 'compensationNegotiable',
  ])

  // Dropdown fields with their options
  const SELECT_FIELDS = {
    state: US_STATES_FULL,
    heightFt: ['4', '5', '6'],
    heightIn: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    maritalStatus: ['Single', 'In a Relationship', 'Married', 'Domestic Partnership', 'Divorced', 'Separated', 'Widowed'],
    sexualPartners: ['0', '1', '2', '3', '4+'],
    contraceptiveMethod: ['None', 'Birth Control Pills', 'IUD', 'Condoms', 'Implant', 'Depo Shot', 'Natural Family Planning', 'Celibacy', 'Vasectomy', 'Same Sex Partner', 'Other'],
    homeOwnership: ['Own', 'Rent', 'Other'],
    religionImportance: ['Not Important', 'Somewhat Important', 'Important', 'Very Important'],
    insuranceType: ['Private/Personal', 'Through my employer', "Through spouse's employer", 'No insurance', 'Other'],
    educationLevel: ['Some High School', 'High School Diploma / GED', 'Some College', 'Associate Degree', "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Vocational / Trade School', 'Other'],
    preferredCommunication: ['Text', 'Email', 'Phone Calls', 'FaceTime / Video Calls', 'Mix of Everything'],
    ipInvolvement: ['Very Involved', 'Moderately Involved', 'Occasional Check-ins', 'Minimal'],
    whenReadyToBegin: ['Immediately', 'Within 1-3 months', 'Within 3-6 months', 'Within 6-12 months', '1+ year'],
    postBirthRelationship: ['Close / Ongoing', 'Occasional Updates', 'Holiday Cards / Photos', 'Clean Break', 'Open to Whatever Develops'],
    embryosToTransfer: ['1', '2', 'Doctor recommendation', 'Open to discussion'],
  }

  // Checkbox group fields with their options
  const CHECKBOX_FIELDS = {
    diseaseHistory: ['Anemia', 'Autoimmune disorder', 'Blood sugar issues', 'Breast Disorders', 'Cancer', 'Chest Pain', 'Chlamydia', 'CMV', 'Cyst (uterine/ovarian)', 'Gonorrhea (or other STI)', 'Hepatitis B', 'High Blood Pressure', 'High Cholesterol', 'HIV/AIDS', 'HPV', 'Hypoglycemia or hyperglycemia', 'HSV 1 (cold sores)', 'HSV 2 (genital herpes)', 'Leukemia', 'Liver Disease', 'Migraine Headaches', 'Psychiatric Disorders', 'Reproductive Disorders', 'Thyroid Disorder', 'Tumor', 'Tuberculosis', 'Other', 'None of the Above'],
    complicationsList: ['C-Section', 'Ectopic Pregnancy', 'Gestational Diabetes', 'High Blood Pressure', 'IUGR (Intrauterine Growth Restriction)', 'Physician Ordered Bed Rest', 'Placenta Previa', 'Postpartum Depression', 'Premature Birth', 'Retained Placenta', 'Toxemia', 'Other', 'None of the above'],
  }

  // Currency fields
  const CURRENCY_FIELDS = new Set(['desiredCompensation', 'hourlyRate', 'weeklyIncome', 'partnerWeeklyIncome'])

  // Textarea fields (multi-line text)
  const TEXTAREA_FIELDS = new Set([
    'sameBioFatherDetails', 'pregnancyDetails', 'infectionAfterDetails', 'birthDefectDetails',
    'complicationsExplanation', 'infertilityTreatmentDetails', 'gynecologicalProblemsDetails',
    'pregnancyMedicationList', 'nearestNICU', 'cycleLengthDetails', 'breastfeedingStopDate', 'timeToConceive',
    'homeDuration', 'childrenFullTimeDetails', 'childrenSpecialNeedsDetails', 'placedForAdoptionDetails',
    'divorcedRelationship', 'planMoreChildrenDetails', 'smokingHistoryDetails', 'householdSmokerDetails',
    'alcoholDrugsDetails', 'advisedLimitDetails', 'householdSubstancesDetails', 'householdSubstancesPurpose',
    'gunsDetails', 'piercingsTattoosDetails', 'eatingDisordersDetails', 'typicalDiet',
    'religion', 'ethnicity', 'differentReligion', 'criminalHistoryDetails',
    'recentTravelDetails', 'travelPlansDetails', 'exerciseFrequency', 'sleepIssuesDetails',
    'mentalHealthDetails', 'mentalHealthHospDetails', 'mentalHealthMedDetails',
    'counselingDetails', 'familyMentalHealthDetails', 'domesticViolenceDetails',
    'nonPrescriptionMeds', 'prescriptionMeds', 'currentMeds', 'allergies', 'medicalConditions',
    'surgeries', 'diseaseHistoryDetails', 'vaccinationReasons',
    'employmentIndustry', 'healthInsurance', 'governmentAssistanceDetails',
    'hobbies', 'dreamTravel', 'personality', 'currentlyInSchoolDetails', 'overallExperience',
    'reasonForSurrogacy', 'compensationUse', 'surrogacyFit', 'supportSystem',
    'lifestyleChangesDetails', 'idealIPs', 'ipsAtAppointmentsDetails', 'deliveryRoomOthers',
    'ipsCantAttend', 'childCareTraveling', 'cvsAmnioDetails', 'willingnessToTerminate',
    'conditionsWontTerminate', 'additionalComments',
  ])

  const inputClass = "w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none"

  function renderScalarFieldEdit(field, secKey) {
    const val = editData[field]
    const hidden = isFieldHidden(secKey, field)

    const labelRow = (
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground font-medium flex-1">{formatFieldLabel(field)}</label>
        <HideToggle sectionKey={secKey} fieldKey={field} />
      </div>
    )

    // Number fields
    if (NUMBER_FIELDS.includes(field) && !SELECT_FIELDS[field]) {
      return (
        <div key={field} className={`space-y-1 ${hidden ? 'opacity-50' : ''}`}>
          {labelRow}
          <input type="number" min="0" max={field === 'numberOfPregnancies' ? '20' : undefined}
            className={inputClass} value={val || ''} onChange={e => updateEditField(field, e.target.value)} />
        </div>
      )
    }

    // Select/dropdown fields
    if (SELECT_FIELDS[field]) {
      return (
        <div key={field} className={`space-y-1 ${hidden ? 'opacity-50' : ''}`}>
          {labelRow}
          <SelectUI value={val || ''} onValueChange={v => updateEditField(field, v)}>
            <SelectTriggerUI className="h-9 text-sm bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
            <SelectContentUI>
              {SELECT_FIELDS[field].map(opt => <SelectItemUI key={opt} value={opt}>{opt}</SelectItemUI>)}
            </SelectContentUI>
          </SelectUI>
        </div>
      )
    }

    // Checkbox group fields
    if (CHECKBOX_FIELDS[field]) {
      const current = Array.isArray(val) ? val : []
      const toggle = (opt) => {
        const set = new Set(current)
        if (set.has(opt)) set.delete(opt)
        else set.add(opt)
        updateEditField(field, [...set])
      }
      return (
        <div key={field} className={`space-y-1.5 col-span-full ${hidden ? 'opacity-50' : ''}`}>
          {labelRow}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {CHECKBOX_FIELDS[field].map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={current.includes(opt)} onCheckedChange={() => toggle(opt)} />
                <span className="text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    // Currency fields
    if (CURRENCY_FIELDS.has(field)) {
      const formatCurrency = (v) => {
        const digits = String(v).replace(/[^0-9]/g, '')
        if (!digits) return ''
        return '$' + Number(digits).toLocaleString('en-US')
      }
      return (
        <div key={field} className={`space-y-1 ${hidden ? 'opacity-50' : ''}`}>
          {labelRow}
          <input className={inputClass} value={formatCurrency(val)} placeholder="$0"
            onChange={e => { const digits = e.target.value.replace(/[^0-9]/g, ''); updateEditField(field, digits ? '$' + Number(digits).toLocaleString('en-US') : '') }} />
        </div>
      )
    }

    // Yes/No toggle fields
    if (YES_NO_FIELDS.has(field) || isBooleanField(val)) {
      const display = typeof val === 'boolean' ? (val ? 'yes' : 'no') : (val === true || val === 'true' ? 'yes' : val === false || val === 'false' ? 'no' : val || '')
      return (
        <div key={field} className={`space-y-1 ${hidden ? 'opacity-50' : ''}`}>
          {labelRow}
          <div className="flex items-center gap-2 pt-0.5">
            <button type="button" onClick={() => updateEditField(field, 'yes')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${display === 'yes' ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              Yes
            </button>
            <button type="button" onClick={() => updateEditField(field, 'no')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${display === 'no' ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              No
            </button>
          </div>
        </div>
      )
    }

    // Textarea fields
    if (TEXTAREA_FIELDS.has(field)) {
      return (
        <div key={field} className={`space-y-1 col-span-full ${hidden ? 'opacity-50' : ''}`}>
          {labelRow}
          <Textarea className="bg-white text-sm min-h-[60px]" rows={2} value={val || ''}
            onChange={e => updateEditField(field, e.target.value)} />
        </div>
      )
    }

    // Default: text input
    return (
      <div key={field} className={`space-y-1 ${hidden ? 'opacity-50' : ''}`}>
        {labelRow}
        <input className={inputClass} value={Array.isArray(val) ? val.join(', ') : String(val || '')}
          onChange={e => updateEditField(field, e.target.value)} />
      </div>
    )
  }

  function renderPregnancyEdit(item, i, field) {
    const updateItem = (k, val) => {
      const updated = [...editData[field]]
      updated[i] = { ...updated[i], [k]: val }
      updateEditField(field, updated)
    }
    return (
      <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-[#283693]">Pregnancy #{i + 1}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Outcome</span>
            <SelectUI value={item.outcome || ''} onValueChange={v => updateItem('outcome', v)}>
              <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
              <SelectContentUI>
                {['Live Birth', 'Miscarriage', 'Stillborn', 'Ectopic Pregnancy', 'Termination'].map(o => (
                  <SelectItemUI key={o} value={o}>{o}</SelectItemUI>
                ))}
              </SelectContentUI>
            </SelectUI>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Surrogacy?</span>
            <SelectUI value={item.wasSurrogacy || ''} onValueChange={v => updateItem('wasSurrogacy', v)}>
              <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
              <SelectContentUI>
                <SelectItemUI value="yes">Yes</SelectItemUI>
                <SelectItemUI value="no">No</SelectItemUI>
              </SelectContentUI>
            </SelectUI>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">{item.outcome === 'Live Birth' ? "Child's Name" : 'Notes'}</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.name || ''} onChange={e => updateItem('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Date</span>
            <input type="date" className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.dob || ''} onChange={e => updateItem('dob', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Gestation (weeks)</span>
            <input type="number" min="0" max="45" className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.gestationWeeks || ''} onChange={e => updateItem('gestationWeeks', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Gestation (days)</span>
            <input type="number" min="0" max="6" className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.gestationDays || ''} onChange={e => updateItem('gestationDays', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Delivery Type</span>
            <SelectUI value={item.deliveryType || ''} onValueChange={v => updateItem('deliveryType', v)}>
              <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
              <SelectContentUI>
                {(item.outcome === 'Live Birth' || item.outcome === 'Stillborn'
                  ? ['Vaginal', 'C-Section']
                  : ['Natural', 'Surgical / D&C', 'Medical (medication)', 'C-Section', 'N/A']
                ).map(o => <SelectItemUI key={o} value={o}>{o}</SelectItemUI>)}
              </SelectContentUI>
            </SelectUI>
          </div>
          {item.outcome === 'Live Birth' && (() => {
            const isMultiples = item.singleOrMultiples === 'Twins' || item.singleOrMultiples === 'Triplets+'
            const isTriplets = item.singleOrMultiples === 'Triplets+'
            return (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase">Single/Multiples</span>
                  <SelectUI value={item.singleOrMultiples || ''} onValueChange={v => updateItem('singleOrMultiples', v)}>
                    <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                    <SelectContentUI>
                      <SelectItemUI value="Single">Single</SelectItemUI>
                      <SelectItemUI value="Twins">Twins</SelectItemUI>
                      <SelectItemUI value="Triplets+">Triplets+</SelectItemUI>
                    </SelectContentUI>
                  </SelectUI>
                </div>

                {/* Baby A */}
                <div className={`${isMultiples ? 'col-span-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2' : 'contents'}`}>
                  {isMultiples && <p className="text-[10px] font-bold text-[#283693] uppercase tracking-wider">Baby A</p>}
                  <div className={isMultiples ? 'grid grid-cols-2 sm:grid-cols-4 gap-2' : 'contents'}>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase">Name</span>
                      <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.name || ''} onChange={e => updateItem('name', e.target.value)} placeholder="Baby's name" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase">Sex</span>
                      <SelectUI value={item.sex || ''} onValueChange={v => updateItem('sex', v)}>
                        <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                        <SelectContentUI>
                          <SelectItemUI value="Male">Male</SelectItemUI>
                          <SelectItemUI value="Female">Female</SelectItemUI>
                        </SelectContentUI>
                      </SelectUI>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase">Delivery Type</span>
                      <SelectUI value={item.deliveryType || ''} onValueChange={v => updateItem('deliveryType', v)}>
                        <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                        <SelectContentUI>
                          <SelectItemUI value="Vaginal">Vaginal</SelectItemUI>
                          <SelectItemUI value="C-Section">C-Section</SelectItemUI>
                        </SelectContentUI>
                      </SelectUI>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase">Weight</span>
                      <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.weight || ''} onChange={e => updateItem('weight', e.target.value)} placeholder="e.g. 7 lbs 4 oz" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase">Length</span>
                      <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.length || ''} onChange={e => updateItem('length', e.target.value)} placeholder="inches" />
                    </div>
                  </div>
                </div>

                {/* Baby B */}
                {isMultiples && (
                  <div className="col-span-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-[#283693] uppercase tracking-wider">Baby B</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Name</span>
                        <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.babyBName || ''} onChange={e => updateItem('babyBName', e.target.value)} placeholder="Baby's name" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Sex</span>
                        <SelectUI value={item.babyBSex || ''} onValueChange={v => updateItem('babyBSex', v)}>
                          <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                          <SelectContentUI>
                            <SelectItemUI value="Male">Male</SelectItemUI>
                            <SelectItemUI value="Female">Female</SelectItemUI>
                          </SelectContentUI>
                        </SelectUI>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Delivery Type</span>
                        <SelectUI value={item.babyBDeliveryType || ''} onValueChange={v => updateItem('babyBDeliveryType', v)}>
                          <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                          <SelectContentUI>
                            <SelectItemUI value="Vaginal">Vaginal</SelectItemUI>
                            <SelectItemUI value="C-Section">C-Section</SelectItemUI>
                          </SelectContentUI>
                        </SelectUI>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Weight</span>
                        <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.babyBWeight || ''} onChange={e => updateItem('babyBWeight', e.target.value)} placeholder="e.g. 7 lbs 4 oz" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Length</span>
                        <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.babyBLength || ''} onChange={e => updateItem('babyBLength', e.target.value)} placeholder="inches" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Baby C */}
                {isTriplets && (
                  <div className="col-span-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-[#283693] uppercase tracking-wider">Baby C</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Name</span>
                        <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.babyCName || ''} onChange={e => updateItem('babyCName', e.target.value)} placeholder="Baby's name" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Sex</span>
                        <SelectUI value={item.babyCSex || ''} onValueChange={v => updateItem('babyCSex', v)}>
                          <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                          <SelectContentUI>
                            <SelectItemUI value="Male">Male</SelectItemUI>
                            <SelectItemUI value="Female">Female</SelectItemUI>
                          </SelectContentUI>
                        </SelectUI>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Delivery Type</span>
                        <SelectUI value={item.babyCDeliveryType || ''} onValueChange={v => updateItem('babyCDeliveryType', v)}>
                          <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                          <SelectContentUI>
                            <SelectItemUI value="Vaginal">Vaginal</SelectItemUI>
                            <SelectItemUI value="C-Section">C-Section</SelectItemUI>
                          </SelectContentUI>
                        </SelectUI>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Weight</span>
                        <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.babyCWeight || ''} onChange={e => updateItem('babyCWeight', e.target.value)} placeholder="e.g. 7 lbs 4 oz" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase">Length</span>
                        <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.babyCLength || ''} onChange={e => updateItem('babyCLength', e.target.value)} placeholder="inches" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 uppercase">Complications / Details</span>
          <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.complications || ''} onChange={e => updateItem('complications', e.target.value)} />
        </div>
      </div>
    )
  }

  function renderHouseholdMemberEdit(item, i, field) {
    const updateItem = (k, val) => {
      const updated = [...editData[field]]
      updated[i] = { ...updated[i], [k]: val }
      updateEditField(field, updated)
    }
    return (
      <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#283693]">Member #{i + 1}</span>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 gap-1 h-6 text-xs px-2" onClick={() => removeArrayItem(field, i)}>
            <Trash2 className="size-3" /> Remove
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Name</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.name || ''} onChange={e => updateItem('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Relationship</span>
            <SelectUI value={item.relationship || ''} onValueChange={v => updateItem('relationship', v)}>
              <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
              <SelectContentUI>
                {['Spouse','Partner','Son','Daughter','Stepson','Stepdaughter','Mother','Father','Sibling','Cousin','Aunt','Uncle','Grandparent','Grandchild','Roommate','Friend','Other'].map(r => (
                  <SelectItemUI key={r} value={r}>{r}</SelectItemUI>
                ))}
              </SelectContentUI>
            </SelectUI>
          </div>
        </div>
      </div>
    )
  }

  function renderJourneyEdit(item, i, field) {
    const updateItem = (k, val) => {
      const updated = [...editData[field]]
      updated[i] = { ...updated[i], [k]: val }
      updateEditField(field, updated)
    }
    return (
      <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#283693]">Journey #{i + 1}</p>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 gap-1 h-7 text-xs" onClick={() => removeArrayItem(field, i)}>
            <Trash2 className="size-3" /> Remove
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">RE Doctor Name</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.reName || ''} onChange={e => updateItem('reName', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">RE Location</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.reLocation || ''} onChange={e => updateItem('reLocation', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">RE Dates</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.reDates || ''} onChange={e => updateItem('reDates', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Outcome</span>
            <SelectUI value={item.outcome || ''} onValueChange={v => updateItem('outcome', v)}>
              <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
              <SelectContentUI>
                {['Healthy delivery', 'Delivery with complications', 'Miscarriage', 'Chemical pregnancy', 'No pregnancy achieved', 'Other'].map(o => (
                  <SelectItemUI key={o} value={o}>{o}</SelectItemUI>
                ))}
              </SelectContentUI>
            </SelectUI>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Weeks Delivered</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.weeksDelivered || ''} onChange={e => updateItem('weeksDelivered', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Transfers</span>
            <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.transfers || ''} onChange={e => updateItem('transfers', e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 uppercase">Embryo Source</span>
            <SelectUI value={item.embryoSource || ''} onValueChange={v => updateItem('embryoSource', v)}>
              <SelectTriggerUI className="h-8 text-xs bg-white"><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
              <SelectContentUI>
                {['Donor eggs', "IM's eggs", 'Unknown'].map(o => (
                  <SelectItemUI key={o} value={o}>{o}</SelectItemUI>
                ))}
              </SelectContentUI>
            </SelectUI>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 uppercase">Complications</span>
          <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.complications || ''} onChange={e => updateItem('complications', e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 uppercase">Unsuccessful Cycles</span>
          <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white h-8" value={item.unsuccessfulCycles || ''} onChange={e => updateItem('unsuccessfulCycles', e.target.value)} />
        </div>
      </div>
    )
  }

  function renderGenericItemEdit(item, i, field) {
    const updateItem = (k, val) => {
      const updated = [...editData[field]]
      updated[i] = { ...updated[i], [k]: val }
      updateEditField(field, updated)
    }
    return (
      <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#283693]">#{i + 1}</p>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 gap-1 h-6 text-xs px-2" onClick={() => removeArrayItem(field, i)}>
            <Trash2 className="size-3" /> Remove
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(item).filter(([k]) => k !== 'id').map(([k, v]) => (
            <div key={k} className="space-y-0.5">
              <span className="text-[10px] text-gray-400 uppercase">{formatFieldLabel(k)}</span>
              <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs bg-white" value={Array.isArray(v) ? v.join(', ') : String(v || '')} onChange={e => updateItem(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  function getAddButtonLabel(field) {
    if (field === 'pregnancies') return 'Add Pregnancy'
    if (field === 'householdMembers') return 'Add Member'
    if (field === 'journeys') return 'Add Journey'
    return 'Add Entry'
  }

  return (
    <div className="space-y-6">
      {isApproved && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">Profile is approved and visible to intended parents. The surrogate can no longer edit it.</p>
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile Completion</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => {
              const win = window.open(`/surrogates/${surrogate.id}/follow-up-review`, '_blank', 'width=900,height=700,scrollbars=yes')
              if (!win) alert('Please allow popups for this site')
            }}>
              <ClipboardList className="size-3.5" /> Follow Up Review
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => { if (!previewOpen) { loadPreviewPhotos(); window.scrollTo({ top: 0, behavior: 'smooth' }) }; setPreviewOpen(!previewOpen) }}>
              <Eye className="size-3.5" /> {previewOpen ? 'Edit View' : 'Preview'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={downloadPDF}>
              <Download className="size-3.5" /> Save as PDF
            </Button>
            <Button
              size="sm"
              className={`gap-1.5 rounded-full ${isApproved ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={toggleApproval}
              disabled={statusLoading}
            >
              {statusLoading ? <Loader2 className="size-3.5 animate-spin" /> : isApproved ? <ShieldX className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {isApproved ? 'Unapprove' : 'Approve'}
            </Button>
          </div>
        </CardHeader>
        {!previewOpen && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${overallPercent}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
                </div>
              </div>
              <span className="text-sm font-bold text-abc-indigo">{overallPercent}%</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PROFILE_SECTIONS.map(sec => {
                const { filled, total } = countSectionFilled(data, sec)
                const complete = filled === total && total > 0
                return (
                  <button
                    key={sec.key}
                    onClick={() => document.getElementById(`admin-sec-${sec.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`rounded-xl border p-3 text-center cursor-pointer hover:shadow-sm transition-shadow ${complete ? 'border-green-200 bg-green-50' : filled > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="text-xs font-medium text-gray-600 truncate">{sec.title}</p>
                    <p className={`text-sm font-bold mt-1 ${complete ? 'text-green-600' : filled > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {total > 0 ? `${filled}/${total}` : '—'}
                    </p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {previewOpen ? (
        <div className="max-w-[850px] mx-auto" ref={previewRef}>
          <ProfilePreview profile={data} photos={previewPhotos} insuranceStatus={insuranceStatus?.insurance_status} />
        </div>
      ) : (
        <>
          <AdminPhotosSection
            photos={photos}
            setPhotos={setPhotos}
            profileData={data}
            setProfileData={setProfileData}
            portraitUrl={portraitUrl}
            surrogate={surrogate}
          />

          <div className="space-y-4">
            {PROFILE_SECTIONS.map(sec => {
              const sectionData = data[sec.key] || {}
              const isEditing = editingSection?.key === sec.key
              const isOpen = openAdminSections[sec.key]
              const allFields = [...sec.fields, ...Object.keys(sectionData).filter(k => !sec.fields.includes(k) && k !== '_hiddenFields' && sectionData[k] !== '' && sectionData[k] !== null && sectionData[k] !== undefined)]
                .filter(f => isConditionalVisible(f, sectionData))

              const scalarFields = allFields.filter(f => {
                const val = isEditing && editData ? editData[f] : sectionData[f]
                return !(Array.isArray(val) && val.length > 0 && typeof val[0] === 'object')
              })
              const arrayFields = allFields.filter(f => {
                const val = isEditing && editData ? editData[f] : sectionData[f]
                return Array.isArray(val) && val.length > 0 && typeof val[0] === 'object'
              })
              const emptyArrayFields = isEditing && editData ? allFields.filter(f => {
                const val = editData[f]
                return Array.isArray(val) && val.length === 0
              }) : []

              return (
                <Collapsible key={sec.key} open={isOpen} onOpenChange={() => {
                  const newOpen = !isOpen
                  setOpenAdminSections(prev => ({ ...prev, [sec.key]: newOpen }))
                  if (newOpen && !isEditing) startSectionEdit(sec)
                  if (!newOpen && isEditing) setEditingSection(null)
                }}>
                <Card
                  id={`admin-sec-${sec.key}`}
                  className="rounded-2xl"
                >
                  <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-[#283693]/10 flex items-center justify-center">
                          <ChevronDown className={`size-5 text-[#283693] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base text-[#283693]">{sec.title}</CardTitle>
                          {SECTION_DESCRIPTIONS[sec.key] && <p className="text-xs text-muted-foreground mt-0.5">{SECTION_DESCRIPTIONS[sec.key]}</p>}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                  <CardContent>
                    {isEditing && editData ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {scalarFields.map(field => renderScalarFieldEdit(field, sec.key))}
                        </div>
                        {arrayFields.map(field => (
                          <div key={field}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-muted-foreground font-medium">{formatFieldLabel(field)}</p>
                              {field !== 'pregnancies' && (
                                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => addArrayItem(field)}>
                                  <Plus className="size-3" /> {getAddButtonLabel(field)}
                                </Button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {editData[field].map((item, i) => {
                                if (field === 'pregnancies') return renderPregnancyEdit(item, i, field)
                                if (field === 'householdMembers') return renderHouseholdMemberEdit(item, i, field)
                                if (field === 'journeys') return renderJourneyEdit(item, i, field)
                                return renderGenericItemEdit(item, i, field)
                              })}
                            </div>
                          </div>
                        ))}
                        {emptyArrayFields.map(field => (
                          <div key={field}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-muted-foreground font-medium">{formatFieldLabel(field)}</p>
                              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => addArrayItem(field)}>
                                <Plus className="size-3" /> {getAddButtonLabel(field)}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-400 italic">No entries yet.</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {scalarFields.map(field => {
                          const hidden = isFieldHidden(sec.key, field)
                          const val = sectionData[field]
                          const hasValue = val !== undefined && val !== '' && val !== null
                          return (
                            <div key={field} className={`flex items-center justify-between gap-4 ${hidden ? 'opacity-40' : ''}`}>
                              <span className={`text-muted-foreground ${hidden ? 'line-through' : ''}`}>{formatFieldLabel(field)}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-medium text-right ${hasValue ? '' : 'text-gray-300'} ${hidden ? 'line-through' : ''}`}>
                                  {formatFieldValue(val) ?? '—'}
                                </span>
                                <HideToggle sectionKey={sec.key} fieldKey={field} />
                              </div>
                            </div>
                          )
                        })}
                        {arrayFields.map(field => (
                          <div key={field} className="pt-2">
                            <p className="text-muted-foreground mb-2">{formatFieldLabel(field)}</p>
                            <div className="space-y-2">
                              {sectionData[field].map((item, i) => (
                                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
                                  <span className="text-xs font-semibold text-[#283693]">#{i + 1}</span>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                    {Object.entries(item).filter(([k, v]) => k !== 'id' && v !== '' && v !== null && v !== undefined).map(([k, v]) => (
                                      <span key={k} className="text-xs">
                                        <span className="text-gray-400">{formatFieldLabel(k)}:</span>{' '}
                                        <span className="font-medium">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  </CollapsibleContent>
                </Card>
                </Collapsible>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
