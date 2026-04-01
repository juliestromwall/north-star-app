// Cloudflare Pages Function — GET /api/google/auth
// Redirects the user to Google's OAuth consent screen

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)

  const clientId = env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get the user_id from query param (passed by frontend)
  const userId = url.searchParams.get('user_id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build callback URL based on current origin
  const redirectUri = `${url.origin}/api/google/callback`

  // Scopes for Gmail + Calendar + Drive
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.file',
  ].join(' ')

  // State parameter carries user_id back through the callback
  const state = JSON.stringify({ user_id: userId })

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', clientId)
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', scopes)
  googleAuthUrl.searchParams.set('state', state)
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  return Response.redirect(googleAuthUrl.toString(), 302)
}
