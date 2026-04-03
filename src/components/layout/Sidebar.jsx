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
import { fetchSMSMessages } from '@/lib/sms'
import { getUnreadSMSCount } from '@/lib/smsReadState'
import { getGoogleStatus, getLabel } from '@/lib/google'
import { listFaxes } from '@/lib/fax'
import { getUnreadFaxCount } from '@/lib/faxState'

const BABIES_BORN = 220

function UnreadDot() {
  return (
    <span className="relative flex size-2.5 ml-auto">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
      <span className="relative inline-flex rounded-full size-2.5 bg-pink-500" />
    </span>
  )
}

function SidebarContent({ sections, pendingCount, showBabiesBorn, unreadSMS, unreadEmail, unreadFax }) {
  return (
    <>
      <div className="flex items-center justify-center px-4 py-5" style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-16 w-auto" />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-3 space-y-5">
          {sections.map(section => (
            <div key={section.section}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                {section.section}
              </p>
              <div className="space-y-1">
                {section.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all',
                        isActive
                          ? 'text-white font-semibold shadow-lg'
                          : 'text-white/65 hover:text-white hover:bg-white/10'
                      )
                    }
                    style={({ isActive }) => isActive ? {
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    } : {}}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                    {item.path === '/' && pendingCount > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#ed148c] text-white text-[10px] font-bold">
                        {pendingCount}
                      </span>
                    )}
                    {item.path === '/email' && unreadEmail > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/25 text-white text-[10px] font-bold backdrop-blur-sm">
                        {unreadEmail.toLocaleString()}
                      </span>
                    )}
                    {item.path === '/text-messages' && unreadSMS > 0 && <UnreadDot />}
                    {item.path === '/fax' && unreadFax > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/25 text-white text-[10px] font-bold backdrop-blur-sm">
                        {unreadFax}
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
        <NavLink
          to="/babies-born"
          className={({ isActive }) =>
            `flex items-center justify-center gap-2 py-4 transition-colors cursor-pointer ${isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'}`
          }
        >
          <Baby className="size-4" />
          <span className="text-sm font-semibold">{(() => { try { const d = JSON.parse(localStorage.getItem('abc_babies_born')); return d?.years?.reduce((s, y) => s + (y.births || 0), 0) } catch {} return BABIES_BORN })()}</span>
        </NavLink>
      )}
    </>
  )
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { currentRole, currentUser, isAuthenticated } = useRole()
  const sections = getNavForRole(currentRole)
  const showBabiesBorn = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN].includes(currentRole)
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadSMS, setUnreadSMS] = useState(0)
  const [unreadEmail, setUnreadEmail] = useState(0)
  const [unreadFax, setUnreadFax] = useState(0)

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return
    fetchUserTasks(currentUser.id).then(tasks => {
      setPendingCount((tasks || []).filter(t => t.status === 'pending').length)
    }).catch(() => {})
  }, [isAuthenticated, currentUser?.id])

  // Check for unread SMS periodically
  useEffect(() => {
    if (!isAuthenticated) return
    const checkUnread = () => {
      fetchSMSMessages()
        .then(data => {
          const inboundSids = (data.messages || []).filter(m => m.direction === 'inbound').map(m => m.sid)
          setUnreadSMS(getUnreadSMSCount(inboundSids))
        })
        .catch(() => {})
    }
    checkUnread()
    const interval = setInterval(checkUnread, 60000) // check every 60s
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Fetch unread email count
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
    const interval = setInterval(checkEmail, 120000) // check every 2 min
    return () => clearInterval(interval)
  }, [isAuthenticated, currentUser?.id])

  // Check for unread faxes
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
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-60 flex-col shrink-0 border-r border-white/20" style={{ background: 'linear-gradient(135deg, rgba(40,54,147,0.92) 0%, rgba(75,50,140,0.9) 50%, rgba(237,20,140,0.85) 100%)', backdropFilter: 'blur(20px)' }}>
        <SidebarContent {...sharedProps} />
      </aside>

      {/* Mobile sidebar — sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-60 p-0 border-none flex flex-col" style={{ background: 'linear-gradient(135deg, rgba(40,54,147,0.92) 0%, rgba(75,50,140,0.9) 50%, rgba(237,20,140,0.85) 100%)', backdropFilter: 'blur(20px)' }}>
          <SidebarContent {...sharedProps} />
        </SheetContent>
      </Sheet>
    </>
  )
}
