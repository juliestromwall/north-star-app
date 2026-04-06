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
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const data = await res.json()

    const adminRoles = ['super_admin', 'master_admin', 'admin', 'marketing']
    const admins = (data.users || [])
      .filter(u => adminRoles.includes(u.user_metadata?.role))
      .map(u => ({
        id: u.id,
        name: u.user_metadata?.full_name || u.email?.split('@')[0] || '',
        email: u.email,
        role: u.user_metadata?.role || 'admin',
        lastSignIn: u.last_sign_in_at,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return new Response(JSON.stringify(admins), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
