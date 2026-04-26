const ADMIN_ROLES = new Set(['super_admin', 'master_admin', 'office_admin', 'admin'])
const STAFF_ROLES = new Set(['super_admin', 'master_admin', 'office_admin', 'admin', 'records_admin'])

export const corsJsonHeaders = {
  'Content-Type': 'application/json',
}

export async function getAuthorizedUser(request, supabaseUrl, serviceKey) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: authHeader },
  })
  if (!userRes.ok) return null

  const user = await userRes.json().catch(() => null)
  if (!user) return null

  const role = user.user_metadata?.role || user.app_metadata?.role || null
  return {
    id: user.id,
    email: user.email,
    role,
    user,
  }
}

export function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || '').toLowerCase())
}

export function isStaffRole(role) {
  return STAFF_ROLES.has(String(role || '').toLowerCase())
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsJsonHeaders, ...extraHeaders },
  })
}
