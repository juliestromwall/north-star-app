import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Plus, MapPin, ArrowRight, CheckCircle, Clock, XCircle, Circle,
  LayoutGrid, List, UserCog, Baby, Ruler, Heart, Calendar, Phone, Mail,
  Activity, ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/components/shared/PageHeader'
import StageBadge from '@/components/shared/StageBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StatusSettingsDialog from '@/components/surrogates/StatusSettingsDialog'
import { SURROGATE_STAGES } from '@/lib/constants'
import { getSurrogateStageStatus, getAllSurrogateStageStatuses } from '@/lib/stageStatusStore'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import { fetchSurrogatesFromIntake, assignSurrogateToAdmin, adminAddSurrogate, fetchAllSurrogateProfiles } from '@/lib/db'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { mockUsers } from '@/data/mock/users'
import { ROLES, ADMIN_ROLES, MATCH_STAGES } from '@/lib/constants'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

function getAdminName(email) {
  const user = ADMIN_STAFF.find(u => u.email === email)
  return user ? user.name : email
}

// ── GTPAL Calculation ──────────────────────────────────────
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
      living++ // assume living unless we have reason to think otherwise
    } else {
      // Miscarriage, Termination, Ectopic, Stillborn all count as A
      abortions++
    }
  }
  return { g, t: term, p: preterm, a: abortions, l: living }
}

function GTPALBadge({ gtpal }) {
  if (!gtpal) return null
  const code = `G${gtpal.g}P${gtpal.t}${gtpal.p}${gtpal.a}${gtpal.l}`
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 font-mono text-sm font-bold tracking-wide"
        style={{ color: '#283693' }}>
        <span>{code}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-stone-400 leading-none">
        <span>{gtpal.g} preg</span>
        <span className="text-stone-200">|</span>
        <span>{gtpal.t} term</span>
        {gtpal.p > 0 && <><span className="text-stone-200">|</span><span>{gtpal.p} pre</span></>}
        {gtpal.a > 0 && <><span className="text-stone-200">|</span><span>{gtpal.a} loss</span></>}
        <span className="text-stone-200">|</span>
        <span>{gtpal.l} living</span>
      </div>
    </div>
  )
}

// ── Screening Progress ─────────────────────────────────────
const SCREENING_STEPS = ['medical', 'psychological', 'background', 'homeStudy']
const SCREENING_LABELS = { medical: 'Med', psychological: 'Psych', background: 'BG', homeStudy: 'Home' }
const SCREENING_ICONS = { cleared: CheckCircle, pending: Clock, failed: XCircle, not_started: Circle }
const SCREENING_COLORS = {
  cleared: 'text-emerald-500',
  pending: 'text-amber-500',
  failed: 'text-red-500',
  not_started: 'text-stone-300',
}

