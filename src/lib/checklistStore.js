// ── Checklist Configuration Store ──────────────────────────
// Manages screening/tracking checklist steps + milestones per user type + stage.
// Persisted to Supabase app_config table (key: 'checklist_config').
// Memory-cached for synchronous reads; async load on app startup.

import { getAppConfig, setAppConfig } from './db'

const STORAGE_KEY = 'abc_checklist_config'
const CONFIG_KEY = 'checklist_config'

// Module-level cache (synchronous reads after initial load)
let _cache = null

// Default step statuses available for all checklists
export const CHECKLIST_STEP_STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'requested', label: 'Requested' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'complete', label: 'Complete' },
  { id: 'na', label: 'Not Needed' },
]

// Default checklists seeded on first load
const DEFAULT_CHECKLISTS = {
  gc: {
    'pre-qualification': {
      steps: [
        { id: 'app_complete', label: 'Application Complete', locked: true },
        { id: 'pap', label: 'PAP' },
        { id: 'ob_clearance', label: 'OB Clearance Letter' },
        { id: 'records_reviewed', label: 'Records Reviewed' },
      ],
      milestones: [
        { id: 'records', label: 'Records', stepIds: ['pap', 'ob_clearance'] },
        { id: 'review', label: 'Review', stepIds: ['records_reviewed'] },
      ],
    },
    'screening': {
      steps: [
        { id: 'ob_records', label: 'OB Records', locked: true },
        { id: 'delivery_records', label: 'Delivery Records', locked: true },
        { id: 'ivf_records', label: 'IVF Records', locked: true },
        { id: 'pap', label: 'PAP', locked: true },
        { id: 'background_check', label: 'Background Check' },
        { id: 'psych_screening', label: 'Psych Screening' },
        { id: 'mitera', label: 'Mitera' },
        { id: 'insurance', label: 'Insurance' },
      ],
      milestones: [
        { id: 'bg', label: 'BG', stepIds: ['background_check'] },
        { id: 'psych', label: 'Psych', stepIds: ['psych_screening'] },
        { id: 'mfm', label: 'MFM', stepIds: ['mitera'] },
        { id: 'ins', label: 'Insurance', stepIds: ['insurance'] },
      ],
    },
    'matching': { steps: [], milestones: [] },
    'holding': { steps: [], milestones: [] },
    'not-qualified': { steps: [], milestones: [] },
    'withdrawn': { steps: [], milestones: [] },
    'journey-oversight': { steps: [], milestones: [] },
  },
  ip: {
    'pre-qualification': { steps: [], milestones: [] },
    'screening': { steps: [], milestones: [] },
    'matching': { steps: [], milestones: [] },
    'journey-oversight': { steps: [], milestones: [] },
  },
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveToLocalStorage(config) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)) } catch {}
}

function clearLocalStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// Migrate old flat array format to { steps, milestones } format
function migrateIfNeeded(config) {
  let changed = false
  for (const userType of ['gc', 'ip']) {
    if (!config[userType]) continue
    for (const stageId of Object.keys(config[userType])) {
      const val = config[userType][stageId]
      if (Array.isArray(val)) {
        config[userType][stageId] = { steps: val, milestones: [] }
        changed = true
      }
    }
  }
  return changed
}

function ensureDefaults(config) {
  let changed = false
  for (const userType of ['gc', 'ip']) {
    if (!config[userType]) {
      config[userType] = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS[userType]))
      changed = true
    }
    for (const stageId of Object.keys(DEFAULT_CHECKLISTS[userType])) {
      if (!config[userType][stageId]) {
        config[userType][stageId] = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS[userType][stageId]))
        changed = true
      } else {
        // Ensure locked steps exist and are marked locked
        const defaultSteps = DEFAULT_CHECKLISTS[userType][stageId]?.steps || []
        const existingSteps = config[userType][stageId].steps || []
        for (const ds of defaultSteps) {
          if (!ds.locked) continue
          // Check if step already exists by ID or label
          const existingById = existingSteps.find(s => s.id === ds.id)
          const existingByLabel = existingSteps.find(s => s.label?.toLowerCase() === ds.label?.toLowerCase())
          const existing = existingById || existingByLabel
          if (existing) {
            if (!existing.locked) { existing.locked = true; changed = true }
          } else {
            // Step is missing — add it at the beginning
            existingSteps.unshift(JSON.parse(JSON.stringify(ds)))
            changed = true
          }
        }
      }
    }
  }
  if (changed) {
    // Force save to Supabase + localStorage so locked steps persist
    save(config)
  }
  return changed
}

function saveToSupabase(config) {
  // Fire-and-forget write to Supabase
  setAppConfig(CONFIG_KEY, config).catch(() => {})
}

/** Load checklist config from Supabase into memory cache. Call on app startup. */
export async function loadChecklistConfig() {
  try {
    const remote = await getAppConfig(CONFIG_KEY)
    if (remote) {
      let config = remote
      let changed = migrateIfNeeded(config)
      if (ensureDefaults(config)) changed = true
      _cache = config
      saveToLocalStorage(config)
      if (changed) saveToSupabase(config)
      clearLocalStorage()
      return config
    }

    // Supabase empty — check localStorage for migration
    const local = loadFromLocalStorage()
    if (local) {
      migrateIfNeeded(local)
      ensureDefaults(local)
      _cache = local
      saveToSupabase(local)
      clearLocalStorage()
      return local
    }

    // Nothing anywhere — seed defaults
    const defaults = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
    _cache = defaults
    saveToSupabase(defaults)
    return defaults
  } catch {
    // Fallback to localStorage or defaults
    const local = loadFromLocalStorage()
    if (local) {
      migrateIfNeeded(local)
      ensureDefaults(local)
      _cache = local
      return local
    }
    _cache = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
    return _cache
  }
}

