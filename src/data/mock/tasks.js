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

// ~20 tasks across matched surrogates/IPs
export const mockTasks = [
  // s1 (Emily Carter) — Active Pregnancy, matched with ip1
  { id: 't1', profileId: 's1', profileType: 'surrogate', title: 'Schedule regular OB appointments', source: 'workflow', category: 'medical', completed: false, dueDate: '2026-03-15', createdDate: '2025-12-01', assignedBy: null },
  { id: 't2', profileId: 's1', profileType: 'surrogate', title: 'Set up monthly check-in calls', source: 'workflow', category: 'admin', completed: true, dueDate: null, createdDate: '2025-11-20', assignedBy: null },
  { id: 't3', profileId: 's1', profileType: 'surrogate', title: 'Review birth plan', source: 'workflow', category: 'medical', completed: false, dueDate: '2026-04-01', createdDate: '2026-01-10', assignedBy: null },
  { id: 't4', profileId: 's1', profileType: 'surrogate', title: 'Upload updated insurance card', source: 'staff', category: 'admin', completed: false, dueDate: '2026-03-10', createdDate: '2026-02-15', assignedBy: 'Julie S.' },

  // ip1 (Michael & James Rivera) — Active Pregnancy
  { id: 't5', profileId: 'ip1', profileType: 'ip', title: 'Schedule regular OB appointments', source: 'workflow', category: 'medical', completed: false, dueDate: '2026-03-15', createdDate: '2025-12-01', assignedBy: null },
  { id: 't6', profileId: 'ip1', profileType: 'ip', title: 'Review birth plan', source: 'workflow', category: 'medical', completed: false, dueDate: '2026-04-01', createdDate: '2026-01-10', assignedBy: null },
  { id: 't7', profileId: 'ip1', profileType: 'ip', title: 'Finalize nursery preparations', source: 'self', category: 'personal', completed: true, dueDate: null, createdDate: '2026-01-05', assignedBy: null },

  // s2 (Jessica Nguyen) — Transfer Prep, matched with ip2
  { id: 't8', profileId: 's2', profileType: 'surrogate', title: 'Begin medication protocol', source: 'workflow', category: 'medical', completed: false, dueDate: '2026-03-01', createdDate: '2026-01-10', assignedBy: null },
  { id: 't9', profileId: 's2', profileType: 'surrogate', title: 'Schedule transfer date', source: 'workflow', category: 'medical', completed: false, dueDate: '2026-03-20', createdDate: '2026-01-15', assignedBy: null },
  { id: 't10', profileId: 's2', profileType: 'surrogate', title: 'Confirm insurance coverage', source: 'workflow', category: 'financial', completed: true, dueDate: null, createdDate: '2026-01-05', assignedBy: null },

  // s5 (Lauren Davis) — Match Confirmed, matched with ip4
  { id: 't11', profileId: 's5', profileType: 'surrogate', title: 'Send match confirmation letters', source: 'workflow', category: 'admin', completed: true, dueDate: null, createdDate: '2026-01-20', assignedBy: null },
  { id: 't12', profileId: 's5', profileType: 'surrogate', title: 'Initiate legal referral', source: 'workflow', category: 'legal', completed: false, dueDate: '2026-03-05', createdDate: '2026-01-22', assignedBy: null },
  { id: 't13', profileId: 's5', profileType: 'surrogate', title: 'Set up escrow account', source: 'workflow', category: 'financial', completed: false, dueDate: '2026-03-10', createdDate: '2026-01-22', assignedBy: null },

  // s10 (Rachel White) — Legal, matched with ip7
  { id: 't14', profileId: 's10', profileType: 'surrogate', title: 'Sign legal agreement', source: 'workflow', category: 'legal', completed: false, dueDate: '2026-03-15', createdDate: '2025-12-10', assignedBy: null },
  { id: 't15', profileId: 's10', profileType: 'surrogate', title: 'Complete legal consultation', source: 'workflow', category: 'legal', completed: true, dueDate: null, createdDate: '2025-12-10', assignedBy: null },
  { id: 't16', profileId: 's10', profileType: 'surrogate', title: 'Review contract terms', source: 'workflow', category: 'legal', completed: false, dueDate: '2026-03-08', createdDate: '2025-12-15', assignedBy: null },

  // ip7 (Patricia & Mark Wilson) — Legal
  { id: 't17', profileId: 'ip7', profileType: 'ip', title: 'Sign legal agreement', source: 'workflow', category: 'legal', completed: false, dueDate: '2026-03-15', createdDate: '2025-12-10', assignedBy: null },
  { id: 't18', profileId: 'ip7', profileType: 'ip', title: 'Set up escrow account', source: 'staff', category: 'financial', completed: false, dueDate: '2026-03-20', createdDate: '2026-01-05', assignedBy: 'Nicole M.' },

  // s6 (Brittany Moore) — Introduction, matched with ip5
  { id: 't19', profileId: 's6', profileType: 'surrogate', title: 'Schedule intro call', source: 'workflow', category: 'admin', completed: true, dueDate: null, createdDate: '2026-02-01', assignedBy: null },
  { id: 't20', profileId: 's6', profileType: 'surrogate', title: 'Send profile packets to both parties', source: 'workflow', category: 'admin', completed: false, dueDate: '2026-03-05', createdDate: '2026-02-01', assignedBy: null },

  // ip4 (Emma & Lisa Park) — Match Confirmed
  { id: 't21', profileId: 'ip4', profileType: 'ip', title: 'Send match confirmation letters', source: 'workflow', category: 'admin', completed: true, dueDate: null, createdDate: '2026-01-20', assignedBy: null },
  { id: 't22', profileId: 'ip4', profileType: 'ip', title: 'Initiate legal referral', source: 'workflow', category: 'legal', completed: false, dueDate: '2026-03-05', createdDate: '2026-01-22', assignedBy: null },
  { id: 't23', profileId: 'ip4', profileType: 'ip', title: 'Review financial plan', source: 'staff', category: 'financial', completed: false, dueDate: '2026-03-12', createdDate: '2026-02-01', assignedBy: 'Julie S.' },
]
