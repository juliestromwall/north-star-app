// Cloudflare Pages Function — POST /api/ai/case-summary
// Uses Claude API to generate an AI summary of a case

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
  const apiKey = env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { caseName, caseType, status, emails, tasks, notes, checklist, pastAppointments, upcomingAppointments, transfers, insurance, expenses, pregnancy, escrow } = await context.request.json()

  if (!caseName) {
    return new Response(JSON.stringify({ error: 'Missing caseName' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Build context sections
  const sections = []

  sections.push(`Case: ${caseName} (${caseType || 'unknown type'})`)
  if (status) sections.push(`Current Status: ${status}`)

  if (pregnancy) {
    const pregParts = []
    if (pregnancy.delivered) {
      pregParts.push('STATUS: Baby has been BORN')
      if (pregnancy.deliveryDate) pregParts.push(`Delivery Date: ${pregnancy.deliveryDate}`)
      if (pregnancy.deliveryType) pregParts.push(`Delivery Type: ${pregnancy.deliveryType}`)
      if (pregnancy.dueDate) pregParts.push(`Original Due Date: ${pregnancy.dueDate}`)
      if (pregnancy.babyNames?.length > 0 && pregnancy.babyNames.some(n => n)) pregParts.push(`Baby Name(s): ${pregnancy.babyNames.filter(n => n).join(', ')}`)
      if (pregnancy.babySexes?.length > 0) pregParts.push(`Sex: ${pregnancy.babySexes.join(', ')}`)
      if (pregnancy.babyWeights?.length > 0) pregParts.push(`Weight: ${pregnancy.babyWeights.filter(w => w).join(', ')}`)
      if (pregnancy.babyLengths?.length > 0) pregParts.push(`Length: ${pregnancy.babyLengths.filter(l => l).join(', ')}`)
      if (pregnancy.deliveryNotes) pregParts.push(`Notes: ${pregnancy.deliveryNotes}`)
    } else if (pregnancy.isPregnant) {
      pregParts.push('Status: Currently Pregnant')
      if (pregnancy.gestationalAge) pregParts.push(`Gestational Age: ${pregnancy.gestationalAge}`)
      if (pregnancy.dueDate) pregParts.push(`Due Date: ${pregnancy.dueDate}`)
      if (pregnancy.babies) pregParts.push(`Babies: ${pregnancy.babies}`)
      if (pregnancy.babySexes?.length > 0) pregParts.push(`Sex: ${pregnancy.babySexes.join(', ')}`)
      if (pregnancy.babyNames?.length > 0 && pregnancy.babyNames.some(n => n)) pregParts.push(`Names: ${pregnancy.babyNames.filter(n => n).join(', ')}`)
    }
    if (pregParts.length > 0) sections.push(`\nPregnancy / Birth:\n${pregParts.join('\n')}`)
  }

  if (escrow) {
    const escParts = []
    if (escrow.balance) escParts.push(`Balance: ${escrow.balance}`)
    if (escrow.minimum) escParts.push(`Minimum: ${escrow.minimum}`)
    if (escParts.length > 0) sections.push(`\nEscrow:\n${escParts.join('\n')}`)
  }

  if (emails?.length > 0) {
    const emailSummary = emails.slice(0, 15).map(e =>
      `- [${e.direction || 'unknown'}] ${e.date || ''}: "${e.subject || '(no subject)'}" ${e.from ? `from ${e.from}` : ''}${e.snippet ? ` — ${e.snippet}` : ''} ${e.tags?.length ? `[${e.tags.join(', ')}]` : ''}`
    ).join('\n')
    sections.push(`\nRecent Emails (${emails.length} total, showing last ${Math.min(15, emails.length)}):\n${emailSummary}`)
  }

  if (tasks?.length > 0) {
    const taskSummary = tasks.map(t =>
      `- [${t.status || 'open'}] "${t.title}" (priority: ${t.priority || 'normal'})${t.due_date ? ` due ${t.due_date}` : ''}${t.notes ? ` — ${t.notes.slice(0, 100)}` : ''}`
    ).join('\n')
    sections.push(`\nTasks (${tasks.length}):\n${taskSummary}`)
  }

  if (notes?.length > 0) {
    const noteSummary = notes.slice(0, 10).map(n =>
      `- ${n.created_at || ''}: ${(n.content || '').replace(/<[^>]+>/g, '').slice(0, 150)}`
    ).join('\n')
    sections.push(`\nCase Notes (${notes.length} total, showing last ${Math.min(10, notes.length)}):\n${noteSummary}`)
  }

  if (checklist?.length > 0) {
    const checkSummary = checklist.map(c => {
      const statusLabel = c.status === 'complete' ? 'Complete' : c.status === 'na' ? 'N/A' : c.status === 'not_started' ? 'Not Started' : c.status?.replace(/_/g, ' ') || 'Not Started'
      let line = `- ${c.label}: ${statusLabel}${c.lastDate ? ` (${c.lastDate})` : ''}`
      if (c.logs?.length > 0) line += `\n  Logs: ${c.logs.join(' → ')}`
      return line
    }).join('\n')
    sections.push(`\nChecklist Progress:\n${checkSummary}`)
  }

  if (upcomingAppointments?.length > 0) {
    const apptSummary = upcomingAppointments.map(a =>
      `- ${a.date || ''}: ${a.title || '(untitled)'}${a.time ? ` at ${a.time}` : ''}`
    ).join('\n')
    sections.push(`\nUpcoming Appointments:\n${apptSummary}`)
  } else {
    sections.push(`\nUpcoming Appointments: None scheduled`)
  }

  if (pastAppointments?.length > 0) {
    const pastSummary = pastAppointments.slice(-7).map(a =>
      `- ${a.date || ''}: ${a.title || '(untitled)'}${a.time ? ` at ${a.time}` : ''}`
    ).join('\n')
    sections.push(`\nRecent Past Appointments (last 7):\n${pastSummary}`)
  }

  if (transfers?.length > 0) {
    const transferSummary = transfers.map((t, i) => {
      const parts = [`Transfer ${i + 1}: ${t.date || 'date TBD'}`]
      if (t.embryoCount) parts.push(`${t.embryoCount} embryo(s)`)
      if (t.betaResult) parts.push(`Beta: ${t.betaResult}`)
      if (t.heartbeat) parts.push(`Heartbeat: confirmed`)
      if (t.unsuccessful) parts.push(`Status: unsuccessful`)
      if (t.dropped) parts.push(`Status: dropped`)
      if (t.lossType) parts.push(`PREGNANCY LOSS: ${t.lossType}${t.lossDate ? ` on ${t.lossDate}` : ''}`)
      return `- ${parts.join(', ')}`
    }).join('\n')
    sections.push(`\nEmbryo Transfers:\n${transferSummary}`)
  }

  if (insurance) {
    const insParts = []
    if (insurance.carrier) insParts.push(`Carrier: ${insurance.carrier}`)
    if (insurance.premium) insParts.push(`Premium: $${insurance.premium}`)
    if (insurance.premiumDueDay) insParts.push(`Due day: ${insurance.premiumDueDay} of each month`)
    if (insParts.length > 0) sections.push(`\nInsurance:\n${insParts.join('\n')}`)
  }

  if (expenses?.length > 0) {
    const expSummary = expenses.slice(0, 10).map(e =>
      `- ${e.date || ''}: $${e.amount || '?'} to ${e.paidTo || 'unknown'}${e.escrow ? ' [ESCROW]' : ''}${e.reconciled ? ' (reconciled)' : ' (not reconciled)'}${e.notes ? ` — ${e.notes.slice(0, 80)}` : ''}`
    ).join('\n')
    sections.push(`\nRecent Expenses (${expenses.length} total):\n${expSummary}`)
  }

  const caseData = sections.join('\n')

  const systemPrompt = `You are an AI assistant for North Star Surrogacy, a surrogacy agency. Generate a concise case summary using EXACTLY this section order. Skip any section that has no relevant data. Use the exact headers shown. ALL DATES must be formatted as MM/DD/YYYY.

**🤰 Pregnancy / Birth**
If baby has been born: show birth date, baby name(s), sex, weight, length, delivery type, and any notes. Keep the original due date for reference.
If still pregnant: show gestational age, due date, baby name(s) and sex if known.
If there was a loss: note the type and date.

**🔬 Embryo Transfer**
Most recent transfer result. Only show if relevant.

**📅 Upcoming Appointments**
List future appointments. If none are scheduled, say "None currently scheduled."

**📅 Recent Appointments**
Appointments from the past week or two. Skip if none.

**💰 Escrow**
Current balance vs minimum. Flag if balance is below minimum or not set up.

**✈️ Travel**
Any travel-related expenses or email threads (flights, hotels, car rentals). Skip if none.

**📝 Case Activity**
Summarize recent emails, notes, and text messages. What's new? Include key details from email subjects/snippets. Highlight anything that needs follow-up.

**📋 Checklist Progress**
Summarize checklist status — what's complete, what's in progress, what's not started. Include notable log entries if they contain useful info.

**💳 Recent Expenses**
Recent expenses, especially those submitted to escrow. Note unreconciled items.

**🏥 Insurance**
Payment status — is it up to date? Note upcoming or overdue premiums.

**⚠️ Outstanding Tasks**
Open or overdue tasks needing attention.

Keep each section to 1-3 bullet points max. Be brief and actionable — this is for a case manager scanning quickly. Do not make up information not in the data. Do NOT include a "Case Summary" header or repeat the case name.`

  const userPrompt = `Generate a case summary for this surrogacy case:\n\n${caseData}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Claude API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const summary = data.content?.[0]?.text || 'No summary generated.'

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to call AI' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
