import { Link } from 'react-router-dom'
import { ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { MATCH_STAGES } from '@/lib/constants'
import { cn } from '@/lib/utils'

export default function MatchDetailDialog({
  match,
  surrogate,
  ip,
  open,
  onOpenChange,
  onAdvance,
  onMoveBack,
}) {
  if (!match || !surrogate || !ip) return null

  const currentIdx = MATCH_STAGES.indexOf(match.stage)
  const isFirst = currentIdx === 0
  const isLast = currentIdx === MATCH_STAGES.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match Detail</DialogTitle>
          <DialogDescription>
            {surrogate.name} & {ip.names} — {match.stage}
          </DialogDescription>
        </DialogHeader>

        {/* Stage progress bar */}
        <div className="flex gap-1">
          {MATCH_STAGES.map((stage, i) => (
            <div
              key={stage}
              className={cn(
                'h-2 flex-1 rounded-full',
                i < currentIdx && 'bg-emerald-400',
                i === currentIdx && 'bg-emerald-600',
                i > currentIdx && 'bg-muted',
              )}
              title={stage}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Stage {currentIdx + 1} of {MATCH_STAGES.length}: {match.stage}
        </p>

        {/* Side-by-side profiles */}
        <div className="grid grid-cols-2 gap-4">
          {/* Surrogate */}
          <Card>
            <CardContent className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <ProfileAvatar name={surrogate.name} size="md" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{surrogate.name}</p>
                  <p className="text-xs text-muted-foreground">Surrogate</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Age: {surrogate.age}</p>
                <p>Location: {surrogate.location}</p>
                <p>Previous journeys: {surrogate.previousJourneys}</p>
              </div>
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link to={`/surrogates/${surrogate.id}`}>
                  View Full Profile <ExternalLink className="size-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* IP */}
          <Card>
            <CardContent className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <ProfileAvatar name={ip.names} size="md" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{ip.names}</p>
                  <p className="text-xs text-muted-foreground">Intended Parent{ip.names.includes('&') ? 's' : ''}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Type: {ip.type}</p>
                <p>Location: {ip.location}</p>
                <p>Budget: {ip.budget}</p>
              </div>
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link to={`/intended-parents/${ip.id}`}>
                  View Full Profile <ExternalLink className="size-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Start / due date */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          {match.startDate && <p>Started: {new Date(match.startDate).toLocaleDateString()}</p>}
          {match.dueDate && <p>Due: {new Date(match.dueDate).toLocaleDateString()}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onMoveBack}
            disabled={isFirst}
          >
            <ChevronLeft className="size-4 mr-1" />
            Move Back
          </Button>
          <Button
            onClick={onAdvance}
            disabled={isLast}
          >
            Advance Stage
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
