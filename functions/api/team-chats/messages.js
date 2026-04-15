// Cloudflare Pages Function — GET/POST /api/team-chats/messages
// GET ?groupId=xxx: Fetch messages for a group (oldest first)
// POST: Send a message and SMS-notify other group members

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    return new Response(JSON.stringify({ error: 'Missing Supabase config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const url = new URL(context.request.url)
    const groupId = url.searchParams.get('groupId')

    if (!groupId) {
      return new Response(JSON.stringify({ error: 'Missing groupId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
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
      return new Response(JSON.stringify({ error: messages.message || 'Failed to fetch messages' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ messages: messages || [] }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
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
    const { groupId, senderId, senderName, senderPhone, body, memberPhones } = await context.request.json()

    if (!groupId || !senderId || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

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
      return new Response(JSON.stringify({ error: inserted.message || 'Failed to insert message' }), {
        status: insertRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const message = Array.isArray(inserted) ? inserted[0] : inserted

    // Fetch the group to get its name for SMS context
    let groupName = 'Team Chat'
    try {
      const groupRes = await fetch(
        `${supabaseUrl}/rest/v1/team_chat_groups?id=eq.${groupId}&select=name&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        }
      )
      const groupData = await groupRes.json()
      if (groupData?.[0]?.name) groupName = groupData[0].name
    } catch {}

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
        .filter(m => m.id !== senderId && m.phone)
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

    return new Response(JSON.stringify(message), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
