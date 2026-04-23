import { SURROGATE_STAGES, DEFAULT_STATUSES_BY_STAGE } from './constants'
import { getAppConfigStrict, setAppConfig } from './db'

const CONFIG_KEY = 'abc_status_config'
const STAGES_KEY = 'abc_surrogate_stages'
const SUPABASE_CONFIG_KEY = 'status_config'
const SUPABASE_STAGES_KEY = 'surrogate_stages'

// Stage groupings for settings UI
export const CASE_STAGES = SURROGATE_STAGES.filter(s => ['pre-qualification', 'screening', 'matching'].includes(s.id))
export const JOURNEY_STAGES = SURROGATE_STAGES.filter(s => s.id === 'journey-oversight')

// Default statuses per user type
const DEFAULT_IP_STATUSES = {
  'pre-qualification': ['New', '1st Reach Out', '2nd Reach Out', '3rd Reach Out', 'Consultation Scheduled', 'Consultation Complete', 'Application Sent', 'Application Complete', 'Zoom Call Scheduled'],
  'screening': ['Documents Requested', 'Documents Received', 'Background In Progress', 'Background Complete'],
  'matching': ['Awaiting Match', 'Profile Shared', 'Meeting Scheduled', 'Meeting Complete', 'Match Confirmed'],
}

const DEFAULT_JOURNEY_STATUSES = {
  'journey-oversight': DEFAULT_STATUSES_BY_STAGE['journey-oversight'],
}

const DEFAULT_GC_STATUSES = {
  'pre-qualification': DEFAULT_STATUSES_BY_STAGE['pre-qualification'],
  'screening': DEFAULT_STATUSES_BY_STAGE['screening'],
  'matching': DEFAULT_STATUSES_BY_STAGE['matching'],
}

// Module-level caches
let _configCache = null
let _stagesCache = null
let _configLoaded = false
let _stagesLoaded = false

// ── localStorage helpers ──────────────────────────────────

function loadConfigFromLS() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveConfigToLS(config) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)) } catch {}
}

