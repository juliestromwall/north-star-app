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
  let resetLink = null

  // 1. Create portal account (if doesn't exist)
  if (supabaseUrl && serviceKey) {
    try {
      // Check if user exists
      const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      })
      const listData = await listRes.json()
      const existing = (listData.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase())

      if (!existing) {
        // Create user
        const tempPassword = crypto.randomUUID().slice(0, 16) + '!A1'
        await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: name, role: 'surrogate' },
          }),
        })
      }

      // Always generate a fresh reset link (new or existing user)
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
      } catch (linkErr) {
        console.error('Reset link generation failed:', linkErr)
      }
    } catch (err) {
      console.error('Account creation failed:', err)
    }
  }

  // 2. Send welcome email via Resend
  const portalButton = resetLink ? `
      <div style="text-align: center; margin: 20px 0 4px;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Set Your Password
        </a>
      </div>
  ` : ''

  const htmlBody = `
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
            <li>If you haven't already, set up your user portal if you would like to get started on your profile.</li>
            <li>Our intake coordinator, Jennifer, will be reaching out about next steps!</li>
          </ol>
          ${portalButton}
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

  return new Response(JSON.stringify({ success: true, hasPortal: !!resetLink }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
