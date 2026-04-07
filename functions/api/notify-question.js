// Cloudflare Pages Function — POST /api/notify-question
// Sends email notification to admin when someone asks a question on a shared profile

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

  const { adminEmail, adminName, askerName, askerEmail, question, surrogateName, shareUrl } = await context.request.json()

  if (!adminEmail || !question) {
    return new Response(JSON.stringify({ error: 'Missing adminEmail or question' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 32px 24px 16px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 180px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h2 style="color: #283693; font-size: 20px; margin: 0 0 8px;">
          New Question on Shared Profile
        </h2>
        <p style="color: #78716c; font-size: 14px; margin: 0 0 20px;">
          Someone has a question about <strong style="color: #283693;">${surrogateName || 'a surrogate'}</strong>'s profile.
        </p>

        <div style="background: #f0f1fa; border-radius: 12px; padding: 20px; margin: 0 0 20px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em;">Question from</p>
          <p style="margin: 0 0 12px; font-size: 15px; color: #283693; font-weight: 600;">
            ${askerName || 'Anonymous'}${askerEmail ? ` &lt;${askerEmail}&gt;` : ''}
          </p>
          <p style="margin: 0; font-size: 15px; color: #1c1917; line-height: 1.6; font-style: italic;">
            "${question}"
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://app.abcsurrogacy.com/matching" style="display: inline-block; background: #283693; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View &amp; Reply in Dashboard
          </a>
        </div>

        ${askerEmail ? `<p style="color: #78716c; font-size: 13px; text-align: center;">Or reply directly to <a href="mailto:${askerEmail}" style="color: #283693;">${askerEmail}</a></p>` : ''}

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          Abundant Beginnings Company, LLC · abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `ABC Surrogacy <${fromEmail}>`,
        to: [adminEmail],
        subject: `New question about ${surrogateName || 'a surrogate'}'s profile`,
        html: htmlBody,
        reply_to: askerEmail || undefined,
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
