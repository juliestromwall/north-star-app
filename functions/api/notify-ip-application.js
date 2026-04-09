// Cloudflare Pages Function — POST /api/notify-ip-application
// Notifies admin when a new intended parent application is submitted

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
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@abcsurrogacy.com'
  const notifyEmails = (env.IP_APPLICATION_NOTIFY_EMAIL || 'juliestromwall@gmail.com')
    .split(',').map(e => e.trim()).filter(Boolean)

  const { applicantName, applicantEmail, applicantPhone, partnerName, partnerEmail, location, country } = await context.request.json()

  if (!resendKey || !applicantName) {
    return new Response(JSON.stringify({ error: 'Missing data or Resend not configured' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 24px 24px 12px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 20px; margin: 0 0 16px; text-align: center;">
          New Intended Parent Application
        </h1>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c; width: 130px;"><strong>Name</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${applicantName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c;"><strong>Email</strong></td>
            <td style="padding: 10px 0;"><a href="mailto:${applicantEmail}" style="color: #283693;">${applicantEmail}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c;"><strong>Phone</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${applicantPhone || '—'}</td>
          </tr>
          ${partnerName ? `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c;"><strong>Partner</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${partnerName}${partnerEmail ? ` (<a href="mailto:${partnerEmail}" style="color: #283693;">${partnerEmail}</a>)` : ''}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px 0; color: #78716c;"><strong>Location</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${[location, country].filter(Boolean).join(', ') || '—'}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 20px 0;">
          <a href="https://app.abcsurrogacy.com/intended-parents" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View in Dashboard
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 20px 0;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `ABC Surrogacy <${fromEmail}>`,
        to: notifyEmails,
        subject: `New Intended Parent Application — ${applicantName}`,
        html: htmlBody,
      }),
    })
  } catch (err) {
    console.error('IP notify email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
