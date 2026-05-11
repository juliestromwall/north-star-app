// Cloudflare Pages Function — POST /api/ip-invite
// Creates a Supabase auth user for an intended parent and sends the branded
// "Welcome to your secure portal" email via Resend (not the admin's Gmail,
// so it's independent of Google connection state).

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
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'info@northstarsurrogacy.com'

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { email, name, firstName } = await context.request.json()
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const origin = new URL(context.request.url).origin
  const resetRedirect = `${origin}/reset-password`
  const displayName = firstName || (name ? name.split(' ')[0] : '') || 'there'

  try {
    // 1. Check if user already exists
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const listData = await listRes.json()
    const existing = (listData.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase())
    let userId = existing?.id || null

    // 2. Create user if they don't exist
    if (!existing) {
      const tempPassword = crypto.randomUUID().slice(0, 16) + '!A1'
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: name || '', role: 'intended_parent' },
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.msg || createData.message || 'Failed to create user')
      userId = createData.id
    }

    // 3. Generate a fresh password reset link (valid whether we just created
    //    the user or they already exist but never logged in)
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'recovery',
        email,
        redirect_to: resetRedirect,
      }),
    })
    const linkData = await linkRes.json()
    let resetLink = linkData?.properties?.action_link || linkData?.action_link || null
    if (!resetLink && linkData?.properties?.hashed_token) {
      resetLink = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(resetRedirect)}`
    }
    if (resetLink && !resetLink.includes('redirect_to')) {
      resetLink += (resetLink.includes('?') ? '&' : '?') + 'redirect_to=' + encodeURIComponent(resetRedirect)
    }

    // 4. Send the branded invite email via Resend
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
          Welcome to your <span style="color: #D4A853;">secure portal</span>
        </h1>
        <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
          North Star Surrogacy has set up your intended parent account
        </p>

        <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0; font-size: 14px; color: #44403c;">
            Hi ${displayName},
          </p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #44403c; line-height: 1.6;">
            Your account has been created at <strong><a href="https://app.northstarsurrogacy.com" style="color: #1A3638; font-weight: 600;">app.northstarsurrogacy.com</a></strong>. Click the button below to set your password and access your portal.
          </p>
        </div>

        ${resetLink ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Set Your Password
            </a>
          </div>
        ` : ''}

        <p style="color: #a8a29e; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.5;">
          This link will expire in 24 hours. If you didn't expect this invitation,
          you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          North Star Surrogacy, LLC &middot; <a href="https://northstarsurrogacy.com" style="color: #a8a29e;">northstarsurrogacy.com</a>
        </p>
      </div>
    </div>
    `

    let emailSent = false
    let emailError = null
    if (resendKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `North Star Surrogacy <${fromEmail}>`,
            to: [email],
            subject: "You're invited to your North Star Surrogacy portal",
            html: htmlBody,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          emailSent = true
        } else {
          emailError = data?.message || data?.error?.message || 'Resend rejected the message'
          console.error('Resend failed:', data)
        }
      } catch (err) {
        emailError = err.message
        console.error('Email send failed:', err)
      }
    } else {
      emailError = 'RESEND_API_KEY not configured'
    }

    return new Response(JSON.stringify({
      success: true,
      userId,
      alreadyExisted: !!existing,
      emailSent,
      emailError,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to create invite' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
