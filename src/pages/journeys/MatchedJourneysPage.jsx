import { useState, useMemo } from 'react'
import { Plus, Heart, Search, LayoutGrid, List as ListIcon, GitMerge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { MATCH_STAGES } from '@/lib/constants'
import { mockMatches } from '@/data/mock/matches'
import { mockSurrogates } from '@/data/mock/surrogates'
import { mockIntendedParents } from '@/data/mock/intendedParents'

const JOURNEY_STAGES = [
  { id: 'Profile Review', label: 'Profile Review', color: '#ed148c' },
  { id: 'Introduction', label: 'Introduction', color: '#c4219a' },
  { id: 'Meeting Scheduled', label: 'Meeting Scheduled', color: '#9b2ea7' },
  { id: 'Meeting Complete', label: 'Meeting Complete', color: '#723bb4' },
  { id: 'Match Confirmed', label: 'Match Confirmed', color: '#4d3da4' },
  { id: 'Legal', label: 'Legal', color: '#283693' },
  { id: 'Medical Clearance', label: 'Medical Clearance', color: '#10b981' },
  { id: 'Transfer Prep', label: 'Transfer Prep', color: '#0ea5e9' },
  { id: 'Active Pregnancy', label: 'Active Pregnancy', color: '#f59e0b' },
  { id: 'Delivered', label: 'Delivered', color: '#22c55e' },
]

export default function MatchedJourneysPage() {
  const [matches] = useState(mockMatches)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [view, setView] = useState('tile')

  const surrogateMap = useMemo(() => Object.fromEntries(mockSurrogates.map(s => [s.id, s])), [])
  const ipMap = useMemo(() => Object.fromEntries(mockIntendedParents.map(ip => [ip.id, ip])), [])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const s of JOURNEY_STAGES) counts[s.id] = 0
    for (const m of matches) {
      if (counts[m.stage] !== undefined) counts[m.stage]++
    }
    return counts
  }, [matches])

  const filtered = useMemo(() => {
    return matches.filter(m => {
      if (stageFilter !== 'all' && m.stage !== stageFilter) return false
      if (search) {
        const s = surrogateMap[m.surrogateId]
        const ip = ipMap[m.ipId]
        const q = search.toLowerCase()
        if (!s?.name?.toLowerCase().includes(q) && !ip?.name?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [matches, stageFilter, search])

  const getStageInfo = (stageId) => JOURNEY_STAGES.find(s => s.id === stageId) || { color: '#6b7280', label: stageId }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matched Journeys"
        subtitle={`${filtered.length} of ${matches.length} journey${matches.length !== 1 ? 's' : ''} shown`}
      />

      {/* Hero stats — click to filter */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          onClick={() => setStageFilter('all')}
          className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${stageFilter === 'all' ? 'ring-2 ring-[#283693] border-[#283693]/30 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
          style={{ background: 'linear-gradient(135deg, #fdf8f3, #f0f1fa)' }}
        >
          <p className="text-2xl font-bold" style={{ color: '#283693' }}>{matches.length}</p>
          <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">Total</p>
        </button>
        {JOURNEY_STAGES.map(stage => (
          <button
            key={stage.id}
            onClick={() => setStageFilter(stageFilter === stage.id ? 'all' : stage.id)}
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${stageFilter === stage.id ? 'ring-2 shadow-md scale-[1.03]' : 'border-stone-100 hover:shadow-sm hover:scale-[1.01]'}`}
            style={{ backgroundColor: stage.color + '08' }}
          >
            <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stage.id]}</p>
            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{stage.label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search by surrogate or IP name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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

      {/* Journey tiles or list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitMerge className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search || stageFilter !== 'all' ? 'No journeys match your filter.' : 'No matched journeys yet.'}</p>
        </div>
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => {
            const surrogate = surrogateMap[m.surrogateId]
            const ip = ipMap[m.ipId]
            const stage = getStageInfo(m.stage)
            return (
              <Card key={m.id} className="rounded-2xl hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: stage.color }} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ backgroundColor: stage.color + '15', color: stage.color }}>
                      {stage.label}
                    </span>
                    {m.startDate && <span className="text-[10px] text-stone-400">Started {m.startDate}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <ProfileAvatar name={surrogate?.name || '?'} size={48} />
                      <p className="text-sm font-semibold text-stone-800 mt-2 truncate">{surrogate?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-stone-400 uppercase">Surrogate</p>
                    </div>
                    <div className="shrink-0">
                      <Heart className="size-5 text-[#ed148c] fill-[#ed148c]/20" />
                    </div>
                    <div className="flex-1 text-center">
                      <ProfileAvatar name={ip?.name || '?'} size={48} />
                      <p className="text-sm font-semibold text-stone-800 mt-2 truncate">{ip?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-stone-400 uppercase">Intended Parent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <div className="divide-y divide-stone-100">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] px-5 py-3 bg-stone-50 text-xs font-semibold text-stone-500 uppercase tracking-wider">
              <span>Surrogate</span>
              <span>Intended Parent</span>
              <span>Stage</span>
              <span>Started</span>
            </div>
            {filtered.map(m => {
              const surrogate = surrogateMap[m.surrogateId]
              const ip = ipMap[m.ipId]
              const stage = getStageInfo(m.stage)
              return (
                <div key={m.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center px-5 py-3 hover:bg-stone-50 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar name={surrogate?.name || '?'} size={32} />
                    <span className="text-sm font-medium text-stone-800">{surrogate?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ProfileAvatar name={ip?.name || '?'} size={32} />
                    <span className="text-sm font-medium text-stone-800">{ip?.name || 'Unknown'}</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full w-fit" style={{ backgroundColor: stage.color + '15', color: stage.color }}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-stone-400">{m.startDate || '—'}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
