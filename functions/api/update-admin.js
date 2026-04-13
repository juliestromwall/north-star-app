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
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase config' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { userId, name, email, role } = await context.request.json()

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    // Build the update payload
    const updates = {}
    if (name !== undefined) {
      updates.user_metadata = { ...(updates.user_metadata || {}), full_name: name }
    }
    if (role !== undefined) {
      updates.user_metadata = { ...(updates.user_metadata || {}), role }
    }
    if (email !== undefined) {
      updates.email = email
    }

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
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
      return new Response(JSON.stringify({ error: data.msg || data.message || 'Failed to update user' }), {
        status: res.status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ success: true, user: { id: data.id, name: data.user_metadata?.full_name, email: data.email, role: data.user_metadata?.role } }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
