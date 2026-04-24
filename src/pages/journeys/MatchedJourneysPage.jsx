import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Search, LayoutGrid, List as ListIcon, ArrowRight, MapPin, Users, Crown, Circle, Clock, CheckCircle, UserCog, HeartPulse } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge, { JourneyStatusPill } from '@/components/shared/StageBadge'
import { SURROGATE_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getChecklistMilestones, getChecklistSteps, deriveParentStatus } from '@/lib/checklistStore'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, getAppConfig, getProfilePhotoUrls, getPortraitPhotoUrl } from '@/lib/db'
import { getAdminStaff } from '@/data/mock/users'

const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => s.id === 'journey-oversight')

// Order of status filter boxes, left to right. Any statuses present in data but
// not listed here get appended (alphabetized) just before the Archived box.
const STATUS_PRIORITY = [
  'Pending Medical Clearance',
  'Pending Legal Clearance',
  'Legal Clearance Issued',
  'Transfer Prep',
  'Pregnant',
  'Delivered',
  'Delivery',
  'Holding',
]

// The only people who can be Journey Manager
export const JOURNEY_MANAGERS = ['Julie Allgood', 'Nicole Lawson']

function getJourneyMilestoneProgress(stageId, tracking = {}) {
  const milestones = getChecklistMilestones('gc', stageId)
  const baseSteps = getChecklistSteps('gc', stageId)
  const caseSubtasks = Object.entries(tracking)
    .filter(([, val]) => val?._isCaseSubtask && !val?._deleted)
    .map(([id, val]) => ({ id, parentId: val._parentId, label: val._label || id }))
  const allSteps = [...baseSteps, ...caseSubtasks]

  const getStepStatus = (stepId) => {
    const step = allSteps.find(s => s.id === stepId)
    if (!step) return null
    const children = allSteps.filter(s => s.parentId === stepId)
    if (children.length > 0) return deriveParentStatus(children, tracking) || 'not_started'
    return tracking[stepId]?.status || 'not_started'
  }

  let completed = 0
  const milestoneData = milestones.map(ms => {
    const statuses = (ms.stepIds || [])
      .map(getStepStatus)
      .filter(status => status !== null)
    const allComplete = statuses.length > 0 && statuses.every(status => status === 'complete' || status === 'na' || status === 'partial_complete')
    const anyStarted = statuses.some(status => status && status !== 'not_started')
    const status = allComplete ? 'complete' : anyStarted ? 'in_progress' : 'not_started'
    if (allComplete) completed++
    return { ...ms, status }
  })

  return { milestoneData, completed, total: milestones.length }
}

// Outline color by Journey Manager: Julie → indigo, Nicole → coral
export function journeyManagerOutlineColor(j) {
  const name = (j?.journey_data?.journeyManager || '').toLowerCase()
  if (name.includes('julie')) return '#283693'
  if (name.includes('nicole')) return '#ed148c'
  return null
}

