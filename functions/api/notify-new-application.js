// Cloudflare Pages Function — POST /api/notify-new-application
// Notifies admin when a new surrogate application is submitted

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
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@northstarsurrogacy.com'
  // Supports comma-separated list: intake@northstarsurrogacy.com, nicole@northstarsurrogacy.com
  const notifyEmails = (env.GC_APPLICATION_NOTIFY_EMAIL || 'juliestromwall@gmail.com')
    .split(',').map(e => e.trim()).filter(Boolean)

  const { applicantName, applicantEmail, applicantPhone, state, qualified, dqReasons, hearAboutUs, referralName, hearAboutUsOther } = await context.request.json()

  // Build "How they heard" display
  let hearAboutDisplay = hearAboutUs || '—'
  if (hearAboutUs === 'Friend or family' && referralName) hearAboutDisplay = `Friend or family — ${referralName}`
  else if (hearAboutUs === 'Other' && hearAboutUsOther) hearAboutDisplay = `Other — ${hearAboutUsOther}`

  if (!resendKey || !applicantName) {
    return new Response(JSON.stringify({ error: 'Missing data or Resend not configured' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const statusColor = qualified ? '#16a34a' : '#dc2626'
  const statusText = qualified ? '✅ QUALIFIED' : '❌ DISQUALIFIED'
  const dqList = (dqReasons && dqReasons.length > 0)
    ? dqReasons.map(r => `<li style="margin: 4px 0;">${r}</li>`).join('')
    : ''

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
        <img src="https://app.northstarsurrogacy.com/north-star-logo.png" alt="North Star Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #1A3638; font-size: 20px; margin: 0 0 4px; text-align: center;">
          New Surrogate Application
        </h1>
        <p style="text-align: center; margin: 0 0 20px;">
          <span style="display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; color: white; background: ${statusColor};">
            ${statusText}
          </span>
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c; width: 120px;"><strong>Name</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${applicantName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c;"><strong>Email</strong></td>
            <td style="padding: 10px 0;"><a href="mailto:${applicantEmail}" style="color: #1A3638;">${applicantEmail}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c;"><strong>Phone</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${applicantPhone || '—'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px 0; color: #78716c;"><strong>State</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${state || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #78716c;"><strong>How They Heard</strong></td>
            <td style="padding: 10px 0; color: #1a1a2e;">${hearAboutDisplay}</td>
          </tr>
        </table>

        ${dqList ? `
          <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #fecaca;">
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #dc2626;">Disqualification Reasons:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #7f1d1d;">${dqList}</ul>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 20px 0;">
          <a href="https://app.northstarsurrogacy.com/intake" style="display: inline-block; background: linear-gradient(135deg, #D4A853, #1A3638); color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View in Applications
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 20px 0;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
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
        to: notifyEmails,
        subject: `${qualified ? '✅' : '❌'} New Surrogate Application — ${applicantName}`,
        html: htmlBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend failed:', data)
  } catch (err) {
    console.error('Notify email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
