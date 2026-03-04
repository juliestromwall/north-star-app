import { Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ProfileAvatar from '@/components/shared/ProfileAvatar'

export default function MatchCard({ match, surrogate, ip, onClick }) {
  const startLabel = match.startDate
    ? new Date(match.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const dueLabel = match.dueDate
    ? `Due ${new Date(match.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : null

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="space-y-3">
        {/* Surrogate */}
        <div className="flex items-center gap-2">
          <ProfileAvatar name={surrogate.name} size="sm" />
          <span className="text-sm font-medium truncate">{surrogate.name}</span>
        </div>

        {/* Heart connector */}
        <div className="flex justify-center">
          <Heart className="size-4 text-rose-400 fill-rose-400" />
        </div>

        {/* IP */}
        <div className="flex items-center gap-2">
          <ProfileAvatar name={ip.names} size="sm" />
          <span className="text-sm font-medium truncate">{ip.names}</span>
        </div>

        {/* Date info */}
        <div className="text-xs text-muted-foreground">
          {dueLabel || (startLabel && `Started ${startLabel}`)}
        </div>
      </CardContent>
    </Card>
  )
}
