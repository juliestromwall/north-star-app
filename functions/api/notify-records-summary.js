// Cloudflare Pages Function — POST /api/notify-records-summary
// Auto-email when Records Summary is requested for a surrogate

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
  const notifyEmail = env.RECORDS_SUMMARY_NOTIFY_EMAIL || ''

  if (!resendKey || !notifyEmail) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY or RECORDS_SUMMARY_NOTIFY_EMAIL' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { surrogateName, surrogateId, gtpal, gtpalData } = await context.request.json()

  if (!surrogateName || !surrogateId) {
    return new Response(JSON.stringify({ error: 'Missing surrogateName or surrogateId' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const notifyEmails = notifyEmail.split(',').map(e => e.trim()).filter(Boolean)
  const recordsUrl = `https://app.firststarsurrogacy.com/records-summary/${surrogateId}`

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
          Records Received! 🥳 Please Review
        </h1>

        <div style="padding: 24px 0;">
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            Hi Rebecca!
          </p>
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            I wanted to let you know that we have collected all available records for <strong style="color: #1A3638;">${surrogateName}</strong>.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${recordsUrl}" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View Records Summary
          </a>
        </div>

        <p style="font-size: 14px; color: #44403c; line-height: 1.6; margin: 20px 0 0;">
          Please let Desiree know if you have any questions.
        </p>
        <p style="font-size: 14px; color: #44403c; margin: 8px 0 0;">
          Thank you!
        </p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 24px 0 0; border: 1px solid #fde68a;">
          <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
            <strong>Confidential:</strong> This email contains protected health information. Please do not forward, share, or distribute this email or linked pages with anyone outside of authorized First Star Surrogacy staff.
          </p>
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
        subject: `Surrogate ${surrogateName} is Ready for Records Summary! 🏥`,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Resend failed:', data)
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Records summary notify failed:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
