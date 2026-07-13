import { getAuthorizedUser, json } from './_auth'

// Cloudflare Pages Function — POST /api/update-admin
// Updates an admin user's name, email, or role in Supabase Auth

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
    return json({ error: 'Missing Supabase config' }, 400, corsHeaders)
  }

  const caller = await getAuthorizedUser(request, supabaseUrl, serviceKey)
  const callerRole = String(caller?.role || '').toLowerCase()
  if (!caller || !['super_admin', 'master_admin', 'office_admin'].includes(callerRole)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  const { userId, oldEmail, name, email, role } = await request.json()

  let targetUserId = userId

  // If no userId but oldEmail provided, look up user by email
  if (!targetUserId && oldEmail) {
    try {
      const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      })
      const listData = await listRes.json()
      const found = (listData.users || []).find(u => u.email?.toLowerCase() === oldEmail.toLowerCase())
      if (found) targetUserId = found.id
    } catch {}
  }

  if (!targetUserId) {
    return json({ error: 'userId is required (or user not found by oldEmail)' }, 400, corsHeaders)
  }

  try {
    // Build the update payload
    const updates = {}
    if (name !== undefined) {
      updates.user_metadata = { ...(updates.user_metadata || {}), full_name: name }
    }
    if (role !== undefined) {
      updates.user_metadata = { ...(updates.user_metadata || {}), role }
      // Keep app_metadata.role in sync — it's the trusted (non-user-editable)
      // claim used by RLS policies for applicant visibility.
      updates.app_metadata = { ...(updates.app_metadata || {}), role }
    }
    if (email !== undefined) {
      updates.email = email
    }

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    const data = await res.json()

    if (!res.ok) {
      return json({ error: data.msg || data.message || 'Failed to update user' }, res.status, corsHeaders)
    }

    return json({ success: true, user: { id: data.id, name: data.user_metadata?.full_name, email: data.email, role: data.user_metadata?.role } }, 200, corsHeaders)
  } catch (err) {
    return json({ error: err.message }, 500, corsHeaders)
  }
}
