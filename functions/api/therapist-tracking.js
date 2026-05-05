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

// IP intake answers come from a few different form versions over the app's
// life. The first IP's name/email/phone might live under ip1* (newer form),
// primary* (older form), or bare firstName/email/phone — fall back through
// all of them so we don't render a half-empty contact block.
function ip1FirstName(a) { return a.ip1FirstName || a.primaryFirstName || a.firstName || '' }
function ip1LastName(a) { return a.ip1LastName || a.primaryLastName || a.lastName || '' }
function ip1Email(a, ipCase) { return a.ip1Email || a.email || ipCase?.applicant_email || '' }
function ip1Phone(a) { return a.ip1Phone || a.phone || '' }

function ipDisplayName(ipCase) {
  if (!ipCase) return ''
  const a = ipCase.answers || {}
  const ip1 = `${ip1FirstName(a)} ${ip1LastName(a)}`.trim()
  const ip2 = `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim()
  if (ip1 && ip2) return `${ip1} & ${ip2}`
  return ip1 || ip2 || ''
}

// Returns up to two intended parent contact entries for the table's Contact
// cell.
function intendedParentsContacts(ipCase) {
  if (!ipCase) return []
  const a = ipCase.answers || {}
  const list = []
  const name1 = `${ip1FirstName(a)} ${ip1LastName(a)}`.trim()
  const email1 = ip1Email(a, ipCase)
  const phone1 = ip1Phone(a)
  if (name1 || email1 || phone1) {
    list.push({ label: 'Intended Parent 1', name: name1, email: email1, phone: phone1 })
  }
  const name2 = `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim()
  const email2 = a.ip2Email || ''
  const phone2 = a.ip2Phone || ''
  if (name2 || email2 || phone2) {
    list.push({ label: 'Intended Parent 2', name: name2, email: email2, phone: phone2 })
  }
  return list
}

async function resolveJourneyForSurrogate(env, surrogateId) {
  try {
    const jRes = await sbFetch(env, `/rest/v1/matched_journeys?gc_case_id=eq.${surrogateId}&select=id,assigned_to,status,stage,journey_data&order=created_at.desc`)
    if (!jRes.ok) return { caseManagerEmail: '', journeyId: null }
    const rows = await jRes.json()
    const active = (rows || []).find(isActiveMatchedJourney)
    if (!active) return { caseManagerEmail: '', journeyId: null }
    const caseManagerEmail = active.assigned_to || active.journey_data?.assigned_to || ''
    return { caseManagerEmail, journeyId: active.id }
  } catch (e) {
    console.error('Journey resolve failed:', e)
    return { caseManagerEmail: '', journeyId: null }
  }
}

function escapeHtmlForEmail(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function buildSkipNotificationHtml({ kind, patientName, milestoneName, therapistName, skipReason, journeyUrl }) {
  const isWithdraw = kind === 'withdraw'
  const headline = isWithdraw ? `↩️ Skip Withdrawn` : `⏭️ ${milestoneName} Check-In Skipped`
  const sentence = isWithdraw
    ? `${therapistName ? `<strong style="color: #283693;">${therapistName}</strong>` : 'The therapist'} withdrew the previous skip for the <strong>${milestoneName}</strong> check-in for <strong style="color: #283693;">${patientName}</strong>. They are restarting the check-in now and will submit it shortly.`
    : `${therapistName ? `<strong style="color: #283693;">${therapistName}</strong>` : 'The therapist'} marked the <strong>${milestoneName}</strong> check-in for <strong style="color: #283693;">${patientName}</strong> as <strong style="color: #b45309;">Skipped</strong>.`
  const reasonBlock = !isWithdraw && skipReason
    ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0 0 4px; font-size: 10px; color: #92400e; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;">Reason</p>
        <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.5;">${escapeHtmlForEmail(skipReason)}</p>
       </div>`
    : ''
  return `<!DOCTYPE html>
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
    <div style="text-align: center; padding: 24px 24px 12px;">
      <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
    </div>
    <div style="padding: 0 32px 32px;">
      <h1 style="color: #283693; font-size: 22px; margin: 0 0 8px; text-align: center;">${headline}</h1>
      <div style="padding: 24px 0 8px;">
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">${sentence}</p>
        ${reasonBlock}
      </div>
      ${journeyUrl ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${journeyUrl}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">Open Case</a>
      </div>` : ''}
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
      <p style="color: #a8a29e; font-size: 10px; text-align: center;">Abundant Beginnings Company, LLC &middot; abcsurrogacy.com</p>
    </div>
  </div>
</body>
</html>`
}

async function sendAdminSkipEmail(env, { kind, recipient, patientName, milestoneName, therapistName, skipReason, journeyUrl }) {
  const resendKey = env.RESEND_API_KEY
  if (!resendKey || !recipient) return { sent: false, error: !resendKey ? 'RESEND_API_KEY not configured' : 'No recipient' }
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@abcsurrogacy.com'
  const isWithdraw = kind === 'withdraw'
  const subject = isWithdraw
    ? `↩️ Skip Withdrawn — ${milestoneName} for ${patientName}`
    : `⏭️ ${milestoneName} check in for ${patientName} Skipped`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `ABC Surrogacy <${fromEmail}>`,
        to: [recipient],
        subject,
        html: buildSkipNotificationHtml({ kind, patientName, milestoneName, therapistName, skipReason, journeyUrl }),
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return { sent: false, error: `${res.status}: ${errText}` }
    }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e.message }
  }
}

