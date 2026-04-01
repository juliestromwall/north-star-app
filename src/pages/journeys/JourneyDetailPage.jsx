import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Heart, Users, Baby, MapPin, Stethoscope,
  Milestone, Circle, UserCog, Mail, Phone, DollarSign, Droplets, Briefcase,
  Pencil, Save, Loader2, X, Crown,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import StageBadge from '@/components/shared/StageBadge'
import RichTextEditor, { RichTextDisplay } from '@/components/shared/RichTextEditor'
import { useRole } from '@/context/RoleContext'
import { SURROGATE_STAGES } from '@/lib/constants'
import { getStatusesForStage } from '@/lib/stageStatusStore'
import { fetchMatchedJourney, updateMatchedJourney, fetchJourneyNotes, createJourneyNote, deleteJourneyNote } from '@/lib/matching'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { mockUsers } from '@/data/mock/users'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))
const JOURNEY_MANAGERS = ADMIN_STAFF.filter(u => ['Julie Allgood', 'Nicole Lawson'].includes(u.name))
const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => ['journey-oversight', 'journey-ending', 'journey-closed'].includes(s.id))

function CurrencyInput({ value, onChange }) {
  const format = (v) => { const d = String(v).replace(/[^0-9]/g, ''); return d ? '$' + Number(d).toLocaleString('en-US') : '' }
  return <Input value={format(value)} onChange={e => { const d = e.target.value.replace(/[^0-9]/g, ''); onChange(d ? '$' + Number(d).toLocaleString('en-US') : '') }} placeholder="$0" className="h-8 text-sm w-32" />
}

// ── Clickable Tile ──────────────────────────────────────
function EditableTile({ icon: Icon, label, value, type, onSave }) {
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
        ) : (
          <div className="flex gap-1 justify-center">
            <CurrencyInput value={val} onChange={setVal} />
            <button onClick={save} className="p-1 rounded bg-[#283693] text-white"><Save className="size-3" /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded bg-stone-200 text-stone-500"><X className="size-3" /></button>
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
      <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{display}</p>
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
    { key: 'ip', label: 'IP Notes', color: 'bg-purple-500' },
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
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${note.note_type === 'gc' ? 'bg-pink-500' : note.note_type === 'ip' ? 'bg-purple-500' : 'bg-[#283693]'}`}>
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

      {/* ─── Hero Section (Stacked) ─────────────────────────── */}
      <div className="rounded-2xl border border-stone-200/80 bg-white overflow-hidden">
        {/* GC Section */}
        <div className="p-5 border-b bg-gradient-to-r from-pink-50/50 to-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-500 text-white uppercase tracking-wider">Surrogate</span>
          </div>
          {gcCase ? (
            <div className="flex items-center gap-4">
              <ProfileAvatar name={gcCase.name} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-heading font-bold">{gcCase.name}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-stone-500">
                  {gcCase.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{gcCase.location}</span>}
                  {gcCase.age && <span>Age {gcCase.age}</span>}
                  {gcCase.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{gcCase.phone}</span>}
                  {gcCase.email && <span className="flex items-center gap-1"><Mail className="size-3" />{gcCase.email}</span>}
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-stone-400">GC case not found</p>}
        </div>

        {/* IP Section — purple gradient */}
        <div className="p-5 border-b bg-gradient-to-r from-purple-50/50 to-white">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500 text-white uppercase tracking-wider">Intended Parent{ipCase?.type === 'Couple' ? 's' : ''}</span>
          </div>
          {ipCase ? (
            <div className="flex items-center gap-4">
              <ProfileAvatar name={ipCase.names} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-heading font-bold">{ipCase.names}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-stone-500">
                  {ipCase.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{ipCase.location}</span>}
                  {ipCase.type && <span className="flex items-center gap-1"><Users className="size-3" />{ipCase.type}</span>}
                  {ipCase.reDoctorName && <span className="flex items-center gap-1"><Stethoscope className="size-3" />{ipCase.reDoctorName}</span>}
                  {ipCase.email && <span className="flex items-center gap-1"><Mail className="size-3" />{ipCase.email}</span>}
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-stone-400">IP case not found</p>}
        </div>

        {/* Journey Controls */}
        <div className="p-5 space-y-4">
          {/* Stage + Status tiles (like GC/IP cases) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Stage tile */}
            <div className="relative">
              <div className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                onClick={() => { setStageOpen(!stageOpen); setStatusOpen(false) }}>
                <Milestone className="size-4 text-stone-300 mx-auto mb-1" />
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Stage</p>
                <p className="text-lg font-bold mt-0.5 leading-tight" style={{ color: stageObj.color }}>{stageObj.label}</p>
              </div>
              {stageOpen && (
                <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border py-2">
                  {JOURNEY_STAGES.map((stage, i) => (
                    <button key={stage.id} className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2" onClick={() => changeStage(stage.id)}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: stage.color }}>{i + 4}</span>
                      {stage.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status tile */}
            <div className="relative">
              <div className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                onClick={() => { setStatusOpen(!statusOpen); setStageOpen(false) }}>
                <Circle className="size-4 text-stone-300 mx-auto mb-1" />
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Status</p>
                <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{journey.status}</p>
              </div>
              {statusOpen && (
                <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border py-2 max-h-64 overflow-y-auto">
                  {statuses.map(status => (
                    <button key={status} className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2" onClick={() => changeStatus(status)}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stageObj.color }} />{status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Journey data tiles — click to edit */}
            <EditableTile icon={Briefcase} label="Lost Wages" value={jd.lostWages} type="yesno" onSave={v => updateField('lostWages', v)} />
            <EditableTile icon={Droplets} label="Pumping" value={jd.pumping} type="yesno" onSave={v => updateField('pumping', v)} />
            <EditableTile icon={DollarSign} label="Escrow Min" value={jd.escrowMin} type="currency" onSave={v => updateField('escrowMin', v)} />
            <EditableTile icon={DollarSign} label="Escrow Balance" value={jd.escrowBalance} type="currency" onSave={v => updateField('escrowBalance', v)} />
          </div>

          {/* Case Manager + Journey Manager */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <UserCog className="size-4 text-stone-400" />
              <span className="text-xs text-stone-400">Case Manager</span>
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
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-500" />
              <span className="text-xs text-stone-400">Journey Manager</span>
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

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
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
            <Card className="rounded-2xl border-l-4 border-l-purple-400">
              <CardHeader><CardTitle className="flex items-center gap-2"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500 text-white">IP</span> Intended Parent</CardTitle></CardHeader>
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${profileView === 'ip' ? 'bg-purple-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
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
            <Card className="rounded-2xl border-l-4 border-l-purple-400">
              <CardContent className="py-6 text-center">
                <Link to={`/intended-parents/${journey.ip_case_id}`} className="text-[#283693] font-semibold hover:underline">
                  Open {ipCase?.names || 'Intended Parent'}'s Full Case →
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="mt-4"><EmptyState title="Journey Checklist" description="Unified checklist for the matched journey." /></TabsContent>
        <TabsContent value="documents" className="mt-4"><EmptyState title="Journey Documents" description="Merged GC and IP documents with labels." /></TabsContent>
        <TabsContent value="notes" className="mt-4"><NotesTab journeyId={journey.id} currentUser={currentUser} /></TabsContent>
        <TabsContent value="texts" className="mt-4"><EmptyState title="Text Messages" description="GC and IP text threads." /></TabsContent>
      </Tabs>
    </div>
  )
}
