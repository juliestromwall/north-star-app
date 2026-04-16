// Cloudflare Pages Function — GET /api/google/callback
// Handles Google OAuth callback: exchanges code for tokens, stores in Supabase

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)

  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // If user denied access
  if (error) {
    return Response.redirect(`${url.origin}/settings?google=denied`, 302)
  }

  if (!code || !stateRaw) {
    return Response.redirect(`${url.origin}/settings?google=error`, 302)
  }

  let state
  try {
    state = JSON.parse(stateRaw)
  } catch {
    return Response.redirect(`${url.origin}/settings?google=error`, 302)
  }

  const userId = state.user_id
  if (!userId) {
    return Response.redirect(`${url.origin}/settings?google=error`, 302)
  }

  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET
  const redirectUri = `${url.origin}/api/google/callback`

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok || !tokens.access_token) {
      console.error('Token exchange failed:', tokens)
      return Response.redirect(`${url.origin}/settings?google=error`, 302)
    }

    // Get the user's Google email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoRes.json()

    // Calculate expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store tokens in Supabase via service role key
    const supabaseUrl = env.SUPABASE_URL
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

    // If Google didn't return a refresh_token (rare with prompt=consent, but possible),
    // delete the old row first so we don't keep the stale refresh_token. The user will need to reconnect.
    if (!tokens.refresh_token) {
      console.error('No refresh_token in Google response. Cannot save tokens. Detail:', tokens)
      return Response.redirect(`${url.origin}/settings?google=no_refresh_token`, 302)
    }

    // Delete any existing row for this user first, then insert fresh.
    // This avoids any upsert/conflict issues and guarantees a clean slate.
    await fetch(
      `${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
      }
    )

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/google_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        google_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scopes: tokens.scope || '',
        updated_at: new Date().toISOString(),
      }),
    })

    if (!insertRes.ok) {
      const err = await insertRes.text()
      console.error('Supabase insert failed:', err)
      return Response.redirect(`${url.origin}/settings?google=error&detail=${encodeURIComponent(err.slice(0, 200))}`, 302)
    }

    return Response.redirect(`${url.origin}/settings?google=success`, 302)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return Response.redirect(`${url.origin}/settings?google=error`, 302)
  }
}
