// Cloudflare Pages Function — POST /api/notify-records-summary
// Auto-email when Records Summary is requested for a surrogate

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
  const notifyEmail = env.RECORDS_SUMMARY_NOTIFY_EMAIL || ''

  if (!resendKey || !notifyEmail) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY or RECORDS_SUMMARY_NOTIFY_EMAIL' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { surrogateName, surrogateId, gtpal, gtpalData } = await context.request.json()

  if (!surrogateName || !surrogateId) {
    return new Response(JSON.stringify({ error: 'Missing surrogateName or surrogateId' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const notifyEmails = notifyEmail.split(',').map(e => e.trim()).filter(Boolean)
  const recordsUrl = `https://app.abcsurrogacy.com/records-summary/${surrogateId}`

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 24px 24px 12px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 22px; margin: 0 0 8px; text-align: center;">
          Records Received! 🥳 Please Review
        </h1>

        <div style="padding: 24px 0;">
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            Hi Rebecca!
          </p>
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            I wanted to let you know that we have collected all available records for <strong style="color: #283693;">${surrogateName}</strong>.
          </p>
          ${gtpalData ? `
          <div style="background: linear-gradient(135deg, #f5f3ff, #ede9fe); border-radius: 12px; padding: 16px 20px; margin: 16px auto; max-width: 420px; border: 1px solid #ddd6fe;">
            <p style="margin: 0 0 8px; font-size: 10px; color: #7c3aed; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Pregnancy History</p>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-family: monospace; font-size: 16px; font-weight: 800; color: #1e1b4b; margin-right: 8px;">${gtpal}</span>
              <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #22c55e; color: white; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px;">${gtpalData.g}</span><span style="font-size: 12px; color: #44403c;">Pregnancies</span></span>
              <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #3b82f6; color: white; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px;">${gtpalData.t}</span><span style="font-size: 12px; color: #44403c;">Term</span></span>
              <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #f59e0b; color: white; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px;">${gtpalData.p}</span><span style="font-size: 12px; color: #44403c;">Preterm</span></span>
              <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #ef4444; color: white; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px;">${gtpalData.a}</span><span style="font-size: 12px; color: #44403c;">Losses</span></span>
              <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #8b5cf6; color: white; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px;">${gtpalData.l}</span><span style="font-size: 12px; color: #44403c;">Living</span></span>
            </div>
          </div>
          ` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${recordsUrl}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View Records Summary
          </a>
        </div>

        <p style="font-size: 14px; color: #44403c; line-height: 1.6; margin: 20px 0 0;">
          Please let Desiree know if you have any questions.
        </p>
        <p style="font-size: 14px; color: #44403c; margin: 8px 0 0;">
          Thank you!
        </p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 24px 0 0; border: 1px solid #fde68a;">
          <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
            <strong>Confidential:</strong> This email contains protected health information. Please do not forward, share, or distribute this email or linked pages with anyone outside of authorized ABC Surrogacy staff.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
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
        from: `ABC Surrogacy <${fromEmail}>`,
        to: notifyEmails,
        subject: `Surrogate ${surrogateName} — Records Received! 🥳 Please Review`,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Resend failed:', data)
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Records summary notify failed:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
