import { getAuthorizedUser, isAdminRole, json } from './_auth'

// Cloudflare Pages Function — GET /api/admin-users
// Lists all admin/master_admin/super_admin users from Supabase Auth

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
  const { env, request } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', users: [] }, 500, corsHeaders)
  }

  const caller = await getAuthorizedUser(request, supabaseUrl, serviceKey)
  if (!caller || !isAdminRole(caller.role)) {
    return json({ error: 'Unauthorized', users: [] }, 401, corsHeaders)
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const data = await res.json()

    if (!res.ok) {
      return json({ error: data.msg || data.message || 'Auth API error', status: res.status, users: [] }, res.status, corsHeaders)
    }

    const allUsers = data.users || []
    const adminRoles = ['super_admin', 'master_admin', 'office_admin', 'admin']
    const admins = allUsers
      .filter(u => adminRoles.includes(u.user_metadata?.role))
      .map(u => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email?.split('@')[0] || '',
        email: u.email,
        role: u.user_metadata?.role || 'admin',
        lastSignIn: u.last_sign_in_at,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Attach each admin's saved avatar URL (stored in app_config under
    // user_prefs_{id}.avatarUrl by SettingsPage/AdminProfileSection).
    // Single batched query — one IN() fetch is cheaper than N round-trips.
    if (admins.length > 0) {
      try {
        const keys = admins.map(a => `user_prefs_${a.id}`)
        const inList = keys.map(k => `"${k}"`).join(',')
        const prefsRes = await fetch(
          `${supabaseUrl}/rest/v1/app_config?config_key=in.(${encodeURIComponent(inList)})&select=config_key,config_value`,
          { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
        )
        if (prefsRes.ok) {
          const rows = await prefsRes.json()
          const avatarByKey = {}
          for (const r of rows) {
            const url = r?.config_value?.avatarUrl
            if (url) avatarByKey[r.config_key] = url
          }
          for (const a of admins) {
            const url = avatarByKey[`user_prefs_${a.id}`]
            if (url) a.avatarUrl = url
          }
        }
      } catch { /* best-effort */ }
    }

    return json(admins, 200, corsHeaders)
  } catch (err) {
    return json({ error: err.message, users: [] }, 500, corsHeaders)
  }
}
