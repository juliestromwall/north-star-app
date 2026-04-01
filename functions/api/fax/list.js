// Cloudflare Pages Function — GET /api/fax/list
// Lists fax inbox and outbox via SRFax API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const direction = url.searchParams.get('direction') || 'OUT' // IN or OUT
  const period = url.searchParams.get('period') || 'ALL'

  const accessId = env.SRFAX_ACCESS_ID
  const accessPwd = env.SRFAX_ACCESS_PWD

  if (!accessId || !accessPwd) {
    return new Response(JSON.stringify({ error: 'SRFax not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const action = direction === 'IN' ? 'Get_Fax_Inbox' : 'Get_Fax_Outbox'

    const res = await fetch('https://secure.srfax.com/SRF_SecWebSvc.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action,
        access_id: accessId,
        access_pwd: accessPwd,
        sPeriod: period,
        sResponseFormat: 'JSON',
      }).toString(),
    })

    const result = await res.json()

    if (result.Status === 'Success') {
      return new Response(JSON.stringify({ success: true, faxes: result.Result || [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ error: result.Result || 'SRFax error' }), {
      status: 400,
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
  return new Response(null, { headers: corsHeaders })
}
