// ── Checklist Configuration Store ──────────────────────────
// Manages screening/tracking checklist steps + milestones per user type + stage.
// Persisted to Supabase app_config table (key: 'checklist_config').
// Memory-cached for synchronous reads; async load on app startup.

import { getAppConfig, setAppConfig } from './db'

const STORAGE_KEY = 'abc_checklist_config'
const CONFIG_KEY = 'checklist_config'

// Module-level cache (synchronous reads after initial load)
let _cache = null
// True only after a successful Supabase load (or localStorage migration).
// All save() calls are BLOCKED while this is false to prevent overwriting
// real data with the defaults that the sync fallback returns.
let _loaded = false

// Default step statuses available for all checklists
export const CHECKLIST_STEP_STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'requested', label: 'Requested' },
  { id: 'started', label: 'Started' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'followed_up', label: 'Followed Up' },
  { id: 'note', label: 'Note' },
  { id: 'complete', label: 'Complete' },
  { id: 'na', label: 'Not Needed' },
]

/**
 * Normalize a step's `options` array to {label, mapsTo} objects.
 * Backwards-compat: legacy string options become {label: str, mapsTo: 'in_progress'}.
 */
export function normalizeOptions(options) {
  if (!Array.isArray(options)) return []
  return options.map(o =>
    typeof o === 'string'
      ? { label: o, mapsTo: 'in_progress' }
      : { label: o?.label || '', mapsTo: o?.mapsTo || 'in_progress' }
  )
}

/**
 * Derive a parent step's status from its children.
 * - All children complete or na  → 'complete'
 * - Any reviewing/in_progress/requested → highest priority active state
 * - Otherwise → 'not_started'
 * Returns null if there are no children.
 */
export function deriveParentStatus(children, tracking) {
  if (!Array.isArray(children) || children.length === 0) return null
  const statuses = children.map(c => tracking?.[c.id]?.status || 'not_started')
  // 'already_collected' counts the same as 'complete' for roll-up — admins
  // marking a record already-on-file should make the parent register as done.
  const allDoneOrNa = statuses.every(s => s === 'complete' || s === 'na' || s === 'partial_complete' || s === 'already_collected')
  if (allDoneOrNa) return 'complete'
  // Priority order — highest "active" wins
  const priority = ['reviewing', 'in_progress', 'requested', 'partial_received', 'records_received']
  for (const p of priority) {
    if (statuses.includes(p)) return p
  }
  // If any child has started (e.g. some complete, some not) but not all
  // done, treat parent as in_progress.
  const anyStarted = statuses.some(s => s !== 'not_started')
  if (anyStarted) return 'in_progress'
  return 'not_started'
}

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
    'journey-oversight': {
      steps: [
        // locked:true means ensureDefaults() will add this to any existing
        // config that's missing it (matched by id or label). Required by the
        // "Mark Journey Complete" gate — admin can't close out a journey
        // until escrow has been closed after delivery.
        { id: 'escrow_closed', label: 'Escrow Closed', locked: true },
      ],
      milestones: [],
    },
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
  // NOTE: do NOT call save() here. Callers decide whether to persist.
  // Saving from inside ensureDefaults previously caused defaults to be
  // written to Supabase during the startup race, wiping user data.
  return changed
}

function saveToSupabase(config) {
  // Fire-and-forget write to Supabase
  setAppConfig(CONFIG_KEY, config).catch(() => {})
}

/** Load checklist config from Supabase into memory cache. Call on app startup.
 *
 * This function MUST NEVER write back to Supabase on its own. Doing so
 * caused a production data-loss incident: a stale-cached browser tab loaded
 * the remote config, ensureDefaults decided some stages were "missing"
 * (because DEFAULT_CHECKLISTS is a slim seed), filled them with empty
 * arrays, and silently saved the result — wiping all admin-customized
 * checklist templates. Saves only happen on explicit user action via the
 * setter functions (which call save()).
 */
