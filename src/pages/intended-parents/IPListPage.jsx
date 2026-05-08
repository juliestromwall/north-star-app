import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, MapPin, Calendar, ArrowRight, LayoutGrid, List, Stethoscope, Baby, Users, CheckCircle, Clock, Circle, UserCog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import { fetchIPsFromIntake, adminAddIP, getAppConfig, getPortraitPhotoUrl } from '@/lib/db'
import { fetchMatchedJourneys, isJourneyActive, fetchCompletedJourneys } from '@/lib/matching'
import { IP_STAGES } from '@/lib/constants'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getChecklistMilestones } from '@/lib/checklistStore'
import { getRecordTrackingBatch } from '@/lib/db'
import StageBadge from '@/components/shared/StageBadge'
import { mockUsers, getAdminStaff } from '@/data/mock/users'

const DEFAULT_ALL_CASE_EMAILS = new Set([
  'julie@northstarsurrogacy.com',
  'nicole@northstarsurrogacy.com',
])

const INACTIVE_IP_STAGES = new Set(['holding', 'withdrawn'])

// Pull the accent straight from IP_STAGES so this stays in sync with
// stage-color updates in src/lib/constants.js.
function getInactiveCaseAccent(stage) {
  if (stage !== 'withdrawn' && stage !== 'holding') return null
  return IP_STAGES.find(s => s.id === stage)?.color || null
}

