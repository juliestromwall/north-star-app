// Shared admin users fetcher with caching
// Replaces hardcoded mockUsers for admin staff lists

let _cache = null
let _loading = false
let _listeners = []

export async function fetchAdminUsers() {
  if (_cache) return _cache
  if (_loading) {
    return new Promise(resolve => { _listeners.push(resolve) })
  }
  _loading = true
  try {
    const res = await fetch('/api/admin-users')
    const data = await res.json()
    _cache = Array.isArray(data) ? data : []
  } catch {
    _cache = []
  }
  _loading = false
  for (const fn of _listeners) fn(_cache)
  _listeners = []
  return _cache
}

export function clearAdminUsersCache() {
  _cache = null
}

// For synchronous access (returns cached or empty)
export function getAdminUsersSync() {
  return _cache || []
}
