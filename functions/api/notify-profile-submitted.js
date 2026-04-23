// Cloudflare Pages Function — POST /api/notify-profile-submitted
// Notifies admin team when a surrogate submits their profile for review
// Also logs "Profile Complete" on the checklist as "reviewing"

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
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@abcsurrogacy.com'
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

  const { surrogateName, surrogateEmail, caseId } = await context.request.json()

  if (!resendKey || !surrogateName) {
    return new Response(JSON.stringify({ error: 'Missing data or Resend not configured' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const notifyEmails = ['intake@abcsurrogacy.com', 'julie@abcsurrogacy.com', 'nicole@abcsurrogacy.com', 'juliestromwall@gmail.com']

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
      <div style="text-align: center; padding: 24px 24px 12px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 22px; margin: 0 0 8px; text-align: center;">
          Profile Submitted for Review
        </h1>

        <div style="background: linear-gradient(135deg, #f0f1fa, #fef9fb); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
          <p style="font-size: 16px; color: #1a1a2e; margin: 0 0 8px;">
            <strong style="color: #283693;">${surrogateName}</strong> has completed and submitted their surrogate profile for review.
          </p>
          ${surrogateEmail ? `<p style="font-size: 14px; color: #78716c; margin: 8px 0 0;">${surrogateEmail}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://app.abcsurrogacy.com/case-updates" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Review Profile
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  // Send email
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `ABC Surrogacy <${fromEmail}>`,
        to: notifyEmails,
        subject: `🚨 ${surrogateName} submitted their surrogate profile for review`,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend failed:', data)
  } catch (err) {
    console.error('Profile submitted notify email failed:', err)
  }

  // Log "Profile Complete" as reviewing on the checklist (server-side with service role)
  if (supabaseUrl && supabaseKey && caseId) {
    try {
      const sbHeaders = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }
      // 1. Find the actual step ID for "Profile Complete" from checklist config
      const configRes = await fetch(
        `${supabaseUrl}/rest/v1/app_config?config_key=eq.checklist_config&select=config_value`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      )
      const configRows = await configRes.json()
      let profileStepId = null
      if (configRows?.length > 0) {
        const checklistConfig = configRows[0].config_value || {}
        const gcConfig = checklistConfig.gc || checklistConfig.surrogate || {}
        for (const stageId of Object.keys(gcConfig)) {
          const steps = gcConfig[stageId]?.steps || []
          const match = steps.find(s =>
            s.label?.toLowerCase().includes('profile complete') ||
            s.label?.toLowerCase().includes('profile') && s.label?.toLowerCase().includes('complete')
          )
          if (match) { profileStepId = match.id; break }
        }
      }
      // Fallback to common IDs
      if (!profileStepId) profileStepId = 'profile_complete'

      // 2. Fetch current answers and update tracking
      const fetchRes = await fetch(
        `${supabaseUrl}/rest/v1/intake_submissions?id=eq.${caseId}&select=answers`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      )
      const rows = await fetchRes.json()
      if (rows?.length > 0) {
        const currentAnswers = rows[0].answers || {}
        const existingTracking = currentAnswers._recordTracking || {}
        const today = new Date().toISOString().split('T')[0]
        const stepData = existingTracking[profileStepId] || { history: [] }
        const trackingEntry = {
          status: 'reviewing',
          date: today,
          note: 'Submitted by Applicant',
          by: 'System',
        }
        const updatedTracking = {
          ...existingTracking,
          [profileStepId]: {
            ...stepData,
            status: 'reviewing',
            history: [...(stepData.history || []), trackingEntry],
          },
        }
        const updatedAnswers = { ...currentAnswers, _recordTracking: updatedTracking }
        await fetch(
          `${supabaseUrl}/rest/v1/intake_submissions?id=eq.${caseId}`,
          {
            method: 'PATCH',
            headers: sbHeaders,
            body: JSON.stringify({ answers: updatedAnswers }),
          }
        )
      }
    } catch (err) {
      console.error('Profile checklist log failed:', err)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
