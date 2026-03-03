import { CheckCircle, Clock, XCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  cleared: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Cleared',
  },
  approved: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Approved',
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    label: 'Pending',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    label: 'Failed',
  },
  not_started: {
    icon: Circle,
    color: 'text-gray-400',
    bg: 'bg-gray-50',
    label: 'Not Started',
  },
}

export default function ScreeningStatusItem({ label, status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started
  const Icon = config.icon

  return (
    <div className={cn('flex items-center justify-between rounded-lg px-3 py-2.5', config.bg)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', config.color)} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
    </div>
  )
}
