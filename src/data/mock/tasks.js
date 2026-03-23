import { MATCH_STAGES } from '@/lib/constants'

// 2-3 task templates per match stage
export const WORKFLOW_TASK_TEMPLATES = {
  'Profile Review': [
    { title: 'Complete profile review', category: 'admin' },
    { title: 'Verify application documents', category: 'admin' },
  ],
  'Introduction': [
    { title: 'Schedule intro call', category: 'admin' },
    { title: 'Send profile packets to both parties', category: 'admin' },
  ],
  'Meeting Scheduled': [
    { title: 'Confirm meeting date and time', category: 'admin' },
    { title: 'Send meeting preparation guide', category: 'admin' },
  ],
  'Meeting Complete': [
    { title: 'Collect feedback from both parties', category: 'admin' },
    { title: 'Assess compatibility notes', category: 'admin' },
  ],
  'Match Confirmed': [
    { title: 'Send match confirmation letters', category: 'admin' },
    { title: 'Initiate legal referral', category: 'legal' },
    { title: 'Set up escrow account', category: 'financial' },
  ],
  'Legal': [
    { title: 'Sign legal agreement', category: 'legal' },
    { title: 'Complete legal consultation', category: 'legal' },
    { title: 'Review contract terms', category: 'legal' },
  ],
  'Medical Clearance': [
    { title: 'Schedule medical screening', category: 'medical' },
    { title: 'Complete psychological evaluation', category: 'medical' },
    { title: 'Submit medical records', category: 'medical' },
  ],
  'Transfer Prep': [
    { title: 'Begin medication protocol', category: 'medical' },
    { title: 'Schedule transfer date', category: 'medical' },
    { title: 'Confirm insurance coverage', category: 'financial' },
  ],
  'Active Pregnancy': [
    { title: 'Schedule regular OB appointments', category: 'medical' },
    { title: 'Set up monthly check-in calls', category: 'admin' },
    { title: 'Review birth plan', category: 'medical' },
  ],
  'Delivered': [
    { title: 'Complete final compensation disbursement', category: 'financial' },
    { title: 'Submit post-birth legal documents', category: 'legal' },
    { title: 'Schedule post-delivery check-in', category: 'admin' },
  ],
}

export const TASK_CATEGORIES = {
  medical: { label: 'Medical', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  legal: { label: 'Legal', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  admin: { label: 'Admin', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  financial: { label: 'Financial', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  personal: { label: 'Personal', color: 'bg-amber-100 text-amber-800 border-amber-200' },
}

export const mockTasks = []
