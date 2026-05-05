// Cloudflare Pages Function — POST /api/therapist-checkin
// Handles therapist check-in submission server-side (bypasses RLS for shared link users)
// Uploads PDF to case_documents psych folder + creates task for case manager

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Therapist-Session',
}

const SHARE_KEY = 'psych_tracking_share'

// Admin notification (the case manager) always goes to the assigned
// caseManagerEmail. Jenny's confirmation copy now goes to her real
// address. Flip JENNY_USE_TEST_RECIPIENT back to true to redirect to
// the spam-test inbox while debugging.
const TEST_RECIPIENT_EMAIL = 'juliestromwalll@gmail.com'
const JENNY_REAL_EMAIL = 'joliver_2@hotmail.com'
const JENNY_USE_TEST_RECIPIENT = false

function buildAdminCheckinEmailHtml({ patientName, milestoneName, therapistName, journeyUrl }) {
  return `<!DOCTYPE html>
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
        🧾 ${milestoneName} Check-In Complete
      </h1>
      <div style="padding: 24px 0;">
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
          ${therapistName ? `<strong style="color: #283693;">${therapistName}</strong> just` : 'Just'} completed the <strong>${milestoneName}</strong> check-in for <strong style="color: #283693;">${patientName}</strong>.
        </p>
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
          The signed check-in note and invoice are attached to this email, and a review task has been created on the case for you.
        </p>
      </div>
      ${journeyUrl ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${journeyUrl}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Open Case
        </a>
      </div>` : ''}
      <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 24px 0 0; border: 1px solid #fde68a;">
        <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
          <strong>Confidential:</strong> This email contains protected health information. Please do not forward, share, or distribute this email or its attachments outside of authorized ABC Surrogacy staff.
        </p>
      </div>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
      <p style="color: #a8a29e; font-size: 10px; text-align: center;">
        Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendAdminCheckinEmail({ resendKey, fromEmail, recipient, patientName, milestoneName, therapistName, journeyUrl, attachments }) {
  const subject = `🧾 ${milestoneName} check in for ${patientName} Complete`
  const html = buildAdminCheckinEmailHtml({ patientName, milestoneName, therapistName, journeyUrl })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `ABC Surrogacy <${fromEmail}>`,
      to: [recipient],
      subject,
      html,
      attachments,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${res.status}: ${errText}`)
  }
  return await res.json()
}

function buildJennyInvoiceEmailHtml({ patientName, milestoneName }) {
  return `<!DOCTYPE html>
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
        🧾 Invoice Sent to ABC Surrogacy
      </h1>
      <div style="padding: 24px 0;">
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
          Hi Jenny!
        </p>
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
          Your <strong>${milestoneName}</strong> check-in for <strong style="color: #283693;">${patientName}</strong> has been submitted to ABC Surrogacy. A copy of your invoice is attached for your records.
        </p>
        <p style="font-size: 15px; color: #44403c; margin: 0 0 16px; line-height: 1.6;">
          Thank you!
        </p>
      </div>
      <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 24px 0 0; border: 1px solid #fde68a;">
        <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
          <strong>Confidential:</strong> This email contains protected health information. Please do not forward, share, or distribute this email or its attachments outside of authorized parties.
        </p>
      </div>
      <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0 16px;" />
      <p style="color: #a8a29e; font-size: 10px; text-align: center;">
        Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendJennyInvoiceEmail({ resendKey, fromEmail, recipient, patientName, milestoneName, attachments }) {
  const subject = `🧾 Invoice sent to ABC Surrogacy for ${patientName}'s ${milestoneName}`
  const html = buildJennyInvoiceEmailHtml({ patientName, milestoneName })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `ABC Surrogacy <${fromEmail}>`,
      to: [recipient],
      subject,
      html,
      attachments,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${res.status}: ${errText}`)
  }
  return await res.json()
}

function isActiveMatchedJourney(journey) {
  const status = String(journey?.status || '').toLowerCase()
  const stage = String(journey?.stage || '').toLowerCase()
  const state = `${status} ${stage}`
  return !/(broken|cancelled|canceled|failed|terminated|dissolved)/.test(state)
}

function b64url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return b64url(new Uint8Array(sig))
}

async function verifySession(secret, sessionToken, expectedShareToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return false
  const [payload, sig] = sessionToken.split('.')
  if (!payload || !sig) return false
  const expectedSig = await hmac(secret, payload)
  if (sig !== expectedSig) return false
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)))
    return data.token === expectedShareToken && Number(data.exp) > Date.now()
  } catch {
    return false
  }
}

async function getShareData(supabaseUrl, supabaseKey) {
  const res = await fetch(`${supabaseUrl}/rest/v1/app_config?config_key=eq.${SHARE_KEY}&select=config_value`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0]?.config_value || null
}

async function isAuthorized(request, supabaseUrl, supabaseKey) {
  const therapistSession = request.headers.get('X-Therapist-Session')
  if (therapistSession) {
    const shareData = await getShareData(supabaseUrl, supabaseKey)
    return Boolean(shareData?.token && await verifySession(supabaseKey, therapistSession, shareData.token))
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: authHeader },
  })
  return userRes.ok
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
  const BUCKET = 'case-documents'

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  if (!await isAuthorized(context.request, supabaseUrl, supabaseKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const body = await context.request.json()
    const {
      surrogateId,
      surrogateName,
      milestoneName,
      pdfBase64, // base64 string of check-in note PDF
      fileName,
      invoicePdfBase64, // optional base64 string of invoice PDF
      invoiceFileName,
      uploadedBy, // therapist name
      caseManagerEmail,
      journeyId, // if known
      taskTitle,
      taskDescription,
    } = body

    if (!surrogateId || !pdfBase64 || !fileName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const sbHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }

    const results = { documentUploaded: false, invoiceUploaded: false, taskCreated: false, adminEmailSent: false, jennyEmailSent: false, errors: {} }

    async function uploadPdfToCaseDocuments({ base64, name, category, errKeyPrefix }) {
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${surrogateId}/${category}/${Date.now()}-${safeName}`
      try {
        const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Content-Type': 'application/pdf', 'Cache-Control': '3600' },
          body: bytes,
        })
        if (!uploadRes.ok) {
          const errText = await uploadRes.text()
          console.error(`${errKeyPrefix} storage upload failed:`, uploadRes.status, errText)
          results.errors[`${errKeyPrefix}_storage`] = `${uploadRes.status}: ${errText}`
          return false
        }
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
        const docRes = await fetch(`${supabaseUrl}/rest/v1/case_documents`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({
            surrogate_id: surrogateId,
            category,
            file_name: name,
            file_type: 'application/pdf',
            file_size: bytes.length,
            storage_path: storagePath,
            public_url: publicUrl,
            uploaded_by: uploadedBy || 'Therapist',
          }),
        })
        if (docRes.ok) return true
        const docErr = await docRes.text()
        console.error(`${errKeyPrefix} case_documents insert failed:`, docRes.status, docErr)
        results.errors[`${errKeyPrefix}_case_documents`] = `${docRes.status}: ${docErr}`
        return false
      } catch (e) {
        console.error(`${errKeyPrefix} upload exception:`, e)
        results.errors[`${errKeyPrefix}_exception`] = e.message
        return false
      }
    }

    // 1. Upload check-in note PDF (psych-evaluation folder)
    results.documentUploaded = await uploadPdfToCaseDocuments({
      base64: pdfBase64,
      name: fileName,
      category: 'psych-evaluation',
      errKeyPrefix: 'note',
    })

    // 1b. Upload invoice PDF if present (receipts folder)
    if (invoicePdfBase64 && invoiceFileName) {
      results.invoiceUploaded = await uploadPdfToCaseDocuments({
        base64: invoicePdfBase64,
        name: invoiceFileName,
        category: 'receipts',
        errKeyPrefix: 'invoice',
      })
    }

    // 4. Look up matched journey if not provided (covers shared link case)
    let resolvedJourneyId = journeyId
    let resolvedAssignee = caseManagerEmail || ''
    if (!resolvedJourneyId) {
      try {
        const jRes = await fetch(
          `${supabaseUrl}/rest/v1/matched_journeys?gc_case_id=eq.${surrogateId}&select=id,assigned_to,status,stage,journey_data&order=created_at.desc`,
          { headers: sbHeaders }
        )
        const jRows = await jRes.json()
        const activeJourney = (jRows || []).find(isActiveMatchedJourney)
        if (activeJourney) {
          resolvedJourneyId = activeJourney.id
          if (!resolvedAssignee) {
            resolvedAssignee = activeJourney.assigned_to || activeJourney.journey_data?.assigned_to || ''
          }
        }
      } catch (e) { console.error('Journey lookup failed:', e) }
    }

    // 5. Create task — on the journey if matched, else on the surrogate case
    try {
      const taskPayload = resolvedJourneyId
        ? { case_id: resolvedJourneyId, case_type: 'journey', title: taskTitle, priority: 'normal', status: 'open', assigned_to: resolvedAssignee, created_by: uploadedBy || 'Therapist', description: taskDescription || '' }
        : { case_id: surrogateId, case_type: 'surrogate', title: taskTitle, priority: 'normal', status: 'open', assigned_to: resolvedAssignee, created_by: uploadedBy || 'Therapist', description: taskDescription || '' }
      const taskRes = await fetch(`${supabaseUrl}/rest/v1/case_tasks`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(taskPayload),
      })
      if (taskRes.ok) {
        results.taskCreated = true
      } else {
        const taskErr = await taskRes.text()
        console.error('case_tasks insert failed:', taskRes.status, taskErr)
        results.errors.case_tasks = `${taskRes.status}: ${taskErr}`
      }
    } catch (e) {
      console.error('Task creation exception:', e)
      results.errors.task_exception = e.message
    }

    // 6. Notify the assigned admin (case manager) — best-effort. Goes to the
    // real caseManagerEmail (or the resolved journey assignee as fallback).
    const resendKey = env.RESEND_API_KEY
    const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@abcsurrogacy.com'
    const adminRecipient = caseManagerEmail || resolvedAssignee || ''
    const patientLabel = surrogateName || 'Surrogate'
    const milestoneLabel = milestoneName || 'Check-In'
    if (resendKey && adminRecipient && results.documentUploaded) {
      try {
        const attachments = [{ filename: fileName, content: pdfBase64 }]
        if (invoicePdfBase64 && invoiceFileName && results.invoiceUploaded) {
          attachments.push({ filename: invoiceFileName, content: invoicePdfBase64 })
        }
        const journeyUrl = resolvedJourneyId
          ? `https://app.abcsurrogacy.com/journeys/${resolvedJourneyId}`
          : `https://app.abcsurrogacy.com/surrogates/${surrogateId}`
        await sendAdminCheckinEmail({
          resendKey,
          fromEmail,
          recipient: adminRecipient,
          patientName: patientLabel,
          milestoneName: milestoneLabel,
          therapistName: uploadedBy || '',
          journeyUrl,
          attachments,
        })
        results.adminEmailSent = true
      } catch (e) {
        console.error('Admin notification email failed:', e)
        results.errors.admin_email = e.message
      }
    } else if (!resendKey) {
      results.errors.admin_email = 'RESEND_API_KEY not configured'
    } else if (!adminRecipient) {
      results.errors.admin_email = 'No admin recipient (caseManagerEmail empty and no resolvedAssignee)'
    }

    // 7. Send Jenny her own copy of the invoice — best-effort. Currently
    // routed to the spam-test inbox; flip JENNY_USE_TEST_RECIPIENT to false
    // to start sending to her real address.
    const jennyRecipient = JENNY_USE_TEST_RECIPIENT ? TEST_RECIPIENT_EMAIL : JENNY_REAL_EMAIL
    if (resendKey && jennyRecipient && invoicePdfBase64 && invoiceFileName && results.invoiceUploaded) {
      try {
        await sendJennyInvoiceEmail({
          resendKey,
          fromEmail,
          recipient: jennyRecipient,
          patientName: patientLabel,
          milestoneName: milestoneLabel,
          attachments: [{ filename: invoiceFileName, content: invoicePdfBase64 }],
        })
        results.jennyEmailSent = true
      } catch (e) {
        console.error('Jenny invoice email failed:', e)
        results.errors.jenny_email = e.message
      }
    }

    const complete = results.documentUploaded && results.taskCreated
    return new Response(JSON.stringify({ success: complete, ...results }), {
      status: complete ? 200 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Therapist check-in handler error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
