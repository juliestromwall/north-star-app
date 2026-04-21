// Cloudflare Pages Function — POST /api/reset-password-email
// Sends branded password reset email via Resend

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

  const { email } = await context.request.json()
  if (!email) {
    return new Response(JSON.stringify({ error: 'Missing email' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // 1. Check user exists
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const listData = await listRes.json()
    const user = (listData.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      // Don't reveal if user exists — just say "sent"
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there'

    const origin = new URL(context.request.url).origin
    const resetRedirect = `${origin}/reset-password`

    // 2. Generate reset link
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'recovery', email, redirect_to: resetRedirect }),
    })
    const linkData = await linkRes.json()
    let resetLink = linkData?.properties?.action_link || linkData?.action_link || null

    if (!resetLink && linkData?.properties?.hashed_token) {
      resetLink = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(resetRedirect)}`
    }

    if (resetLink && !resetLink.includes('redirect_to')) {
      resetLink += (resetLink.includes('?') ? '&' : '?') + 'redirect_to=' + encodeURIComponent(resetRedirect)
    }

    if (!resetLink) {
      console.error('generate_link response:', JSON.stringify(linkData))
      return new Response(JSON.stringify({ error: 'Failed to generate reset link', debug: linkData?.msg || linkData?.error || 'unknown' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // 3. Send branded email via Resend
    const htmlBody = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="text-align: center; padding: 32px 24px 16px;">
          <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 200px;" />
        </div>
        <div style="padding: 0 32px 32px;">
          <h1 style="color: #283693; font-size: 24px; margin: 0 0 8px; text-align: center;">
            Reset your <span style="color: #ed148c;">password</span>
          </h1>
          <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
            We received a request to reset your password
          </p>

          <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #44403c;">
              Hi ${firstName},
            </p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #44403c;">
              Click the button below to set a new password for your ABC Surrogacy portal at <a href="https://app.abcsurrogacy.com" style="color: #283693; font-weight: 600;">app.abcsurrogacy.com</a>.
            </p>
            <div style="text-align: center;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
          </div>

          <p style="text-align: center; font-size: 12px; color: #a8a29e; margin: 0 0 24px;">
            This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
          <p style="color: #a8a29e; font-size: 11px; text-align: center;">
            Abundant Beginnings Company, LLC &middot; <a href="https://abcsurrogacy.com" style="color: #a8a29e;">abcsurrogacy.com</a>
          </p>
        </div>
      </div>
    `

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Abundant Beginnings Co. <${fromEmail}>`,
          to: [email],
          subject: 'Reset your ABC Surrogacy password',
          html: htmlBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) console.error('Resend failed:', data)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Reset password email failed:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
