import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  in_review: 'bg-purple-100 text-purple-800 border-purple-200',
  published: 'bg-green-100 text-green-800 border-green-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
  matched: 'bg-abc-coral/20 text-abc-navy border-abc-coral/30',
  screening: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

export default function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', style, className)}>
      {label}
    </Badge>
  )
}
