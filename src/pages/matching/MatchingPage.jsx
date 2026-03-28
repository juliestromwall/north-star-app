import { useState, useMemo } from 'react'
import { Plus, Heart, Users, Baby } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import KanbanColumn from './KanbanColumn'
import MatchDetailDialog from './MatchDetailDialog'
import NewMatchDialog from './NewMatchDialog'
import { MATCH_STAGES } from '@/lib/constants'
import { mockMatches } from '@/data/mock/matches'
import { mockSurrogates } from '@/data/mock/surrogates'
import { mockIntendedParents } from '@/data/mock/intendedParents'

export default function MatchingPage() {
  const [matches, setMatches] = useState(mockMatches)
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const [showNewMatch, setShowNewMatch] = useState(false)

  // O(1) lookup maps
  const surrogateMap = useMemo(
    () => Object.fromEntries(mockSurrogates.map(s => [s.id, s])),
    [],
  )
  const ipMap = useMemo(
    () => Object.fromEntries(mockIntendedParents.map(ip => [ip.id, ip])),
    [],
  )

  // Group matches by stage
  const matchesByStage = useMemo(() => {
    const map = {}
    for (const stage of MATCH_STAGES) map[stage] = []
    for (const m of matches) {
      if (map[m.stage]) map[m.stage].push(m)
    }
    return map
  }, [matches])

  // Unmatched candidates
  const matchedSurrogateIds = useMemo(
    () => new Set(matches.map(m => m.surrogateId)),
    [matches],
  )
  const matchedIPIds = useMemo(
    () => new Set(matches.map(m => m.ipId)),
    [matches],
  )
  const unmatchedSurrogates = useMemo(
    () => mockSurrogates.filter(s => !matchedSurrogateIds.has(s.id)),
    [matchedSurrogateIds],
  )
  const unmatchedIPs = useMemo(
    () => mockIntendedParents.filter(ip => !matchedIPIds.has(ip.id)),
    [matchedIPIds],
  )

  // Selected match (derived from ID)
  const selectedMatch = matches.find(m => m.id === selectedMatchId) || null
  const selectedSurrogate = selectedMatch ? surrogateMap[selectedMatch.surrogateId] : null
  const selectedIP = selectedMatch ? ipMap[selectedMatch.ipId] : null

  // Handlers
  const advanceStage = () => {
    if (!selectedMatch) return
    const idx = MATCH_STAGES.indexOf(selectedMatch.stage)
    if (idx >= MATCH_STAGES.length - 1) return
    setMatches(prev =>
      prev.map(m =>
        m.id === selectedMatchId ? { ...m, stage: MATCH_STAGES[idx + 1] } : m,
      ),
    )
  }

  const moveBackStage = () => {
    if (!selectedMatch) return
    const idx = MATCH_STAGES.indexOf(selectedMatch.stage)
    if (idx <= 0) return
    setMatches(prev =>
      prev.map(m =>
        m.id === selectedMatchId ? { ...m, stage: MATCH_STAGES[idx - 1] } : m,
      ),
    )
  }

  const createMatch = (surrogateId, ipId) => {
    const newMatch = {
      id: `m${Date.now()}`,
      surrogateId,
      ipId,
      stage: MATCH_STAGES[0],
      startDate: new Date().toISOString().split('T')[0],
      dueDate: null,
    }
    setMatches(prev => [...prev, newMatch])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match Pipeline"
        actions={
          <Button onClick={() => setShowNewMatch(true)}>
            <Plus className="size-4 mr-1" />
            New Match
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Matches"
          value={matches.length}
          icon={Heart}
        />
        <StatCard
          title="Unmatched Surrogates"
          value={unmatchedSurrogates.length}
          icon={Users}
        />
        <StatCard
          title="Unmatched IPs"
          value={unmatchedIPs.length}
          icon={Baby}
        />
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {MATCH_STAGES.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              matches={matchesByStage[stage]}
              surrogateMap={surrogateMap}
              ipMap={ipMap}
              onCardClick={setSelectedMatchId}
            />
          ))}
        </div>
      </div>

      {/* Match detail dialog */}
      <MatchDetailDialog
        match={selectedMatch}
        surrogate={selectedSurrogate}
        ip={selectedIP}
        open={!!selectedMatchId}
        onOpenChange={open => { if (!open) setSelectedMatchId(null) }}
        onAdvance={advanceStage}
        onMoveBack={moveBackStage}
      />

      {/* New match dialog */}
      <NewMatchDialog
        open={showNewMatch}
        onOpenChange={setShowNewMatch}
        unmatchedSurrogates={unmatchedSurrogates}
        unmatchedIPs={unmatchedIPs}
        onCreate={createMatch}
      />
    </div>
  )
}
