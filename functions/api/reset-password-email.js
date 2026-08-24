// Cloudflare Pages Function — POST /api/reset-password-email
// Sends branded password reset email via Resend

const RATE_LIMIT_KEY = 'password_reset_rate_limit'
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_REQUESTS_PER_IP = 5
const MAX_REQUESTS_PER_EMAIL = 3

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

async function sha256Hex(value) {
  if (!value) return null
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getRequestIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || ''
}

async function getRateLimitState(supabaseUrl, serviceKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_config?config_key=eq.${RATE_LIMIT_KEY}&select=config_value&limit=1`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  )
  if (!res.ok) return { byIp: {}, byEmail: {} }
  const rows = await res.json().catch(() => [])
  return rows?.[0]?.config_value || { byIp: {}, byEmail: {} }
}

async function saveRateLimitState(supabaseUrl, serviceKey, state) {
  await fetch(`${supabaseUrl}/rest/v1/app_config?on_conflict=config_key`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      config_key: RATE_LIMIT_KEY,
      config_value: state,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {})
}

function pruneRateLimitState(state, now = Date.now()) {
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const pruneMap = (map = {}) =>
    Object.fromEntries(
      Object.entries(map).map(([key, timestamps]) => [
        key,
        Array.isArray(timestamps) ? timestamps.filter((ts) => Number(ts) >= cutoff) : [],
      ]).filter(([, timestamps]) => timestamps.length > 0),
    )

  return {
    byIp: pruneMap(state?.byIp),
    byEmail: pruneMap(state?.byEmail),
  }
}

function isRateLimited(state, ipHash, emailHash) {
  const ipCount = ipHash ? (state.byIp?.[ipHash]?.length || 0) : 0
  const emailCount = emailHash ? (state.byEmail?.[emailHash]?.length || 0) : 0
  return ipCount >= MAX_REQUESTS_PER_IP || emailCount >= MAX_REQUESTS_PER_EMAIL
}

function recordRateLimitHit(state, ipHash, emailHash, now = Date.now()) {
  const next = {
    byIp: { ...(state.byIp || {}) },
    byEmail: { ...(state.byEmail || {}) },
  }
  if (ipHash) next.byIp[ipHash] = [...(next.byIp[ipHash] || []), now]
  if (emailHash) next.byEmail[emailHash] = [...(next.byEmail[emailHash] || []), now]
  return next
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env, request } = context
  const supabaseUrl = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@northstarsurrogacy.com'

  const { email } = await request.json()
  if (!email) {
    return json({ error: 'Missing email' }, 400)
  }

  // 1. Check user exists
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Not configured' }, 500)
  }

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const ipHash = await sha256Hex(getRequestIp(request))
    const emailHash = await sha256Hex(normalizedEmail)
    const rateLimitState = pruneRateLimitState(await getRateLimitState(supabaseUrl, serviceKey).catch(() => ({ byIp: {}, byEmail: {} })))

    if (isRateLimited(rateLimitState, ipHash, emailHash)) {
      return json({ success: true })
    }

    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const listData = await listRes.json()
    const user = (listData.users || []).find(u => u.email?.toLowerCase() === normalizedEmail)

    const nextRateLimitState = recordRateLimitHit(rateLimitState, ipHash, emailHash)
    await saveRateLimitState(supabaseUrl, serviceKey, nextRateLimitState)

    if (!user) {
      // Don't reveal if user exists — just say "sent"
      return json({ success: true })
    }

    const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there'

    const origin = new URL(context.request.url).origin
    const resetRedirect = `${origin}/reset-password`

    // 2. Generate reset link
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'recovery', email, redirect_to: resetRedirect }),
    })
    const linkData = await linkRes.json()
    let resetLink = linkData?.properties?.action_link || linkData?.action_link || null

    if (!resetLink && linkData?.properties?.hashed_token) {
      resetLink = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(resetRedirect)}`
    }

    if (resetLink && !resetLink.includes('redirect_to')) {
      resetLink += (resetLink.includes('?') ? '&' : '?') + 'redirect_to=' + encodeURIComponent(resetRedirect)
    }

    if (!resetLink) {
      console.error('generate_link response:', JSON.stringify(linkData))
      return json({ error: 'Failed to generate reset link', debug: linkData?.msg || linkData?.error || 'unknown' }, 500)
    }

    // 3. Send branded email via Resend
    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<style>:root { color-scheme: light only } body { background: #ffffff; color-scheme: light only }</style>
</head>
<body style="margin: 0; padding: 0; background: #ffffff;">
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="text-align: center; padding: 32px 24px 16px;">
          <img src="https://app.firststarsurrogacy.com/first-star-logo-email.png" alt="First Star Surrogacy" style="max-width: 320px;" />
        </div>
        <div style="padding: 0 32px 32px;">
          <h1 style="color: #1A3638; font-size: 24px; margin: 0 0 8px; text-align: center;">
            Reset your <span style="color: #D4A853;">password</span>
          </h1>
          <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
            We received a request to reset your password
          </p>

          <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #44403c;">
              Hi ${firstName},
            </p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #44403c;">
              Click the button below to set a new password for your First Star Surrogacy portal at <a href="https://app.firststarsurrogacy.com" style="color: #1A3638; font-weight: 600;">app.firststarsurrogacy.com</a>.
            </p>
            <div style="text-align: center;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
          </div>

          <p style="text-align: center; font-size: 12px; color: #a8a29e; margin: 0 0 24px;">
            This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
          <p style="color: #a8a29e; font-size: 11px; text-align: center;">
            First Star Surrogacy, LLC &middot; <a href="https://firststarsurrogacy.com" style="color: #a8a29e;">firststarsurrogacy.com</a>
          </p>
        </div>
      </div>
    `

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `First Star Surrogacy <${fromEmail}>`,
          to: [email],
          subject: 'Reset your First Star Surrogacy password',
          html: htmlBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) console.error('Resend failed:', data)
    }

    return json({ success: true })
  } catch (err) {
    console.error('Reset password email failed:', err)
    return json({ error: err.message }, 500)
  }
}
