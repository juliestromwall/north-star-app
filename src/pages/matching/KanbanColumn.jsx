import { Badge } from '@/components/ui/badge'
import MatchCard from './MatchCard'

export default function KanbanColumn({ stage, matches, surrogateMap, ipMap, onCardClick }) {
  return (
    <div className="w-72 shrink-0 flex flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold truncate">{stage}</h3>
        <Badge variant="secondary" className="text-xs">
          {matches.length}
        </Badge>
      </div>

      {/* Column body */}
      <div className="flex-1 rounded-lg bg-muted/30 p-2 space-y-2 min-h-[200px]">
        {matches.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center pt-8">No matches</p>
        ) : (
          matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              surrogate={surrogateMap[match.surrogateId]}
              ip={ipMap[match.ipId]}
              onClick={() => onCardClick(match.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
