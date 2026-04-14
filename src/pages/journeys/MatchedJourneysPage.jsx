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
import StageBadge from '@/components/shared/StageBadge'
import { SURROGATE_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getChecklistMilestones } from '@/lib/checklistStore'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { getAdminStaff } from '@/data/mock/users'

const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => s.id === 'journey-oversight')

export function JourneyTileCard({ j }) {
  return (
    <Link to={`/journeys/${j.id}`}>
      <Card className="rounded-2xl hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden p-0 gap-0">
        {/* IP */}
        <div className="px-4 pt-3 pb-2" style={{ backgroundColor: '#28369308' }}>
          <p className="text-[9px] font-semibold text-[#283693]/40 uppercase tracking-widest mb-1.5">Intended Parent{j.ip?.type === 'Couple' ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <ProfileAvatar name={j.ip?.names || '?'} size="sm" />
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
            <ProfileAvatar name={j.gc?.name || '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold truncate block">{j.gc?.name || '—'}</span>
              <p className="text-[10px] text-stone-400">{j.gc?.location || ''} {j.gc?.age ? `· Age ${j.gc.age}` : ''}</p>
            </div>
          </div>
        </div>
        {/* Milestones */}
        {(() => {
          const milestones = getChecklistMilestones('gc', j.stage)
          const total = milestones.length
          const completed = 0
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
                {milestones.map(ms => (
                  <div key={ms.id} className="flex items-center gap-0.5">
                    <Circle className="size-2.5 text-stone-300 shrink-0" />
                    <span className="text-[9px] text-stone-400 whitespace-nowrap">{ms.label}</span>
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

  useEffect(() => {
    Promise.all([fetchMatchedJourneys(), fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([js, gcs, allIps]) => { setJourneys(js); setSurrogates(gcs); setIps(allIps) })
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
      // Owner
      if (ownerFilter === 'mine') { if (j.assigned_to !== currentUser.email) return false }
      else if (ownerFilter === 'unassigned') { if (j.assigned_to) return false }
      else if (ownerFilter !== 'all') { if (j.assigned_to !== ownerFilter) return false }
      // Status
      if (statusFilter !== 'all' && j.status !== statusFilter) return false
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

  // Status counts based on owner filter
  const statusCounts = useMemo(() => {
    const counts = {}
    for (const j of ownerFiltered) {
      const st = j.status || 'Unknown'
      counts[st] = (counts[st] || 0) + 1
    }
    return counts
  }, [ownerFiltered])

  const uniqueStatuses = useMemo(() => Object.keys(statusCounts).sort(), [statusCounts])

  if (loading) return <div className="text-center py-12 text-stone-400">Loading journeys...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matched Journeys"
        subtitle={`${filtered.length} of ${enriched.length} journey${enriched.length !== 1 ? 's' : ''} shown`}
      />

      {/* Status filter boxes */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatusFilter('all'); setOwnerFilter('all') }}
          className={`rounded-xl border px-5 py-3 text-center cursor-pointer transition-all ${statusFilter === 'all' && ownerFilter === 'all' ? 'ring-2 ring-[#283693] border-[#283693]/30 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
          style={{ background: 'linear-gradient(135deg, #fdf8f3, #f0f1fa)' }}
        >
          <p className="text-2xl font-bold" style={{ color: '#283693' }}>{enriched.length}</p>
          <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">All Cases</p>
        </button>
        {uniqueStatuses.map(status => (
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
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="size-12 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400">{journeys.length === 0 ? 'No matched journeys yet. Create a match from the Matching page.' : 'No journeys match your search.'}</p>
        </div>
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(j => (
            <JourneyTileCard key={j.id} j={j} />
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
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Stage</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Manager</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id} className="border-b last:border-0 hover:bg-stone-50/50 cursor-pointer" onClick={() => window.location.href = `/journeys/${j.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={j.ip?.names || '?'} size="sm" />
                        <span className="font-medium">{j.ip?.names || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={j.gc?.name || '?'} size="sm" />
                        <span className="font-medium">{j.gc?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={j.stage} status={j.status} /></td>
                    <td className="px-4 py-3 text-stone-600">{j.status}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{j.journey_data?.journeyManager || j.assigned_to || '—'}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs">{new Date(j.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
