import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { NAV_ICON_MAP } from './NavIcons'
import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/constants'
import { getNavForRole } from '@/lib/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { fetchUserTasks, getAppConfig } from '@/lib/db'
import { fetchSMSMessages } from '@/lib/sms'
import { getUnreadSMSCount } from '@/lib/smsReadState'
import { getGoogleStatus, getLabel } from '@/lib/google'
import { listFaxes } from '@/lib/fax'
import { getUnreadFaxCount } from '@/lib/faxState'

const BABIES_BORN = 220

function UnreadDot() {
  return (
    <span className="relative flex size-2 ml-auto">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A853] opacity-75" />
      <span className="relative inline-flex rounded-full size-2 bg-[#D4A853]" />
    </span>
  )
}

function Badge({ children }) {
  return (
    <span className="ml-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-abc-indigo/10 text-abc-indigo">
      {children}
    </span>
  )
}

function SidebarContent({ sections, pendingCount, showBabiesBorn, unreadSMS, unreadEmail, unreadFax, collapsed, onToggle }) {
  return (
    <>
      {/* Logo — click to collapse/expand on desktop */}
      {onToggle ? (
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center shrink-0 cursor-pointer transition-all hover:bg-stone-50/60 w-full',
            collapsed ? 'px-2 py-4' : 'px-5 py-5'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <img src="/north-star-mark.png" alt="North Star Surrogacy" className="h-8 w-auto object-contain" />
          ) : (
            <img src="/north-star-logo-sidebar.svg" alt="North Star Surrogacy" className="w-full h-auto" />
          )}
        </button>
      ) : (
        <div className="flex items-center justify-center shrink-0 px-5 py-5">
          <img src="/north-star-logo-sidebar.svg" alt="North Star Surrogacy" className="w-full h-auto" />
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className={cn('py-2', collapsed ? 'px-1.5' : 'px-2.5')}>
          {sections.map((section, sIdx) => (
            <div key={section.section} className={cn(sIdx > 0 && 'mt-3')}>
              {/* Gradient fade divider */}
              {sIdx > 0 && <div className="sidebar-section-divider mb-3" />}
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-abc-indigo/50">
                  {section.section}
                </p>
              )}

              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'dock-nav-item group relative flex items-center rounded-xl text-[13px] font-medium',
                        collapsed ? 'justify-center px-2 py-2.5 mx-auto' : 'gap-3 px-3 py-2',
                        isActive
                          ? 'sidebar-nav-active text-abc-indigo dark:text-white font-semibold'
                          : 'sidebar-nav-item text-stone-500 dark:text-stone-400'
                      )
                    }
                  >
                    {({ isActive }) => {
                      const CustomIcon = NAV_ICON_MAP[item.path]
                      const IconComp = CustomIcon || item.icon
                      // Short labels for GC and IP
                      const label = item.path === '/surrogates' ? 'Surrogates'
                        : item.path === '/intended-parents' ? 'Intended Parents'
                        : item.label
                      return (
                      <>
                        <IconComp className={cn(
                          'nav-icon shrink-0 transition-all duration-250',
                          collapsed ? 'size-5' : 'size-[22px]',
                          isActive
                            ? 'text-abc-indigo dark:text-white'
                            : 'text-stone-400 group-hover:text-abc-indigo dark:group-hover:text-white'
                        )} />
                        {!collapsed && (
                          <>
                            <span>{label}</span>
                            {item.path === '/' && pendingCount > 0 && (
                              <Badge>{pendingCount}</Badge>
                            )}
                            {item.path === '/email' && unreadEmail > 0 && (
                              <Badge>{unreadEmail.toLocaleString()}</Badge>
                            )}
                            {item.path === '/text-messages' && unreadSMS > 0 && <UnreadDot />}
                            {item.path === '/fax' && unreadFax > 0 && (
                              <Badge>{unreadFax}</Badge>
                            )}
                          </>
                        )}
                        {collapsed && (
                          <>
                            {item.path === '/text-messages' && unreadSMS > 0 && (
                              <span className="absolute top-1 right-1 size-2 rounded-full bg-[#D4A853]" />
                            )}
                            {item.path === '/email' && unreadEmail > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-abc-indigo text-white text-[9px] font-bold">
                                {unreadEmail > 99 ? '99+' : unreadEmail}
                              </span>
                            )}
                            {item.path === '/fax' && unreadFax > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-abc-indigo text-white text-[9px] font-bold">
                                {unreadFax}
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="shrink-0 border-t border-stone-100 dark:border-[#2a2a38]">
        {showBabiesBorn && (
          <NavLink
            to="/babies-born"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center gap-2 py-3 transition-colors',
                isActive ? 'text-abc-indigo bg-stone-50' : 'text-stone-400 hover:text-abc-indigo'
              )
            }
          >
            <Baby className="size-4" />
            {!collapsed && (
              <span className="text-sm font-semibold">
                {(() => { try { const d = JSON.parse(localStorage.getItem('abc_babies_born')); return d?.years?.reduce((s, y) => s + (y.births || 0), 0) } catch {} return BABIES_BORN })()}
              </span>
            )}
          </NavLink>
        )}
      </div>
    </>
  )
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { currentRole, currentUser, isAuthenticated } = useRole()
  const sections = getNavForRole(currentRole, currentUser?.email)
  const showBabiesBorn = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN].includes(currentRole)
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadSMS, setUnreadSMS] = useState(0)
  const [unreadEmail, setUnreadEmail] = useState(0)
  const [unreadFax, setUnreadFax] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    fetchUserTasks(currentUser.id).then(tasks => {
      setPendingCount((tasks || []).filter(t => t.status === 'pending').length)
    }).catch(() => {})
  }, [isAuthenticated, currentUser?.id])

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    let cancelled = false
    let interval
    getAppConfig(`user_prefs_${currentUser.id}`).then(prefs => {
      const myPhone = prefs?.twilioPhone
      if (!myPhone || cancelled) return // no Twilio hooked up for this user — no dot/count
      const checkUnread = () => {
        fetchSMSMessages(null, [myPhone])
          .then(data => {
            const inboundSids = (data.messages || []).filter(m => m.direction === 'inbound').map(m => m.sid)
            setUnreadSMS(getUnreadSMSCount(inboundSids))
          })
          .catch(() => {})
      }
      checkUnread()
      interval = setInterval(checkUnread, 60000)
    }).catch(() => {})
    return () => { cancelled = true; if (interval) clearInterval(interval) }
  }, [isAuthenticated, currentUser?.id])

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    const checkEmail = () => {
      getGoogleStatus(currentUser.id)
        .then(status => {
          if (!status.connected) return
          return getLabel(currentUser.id, 'CATEGORY_PERSONAL')
        })
        .then(label => {
          if (!label) return
          setUnreadEmail(label.messagesUnread || 0)
        })
        .catch(() => {})
    }
    checkEmail()
    const interval = setInterval(checkEmail, 120000)
    return () => clearInterval(interval)
  }, [isAuthenticated, currentUser?.id])

  useEffect(() => {
    if (!isAuthenticated) return
    const checkFax = () => {
      listFaxes('IN', 'ALL')
        .then(data => {
          const fileNames = (data.faxes || []).map(f => f.FileName)
          setUnreadFax(getUnreadFaxCount(fileNames))
        })
        .catch(() => {})
    }
    checkFax()
    const interval = setInterval(checkFax, 120000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const sharedProps = { sections, pendingCount, showBabiesBorn, unreadSMS, unreadEmail, unreadFax }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 bg-white dark:bg-[#141420] border-r border-stone-200/80 dark:border-[#2a2a38] transition-all duration-200',
          collapsed ? 'w-[60px]' : 'w-[220px]'
        )}
      >
        <SidebarContent {...sharedProps} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-[260px] p-0 border-none flex flex-col bg-white dark:bg-[#141420]">
          <SidebarContent {...sharedProps} collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
