// Cloudflare Pages Function — POST /api/ai/compose
// Uses Claude to draft or refine email body text for the "Help me write"
// feature in the compose window.

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
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { prompt, recipient, subject, currentBody, mode = 'draft', senderName } = await context.request.json()

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const systemPrompt = `You are an email writing assistant for ABC Surrogacy, a surrogacy agency. You help admins draft warm, professional, clear email replies to intended parents, surrogates, clinics, attorneys, and internal staff.

OUTPUT RULES:
- Return ONLY the email body — no subject line, no "Here is a draft:" preamble, no explanations.
- Write in plain prose paragraphs separated by blank lines. Do NOT use markdown, asterisks, bullets, or headers unless the user explicitly asks for a list.
- Keep the tone warm but professional. This is a sensitive industry — surrogacy touches fertility, loss, finances, and legal questions. Avoid flippancy.
- Default to concise. 2–4 short paragraphs unless the user asks for more.
- Do NOT include a signature (e.g. "Best, Julie") — the sender's email template already adds one.
- Do NOT include "Dear X" unless the user asked for a formal letter; a simple "Hi [name]," is better.
- If the recipient name is known, use it naturally; if not, omit the greeting entirely and let the admin add it.`

  const contextLines = []
  if (recipient) contextLines.push(`Recipient: ${recipient}`)
  if (subject) contextLines.push(`Subject: ${subject}`)
  if (senderName) contextLines.push(`Sender (you): ${senderName}`)

  let userPrompt
  if (mode === 'refine' && currentBody) {
    userPrompt = `${contextLines.length ? contextLines.join('\n') + '\n\n' : ''}Here is the current draft:\n\n"""\n${currentBody.slice(0, 8000)}\n"""\n\nRefine it based on this instruction: ${prompt.trim()}\n\nReturn the revised email body only.`
  } else {
    const hasBody = currentBody && currentBody.trim()
    userPrompt = `${contextLines.length ? contextLines.join('\n') + '\n\n' : ''}${hasBody ? `Existing draft so far:\n\n"""\n${currentBody.slice(0, 8000)}\n"""\n\n` : ''}Write a new email body with this instruction: ${prompt.trim()}\n\nReturn only the email body text.`
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
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Claude API error' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const text = (data.content?.[0]?.text || '').trim()
    return new Response(JSON.stringify({ success: true, draft: text }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to call AI' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
