import { NavLink } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/constants'
import { getNavForRole } from '@/lib/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const BABIES_BORN = 220

export default function Sidebar() {
  const { currentRole } = useRole()
  const sections = getNavForRole(currentRole)
  const showBabiesBorn = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN].includes(currentRole)

  return (
    <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
      <div className="flex items-center justify-center px-4 py-4 bg-white rounded-b-lg">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-18 w-auto" />
      </div>
      {showBabiesBorn && (
        <div className="flex items-center justify-center gap-2 py-3 text-abc-coral">
          <Baby className="size-4" />
          <span className="text-sm font-semibold">{BABIES_BORN}</span>
        </div>
      )}
      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-6">
          {sections.map(section => (
            <div key={section.section}>
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-white font-medium'
                          : 'text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50'
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  )
}