export function JourneyTileCard({ j, ipAvatar, gcAvatar }) {
  const outline = journeyManagerOutlineColor(j)
  const isArchived = !!j.journey_data?._archivedAt
  return (
    <Link to={`/journeys/${j.id}`}>
      <Card
        className={`rounded-2xl hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden p-0 gap-0 ${isArchived ? 'opacity-70' : ''}`}
        style={outline ? { border: `2px solid ${outline}` } : undefined}
      >
        {isArchived && (
          <div className="px-3 py-1 bg-stone-100 text-stone-500 text-[9px] font-bold uppercase tracking-widest text-center border-b border-stone-200">
            Archived
          </div>
        )}
        {/* IP */}
        <div className="px-4 pt-3 pb-2" style={{ backgroundColor: '#28369308' }}>
          <p className="text-[9px] font-semibold text-[#283693]/40 uppercase tracking-widest mb-1.5">Intended Parent{j.ip?.type === 'Couple' ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <ProfileAvatar name={j.ip?.names || '?'} avatar={ipAvatar} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold truncate block">{j.ip?.names || '—'}</span>
              <p className="text-[10px] text-stone-400">{j.ip?.location || ''}</p>
            </div>
          </div>
        </div>
        {/* GC */}
        <div className="px-4 pt-2.5 pb-2 border-t border-stone-100" style={{ backgroundColor: '#ed148c08' }}>
          <p className="text-[9px] font-semibold text-pink-400 uppercase tracking-widest mb-1.5">Surrogate</p>
          <div className="flex items-center gap-2">
            <ProfileAvatar name={j.gc?.name || '?'} avatar={gcAvatar} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold truncate block">{j.gc?.name || '—'}</span>
              <p className="text-[10px] text-stone-400">{j.gc?.location || ''} {j.gc?.age ? `· Age ${j.gc.age}` : ''}{j.gc?.answers?.dob ? ` · DOB ${new Date(j.gc.answers.dob + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}` : ''}</p>
            </div>
          </div>
        </div>
        {/* Milestones */}
        {(() => {
          const tracking = j.journey_data?._checklistTracking || {}
          const { milestoneData, completed, total } = getJourneyMilestoneProgress(j.stage, tracking)
          const pct = total > 0 ? (completed / total) * 100 : 0
          return total > 0 ? (
            <div className="px-4 py-1.5 border-t border-stone-100 space-y-1">
              <div className="flex items-center justify-between text-[9px] text-stone-400 uppercase tracking-wider font-semibold">
                <span>Milestones</span>
                <span>{completed}/{total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #283693, #ed148c)' }} />
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                {milestoneData.map(ms => (
                  <div key={ms.id} className="flex items-center gap-0.5">
                    <Circle className={`size-2.5 shrink-0 ${ms.status === 'complete' ? 'text-emerald-500 fill-emerald-500' : ms.status === 'in_progress' ? 'text-amber-500 fill-amber-500' : 'text-stone-300'}`} />
                    <span className={`text-[9px] whitespace-nowrap ${ms.status === 'complete' ? 'text-emerald-600' : ms.status === 'in_progress' ? 'text-amber-600' : 'text-stone-400'}`}>{ms.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        })()}
        <CardContent className="px-4 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <StageBadge stage={j.stage} status={j.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            {j.journey_data?.delivered ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium inline-flex items-center gap-1">
                <img src={j.journey_data.babySexes?.[0] === 'girl' ? '/baby-girl.png' : '/baby-boy.png'} alt="" className="size-4 object-contain" />
                Born {j.journey_data.deliveryDate ? formatDate(j.journey_data.deliveryDate) : ''}
              </span>
            ) : j.journey_data?.pregnant === 'yes' ? (
              <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200 font-medium">
                🤰 {j.journey_data.dueDate ? `Due ${formatDate(j.journey_data.dueDate)}` : 'Pregnant'}
              </span>
            ) : null}
            {j.journey_data?.escrowBalance && (
              <span className={`font-semibold ${j.journey_data.escrowMin && parseFloat(String(j.journey_data.escrowBalance).replace(/[^0-9.]/g, '')) >= parseFloat(String(j.journey_data.escrowMin).replace(/[^0-9.]/g, '')) ? 'text-emerald-600' : 'text-red-600'}`}>
                Escrow: {j.journey_data.escrowBalance}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-stone-400">
            {j.assigned_to && (
              <span className="flex items-center gap-0.5"><UserCog className="size-2.5" />{getAdminStaff().find(a => a.email === j.assigned_to)?.name || '—'}</span>
            )}
            {j.journey_data?.journeyManager && (
              <span className="flex items-center gap-0.5"><Crown className="size-2.5 text-amber-500" />{j.journey_data.journeyManager}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function MatchedJourneysPage() {
  const { currentUser, isSuperAdmin, isMasterAdmin } = useRole()
  const canSeeAll = isSuperAdmin || isMasterAdmin
  const [journeys, setJourneys] = useState([])
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState(isSuperAdmin || isMasterAdmin ? 'all' : 'mine')
  const [view, setView] = useState('tile')
  const [gcAvatars, setGcAvatars] = useState({}) // gc_case_id → url
  const [ipAvatars, setIpAvatars] = useState({}) // ip_case_id → url

  // Load user's default view preference
  useEffect(() => {
    if (!currentUser?.id) return
    getAppConfig(`user_prefs_${currentUser.id}`).then(data => {
      if (data?.defaultView === 'list') setView('list')
    }).catch(() => {})
  }, [currentUser?.id])

  useEffect(() => {
    Promise.all([fetchMatchedJourneys(), fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([js, gcs, allIps]) => {
        setJourneys(js); setSurrogates(gcs); setIps(allIps)
        // Load surrogate avatars
        const gcsInJourneys = gcs.filter(g => (js || []).some(j => j.gc_case_id === g.id))
        const userIds = gcsInJourneys.filter(g => g.userId).map(g => g.userId)
        if (userIds.length > 0) {
          getProfilePhotoUrls(userIds).then(urlMap => {
            // Map user_id → gc_case_id
            const byCase = {}
            for (const g of gcsInJourneys) {
              if (g.userId && urlMap[g.userId]) byCase[g.id] = urlMap[g.userId]
            }
            setGcAvatars(prev => ({ ...byCase, ...prev }))
          })
        }
        // Fallback: also check {gc_case_id}/portrait for surrogates without a userId-based URL
        ;(async () => {
          const needsFallback = gcsInJourneys.filter(g => !g.userId || !userIds.includes(g.userId))
          if (needsFallback.length === 0) return
          const urls = await Promise.all(needsFallback.map(g => getPortraitPhotoUrl(String(g.id)).catch(() => null)))
          const update = {}
          needsFallback.forEach((g, i) => { if (urls[i]) update[g.id] = urls[i] })
          if (Object.keys(update).length) setGcAvatars(prev => ({ ...prev, ...update }))
        })()
        // Load IP avatars from storage (path: ip-{caseId}/portrait/)
        const ipIds = allIps.map(ip => ip.id)
        if (ipIds.length > 0) {
          Promise.all(ipIds.map(id => getPortraitPhotoUrl(`ip-${id}`).catch(() => null)))
            .then(urls => {
              const map = {}
              ipIds.forEach((id, i) => { if (urls[i]) map[id] = urls[i] })
              setIpAvatars(map)
            })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const enriched = useMemo(() => {
    return journeys.map(j => {
      const gc = surrogates.find(s => s.id === j.gc_case_id)
      const ip = ips.find(i => i.id === j.ip_case_id)
      return { ...j, gc, ip }
    })
  }, [journeys, surrogates, ips])

  const myCaseCount = enriched.filter(j => j.assigned_to === currentUser.email).length
  const unassignedCount = enriched.filter(j => !j.assigned_to).length

  // Owner-filtered (for stage counts)
  const ownerFiltered = useMemo(() => {
    return enriched.filter(j => {
      if (ownerFilter === 'mine') return j.assigned_to === currentUser.email
      if (ownerFilter === 'unassigned') return !j.assigned_to
      if (ownerFilter !== 'all') return j.assigned_to === ownerFilter
      return true
    })
  }, [enriched, ownerFilter, currentUser.email])

  const filtered = useMemo(() => {
    return enriched.filter(j => {
      const archived = !!j.journey_data?._archivedAt
      // Archived journeys only show when the Archived filter is active.
      if (statusFilter === 'archived') {
        if (!archived) return false
      } else {
        if (archived) return false
      }
      // Owner
      if (ownerFilter === 'mine') { if (j.assigned_to !== currentUser.email) return false }
      else if (ownerFilter === 'unassigned') { if (j.assigned_to) return false }
      else if (ownerFilter !== 'all') { if (j.assigned_to !== ownerFilter) return false }
      // Status
      if (statusFilter !== 'all' && statusFilter !== 'archived' && j.status !== statusFilter) return false
      // Search
      if (search) {
        const q = search.toLowerCase()
        const gcName = (j.gc?.name || '').toLowerCase()
        const ipName = (j.ip?.names || '').toLowerCase()
        if (!gcName.includes(q) && !ipName.includes(q)) return false
      }
      return true
    })
  }, [enriched, search, statusFilter, ownerFilter, currentUser.email])

  // Status counts based on owner filter — archived journeys are excluded from
  // per-status counts and surfaced separately in the Archived box.
  const statusCounts = useMemo(() => {
    const counts = {}
    for (const j of ownerFiltered) {
      if (j.journey_data?._archivedAt) continue
      const st = j.status || 'Unknown'
      counts[st] = (counts[st] || 0) + 1
    }
    return counts
  }, [ownerFiltered])

  const allCasesCount = useMemo(
    () => ownerFiltered.filter(j => !j.journey_data?._archivedAt).length,
    [ownerFiltered]
  )
  const archivedCount = useMemo(
    () => ownerFiltered.filter(j => !!j.journey_data?._archivedAt).length,
    [ownerFiltered]
  )

  const orderedStatuses = useMemo(() => {
    const all = Object.keys(statusCounts)
    const seen = new Set()
    const head = []
    for (const s of STATUS_PRIORITY) {
      if (all.includes(s)) { head.push(s); seen.add(s) }
    }
    const tail = all.filter(s => !seen.has(s)).sort()
    return [...head, ...tail]
  }, [statusCounts])

  if (loading) return <div className="text-center py-12 text-stone-400">Loading journeys...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matched Journeys"
        subtitle={
          statusFilter === 'archived'
            ? `${filtered.length} archived journey${filtered.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${allCasesCount} journey${allCasesCount !== 1 ? 's' : ''} shown`
        }
      />

      {/* Status filter boxes */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatusFilter('all'); setOwnerFilter('all') }}
          className={`rounded-xl border px-5 py-3 text-center cursor-pointer transition-all ${statusFilter === 'all' && ownerFilter === 'all' ? 'ring-2 ring-[#283693] border-[#283693]/30 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
          style={{ background: 'linear-gradient(135deg, #fdf8f3, #f0f1fa)' }}
        >
          <p className="text-2xl font-bold" style={{ color: '#283693' }}>{allCasesCount}</p>
          <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">All Cases</p>
        </button>
        {orderedStatuses.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            className={`rounded-xl border px-5 py-3 text-center cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-[#723bb4] border-[#723bb4]/30 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
          >
            <p className="text-2xl font-bold" style={{ color: '#723bb4' }}>{statusCounts[status]}</p>
            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{status}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by surrogate or IP name..." className="pl-9" />
        </div>

        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">My Journeys ({myCaseCount})</SelectItem>
            {canSeeAll && <SelectItem value="all">All Journeys ({enriched.length})</SelectItem>}
            <SelectItem value="unassigned">Unassigned ({unassignedCount})</SelectItem>
            {canSeeAll && getAdminStaff().map(admin => (
              <SelectItem key={admin.email} value={admin.email}>
                {admin.name} ({enriched.filter(j => j.assigned_to === admin.email).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md">
          <Button variant={view === 'tile' ? 'default' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setView('tile')}>
            <LayoutGrid className="size-4" />
          </Button>
          <Button variant={view === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setView('list')}>
            <ListIcon className="size-4" />
          </Button>
        </div>

        {archivedCount > 0 && (
          <button
            onClick={() => setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived')}
            className={`text-xs font-medium px-2 self-center whitespace-nowrap transition-colors ${statusFilter === 'archived' ? 'text-[#283693] underline' : 'text-stone-400 hover:text-stone-600'}`}
          >
            {statusFilter === 'archived' ? '← Back to active' : `View archived (${archivedCount})`}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="size-12 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400">{
            statusFilter === 'archived'
              ? 'No archived journeys.'
              : journeys.length === 0
                ? 'No matched journeys yet. Create a match from the Matching page.'
                : 'No journeys match your search.'
          }</p>
        </div>
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(j => (
            <JourneyTileCard key={j.id} j={j} ipAvatar={ipAvatars[j.ip_case_id]} gcAvatar={gcAvatars[j.gc_case_id]} />
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Intended Parent</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Surrogate</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => {
                  const outline = journeyManagerOutlineColor(j)
                  const isArchived = !!j.journey_data?._archivedAt
                  return (
                  <tr
                    key={j.id}
                    className={`border-b last:border-0 hover:bg-stone-50/50 cursor-pointer ${isArchived ? 'opacity-60' : ''}`}
                    onClick={() => window.location.href = `/journeys/${j.id}`}
                  >
                    <td
                      className="px-4 py-3"
                      style={outline ? { boxShadow: `inset 4px 0 0 ${outline}` } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={j.ip?.names || '?'} avatar={ipAvatars[j.ip_case_id]} size="sm" />
                        <span className="font-medium">{j.ip?.names || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={j.gc?.name || '?'} avatar={gcAvatars[j.gc_case_id]} size="sm" />
                        <span className="font-medium">{j.gc?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><JourneyStatusPill stage={j.stage} status={j.status} /></td>
                    <td className="px-4 py-3 text-stone-400 text-xs">{new Date(j.created_at).toLocaleDateString()}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
