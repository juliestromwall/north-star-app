import { getAuthHeaders } from './authHeaders'

// ── SMS Helper ──────────────────────────────────────────
// Frontend helpers for the /api/sms/ Cloudflare Pages Functions

export async function sendSMS(to, message, from = null) {
  const body = { to, message }
  if (from) body.from = from
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to send SMS')
    err.detail = data
    throw err
  }
  return data
}

/** Fetch all messages. Optionally filter by a contact phone number.
 *  Pass `numbers` array of E.164 admin phone numbers to query multiple lines. */
export async function fetchSMSMessages(contactNumber, numbers = []) {
  const params = new URLSearchParams()
  if (contactNumber) params.set('contact', contactNumber)
  if (numbers.length > 0) params.set('numbers', numbers.join(','))
  const res = await fetch(`/api/sms/list?${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch messages')
  return data
}

/** Fetch admin phone numbers from the admin-phones API. */
export async function fetchAdminPhones() {
  const res = await fetch('/api/admin-phones')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch admin phones')
  return data
}
