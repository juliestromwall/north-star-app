// Cloudflare Pages Function — POST /api/fax/send
// Sends a fax via SRFax API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestPost(context) {
  const { env } = context

  try {
    const { to, fileName, fileContent, coverPage, coverSubject, coverMessage } = await context.request.json()

    if (!to || !fileContent) {
      return new Response(JSON.stringify({ error: 'Missing "to" or "fileContent"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const accessId = env.SRFAX_ACCESS_ID
    const accessPwd = env.SRFAX_ACCESS_PWD
    const callerID = env.SRFAX_CALLER_ID || ''

    if (!accessId || !accessPwd) {
      return new Response(JSON.stringify({ error: 'SRFax not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Clean fax number — SRFax expects NANPA format (1XXXXXXXXXX)
    let cleanTo = to.replace(/[^\d+]/g, '')
    if (cleanTo.startsWith('+')) cleanTo = cleanTo.slice(1)
    if (!cleanTo.startsWith('1') && cleanTo.length === 10) cleanTo = '1' + cleanTo

    const payload = {
      action: 'Queue_Fax',
      access_id: accessId,
      access_pwd: accessPwd,
      sCallerID: callerID,
      sSenderEmail: env.SRFAX_SENDER_EMAIL || '',
      sFaxType: 'SINGLE',
      sToFaxNumber: cleanTo,
      sFileName_1: fileName || 'document.pdf',
      sFileContent_1: fileContent, // Base64-encoded file content
      sResponseFormat: 'JSON',
    }

    // Optional cover page
    if (coverPage) {
      payload.sCoverPage = coverPage // 'Standard', 'Company', etc.
      if (coverSubject) payload.sCPSubject = coverSubject
      if (coverMessage) payload.sCPComments = coverMessage
    }

    const res = await fetch('https://secure.srfax.com/SRF_SecWebSvc.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload).toString(),
    })

    const result = await res.json()

    if (result.Status === 'Success') {
      return new Response(JSON.stringify({ success: true, faxId: result.Result }), {
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
