import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Search, LayoutGrid, List as ListIcon, ArrowRight, MapPin, Users, Crown, Circle, Clock, CheckCircle } from 'lucide-react'
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
import { mockUsers } from '@/data/mock/users'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => ['journey-oversight', 'journey-ending', 'journey-closed'].includes(s.id))

export default function MatchedJourneysPage() {
  const [journeys, setJourneys] = useState([])
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
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

  const filtered = useMemo(() => {
    return enriched.filter(j => {
      if (stageFilter !== 'all' && j.stage !== stageFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const gcName = (j.gc?.name || '').toLowerCase()
        const ipName = (j.ip?.names || '').toLowerCase()
        if (!gcName.includes(q) && !ipName.includes(q)) return false
      }
      return true
    })
  }, [enriched, search, stageFilter])

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts = {}
    for (const s of JOURNEY_STAGES) counts[s.id] = 0
    for (const j of journeys) { if (counts[j.stage] !== undefined) counts[j.stage]++ }
    return counts
  }, [journeys])

  if (loading) return <div className="text-center py-12 text-stone-400">Loading journeys...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matched Journeys"
        subtitle={`${journeys.length} active journey${journeys.length !== 1 ? 's' : ''}`}
      />

      {/* Stage filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${stageFilter === 'all' ? 'bg-[#283693] text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          onClick={() => setStageFilter('all')}
        >
          All ({journeys.length})
        </button>
        {JOURNEY_STAGES.map(stage => (
          <button
            key={stage.id}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${stageFilter === stage.id ? 'text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            style={stageFilter === stage.id ? { backgroundColor: stage.color } : {}}
            onClick={() => setStageFilter(stageFilter === stage.id ? 'all' : stage.id)}
          >
            {stage.label} ({stageCounts[stage.id] || 0})
          </button>
        ))}
      </div>

      {/* Search + view toggle */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by surrogate or IP name..." className="pl-9" />
        </div>
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
            <Link key={j.id} to={`/journeys/${j.id}`}>
              <Card className="rounded-2xl hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden p-0 gap-0">
                {/* GC */}
                <div className="px-4 pt-3 pb-2" style={{ backgroundColor: '#ed148c08' }}>
                  <p className="text-[9px] font-semibold text-pink-400 uppercase tracking-widest mb-1.5">Surrogate</p>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar name={j.gc?.name || '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate block">{j.gc?.name || '—'}</span>
                      <p className="text-[10px] text-stone-400">{j.gc?.location || ''} {j.gc?.age ? `· Age ${j.gc.age}` : ''}</p>
                    </div>
                  </div>
                </div>
                {/* IP */}
                <div className="px-4 pt-2.5 pb-2 border-t border-stone-100" style={{ backgroundColor: '#28369308' }}>
                  <p className="text-[9px] font-semibold text-[#283693]/40 uppercase tracking-widest mb-1.5">Intended Parent{j.ip?.type === 'Couple' ? 's' : ''}</p>
                  <div className="flex items-center gap-2">
                    <ProfileAvatar name={j.ip?.names || '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate block">{j.ip?.names || '—'}</span>
                      <p className="text-[10px] text-stone-400">{j.ip?.location || ''}</p>
                    </div>
                  </div>
                </div>
                {/* Milestones */}
                {(() => {
                  const milestones = getChecklistMilestones('gc', j.stage)
                  const total = milestones.length
                  // For now milestones are always 0 completed on cards (tracking is per-case)
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
                  {/* Pregnancy + Escrow */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    {j.journey_data?.pregnant === 'yes' && (
                      <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200 font-medium">
                        🤰 {j.journey_data.dueDate ? `Due ${formatDate(j.journey_data.dueDate)}` : 'Pregnant'}
                      </span>
                    )}
                    {j.journey_data?.escrowBalance && (
                      <span className={`font-semibold ${j.journey_data.escrowMin && parseFloat(String(j.journey_data.escrowBalance).replace(/[^0-9.]/g, '')) >= parseFloat(String(j.journey_data.escrowMin).replace(/[^0-9.]/g, '')) ? 'text-emerald-600' : 'text-red-600'}`}>
                        Escrow: {j.journey_data.escrowBalance}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-stone-400">
                    {j.assigned_to && (
                      <span className="flex items-center gap-0.5"><Users className="size-2.5" />{ADMIN_STAFF.find(a => a.email === j.assigned_to)?.name || '—'}</span>
                    )}
                    {j.journey_data?.journeyManager && (
                      <span className="flex items-center gap-0.5"><Crown className="size-2.5 text-amber-500" />{j.journey_data.journeyManager}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Surrogate</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Intended Parent</th>
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
                        <ProfileAvatar name={j.gc?.name || '?'} size="sm" />
                        <span className="font-medium">{j.gc?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={j.ip?.names || '?'} size="sm" />
                        <span className="font-medium">{j.ip?.names || '—'}</span>
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
