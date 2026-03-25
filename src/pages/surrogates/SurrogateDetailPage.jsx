import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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
import { getSurrogateStageStatus, setSurrogateStageStatus, getStatusConfig, getDefaultStatus } from '@/lib/stageStatusStore'
import StageBadge from '@/components/shared/StageBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import ScreeningStatusItem from '@/components/shared/ScreeningStatusItem'
import EmptyState from '@/components/shared/EmptyState'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchSurrogatesFromIntake, fetchIntakeByEmail, listProfilePhotos, fetchSurrogateProfileByEmail, updateSurrogateProfileStatus, adminUpdateSurrogateProfile, assignSurrogateToAdmin, updateReferralPartner, updateIntakeSubmission, fetchCaseNotes, insertCaseNote, updateCaseNote, deleteCaseNote, fetchCaseDocuments, uploadCaseDocument, updateCaseDocument, deleteCaseDocument } from '@/lib/db'
import { Trash2, AlertTriangle, Plus, Upload, FileText, FileImage, File, Download, FolderOpen, X, Eye, LayoutGrid, List as ListIcon, Search, FolderInput } from 'lucide-react'
import { ShieldCheck, ShieldX, Save, Loader2, UserCog } from 'lucide-react'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { mockUsers } from '@/data/mock/users'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

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

