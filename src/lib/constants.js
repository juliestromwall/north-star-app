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
