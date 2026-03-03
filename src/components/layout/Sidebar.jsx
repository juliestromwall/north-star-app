import { NavLink } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { getNavForRole } from '@/lib/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const { currentRole } = useRole()
  const sections = getNavForRole(currentRole)

  return (
    <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
      <div className="h-14 flex items-center px-6 border-b border-sidebar-border">
        <span className="font-heading font-bold text-lg text-white tracking-tight">
          ABC Surrogacy
        </span>
      </div>
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
