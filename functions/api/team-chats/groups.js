// Cloudflare Pages Function — POST /api/team-chats/groups
// Creates a new team chat group

import { getAuthorizedUser, isStaffRole, json } from '../_auth'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  const { env } = context
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing Supabase config' }, 500, corsHeaders)
  }

  const requester = await getAuthorizedUser(context.request, supabaseUrl, serviceKey)
  if (!requester || !isStaffRole(requester.role)) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  try {
    const { name, memberIds } = await context.request.json()

    if (!name || !memberIds || memberIds.length === 0) {
      return json({ error: 'Missing name or memberIds' }, 400, corsHeaders)
    }

    const normalizedMemberIds = Array.from(new Set([...memberIds, requester.id].filter(Boolean)))
    if (normalizedMemberIds.length > 10) {
      return json({ error: 'Maximum 10 members per group' }, 400, corsHeaders)
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
          member_ids: normalizedMemberIds,
          created_by: requester.id,
        }),
      }
    )
    const data = await res.json()

    if (!res.ok) {
      return json({ error: data.message || 'Failed to create group' }, res.status, corsHeaders)
    }

    const group = Array.isArray(data) ? data[0] : data

    return json(group, 200, corsHeaders)
  } catch (err) {
    return json({ error: err.message }, 500, corsHeaders)
  }
}
