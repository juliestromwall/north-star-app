// Cloudflare Pages Function — POST /api/ai/extract
// Uses Claude API to extract structured data from email content

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

  const { type, subject, from, snippet, body, caseName } = await context.request.json()

  if (!type || !subject) {
    return new Response(JSON.stringify({ error: 'Missing type or subject' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const emailContent = [
    `Subject: ${subject}`,
    `From: ${from || 'Unknown'}`,
    snippet ? `Preview: ${snippet}` : '',
    body ? `Full email body:\n${body.slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n')

  let systemPrompt, userPrompt

  if (type === 'expense') {
    systemPrompt = `You are an AI assistant for a surrogacy agency. Extract expense information from emails. Look carefully for dollar amounts (e.g. $415.90, $1,200.00) anywhere in the email — they may appear in the body, not just the subject. Return ONLY valid JSON with these fields:
- description: string (what the expense is for)
- amount: number or null (the dollar amount as a number, e.g. 415.90 — MUST be a number, not a string)
- paid_to: string or null (who was paid / vendor name)
- expense_date: string or null (date in YYYY-MM-DD format — look for due dates, billing dates, invoice dates)
- category: string (one of: medical, legal, escrow, insurance, travel, compensation, misc)
- notes: string (any additional relevant details like invoice numbers, billing periods)

IMPORTANT: Search the ENTIRE email body for dollar amounts. Look for patterns like "Amount: $X", "Total: $X", "Payment of $X", "$X.XX" etc. If a field cannot be determined, use null.`

    userPrompt = `Extract expense details from this email for case "${caseName || 'Unknown'}":\n\n${emailContent}`
  } else if (type === 'task') {
    systemPrompt = `You are an AI assistant for a surrogacy agency. Extract a task/action item from emails. Return ONLY valid JSON with these fields:
- title: string (concise task title, max 80 chars)
- description: string or null (task details/context)
- priority: string (one of: low, normal, high, urgent)
- due_date: string or null (date in YYYY-MM-DD format if a deadline is mentioned)

Be concise and action-oriented for the title.`

    userPrompt = `Extract a task/action item from this email for case "${caseName || 'Unknown'}":\n\n${emailContent}`
  } else {
    return new Response(JSON.stringify({ error: 'Invalid type. Use "expense" or "task".' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

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
        max_tokens: 500,
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

    // Extract JSON from response
    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not parse AI response', raw: text }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const extracted = JSON.parse(jsonMatch[0])

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to call AI' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
