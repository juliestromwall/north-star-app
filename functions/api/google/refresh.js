// Cloudflare Pages Function — POST /api/google/refresh
// Refreshes an expired Google access token and updates Supabase

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestPost(context) {
  const { env } = context
  const { user_id } = await context.request.json()

  if (!user_id) {
    return new Response(JSON.stringify({ error: 'Missing user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const supabaseUrl = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  try {
    // Fetch current tokens
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${user_id}&select=*`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    )
    const rows = await fetchRes.json()

    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'No Google account connected' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { refresh_token, token_expires_at } = rows[0]

    // Check if token is still valid (with 5 min buffer)
    const expiresAt = new Date(token_expires_at)
    if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      return new Response(JSON.stringify({
        access_token: rows[0].access_token,
        expires_at: token_expires_at,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Refresh the token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }).toString(),
    })

    const newTokens = await tokenRes.json()

    if (!tokenRes.ok || !newTokens.access_token) {
      return new Response(JSON.stringify({ error: 'Token refresh failed', detail: newTokens }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()

    // Update in Supabase
    await fetch(
      `${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${user_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          access_token: newTokens.access_token,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        }),
      }
    )

    return new Response(JSON.stringify({
      access_token: newTokens.access_token,
      expires_at: newExpiresAt,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}
