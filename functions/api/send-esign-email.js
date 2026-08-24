import { getAuthorizedUser, isAdminRole, json } from './_auth'

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
  const { env, request } = context
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@northstarsurrogacy.com'
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!resendKey) {
    return json({ error: 'Missing RESEND_API_KEY' }, 400, corsHeaders)
  }

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing Supabase auth config' }, 500, corsHeaders)
  }

  const caller = await getAuthorizedUser(request, supabaseUrl, serviceKey)
  if (!caller || !isAdminRole(caller.role)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  const { signerName, signerEmail, formTitle, formTitles, formUrl, senderName, senderEmail } = await request.json()

  if (!signerEmail || !formUrl) {
    return json({ error: 'Missing signerEmail or formUrl' }, 400, corsHeaders)
  }

  const firstName = (signerName || '').split(' ')[0] || 'there'

  // Batch mode: if an array of titles is provided, render a bulleted list
  // (one email covering multiple forms). Otherwise render the single-title
  // copy like the original one-off flow.
  const isBatch = Array.isArray(formTitles) && formTitles.length > 1
  const primaryTitle = isBatch
    ? `${formTitles.length} documents`
    : (formTitles?.[0] || formTitle || 'form')
  const formListHtml = isBatch
    ? `<ul style="margin:0;padding-left:18px;font-size:15px;color:#44403c;line-height:1.8;">${formTitles.map(t => `<li>${t}</li>`).join('')}</ul>`
    : ''
  const formListText = isBatch
    ? formTitles.map(t => `  • ${t}`).join('\n') + '\n\n'
    : ''

  // Resolve the From + Reply-To. If the sending admin is on the verified
  // domain (@northstarsurrogacy.com), send directly as them — otherwise fall back
  // to the default noreply and use Reply-To so replies still reach the admin.
  const cleanSenderEmail = (senderEmail || '').trim().toLowerCase()
  const senderOnAgencyDomain = cleanSenderEmail.endsWith('@northstarsurrogacy.com')
  const fromAddress = senderOnAgencyDomain ? cleanSenderEmail : fromEmail
  const fromDisplay = senderName
    ? `${senderName} (First Star Surrogacy)`
    : 'First Star Surrogacy'
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
        <img src="https://app.firststarsurrogacy.com/first-star-logo-email.png" alt="First Star Surrogacy" style="max-width: 260px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #1A3638; font-size: 22px; margin: 0 0 8px; text-align: center;">
          Signature Required
        </h1>

        <div style="padding: 20px 0;">
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            Hi ${firstName},
          </p>
          <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
            ${isBatch
              ? `First Star Surrogacy has sent you the following documents that require your signature. Click the button below to review and sign all of them in one session.`
              : `First Star Surrogacy has sent you a <strong>${primaryTitle}</strong> that requires your signature. Please click the button below to review and sign.`}
          </p>
          ${formListHtml}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${formUrl}" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${isBatch ? `Review & Sign (${formTitles.length})` : 'Review & Sign'}
          </a>
        </div>

        <p style="font-size: 13px; color: #78716c; line-height: 1.6; margin: 20px 0 0; text-align: center;">
          If you have any questions, please contact us at
          <a href="mailto:info@northstarsurrogacy.com" style="color: #1A3638; font-weight: 600;">info@northstarsurrogacy.com</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
          First Star Surrogacy, LLC &middot; firststarsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    // Plain-text alternative — Outlook/Microsoft spam filters often reject
    // HTML-only mail. Resend passes both parts to the recipient.
    const textBody = isBatch
      ? `Hi ${firstName},

First Star Surrogacy has sent you ${formTitles.length} documents that require your signature:

${formListText}Review and sign all: ${formUrl}

If you have any questions, reply to this email or contact us at info@northstarsurrogacy.com.

— First Star Surrogacy, LLC
firststarsurrogacy.com`
      : `Hi ${firstName},

First Star Surrogacy has sent you a ${primaryTitle} that requires your signature.

Review and sign: ${formUrl}

If you have any questions, reply to this email or contact us at info@northstarsurrogacy.com.

— First Star Surrogacy, LLC
firststarsurrogacy.com`

    const subject = isBatch
      ? `First Star Surrogacy — Please sign: ${formTitles.length} documents`
      : `First Star Surrogacy — Please sign: ${primaryTitle}`

    const payload = {
      from: `${fromDisplay} <${fromAddress}>`,
      to: [signerEmail],
      subject,
      html: htmlBody,
      text: textBody,
    }
    if (replyToAddress) payload.reply_to = replyToAddress
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      return json({ success: false, error: data }, 500, corsHeaders)
    }
    return json({ success: true, id: data.id }, 200, corsHeaders)
  } catch (err) {
    return json({ success: false, error: err.message }, 500, corsHeaders)
  }
}
