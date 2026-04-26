// Cloudflare Pages Function — GET/POST /api/team-chats/messages
// GET ?groupId=xxx: Fetch messages for a group (oldest first)
// POST: Send a message and SMS-notify other group members

import { getAuthorizedUser, isStaffRole, json } from '../_auth'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function fetchGroupForMember(supabaseUrl, serviceKey, groupId, memberId) {
  const groupRes = await fetch(
    `${supabaseUrl}/rest/v1/team_chat_groups?id=eq.${groupId}&select=id,name,member_ids&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    }
  )
  const groupData = await groupRes.json().catch(() => [])
  const group = Array.isArray(groupData) ? groupData[0] : null
  if (!groupRes.ok) {
    return { error: groupData?.message || 'Failed to fetch group', status: groupRes.status, group: null }
  }
  if (!group || !Array.isArray(group.member_ids) || !group.member_ids.includes(memberId)) {
    return { error: 'Forbidden', status: 403, group: null }
  }
  return { error: null, status: 200, group }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestGet(context) {
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
    const url = new URL(context.request.url)
    const groupId = url.searchParams.get('groupId')

    if (!groupId) {
      return json({ error: 'Missing groupId' }, 400, corsHeaders)
    }

    const { error: groupError, status: groupStatus } = await fetchGroupForMember(supabaseUrl, serviceKey, groupId, requester.id)
    if (groupError) {
      return json({ error: groupError }, groupStatus, corsHeaders)
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/team_chat_messages?group_id=eq.${groupId}&order=sent_at.asc`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    )
    const messages = await res.json()

    if (!res.ok) {
      return json({ error: messages.message || 'Failed to fetch messages' }, res.status, corsHeaders)
    }

    return json({ messages: messages || [] }, 200, corsHeaders)
  } catch (err) {
    return json({ error: err.message }, 500, corsHeaders)
  }
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
    const { groupId, senderPhone, body, memberPhones } = await context.request.json()

    if (!groupId || !body) {
      return json({ error: 'Missing required fields' }, 400, corsHeaders)
    }

    const { error: groupError, status: groupStatus, group } = await fetchGroupForMember(supabaseUrl, serviceKey, groupId, requester.id)
    if (groupError) {
      return json({ error: groupError }, groupStatus, corsHeaders)
    }

    const senderId = requester.id
    const senderName =
      requester.user?.user_metadata?.full_name ||
      requester.user?.user_metadata?.name ||
      requester.email?.split('@')[0] ||
      'Unknown'

    // Insert message into team_chat_messages
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/team_chat_messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          group_id: groupId,
          sender_id: senderId,
          sender_name: senderName || 'Unknown',
          body,
        }),
      }
    )
    const inserted = await insertRes.json()

    if (!insertRes.ok) {
      return json({ error: inserted.message || 'Failed to insert message' }, insertRes.status, corsHeaders)
    }

    const message = Array.isArray(inserted) ? inserted[0] : inserted

    const groupName = group?.name || 'Team Chat'

    // Send SMS to other group members
    const accountSid = env.TWILIO_ACCOUNT_SID
    const authToken = env.TWILIO_AUTH_TOKEN
    const twilioFrom = senderPhone || env.TWILIO_PHONE_NUMBER

    if (accountSid && authToken && twilioFrom && Array.isArray(memberPhones)) {
      const smsText = `[${groupName}] ${senderName}: ${body}`
      const auth = btoa(`${accountSid}:${authToken}`)
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

      // Send to each member except the sender
      const smsPromises = memberPhones
        .filter(m => group.member_ids.includes(m.id) && m.id !== senderId && m.phone)
        .map(async (member) => {
          try {
            let cleanTo = member.phone.replace(/[^\d+]/g, '')
            if (!cleanTo.startsWith('+')) cleanTo = '+1' + cleanTo.replace(/^1/, '')

            const smsBody = new URLSearchParams({
              To: cleanTo,
              From: twilioFrom,
              Body: smsText,
            })

            await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: smsBody.toString(),
            })
          } catch {
            // SMS failure shouldn't block the message
          }
        })

      await Promise.allSettled(smsPromises)
    }

    return json(message, 200, corsHeaders)
  } catch (err) {
    return json({ error: err.message }, 500, corsHeaders)
  }
}
