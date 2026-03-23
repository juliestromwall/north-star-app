import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/constants'
import { getNavForRole } from '@/lib/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { fetchUserTasks } from '@/lib/db'

const BABIES_BORN = 220

function SidebarContent({ sections, pendingCount, showBabiesBorn }) {
  return (
    <>
      <div className="flex items-center justify-center px-4 py-4 bg-white">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-18 w-auto" />
      </div>
      <ScrollArea className="flex-1 min-h-0">
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
                    {item.path === '/' && pendingCount > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#ed148c] text-white text-[10px] font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
      {showBabiesBorn && (
        <div className="flex items-center justify-center gap-2 py-4 border-t border-sidebar-foreground/10 text-abc-coral">
          <Baby className="size-4" />
          <span className="text-sm font-semibold">{BABIES_BORN}</span>
        </div>
      )}
    </>
  )
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { currentRole, currentUser, isAuthenticated } = useRole()
  const sections = getNavForRole(currentRole)
  const showBabiesBorn = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN].includes(currentRole)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    fetchUserTasks(currentUser.id).then(tasks => {
      setPendingCount((tasks || []).filter(t => t.status === 'pending').length)
    }).catch(() => {})
  }, [isAuthenticated, currentUser?.id])

  const sharedProps = { sections, pendingCount, showBabiesBorn }

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-60 bg-sidebar text-sidebar-foreground flex-col shrink-0">
        <SidebarContent {...sharedProps} />
      </aside>

      {/* Mobile sidebar — sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-60 p-0 bg-sidebar text-sidebar-foreground border-none flex flex-col">
          <SidebarContent {...sharedProps} />
        </SheetContent>
      </Sheet>
    </>
  )
}
