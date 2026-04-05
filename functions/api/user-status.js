// Cloudflare Pages Function — POST /api/user-status
// Checks if a Supabase auth user exists and returns their last sign-in

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
    return new Response(JSON.stringify({ exists: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { email } = await context.request.json()
  if (!email) {
    return new Response(JSON.stringify({ exists: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    const data = await res.json()
    const user = (data.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      return new Response(JSON.stringify({ exists: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({
      exists: true,
      lastSignIn: user.last_sign_in_at || null,
      createdAt: user.created_at,
      confirmed: !!user.email_confirmed_at,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch {
    return new Response(JSON.stringify({ exists: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