function save(config) {
  _cache = config
  saveToLocalStorage(config)
  saveToSupabase(config)
}

/** Get full config (synchronous — reads from cache) */
export function getChecklistConfig() {
  if (_cache) return _cache
  // Fallback: if cache not loaded yet, read from localStorage
  let config = loadFromLocalStorage()
  if (!config) {
    config = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
  }
  migrateIfNeeded(config)
  ensureDefaults(config)
  _cache = config
  return config
}

/** Get steps for a specific user type + stage */
export function getChecklistSteps(userType, stageId) {
  const config = getChecklistConfig()
  return config[userType]?.[stageId]?.steps || []
}

/** Get milestones for a specific user type + stage */
export function getChecklistMilestones(userType, stageId) {
  const config = getChecklistConfig()
  return config[userType]?.[stageId]?.milestones || []
}

/** Get all steps across all stages for a user type (for dashboard sheet) */
export function getAllChecklistSteps(userType) {
  const config = getChecklistConfig()
  const allSteps = []
  for (const stageId of Object.keys(config[userType] || {})) {
    const steps = config[userType][stageId]?.steps || []
    for (const step of steps) {
      allSteps.push({ ...step, stageId })
    }
  }
  return allSteps
}

/** Get all milestones across all stages for a user type (for card display) */
export function getAllChecklistMilestones(userType) {
  const config = getChecklistConfig()
  const all = []
  for (const stageId of Object.keys(config[userType] || {})) {
    const milestones = config[userType][stageId]?.milestones || []
    for (const ms of milestones) {
      all.push({ ...ms, stageId })
    }
  }
  return all
}

/** Set the full step list for a user type + stage */
export function setChecklistSteps(userType, stageId, steps) {
  const config = getChecklistConfig()
  if (!config[userType]) config[userType] = {}
  if (!config[userType][stageId]) config[userType][stageId] = { steps: [], milestones: [] }
  config[userType][stageId].steps = steps
  save(config)
}

/** Add a step to a user type + stage */
export function addChecklistStep(userType, stageId, label, logType = 'status', options = []) {
  const config = getChecklistConfig()
  if (!config[userType]) config[userType] = {}
  if (!config[userType][stageId]) config[userType][stageId] = { steps: [], milestones: [] }
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()
  const step = { id, label }
  if (logType !== 'status') step.logType = logType
  if (options.length > 0) step.options = options
  config[userType][stageId].steps.push(step)
  save(config)
  return config[userType][stageId].steps
}

/** Edit a step (label, logType, options) */
export function editChecklistStep(userType, stageId, stepId, updates) {
  const config = getChecklistConfig()
  const steps = config[userType]?.[stageId]?.steps
  if (!steps) return
  const step = steps.find(s => s.id === stepId)
  if (!step) return
  if (typeof updates === 'string') {
    // Backwards compat: editChecklistStep(ut, sid, stepId, 'new label')
    step.label = updates
  } else {
    if (updates.label) step.label = updates.label
    if (updates.logType !== undefined) step.logType = updates.logType === 'status' ? undefined : updates.logType
    if (updates.options !== undefined) step.options = updates.options?.length > 0 ? updates.options : undefined
  }
  save(config)
}

/** Delete a step (also removes from any milestones). Locked steps cannot be deleted. */
export function deleteChecklistStep(userType, stageId, stepId) {
  const config = getChecklistConfig()
  const stageData = config[userType]?.[stageId]
  if (!stageData) return
  const step = stageData.steps.find(s => s.id === stepId)
  if (step?.locked) return // Cannot delete locked steps
  stageData.steps = stageData.steps.filter(s => s.id !== stepId)
  for (const ms of stageData.milestones || []) {
    ms.stepIds = ms.stepIds.filter(id => id !== stepId)
  }
  save(config)
}

/** Set milestones for a user type + stage */
export function setChecklistMilestones(userType, stageId, milestones) {
  const config = getChecklistConfig()
  if (!config[userType]?.[stageId]) return
  config[userType][stageId].milestones = milestones
  save(config)
}

/** Add a milestone */
export function addChecklistMilestone(userType, stageId, label) {
  const config = getChecklistConfig()
  if (!config[userType]?.[stageId]) return
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()
  config[userType][stageId].milestones.push({ id, label, stepIds: [] })
  save(config)
}

/** Edit a milestone label */
export function editChecklistMilestone(userType, stageId, milestoneId, newLabel) {
  const config = getChecklistConfig()
  const ms = config[userType]?.[stageId]?.milestones?.find(m => m.id === milestoneId)
  if (ms) ms.label = newLabel
  save(config)
}

/** Delete a milestone */
export function deleteChecklistMilestone(userType, stageId, milestoneId) {
  const config = getChecklistConfig()
  const stageData = config[userType]?.[stageId]
  if (!stageData) return
  stageData.milestones = stageData.milestones.filter(m => m.id !== milestoneId)
  save(config)
}

/** Toggle a step in/out of a milestone */
export function toggleStepInMilestone(userType, stageId, milestoneId, stepId) {
  const config = getChecklistConfig()
  const ms = config[userType]?.[stageId]?.milestones?.find(m => m.id === milestoneId)
  if (!ms) return
  if (ms.stepIds.includes(stepId)) {
    ms.stepIds = ms.stepIds.filter(id => id !== stepId)
  } else {
    ms.stepIds.push(stepId)
  }
  save(config)
}

/** Reset a user type + stage to defaults */
export function resetChecklistToDefaults(userType, stageId) {
  const config = getChecklistConfig()
  config[userType][stageId] = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS[userType]?.[stageId] || { steps: [], milestones: [] }))
  save(config)
  return config[userType][stageId]
}
