import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const MODULE_DESCRIPTIONS = {
  '/surrogates': 'Manage surrogate profiles, applications, screening status, and journey progress.',
  '/intended-parents': 'Manage intended parent profiles, applications, and preferences.',
  '/matching': 'Match queue and pipeline — pair surrogates with intended parents through a guided process.',
  '/crm': 'Case management with contact history, notes, tasks, and follow-ups.',
  '/documents': 'Centralized document storage with role-based access and version control.',
  '/e-signature': 'Send, track, and manage electronic signatures on legal documents.',
  '/messages': 'Internal messaging between staff, surrogates, and intended parents.',
  '/email': 'Email templates and campaign management for client communications.',
  '/calendar': 'Shared calendar for appointments, transfers, due dates, and milestones.',
  '/hr': 'Employee management, onboarding, performance reviews, and org structure.',
  '/time-clock': 'Employee time tracking with clock-in/out, timesheets, and approvals.',
  '/payroll': 'Payroll processing, pay stubs, tax forms, and compensation management.',
  '/financials': 'Trust accounts, escrow tracking, invoicing, and financial dashboards.',
  '/reports': 'Analytics and reporting across all modules — KPIs, trends, and exports.',
  '/settings': 'Agency settings, role permissions, notification preferences, and integrations.',
  '/system': 'System administration, audit logs, feature flags, and developer tools.',
  '/my-profile': 'View and edit your profile information, preferences, and documents.',
  '/my-match': 'View your current match, shared information, and journey milestones.',
  '/appointments': 'Your upcoming and past appointments, with scheduling and reminders.',
}

export default function StubPage({ path, title }) {
  const description = MODULE_DESCRIPTIONS[path] || 'This module is under development.'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">Coming soon</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-16 rounded-full bg-abc-coral/20 flex items-center justify-center mb-4">
            <Construction className="size-8 text-abc-indigo" />
          </div>
          <h2 className="text-lg font-heading font-semibold mb-2">Module Under Development</h2>
          <p className="text-muted-foreground max-w-md">{description}</p>
        </CardContent>
      </Card>
    </div>
  )
}
