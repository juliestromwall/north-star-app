// ── SMS Helper ──────────────────────────────────────────
// Frontend helpers for the /api/sms/ Cloudflare Pages Functions

export async function sendSMS(to, message) {
  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to send SMS')
    err.detail = data
    throw err
  }
  return data
}

/** Fetch all messages. Optionally filter by a contact phone number. */
export async function fetchSMSMessages(contactNumber) {
  const params = new URLSearchParams()
  if (contactNumber) params.set('contact', contactNumber)
  const res = await fetch(`/api/sms/list?${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch messages')
  return data
}
