// Cloudflare Pages Function — POST /api/contact
// Sends the public marketing-site "Contact Us" form to the North Star inbox.
// Defaults to hello@northstarsurrogacy.com (override with CONTACT_NOTIFY_EMAIL).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const ROLE_LABELS = {
  parent: 'Intended Parent',
  surrogate: 'Prospective Surrogate',
  other: 'Just Exploring',
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Mirrors the intake forms' server-side check. No secret configured → skip (no-op).
async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET
  if (!secret) return { configured: false, success: false }
  if (!token) return { configured: true, success: false }

  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json().catch(() => ({}))
  return { configured: true, success: !!data.success, errors: data['error-codes'] || [] }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env } = context
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@northstarsurrogacy.com'
  const notifyEmail = env.CONTACT_NOTIFY_EMAIL || 'hello@northstarsurrogacy.com'

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  let body
  try {
    body = await context.request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { name, email, role, message, company, turnstileToken } = body

  // Honeypot — bots fill the hidden "company" field; humans never see it.
  // Pretend success so bots don't learn they were caught.
  if (company) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Turnstile — only enforced when TURNSTILE_SECRET[_KEY] is configured.
  const turnstile = await verifyTurnstile(env, turnstileToken, context.request.headers.get('CF-Connecting-IP') || '')
  if (turnstile.configured && !turnstile.success) {
    return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const roleLabel = ROLE_LABELS[role] || 'Not specified'
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message || '').replace(/\n/g, '<br>')

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

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
        <img src="https://app.northstarsurrogacy.com/north-star-logo-email.png" alt="North Star Surrogacy" style="max-width: 290px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h2 style="color: #1A3638; font-size: 20px; margin: 0 0 8px;">
          New Contact Form Message
        </h2>
        <p style="color: #78716c; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
          <strong style="color: #1c1917;">${safeName}</strong> reached out through the website contact form.
        </p>

        <table style="width: 100%; border-collapse: collapse; background: #f0f1fa; border-radius: 12px; overflow: hidden; margin: 0 0 24px;">
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0; width: 120px;">Name</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0; font-weight: 600;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0;">Email</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0;">
              <a href="mailto:${safeEmail}" style="color: #1A3638; text-decoration: none;">${safeEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0;">I am a</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; border-bottom: 1px solid #e0e2f0;">${roleLabel}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e0e2f0; vertical-align: top;">Message</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917; line-height: 1.6; border-bottom: 1px solid #e0e2f0;">${safeMessage || '<span style="color: #a8a29e;">No message provided</span>'}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em;">Submitted</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #1c1917;">${dateStr} at ${timeStr}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <a href="mailto:${safeEmail}" style="display: inline-block; background: #1A3638; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Reply to ${safeName}
          </a>
        </div>

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
        from: `North Star Surrogacy <${fromEmail}>`,
        to: notifyEmail.split(',').map((e) => e.trim()).filter(Boolean),
        subject: `\u{1F4AC} New contact form message from ${name}`,
        html: htmlBody,
        reply_to: email,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Resend failed:', data)
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  } catch (err) {
    console.error('Email send failed:', err)
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Store a record (fire-and-forget — never block the response on this).
  // Requires a `contact_submissions` table; if it doesn't exist the error is just logged.
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/contact_submissions`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name,
          email,
          role: role || null,
          message: message || null,
          turnstile_verified: !!turnstile.success,
          source: 'marketing-site',
        }),
      })
    } catch (err) {
      console.error('Failed to store contact submission:', err)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
