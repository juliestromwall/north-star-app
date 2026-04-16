// Cloudflare Pages Function - POST /api/therapist-tracking
// Password-gated shared therapist tracking access. Returns only the minimum
// fields needed by the shared check-in sheet and performs writes server-side.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const TRACKING_KEY = 'psych_tracking'
const CHECKINS_KEY = 'psych_checkins'
const SHARE_KEY = 'psych_tracking_share'

function isActiveMatchedJourney(journey) {
  const status = String(journey?.status || '').toLowerCase()
  const stage = String(journey?.stage || '').toLowerCase()
  const state = `${status} ${stage}`
  return !/(broken|cancelled|canceled|failed|terminated|dissolved)/.test(state)
}
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function b64url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function sha256(value) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return b64url(new Uint8Array(sig))
}

async function makeSession(secret, token) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    token,
    exp: Date.now() + SESSION_TTL_MS,
  })))
  const sig = await hmac(secret, payload)
  return `${payload}.${sig}`
}

async function verifySession(secret, sessionToken, expectedShareToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return false
  const [payload, sig] = sessionToken.split('.')
  if (!payload || !sig) return false
  const expectedSig = await hmac(secret, payload)
  if (sig !== expectedSig) return false
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)))
    return data.token === expectedShareToken && Number(data.exp) > Date.now()
  } catch {
    return false
  }
}

async function sbFetch(env, path, options = {}) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(options.headers || {}),
  }
  return fetch(`${url}${path}`, { ...options, headers })
}

async function getConfig(env, key) {
  const res = await sbFetch(env, `/rest/v1/app_config?config_key=eq.${encodeURIComponent(key)}&select=config_value`)
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0]?.config_value ?? null
}