export async function loadChecklistConfig() {
  try {
    const remote = await getAppConfig(CONFIG_KEY)
    if (remote) {
      const config = remote
      // In-memory normalization only — DO NOT save the result back.
      migrateIfNeeded(config)
      ensureDefaults(config)
      _cache = config
      _loaded = true // unblock save() so user-initiated changes can persist
      saveToLocalStorage(config)
      return config
    }

    // Supabase empty — check localStorage for migration. We DO write back
    // in this branch because there's no remote config to overwrite (this
    // is the "first ever load" path, seeding from a previous tab).
    const local = loadFromLocalStorage()
    if (local) {
      migrateIfNeeded(local)
      ensureDefaults(local)
      _cache = local
      _loaded = true
      saveToSupabase(local)
      return local
    }

    // Nothing anywhere — seed defaults. Same reasoning: empty remote means
    // there's nothing to clobber.
    const defaults = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
    _cache = defaults
    _loaded = true
    saveToSupabase(defaults)
    return defaults
  } catch {
    // Supabase failed — fall back to localStorage if available
    const local = loadFromLocalStorage()
    if (local) {
      migrateIfNeeded(local)
      ensureDefaults(local)
      _cache = local
      // Do NOT mark _loaded = true: we never confirmed against Supabase,
      // so saves stay blocked until a real load succeeds. This prevents
      // overwriting Supabase with stale localStorage data.
      return local
    }
    // No data anywhere — return defaults but DO NOT cache or mark loaded.
    // Saves remain blocked so we can't clobber Supabase with defaults.
    return JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
  }
}

function save(config) {
  if (!_loaded) {
    // Block writes until we've confirmed what's in Supabase. Without this
    // guard, the startup race could overwrite real data with the defaults
    // returned by the sync fallback.
    console.warn('[checklistStore] save() blocked — config not loaded from Supabase yet')
    return
  }
  _cache = config
  saveToLocalStorage(config)
  saveToSupabase(config)
}

/** Get full config (synchronous — reads from cache) */
export function getChecklistConfig() {
  if (_cache) return _cache
  // Fallback path — async load hasn't finished yet. Return defaults (or
  // localStorage if present) for rendering, but DO NOT cache them as
  // truth and DO NOT mark _loaded = true. save() stays blocked, so even
  // if a component tries to persist while we're in this state, it can't
  // overwrite real Supabase data.
  let config = loadFromLocalStorage()
  if (!config) {
    config = JSON.parse(JSON.stringify(DEFAULT_CHECKLISTS))
  }
  migrateIfNeeded(config)
  ensureDefaults(config)
  return config
}

/** Get steps for a specific user type + stage */
export function getChecklistSteps(userType, stageId) {
  const config = getChecklistConfig()
  return config[userType]?.[stageId]?.steps || []
}

/** Journey's "Escrow" checklist step is marked Complete?
 *  Used to derive the "Escrow Funded" display state on expense rows.
 *  Match is by step label (case-insensitive === 'escrow') against the
 *  journey-oversight step config; tracking lives in journey_data._checklistTracking.
 */
export function isJourneyEscrowFunded(journey) {
  const tracking = journey?.journey_data?._checklistTracking || {}
  const steps = getChecklistSteps('gc', 'journey-oversight')
  const escrowStep = steps.find(s => (s.label || '').trim().toLowerCase() === 'escrow')
  if (!escrowStep) return false
  return tracking[escrowStep.id]?.status === 'complete'
}

/** Journey's "Escrow Closed" checklist step is marked Complete?
 *  Required before the admin can mark a journey complete (escrow must be
 *  closed out after delivery).
 *
 *  Some prod configs ended up with two steps labeled "Escrow Closed" (the
 *  default we seed plus an existing custom step that was renamed to match).
 *  Match all steps with the label and return true if ANY of them is
 *  complete — that way whichever one the admin actually tracks against
 *  unblocks the gate.
 */
