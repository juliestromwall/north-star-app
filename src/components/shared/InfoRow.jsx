import { cn } from '@/lib/utils'

export default function InfoRow({ icon: Icon, label, value, className }) {
  return (
    <div className={cn('flex items-center justify-between py-2', className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-4" />}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  )
}
