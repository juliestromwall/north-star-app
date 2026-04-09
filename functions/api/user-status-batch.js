// Cloudflare Pages Function — POST /api/user-status-batch
// Returns last sign-in for multiple emails at once

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
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { emails } = await context.request.json()
  if (!emails || !emails.length) {
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const data = await res.json()
    const users = data.users || []

    const emailSet = new Set(emails.map(e => e.toLowerCase()))
    const result = {}
    for (const user of users) {
      const email = user.email?.toLowerCase()
      if (email && emailSet.has(email)) {
        result[email] = {
          lastSignIn: user.last_sign_in_at || null,
          createdAt: user.created_at,
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch {
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
