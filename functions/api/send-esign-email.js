// Cloudflare Pages Function — POST /api/send-esign-email
// Sends e-sign form link to signer

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

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { signerName, signerEmail, formTitle, formUrl, senderName, senderEmail } = await context.request.json()

  if (!signerEmail || !formUrl) {
    return new Response(JSON.stringify({ error: 'Missing signerEmail or formUrl' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const firstName = (signerName || '').split(' ')[0] || 'there'

  // Resolve the From + Reply-To. If the sending admin is on the verified
  // domain (@abcsurrogacy.com), send directly as them — otherwise fall back
  // to the default noreply and use Reply-To so replies still reach the admin.
  const cleanSenderEmail = (senderEmail || '').trim().toLowerCase()
  const senderOnABCDomain = cleanSenderEmail.endsWith('@abcsurrogacy.com')
  const fromAddress = senderOnABCDomain ? cleanSenderEmail : fromEmail
  const fromDisplay = senderName
    ? `${senderName} (ABC Surrogacy)`
    : 'ABC Surrogacy'
  const replyToAddress = cleanSenderEmail || null

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
      <div style="text-align: center; padding: 24px 24px 12px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 22px; margin: 0 0 8px; text-align: center;">
          Signature Required
        </h1>

        <div style="padding: 20px 0;">
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            Hi ${firstName},
          </p>
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            ABC Surrogacy has sent you a <strong>${formTitle || 'form'}</strong> that requires your signature. Please click the button below to review and sign.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${formUrl}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Review & Sign
          </a>
        </div>

        <p style="font-size: 13px; color: #78716c; line-height: 1.6; margin: 20px 0 0; text-align: center;">
          If you have any questions, please contact us at
          <a href="mailto:info@abcsurrogacy.com" style="color: #283693; font-weight: 600;">info@abcsurrogacy.com</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    const payload = {
      from: `${fromDisplay} <${fromAddress}>`,
      to: [signerEmail],
      subject: `ABC Surrogacy — Please sign: ${formTitle || 'Document'}`,
      html: htmlBody,
    }
    if (replyToAddress) payload.reply_to = replyToAddress
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
