// Cloudflare Pages Function — POST /api/ip-welcome-email
// Sends branded welcome email to intended parents after quiz submission

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

  const { email, firstName, partnerEmail, partnerFirstName } = await context.request.json()
  if (!email || !firstName) {
    return new Response(JSON.stringify({ error: 'Missing email or name' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 32px 24px 16px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 200px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 24px; margin: 0 0 8px; text-align: center;">
          Hello, <span style="color: #ed148c;">${firstName}</span>! 👋
        </h1>
        <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
          We're so excited to hear from you
        </p>

        <div style="text-align: center; margin: 0 0 24px;">
          <p style="font-size: 14px; color: #44403c; line-height: 1.6;">
            We understand how important this journey is to you, and we're honored to be part of it.
          </p>
        </div>

        <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #283693; font-weight: 600;">
            What happens next?
          </p>
          <p style="margin: 0; color: #44403c; font-size: 14px; line-height: 1.8;">
            Our team is reviewing your information and we will reach out to you within <strong>48 hours</strong>.
          </p>
        </div>

        <div style="background: #fdf8f3; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #78716c;">
            Have questions in the meantime? Reach out anytime at<br/>
            <a href="mailto:info@abcsurrogacy.com" style="color: #283693; font-weight: 600;">info@abcsurrogacy.com</a>
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          Abundant Beginnings Company, LLC · abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  // Send to primary IP only
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Abundant Beginnings Co. <${fromEmail}>`,
          to: [email],
          subject: 'Abundant Beginnings Co. has received your information',
          html: htmlBody,
        }),
      })
    } catch (err) {
      console.error('IP welcome email failed:', err)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
