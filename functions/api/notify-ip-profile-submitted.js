// Cloudflare Pages Function — POST /api/notify-ip-profile-submitted
// Notifies admin team when an intended parent submits their profile for review.

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

  const { ipName, ipEmail, caseId } = await context.request.json()

  if (!resendKey || !ipName) {
    return new Response(JSON.stringify({ error: 'Missing data or Resend not configured' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const notifyEmails = ['intake@abcsurrogacy.com', 'julie@abcsurrogacy.com', 'nicole@abcsurrogacy.com', 'juliestromwall@gmail.com']
  const reviewUrl = caseId
    ? `https://app.abcsurrogacy.com/intended-parents/${caseId}`
    : 'https://app.abcsurrogacy.com/intended-parents'

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 24px 24px 12px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 22px; margin: 0 0 8px; text-align: center;">
          IP Profile Submitted for Review
        </h1>

        <div style="background: linear-gradient(135deg, #f0f1fa, #fef9fb); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
          <p style="font-size: 16px; color: #1a1a2e; margin: 0 0 8px;">
            <strong style="color: #283693;">${ipName}</strong> has completed and submitted their intended parent profile for review.
          </p>
          ${ipEmail ? `<p style="font-size: 14px; color: #78716c; margin: 8px 0 0;">${ipEmail}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Review Profile
          </a>
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
        subject: `🚨 ${ipName} submitted their IP profile for review`,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend failed:', data)
  } catch (err) {
    console.error('IP profile submitted notify email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
