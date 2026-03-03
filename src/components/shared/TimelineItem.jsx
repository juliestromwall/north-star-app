import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TYPE_STYLES = {
  milestone: 'bg-abc-indigo/10 text-abc-indigo border-abc-indigo/20',
  screening: 'bg-amber-100 text-amber-800 border-amber-200',
  match: 'bg-abc-coral/20 text-abc-navy border-abc-coral/30',
  medical: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export default function TimelineItem({ date, event, type, isLast }) {
  const typeStyle = TYPE_STYLES[type] || TYPE_STYLES.milestone

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="size-3 rounded-full bg-abc-indigo ring-4 ring-abc-indigo/10 mt-1.5" />
        {!isLast && <div className="w-px flex-1 bg-border mt-2" />}
      </div>
      <div className={cn('pb-6', isLast && 'pb-0')}>
        <p className="text-xs text-muted-foreground">
          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <p className="text-sm font-medium mt-0.5">{event}</p>
        <Badge variant="outline" className={cn('text-[10px] mt-1.5', typeStyle)}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Badge>
      </div>
    </div>
  )
}
