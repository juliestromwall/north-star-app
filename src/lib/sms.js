// ── SMS Helper ──────────────────────────────────────────
// Sends SMS via the /api/sms/send Cloudflare Pages Function

export async function sendSMS(to, message) {
  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send SMS')
  return data
}
