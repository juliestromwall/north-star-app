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
  const fromEmail = env.WELCOME_FROM_EMAIL || 'info@northstarsurrogacy.com'

  const { email, firstName, partnerEmail, partnerFirstName } = await context.request.json()
  if (!email || !firstName) {
    return new Response(JSON.stringify({ error: 'Missing email or name' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

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
          Hello, <span style="color: #D4A853;">${firstName}</span>! 👋
        </h1>

        <div style="margin: 20px 0 24px;">
          <p style="font-size: 14px; color: #44403c; line-height: 1.7;">
            Thank you for reaching out to North Star Surrogacy (North Star Surrogacy). We're truly honored that you've considered us to be a part of your journey.
          </p>
          <p style="font-size: 14px; color: #44403c; line-height: 1.7; margin-top: 12px;">
            Building a family is one of life's most beautiful experiences, and our team is here to support you with care, compassion, and expertise every step of the way. We look forward to learning more about your story.
          </p>
        </div>

        <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #1A3638; font-weight: 600;">
            What happens next?
          </p>
          <p style="margin: 0; color: #44403c; font-size: 14px; line-height: 1.8;">
            We are currently reviewing your information, and we will be in touch within <strong>48 hours</strong> to discuss next steps and answer any questions you may have.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #1A3638; font-weight: 600;">
            Owners Nicole Lawson &amp; Julie Allgood
          </p>
          <img src="https://app.northstarsurrogacy.com/north-star-logo.png" alt="Owners Nicole Lawson & Julie Allgood" style="max-width: 100%; border-radius: 12px;" />
        </div>

        <div style="background: #fdf8f3; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #78716c;">
            Have questions in the meantime? Reach out anytime at<br/>
            <a href="mailto:info@northstarsurrogacy.com" style="color: #1A3638; font-weight: 600;">info@northstarsurrogacy.com</a>
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          North Star Surrogacy, LLC · northstarsurrogacy.com
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
          from: `North Star Surrogacy <${fromEmail}>`,
          to: [email],
          subject: 'North Star Surrogacy has received your information',
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