async function setConfig(env, key, value) {
  const res = await sbFetch(env, '/rest/v1/app_config?on_conflict=config_key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ config_key: key, config_value: value, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(await res.text())
  const rows = await res.json()
  return rows?.[0] || null
}

function calcMilestoneDates(dueDate) {
  if (!dueDate) return {}
  const due = new Date(`${dueDate}T00:00:00`)
  const conceptionMs = due.getTime() - 280 * 24 * 60 * 60 * 1000
  const fmt = (ms) => new Date(ms).toISOString().split('T')[0]
  return {
    week10Date: fmt(conceptionMs + 70 * 24 * 60 * 60 * 1000),
    week20Date: fmt(conceptionMs + 140 * 24 * 60 * 60 * 1000),
    week30Date: fmt(conceptionMs + 210 * 24 * 60 * 60 * 1000),
  }
}

function caseManagerName(email) {
  if (!email) return ''
  const prefix = email.split('@')[0]
  return prefix.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

async function loadRows(env) {
  const [tracking, checkins, gcsRes, journeysRes] = await Promise.all([
    getConfig(env, TRACKING_KEY),
    getConfig(env, CHECKINS_KEY),
    sbFetch(env, '/rest/v1/intake_submissions?intake_type=eq.gc&status=in.(qualified,approved,reviewed,pending_review)&select=id,applicant_email,answers&order=submitted_at.desc'),
    sbFetch(env, '/rest/v1/matched_journeys?select=id,gc_case_id,assigned_to,status,stage,journey_data&order=created_at.desc'),
  ])

  if (!gcsRes.ok || !journeysRes.ok) throw new Error('Unable to load therapist tracking data')

  const gcs = await gcsRes.json()
  const journeys = await journeysRes.json()
  const safeTracking = tracking || {}
  const safeCheckins = checkins || {}

  const gcById = new Map(gcs.map(row => {
    const a = row.answers || {}
    return [row.id, {
      id: row.id,
      name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown',
      email: row.applicant_email || a.email || '',
      phone: a.phone || '',
    }]
  }))

  const pregnantRows = journeys
    .filter(j => isActiveMatchedJourney(j) && j.journey_data?.pregnant === 'yes')
    .map(j => {
      const gc = gcById.get(j.gc_case_id)
      if (!gc) return null
      const t = safeTracking[gc.id] || {}
      const jd = j.journey_data || {}
      const assignedEmail = j.assigned_to || jd.assigned_to || ''
      return {
        id: gc.id,
        name: gc.name,
        email: gc.email,
        phone: gc.phone,
        assignedTo: assignedEmail,
        caseManagerName: caseManagerName(assignedEmail),
        caseManagerEmail: assignedEmail,
        dueDate: jd.dueDate || null,
        deliveryDate: jd.deliveryDate || null,
        ...calcMilestoneDates(jd.dueDate),
        week10: t.week10 || null,
        week20: t.week20 || null,
        week30: t.week30 || null,
        birthGuidelines: t.birthGuidelines || null,
        postDelivery: t.postDelivery || null,
      }
    })
    .filter(Boolean)

  const manualRows = Object.entries(safeTracking)
    .filter(([key, val]) => key.startsWith('manual_') && val?._manual)
    .map(([key, val]) => ({
      id: key,
      name: val.name || 'Unknown',
      email: val.email || '',
      phone: val.phone || '',
      dueDate: val.dueDate || null,
      deliveryDate: val.deliveryDate || null,
      ...calcMilestoneDates(val.dueDate),
      week10: val.week10 || null,
      week20: val.week20 || null,
      week30: val.week30 || null,
      birthGuidelines: val.birthGuidelines || null,
      postDelivery: val.postDelivery || null,
    }))

  return { rows: [...pregnantRows, ...manualRows], checkins: safeCheckins }
}

async function requireSession(env, sessionToken) {
  const shareData = await getConfig(env, SHARE_KEY)
  if (!shareData?.token) return { ok: false, response: json({ error: 'Invalid share link' }, 404) }
  const ok = await verifySession(env.SUPABASE_SERVICE_ROLE_KEY, sessionToken, shareData.token)
  if (!ok) return { ok: false, response: json({ error: 'Session expired' }, 401) }
  return { ok: true, shareData }
}

export async function onRequestPost(context) {
  const { env } = context
  if (!(env.SUPABASE_URL || env.VITE_SUPABASE_URL) || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Supabase not configured' }, 500)
  }

  try {
    const body = await context.request.json()
    const { action, token, password, sessionToken, surrogateId, milestone, report } = body || {}

    if (action === 'status') {
      const shareData = await getConfig(env, SHARE_KEY)
      if (!shareData?.token || shareData.token !== token) return json({ valid: false }, 404)
      return json({ valid: true, needsSetup: !shareData.passwordHash })
    }

    if (action === 'set-password') {
      const shareData = await getConfig(env, SHARE_KEY)
      if (!shareData?.token || shareData.token !== token) return json({ error: 'Invalid share link' }, 404)
      if (shareData.passwordHash) return json({ error: 'Password already set' }, 409)
      if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
      const updated = { ...shareData, passwordHash: await sha256(password), passwordSetAt: new Date().toISOString() }
      await setConfig(env, SHARE_KEY, updated)
      const newSession = await makeSession(env.SUPABASE_SERVICE_ROLE_KEY, token)
      return json({ sessionToken: newSession })
    }

    if (action === 'login') {
      const shareData = await getConfig(env, SHARE_KEY)
      if (!shareData?.token || shareData.token !== token) return json({ error: 'Invalid share link' }, 404)
      if (!shareData.passwordHash) return json({ error: 'Password has not been set' }, 400)
      if (await sha256(password || '') !== shareData.passwordHash) return json({ error: 'Incorrect password' }, 401)
      const newSession = await makeSession(env.SUPABASE_SERVICE_ROLE_KEY, token)
      return json({ sessionToken: newSession })
    }

    const session = await requireSession(env, sessionToken)
    if (!session.ok) return session.response

    if (action === 'load') {
      return json(await loadRows(env))
    }

    if (action === 'save-draft' || action === 'complete') {
      if (!surrogateId || !milestone || !report) return json({ error: 'Missing required fields' }, 400)
      const [tracking, checkins] = await Promise.all([
        getConfig(env, TRACKING_KEY),
        getConfig(env, CHECKINS_KEY),
      ])

      const updatedCheckins = {
        ...(checkins || {}),
        [surrogateId]: {
          ...((checkins || {})[surrogateId] || {}),
          [milestone]: report,
        },
      }
      await setConfig(env, CHECKINS_KEY, updatedCheckins)

      if (action === 'complete') {
        const today = new Date().toISOString().split('T')[0]
        const updatedTracking = {
          ...(tracking || {}),
          [surrogateId]: {
            ...((tracking || {})[surrogateId] || {}),
            [milestone]: today,
          },
        }
        await setConfig(env, TRACKING_KEY, updatedTracking)
      }

      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('Therapist tracking handler error:', err)
    return json({ error: 'Unable to process therapist tracking request' }, 500)
  }
}
