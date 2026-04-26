const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

async function isAuthorized(request, supabaseUrl, supabaseKey) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: authHeader },
  })
  return userRes.ok
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env, request } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Supabase not configured' }, 500)
  }

  if (!await isAuthorized(request, supabaseUrl, serviceKey)) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  try {
    const { fromCaseId, journeyId, createdBy } = await request.json().catch(() => ({}))
    if (!fromCaseId) return json({ ok: false, error: 'Missing fromCaseId' }, 400)

    const sbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }

    const oldCaseRes = await fetch(
      `${supabaseUrl}/rest/v1/intake_submissions?id=eq.${encodeURIComponent(fromCaseId)}&select=*`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    )
    const oldCaseRows = await oldCaseRes.json().catch(() => [])
    const oldCase = Array.isArray(oldCaseRows) ? oldCaseRows[0] : null
    if (!oldCaseRes.ok || !oldCase) {
      return json({ ok: false, error: 'Source case not found' }, oldCaseRes.status || 404)
    }

    const nowIso = new Date().toISOString()
    const newAnswers = {
      ...(oldCase.answers || {}),
      _continuedFromCaseId: fromCaseId,
      _continuedFromJourneyId: journeyId || null,
      _continuedAt: nowIso,
      _continuedBy: createdBy || null,
    }

    const newSubmission = {
      intake_type: oldCase.intake_type,
      status: oldCase.status || 'qualified',
      qualified: oldCase.qualified !== false,
      applicant_name: oldCase.applicant_name,
      applicant_email: oldCase.applicant_email,
      applicant_phone: oldCase.applicant_phone,
      answers: newAnswers,
      submitted_at: nowIso,
      assigned_to: oldCase.assigned_to,
      referral_partner: oldCase.referral_partner,
      state_region: oldCase.state_region,
      dq_reasons: Array.isArray(oldCase.dq_reasons) ? oldCase.dq_reasons : [],
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/intake_submissions`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify(newSubmission),
    })
    const inserted = await insertRes.json().catch(() => null)
    const newCase = Array.isArray(inserted) ? inserted[0] : inserted
    if (!insertRes.ok || !newCase) {
      return json({ ok: false, error: inserted?.message || 'Failed to create new case' }, insertRes.status || 500)
    }

    if (journeyId) {
      const journeyRes = await fetch(
        `${supabaseUrl}/rest/v1/matched_journeys?id=eq.${encodeURIComponent(journeyId)}&select=journey_data`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      )
      const journeyRows = await journeyRes.json().catch(() => [])
      const oldJourney = Array.isArray(journeyRows) ? journeyRows[0] : null
      if (oldJourney) {
        const updatedJd = {
          ...(oldJourney.journey_data || {}),
          _newCaseStartedId: newCase.id,
          _newCaseStartedAt: nowIso,
          _newCaseStartedBy: createdBy || null,
        }
        await fetch(`${supabaseUrl}/rest/v1/matched_journeys?id=eq.${encodeURIComponent(journeyId)}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ journey_data: updatedJd }),
        })
      }
    }

    return json({ ok: true, data: newCase })
  } catch (err) {
    return json({ ok: false, error: err.message || 'Failed to start new case' }, 500)
  }
}
