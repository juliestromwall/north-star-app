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

  const { caseName, caseType, stage, status, emails, tasks, notes, checklist, appointments, transfers, texts, insurance, expenses, pregnancy, escrow } = await context.request.json()

  if (!caseName) {
    return new Response(JSON.stringify({ error: 'Missing caseName' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // Build context sections
  const sections = []

  sections.push(`Case: ${caseName} (${caseType || 'unknown type'})`)
  if (stage) sections.push(`Current Stage: ${stage}`)
  if (status) sections.push(`Current Status: ${status}`)

  if (pregnancy) {
    const pregParts = []
    if (pregnancy.gestationalAge) pregParts.push(`Gestational Age: ${pregnancy.gestationalAge}`)
    if (pregnancy.dueDate) pregParts.push(`Due Date: ${pregnancy.dueDate}`)
    if (pregnancy.isPregnant) pregParts.push('Status: Currently Pregnant')
    if (pregnancy.babies) pregParts.push(`Babies: ${pregnancy.babies}`)
    if (pregnancy.babySexes?.length > 0) pregParts.push(`Sex: ${pregnancy.babySexes.join(', ')}`)
    if (pregnancy.babyNames?.length > 0 && pregnancy.babyNames.some(n => n)) pregParts.push(`Names: ${pregnancy.babyNames.filter(n => n).join(', ')}`)
    if (pregParts.length > 0) sections.push(`\nPregnancy Status:\n${pregParts.join('\n')}`)
  }

  if (escrow) {
    const escParts = []
    if (escrow.balance) escParts.push(`Balance: ${escrow.balance}`)
    if (escrow.minimum) escParts.push(`Minimum: ${escrow.minimum}`)
    if (escrow.lastUpdated) escParts.push(`Last Updated: ${escrow.lastUpdated}`)
    if (escParts.length > 0) sections.push(`\nEscrow:\n${escParts.join('\n')}`)
  }

  if (emails?.length > 0) {
    const emailSummary = emails.slice(0, 15).map(e =>
      `- [${e.direction || 'unknown'}] ${e.date || ''}: "${e.subject || '(no subject)'}" ${e.from ? `from ${e.from}` : ''} ${e.tags?.length ? `[${e.tags.join(', ')}]` : ''}`
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
    const checkSummary = checklist.map(c =>
      `- ${c.label}: ${c.status === 'complete' ? 'Complete' : c.status === 'na' ? 'N/A' : c.status === 'not_started' ? 'Not Started' : c.status?.replace(/_/g, ' ') || 'Not Started'}${c.lastDate ? ` (${c.lastDate})` : ''}`
    ).join('\n')
    sections.push(`\nChecklist Progress:\n${checkSummary}`)
  }

  if (appointments?.length > 0) {
    const apptSummary = appointments.map(a =>
      `- ${a.date || ''}: ${a.title || '(untitled)'}${a.time ? ` at ${a.time}` : ''}`
    ).join('\n')
    sections.push(`\nAppointments:\n${apptSummary}`)
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
    if (insurance.startDate) insParts.push(`Start: ${insurance.startDate}`)
    if (insurance.endDate) insParts.push(`End: ${insurance.endDate}`)
    if (insurance.status) insParts.push(`Status: ${insurance.status}`)
    if (insParts.length > 0) sections.push(`\nInsurance:\n${insParts.join('\n')}`)
    if (insurance.payments?.length > 0) {
      const paymentSummary = insurance.payments.slice(0, 6).map(p =>
        `- ${p.monthFor || ''}: $${p.amount || '?'} — ${p.status || 'unknown'}`
      ).join('\n')
      sections.push(`\nRecent Insurance Payments:\n${paymentSummary}`)
    }
  }

  if (expenses?.length > 0) {
    const expSummary = expenses.slice(0, 10).map(e =>
      `- ${e.date || ''}: $${e.amount || '?'} to ${e.paidTo || 'unknown'}${e.escrow ? ' [ESCROW]' : ''}${e.reconciled ? ' (reconciled)' : ' (not reconciled)'}${e.notes ? ` — ${e.notes.slice(0, 80)}` : ''}`
    ).join('\n')
    sections.push(`\nRecent Expenses (${expenses.length} total, showing last ${Math.min(10, expenses.length)}):\n${expSummary}`)
  }

  if (texts?.length > 0) {
    const textSummary = texts.slice(0, 10).map(t =>
      `- [${t.direction || '?'}] ${t.date || ''}: ${(t.body || '').slice(0, 100)}`
    ).join('\n')
    sections.push(`\nRecent Text Messages (${texts.length} total, showing last ${Math.min(10, texts.length)}):\n${textSummary}`)
  }

  const caseData = sections.join('\n')

  const systemPrompt = `You are an AI assistant for ABC Surrogacy, a surrogacy agency. Generate a concise case summary using EXACTLY this section order. Skip any section that has no relevant data. Use the exact headers shown:

**🔬 Embryo Transfer**
Upcoming transfer date, or most recent transfer result. Highlight any pregnancy losses (miscarriage, ectopic, chemical).

**🤰 Pregnancy**
Gestational age, due date, baby name(s) and sex if known.

**📅 Appointments**
Upcoming appointments, or any from the past week. Include scheduled transfers.

**💰 Escrow**
Current balance vs minimum. Flag if balance is below minimum.

**✈️ Travel**
Any travel-related expenses or email threads (flights, hotels, car rentals).

**📝 Case Activity**
Brief summary of recent notes, texts, and emails logged. What's new in the last 1-2 weeks?

**💳 Recent Expenses**
Recent expenses, especially those submitted to escrow. Note unreconciled items.

**🏥 Insurance**
Payment status — is it up to date? Note upcoming or overdue premiums.

**⚠️ Outstanding Tasks**
Open or overdue tasks needing attention.

Keep each section to 1-3 bullet points max. Be brief and actionable — this is for a case manager scanning quickly. Do not make up information not in the data.`

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
        max_tokens: 800,
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
