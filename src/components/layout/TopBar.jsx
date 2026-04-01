import { useState, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { LogOut, Menu, Home, Mail, MessageSquare, Calendar } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLE_LABELS, ADMIN_ROLES } from '@/lib/constants'
import RoleSwitcher from './RoleSwitcher'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getGoogleStatus, getLabel, listEmails } from '@/lib/google'

export default function TopBar({ onMenuClick }) {
  const { currentUser, currentRole, isAuthenticated, signOut } = useRole()
  const navigate = useNavigate()
  const isAdmin = ADMIN_ROLES.includes(currentRole)
  const [inboxCount, setInboxCount] = useState(0)

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  // Fetch inbox unread count
  useEffect(() => {
    if (!isAdmin || !currentUser?.id) return
    getGoogleStatus(currentUser.id).then(async (s) => {
      if (!s.connected) return
      try {
        // Use search query to count primary inbox unread — matches Gmail's displayed count
        const data = await listEmails(currentUser.id, { query: 'in:inbox category:primary is:unread', maxResults: 1 })
        if (data.resultSizeEstimate) setInboxCount(data.resultSizeEstimate)
      } catch {}
    }).catch(() => {})
  }, [isAdmin, currentUser?.id])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const quickLinks = [
    { path: '/dashboard', icon: Home, label: 'Home', show: true, badge: 0 },
    { path: '/email', icon: Mail, label: 'Email', show: isAdmin, badge: inboxCount },
    { path: '/text-messages', icon: MessageSquare, label: 'Texts', show: isAdmin, badge: 0 },
    { path: '/calendar', icon: Calendar, label: 'Calendar', show: isAdmin, badge: 0 },
  ]

  return (
    <header className="h-14 border-b bg-abc-cream flex items-center justify-between px-4 sm:px-6">
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

      {/* Quick Links — center */}
      <nav className="hidden sm:flex items-center gap-1">
        {quickLinks.filter(l => l.show).map(link => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#283693] text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`
            }
          >
            <link.icon className="size-3.5" />
            <span>{link.label}</span>
            {link.badge > 0 && (
              <span className="bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                {link.badge > 999 ? '999+' : link.badge}
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
            className="ml-1 p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  )
}
