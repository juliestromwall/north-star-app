// Cloudflare Pages Function — POST /api/reinvite
// Sends branded portal invite email via Resend (for existing users who haven't logged in)

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
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@abcsurrogacy.com'

  const { email, firstName } = await context.request.json()
  if (!email) {
    return new Response(JSON.stringify({ error: 'Missing email' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  let resetLink = null
  const name = firstName || 'there'

  // Generate a fresh reset link
  if (supabaseUrl && serviceKey) {
    try {
      const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'recovery', email, redirect_to: 'https://app.abcsurrogacy.com/reset-password' }),
      })
      const linkData = await linkRes.json()
      resetLink = linkData?.properties?.action_link || linkData?.action_link || null
      if (!resetLink && linkData?.properties?.hashed_token) {
        resetLink = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent('https://app.abcsurrogacy.com/reset-password')}`
      }
      if (resetLink && !resetLink.includes('redirect_to')) {
        resetLink += (resetLink.includes('?') ? '&' : '?') + 'redirect_to=' + encodeURIComponent('https://app.abcsurrogacy.com/reset-password')
      }
    } catch (err) {
      console.error('Reset link generation failed:', err)
    }
  }

  // Send branded portal invite email
  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 32px 24px 16px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 200px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 24px; margin: 0 0 8px; text-align: center;">
          Welcome to your <span style="color: #ed148c;">secure portal</span>
        </h1>
        <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
          Abundant Beginnings Co. has set up your surrogate account
        </p>

        <div style="background: #f8f9fc; border-radius: 12px; padding: 24px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-size: 14px; color: #44403c;">
            Hi ${name},
          </p>
          <p style="margin: 0; font-size: 14px; color: #44403c;">
            Your account has been created at <a href="https://app.abcsurrogacy.com" style="color: #283693; font-weight: 600;">app.abcsurrogacy.com</a>. Click the button below to set your password and access your portal.
          </p>
        </div>

        ${resetLink ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Set Your Password
            </a>
          </div>
        ` : ''}

        <p style="text-align: center; font-size: 12px; color: #a8a29e; margin: 0 0 24px;">
          This link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; <a href="https://abcsurrogacy.com" style="color: #a8a29e;">abcsurrogacy.com</a>
        </p>
      </div>
    </div>
  `

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Abundant Beginnings Co. <${fromEmail}>`,
          to: [email],
          subject: "You're invited to your ABC Surrogacy portal",
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
