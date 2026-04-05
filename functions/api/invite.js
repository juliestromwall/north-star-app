// Cloudflare Pages Function — POST /api/invite
// Creates a Supabase auth user and returns a password reset link for invite emails

import { createClient } from '@supabase/supabase-js'

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
    return new Response(JSON.stringify({ error: 'Server not configured for invites' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const { email, name, role } = await context.request.json()

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers()
    const alreadyExists = existing?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (alreadyExists) {
      return new Response(JSON.stringify({ error: 'User already has an account' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Generate a secure temporary password (user will reset it)
    const tempPassword = crypto.randomUUID().slice(0, 16) + '!A1'

    // Create user with metadata
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name || '',
        role: role || 'surrogate',
      },
    })

    if (createError) throw createError

    // Generate password reset link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://app.abcsurrogacy.com/reset-password',
      },
    })

    if (linkError) throw linkError

    const resetLink = linkData?.properties?.action_link || null

    return new Response(JSON.stringify({
      success: true,
      userId: user?.user?.id,
      resetLink,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to create invite' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}
