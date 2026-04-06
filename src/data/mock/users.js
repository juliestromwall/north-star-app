// Admin users — loaded from Supabase Auth via /api/admin-users
// Falls back to hardcoded list if API is unavailable
// Call loadAdminUsers() on app init to populate from live data

export let mockUsers = []

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
