// ── SRFax Helper ────────────────────────────────────────
// Frontend helpers for the /api/fax/ Cloudflare Pages Functions

/** Send a fax */
export async function sendFax({ to, fileName, fileContent, coverPage, coverSubject, coverMessage }) {
  const res = await fetch('/api/fax/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, fileName, fileContent, coverPage, coverSubject, coverMessage }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to send fax')
  return data
}

/** Check fax status */
export async function getFaxStatus(faxId) {
  const res = await fetch('/api/fax/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faxId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to get fax status')
  return data
}

/** List faxes (inbox or outbox) */
export async function listFaxes(direction = 'OUT', period = 'ALL') {
  const params = new URLSearchParams({ direction, period })
  const res = await fetch(`/api/fax/list?${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to list faxes')
  return data
}

/** Retrieve fax document (returns base64 PDF) */
export async function retrieveFax(fileName, direction = 'OUT') {
  const res = await fetch('/api/fax/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, direction }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to retrieve fax')
  return data
}

/** Convert a File object to base64 string */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
