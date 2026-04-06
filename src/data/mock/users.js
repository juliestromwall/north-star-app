// Admin users — loaded from Supabase Auth via /api/admin-users
// Falls back to hardcoded list if API is unavailable
// Call loadAdminUsers() on app init to populate from live data

const FALLBACK_USERS = [
  { id: 'u1', name: 'Dev Admin', email: 'dev@abcsurrogacy.com', phone: '', role: 'super_admin' },
  { id: 'u2', name: 'Julie Allgood', email: 'julie@abcsurrogacy.com', phone: '(818) 321-9329', role: 'master_admin' },
  { id: 'u3', name: 'Nicole Lawson', email: 'nicole@abcsurrogacy.com', phone: '(818) 555-0103', role: 'master_admin' },
]

export let mockUsers = [...FALLBACK_USERS]

export async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin-users')
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      mockUsers.length = 0
      for (const u of data) mockUsers.push(u)
    }
  } catch {
    // Keep fallback
  }
  return mockUsers
}
