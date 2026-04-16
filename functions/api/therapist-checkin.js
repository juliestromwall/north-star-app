// Cloudflare Pages Function — POST /api/therapist-checkin
// Handles therapist check-in submission server-side (bypasses RLS for shared link users)
// Uploads PDF to case_documents psych folder + creates task for case manager

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
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
  const BUCKET = 'case-documents'

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const body = await context.request.json()
    const {
      surrogateId,
      surrogateName,
      milestoneName,
      pdfBase64, // base64 string of PDF
      fileName,
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

    const results = { documentUploaded: false, taskCreated: false }

    // 1. Convert base64 to bytes
    const binary = atob(pdfBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    // 2. Upload to storage
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${surrogateId}/psych/${Date.now()}-${safeName}`
    try {
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/pdf', 'Cache-Control': '3600' },
        body: bytes,
      })
      if (!uploadRes.ok) {
        const errText = await uploadRes.text()
        console.error('Storage upload failed:', uploadRes.status, errText)
      } else {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
        // 3. Insert into case_documents
        const docRes = await fetch(`${supabaseUrl}/rest/v1/case_documents`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({
            surrogate_id: surrogateId,
            category: 'psych',
            file_name: fileName,
            file_type: 'application/pdf',
            file_size: bytes.length,
            storage_path: storagePath,
            public_url: publicUrl,
            uploaded_by: uploadedBy || 'Therapist',
          }),
        })
        if (docRes.ok) {
          results.documentUploaded = true
        } else {
          const docErr = await docRes.text()
          console.error('case_documents insert failed:', docRes.status, docErr)
        }
      }
    } catch (e) { console.error('PDF upload exception:', e) }

    // 4. Create task
    try {
      const taskPayload = journeyId
        ? { case_id: journeyId, case_type: 'journey', title: taskTitle, priority: 'normal', status: 'open', assigned_to: caseManagerEmail || '', created_by: uploadedBy || 'Therapist', description: taskDescription || '' }
        : { case_id: surrogateId, case_type: 'surrogate', title: taskTitle, priority: 'normal', status: 'open', assigned_to: caseManagerEmail || '', created_by: uploadedBy || 'Therapist', description: taskDescription || '' }
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
      }
    } catch (e) { console.error('Task creation exception:', e) }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Therapist check-in handler error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
