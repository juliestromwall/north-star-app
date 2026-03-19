import { useRole } from '@/context/RoleContext'
import { ROLES, ROLE_LABELS } from '@/lib/constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield } from 'lucide-react'

export default function RoleSwitcher() {
  const { currentRole, setCurrentRole, isSuperAdmin, isAuthenticated } = useRole()

  // Only super admins (and unauthenticated dev mode) can switch roles
  if (isAuthenticated && !isSuperAdmin) return null

  return (
    <div className="flex items-center gap-2">
      <Shield className="size-4 text-muted-foreground" />
      <Select value={currentRole} onValueChange={setCurrentRole}>
        <SelectTrigger className="w-[180px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROLES).map(([key, value]) => (
            <SelectItem key={value} value={value} className="text-xs">
              {ROLE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
