// Cloudflare Pages Function — POST /api/notify-ip-app-submitted
// Notifies the admin team when an Intended Parent submits their application.

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

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { ip1Name, ip2Name, ip1Email, assignedTo, caseId } = await context.request.json()

  if (!ip1Name) {
    return new Response(JSON.stringify({ error: 'Missing ip1Name' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Notify Julie + Nicole + assigned admin if any. Intake coordinator
  // handles surrogates only, not IPs.
  const recipients = new Set([
    'julie@northstarsurrogacy.com',
    'nicole@northstarsurrogacy.com',
    'juliestromwall@gmail.com',
  ])
  if (assignedTo && assignedTo.includes('@')) recipients.add(assignedTo)

  const fullNameDisplay = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name
  const subject = `📋 Intended Parent ${fullNameDisplay} has submitted their Application`

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const caseUrl = caseId ? `https://app.firststarsurrogacy.com/intended-parents/${caseId}` : 'https://app.firststarsurrogacy.com/intended-parents'

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
        <img src="https://app.firststarsurrogacy.com/first-star-logo-email.png" alt="First Star Surrogacy" style="max-width: 290px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h2 style="color: #1A3638; font-size: 20px; margin: 0 0 8px;">
          Application Submitted!
        </h2>
        <p style="color: #78716c; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
          <strong style="color: #1c1917;">${fullNameDisplay}</strong> has completed and submitted their application and is ready for review.
        </p>

        <table style="width: 100%; border-collapse: collapse; background: #f0f1fa; border-radius: 12px; overflow: hidden; margin: 0 0 24px;">
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0; width: 120px;">Applicant</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0; font-weight: 600;">${fullNameDisplay}</td>
          </tr>
          ${ip1Email ? `<tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0;">Email</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0;">${ip1Email}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em;">Submitted</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917;">${dateStr} at ${timeStr}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${caseUrl}" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Review Application
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
          <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
            <strong>HIPAA Notice:</strong> This email may contain Protected Health Information (PHI). It is intended solely for the recipient named above. If you received this in error, please delete it immediately and notify the sender. Do not forward, copy, or distribute this message.
          </p>
        </div>

        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          First Star Surrogacy, LLC &middot; firststarsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `First Star Surrogacy <${fromEmail}>`,
        to: Array.from(recipients),
        subject,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend failed:', data)
  } catch (err) {
    console.error('IP app-submitted email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
