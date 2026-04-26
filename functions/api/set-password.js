// Cloudflare Pages Function — POST /api/set-password
// Deprecated. Password setup must go through a real Supabase recovery/invite link.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  void context
  return new Response(JSON.stringify({
    error: 'This endpoint is disabled. Use the secure password reset/setup link from email.',
  }), {
    status: 410,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
