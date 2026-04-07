import {
  LayoutDashboard,
  Users,
  Heart,
  HeartHandshake,
  Puzzle,
  Route,
  PenLine,
  MessagesSquare,
  Mail,
  Calendar,
  Settings,
  Shield,
  ClipboardCheck,
  TrendingUp,
  Printer,
  ShieldCheck,
  CreditCard,
  Upload,
  FileText,
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
    section: 'Inbox',
    roles: ADMIN_ROLES,
    items: [
      {
        label: 'Email',
        icon: Mail,
        path: '/email',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Text Message',
        icon: MessagesSquare,
        path: '/text-messages',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Fax',
        icon: Printer,
        path: '/fax',
        roles: ADMIN_ROLES,
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
        icon: HeartHandshake,
        path: '/intended-parents',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Matching',
        icon: Puzzle,
        path: '/matching',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Matched Journeys',
        icon: Route,
        path: '/journeys',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Case Updates',
        icon: ClipboardCheck,
        path: '/case-updates',
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    section: 'Operations',
    roles: ADMIN_ROLES,
    items: [
      {
        label: 'E-Signature',
        icon: PenLine,
        path: '/e-signature',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Insurance',
        icon: ShieldCheck,
        path: '/insurance',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Expense Tracking',
        icon: CreditCard,
        path: '/expenses',
        roles: ADMIN_ROLES,
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
        label: 'Case Import',
        icon: Upload,
        path: '/case-import',
        roles: [ROLES.SUPER_ADMIN],
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
        label: 'Documents',
        icon: FileText,
        path: '/my-documents',
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
