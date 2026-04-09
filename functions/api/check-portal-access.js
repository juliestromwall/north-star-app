// Cloudflare Pages Function — POST /api/check-portal-access
// Checks if a surrogate's case is in a blocked stage (not-qualified, withdrawn)
// Uses service role key to bypass RLS

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ blocked: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { email } = await context.request.json()
  if (!email) {
    return new Response(JSON.stringify({ blocked: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // Get case ID from intake_submissions
    const intakeRes = await fetch(
      `${supabaseUrl}/rest/v1/intake_submissions?applicant_email=eq.${encodeURIComponent(email.toLowerCase())}&order=submitted_at.desc&limit=1&select=id`,
      { headers }
    )
    const intakeData = await intakeRes.json()
    const caseId = intakeData?.[0]?.id
    if (!caseId) {
      return new Response(JSON.stringify({ blocked: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Get stage statuses from app_config
    const configRes = await fetch(
      `${supabaseUrl}/rest/v1/app_config?config_key=eq.surrogate_stages&select=config_value`,
      { headers }
    )
    const configData = await configRes.json()
    const stages = configData?.[0]?.config_value
    const caseStage = stages?.[caseId]?.stage

    const blockedStages = ['not-qualified', 'withdrawn']
    const blocked = caseStage && blockedStages.includes(caseStage)

    return new Response(JSON.stringify({ blocked: !!blocked, stage: caseStage || null }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ blocked: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
