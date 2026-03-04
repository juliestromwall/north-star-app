import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { cn } from '@/lib/utils'

function CandidateCard({ name, subtitle, detail, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-colors',
        selected
          ? 'ring-2 ring-primary border-primary bg-primary/5'
          : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-3">
        <ProfileAvatar name={name} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
    </button>
  )
}

export default function NewMatchDialog({
  open,
  onOpenChange,
  unmatchedSurrogates,
  unmatchedIPs,
  onCreate,
}) {
  const [selectedSurrogate, setSelectedSurrogate] = useState(null)
  const [selectedIP, setSelectedIP] = useState(null)

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedSurrogate(null)
      setSelectedIP(null)
    }
  }, [open])

  const handleCreate = () => {
    if (selectedSurrogate && selectedIP) {
      onCreate(selectedSurrogate, selectedIP)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
          <DialogDescription>
            Select a surrogate and intended parent to create a new match.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Surrogates column */}
          <div>
            <p className="text-sm font-semibold mb-2">Surrogates ({unmatchedSurrogates.length})</p>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {unmatchedSurrogates.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center pt-8">No unmatched surrogates</p>
                ) : (
                  unmatchedSurrogates.map(s => (
                    <CandidateCard
                      key={s.id}
                      name={s.name}
                      subtitle={`Age ${s.age} · ${s.location}`}
                      detail={s.previousJourneys > 0 ? `${s.previousJourneys} previous journey${s.previousJourneys > 1 ? 's' : ''}` : 'First journey'}
                      selected={selectedSurrogate === s.id}
                      onClick={() => setSelectedSurrogate(s.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* IPs column */}
          <div>
            <p className="text-sm font-semibold mb-2">Intended Parents ({unmatchedIPs.length})</p>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {unmatchedIPs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center pt-8">No unmatched IPs</p>
                ) : (
                  unmatchedIPs.map(ip => (
                    <CandidateCard
                      key={ip.id}
                      name={ip.names}
                      subtitle={ip.type}
                      detail={ip.location}
                      selected={selectedIP === ip.id}
                      onClick={() => setSelectedIP(ip.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedSurrogate || !selectedIP}
          >
            Create Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
