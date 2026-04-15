// Cloudflare Pages Function — GET /api/admin-phones
// Returns admin users that have a Twilio phone configured in app_config

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    // Fetch all user_prefs rows from app_config
    const prefsRes = await fetch(
      `${supabaseUrl}/rest/v1/app_config?config_key=like.user_prefs_*&select=config_key,config_value`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    )
    const prefsData = await prefsRes.json()

    if (!prefsRes.ok) {
      return new Response(JSON.stringify({ error: prefsData.message || 'Failed to fetch app_config' }), {
        status: prefsRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Build a map of userId -> twilioPhone from prefs
    const phoneMap = {}
    for (const row of prefsData) {
      try {
        const userId = row.config_key.replace('user_prefs_', '')
        const val = typeof row.config_value === 'string' ? JSON.parse(row.config_value) : row.config_value
        if (val?.twilioPhone) {
          phoneMap[userId] = val.twilioPhone
        }
      } catch {
        // skip malformed rows
      }
    }

    // If no phones configured, return empty
    if (Object.keys(phoneMap).length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Fetch admin users from Supabase Auth
    const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    })
    const usersData = await usersRes.json()

    if (!usersRes.ok) {
      return new Response(JSON.stringify({ error: usersData.msg || usersData.message || 'Auth API error' }), {
        status: usersRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const allUsers = usersData.users || []
    const adminRoles = ['super_admin', 'master_admin', 'office_admin', 'admin']

    // Join: only admins that have a phone configured
    const result = allUsers
      .filter(u => adminRoles.includes(u.user_metadata?.role) && phoneMap[u.id])
      .map(u => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email?.split('@')[0] || '',
        email: u.email,
        phone: phoneMap[u.id],
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
