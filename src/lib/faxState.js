// ── Fax Read/Unread + Filing State ──────────────────────
// localStorage-backed tracking (mirrors smsReadState.js pattern)

const READ_KEY = 'abc_fax_read'
const FILINGS_KEY = 'abc_fax_filings'

// ── Read / Unread ───────────────────────────────────────

function getReadSet() {
  try {
    const raw = localStorage.getItem(READ_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveReadSet(set) {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]))
}

export function isFaxRead(fileName) {
  return getReadSet().has(fileName)
}

export function markFaxRead(fileName) {
  const set = getReadSet()
  set.add(fileName)
  saveReadSet(set)
}

export function markFaxUnread(fileName) {
  const set = getReadSet()
  set.delete(fileName)
  saveReadSet(set)
}

export function markAllFaxesRead(fileNames) {
  const set = getReadSet()
  for (const fn of fileNames) set.add(fn)
  saveReadSet(set)
}

export function getUnreadFaxCount(fileNames) {
  const set = getReadSet()
  return fileNames.filter(fn => !set.has(fn)).length
}

// ── Filing Tracking ─────────────────────────────────────

function getFilingsMap() {
  try {
    const raw = localStorage.getItem(FILINGS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveFilingsMap(map) {
  localStorage.setItem(FILINGS_KEY, JSON.stringify(map))
}

/** Get filing info for a fax (or null if not filed) */
export function getFaxFiling(fileName) {
  return getFilingsMap()[fileName] || null
}

/** Record that a fax was filed to a case */
export function setFaxFiling(fileName, { caseType, caseName, caseId, documentName, filedAt, filedBy }) {
  const map = getFilingsMap()
  map[fileName] = { caseType, caseName, caseId, documentName, filedAt: filedAt || new Date().toISOString(), filedBy: filedBy || '' }
  saveFilingsMap(map)
}

/** Get all filings (for counting) */
export function getAllFilings() {
  return getFilingsMap()
}