function loadStagesFromLS() {
  try {
    const raw = localStorage.getItem(STAGES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveStagesToLS(stages) {
  try { localStorage.setItem(STAGES_KEY, JSON.stringify(stages)) } catch {}
}

function clearLS() {
  try {
    localStorage.removeItem(CONFIG_KEY)
    localStorage.removeItem(STAGES_KEY)
  } catch {}
}

// ── Supabase fire-and-forget saves ────────────────────────

function saveConfigToSupabase(config) {
  if (!_configLoaded) {
    console.warn('[stageStatusStore] status config save blocked — config not loaded from Supabase yet')
    return
  }
  setAppConfig(SUPABASE_CONFIG_KEY, config).catch(() => {})
}

function saveStagesToSupabase(stages) {
  if (!_stagesLoaded) {
    console.warn('[stageStatusStore] stage status save blocked — stages not loaded from Supabase yet')
    return
  }
  setAppConfig(SUPABASE_STAGES_KEY, stages).catch(() => {})
}

// ── Migration: flat config → typed config ─────────────────

function migrateConfig(config) {
  // Already migrated if it has gc/ip/journey keys
  if (config && config.gc && config.ip && config.journey) return config

  // Old flat config: { 'pre-qualification': [...], 'screening': [...], ... }
  // Migrate GC stages from old config, use defaults for IP, keep journey stages
  const gcStages = {}
  const journeyStages = {}

  for (const stage of CASE_STAGES) {
    gcStages[stage.id] = config?.[stage.id] || DEFAULT_GC_STATUSES[stage.id] || []
  }
  for (const stage of JOURNEY_STAGES) {
    journeyStages[stage.id] = config?.[stage.id] || DEFAULT_JOURNEY_STATUSES[stage.id] || []
  }

  return {
    gc: gcStages,
    ip: structuredClone(DEFAULT_IP_STATUSES),
    journey: journeyStages,
  }
}

// ── Async loader (call on app startup) ────────────────────

export async function loadStageStatuses() {
  const [configResult, stagesResult] = await Promise.all([
    getAppConfigStrict(SUPABASE_CONFIG_KEY),
    getAppConfigStrict(SUPABASE_STAGES_KEY),
  ])

  if (configResult.ok) {
    if (configResult.value) {
      _configCache = migrateConfig(configResult.value)
      _configLoaded = true
      // Save back only after a confirmed remote load.
      if (!configResult.value.gc) saveConfigToSupabase(_configCache)
      saveConfigToLS(_configCache)
    } else {
      const localConfig = loadConfigFromLS()
      _configCache = migrateConfig(localConfig)
      _configLoaded = true
      saveConfigToSupabase(_configCache)
      saveConfigToLS(_configCache)
    }
  } else {
    // Render from local/default data if needed, but do not allow saves.
    _configCache = migrateConfig(loadConfigFromLS())
    _configLoaded = false
  }

  if (stagesResult.ok) {
    const localStages = loadStagesFromLS()
    const hasRemoteStages = !!stagesResult.value
    _stagesCache = stagesResult.value || localStages || {}
    _stagesLoaded = true
    if (!hasRemoteStages) saveStagesToSupabase(_stagesCache)
    saveStagesToLS(_stagesCache)
  } else {
    // Render from local/default data if needed, but do not allow saves.
    _stagesCache = loadStagesFromLS() || {}
    _stagesLoaded = false
  }

  if (_configLoaded && _stagesLoaded) clearLS()
}

// ── Config (available statuses per stage) ──────────────────

export function getStatusConfig() {
  if (_configCache) return _configCache
  const local = loadConfigFromLS()
  if (local) { _configCache = migrateConfig(local); return _configCache }
  _configCache = migrateConfig(null)
  return _configCache
}

export function setStatusConfig(config) {
  _configCache = config
  saveConfigToLS(config)
  saveConfigToSupabase(config)
}

// Helper to get the right config sub-object for a userType
function getTypeConfig(userType) {
  const config = getStatusConfig()
  return config[userType] || {}
}

// Helper to resolve userType from stageId (for backward compat)
function resolveUserType(stageId) {
  if (stageId === 'journey-oversight') return 'journey'
  return 'gc' // default to gc for case stages
}

export function addStatus(stageId, statusLabel, userType) {
  const type = userType || resolveUserType(stageId)
  const config = getStatusConfig()
  if (!config[type]) config[type] = {}
  if (!config[type][stageId]) config[type][stageId] = []
  if (!config[type][stageId].includes(statusLabel)) {
    config[type][stageId].push(statusLabel)
    setStatusConfig(config)
  }
  return config
}

export function editStatus(stageId, oldLabel, newLabel, userType) {
  const type = userType || resolveUserType(stageId)
  const config = getStatusConfig()
  if (!config[type]?.[stageId]) return config
  const idx = config[type][stageId].indexOf(oldLabel)
  if (idx !== -1) config[type][stageId][idx] = newLabel
  setStatusConfig(config)

  // Also update any surrogates using the old status
  const all = getAllSurrogateStageStatuses()
  let stagesChanged = false
  for (const [id, entry] of Object.entries(all)) {
    if (entry.stage === stageId && entry.status === oldLabel) {
      entry.status = newLabel
      stagesChanged = true
    }
  }
  if (stagesChanged) {
    _stagesCache = all
    saveStagesToLS(all)
    saveStagesToSupabase(all)
  }
  return config
}

export function deleteStatus(stageId, statusLabel, mode, userType) {
  const type = userType || resolveUserType(stageId)
  const config = getStatusConfig()
  if (!config[type]?.[stageId]) return config
  config[type][stageId] = config[type][stageId].filter(s => s !== statusLabel)
  setStatusConfig(config)

  if (mode === 'remove_from_all') {
    const fallback = config[type][stageId]?.[0] || 'New'
    const all = getAllSurrogateStageStatuses()
    let stagesChanged = false
    for (const [id, entry] of Object.entries(all)) {
      if (entry.stage === stageId && entry.status === statusLabel) {
        entry.status = fallback
        stagesChanged = true
      }
    }
    if (stagesChanged) {
      _stagesCache = all
      saveStagesToLS(all)
      saveStagesToSupabase(all)
    }
  }
  return config
}

export function getStatusesInUse(stageId, statusLabel) {
  const all = getAllSurrogateStageStatuses()
  return Object.entries(all).filter(([, e]) => e.stage === stageId && e.status === statusLabel).length
}

// Get statuses for a specific stage, trying userType first then falling back
export function getStatusesForStage(stageId, userType) {
  const config = getStatusConfig()
  if (userType && config[userType]?.[stageId]) return config[userType][stageId]
  // Fallback: try gc, then journey, then flat
  if (config.gc?.[stageId]) return config.gc[stageId]
  if (config.journey?.[stageId]) return config.journey[stageId]
  // Legacy flat fallback
  if (Array.isArray(config[stageId])) return config[stageId]
  return DEFAULT_STATUSES_BY_STAGE[stageId] || []
}

// ── Per-surrogate stage/status ─────────────────────────────

export function getAllSurrogateStageStatuses() {
  if (_stagesCache) return _stagesCache
  const local = loadStagesFromLS()
  if (local) { _stagesCache = local; return local }
  _stagesCache = {}
  return _stagesCache
}

export function getSurrogateStageStatus(surrogateId) {
  const all = getAllSurrogateStageStatuses()
  if (all[surrogateId]) return all[surrogateId]
  return { stage: 'pre-qualification', status: 'New' }
}

export function setSurrogateStageStatus(surrogateId, stage, status) {
  const all = getAllSurrogateStageStatuses()
  all[surrogateId] = { stage, status }
  _stagesCache = all
  saveStagesToLS(all)
  saveStagesToSupabase(all)
}

// ── Helpers ────────────────────────────────────────────────

export function getStageByIdOrLabel(val) {
  return SURROGATE_STAGES.find(s => s.id === val || s.label === val)
}

export function getDefaultStatus(stageId, userType) {
  const statuses = getStatusesForStage(stageId, userType)
  return statuses[0] || 'New'
}
