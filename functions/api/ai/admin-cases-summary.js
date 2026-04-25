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

  const body = await context.request.json()
  const { adminEmail, adminName } = body
  // Three modes:
  //   journeyManager: all matched_journeys where journey_data.journeyManager
  //                   ilike's the given name. Skips standalone intakes
  //                   (they're not journeys). Output grouped by assigned admin.
  //   team:           teamEmails array → multi-admin assignment-based view.
  //   single:         adminEmail only.
  const journeyManagerName = (body.journeyManager || '').toLowerCase().trim()
  const isJourneyManagerMode = !!journeyManagerName
  const teamEmails = Array.isArray(body.teamEmails) && body.teamEmails.length > 0
    ? Array.from(new Set([...body.teamEmails, adminEmail].filter(Boolean).map(e => e.toLowerCase())))
    : null
  if (!adminEmail && !teamEmails && !isJourneyManagerMode) {
    return new Response(JSON.stringify({ error: 'Missing adminEmail (or teamEmails / journeyManager)' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  // Also accept a name lookup so we can label cases with their assignee.
  // Frontend passes this; we fall back to the email local-part if missing.
  const adminNameByEmail = (body.adminNameByEmail && typeof body.adminNameByEmail === 'object')
    ? Object.fromEntries(Object.entries(body.adminNameByEmail).map(([k, v]) => [k.toLowerCase(), v]))
    : {}
  const nameFor = (email) => {
    if (!email) return 'Unassigned'
    const lower = email.toLowerCase()
    if (adminNameByEmail[lower]) return adminNameByEmail[lower]
    if (lower === adminEmail?.toLowerCase()) return adminName || lower.split('@')[0]
    return lower.split('@')[0]
  }

  // ── 1. Fetch admin's assigned cases ──────────────────────
  const inList = (arr) => `(${arr.map(e => `"${e}"`).join(',')})`

  let intakes = []
  let journeys = []

  if (isJourneyManagerMode) {
    // Journey-portfolio view: every matched journey where journey_data
    // .journeyManager ilike's the given name. Skip intakes — by design.
    const filter = `journey_data->>journeyManager.ilike.*${encodeURIComponent(journeyManagerName)}*`
    journeys = await sb(env, `matched_journeys?${filter}&select=*&order=created_at.desc`)
  } else {
    // Single-admin or team mode: fetch by assigned_to.
    const intakeFilter = teamEmails
      ? `assigned_to=in.${encodeURIComponent(inList(teamEmails))}`
      : `assigned_to=eq.${encodeURIComponent(adminEmail)}`
    const journeyFilter = teamEmails
      ? `assigned_to=in.${encodeURIComponent(inList(teamEmails))}`
      : `assigned_to=eq.${encodeURIComponent(adminEmail)}`

    const [intakeRows, assignedJourneys] = await Promise.all([
      sb(env, `intake_submissions?${intakeFilter}&select=id,intake_type,applicant_name,applicant_email,status,submitted_at,assigned_to,answers&order=submitted_at.desc`),
      sb(env, `matched_journeys?${journeyFilter}&select=*&order=created_at.desc`),
    ])
    intakes = intakeRows

    // For single-admin mode, also pull matched_journeys where this admin is
    // the journey_manager (separate concept from assigned_to — Julie/Nicole
    // oversee active matches even when day-to-day work belongs to others).
    const firstNamesToMatch = teamEmails
      ? []
      : (adminName ? [adminName.split(' ')[0].toLowerCase()] : [])
    let managerJourneys = []
    if (firstNamesToMatch.length > 0) {
      const orParts = firstNamesToMatch.map(n => `journey_data->>journeyManager.ilike.*${n}*`).join(',')
      managerJourneys = await sb(env, `matched_journeys?or=(${encodeURIComponent(orParts)})&select=*&order=created_at.desc`)
    }
    const journeyMap = new Map()
    for (const j of [...assignedJourneys, ...managerJourneys]) journeyMap.set(j.id, j)
    journeys = Array.from(journeyMap.values())
  }

  // Stage statuses live in app_config under config_key='surrogate_stages'
  const stageCfg = await sb(env, `app_config?config_key=eq.surrogate_stages&select=config_value`)
  const stageStatusMap = stageCfg?.[0]?.config_value || {}

  if (intakes.length === 0 && journeys.length === 0) {
    const who = isJourneyManagerMode
      ? `${managerDisplay}'s journey portfolio`
      : teamEmails
        ? `the team (${teamEmails.length} admins)`
        : (adminName || adminEmail)
    return new Response(JSON.stringify({
      success: true,
      summary: `**No matched journeys**\n\nNothing's currently in ${who}. Click "Regenerate" to refresh.`,
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
      assignedAdmin: nameFor(intake.assigned_to),
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
      // Show whoever is doing the day-to-day work as the case admin; surface
      // the journey manager separately so master/super admins recognize their
      // own oversight cases.
      assignedAdmin: nameFor(j.assigned_to),
      journeyManager: jd.journeyManager || null,
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

  // "Team mode" here just means we render the structured JSON dashboard
  // layout (urgent panel + per-admin cards). True for both teamEmails and
  // journeyManager modes.
  const isTeamMode = !!teamEmails || isJourneyManagerMode
  const managerDisplay = isJourneyManagerMode
    ? journeyManagerName.replace(/^./, c => c.toUpperCase())
    : null
  const audience = isJourneyManagerMode
    ? `${managerDisplay} reviewing journeys she manages, grouped by case admin`
    : teamEmails
      ? `${adminName || adminEmail} reviewing the team workload (${teamEmails.length} admins)`
      : (adminName || adminEmail)

  // In team mode we output a STRUCTURED JSON dashboard (urgent panel + per-
  // admin breakouts). In single-admin mode we output the existing markdown
  // sections. The frontend detects which by checking response shape.
  const systemPrompt = isTeamMode ? `You are an experienced surrogacy case manager helping ${audience}.

You will receive structured signals for each case. Each case includes "name", "url", and "assignedAdmin" (the staff member doing the day-to-day work).

Output a single JSON object — NO prose before or after, NO markdown code fence — matching this schema EXACTLY:

{
  "urgent": [
    { "name": "Marissa Hawkins & The Smith Family", "url": "/journeys/45", "owner": "Stacie Adler", "reason": "Past due by 12 days; delivery not logged" }
  ],
  "byAdmin": [
    {
      "adminName": "Desiree Melchiori",
      "totals": { "cases": 8, "stalled": 2, "overdueTasks": 1, "healthy": 5 },
      "milestones": [{ "name": "...", "url": "...", "note": "Heartbeat scan window — beta was 21 days ago" }],
      "communication": [{ "name": "...", "url": "...", "note": "No contact in 18 days — last email \\"Re: clinic question\\"" }],
      "workflow": [{ "name": "...", "url": "...", "note": "Profile submitted, awaiting admin approval" }],
      "expenses": [{ "name": "...", "url": "...", "note": "3 expenses not yet submitted to escrow" }]
    }
  ]
}

Rules:
- "urgent" is the top-of-dashboard cross-team alert panel. Only include the MOST critical items: birth imminent (≤14 days), overdue tasks, contact silence ≥21 days, hard workflow blocks. Cap at 8 entries. Each "owner" is the assignedAdmin name. Sort by severity (births/overdue first).
- "byAdmin" — one entry per distinct assignedAdmin in the signals. SORT alphabetically by adminName. Use the FULL display name from assignedAdmin. Each admin's category arrays should hold 1-3 sentences per case, NOT a bullet list — just objects with name/url/note.
- Names: use the case's "name" field verbatim (already formatted like "Marissa Hawkins & The Smith Family" for journeys). NEVER use the numeric id.
- URLs: use the case's "url" field verbatim.
- "note" should be ONE concise sentence with the action signal — what's wrong / what's coming up. Don't pad.
- Empty categories: omit the key entirely OR set to []. The renderer hides empty sections.
- "totals.healthy" is per-admin count of their cases not appearing in any of their categories.
- Output ONLY the JSON. Nothing else.` : `You are an experienced surrogacy case manager helping ${audience}.

You will receive structured signals (NOT raw data) for each case. Each case includes a "name", a "url", and an "assignedAdmin". For journeys, "journeyManager" may also be set. ALWAYS reference cases as a markdown link [Name](url). NEVER use the raw numeric ID.

Each bullet should subtly note the assignee at the end like "(Stacie)" if the case isn't owned by the requesting admin. Skip the parenthetical otherwise.

Format using these sections in order, each with **bold header** on its own line:

**🚨 Needs Immediate Attention**
Cases with overdue tasks, contact silence 14+ days, or stuck workflow gates.

**🤰 Upcoming Milestones**
Time-sensitive items on matched journeys: due soon (call <14 days as 🚨), transfers scheduled, betas expected, heartbeat scan windows. Pull from each journey's "milestones" array.

**💬 Communication Gaps**
Cases not touched recently. Flag past 7 days, prioritize 14+ days.

**📋 Workflow Bottlenecks**
Cases blocked at a gate (profile awaiting approval, application not released, intake review not logged, checklist gaps).

**💰 Expense / Escrow Items**
Journeys with expenses not yet submitted to escrow. Skip if none.

**✅ Healthy Cases**
ONE LINE summarizing how many cases are humming along normally.

Rules:
- ALWAYS link case references: [Name](url).
- Never invent details.
- Bullet points (- prefix), 1-2 sentences each.
- Empty section: single short line like "Nothing flagged right now."
- Total length ≤ ~700 words.`

  const userPrompt = `Workload signals for ${audience} (${totalCases} active case${totalCases === 1 ? '' : 's'} — ${stalledCases.length} stalled, ${totalOverdueTasks} overdue tasks, ${totalFlagged} with workflow flags):

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

    const rawText = aiData.content?.[0]?.text || ''
    const generatedAt = new Date().toISOString()

    // In team mode the model is asked for JSON. Parse it so the client can
    // render a dashboard layout. If parsing fails, fall back to returning
    // the raw text as a `summary` field — the page will render whatever
    // shape it gets.
    let dashboard = null
    let summary = null
    if (isTeamMode) {
      try {
        // Strip code fences if Claude wrapped the JSON despite instructions.
        const cleaned = rawText
          .replace(/^\s*```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/i, '')
          .trim()
        dashboard = JSON.parse(cleaned)
      } catch (err) {
        console.error('Failed to parse team-mode JSON, falling back to text:', err)
        summary = rawText
      }
    } else {
      summary = rawText
    }

    const cacheValue = { generatedAt, caseCount: totalCases, caseSignals }
    if (dashboard) cacheValue.dashboard = dashboard
    if (summary) cacheValue.summary = summary

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
          config_key: isJourneyManagerMode
            ? `admin_summary_journeys_${journeyManagerName}`
            : teamEmails
              ? `admin_summary_team_${(adminEmail || teamEmails[0]).toLowerCase()}`
              : `admin_summary_${adminEmail.toLowerCase()}`,
          config_value: cacheValue,
        }),
      })
    } catch (err) {
      console.error('Failed to cache admin summary:', err)
    }

    return new Response(JSON.stringify({
      success: true,
      summary,
      dashboard,
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
