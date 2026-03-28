// ── Checklist Configuration Store ──────────────────────────
// Manages screening/tracking checklist steps per user type + stage.
// Persisted to localStorage. One checklist per (userType, stageId) pair.

const STORAGE_KEY = 'abc_checklist_config'

// Default step statuses available for all checklists
export const CHECKLIST_STEP_STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'waiting_surrogate', label: 'Waiting on Surrogate' },
  { id: 'waiting_provider', label: 'Waiting on Provider' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'followed_up', label: 'Follow Up' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'incomplete_resubmit', label: 'Incomplete — Needs Resubmission' },
  { id: 'complete', label: 'Complete' },
  { id: 'na', label: 'N/A' },
]

// Default checklists seeded on first load
const DEFAULT_CHECKLISTS = {
  gc: {
    'pre-qualification': [
      { id: 'pap', label: 'PAP' },
      { id: 'ob_clearance', label: 'OB Clearance Letter' },
      { id: 'records_reviewed', label: 'Records Reviewed' },
    ],
    'screening': [
      { id: 'background_check', label: 'Background Check' },
      { id: 'psych_screening', label: 'Psych Screening' },
      { id: 'mitera', label: 'Mitera' },
      { id: 'insurance', label: 'Insurance' },
    ],
    'matching': [],
    'journey-oversight': [],
    'journey-ending': [],
    'journey-closed': [],
  },
  ip: {
    'pre-qualification': [],
    'screening': [],
    'matching': [],
    'journey-oversight': [],
    'journey-ending': [],
    'journey-closed': [],
  },
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function save(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function ensureDefaults(config) {
  let changed = false
  for (const userType of ['gc', 'ip']) {
    if (!config[userType]) {
      config[userType] = DEFAULT_CHECKLISTS[userType]
      changed = true
    }
    for (const stageId of Object.keys(DEFAULT_CHECKLISTS[userType])) {
      if (!config[userType][stageId]) {
        config[userType][stageId] = DEFAULT_CHECKLISTS[userType][stageId]
        changed = true
      }
    }
  }
  return changed
}

/** Get full config: { gc: { stageId: [...steps] }, ip: { stageId: [...steps] } } */
export function getChecklistConfig() {
  let config = load()
  if (!config) {
    config = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
    save(config)
    return config
  }
  if (ensureDefaults(config)) save(config)
  return config
}

/** Get steps for a specific user type + stage */
export function getChecklistSteps(userType, stageId) {
  const config = getChecklistConfig()
  return config[userType]?.[stageId] || []
}

/** Set the full step list for a user type + stage (replaces all steps) */
export function setChecklistSteps(userType, stageId, steps) {
  const config = getChecklistConfig()
  if (!config[userType]) config[userType] = {}
  config[userType][stageId] = steps
  save(config)
}

/** Add a step to a user type + stage */
export function addChecklistStep(userType, stageId, label) {
  const config = getChecklistConfig()
  if (!config[userType]) config[userType] = {}
  if (!config[userType][stageId]) config[userType][stageId] = []
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()
  config[userType][stageId].push({ id, label })
  save(config)
  return config[userType][stageId]
}

/** Edit a step label */
export function editChecklistStep(userType, stageId, stepId, newLabel) {
  const config = getChecklistConfig()
  const steps = config[userType]?.[stageId]
  if (!steps) return
  const step = steps.find(s => s.id === stepId)
  if (step) step.label = newLabel
  save(config)
}

/** Delete a step */
export function deleteChecklistStep(userType, stageId, stepId) {
  const config = getChecklistConfig()
  const steps = config[userType]?.[stageId]
  if (!steps) return
  config[userType][stageId] = steps.filter(s => s.id !== stepId)
  save(config)
}

/** Reset a user type + stage to defaults */
export function resetChecklistToDefaults(userType, stageId) {
  const config = getChecklistConfig()
  config[userType][stageId] = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS[userType]?.[stageId] || []))
  save(config)
  return config[userType][stageId]
}
