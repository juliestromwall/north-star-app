import { getAuthorizedUser, isAdminRole, json } from './_auth'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

function buildSurrogateSubmission(caseData) {
  return {
    intake_type: 'gc',
    status: 'qualified',
    qualified: true,
    applicant_name: `${caseData.firstName || ''} ${caseData.lastName || ''}`.trim(),
    applicant_email: String(caseData.email || '').trim().toLowerCase(),
    applicant_phone: caseData.phone || '',
    answers: {
      firstName: caseData.firstName || '',
      lastName: caseData.lastName || '',
      email: caseData.email || '',
      phone: caseData.phone || '',
      state: caseData.state || '',
      dob: caseData.dob || null,
      applicationDate: caseData.applicationDate || null,
    },
    submitted_at: caseData.applicationDate
      ? new Date(`${caseData.applicationDate}T00:00:00`).toISOString()
      : new Date().toISOString(),
    assigned_to: caseData.assignedTo || null,
    referral_partner: caseData.referralPartner || null,
    state_region: caseData.state || '',
    dq_reasons: [],
  }
}

function buildIpSubmission(caseData) {
  const hasPartner = !!String(caseData.ip2FirstName || '').trim()
  const ip1Name = `${caseData.firstName || ''} ${caseData.lastName || ''}`.trim()
  const ip2Name = hasPartner ? `${caseData.ip2FirstName || ''} ${caseData.ip2LastName || ''}`.trim() : ''

  return {
    intake_type: 'ip',
    status: 'qualified',
    qualified: true,
    applicant_name: hasPartner ? `${ip1Name} & ${ip2Name}` : ip1Name,
    applicant_email: String(caseData.email || '').trim().toLowerCase(),
    applicant_phone: caseData.phone || '',
    answers: {
      primaryFirstName: caseData.firstName || '',
      primaryLastName: caseData.lastName || '',
      email: caseData.email || '',
      phone: caseData.phone || '',
      country: caseData.country || 'United States',
      city: caseData.city || '',
      stateProv: caseData.state || '',
      hasPartner: hasPartner ? 'yes' : 'no',
      ...(hasPartner ? {
        ip2FirstName: caseData.ip2FirstName || '',
        ip2LastName: caseData.ip2LastName || '',
        ip2Email: caseData.ip2Email || '',
        ip2Phone: caseData.ip2Phone || '',
      } : {}),
      applicationDate: caseData.applicationDate || null,
    },
    submitted_at: caseData.applicationDate
      ? new Date(`${caseData.applicationDate}T00:00:00`).toISOString()
      : new Date().toISOString(),
    assigned_to: caseData.assignedTo || null,
    state_region: caseData.state || '',
    dq_reasons: [],
  }
}

export async function onRequestPost(context) {
  const { env, request } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Supabase not configured' }, 500, corsHeaders)
  }

  const requester = await getAuthorizedUser(request, supabaseUrl, serviceKey)
  if (!requester || !isAdminRole(requester.role)) {
    return json({ ok: false, error: 'Unauthorized' }, 401, corsHeaders)
  }

  try {
    const { caseType, caseData } = await request.json().catch(() => ({}))
    if (!caseType || !caseData) return json({ ok: false, error: 'Missing caseType or caseData' }, 400, corsHeaders)
    if (!caseData.firstName || !caseData.email) return json({ ok: false, error: 'Missing required fields' }, 400, corsHeaders)

    const submission = caseType === 'ip'
      ? buildIpSubmission(caseData)
      : caseType === 'gc'
        ? buildSurrogateSubmission(caseData)
        : null

    if (!submission) return json({ ok: false, error: 'Unsupported case type' }, 400, corsHeaders)

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/intake_submissions`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(submission),
    })
    const insertData = await insertRes.json().catch(() => null)
    const row = Array.isArray(insertData) ? insertData[0] : insertData

    if (!insertRes.ok || !row) {
      return json({ ok: false, error: insertData?.message || 'Failed to create case' }, insertRes.status || 500, corsHeaders)
    }

    return json({ ok: true, data: row }, 200, corsHeaders)
  } catch (err) {
    return json({ ok: false, error: err.message || 'Failed to create case' }, 500, corsHeaders)
  }
}
