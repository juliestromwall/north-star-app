import {
  LayoutDashboard,
  Users,
  Heart,
  HeartHandshake,
  Puzzle,
  Route,
  PenLine,
  MessagesSquare,
  MessageCircle,
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
  Gift,
  Brain,
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
        label: 'Team Chats',
        icon: MessageCircle,
        path: '/team-chats',
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
        label: 'Insurance Tracking',
        icon: ShieldCheck,
        path: '/insurance',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Therapist Tracking',
        icon: Brain,
        path: '/therapist-tracking',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Expense Tracking',
        icon: CreditCard,
        path: '/expenses',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Referrals & Incentives',
        icon: Gift,
        path: '/referral-bonus-tracker',
        roles: ADMIN_ROLES,
      },
      {
        label: 'Records Summary',
        icon: ClipboardCheck,
        path: '/records-summary',
        roles: [...ADMIN_ROLES, ROLES.RECORDS_ADMIN],
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
    roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.OFFICE_ADMIN],
    items: [
      {
        label: 'Settings',
        icon: Settings,
        path: '/settings',
        roles: [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.OFFICE_ADMIN],
      },
      {
        label: 'Case Import',
        icon: Upload,
        path: '/case-import',
        roles: [ROLES.SUPER_ADMIN],
        emails: ['intake@northstarsurrogacy.com'],
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
        label: 'My Application',
        icon: ClipboardCheck,
        path: '/my-application',
        roles: [ROLES.SURROGATE],
      },
      {
        label: 'Documents',
        icon: FileText,
        path: '/my-documents',
        roles: [ROLES.SURROGATE, ROLES.INTENDED_PARENT],
      },
      // {
      //   label: 'Appointments',
      //   icon: Calendar,
      //   path: '/appointments',
      //   roles: [ROLES.SURROGATE, ROLES.SURROGATE_PARTNER, ROLES.INTENDED_PARENT],
      // },
    ],
  },
]

export function getNavForRole(role, email) {
  const emailLc = (email || '').trim().toLowerCase()
  const itemAllowed = (item) => {
    if (item.roles === 'all') return true
    if (Array.isArray(item.emails) && emailLc && item.emails.some(e => e.toLowerCase() === emailLc)) return true
    return item.roles.includes(role)
  }
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
      if (section.roles.includes(role)) return true
      // Keep section visible if any item inside is allowed for this email
      return section.items.some(item => Array.isArray(item.emails) && emailLc && item.emails.some(e => e.toLowerCase() === emailLc))
    })
    .map(section => ({
      ...section,
      items: section.items.filter(itemAllowed),
    }))
    .filter(section => section.items.length > 0)
}
