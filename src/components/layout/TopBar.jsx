import { useState, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { LogOut, Menu, Mail, MessagesSquare, Calendar, Moon, Sun } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLE_LABELS, ADMIN_ROLES } from '@/lib/constants'
import RoleSwitcher from './RoleSwitcher'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getGoogleStatus, getLabel } from '@/lib/google'
import { fetchSMSMessages } from '@/lib/sms'
import { getUnreadSMSCount } from '@/lib/smsReadState'

export default function TopBar({ onMenuClick }) {
  const { currentUser, currentRole, isAuthenticated, signOut } = useRole()
  const navigate = useNavigate()
  const isAdmin = ADMIN_ROLES.includes(currentRole)
  const [inboxCount, setInboxCount] = useState(0)
  const [hasUnreadSMS, setHasUnreadSMS] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('abc_dark_mode') === 'true' || document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('abc_dark_mode', dark)
  }, [dark])

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  useEffect(() => {
    if (!isAdmin || !currentUser?.id) return
    getGoogleStatus(currentUser.id).then(async (s) => {
      if (!s.connected) return
      try {
        const label = await getLabel(currentUser.id, 'INBOX')
        if (label?.messagesUnread) setInboxCount(label.messagesUnread)
      } catch {}
    }).catch(() => {})
  }, [isAdmin, currentUser?.id])

  useEffect(() => {
    if (!isAdmin || !isAuthenticated) return
    const check = () => {
      fetchSMSMessages()
        .then(data => {
          const inboundSids = (data.messages || []).filter(m => m.direction === 'inbound').map(m => m.sid)
          setHasUnreadSMS(getUnreadSMSCount(inboundSids) > 0)
        })
        .catch(() => {})
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [isAdmin, isAuthenticated])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const quickLinks = [
    { path: '/email', icon: Mail, title: 'Email', show: isAdmin, badge: inboxCount },
    { path: '/text-messages', icon: MessagesSquare, title: 'Texts', show: isAdmin, badge: 0, pulse: hasUnreadSMS },
    { path: '/calendar', icon: Calendar, title: 'Calendar', show: isAdmin, badge: 0 },
  ]

  return (
    <header className="h-14 border-b bg-abc-cream dark:bg-[#141420] dark:border-[#2a2a38] flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 -ml-1 rounded-md text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <RoleSwitcher />
      </div>

      {/* Quick Links — icon only with magnify */}
      <nav className="hidden sm:flex items-center gap-2">
        {quickLinks.filter(l => l.show).map(link => (
          <NavLink
            key={link.path}
            to={link.path}
            title={link.title}
            className={({ isActive }) =>
              `topbar-icon relative flex items-center justify-center size-9 rounded-xl transition-colors ${
                isActive
                  ? 'sidebar-nav-active text-abc-indigo'
                  : 'text-stone-400 hover:text-abc-indigo hover:bg-stone-100'
              }`
            }
          >
            <link.icon className="size-[18px]" />
            {link.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                {link.badge > 999 ? '999+' : link.badge}
              </span>
            )}
            {link.pulse && (
              <span className="absolute top-0.5 right-0.5 flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-pink-500" />
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-none">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]}</p>
        </div>
        <Avatar className="size-8">
          {currentUser.avatar && <AvatarImage src={currentUser.avatar} alt={currentUser.name} />}
          <AvatarFallback className="bg-abc-indigo text-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isAuthenticated && (
          <button
            onClick={handleSignOut}
            className="ml-1 p-1.5 rounded-md text-stone-400 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-300 hover:bg-stone-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  )
}
