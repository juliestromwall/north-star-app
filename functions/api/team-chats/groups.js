// Cloudflare Pages Function — POST /api/team-chats/groups
// Creates a new team chat group

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
    return new Response(JSON.stringify({ error: 'Missing Supabase config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const { name, memberIds, createdBy } = await context.request.json()

    if (!name || !memberIds || memberIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing name or memberIds' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (memberIds.length > 10) {
      return new Response(JSON.stringify({ error: 'Maximum 10 members per group' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/team_chat_groups`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name,
          member_ids: memberIds,
          created_by: createdBy || null,
        }),
      }
    )
    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Failed to create group' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const group = Array.isArray(data) ? data[0] : data

    return new Response(JSON.stringify(group), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
