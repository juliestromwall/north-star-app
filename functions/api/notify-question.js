// Cloudflare Pages Function — POST /api/notify-question
// Sends email notification to admin when someone asks a question on a shared profile
// Also logs the question as a case note on the IP's case and the surrogate's case

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
  const fromEmail = env.WELCOME_FROM_EMAIL || 'info@northstarsurrogacy.com'
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const {
    adminEmail, adminName, askerName, askerEmail, question,
    surrogateName, caseId, caseType, sharedToEmail, sharedToName,
  } = await context.request.json()

  if (!adminEmail || !question) {
    return new Response(JSON.stringify({ error: 'Missing adminEmail or question' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const displayName = askerName || 'Someone'
  const profileName = (surrogateName || 'a surrogate').split(' ')[0]

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
        <img src="https://app.northstarsurrogacy.com/north-star-logo-email.png" alt="North Star Surrogacy" style="max-width: 290px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h2 style="color: #1A3638; font-size: 20px; margin: 0 0 8px;">
          New Question About ${profileName}'s Profile
        </h2>
        <p style="color: #78716c; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
          Heads up! <strong style="color: #1c1917;">${displayName}</strong> has sent you a question about <strong style="color: #1A3638;">${profileName}</strong>'s profile.
        </p>

        <table style="width: 100%; border-collapse: collapse; background: #f0f1fa; border-radius: 12px; overflow: hidden; margin: 0 0 24px;">
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0; width: 120px;">Name</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0; font-weight: 600;">${displayName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0;">Email</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0;">
              ${askerEmail ? `<a href="mailto:${askerEmail}" style="color: #1A3638; text-decoration: none;">${askerEmail}</a>` : '<span style="color: #a8a29e;">Not provided</span>'}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0;">Question</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; line-height: 1.6; border-bottom: 1px solid #e0e2f0; font-style: italic;">"${question}"</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em;">Submitted</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917;">${dateStr} at ${timeStr}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://app.northstarsurrogacy.com/matching" style="display: inline-block; background: #1A3638; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View in App
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
          <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
            <strong>HIPAA Notice:</strong> This email may contain Protected Health Information (PHI). It is intended solely for the recipient named above. If you received this in error, please delete it immediately and notify the sender. Do not forward, copy, or distribute this message.
          </p>
        </div>

        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          North Star Surrogacy, LLC &middot; northstarsurrogacy.com
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
        from: `North Star Surrogacy <${fromEmail}>`,
        to: [adminEmail],
        subject: `\u{1F4AC} ${displayName} has submitted a question about ${profileName}'s Profile`,
        html: htmlBody,
        reply_to: askerEmail || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Resend failed:', data)
    }
  } catch (err) {
    console.error('Email send failed:', err)
  }

  // Log case notes via Supabase (fire-and-forget, don't block response)
  if (supabaseUrl && supabaseKey) {
    const sbHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }

    const noteContent = `📬 Profile question from ${displayName}${askerEmail ? ` (${askerEmail})` : ''} about ${profileName}'s profile:\n\n"${question}"`

    // Log note on the surrogate/GC case
    if (caseId) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/case_notes`, {
          method: 'POST',
          headers: sbHeaders,
          body: JSON.stringify({
            surrogate_id: Number(caseId),
            author_name: 'System',
            author_email: 'system@northstarsurrogacy.com',
            content: noteContent,
          }),
        })
      } catch (err) { console.error('Failed to log surrogate case note:', err) }
    }

    // Find IP case by shared_to_email and log note there too
    if (sharedToEmail) {
      try {
        const ipRes = await fetch(
          `${supabaseUrl}/rest/v1/intake_submissions?applicant_email=eq.${encodeURIComponent(sharedToEmail.toLowerCase())}&intake_type=eq.ip&order=submitted_at.desc&limit=1`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        const ipCases = await ipRes.json()
        if (ipCases?.length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/case_notes`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({
              surrogate_id: ipCases[0].id,
              author_name: 'System',
              author_email: 'system@northstarsurrogacy.com',
              content: `📬 ${displayName} asked a question about ${profileName}'s profile:\n\n"${question}"`,
            }),
          })
        }
      } catch (err) { console.error('Failed to log IP case note:', err) }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
