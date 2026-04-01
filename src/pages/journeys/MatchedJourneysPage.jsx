import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Search, LayoutGrid, List as ListIcon, ArrowRight, MapPin, Users, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge from '@/components/shared/StageBadge'
import { SURROGATE_STAGES } from '@/lib/constants'
import { fetchMatchedJourneys } from '@/lib/matching'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'

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
              <Card className="rounded-2xl hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                {/* Stacked mini hero */}
                <div className="bg-gradient-to-r from-pink-50 to-pink-25 px-4 pt-3 pb-2 border-b border-pink-100">
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar name={j.gc?.name || '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-pink-500 text-white">GC</span>
                        <span className="text-sm font-semibold truncate">{j.gc?.name || '—'}</span>
                      </div>
                      <p className="text-[10px] text-stone-400">{j.gc?.location || ''} {j.gc?.age ? `· Age ${j.gc.age}` : ''}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-25 px-4 pt-2 pb-3 border-b border-purple-100">
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar name={j.ip?.names || '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-500 text-white">IP</span>
                        <span className="text-sm font-semibold truncate">{j.ip?.names || '—'}</span>
                      </div>
                      <p className="text-[10px] text-stone-400">{j.ip?.type || ''} {j.ip?.location ? `· ${j.ip.location}` : ''}</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <StageBadge stage={j.stage} status={j.status} />
                    <ArrowRight className="size-4 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-stone-400">
                    {j.journey_data?.journeyManager && (
                      <span className="flex items-center gap-0.5"><Crown className="size-2.5 text-amber-500" />{j.journey_data.journeyManager}</span>
                    )}
                    <span>Created {new Date(j.created_at).toLocaleDateString()}</span>
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
