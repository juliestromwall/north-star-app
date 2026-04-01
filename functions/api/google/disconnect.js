// Cloudflare Pages Function — POST /api/google/disconnect
// Revokes Google tokens and removes from Supabase

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
    // Fetch current token to revoke it
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${user_id}&select=access_token`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    )
    const tokens = await fetchRes.json()

    // Revoke token with Google (best effort)
    if (tokens.length && tokens[0].access_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens[0].access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(() => {})
    }

    // Delete from Supabase
    await fetch(
      `${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${user_id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    )

    return new Response(JSON.stringify({ success: true }), {
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