export function isJourneyEscrowClosed(journey) {
  const tracking = journey?.journey_data?._checklistTracking || {}
  const steps = getChecklistSteps('gc', 'journey-oversight')
  const matching = steps.filter(s => (s.label || '').trim().toLowerCase() === 'escrow closed')
  return matching.some(s => tracking[s.id]?.status === 'complete')
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
// Surrogate info rows — data pulled from intake answers + profile
export const SURROGATE_INFO_ROW_FIELDS = [
  { key: 'referralSource', label: 'Referral Source', source: 'surrogate' },
  { key: 'experiencedSurrogate', label: 'Experienced Surrogate', source: 'surrogate' },
  { key: 'gtpal', label: 'GTPAL', source: 'surrogate' },
  { key: 'maritalStatus', label: 'Marital Status', source: 'surrogate' },
  { key: 'profileComplete', label: '% Profile Complete', source: 'surrogate' },
]

// Journey info rows — data pulled from journey_data
export const INFO_ROW_FIELDS = [
  { key: 'ivfClinic', label: 'IVF Clinic', dataPath: 'ivfClinic', secondaryPath: 'ivfDoctor' },
  { key: 'monitoringClinic', label: 'Monitoring Clinic', dataPath: 'monitoringClinic', secondaryPath: 'monitoringDoctor' },
  { key: 'ipAttorney', label: 'IP Attorney', dataPath: 'ipAttorneyName', secondaryPath: 'ipAttorneyFirm' },
  { key: 'gcAttorney', label: 'GC Attorney', dataPath: 'gcAttorneyName', secondaryPath: 'gcAttorneyFirm' },
  { key: 'obClinic', label: 'OB Clinic', dataPath: 'obClinic', secondaryPath: 'obDoctor' },
  { key: 'deliveryHospital', label: 'Delivery Hospital', dataPath: 'deliveryHospital', secondaryPath: 'deliveryHospitalCity' },
]

export function addInfoRow(userType, stageId, fieldKey) {
  const allFields = [...INFO_ROW_FIELDS, ...SURROGATE_INFO_ROW_FIELDS]
  const field = allFields.find(f => f.key === fieldKey)
  if (!field) return
  const config = getChecklistConfig()
  if (!config[userType]) config[userType] = {}
  if (!config[userType][stageId]) config[userType][stageId] = { steps: [], milestones: [] }
  const id = `info_${fieldKey}_${Date.now()}`
  const step = { id, label: field.label, type: 'info_row', dataField: field.key }
  if (field.dataPath) step.dataPath = field.dataPath
  if (field.secondaryPath) step.secondaryPath = field.secondaryPath
  if (field.source) step.source = field.source
  config[userType][stageId].steps.push(step)
  save(config)
  return config[userType][stageId].steps
}

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

/** Add a subtask under a parent step. Inserted right after the parent's existing children. */
export function addChecklistSubtask(userType, stageId, parentId, label) {
  const config = getChecklistConfig()
  const stageData = config[userType]?.[stageId]
  if (!stageData) return
  const steps = stageData.steps
  const parentIndex = steps.findIndex(s => s.id === parentId)
  if (parentIndex === -1) return
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()
  const subtask = { id, label, parentId }
  // Insert after the parent and any of its existing children
  let insertAt = parentIndex + 1
  while (insertAt < steps.length && steps[insertAt].parentId === parentId) insertAt++
  steps.splice(insertAt, 0, subtask)
  save(config)
  return steps
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

/** Delete a step (also removes from any milestones, and cascades to subtasks). Locked steps cannot be deleted. */
export function deleteChecklistStep(userType, stageId, stepId) {
  const config = getChecklistConfig()
  const stageData = config[userType]?.[stageId]
  if (!stageData) return
  const step = stageData.steps.find(s => s.id === stepId)
  if (step?.locked) return // Cannot delete locked steps
  // Cascade: also remove any subtasks of this step
  const removedIds = new Set([stepId])
  for (const s of stageData.steps) {
    if (s.parentId === stepId) removedIds.add(s.id)
  }
  stageData.steps = stageData.steps.filter(s => !removedIds.has(s.id))
  for (const ms of stageData.milestones || []) {
    ms.stepIds = ms.stepIds.filter(id => !removedIds.has(id))
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