export function FertilizedEggIcon({ size = 14, color = 'currentColor', className = '' }) {
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

export function MilestoneProgress({ caseId, stageId, recordTracking }) {
  const milestones = getChecklistMilestones('ip', stageId || 'pre-qualification')
  const rt = recordTracking || {}
  let completed = 0
  const total = milestones.length
  const statuses = {}
  for (const ms of milestones) {
    const stepIds = ms.stepIds || []
    const relevant = stepIds.filter(id => rt[id]?.status || !id.startsWith('_'))
    const allDone = relevant.length > 0 && relevant.every(id => rt[id]?.status === 'complete' || rt[id]?.status === 'na')
    const anyStarted = relevant.some(id => rt[id]?.status && rt[id].status !== 'not_started')
    statuses[ms.id] = allDone ? 'complete' : anyStarted ? 'in_progress' : 'not_started'
    if (allDone) completed++
  }
  const pct = total > 0 ? (completed / total) * 100 : 0
  if (total === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
        <span>Milestones</span><span>{completed}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : 'linear-gradient(90deg, #1A3638, #D4A853)' }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {milestones.map(ms => (
          <div key={ms.id} className="flex items-center gap-1">
            {statuses[ms.id] === 'complete' ? <CheckCircle className="size-3 text-emerald-500" /> : statuses[ms.id] === 'in_progress' ? <Clock className="size-3 text-amber-500" /> : <Circle className="size-3 text-stone-300" />}
            <span className="text-[10px] text-stone-400">{ms.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]

const STATUS_STYLES = {
  new:             'bg-pink-100 text-pink-700 border-pink-200',
  qualified:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  approved:        'bg-blue-100 text-blue-700 border-blue-200',
  active:          'bg-blue-100 text-blue-700 border-blue-200',
  pending_review:  'bg-amber-100 text-amber-700 border-amber-200',
  reviewed:        'bg-violet-100 text-violet-700 border-violet-200',
}

export const TYPE_STYLES = {
  'Couple':        'bg-sky-100 text-sky-800 border-sky-200',
  'Single parent': 'bg-amber-100 text-amber-800 border-amber-200',
}

export function IPTileCard({ ip, stageStatus, recordTracking, avatarUrl }) {
  const ss = stageStatus || { stage: 'pre-qualification', status: 'New' }
  const isNew = ss.stage === 'pre-qualification' && ss.status === 'New'
  const assignedAdmin = ip.assignedTo ? getAdminStaff().find(a => a.email === ip.assignedTo)?.name : null
  const inactiveAccent = getInactiveCaseAccent(ss.stage)
  return (
    <Link to={`/intended-parents/${ip.id}`}>
      <Card className="transition-shadow hover:shadow-md h-full relative" style={inactiveAccent ? { borderColor: inactiveAccent, boxShadow: `inset 4px 0 0 ${inactiveAccent}` } : undefined}>
        {isNew && (
          <div className="absolute top-3 right-3 z-10">
            <span className="relative flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-3 bg-pink-500" />
            </span>
          </div>
        )}
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <ProfileAvatar name={ip.names} avatar={avatarUrl} size="lg" />
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-semibold truncate">{ip.names}</h3>
              {ip.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <MapPin className="size-3.5" /><span>{ip.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                <StageBadge stage={ss.stage} status={ss.status} caseType="ip" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">RE / Fertility Doctor</span>
              <p className="font-medium flex items-center gap-1">
                <Stethoscope className="size-3.5 text-muted-foreground" />
                {ip.hasRE === true ? (ip.reDoctorName || 'Yes') : ip.hasRE === false ? 'Not yet' : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Frozen Embryos</span>
              <p className="font-medium flex items-center gap-1">
                <FertilizedEggIcon size={14} color="#78716c" className="shrink-0" />
                {ip.hasFrozenEmbryos === true ? (ip.frozenEmbryoDetails || 'Yes') : ip.hasFrozenEmbryos === false ? 'No' : '—'}
              </p>
            </div>
          </div>
          <MilestoneProgress caseId={ip.id} stageId={ss.stage} recordTracking={recordTracking} />
          {assignedAdmin && (
            <div className="flex items-center gap-1.5 text-xs text-stone-400 pt-2 border-t">
              <UserCog className="size-3.5" /> {assignedAdmin}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function StatusBadge({ status }) {
  const label = status === 'new' ? 'New' : status === 'pending_review' ? 'Pending Review' : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] || 'bg-stone-100 text-stone-500 border-stone-200'}`}>
      {label}
    </span>
  )
}

function formatPhone(val) {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function IPListPage() {
  const { currentUser, isSuperAdmin, isMasterAdmin } = useRole()
  // Master + super admins oversee everyone's caseload — default to All Cases.
  // The email allowlist is kept for any non-master admin who still needs the
  // wider view (legacy carve-out).
  const defaultOwnerFilter = isSuperAdmin || isMasterAdmin || DEFAULT_ALL_CASE_EMAILS.has((currentUser?.email || '').toLowerCase())
    ? 'all'
    : 'mine'
  const canSeeAll = true
  const [ips, setIps] = useState([])
  const [completedIpIds, setCompletedIpIds] = useState(() => new Set())
  const [allStageStatuses, setAllStageStatuses] = useState({})
  const [recordTrackingMap, setRecordTrackingMap] = useState({})
  const [ipAvatars, setIpAvatars] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('active')
  const [typeFilter, setTypeFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState(defaultOwnerFilter)
  const [view, setView] = useState('tile')
  const navigate = useNavigate()

  // Load user's default view preference
  useEffect(() => {
    if (!currentUser?.id) return
    getAppConfig(`user_prefs_${currentUser.id}`).then(data => {
      if (data?.defaultView === 'list') setView('list')
    }).catch(() => {})
  }, [currentUser?.id])

  useEffect(() => {
    setOwnerFilter(defaultOwnerFilter)
  }, [defaultOwnerFilter])

  // Add IP dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '', country: 'United States', state: '', hasPartner: false, ip2FirstName: '', ip2LastName: '', ip2Email: '', ip2Phone: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  async function handleAddIP() {
    if (!addForm.firstName || !addForm.email) return
    setAddSaving(true)
    setAddError(null)
    try {
      await adminAddIP({ ...addForm, assignedTo: currentUser.email })
      const data = await fetchIPsFromIntake()
      setIps(data || [])
      setAddOpen(false)
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', state: '', hasPartner: false, ip2FirstName: '', ip2LastName: '', ip2Email: '', ip2Phone: '' })
    } catch (err) {
      setAddError(err.message || 'Failed to add intended parent.')
    } finally { setAddSaving(false) }
  }

  useEffect(() => {
    Promise.all([fetchIPsFromIntake(), fetchMatchedJourneys(), fetchCompletedJourneys()])
      .then(([data, journeys, completed]) => {
        const activeJourneys = (journeys || []).filter(isJourneyActive)
        const matchedIpIds = new Set(activeJourneys.map(j => j.ip_case_id))
        const ipList = (data || []).filter(ip => !matchedIpIds.has(ip.id))
        setIps(ipList)
        setCompletedIpIds(new Set(
          (completed || []).map(j => String(j.ip_case_id)).filter(Boolean)
        ))
        // Load stage statuses
        const statuses = {}
        for (const ip of ipList) { statuses[ip.id] = getSurrogateStageStatus(ip.id) }
        setAllStageStatuses(statuses)
        // Load record tracking for milestones
        const ids = ipList.map(ip => ip.id)
        if (ids.length > 0) getRecordTrackingBatch(ids).then(setRecordTrackingMap).catch(() => {})
        // Load portrait photos for each IP (stored at ip-{caseId}/portrait/)
        if (ids.length > 0) {
          Promise.all(ids.map(id => getPortraitPhotoUrl(`ip-${id}`).catch(() => null)))
            .then(urls => {
              const map = {}
              ids.forEach((id, i) => { if (urls[i]) map[id] = urls[i] })
              setIpAvatars(map)
            })
        }
      })
      .catch(() => setIps([]))
      .finally(() => setLoading(false))
  }, [])

  const myCaseCount = ips.filter(ip => ip.assignedTo === currentUser.email).length
  const unassignedCount = ips.filter(ip => !ip.assignedTo).length

  // Owner-filtered (for stage counts)
  const ownerFiltered = useMemo(() => {
    return ips.filter(ip => {
      if (ownerFilter === 'mine') return ip.assignedTo === currentUser.email
      if (ownerFilter === 'unassigned') return !ip.assignedTo
      if (ownerFilter !== 'all') return ip.assignedTo === ownerFilter
      return true
    })
  }, [ips, ownerFilter, currentUser.email])

  // Stage counts — exclude completed-journey IPs so the chip totals match
  // what's actually rendered (those IPs are hidden unless searched by name).
  const stageCounts = {}
  for (const stage of IP_STAGES) stageCounts[stage.id] = 0
  for (const ip of ownerFiltered) {
    if (completedIpIds.has(String(ip.id))) continue
    const ss = allStageStatuses[ip.id]
    const stageId = ss?.stage || 'pre-qualification'
    if (stageCounts[stageId] !== undefined) stageCounts[stageId]++
  }

  const filtered = useMemo(() => {
    return ips.filter(ip => {
      // Owner filter
      if (ownerFilter === 'mine') { if (ip.assignedTo !== currentUser.email) return false }
      else if (ownerFilter === 'unassigned') { if (ip.assignedTo) return false }
      else if (ownerFilter !== 'all') { if (ip.assignedTo !== ownerFilter) return false }
      // Hide IPs whose journey was marked complete unless the admin is
      // explicitly searching by name. They re-appear with a "Completed
      // Journey" badge in search results.
      if (completedIpIds.has(String(ip.id)) && !search) return false
      // Stage filter
      if (stageFilter === 'active') {
        const stage = allStageStatuses[ip.id]?.stage || 'pre-qualification'
        if (INACTIVE_IP_STAGES.has(stage) && !(search && (
          ip.names.toLowerCase().includes(search.toLowerCase()) ||
          ip.email.toLowerCase().includes(search.toLowerCase()) ||
          (ip.location || '').toLowerCase().includes(search.toLowerCase())
        ))) return false
      } else if (stageFilter !== 'all') {
        const ss = allStageStatuses[ip.id]
        if ((ss?.stage || 'pre-qualification') !== stageFilter) return false
      }
      // Search
      if (search) {
        const q = search.toLowerCase()
        if (!ip.names.toLowerCase().includes(q) && !ip.email.toLowerCase().includes(q) && !(ip.location || '').toLowerCase().includes(q)) return false
      }
      // Type
      if (typeFilter !== 'all' && ip.type !== typeFilter) return false
      return true
    })
  }, [ips, search, stageFilter, typeFilter, ownerFilter, currentUser.email, allStageStatuses])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intended Parents"
        subtitle={(() => {
          const total = ips.filter(ip => !completedIpIds.has(String(ip.id))).length
          return `${filtered.length} of ${total} intended parent${total !== 1 ? 's' : ''} shown`
        })()}
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add IP
          </Button>
        }
      />

      {/* Hero stats — click to filter by stage */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          onClick={() => setStageFilter('active')}
          className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${stageFilter === 'active' ? 'ring-2 ring-[#1A3638] border-[#1A3638]/30 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
          style={{ background: 'linear-gradient(135deg, #fdf8f3, #f0f1fa)' }}
        >
          <p className="text-2xl font-bold" style={{ color: '#1A3638' }}>{ownerFiltered.filter(ip => { const st = allStageStatuses[ip.id]?.stage || 'pre-qualification'; return !INACTIVE_IP_STAGES.has(st) && !completedIpIds.has(String(ip.id)) }).length}</p>
          <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mt-0.5">Active Cases</p>
        </button>
        {IP_STAGES.filter(s => !s.hidden).map(stage => (
          <button
            key={stage.id}
            onClick={() => setStageFilter(stageFilter === stage.id ? 'all' : stage.id)}
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${stageFilter === stage.id ? 'ring-2 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
            style={{ backgroundColor: stage.color + '08', ...(stageFilter === stage.id ? { ringColor: stage.color, borderColor: stage.color + '50' } : {}) }}
          >
            <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stage.id]}</p>
            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{stage.label}</p>
          </button>
        ))}
      </div>

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
            {canSeeAll && <SelectItem value="all">All Cases ({ips.length})</SelectItem>}
            <SelectItem value="unassigned">Unassigned ({unassignedCount})</SelectItem>
            {canSeeAll && getAdminStaff().map(admin => (
              <SelectItem key={admin.email} value={admin.email}>
                {admin.name} ({ips.filter(ip => ip.assignedTo === admin.email).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Couple">Couple</SelectItem>
            <SelectItem value="Single parent">Single Parent</SelectItem>
          </SelectContent>
        </Select>
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

      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No intended parents found"
          description={ips.length === 0 ? "No IP applications have been submitted yet." : "Try adjusting your search or filters."}
        />
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(ip => {
            const ss = allStageStatuses[ip.id] || { stage: 'pre-qualification', status: 'New' }
            const isNew = ss.stage === 'pre-qualification' && ss.status === 'New'
            const assignedAdmin = ip.assignedTo ? getAdminStaff().find(a => a.email === ip.assignedTo)?.name : null
            const inactiveAccent = getInactiveCaseAccent(ss.stage)
            return (
            <Link key={ip.id} to={`/intended-parents/${ip.id}`}>
              <Card className="transition-shadow hover:shadow-md h-full relative" style={inactiveAccent ? { borderColor: inactiveAccent, boxShadow: `inset 4px 0 0 ${inactiveAccent}` } : undefined}>
                {isNew && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="relative flex size-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-3 bg-pink-500" />
                    </span>
                  </div>
                )}
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <ProfileAvatar name={ip.names} avatar={ipAvatars[ip.id]} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold truncate">{ip.names}</h3>
                      {ip.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="size-3.5" /><span>{ip.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <StageBadge stage={ss.stage} status={ss.status} caseType="ip" />
                        {completedIpIds.has(String(ip.id)) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Completed Journey
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">RE / Fertility Doctor</span>
                      <p className="font-medium flex items-center gap-1">
                        <Stethoscope className="size-3.5 text-muted-foreground" />
                        {ip.hasRE === true ? (ip.reDoctorName || 'Yes') : ip.hasRE === false ? 'Not yet' : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Frozen Embryos</span>
                      <p className="font-medium flex items-center gap-1">
                        <FertilizedEggIcon size={14} color="#78716c" className="shrink-0" />
                        {ip.hasFrozenEmbryos === true ? (ip.frozenEmbryoDetails || 'Yes') : ip.hasFrozenEmbryos === false ? 'No' : '—'}
                      </p>
                    </div>
                  </div>

                  <MilestoneProgress caseId={ip.id} stageId={ss.stage} recordTracking={recordTrackingMap[ip.id]} />

                  {assignedAdmin && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 pt-2 border-t">
                      <UserCog className="size-3.5" /> {assignedAdmin}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>RE</TableHead>
                <TableHead>Embryos</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ip => {
                const stage = allStageStatuses[ip.id]?.stage || 'pre-qualification'
                const inactiveAccent = getInactiveCaseAccent(stage)
                return (
                <TableRow
                  key={ip.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/intended-parents/${ip.id}`)}
                >
                  <TableCell style={inactiveAccent ? { boxShadow: `inset 4px 0 0 ${inactiveAccent}` } : undefined}>
                    <div className="flex items-center gap-3">
                      <ProfileAvatar name={ip.names} avatar={ipAvatars[ip.id]} size="sm" />
                      <div>
                        <span className="font-medium">{ip.names}</span>
                        <p className="text-xs text-stone-400">{ip.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{ip.location}</TableCell>
                  <TableCell><StatusBadge status={ip.status} /></TableCell>
                  <TableCell>{ip.hasRE === true ? (ip.reDoctorName || 'Yes') : ip.hasRE === false ? 'Not yet' : '—'}</TableCell>
                  <TableCell>{ip.hasFrozenEmbryos === true ? 'Yes' : ip.hasFrozenEmbryos === false ? 'No' : '—'}</TableCell>
                  <TableCell className="text-stone-500">{new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </Card>
      )}
      {/* Add IP Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Intended Parent</DialogTitle>
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
                <Label className="text-xs">Country</Label>
                <Input value={addForm.country} onChange={e => setAddForm(f => ({ ...f, country: e.target.value }))} placeholder="United States" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{addForm.country?.toLowerCase().includes('united states') || !addForm.country ? 'State' : 'State / Province / Region'}</Label>
              {(addForm.country?.toLowerCase().includes('united states') || !addForm.country) ? (
                <Select value={addForm.state} onValueChange={v => setAddForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} placeholder="Province / Region" />
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Has a Partner?</p>
                <p className="text-xs text-muted-foreground">Going through the journey with someone</p>
              </div>
              <Switch
                checked={addForm.hasPartner}
                onCheckedChange={v => setAddForm(f => ({ ...f, hasPartner: v }))}
              />
            </div>

            {addForm.hasPartner && (
              <div className="space-y-3 rounded-lg border p-3 bg-stone-50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Partner Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input value={addForm.ip2FirstName} onChange={e => setAddForm(f => ({ ...f, ip2FirstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input value={addForm.ip2LastName} onChange={e => setAddForm(f => ({ ...f, ip2LastName: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={addForm.ip2Email} onChange={e => setAddForm(f => ({ ...f, ip2Email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input type="tel" value={addForm.ip2Phone} onChange={e => setAddForm(f => ({ ...f, ip2Phone: formatPhone(e.target.value) }))} />
                  </div>
                </div>
              </div>
            )}

            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
            )}
            <Button onClick={handleAddIP}
              disabled={addSaving || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.phone}
              className="w-full gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
              {addSaving ? 'Adding...' : 'Add Intended Parent'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
