import { SURROGATE_STAGES, DEFAULT_STATUSES_BY_STAGE } from './constants'
import { getAppConfig, setAppConfig } from './db'

const CONFIG_KEY = 'abc_status_config'
const STAGES_KEY = 'abc_surrogate_stages'
const SUPABASE_CONFIG_KEY = 'status_config'
const SUPABASE_STAGES_KEY = 'surrogate_stages'

// Module-level caches
let _configCache = null
let _stagesCache = null

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
  setAppConfig(SUPABASE_CONFIG_KEY, config).catch(() => {})
}

function saveStagesToSupabase(stages) {
  setAppConfig(SUPABASE_STAGES_KEY, stages).catch(() => {})
}

// ── Async loader (call on app startup) ────────────────────

export async function loadStageStatuses() {
  try {
    // Load both config and stages from Supabase in parallel
    const [remoteConfig, remoteStages] = await Promise.all([
      getAppConfig(SUPABASE_CONFIG_KEY),
      getAppConfig(SUPABASE_STAGES_KEY),
    ])

    // Status config
    if (remoteConfig) {
      _configCache = remoteConfig
      saveConfigToLS(remoteConfig)
    } else {
      // Migration: push localStorage to Supabase
      const localConfig = loadConfigFromLS()
      if (localConfig) {
        _configCache = localConfig
        saveConfigToSupabase(localConfig)
      } else {
        _configCache = structuredClone(DEFAULT_STATUSES_BY_STAGE)
        saveConfigToSupabase(_configCache)
      }
    }

    // Surrogate stages
    if (remoteStages) {
      _stagesCache = remoteStages
      saveStagesToLS(remoteStages)
    } else {
      const localStages = loadStagesFromLS()
      if (localStages) {
        _stagesCache = localStages
        saveStagesToSupabase(localStages)
      } else {
        _stagesCache = {}
        saveStagesToSupabase(_stagesCache)
      }
    }

    // Clear localStorage after successful migration
    clearLS()
  } catch {
    // Fallback to localStorage
    _configCache = loadConfigFromLS() || structuredClone(DEFAULT_STATUSES_BY_STAGE)
    _stagesCache = loadStagesFromLS() || {}
  }
}

// ── Config (available statuses per stage) ──────────────────

export function getStatusConfig() {
  if (_configCache) return _configCache
  // Fallback if not loaded yet
  const local = loadConfigFromLS()
  if (local) { _configCache = local; return local }
  _configCache = structuredClone(DEFAULT_STATUSES_BY_STAGE)
  return _configCache
}

export function setStatusConfig(config) {
  _configCache = config
  saveConfigToLS(config)
  saveConfigToSupabase(config)
}

export function addStatus(stageId, statusLabel) {
  const config = getStatusConfig()
  if (!config[stageId]) config[stageId] = []
  if (!config[stageId].includes(statusLabel)) {
    config[stageId].push(statusLabel)
    setStatusConfig(config)
  }
  return config
}

export function editStatus(stageId, oldLabel, newLabel) {
  const config = getStatusConfig()
  if (!config[stageId]) return config
  const idx = config[stageId].indexOf(oldLabel)
  if (idx !== -1) config[stageId][idx] = newLabel
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

export function deleteStatus(stageId, statusLabel, mode) {
  const config = getStatusConfig()
  if (!config[stageId]) return config
  config[stageId] = config[stageId].filter(s => s !== statusLabel)
  setStatusConfig(config)

  if (mode === 'remove_from_all') {
    const fallback = config[stageId]?.[0] || 'New'
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
  // 'soft_delete' just removes from config — surrogates keep the label
  return config
}

export function getStatusesInUse(stageId, statusLabel) {
  const all = getAllSurrogateStageStatuses()
  return Object.entries(all).filter(([, e]) => e.stage === stageId && e.status === statusLabel).length
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

export function getDefaultStatus(stageId) {
  const config = getStatusConfig()
  return config[stageId]?.[0] || 'New'
}
