import { SURROGATE_STAGES, DEFAULT_STATUSES_BY_STAGE } from './constants'

const CONFIG_KEY = 'abc_status_config'
const STAGES_KEY = 'abc_surrogate_stages'

// ── Config (available statuses per stage) ──────────────────

export function getStatusConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // Seed defaults
  const config = structuredClone(DEFAULT_STATUSES_BY_STAGE)
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  return config
}

export function setStatusConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
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
  for (const [id, entry] of Object.entries(all)) {
    if (entry.stage === stageId && entry.status === oldLabel) {
      entry.status = newLabel
    }
  }
  localStorage.setItem(STAGES_KEY, JSON.stringify(all))
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
    for (const [id, entry] of Object.entries(all)) {
      if (entry.stage === stageId && entry.status === statusLabel) {
        entry.status = fallback
      }
    }
    localStorage.setItem(STAGES_KEY, JSON.stringify(all))
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
  try {
    const raw = localStorage.getItem(STAGES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

export function getSurrogateStageStatus(surrogateId) {
  const all = getAllSurrogateStageStatuses()
  if (all[surrogateId]) return all[surrogateId]
  return { stage: 'pre-qualification', status: 'New' }
}

export function setSurrogateStageStatus(surrogateId, stage, status) {
  const all = getAllSurrogateStageStatuses()
  all[surrogateId] = { stage, status }
  localStorage.setItem(STAGES_KEY, JSON.stringify(all))
}

// ── Helpers ────────────────────────────────────────────────

export function getStageByIdOrLabel(val) {
  return SURROGATE_STAGES.find(s => s.id === val || s.label === val)
}

export function getDefaultStatus(stageId) {
  const config = getStatusConfig()
  return config[stageId]?.[0] || 'New'
}
