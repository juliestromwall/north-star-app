export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MASTER_ADMIN: 'master_admin',
  ADMIN: 'admin',
  SURROGATE: 'surrogate',
  SURROGATE_PARTNER: 'surrogate_partner',
  INTENDED_PARENT: 'intended_parent',
  MARKETING: 'marketing',
}

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.MASTER_ADMIN]: 'Master Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SURROGATE]: 'Surrogate',
  [ROLES.SURROGATE_PARTNER]: 'Surrogate Partner',
  [ROLES.INTENDED_PARENT]: 'Intended Parent',
  [ROLES.MARKETING]: 'Marketing',
}

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.ADMIN]

export const MATCH_STAGES = [
  'Profile Review',
  'Introduction',
  'Meeting Scheduled',
  'Meeting Complete',
  'Match Confirmed',
  'Legal',
  'Medical Clearance',
  'Transfer Prep',
  'Active Pregnancy',
  'Delivered',
]

export const APPLICATION_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const FORM_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
}

export const INTAKE_STATUSES = {
  PENDING_REVIEW: 'pending_review',
  QUALIFIED: 'qualified',
  DISQUALIFIED: 'disqualified',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const INTAKE_TYPES = {
  GC: 'gc',
  IP: 'ip',
}

export const MARKETING_ROLES = [ROLES.MARKETING, ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN]

// ── Surrogate Journey Stages ──────────────────────────────
export const SURROGATE_STAGES = [
  { id: 'pre-qualification', label: 'Pre-Qualification', color: '#ed148c', order: 1 },
  { id: 'screening',         label: 'Screening',         color: '#c4219a', order: 2 },
  { id: 'matching',          label: 'Matching',           color: '#9b2ea7', order: 3 },
  { id: 'journey-oversight',  label: 'Matched Journey',    color: '#723bb4', order: 4 },
]

// IP-specific stage label overrides
export const IP_STAGE_LABELS = {
  'pre-qualification': 'Screening',
  'screening': 'Holding',
}

export const DEFAULT_STATUSES_BY_STAGE = {
  'pre-qualification': [
    'New', '1st Reach Out', '2nd Reach Out', '3rd Reach Out',
    'Screening Call Scheduled', 'Screening Call Complete',
    'Pending Profile Completion', 'Profile Complete', 'Zoom Call Scheduled',
  ],
  'screening': [
    'Documents Requested', 'Documents Received',
    'Medical Scheduled', 'Medical Complete',
    'Psych Scheduled', 'Psych Complete',
    'Background In Progress', 'Background Complete',
  ],
  'matching': [
    'Awaiting Match', 'Profile Shared', 'Meeting Scheduled',
    'Meeting Complete', 'Match Confirmed',
  ],
  'journey-oversight': [
    'Legal Review', 'Medical Clearance', 'Transfer Prep',
    'Pregnant', 'Monitoring',
    'Delivery Scheduled', 'Delivered', 'Post-Partum',
    'Final Payments', 'Wrap-Up',
    'Closed — Complete', 'Closed — Withdrawn', 'Closed — Disqualified',
  ],
}
