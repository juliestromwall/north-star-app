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
    body ? `Full email body:\n${body.slice(0, 12000)}` : '',
  ].filter(Boolean).join('\n')

  let systemPrompt, userPrompt

  if (type === 'expense') {
    systemPrompt = `You are an AI assistant for a surrogacy agency. Extract expense information from emails. Search the ENTIRE email carefully for financial details. Return ONLY valid JSON with these fields:
- description: string (what the expense is for — be specific, e.g. "Delta flight LAX to JFK for medical eval")
- amount: number or null (the TOTAL dollar amount as a number, e.g. 415.90. Look for "Total", "Amount Due", "Amount Charged", "Grand Total", "Total Charge", "Trip Total", "$X.XX" patterns. For airline emails check near the bottom for the total fare.)
- paid_to: string or null (vendor/company name — e.g. "Delta Air Lines", "United Airlines", "Hilton Hotels")
- expense_date: string or null (date in YYYY-MM-DD format — look for purchase date, booking date, transaction date, trip date)
- category: string (one of: medical, legal, escrow, insurance, travel, compensation, misc)
- cc_last4: string or null (last 4 digits of credit card used — look for patterns like "ending in 1234", "****1234", "Card ending 1234", "xxxx1234", "Visa ...1234")
- notes: string (any additional relevant details like confirmation number, flight number, invoice number, booking reference)

IMPORTANT TIPS:
- For airline emails: the total is often near the bottom, look for "Total", "Trip Total", "Amount Charged"
- For hotel emails: look for "Total Stay Cost", "Amount", "Total Charges"
- Credit card last 4 digits often appear as "ending in XXXX" or "****XXXX" or "Card ...XXXX"
- If you find multiple dollar amounts, use the TOTAL (largest amount that represents the full charge)
- If a field cannot be determined, use null.`

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
