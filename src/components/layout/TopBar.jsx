import { useRole } from '@/context/RoleContext'
import { ROLE_LABELS } from '@/lib/constants'
import RoleSwitcher from './RoleSwitcher'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function TopBar() {
  const { currentUser } = useRole()

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  return (
    <header className="h-14 border-b bg-abc-cream flex items-center justify-between px-6">
      <RoleSwitcher />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium leading-none">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]}</p>
        </div>
        <Avatar className="size-8">
          <AvatarFallback className="bg-abc-indigo text-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