async function loadRows(env) {
  const [tracking, checkins, gcsRes, ipsRes, journeysRes] = await Promise.all([
    getConfig(env, TRACKING_KEY),
    getConfig(env, CHECKINS_KEY),
    sbFetch(env, '/rest/v1/intake_submissions?intake_type=eq.gc&status=in.(qualified,approved,reviewed,pending_review)&select=id,applicant_email,answers&order=submitted_at.desc'),
    sbFetch(env, '/rest/v1/intake_submissions?intake_type=eq.ip&select=id,applicant_email,answers'),
    sbFetch(env, '/rest/v1/matched_journeys?select=id,gc_case_id,ip_case_id,assigned_to,status,stage,journey_data&order=created_at.desc'),
  ])

  if (!gcsRes.ok || !ipsRes.ok || !journeysRes.ok) throw new Error('Unable to load therapist tracking data')

  const gcs = await gcsRes.json()
  const ips = await ipsRes.json()
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

  const ipById = new Map(ips.map(row => [row.id, row]))

  const pregnantRows = journeys
    .filter(j => isActiveMatchedJourney(j) && j.journey_data?.pregnant === 'yes')
    .map(j => {
      const gc = gcById.get(j.gc_case_id)
      if (!gc) return null
      const t = safeTracking[gc.id] || {}
      const jd = j.journey_data || {}
      const assignedEmail = j.assigned_to || jd.assigned_to || ''
      const ipCase = ipById.get(j.ip_case_id)
      // Birth guidelines: legacy `birthGuidelines` maps to GC slot for back-compat.
      const birthGuidelinesGc = t.birthGuidelinesGc || t.birthGuidelines || null
      const birthGuidelinesIp = t.birthGuidelinesIp || null
      return {
        id: gc.id,
        name: gc.name,
        email: gc.email,
        phone: gc.phone,
        archivedAt: jd._archivedAt || null,
        assignedTo: assignedEmail,
        caseManagerName: caseManagerName(assignedEmail),
        caseManagerEmail: assignedEmail,
        ipNames: ipDisplayName(ipCase),
        intendedParents: intendedParentsContacts(ipCase),
        dueDate: jd.dueDate || null,
        deliveryDate: jd.deliveryDate || null,
        ...calcMilestoneDates(jd.dueDate),
        week10: t.week10 || null,
        week20: t.week20 || null,
        week30: t.week30 || null,
        birthGuidelinesGc,
        birthGuidelinesIp,
        // Legacy field for any client that hasn't updated yet.
        birthGuidelines: birthGuidelinesGc,
        postDelivery: t.postDelivery || null,
        customCheckIns: Array.isArray(t.customCheckIns) ? t.customCheckIns : [],
      }
    })
    .filter(Boolean)

  const manualRows = Object.entries(safeTracking)
    .filter(([key, val]) => key.startsWith('manual_') && val?._manual)
    .map(([key, val]) => {
      const birthGuidelinesGc = val.birthGuidelinesGc || val.birthGuidelines || null
      const birthGuidelinesIp = val.birthGuidelinesIp || null
      return {
        id: key,
        name: val.name || 'Unknown',
        email: val.email || '',
        phone: val.phone || '',
        ipNames: val.ipNames || '',
        intendedParents: Array.isArray(val.intendedParents) ? val.intendedParents : [],
        dueDate: val.dueDate || null,
        deliveryDate: val.deliveryDate || null,
        ...calcMilestoneDates(val.dueDate),
        week10: val.week10 || null,
        week20: val.week20 || null,
        week30: val.week30 || null,
        birthGuidelinesGc,
        birthGuidelinesIp,
        birthGuidelines: birthGuidelinesGc,
        postDelivery: val.postDelivery || null,
        customCheckIns: Array.isArray(val.customCheckIns) ? val.customCheckIns : [],
      }
    })

  // Sort by Due Date ascending (soonest first); rows without a dueDate sink
  // to the bottom so Jenny sees the most time-sensitive cases at the top.
  const allRows = [...pregnantRows, ...manualRows].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
  })
  return { rows: allRows, checkins: safeCheckins }
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

    if (action === 'skip') {
      const { skipReason, surrogateName, milestoneName, therapistName, caseManagerEmail } = body || {}
      if (!surrogateId || !milestone) return json({ error: 'Missing required fields' }, 400)
      const checkins = await getConfig(env, CHECKINS_KEY)
      const existing = (checkins || {})[surrogateId]?.[milestone] || {}
      const skippedReport = {
        ...existing,
        status: 'skipped',
        skipReason: skipReason || '',
        skippedAt: new Date().toISOString(),
        skippedBy: therapistName || existing.skippedBy || '',
      }
      const updatedCheckins = {
        ...(checkins || {}),
        [surrogateId]: {
          ...((checkins || {})[surrogateId] || {}),
          [milestone]: skippedReport,
        },
      }
      await setConfig(env, CHECKINS_KEY, updatedCheckins)

      // Best-effort admin notification.
      const journey = await resolveJourneyForSurrogate(env, surrogateId)
      const recipient = caseManagerEmail || journey.caseManagerEmail || ''
      const journeyUrl = journey.journeyId
        ? `https://app.abcsurrogacy.com/journeys/${journey.journeyId}`
        : `https://app.abcsurrogacy.com/surrogates/${surrogateId}`
      const emailResult = await sendAdminSkipEmail(env, {
        kind: 'skip',
        recipient,
        patientName: surrogateName || 'Surrogate',
        milestoneName: milestoneName || 'Check-In',
        therapistName: therapistName || '',
        skipReason: skipReason || '',
        journeyUrl,
      })
      return json({ success: true, adminEmail: emailResult })
    }

    if (action === 'withdraw-skip') {
      const { surrogateName, milestoneName, therapistName, caseManagerEmail } = body || {}
      if (!surrogateId || !milestone) return json({ error: 'Missing required fields' }, 400)
      const checkins = await getConfig(env, CHECKINS_KEY)
      const safeCheckins = checkins || {}
      const surrogateRecord = safeCheckins[surrogateId] || {}
      // Drop the milestone entirely so the cell goes back to "Check In" state.
      const { [milestone]: _removed, ...rest } = surrogateRecord
      const updatedCheckins = { ...safeCheckins, [surrogateId]: rest }
      await setConfig(env, CHECKINS_KEY, updatedCheckins)

      const journey = await resolveJourneyForSurrogate(env, surrogateId)
      const recipient = caseManagerEmail || journey.caseManagerEmail || ''
      const journeyUrl = journey.journeyId
        ? `https://app.abcsurrogacy.com/journeys/${journey.journeyId}`
        : `https://app.abcsurrogacy.com/surrogates/${surrogateId}`
      const emailResult = await sendAdminSkipEmail(env, {
        kind: 'withdraw',
        recipient,
        patientName: surrogateName || 'Surrogate',
        milestoneName: milestoneName || 'Check-In',
        therapistName: therapistName || '',
        skipReason: '',
        journeyUrl,
      })
      return json({ success: true, adminEmail: emailResult })
    }

    if (action === 'add-custom-checkin') {
      const { label, duration } = body || {}
      if (!surrogateId) return json({ error: 'Missing surrogateId' }, 400)
      const tracking = await getConfig(env, TRACKING_KEY)
      const safeTracking = tracking || {}
      const existing = safeTracking[surrogateId] || {}
      const list = Array.isArray(existing.customCheckIns) ? existing.customCheckIns : []
      const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const updated = {
        ...safeTracking,
        [surrogateId]: {
          ...existing,
          customCheckIns: [...list, { id: newId, label: label || 'Misc Consult', duration: duration === 60 ? 60 : 30 }],
        },
      }
      await setConfig(env, TRACKING_KEY, updated)
      return json({ success: true, id: newId })
    }

    if (action === 'remove-custom-checkin') {
      const { checkInId } = body || {}
      if (!surrogateId || !checkInId) return json({ error: 'Missing required fields' }, 400)
      const tracking = await getConfig(env, TRACKING_KEY)
      const safeTracking = tracking || {}
      const existing = safeTracking[surrogateId] || {}
      const list = Array.isArray(existing.customCheckIns) ? existing.customCheckIns : []
      const updated = {
        ...safeTracking,
        [surrogateId]: {
          ...existing,
          customCheckIns: list.filter(c => c.id !== checkInId),
        },
      }
      await setConfig(env, TRACKING_KEY, updated)
      // Also clean up any check-in report attached to this custom slot
      const checkins = await getConfig(env, CHECKINS_KEY)
      if (checkins?.[surrogateId]?.[checkInId]) {
        const updatedCheckins = {
          ...checkins,
          [surrogateId]: { ...checkins[surrogateId] },
        }
        delete updatedCheckins[surrogateId][checkInId]
        await setConfig(env, CHECKINS_KEY, updatedCheckins)
      }
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('Therapist tracking handler error:', err)
    return json({ error: 'Unable to process therapist tracking request' }, 500)
  }
}
