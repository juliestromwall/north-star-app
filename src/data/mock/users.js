import { getAuthHeaders } from '@/lib/authHeaders'

// Admin users — loaded from Supabase Auth via /api/admin-users
// Falls back to hardcoded list if API is unavailable
// Call loadAdminUsers() on app init to populate from live data

export let mockUsers = []

export function getAdminStaff() {
  return mockUsers.filter(u => ['super_admin', 'master_admin', 'office_admin', 'admin'].includes(u.role))
}

export async function loadAdminUsers() {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/admin-users', { headers })
    const data = await res.json()
    const users = Array.isArray(data) ? data : (data.users || data)
    if (Array.isArray(users) && users.length > 0) {
      mockUsers.length = 0
      for (const u of users) mockUsers.push(u)
    } else {
      console.warn('No admin users returned from API:', data)
    }
  } catch (err) {
    console.warn('Failed to load admin users:', err)
  }
  return mockUsers
}
