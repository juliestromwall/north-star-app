// Cloudflare Pages Function — GET /api/team-chats/list
// Returns all team chat groups with their latest message

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    // Fetch all groups
    const groupsRes = await fetch(
      `${supabaseUrl}/rest/v1/team_chat_groups?select=*&order=created_at.desc`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    )
    const groups = await groupsRes.json()

    if (!groupsRes.ok) {
      return new Response(JSON.stringify({ error: groups.message || 'Failed to fetch groups' }), {
        status: groupsRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // For each group, fetch latest message
    const groupsWithMessages = await Promise.all(
      (groups || []).map(async (group) => {
        try {
          const msgRes = await fetch(
            `${supabaseUrl}/rest/v1/team_chat_messages?group_id=eq.${group.id}&order=sent_at.desc&limit=1`,
            {
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
              },
            }
          )
          const msgs = await msgRes.json()
          const lastMsg = msgs?.[0] || null

          return {
            ...group,
            lastMessage: lastMsg ? {
              body: lastMsg.body,
              sender_name: lastMsg.sender_name,
              sent_at: lastMsg.sent_at,
            } : null,
          }
        } catch {
          return { ...group, lastMessage: null }
        }
      })
    )

    // Sort by last activity (most recent message or created_at)
    groupsWithMessages.sort((a, b) => {
      const aTime = a.lastMessage?.sent_at || a.created_at
      const bTime = b.lastMessage?.sent_at || b.created_at
      return new Date(bTime) - new Date(aTime)
    })

    return new Response(JSON.stringify({ groups: groupsWithMessages }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