export default function SurrogateDetailPage() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [surrogate, setSurrogate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quizAnswers, setQuizAnswers] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [profileStatus, setProfileStatus] = useState('draft')
  const [photos, setPhotos] = useState([])
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteAddOpen, setNoteAddOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [flipped, setFlipped] = useState({})
  const [stageStatus, setStageStatus] = useState({ stage: 'pre-qualification', status: 'New' })
  const [stageOpen, setStageOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const toggleFlip = (key) => setFlipped(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    fetchSurrogatesFromIntake().then(all => {
      const found = all.find(s => String(s.id) === String(id))
      setSurrogate(found || null)
      if (found?.id) {
        fetchCaseNotes(found.id).then(setNotes).catch(() => {})
      }
      if (found?.email) {
        fetchIntakeByEmail(found.email).then(setQuizAnswers).catch(() => {})
        fetchSurrogateProfileByEmail(found.email).then(result => {
          if (result?.profile_data) setProfileData(result.profile_data)
          if (result?.status) setProfileStatus(result.status)
        }).catch(() => {})
      }
      if (found?.userId) {
        listProfilePhotos(found.userId).then(setPhotos).catch(() => {})
        listProfilePhotos(`${found.userId}/headshot`).then(hs => {
          if (hs.length > 0) setPhotos(prev => [hs[0], ...prev])
        }).catch(() => {})
      }
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // Load stage/status from localStorage
  useEffect(() => {
    if (surrogate) {
      setStageStatus(getSurrogateStageStatus(surrogate.id))
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
            <ProfileAvatar name={surrogate.name} size="xl" className="ring-4 ring-white shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-stone-900">{surrogate.name}</h1>
                <StageBadge stage={stageStatus.stage} status={stageStatus.status} />
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
                    {ADMIN_STAFF.map(a => (
                      <SelectItemUI key={a.email} value={a.email}>{a.name}</SelectItemUI>
                    ))}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {surrogate.phone && (
                <CopyFlipButton
                  icon={MessageSquare}
                  label="Text"
                  value={surrogate.phone}
                  flipped={flipped.text}
                  onFlip={() => toggleFlip('text')}
                  preferred={surrogate.preferredContact === 'Text'}
                />
              )}
              <CopyFlipButton
                icon={Mail}
                label="Email"
                value={surrogate.email}
                flipped={flipped.email}
                onFlip={() => toggleFlip('email')}
                preferred={surrogate.preferredContact === 'Email'}
              />
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
            </div>
          </div>

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
              const partnerName = profileData?.family?.partnerName
              if (partnerName) {
                return (
                  <FlipCard
                    flipped={flipped.relationship}
                    onClick={() => toggleFlip('relationship')}
                    front={{ icon: Heart, label: 'Relationship', value: surrogate.maritalStatus || '—' }}
                    back={{ icon: Heart, label: 'Partner', value: partnerName }}
                  />
                )
              }
              return <StatCard label="Relationship" value={surrogate.maritalStatus || '—'} icon={Heart} />
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
                          {SURROGATE_STAGES.map((stage, i) => (
                            <button
                              key={stage.id}
                              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                                stageStatus.stage === stage.id ? 'font-semibold' : 'text-stone-600 hover:bg-stone-50'
                              }`}
                              style={stageStatus.stage === stage.id ? { color: stage.color, backgroundColor: stage.color + '10' } : {}}
                              onClick={e => {
                                e.stopPropagation()
                                const newStatus = getDefaultStatus(stage.id)
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
              const config = getStatusConfig()
              const availableStatuses = config[stageStatus.stage] || []
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
        </div>
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="screening">Screening</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <OverviewTab surrogate={surrogate} screening={screening} heightStr={heightStr} profileData={profileData} />
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="mt-4">
          <ContactTab surrogate={surrogate} setSurrogate={setSurrogate} quizAnswers={quizAnswers} setQuizAnswers={setQuizAnswers} />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          <ProfileTab
            surrogate={surrogate}
            profileData={profileData}
            setProfileData={setProfileData}
            profileStatus={profileStatus}
            setProfileStatus={setProfileStatus}
            photos={photos}
            heightStr={heightStr}
          />
        </TabsContent>

        {/* Screening Tab */}
        <TabsContent value="screening" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Screening Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {SCREENING_STEPS.map(step => (
                <div key={step} className="flex items-center justify-between py-3 px-4 rounded-xl bg-stone-50/80 border border-stone-100">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = SCREENING_ICONS[screening[step]] || Circle
                      return <Icon className={`size-5 ${SCREENING_COLORS[screening[step]] || 'text-stone-300'}`} />
                    })()}
                    <span className="font-medium text-stone-700">{SCREENING_LABELS[step]}</span>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {(screening[step] || 'not_started').replace('_', ' ')}
                  </Badge>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-4">
                Screening status updates will be managed here as the intake process progresses.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab surrogateId={surrogate.id} />
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
      </Tabs>
    </div>
  )
}

// ── Documents Tab ──────────────────────────────────────────
const DOC_CATEGORIES = [
  { id: 'photo-id', label: 'Photo IDs', icon: FileImage, color: '#ed148c' },
  { id: 'agency-agreement', label: 'Agency Agreement', icon: FileText, color: '#283693' },
  { id: 'benefit-package', label: 'Benefit Package', icon: FileText, color: '#10b981' },
  { id: 'medical-records', label: 'Medical Records', icon: FileText, color: '#8b5cf6' },
  { id: 'insurance', label: 'Insurance', icon: FileText, color: '#f59e0b' },
  { id: 'legal', label: 'Legal Documents', icon: FileText, color: '#723bb4' },
  { id: 'background-check', label: 'Background Check', icon: FileText, color: '#c4219a' },
  { id: 'psych-evaluation', label: 'Psych Evaluation', icon: FileText, color: '#4d3da4' },
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

function DocumentsTab({ surrogateId }) {
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
  const [editSaving, setEditSaving] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docView, setDocView] = useState('grid') // 'grid' | 'list'

  useEffect(() => {
    fetchCaseDocuments(surrogateId).then(setDocs).catch(() => {}).finally(() => setLoading(false))
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

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length || !uploadCategory) return
    setUploading(true)
    try {
      for (const file of files) {
        const doc = await uploadCaseDocument({ surrogateId, category: uploadCategory, file, uploadedBy: currentUser.name })
        if (doc) setDocs(prev => [doc, ...prev])
      }
    } catch {} finally { setUploading(false); setUploadCategory(null); e.target.value = '' }
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
            {compact && cat ? ` · ${cat.label}` : ''}
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
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.webp,.txt,.xls,.xlsx" />

      {/* Toolbar: search + view toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={docSearch} onChange={e => setDocSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center border rounded-md">
          <Button variant={docView === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setDocView('grid')}>
            <LayoutGrid className="size-4" />
          </Button>
          <Button variant={docView === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setDocView('list')}>
            <ListIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Grid view — cards per category */}
      {docView === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOC_CATEGORIES.map(cat => {
            const catDocs = docsByCategory[cat.id]
            const Icon = cat.icon
            return (
              <Card key={cat.id} className="rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: cat.color + '0a' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '18' }}>
                      <Icon className="size-4" style={{ color: cat.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{cat.label}</p>
                      <p className="text-[10px] text-stone-400">{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-white/50" disabled={uploading}
                    onClick={() => { setUploadCategory(cat.id); document.getElementById('doc-upload-input')?.click() }}>
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
                    <div className="px-4 py-6 text-center">
                      <FolderOpen className="size-6 text-stone-200 mx-auto mb-1.5" />
                      <p className="text-[11px] text-stone-400">No files yet</p>
                      <button className="text-[11px] font-medium mt-1 hover:underline" style={{ color: cat.color }}
                        onClick={() => { setUploadCategory(cat.id); document.getElementById('doc-upload-input')?.click() }}>
                        Upload
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
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
      await updateIntakeSubmission(surrogate.id, {
        applicant_email: form.email.trim().toLowerCase(),
        answers: updatedAnswers,
        referral_partner: referralVal,
      })
      setSurrogate(prev => ({
        ...prev,
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
const PROFILE_SECTIONS = [
  { key: 'about', title: 'About Me', fields: ['firstName', 'city', 'state', 'heightFt', 'weight', 'personality'] },
  { key: 'family', title: 'Family & Household', fields: ['maritalStatus', 'whoLivesWithYou', 'planMoreChildren'] },
  { key: 'pregnancyHistory', title: 'Pregnancy History', fields: ['numberOfPregnancies'] },
  { key: 'fertility', title: 'Fertility & Medical', fields: ['sameBioFather', 'contraceptiveMethod', 'cycleLength'] },
  { key: 'health', title: 'Health & Wellness', fields: ['mentalHealthDiagnosis', 'bloodType', 'rhFactor', 'openToVaccinations'] },
  { key: 'lifestyle', title: 'Lifestyle', fields: ['smokeVape', 'alcoholDrugs', 'typicalDiet', 'exerciseFrequency', 'sleepHours', 'reliableVehicle'] },
  { key: 'employment', title: 'Employment & Finances', fields: ['currentlyEmployed', 'healthInsurance'] },
  { key: 'preferences', title: 'Surrogacy Preferences', fields: ['previousSurrogate', 'reasonForSurrogacy', 'whenReadyToBegin', 'desiredCompensation'] },
]

function countSectionFilled(data, section) {
  if (!data?.[section.key]) return { filled: 0, total: section.fields.length }
  let filled = 0
  for (const f of section.fields) {
    const val = data[section.key][f]
    if (val !== undefined && val !== '' && val !== null) filled++
  }
  return { filled, total: section.fields.length }
}

// ── Overview Tab ───────────────────────────────────────────
function OverviewTab({ surrogate, screening, heightStr, profileData }) {
  const screeningCleared = SCREENING_STEPS.filter(s => screening[s] === 'cleared').length
  const screeningPct = (screeningCleared / 4) * 100

  return (
    <div className="space-y-6">
      {/* Screening Progress */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Screening Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${screeningPct}%`,
                  background: screeningPct === 100 ? '#10b981' : 'linear-gradient(90deg, #283693, #ed148c)',
                }}
              />
            </div>
            <span className="text-sm font-bold" style={{ color: screeningPct === 100 ? '#10b981' : '#283693' }}>
              {screeningCleared}/4
            </span>
          </div>
          {/* Step cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SCREENING_STEPS.map(step => {
              const status = screening[step] || 'not_started'
              const Icon = SCREENING_ICONS[status]
              return (
                <div key={step} className={`rounded-xl border p-4 text-center transition-colors ${
                  status === 'cleared' ? 'border-emerald-200 bg-emerald-50/50' :
                  status === 'pending' ? 'border-amber-200 bg-amber-50/50' :
                  status === 'failed' ? 'border-red-200 bg-red-50/50' :
                  'border-stone-100 bg-stone-50/50'
                }`}>
                  <Icon className={`size-6 mx-auto mb-2 ${SCREENING_COLORS[status]}`} />
                  <p className="text-sm font-semibold text-stone-700">{SCREENING_LABELS[step]}</p>
                  <p className={`text-xs mt-0.5 capitalize ${SCREENING_COLORS[status]}`}>
                    {status.replace('_', ' ')}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatFieldLabel(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()
}

function formatFieldValue(value) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ProfileTab({ surrogate, profileData, setProfileData, profileStatus, setProfileStatus, photos, heightStr }) {
  const [editingSection, setEditingSection] = useState(null)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const isApproved = profileStatus === 'approved'
  const data = profileData || {}

  function startSectionEdit(sec) {
    setEditData({ ...(data[sec.key] || {}), ...Object.fromEntries(sec.fields.filter(f => !(f in (data[sec.key] || {}))).map(f => [f, ''])) })
    setEditingSection(sec)
  }

  function updateEditField(field, value) {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  async function saveSectionEdit() {
    if (!surrogate.email || !editingSection) return
    setSaving(true)
    try {
      const updated = { ...data, [editingSection.key]: editData }
      await adminUpdateSurrogateProfile(surrogate.email, updated)
      setProfileData(updated)
      setEditingSection(null)
    } catch {} finally { setSaving(false) }
  }

  async function toggleApproval() {
    if (!surrogate.email) return
    setStatusLoading(true)
    try {
      await updateSurrogateProfileStatus(surrogate.email, isApproved ? 'draft' : 'approved')
      setProfileStatus(isApproved ? 'draft' : 'approved')
    } catch {} finally { setStatusLoading(false) }
  }

  let totalFields = 0, totalFilled = 0
  for (const sec of PROFILE_SECTIONS) {
    const { filled, total } = countSectionFilled(data, sec)
    totalFields += total
    totalFilled += filled
  }
  const overallPercent = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0

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
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-3.5" /> Preview
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
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${overallPercent}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
              </div>
            </div>
            <span className="text-sm font-bold text-abc-indigo">{overallPercent}%</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    {filled}/{total}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {photos.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Photos ({photos.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {photos.map(p => (
                <div key={p.path} className="aspect-square rounded-xl overflow-hidden border">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PROFILE_SECTIONS.map(sec => {
          const sectionData = data[sec.key] || {}
          return (
            <Card key={sec.key} id={`admin-sec-${sec.key}`} className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{sec.title}</CardTitle>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => startSectionEdit(sec)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {sec.fields.map(field => (
                    <div key={field} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{formatFieldLabel(field)}</span>
                      <span className={`font-medium text-right ${sectionData[field] !== undefined && sectionData[field] !== '' && sectionData[field] !== null ? '' : 'text-gray-300'}`}>
                        {formatFieldValue(sectionData[field])}
                      </span>
                    </div>
                  ))}
                  {Object.entries(sectionData)
                    .filter(([k, v]) => !sec.fields.includes(k) && v !== '' && v !== null && v !== undefined)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{formatFieldLabel(key)}</span>
                        <span className="font-medium text-right">{formatFieldValue(value)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Per-section Edit Dialog */}
      <Dialog open={!!editingSection} onOpenChange={open => !open && setEditingSection(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit — {editingSection?.title}</DialogTitle>
          </DialogHeader>
          {editData && editingSection && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {editingSection.fields.map(field => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">{formatFieldLabel(field)}</label>
                    <input
                      className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:border-abc-indigo focus:ring-1 focus:ring-abc-indigo/20 outline-none"
                      value={typeof editData[field] === 'boolean' ? (editData[field] ? 'yes' : 'no') : Array.isArray(editData[field]) ? editData[field].join(', ') : String(editData[field] || '')}
                      onChange={e => updateEditField(field, e.target.value)}
                    />
                  </div>
                ))}
                {Object.keys(editData)
                  .filter(k => !editingSection.fields.includes(k))
                  .map(field => (
                    <div key={field} className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">{formatFieldLabel(field)}</label>
                      <input
                        className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:border-abc-indigo focus:ring-1 focus:ring-abc-indigo/20 outline-none"
                        value={typeof editData[field] === 'boolean' ? (editData[field] ? 'yes' : 'no') : Array.isArray(editData[field]) ? editData[field].join(', ') : String(editData[field] || '')}
                        onChange={e => updateEditField(field, e.target.value)}
                      />
                    </div>
                  ))}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
                <Button onClick={saveSectionEdit} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          <div className="bg-[#fdf8f3] p-6 space-y-6">
            {photos.length > 0 && (
              <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden">
                <img src={photos[0].url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="text-center">
              <h2 className="text-xl font-heading font-bold text-abc-indigo">Meet {surrogate.name.split(' ')[0]}</h2>
              {surrogate.location && <p className="text-muted-foreground text-sm mt-1">{surrogate.age ? `${surrogate.age} years old · ` : ''}{surrogate.location}</p>}
              {data.about?.personality && <p className="text-sm italic text-abc-indigo/70 max-w-md mx-auto mt-3">"{data.about.personality}"</p>}
            </div>
            {PROFILE_SECTIONS.map(sec => {
              const sectionData = data[sec.key]
              if (!sectionData) return null
              const entries = Object.entries(sectionData).filter(([, v]) => v !== '' && v !== null && v !== undefined)
              if (entries.length === 0) return null
              return (
                <div key={sec.key} className="rounded-xl bg-white shadow-sm border p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-abc-indigo">{sec.title}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {entries.map(([key, value]) => (
                      <div key={key}>
                        <span className="text-muted-foreground capitalize text-xs">{formatFieldLabel(key)}</span>
                        <p className="font-medium">{formatFieldValue(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground">Preview of how intended parents will see this profile</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
