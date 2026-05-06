// Cloudflare Pages Function — GET /api/fax/list
// Lists fax inbox and outbox via SRFax API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Hard cutoff: never surface faxes from before this date. The SRFax account
// has historical traffic that predates this app's adoption of fax — Julie
// only wants the inbox/outbox views to start fresh from 2026-05-06.
const CUTOFF_EPOCH_SECONDS = Math.floor(Date.UTC(2026, 4, 6) / 1000) // May 6, 2026 00:00 UTC

function faxIsOnOrAfterCutoff(fax) {
  // Inbox rows include EpochTime (Unix seconds). Use that when present.
  if (fax?.EpochTime) {
    const epoch = parseInt(fax.EpochTime, 10)
    if (Number.isFinite(epoch)) return epoch >= CUTOFF_EPOCH_SECONDS
  }
  // Outbox rows include DateSent / DateQueued strings (parseable by Date).
  const dateStr = fax?.DateSent || fax?.DateQueued || fax?.Date
  if (dateStr) {
    const t = new Date(dateStr).getTime()
    if (Number.isFinite(t)) return Math.floor(t / 1000) >= CUTOFF_EPOCH_SECONDS
  }
  // No date on the row — drop it to be safe (won't surface ancient
  // undated entries).
  return false
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
      const all = Array.isArray(result.Result) ? result.Result : []
      const faxes = all.filter(faxIsOnOrAfterCutoff)
      return new Response(JSON.stringify({ success: true, faxes }), {
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
