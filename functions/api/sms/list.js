// Cloudflare Pages Function — GET /api/sms/list
// Fetches sent & received SMS from Twilio for the configured number.
// Optional query params: ?to=+1234567890 (filter by contact number)

export async function onRequestGet(context) {
  const { env } = context
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const accountSid = env.TWILIO_ACCOUNT_SID
    const authToken = env.TWILIO_AUTH_TOKEN
    const fromNumber = env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const url = new URL(context.request.url)
    const filterContact = url.searchParams.get('contact') // filter to/from a specific number
    const pageSize = url.searchParams.get('limit') || '100'

    const auth = btoa(`${accountSid}:${authToken}`)

    // Fetch sent messages (from our number)
    const sentUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`)
    sentUrl.searchParams.set('From', fromNumber)
    sentUrl.searchParams.set('PageSize', pageSize)
    if (filterContact) sentUrl.searchParams.set('To', filterContact)

    // Fetch received messages (to our number)
    const receivedUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`)
    receivedUrl.searchParams.set('To', fromNumber)
    receivedUrl.searchParams.set('PageSize', pageSize)
    if (filterContact) receivedUrl.searchParams.set('From', filterContact)

    const headers = {
      'Authorization': `Basic ${auth}`,
    }

    const [sentRes, receivedRes] = await Promise.all([
      fetch(sentUrl.toString(), { headers }),
      fetch(receivedUrl.toString(), { headers }),
    ])

    const sentData = await sentRes.json()
    const receivedData = await receivedRes.json()

    const sent = (sentData.messages || []).map(m => ({
      sid: m.sid,
      direction: 'outbound',
      from: m.from,
      to: m.to,
      body: m.body,
      status: m.status,
      date: m.date_sent || m.date_created,
    }))

    const received = (receivedData.messages || []).map(m => ({
      sid: m.sid,
      direction: 'inbound',
      from: m.from,
      to: m.to,
      body: m.body,
      status: m.status,
      date: m.date_sent || m.date_created,
    }))

    // Merge and sort by date descending
    const all = [...sent, ...received].sort((a, b) => new Date(b.date) - new Date(a.date))

    return new Response(JSON.stringify({ messages: all, fromNumber }), {
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
