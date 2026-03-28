// ── SMS Read State ──────────────────────────────────────
// Tracks which SMS message SIDs have been read. localStorage-backed.

const STORAGE_KEY = 'abc_sms_read'

function getReadSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveReadSet(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export function isMessageRead(sid) {
  return getReadSet().has(sid)
}

export function markSMSRead(sid) {
  const set = getReadSet()
  set.add(sid)
  saveReadSet(set)
}

export function markMultipleRead(sids) {
  const set = getReadSet()
  for (const sid of sids) set.add(sid)
  saveReadSet(set)
}

/** Count how many SIDs in the array are NOT read */
export function getUnreadSMSCount(sids) {
  const set = getReadSet()
  return sids.filter(sid => !set.has(sid)).length
}
