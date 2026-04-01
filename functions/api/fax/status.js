// Cloudflare Pages Function — POST /api/fax/status
// Checks fax status via SRFax API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestPost(context) {
  const { env } = context

  try {
    const { faxId } = await context.request.json()

    if (!faxId) {
      return new Response(JSON.stringify({ error: 'Missing faxId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const res = await fetch('https://secure.srfax.com/SRF_SecWebSvc.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'Get_FaxStatus',
        access_id: env.SRFAX_ACCESS_ID,
        access_pwd: env.SRFAX_ACCESS_PWD,
        sFaxDetailsID: faxId,
        sResponseFormat: 'JSON',
      }).toString(),
    })

    const result = await res.json()

    if (result.Status === 'Success') {
      return new Response(JSON.stringify({ success: true, result: result.Result }), {
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
