import { useState, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { LogOut, Menu, Home, Mail, MessageSquare, Calendar } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { ROLE_LABELS, ADMIN_ROLES } from '@/lib/constants'
import RoleSwitcher from './RoleSwitcher'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function TopBar({ onMenuClick }) {
  const { currentUser, currentRole, isAuthenticated, signOut } = useRole()
  const navigate = useNavigate()
  const isAdmin = ADMIN_ROLES.includes(currentRole)

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const quickLinks = [
    { path: '/dashboard', icon: Home, label: 'Home', show: true },
    { path: '/email', icon: Mail, label: 'Email', show: isAdmin },
    { path: '/text-messages', icon: MessageSquare, label: 'Texts', show: isAdmin },
    { path: '/calendar', icon: Calendar, label: 'Calendar', show: isAdmin },
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
