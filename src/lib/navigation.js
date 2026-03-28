import {
  LayoutDashboard,
  Users,
  Heart,
  GitMerge,
  FileText,
  ClipboardList,
  FolderOpen,
  PenTool,
  MessageSquare,
  Mail,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  Clock,
  CreditCard,
  UserCog,
  Shield,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react'
import { ROLES, ADMIN_ROLES } from './constants'

const nav = [
  {
    section: 'Overview',
    items: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        roles: 'all',
      },
    ],
  },
  {
    section: 'Client Management',
    roles: ADMIN_ROLES,
    items: [
      {
        label: 'Surrogates',
        icon: Heart,
        path: '/surrogates',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Intended Parents',
        icon: Users,
        path: '/intended-parents',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Matching',
        icon: GitMerge,
        path: '/matching',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Matched Journeys',
        icon: Heart,
        path: '/journeys',
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    section: 'Forms & Documents',
    items: [
      {
        label: 'Forms',
        icon: FileText,
        path: '/forms',
        roles: 'all',
      },
      {
        label: 'Documents',
        icon: FolderOpen,
        path: '/documents',
        roles: 'all',
      },
      {
        label: 'E-Signature',
        icon: PenTool,
        path: '/e-signature',
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    section: 'Communication',
    items: [
      {
        label: 'Messages',
        icon: MessageSquare,
        path: '/messages',
        roles: 'all',
      },
      {
        label: 'Email',
        icon: Mail,
        path: '/email',
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    section: 'Operations',
    roles: ADMIN_ROLES,
    items: [
      {
        label: 'Calendar',
        icon: Calendar,
        path: '/calendar',
        roles: ADMIN_ROLES,
      },
      {
        label: 'HR Management',
        icon: UserCog,
        path: '/hr',
        roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
      },
      {
        label: 'Time Clock',
        icon: Clock,
        path: '/time-clock',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Payroll',
        icon: CreditCard,
        path: '/payroll',
        roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
      },
    ],
  },
  {
    section: 'Finance',
    roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
    items: [
      {
        label: 'Financials',
        icon: DollarSign,
        path: '/financials',
        roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
      },
      {
        label: 'Reports',
        icon: BarChart3,
        path: '/reports',
        roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
      },
    ],
  },
  {
    section: 'Intake',
    roles: ADMIN_ROLES,
    items: [
      {
        label: 'Applications',
        icon: ClipboardCheck,
        path: '/intake',
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    section: 'Marketing',
    roles: [ROLES.MARKETING, ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN],
    items: [
      {
        label: 'Analytics',
        icon: TrendingUp,
        path: '/marketing',
        roles: [ROLES.MARKETING, ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN],
      },
    ],
  },
  {
    section: 'Admin',
    roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
    items: [
      {
        label: 'Settings',
        icon: Settings,
        path: '/settings',
        roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN],
      },
      {
        label: 'System',
        icon: Shield,
        path: '/system',
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },
  {
    section: 'My Journey',
    roles: [ROLES.SURROGATE, ROLES.SURROGATE_PARTNER, ROLES.INTENDED_PARENT],
    items: [
      {
        label: 'My Profile',
        icon: Users,
        path: '/my-profile',
        roles: [ROLES.SURROGATE, ROLES.INTENDED_PARENT],
      },
      {
        label: 'Appointments',
        icon: Calendar,
        path: '/appointments',
        roles: [ROLES.SURROGATE, ROLES.SURROGATE_PARTNER, ROLES.INTENDED_PARENT],
      },
    ],
  },
]

export function getNavForRole(role) {
  // Marketing role only sees the Marketing section
  if (role === ROLES.MARKETING) {
    return nav
      .filter(section => section.roles && section.roles.includes(ROLES.MARKETING))
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.roles.includes(ROLES.MARKETING)),
      }))
      .filter(section => section.items.length > 0)
  }

  return nav
    .filter(section => {
      if (!section.roles) return true
      if (section.roles === 'all') return true
      return section.roles.includes(role)
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.roles === 'all') return true
        return item.roles.includes(role)
      }),
    }))
    .filter(section => section.items.length > 0)
}
