import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const PASTEL_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
  'bg-lime-100 text-lime-700',
]

const SIZE_CLASSES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getColorFromName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length]
}

export default function ProfileAvatar({ name, avatar, size = 'md', className }) {
  const initials = getInitials(name)
  const colorClass = getColorFromName(name)
  const sizeClass = SIZE_CLASSES[size]

  return (
    <Avatar className={cn(sizeClass, className)}>
      {avatar && <AvatarImage src={avatar} alt={name} />}
      <AvatarFallback className={cn(colorClass, 'font-semibold')}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
