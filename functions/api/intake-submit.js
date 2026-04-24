const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const MIN_FORM_TIME_SECONDS = 15
const RAPID_FILL_MAX_COUNT = 10
const MIN_FIELD_CHANGES = 5
const RECENT_WINDOW_HOURS = 24
const MAX_SUBMISSIONS_PER_IP = 3
const MAX_SUBMISSIONS_PER_EMAIL = 2

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET
  if (!secret) return { configured: false, success: false }
  if (!token) return { configured: true, success: false }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json().catch(() => ({}))
  return {
    configured: true,
    success: !!data.success,
    errors: data['error-codes'] || [],
  }
}

async function sha256Hex(value) {
  if (!value) return null
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fetchRecentSubmissions(supabaseUrl, serviceKey) {
  const since = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const res = await fetch(
    `${supabaseUrl}/rest/v1/intake_submissions?submitted_at=gte.${encodeURIComponent(since)}&select=applicant_email,answers,submitted_at&order=submitted_at.desc&limit=200`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  )
  if (!res.ok) return []
  return res.json().catch(() => [])
}

function getRecentRejectReason(recentRows, submission, ipHash) {
  const normalizedEmail = (submission?.applicant_email || '').trim().toLowerCase()
  const sameEmailCount = recentRows.filter((row) => (row?.applicant_email || '').trim().toLowerCase() === normalizedEmail).length
  if (normalizedEmail && sameEmailCount >= MAX_SUBMISSIONS_PER_EMAIL) return 'duplicate_email_recent'

  const sameIpCount = ipHash
    ? recentRows.filter((row) => row?.answers?._botMeta?.ipHash && row.answers._botMeta.ipHash === ipHash).length
    : 0
  if (ipHash && sameIpCount >= MAX_SUBMISSIONS_PER_IP) return 'rate_limited_ip'

  return null
}

function shouldRejectBot(bot = {}, turnstile) {
  const browser = bot.browser || 'Other'
  if ((bot.honeypotValue || '').trim()) return 'honeypot'
  if ((bot.elapsedSeconds || 0) < MIN_FORM_TIME_SECONDS) return 'too_fast'
  if ((bot.maxRapidFillCount || 0) >= RAPID_FILL_MAX_COUNT) return 'rapid_fill'
  if ((bot.fieldChangeCount || 0) < MIN_FIELD_CHANGES) return 'too_few_interactions'
  if (turnstile.configured && browser !== 'Safari' && !turnstile.success) return 'turnstile_failed'
  return null
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env, request } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Server not configured' }, 500)
  }

  const payload = await request.json().catch(() => null)
  const submission = payload?.submission
  const bot = payload?.bot || {}

  if (!submission?.intake_type || !submission?.applicant_email) {
    return json({ ok: false, error: 'Missing submission data' }, 400)
  }

  let turnstile = { configured: false, success: false }
  try {
    turnstile = await verifyTurnstile(env, bot.turnstileToken, request.headers.get('CF-Connecting-IP') || '')
  } catch {}

  const rejectReason = shouldRejectBot(bot, turnstile)
  if (rejectReason) {
    return json({ ok: true, accepted: false, reason: rejectReason })
  }

  const ipHash = await sha256Hex(request.headers.get('CF-Connecting-IP') || '')
  const recentRows = await fetchRecentSubmissions(supabaseUrl, serviceKey).catch(() => [])
  const recentRejectReason = getRecentRejectReason(recentRows, submission, ipHash)
  if (recentRejectReason) {
    return json({ ok: true, accepted: false, reason: recentRejectReason })
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  const row = {
    ...submission,
    answers: {
      ...(submission.answers || {}),
      _botMeta: {
        elapsedSeconds: bot.elapsedSeconds || null,
        fieldChangeCount: bot.fieldChangeCount || 0,
        maxRapidFillCount: bot.maxRapidFillCount || 0,
        browser: bot.browser || null,
        ipHash,
        turnstileVerified: !!turnstile.success,
        turnstileErrors: turnstile.errors || [],
      },
    },
  }

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/intake_submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(row),
  })

  const insertData = await insertRes.json().catch(() => null)
  if (!insertRes.ok) {
    return json({ ok: false, error: insertData?.message || 'Insert failed' }, 500)
  }

  return json({ ok: true, accepted: true, data: insertData })
}
