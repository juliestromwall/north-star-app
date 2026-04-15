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

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const url = new URL(context.request.url)
    const filterContact = url.searchParams.get('contact') // filter to/from a specific number
    const pageSize = url.searchParams.get('limit') || '100'
    const numbersParam = url.searchParams.get('numbers') // comma-separated E.164 numbers

    // Build list of admin phone numbers to query
    const numbers = numbersParam
      ? numbersParam.split(',').map(n => n.trim()).filter(Boolean)
      : env.TWILIO_PHONE_NUMBER ? [env.TWILIO_PHONE_NUMBER] : []

    if (numbers.length === 0) {
      return new Response(JSON.stringify({ error: 'No phone numbers configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const auth = btoa(`${accountSid}:${authToken}`)
    const headers = { 'Authorization': `Basic ${auth}` }

    // For each number, fetch sent (From=number) and received (To=number)
    const fetches = numbers.flatMap(number => {
      const sentUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`)
      sentUrl.searchParams.set('From', number)
      sentUrl.searchParams.set('PageSize', pageSize)
      if (filterContact) sentUrl.searchParams.set('To', filterContact)

      const receivedUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`)
      receivedUrl.searchParams.set('To', number)
      receivedUrl.searchParams.set('PageSize', pageSize)
      if (filterContact) receivedUrl.searchParams.set('From', filterContact)

      return [
        fetch(sentUrl.toString(), { headers }).then(r => r.json()).then(d => ({ type: 'sent', data: d })),
        fetch(receivedUrl.toString(), { headers }).then(r => r.json()).then(d => ({ type: 'received', data: d })),
      ]
    })

    const results = await Promise.all(fetches)

    const allMessages = results.flatMap(({ type, data }) =>
      (data.messages || []).map(m => ({
        sid: m.sid,
        direction: type === 'sent' ? 'outbound' : 'inbound',
        from: m.from,
        to: m.to,
        body: m.body,
        status: m.status,
        date: m.date_sent || m.date_created,
      }))
    )

    // Deduplicate by sid and sort by date descending
    const seen = new Set()
    const unique = allMessages.filter(m => {
      if (seen.has(m.sid)) return false
      seen.add(m.sid)
      return true
    })
    unique.sort((a, b) => new Date(b.date) - new Date(a.date))

    return new Response(JSON.stringify({ messages: unique, numbers }), {
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
