import { getAuthorizedUser, isStaffRole } from '../_auth'

// Cloudflare Pages Function — POST /api/sms/send
// Sends an SMS via Twilio. Credentials stored in env vars.

export async function onRequestPost(context) {
  const { env, request } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
    const caller = supabaseUrl && serviceKey ? await getAuthorizedUser(request, supabaseUrl, serviceKey) : null
    if (!caller || !isStaffRole(caller.role)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { to, message, from } = await request.json()

    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing "to" or "message"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const accountSid = env.TWILIO_ACCOUNT_SID
    const authToken = env.TWILIO_AUTH_TOKEN
    const fromNumber = from || env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Clean phone number — ensure E.164 format
    let cleanTo = to.replace(/[^\d+]/g, '')
    if (!cleanTo.startsWith('+')) cleanTo = '+1' + cleanTo.replace(/^1/, '')

    // Send via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const auth = btoa(`${accountSid}:${authToken}`)

    const body = new URLSearchParams({
      To: cleanTo,
      From: fromNumber,
      Body: message,
    })

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const result = await twilioRes.json()

    if (!twilioRes.ok) {
      return new Response(JSON.stringify({ error: result.message || 'Twilio error', code: result.code }), {
        status: twilioRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ success: true, sid: result.sid, status: result.status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
