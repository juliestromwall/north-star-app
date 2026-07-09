import { getAuthorizedUser, isAdminRole, json } from './_auth'

// Cloudflare Pages Function — POST /api/invite
// Creates a Supabase auth user and generates a password reset link

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env, request } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500, corsHeaders)
  }

  const caller = await getAuthorizedUser(request, supabaseUrl, serviceKey)
  if (!caller || !isAdminRole(caller.role)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  const { email, name, role } = await request.json()
  const origin = new URL(request.url).origin
  const resetRedirect = `${origin}/reset-password`

  if (!email) {
    return json({ error: 'Email is required' }, 400, corsHeaders)
  }

  try {
    // 1. Check if user already exists
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const listData = await listRes.json()
      const existing = (listData.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (existing) {
      return json({ error: 'User already has an account' }, 400, corsHeaders)
    }

    // 2. Create user with temp password
    const tempPassword = crypto.randomUUID().slice(0, 16) + '!A1'
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: name || '', role: role || 'surrogate' },
        // app_metadata is NOT user-editable — it's the trusted source for RLS
        // policies (e.g. intake_submissions visibility). Keep it in sync.
        app_metadata: { role: role || 'surrogate' },
      }),
    })
    const createData = await createRes.json()
    if (!createRes.ok) throw new Error(createData.msg || createData.message || 'Failed to create user')

    // 3. Generate password reset link
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'recovery',
        email,
        redirect_to: resetRedirect,
      }),
    })
    const linkData = await linkRes.json()
    let resetLink = linkData?.properties?.action_link || linkData?.action_link || null
    if (resetLink && !resetLink.includes('redirect_to')) {
      resetLink += (resetLink.includes('?') ? '&' : '?') + 'redirect_to=' + encodeURIComponent(resetRedirect)
    }

    return json({
      success: true,
      userId: createData.id,
      resetLink,
    }, 200, corsHeaders)
  } catch (err) {
    return json({ error: err.message || 'Failed to create invite' }, 500, corsHeaders)
  }
}