function ScreeningProgress({ screening }) {
  const cleared = SCREENING_STEPS.filter(s => screening[s] === 'cleared').length
  const total = SCREENING_STEPS.length
  const pct = (cleared / total) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
        <span>Screening</span>
        <span>{cleared}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? '#10b981' : 'linear-gradient(90deg, #283693, #ed148c)',
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        {SCREENING_STEPS.map(step => {
          const status = screening[step]
          const Icon = SCREENING_ICONS[status] || Circle
          return (
            <div key={step} className="flex items-center gap-1">
              <Icon className={`size-3 ${SCREENING_COLORS[status]}`} />
              <span className="text-[10px] text-stone-400">{SCREENING_LABELS[step]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Stat Chip ──────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, iconColor = 'text-stone-400' }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={`size-3.5 ${iconColor} shrink-0`} />
      <span className="text-stone-400">{label}</span>
      <span className="font-semibold text-stone-700">{value}</span>
    </div>
  )
}

// ── Height formatter ───────────────────────────────────────
function formatHeight(ft, inches) {
  if (!ft) return null
  return `${ft}'${inches || 0}"`
}

// ── Time ago ───────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months === 1) return '1mo ago'
  return `${months}mo ago`
}

function BeBadge({ className = '' }) {
  return <img src="/be-logo.png" alt="Be Surrogacy" className={`h-8 w-auto ${className}`} title="Be Surrogacy Referral" />
}

// ── Surrogate Card (Tile View) ─────────────────────────────
function SurrogateCard({ surrogate, profileData, onAssign, stageStatus }) {
  const gtpal = getGTPAL(profileData)
  const height = formatHeight(surrogate.heightFt, surrogate.heightIn)
  const submitted = timeAgo(surrogate.submittedAt)

  return (
    <Card className="group relative transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-stone-200/80 rounded-2xl">

      <CardContent className="space-y-4">
        {/* Header: avatar + name + status */}
        <div className="flex items-start gap-3.5">
          <Link to={`/surrogates/${surrogate.id}`} className="relative shrink-0">
            <ProfileAvatar name={surrogate.name} size="lg" className="ring-2 ring-white shadow-md" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/surrogates/${surrogate.id}`} className="hover:underline">
                  <h3 className="font-heading font-bold text-[15px] text-stone-900 truncate leading-tight">{surrogate.name}</h3>
                </Link>
                {surrogate.location && (
                  <div className="flex items-center gap-1 text-xs text-stone-400 mt-0.5">
                    <MapPin className="size-3" />
                    <span>{surrogate.location}</span>
                  </div>
                )}
              </div>
              {surrogate.referralPartner === 'be_surrogacy' && <BeBadge />}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <StageBadge stage={stageStatus.stage} status={stageStatus.status} />
              {submitted && (
                <span className="text-[10px] text-stone-300 font-medium">{submitted}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-1 bg-stone-50/80 rounded-lg p-2.5">
          <div className="text-center">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Age</p>
            <p className="text-lg font-bold text-stone-800 leading-tight">{surrogate.age || '—'}</p>
          </div>
          <div className="text-center border-x border-stone-200/60">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Height</p>
            <p className="text-lg font-bold text-stone-800 leading-tight">{height || '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">BMI</p>
            <p className="text-lg font-bold text-stone-800 leading-tight">{surrogate.bmi || '—'}</p>
          </div>
        </div>

        {/* GTPAL */}
        {gtpal && (
          <div className="rounded-lg border border-pink-100 bg-gradient-to-r from-pink-50/50 to-indigo-50/50 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Baby className="size-3.5 text-pink-400" />
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Pregnancy History</span>
            </div>
            <GTPALBadge gtpal={gtpal} />
          </div>
        )}

        {/* Additional info chips */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <StatChip icon={Heart} label="" value={surrogate.maritalStatus} iconColor="text-pink-400" />
          {surrogate.weightLbs && <StatChip icon={Activity} label="" value={`${surrogate.weightLbs} lbs`} iconColor="text-blue-400" />}
          <StatChip icon={Phone} label="" value={surrogate.preferredContact} iconColor="text-emerald-400" />
        </div>

        {/* Screening */}
        <ScreeningProgress screening={surrogate.screening} />

        {/* Footer: assignment + view link */}
        <div className="pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <UserCog className="size-3.5 text-stone-300" />
              <Select
                value={surrogate.assignedTo || '_unassigned'}
                onValueChange={val => onAssign(surrogate.id, val === '_unassigned' ? null : val)}
              >
                <SelectTrigger className="h-7 text-xs border-none shadow-none px-1 w-auto min-w-24 text-stone-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_unassigned">
                    <span className="text-muted-foreground">Unassigned</span>
                  </SelectItem>
                  {ADMIN_STAFF.map(admin => (
                    <SelectItem key={admin.email} value={admin.email}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link
              to={`/surrogates/${surrogate.id}`}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{ color: '#283693' }}
            >
              View Profile
              <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function SurrogateListPage() {
  const { currentUser, isAdmin, isSuperAdmin, isMasterAdmin } = useRole()
  const [surrogates, setSurrogates] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '', state: '', dob: '', referralPartner: false })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('mine')
  const [view, setView] = useState('tile')
  const navigate = useNavigate()

  const canSeeAll = isSuperAdmin || isMasterAdmin

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchAllSurrogateProfiles()])
      .then(([data, profileList]) => {
        setSurrogates(data || [])
        const map = {}
        for (const p of (profileList || [])) { map[p.email] = p.profile_data }
        setProfiles(map)
      })
      .catch(() => setSurrogates([]))
      .finally(() => setLoading(false))
  }, [])

  const allStageStatuses = getAllSurrogateStageStatuses()

  const filtered = useMemo(() => {
    return surrogates.filter(s => {
      if (ownerFilter === 'mine') {
        if (s.assignedTo !== currentUser.email) return false
      } else if (ownerFilter === 'unassigned') {
        if (s.assignedTo) return false
      } else if (ownerFilter !== 'all') {
        if (s.assignedTo !== ownerFilter) return false
      }
      const matchesSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.location.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      const surrogateStage = allStageStatuses[s.id]?.stage || 'pre-qualification'
      const matchesStatus = statusFilter === 'all' || surrogateStage === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [surrogates, search, statusFilter, ownerFilter, currentUser.email])

  const myCaseCount = surrogates.filter(s => s.assignedTo === currentUser.email).length
  const unassignedCount = surrogates.filter(s => !s.assignedTo).length

  async function handleAddSurrogate() {
    if (!addForm.firstName || !addForm.email) return
    setAddSaving(true)
    setAddError(null)
    try {
      await adminAddSurrogate({
        ...addForm,
        assignedTo: currentUser.email,
        referralPartner: addForm.referralPartner ? 'be_surrogacy' : null,
      })
      const data = await fetchSurrogatesFromIntake()
      setSurrogates(data || [])
      setAddOpen(false)
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', state: '', dob: '', referralPartner: false })
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 3000)
    } catch (err) {
      setAddError(err.message || 'Failed to add surrogate. Please try again.')
    } finally { setAddSaving(false) }
  }

  async function handleAssign(surrogateId, adminEmail) {
    try {
      await assignSurrogateToAdmin(surrogateId, adminEmail)
      setSurrogates(prev => prev.map(s => s.id === surrogateId ? { ...s, assignedTo: adminEmail } : s))
    } catch {}
  }

  // ── Hero Stats Bar ─────────────────────────────────────
  const stageCounts = {}
  for (const stage of SURROGATE_STAGES) stageCounts[stage.id] = 0
  for (const s of surrogates) {
    const ss = allStageStatuses[s.id]
    const stageId = ss?.stage || 'pre-qualification'
    if (stageCounts[stageId] !== undefined) stageCounts[stageId]++
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surrogates"
        subtitle={`${filtered.length} of ${surrogates.length} surrogate${surrogates.length !== 1 ? 's' : ''} shown`}
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add Surrogate
          </Button>
        }
      />

      {/* Hero stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-xl border border-stone-100 p-4 text-center" style={{ background: 'linear-gradient(135deg, #fdf8f3, #f0f1fa)' }}>
          <p className="text-2xl font-bold" style={{ color: '#283693' }}>{surrogates.length}</p>
          <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mt-0.5">Total</p>
        </div>
        {SURROGATE_STAGES.map(stage => (
          <div key={stage.id} className="rounded-xl border border-stone-100 p-4 text-center" style={{ backgroundColor: stage.color + '08' }}>
            <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stage.id]}</p>
            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{stage.label}</p>
          </div>
        ))}
      </div>

      {addSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          <CheckCircle className="size-4" /> Surrogate added successfully and assigned to you.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">My Cases ({myCaseCount})</SelectItem>
            {canSeeAll && <SelectItem value="all">All Cases ({surrogates.length})</SelectItem>}
            <SelectItem value="unassigned">Unassigned ({unassignedCount})</SelectItem>
            {canSeeAll && ADMIN_STAFF.map(admin => (
              <SelectItem key={admin.email} value={admin.email}>
                {admin.name} ({surrogates.filter(s => s.assignedTo === admin.email).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {SURROGATE_STAGES.map(stage => (
              <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StatusSettingsDialog />

        <div className="flex items-center border rounded-md">
          <Button
            variant={view === 'tile' ? 'default' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => setView('tile')}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => setView('list')}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No surrogates found"
          description={
            ownerFilter === 'mine' && myCaseCount === 0
              ? "You don't have any cases assigned to you yet."
              : surrogates.length === 0
              ? "Surrogates will appear here once they complete the intake quiz and qualify."
              : "Try adjusting your search or filters."
          }
        />
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(surrogate => (
            <SurrogateCard
              key={surrogate.id}
              surrogate={surrogate}
              profileData={profiles[surrogate.email]}
              onAssign={handleAssign}
              stageStatus={allStageStatuses[surrogate.id] || { stage: 'pre-qualification', status: 'New' }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Pregnancy</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(surrogate => {
                const gtpal = getGTPAL(profiles[surrogate.email])
                return (
                  <TableRow
                    key={surrogate.id}
                    className="cursor-pointer hover:bg-stone-50/80"
                    onClick={() => navigate(`/surrogates/${surrogate.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProfileAvatar name={surrogate.name} size="sm" />
                        <span className="font-semibold text-stone-800">{surrogate.name}</span>
                        {surrogate.referralPartner === 'be_surrogacy' && <img src="/be-logo.png" alt="BE" className="h-5 w-auto" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-stone-500">
                        <MapPin className="size-3" />
                        {surrogate.location || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{surrogate.age || '—'}</TableCell>
                    <TableCell>
                      {gtpal ? (
                        <span className="font-mono text-xs font-bold" style={{ color: '#283693' }}>
                          G{gtpal.g}P{gtpal.t}{gtpal.p}{gtpal.a}{gtpal.l}
                        </span>
                      ) : (
                        <span className="text-stone-300 text-xs">—</span>
                      )}
                    </TableCell>
                    {(() => {
                      const ss = allStageStatuses[surrogate.id] || { stage: 'pre-qualification', status: 'New' }
                      return (
                        <>
                          <TableCell><StageBadge stage={ss.stage} /></TableCell>
                          <TableCell><span className="text-sm text-stone-600">{ss.status}</span></TableCell>
                        </>
                      )
                    })()}
                    <TableCell>
                      <span className={`text-sm ${surrogate.assignedTo ? '' : 'text-muted-foreground'}`}>
                        {surrogate.assignedTo ? getAdminName(surrogate.assignedTo) : 'Unassigned'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-stone-500">
                      {surrogate.submittedAt
                        ? new Date(surrogate.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Surrogate Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Surrogate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First Name *</Label>
                <Input value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name *</Label>
                <Input value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State *</Label>
                <Select value={addForm.state} onValueChange={v => setAddForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date of Birth *</Label>
              <Input type="date" value={addForm.dob} onChange={e => setAddForm(f => ({ ...f, dob: e.target.value }))} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <img src="/be-logo.png" alt="Be Surrogacy" className="h-7 w-auto" />
                <div>
                  <p className="text-sm font-medium">Referral</p>
                </div>
              </div>
              <Switch
                checked={addForm.referralPartner}
                onCheckedChange={v => setAddForm(f => ({ ...f, referralPartner: v }))}
              />
            </div>

            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
            )}
            <Button onClick={handleAddSurrogate}
              disabled={addSaving || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.phone || !addForm.state || !addForm.dob}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {addSaving ? 'Adding...' : 'Add Surrogate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
