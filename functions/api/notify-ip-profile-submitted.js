// Cloudflare Pages Function — POST /api/notify-ip-profile-submitted
// Notifies admin team when an intended parent submits their profile for review.

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
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@northstarsurrogacy.com'

  const { ipName, ipEmail, caseId } = await context.request.json()

  if (!resendKey || !ipName) {
    return new Response(JSON.stringify({ error: 'Missing data or Resend not configured' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Intake coordinator handles surrogates only, not IPs.
  const notifyEmails = ['julie@northstarsurrogacy.com', 'nicole@northstarsurrogacy.com', 'juliestromwall@gmail.com']
  const reviewUrl = caseId
    ? `https://app.firststarsurrogacy.com/intended-parents/${caseId}`
    : 'https://app.firststarsurrogacy.com/intended-parents'

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
        <img src="https://app.firststarsurrogacy.com/first-star-logo-email.png" alt="First Star Surrogacy" style="max-width: 260px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #1A3638; font-size: 22px; margin: 0 0 8px; text-align: center;">
          IP Profile Submitted for Review
        </h1>

        <div style="background: linear-gradient(135deg, #f0f1fa, #fef9fb); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
          <p style="font-size: 16px; color: #1a1a2e; margin: 0 0 8px;">
            <strong style="color: #1A3638;">${ipName}</strong> has completed and submitted their intended parent profile for review.
          </p>
          ${ipEmail ? `<p style="font-size: 14px; color: #78716c; margin: 8px 0 0;">${ipEmail}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Review Profile
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
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
        to: notifyEmails,
        subject: `🚨 ${ipName} submitted their IP profile for review`,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend failed:', data)
  } catch (err) {
    console.error('IP profile submitted notify email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
