// Cloudflare Pages Function — POST /api/notify-app-released
// Sends email to surrogate when their application has been released

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
  const fromEmail = env.WELCOME_FROM_EMAIL || 'info@abcsurrogacy.com'

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { surrogateEmail, surrogateName, adminName } = await context.request.json()

  if (!surrogateEmail) {
    return new Response(JSON.stringify({ error: 'Missing surrogateEmail' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const firstName = (surrogateName || '').split(' ')[0] || 'there'
  const admin = adminName || 'Your coordinator'

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
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 180px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h2 style="color: #283693; font-size: 22px; margin: 0 0 16px; text-align: center;">
          Your Profile Looks Great! 🎉
        </h2>
        <p style="color: #44403c; font-size: 15px; margin: 0 0 16px; line-height: 1.7;">
          Hi ${firstName},
        </p>
        <p style="color: #44403c; font-size: 15px; margin: 0 0 16px; line-height: 1.7;">
          Your profile looks great! I've now opened up some more tasks for you to complete. Please log in as soon as you have some time and finish the rest of the application. Let me know if you have any questions!
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="https://app.abcsurrogacy.com/my-application" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Log In &amp; Complete Application
          </a>
        </div>

        <p style="color: #78716c; font-size: 13px; margin: 0 0 8px; line-height: 1.6; text-align: center;">
          We're excited to have you on this journey with us!
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
          <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
            <strong>HIPAA Notice:</strong> This email may contain Protected Health Information (PHI). It is intended solely for the recipient named above. If you received this in error, please delete it immediately and notify the sender. Do not forward, copy, or distribute this message.
          </p>
        </div>

        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${admin} at ABC Surrogacy <${fromEmail}>`,
        to: [surrogateEmail],
        subject: "🥳 I've reviewed your Profile! You can now complete the Application!",
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Resend failed:', data)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  } catch (err) {
    console.error('Email send failed:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
