// Cloudflare Pages Function — POST /api/welcome-email
// Sends branded welcome email to qualified surrogates + creates their portal account

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
  const supabaseUrl = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = env.RESEND_API_KEY // or use Gmail — but we need a no-auth email sender
  const fromEmail = env.WELCOME_FROM_EMAIL || 'info@abcsurrogacy.com'

  const { email, firstName, lastName } = await context.request.json()
  if (!email || !firstName) {
    return new Response(JSON.stringify({ error: 'Missing email or name' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const name = `${firstName} ${lastName || ''}`.trim()
  const origin = new URL(context.request.url).origin
  const resetRedirect = `${origin}/reset-password`

  // Generate a password reset link so they can set up their account
  let passwordLink = `${origin}/login`
  if (supabaseUrl && serviceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({ type: 'recovery', email, options: { redirectTo: resetRedirect } }),
      })
      const data = await res.json()
      if (data?.properties?.action_link) {
        passwordLink = data.properties.action_link
      }
    } catch (err) { console.error('Failed to generate password link:', err) }
  }

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
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 200px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 24px; margin: 0 0 8px; text-align: center;">
          Thank you, <span style="color: #ed148c;">${firstName}</span>! 🎉
        </h1>
        <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
          We're so excited to hear from you
        </p>

        <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #283693; font-weight: 600;">
            What happens next?
          </p>
          <ol style="margin: 0; padding-left: 20px; color: #44403c; font-size: 14px; line-height: 2;">
            <li>Set up your portal password by clicking the button below.</li>
            <li>Complete your matching profile so intended parents can get to know you!</li>
            <li>Our intake coordinator, Jennifer, will be reaching out about next steps!</li>
          </ol>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${passwordLink}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Set Up Your Portal Password
          </a>
        </div>

        <p style="text-align: center; font-size: 15px; color: #283693; font-weight: 600; margin: 24px 0 8px;">
          We are here for you every step of the way!
        </p>

        <div style="background: #fdf8f3; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #78716c;">
            Have questions? Reach out anytime to<br/>
            <a href="mailto:jenn@abcsurrogacy.com" style="color: #283693; font-weight: 600;">jenn@abcsurrogacy.com</a>
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; <a href="https://abcsurrogacy.com" style="color: #a8a29e;">abcsurrogacy.com</a>
        </p>
      </div>
    </div>
  `

  // Send via Resend
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Abundant Beginnings Co. <${fromEmail}>`,
          to: [email],
          subject: `We received your surrogate quiz, ${firstName}!`,
          html: htmlBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) console.error('Resend failed:', data)
    } catch (err) {
      console.error('Email send failed:', err)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
