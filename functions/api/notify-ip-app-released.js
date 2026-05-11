// Cloudflare Pages Function — POST /api/notify-ip-app-released
// Sent when an admin releases the application form to an Intended Parent
// (i.e. the admin has approved the IP profile and is opening up the
// remaining application/intake forms for them to fill out).
//
// Recipients: IP1 + IP2 (if present).

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

  const { ip1Email, ip1FirstName, ip2Email, ip2FirstName, adminName } = await context.request.json()

  if (!ip1Email) {
    return new Response(JSON.stringify({ error: 'Missing ip1Email' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const recipients = [ip1Email]
  if (ip2Email && ip2Email !== ip1Email) recipients.push(ip2Email)

  const greetingNames = ip2FirstName
    ? `${ip1FirstName || 'there'} and ${ip2FirstName}`
    : (ip1FirstName || 'there')
  const sender = adminName || 'The North Star Surrogacy Team'

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
        <img src="https://app.northstarsurrogacy.com/north-star-logo.png" alt="North Star Surrogacy" style="max-width: 200px;" />
      </div>

      <div style="padding: 0 32px 32px;">
        <h1 style="color: #1A3638; font-size: 24px; margin: 0 0 8px; text-align: center;">
          Your profile has been <span style="color: #D4A853;">approved!</span> 🎉
        </h1>
        <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
          You can now complete the remaining forms.
        </p>

        <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 20px; margin: 0 0 20px;">
          <p style="margin: 0; font-size: 14px; color: #44403c;">
            Hi ${greetingNames}!
          </p>
          <p style="margin: 12px 0 0; font-size: 14px; color: #44403c; line-height: 1.6;">
            Your profile looks great! Now you can log in and complete the remaining part of the application. We just need to gather some more information before moving on to the next steps.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://app.northstarsurrogacy.com/login?redirect=%2Fmy-application" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Log In & Complete Application
          </a>
        </div>

        <p style="margin: 24px 0 0; font-size: 14px; color: #44403c; line-height: 1.6;">
          ${sender}
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />

        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          North Star Surrogacy, LLC &middot; northstarsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${sender} at North Star Surrogacy <${fromEmail}>`,
        to: recipients,
        subject: 'We have approved your North Star Surrogacy Profile. You can now complete the remaining forms.',
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend failed:', data)
  } catch (err) {
    console.error('IP app-released email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
