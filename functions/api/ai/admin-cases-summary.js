// Cloudflare Pages Function — POST /api/ai/admin-cases-summary
//
// Aggregates ALL cases assigned to an admin (surrogates, IPs, journeys),
// computes gap signals per case (days since last contact, open tasks,
// checklist gaps, etc.), and asks Claude to produce a workload-overview
// summary highlighting where the admin's attention is needed.
//
// Auth model: caller passes adminEmail. Frontend gates "summarize someone
// else" to master/super admins via UI; server trusts the email it gets.
// Service-role Supabase calls bypass RLS so the admin sees everything for
// their assigned cases.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

const DAY_MS = 24 * 60 * 60 * 1000
const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / DAY_MS)
}

async function sb(env, path) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL) + '/rest/v1/' + path
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) {
    console.error('Supabase error', path, res.status, await res.text())
    return []
  }
  return res.json()
}

export async function onRequestPost(context) {
  // Outer try/catch so ANY failure returns JSON instead of letting Cloudflare
  // serve its default HTML 500 page (which causes "Unexpected token '<'" on
  // the client). Without this, anything that throws before our normal
  // try/catch — env-var access, JSON.parse of the request body, undefined
  // helper — bubbles up as HTML.
  try {
    return await runSummary(context)
  } catch (err) {
    console.error('admin-cases-summary fatal:', err)
    return new Response(JSON.stringify({
      error: err?.message || 'Server error generating summary',
      stack: err?.stack ? String(err.stack).split('\n').slice(0, 4).join('\n') : null,
    }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
}

async function runSummary(context) {
  const { env } = context
  const apiKey = env.ANTHROPIC_API_KEY
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Cloudflare Pages env' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_URL not configured in Cloudflare Pages env' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Cloudflare Pages env' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { adminEmail, adminName } = await context.request.json()
  if (!adminEmail) {
    return new Response(JSON.stringify({ error: 'Missing adminEmail' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // ── 1. Fetch admin's assigned cases ──────────────────────
  const emailParam = encodeURIComponent(adminEmail)
  const intakes = await sb(env, `intake_submissions?assigned_to=eq.${emailParam}&select=id,intake_type,applicant_name,applicant_email,status,submitted_at,answers&order=submitted_at.desc`)
  const journeys = await sb(env, `matched_journeys?assigned_to=eq.${emailParam}&select=*&order=created_at.desc`)

  // Stage statuses live in app_config under config_key='surrogate_stages'
  const stageCfg = await sb(env, `app_config?config_key=eq.surrogate_stages&select=config_value`)
  const stageStatusMap = stageCfg?.[0]?.config_value || {}

  if (intakes.length === 0 && journeys.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      summary: `**No assigned cases**\n\nNothing's currently assigned to ${adminName || adminEmail}. When cases are assigned, click "Regenerate" to refresh this view.`,
      caseCount: 0,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }

  // Filter out archived journeys + closed/withdrawn intakes for the active workload view
  const activeJourneys = journeys.filter(j => !j.journey_data?._archivedAt && j.status !== 'Complete')
  const matchedGcIds = new Set(activeJourneys.map(j => j.gc_case_id))
  const matchedIpIds = new Set(activeJourneys.map(j => j.ip_case_id))
  const standaloneIntakes = intakes.filter(i => {
    const stage = stageStatusMap?.[i.id]?.stage
    if (['withdrawn', 'not-qualified', 'holding'].includes(stage)) return false
    if (i.intake_type === 'gc' && matchedGcIds.has(i.id)) return false
    if (i.intake_type === 'ip' && matchedIpIds.has(i.id)) return false
    return true
  })

  // ── 2. Bulk-fetch all activity data in 4 batched IN-clause queries ──
  // Cloudflare Workers cap each invocation at 50 subrequests on the free
  // plan / 1000 on paid. Fetching per-case (3 reqs * N cases) blows past
  // that for any admin with >15 cases. Doing IN clauses keeps the
  // subrequest count constant (~8) regardless of caseload.

  const allCaseIds = [
    ...standaloneIntakes.map(i => i.id),
    ...activeJourneys.map(j => j.id),
  ]
  const journeyIds = activeJourneys.map(j => j.id)
  // For naming journeys we need the GC and IP applicant_name even when those
  // intake rows aren't assigned to this admin (the admin owns the JOURNEY,
  // not the underlying intakes). Batch-fetch them up front.
  const journeyPersonIds = Array.from(new Set([
    ...activeJourneys.map(j => j.gc_case_id),
    ...activeJourneys.map(j => j.ip_case_id),
  ].filter(Boolean)))
  const inClause = (ids) => `(${ids.join(',')})`

  const [allEmails, allTasks, allNotes, allExpenses, journeyPeople] = await Promise.all([
    allCaseIds.length === 0 ? [] : sb(env, `case_emails?case_id=in.${inClause(allCaseIds)}&select=case_id,date,direction,subject&order=date.desc&limit=500`),
    allCaseIds.length === 0 ? [] : sb(env, `case_tasks?case_id=in.${inClause(allCaseIds)}&select=case_id,title,status,priority,due_date,created_at&order=created_at.desc&limit=500`),
    allCaseIds.length === 0 ? [] : sb(env, `case_notes?surrogate_id=in.${inClause(allCaseIds)}&select=surrogate_id,created_at&order=created_at.desc&limit=300`),
    journeyIds.length === 0 ? [] : sb(env, `journey_expenses?journey_id=in.${inClause(journeyIds)}&select=journey_id,expense_date,paid_at,disbursement_requested_at,pay_to_type&order=expense_date.desc&limit=500`),
    journeyPersonIds.length === 0 ? [] : sb(env, `intake_submissions?id=in.${inClause(journeyPersonIds)}&select=id,intake_type,applicant_name,answers`),
  ])

  // GC/IP name lookup — prefer applicant_name; fall back to first+last from answers
  const personById = new Map()
  for (const p of journeyPeople) {
    let name = p.applicant_name?.trim()
    if (!name) {
      const a = p.answers || {}
      name = (p.intake_type === 'ip'
        ? [a.primaryFirstName, a.primaryLastName].filter(Boolean).join(' ')
        : [a.firstName, a.lastName].filter(Boolean).join(' ')).trim()
    }
    personById.set(p.id, name || `Case ${p.id}`)
  }

  // Group by case_id / surrogate_id / journey_id
  const groupBy = (rows, key) => {
    const m = new Map()
    for (const r of rows) {
      const k = r[key]
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
    return m
  }
  const emailsByCase   = groupBy(allEmails, 'case_id')
  const tasksByCase    = groupBy(allTasks, 'case_id')
  const notesByCase    = groupBy(allNotes, 'surrogate_id')
  const expensesByJny  = groupBy(allExpenses, 'journey_id')

  // ── 3. Build one signal record per case ──────────────────
  const caseSignals = []

  for (const intake of standaloneIntakes) {
    const caseId = intake.id
    const isIP = intake.intake_type === 'ip'
    const stage = stageStatusMap?.[caseId]?.stage || 'pre-qualification'
    const status = stageStatusMap?.[caseId]?.status || 'New'
    const a = intake.answers || {}

    const emails = emailsByCase.get(caseId) || []
    const tasks  = tasksByCase.get(caseId) || []
    const notes  = notesByCase.get(caseId) || []

    const openTasks = tasks.filter(t => t.status !== 'complete' && t.status !== 'completed')
    const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < today())

    const lastEmailDate = emails[0]?.date
    const lastNoteDate = notes[0]?.created_at
    const lastTaskActivity = tasks[0]?.created_at
    const lastTouch = [lastEmailDate, lastNoteDate, lastTaskActivity].filter(Boolean).sort().pop()

    // Profile / application gates — surface gaps in the workflow itself
    const flags = []
    if (isIP) {
      if (a._profileSubmitted && !a._ipProfile?._approved && !a._profileReleasedAt) flags.push('IP profile awaiting admin approval')
      if (a._ipProfile?._approved && !a._applicationAvailable) flags.push('Profile approved but application not yet released')
      if (a._applicationAvailable && !a._applicationSubmitted) flags.push('Application released to IP but not yet submitted')
    } else {
      if (a._profileSubmitted && !a._profileApproved && !a._profileReleasedAt) flags.push('Surrogate profile awaiting admin approval')
      if (a._applicationSubmitted && stage === 'pre-qualification') flags.push('Application submitted but case still in pre-qualification')
    }
    if (!a._reviewedAt && stage === 'pre-qualification') flags.push('Initial intake review not yet logged')

    // Checklist: scan _recordTracking for steps that are still "needed" / "pending"
    const tracking = a._recordTracking || {}
    const incompleteSteps = Object.entries(tracking)
      .filter(([_, v]) => v?.status && !['complete', 'completed', 'n/a', 'na'].includes(String(v.status).toLowerCase()))
      .map(([k, v]) => `${k}=${v.status}`)
      .slice(0, 8)

    caseSignals.push({
      kind: isIP ? 'IP' : 'Surrogate',
      id: caseId,
      name: intake.applicant_name || a.firstName || 'Unknown',
      url: isIP ? `/intended-parents/${caseId}` : `/surrogates/${caseId}`,
      email: intake.applicant_email,
      stage, status,
      submittedAt: intake.submitted_at?.split('T')[0],
      lastTouchDays: daysAgo(lastTouch),
      lastEmailDays: daysAgo(lastEmailDate),
      lastNoteDays: daysAgo(lastNoteDate),
      lastEmailSubject: emails[0]?.subject || null,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      overdueTaskTitles: overdueTasks.slice(0, 3).map(t => `${t.title} (due ${t.due_date})`),
      noteCount: notes.length,
      flags,
      incompleteSteps,
    })
  }

  for (const j of activeJourneys) {
    const jd = j.journey_data || {}
    const emails   = emailsByCase.get(j.id) || []
    const tasks    = tasksByCase.get(j.id) || []
    const expenses = expensesByJny.get(j.id) || []

    const openTasks = tasks.filter(t => t.status !== 'complete' && t.status !== 'completed')
    const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < today())
    const unpaidExpenses = expenses.filter(e => !e.paid_at && e.pay_to_type !== 'hold')
    const unrequestedExpenses = expenses.filter(e => !e.disbursement_requested_at && !e.paid_at && e.pay_to_type !== 'hold')

    const lastEmailDate = emails[0]?.date
    const lastTouch = [lastEmailDate, tasks[0]?.created_at, expenses[0]?.expense_date].filter(Boolean).sort().pop()

    // ── Pregnancy / transfer milestones ──
    // journey_data shape: dueDate (top), delivered, pregnant, babies, _transfers[]
    // Each transfer: { date, betaResult, betaDate, betaValue, needsSecondBeta, heartbeatConfirmed, heartbeatDate }
    const transfers = jd._transfers || []
    const latestTransfer = transfers[transfers.length - 1] || null
    const milestones = []
    const daysUntil = (iso) => {
      if (!iso) return null
      const d = new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'))
      return Math.floor((d.getTime() - Date.now()) / DAY_MS)
    }

    if (jd.delivered) {
      milestones.push(`Babies delivered ${jd.deliveryDate || ''}`.trim())
    } else if (jd.dueDate) {
      const d = daysUntil(jd.dueDate)
      if (d !== null) {
        if (d < 0) milestones.push(`Past due date by ${-d} days (${jd.dueDate}) — verify delivery logged`)
        else if (d <= 14) milestones.push(`🚨 Due in ${d} days (${jd.dueDate}) — birth imminent`)
        else if (d <= 28) milestones.push(`Due in ${d} days (${jd.dueDate}) — final stretch`)
        else if (d <= 84) milestones.push(`Due in ${d} days (${jd.dueDate}) — third trimester`)
        else milestones.push(`Due ${jd.dueDate} (${d} days out)`)
      }
    }

    if (latestTransfer) {
      const tDays = daysUntil(latestTransfer.date)
      if (tDays !== null && tDays > 0 && tDays <= 21 && !latestTransfer.betaResult) {
        milestones.push(`Transfer scheduled in ${tDays} days (${latestTransfer.date})`)
      }
      if (tDays !== null && tDays >= -21 && tDays <= 0 && !latestTransfer.betaResult) {
        // post-transfer waiting on beta — first beta typically 9-14 days after transfer
        const expectedBeta = -tDays >= 9 ? 'overdue' : `expected in ~${9 - (-tDays)}-${14 - (-tDays)} days`
        milestones.push(`First beta ${expectedBeta} (transfer was ${latestTransfer.date})`)
      }
      if (latestTransfer.betaResult === 'positive' && latestTransfer.needsSecondBeta) {
        milestones.push(`Second beta pending (1st was positive on ${latestTransfer.betaDate || 'unknown'})`)
      }
      if (latestTransfer.betaResult === 'positive' && !latestTransfer.heartbeatConfirmed && latestTransfer.betaDate) {
        const sinceBeta = daysAgo(latestTransfer.betaDate)
        if (sinceBeta !== null && sinceBeta >= 14 && sinceBeta <= 35) {
          milestones.push(`Heartbeat scan window — positive beta was ${sinceBeta} days ago`)
        }
      }
    }

    const flags = []
    if (jd.heartbeat_confirmed && !jd._heartbeatTaskFired) flags.push('Heartbeat confirmed — verify follow-up tasks fired')
    if (j.status === 'Active' && unrequestedExpenses.length > 0) flags.push(`${unrequestedExpenses.length} expense(s) not yet submitted to escrow`)

    // Prefer denormalized journey_data names; fall back to looking up the
    // applicant_name on the linked intake rows.
    const gcName = jd.gc_name || personById.get(j.gc_case_id) || null
    const ipName = jd.ip_name || personById.get(j.ip_case_id) || null
    const journeyName = gcName && ipName
      ? `${gcName} & ${ipName}`
      : (gcName || ipName || `Journey ${j.id}`)

    caseSignals.push({
      kind: 'Journey',
      id: j.id,
      name: journeyName,
      url: `/journeys/${j.id}`,
      gcName,
      ipName,
      stage: j.status || 'unknown',
      status: jd.pregnancy_status || jd.transfer_status || '',
      milestones,
      lastTouchDays: daysAgo(lastTouch),
      lastEmailDays: daysAgo(lastEmailDate),
      lastEmailSubject: emails[0]?.subject || null,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      overdueTaskTitles: overdueTasks.slice(0, 3).map(t => `${t.title} (due ${t.due_date})`),
      unpaidExpenses: unpaidExpenses.length,
      unrequestedExpenses: unrequestedExpenses.length,
      flags,
    })
  }

  // ── 3. Build prompt ──────────────────────────────────────
  const totalCases = caseSignals.length
  const stalledCases = caseSignals.filter(c => c.lastTouchDays === null || c.lastTouchDays >= 14)
  const totalOverdueTasks = caseSignals.reduce((s, c) => s + (c.overdueTasks || 0), 0)
  const totalFlagged = caseSignals.filter(c => c.flags?.length > 0).length

  const systemPrompt = `You are an experienced surrogacy case manager helping ${adminName || adminEmail} review their full workload.

You will receive structured signals (NOT raw data) for each case the admin owns. Each case includes a "name" and a "url" — ALWAYS reference cases as a markdown link in the form [Name](url) so the admin can click straight to the case page. For matched journeys, the name format is "Surrogate & IP" (e.g. "Marissa Hawkins & The Garcia Family"). NEVER use the raw numeric ID.

Format using these sections in order, each with **bold header** on its own line:

**🚨 Needs Immediate Attention**
Cases with overdue tasks, contact silence 14+ days, or stuck workflow gates. Lead with the most urgent.

**🤰 Upcoming Milestones**
Anything time-sensitive on matched journeys: babies due soon (especially within 4 weeks — call out anything inside 2 weeks as 🚨), transfers scheduled in the next 3 weeks, beta tests expected, heartbeat scan windows opening, second betas pending. Pull from each journey's "milestones" array.

**💬 Communication Gaps**
Cases that haven't been touched recently. Flag anyone past 7 days, prioritize 14+ days. Mention last email subject if it implies an open thread.

**📋 Workflow Bottlenecks**
Cases blocked at a gate the admin controls (profile awaiting approval, application not released yet, intake review not logged, checklist steps marked needed/pending).

**💰 Expense / Escrow Items**
Journeys with expenses not yet submitted to escrow, or unreconciled balances. Skip if none.

**✅ Healthy Cases**
ONE LINE summarizing how many cases are humming along normally. Don't list each one; just a count + a confidence note.

Rules:
- ALWAYS link case references: [Name](url). The admin should be able to one-click to any case from this summary.
- Never invent details. Only surface what's in the signals provided.
- Bullet points (- prefix), 1-2 sentences each. Each bullet leads with the case link.
- If a section has no items, write a single short line like "Nothing flagged right now." — don't pad.
- Total length ≤ ~700 words.`

  const userPrompt = `Workload signals for ${adminName || adminEmail} (${totalCases} active case${totalCases === 1 ? '' : 's'} — ${stalledCases.length} stalled, ${totalOverdueTasks} overdue tasks, ${totalFlagged} with workflow flags):

${JSON.stringify(caseSignals, null, 2)}`

  // ── 4. Call Claude ───────────────────────────────────────
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: aiData.error?.message || 'Claude API error' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const summary = aiData.content?.[0]?.text || 'No summary generated.'
    const generatedAt = new Date().toISOString()

    // ── 5. Cache in app_config ─────────────────────────────
    try {
      await fetch(`${env.SUPABASE_URL || env.VITE_SUPABASE_URL}/rest/v1/app_config`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          config_key: `admin_summary_${adminEmail.toLowerCase()}`,
          config_value: { summary, generatedAt, caseCount: totalCases, caseSignals },
        }),
      })
    } catch (err) {
      console.error('Failed to cache admin summary:', err)
      // non-fatal — summary is still returned to the client
    }

    return new Response(JSON.stringify({
      success: true,
      summary,
      generatedAt,
      caseCount: totalCases,
      stats: {
        stalled: stalledCases.length,
        overdueTasks: totalOverdueTasks,
        flagged: totalFlagged,
      },
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to call AI' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
