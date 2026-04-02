// ── Google OAuth Helper ─────────────────────────────────
// Frontend helpers for Google OAuth + Gmail + Calendar via Cloudflare Pages Functions

// ── OAuth Flow ──────────────────────────────────────────

/** Redirect the user to Google's OAuth consent screen */
export function connectGoogle(userId) {
  window.location.href = `/api/google/auth?user_id=${userId}`
}

/** Check if the current user has connected their Google account */
export async function getGoogleStatus(userId) {
  const res = await fetch(`/api/google/status?user_id=${userId}`)
  return res.json()
}

/** Disconnect Google account */
export async function disconnectGoogle(userId) {
  const res = await fetch('/api/google/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  return res.json()
}

/** Get a fresh access token (auto-refreshes if expired) */
export async function getAccessToken(userId) {
  const res = await fetch('/api/google/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to get access token')
  return data.access_token
}

// ── Gmail API ───────────────────────────────────────────

/** List all Gmail labels */
export async function listLabels(userId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to list labels')
  return data.labels || []
}

/** Get a single label's details (includes unread count) */
export async function getLabel(userId, labelId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(labelId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to get label')
  return data
}

/** List emails from Gmail — supports labelIds filter */
export async function listEmails(userId, { query = '', maxResults = 20, pageToken, labelIds } = {}) {
  const token = await getAccessToken(userId)
  const params = new URLSearchParams({ maxResults: String(maxResults) })
  if (query) params.set('q', query)
  if (pageToken) params.set('pageToken', pageToken)
  if (labelIds?.length) labelIds.forEach(id => params.append('labelIds', id))

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to list emails')
  return data
}

/** Get a single email by ID */
export async function getEmail(userId, messageId, format = 'full') {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to get email')
  return data
}

/** Get an email attachment */
export async function getAttachment(userId, messageId, attachmentId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to get attachment')
  return data
}

/** Fetch the user's Gmail signature (primary send-as address) */
export async function getGmailSignature(userId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) return ''
  const primary = (data.sendAs || []).find(s => s.isPrimary)
  return primary?.signature || ''
}

/** Build a base64url-encoded MIME message */
function buildMimeRaw({ to, subject, body, cc, bcc, attachments = [] }) {
  const boundary = 'abc_surrogacy_' + Date.now()
  const mimeLines = [
    `To: ${to || ''}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: ${subject || ''}`,
    'MIME-Version: 1.0',
  ].filter(Boolean)

  if (attachments.length > 0) {
    mimeLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    mimeLines.push('')
    mimeLines.push(`--${boundary}`)
    mimeLines.push('Content-Type: text/html; charset="UTF-8"')
    mimeLines.push('')
    mimeLines.push(body || '')
    for (const att of attachments) {
      mimeLines.push(`--${boundary}`)
      mimeLines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`)
      mimeLines.push('Content-Transfer-Encoding: base64')
      mimeLines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      mimeLines.push('')
      mimeLines.push(att.base64Data)
    }
    mimeLines.push(`--${boundary}--`)
  } else {
    mimeLines.push('Content-Type: text/html; charset="UTF-8"')
    mimeLines.push('')
    mimeLines.push(body || '')
  }

  return btoa(unescape(encodeURIComponent(mimeLines.join('\r\n'))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Send an email (with optional attachments) */
export async function sendEmail(userId, { to, subject, body, cc, bcc, attachments = [] }) {
  const token = await getAccessToken(userId)
  const raw = buildMimeRaw({ to, subject, body, cc, bcc, attachments })

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to send email')
  return data
}

/** Save a draft to Gmail */
export async function createGmailDraft(userId, { to, subject, body, cc, bcc, attachments = [] }) {
  const token = await getAccessToken(userId)
  const raw = buildMimeRaw({ to, subject, body, cc, bcc, attachments })

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to save draft')
  return data
}

/** Modify email labels (e.g., mark read/unread, archive) */
export async function modifyEmail(userId, messageId, { addLabels = [], removeLabels = [] }) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: addLabels,
        removeLabelIds: removeLabels,
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to modify email')
  return data
}

// ── Gmail Helpers ───────────────────────────────────────

/** Extract useful fields from a Gmail message */
export function parseEmailHeaders(message) {
  const headers = message.payload?.headers || []
  const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  return {
    id: message.id,
    threadId: message.threadId,
    from: get('From'),
    to: get('To'),
    cc: get('Cc'),
    bcc: get('Bcc'),
    subject: get('Subject'),
    date: get('Date'),
    snippet: message.snippet,
    labelIds: message.labelIds || [],
    isUnread: (message.labelIds || []).includes('UNREAD'),
  }
}

/** Extract the HTML or plain text body from a Gmail message */
export function parseEmailBody(message) {
  const payload = message.payload
  if (!payload) return ''

  // Simple message
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart — find text/html or text/plain
  const parts = payload.parts || []
  const htmlPart = findPart(parts, 'text/html')
  if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)

  const textPart = findPart(parts, 'text/plain')
  if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)

  return ''
}

/** Extract attachments info from a Gmail message */
export function parseEmailAttachments(message) {
  const parts = message.payload?.parts || []
  return parts
    .filter(p => p.filename && p.body?.attachmentId)
    .map(p => ({
      filename: p.filename,
      mimeType: p.mimeType,
      size: p.body.size,
      attachmentId: p.body.attachmentId,
    }))
}

function findPart(parts, mimeType) {
  for (const part of parts) {
    if (part.mimeType === mimeType) return part
    if (part.parts) {
      const found = findPart(part.parts, mimeType)
      if (found) return found
    }
  }
  return null
}

function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(base64)))
}

// ── Google Calendar API ─────────────────────────────────

/** List user's calendars */
export async function listCalendars(userId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to list calendars')
  return data.items || []
}

/** List events from a calendar */
export async function listEvents(userId, {
  calendarId = 'primary',
  timeMin,
  timeMax,
  maxResults = 50,
  singleEvents = true,
  orderBy = 'startTime',
  pageToken,
} = {}) {
  const token = await getAccessToken(userId)
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: String(singleEvents),
    orderBy,
  })
  if (timeMin) params.set('timeMin', timeMin)
  if (timeMax) params.set('timeMax', timeMax)
  if (pageToken) params.set('pageToken', pageToken)

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to list events')
  return data
}

/** Create a calendar event */
export async function createEvent(userId, calendarId = 'primary', event) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to create event')
  return data
}

/** Update a calendar event */
export async function updateEvent(userId, calendarId = 'primary', eventId, event) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to update event')
  return data
}

/** Delete a calendar event */
export async function deleteEvent(userId, calendarId = 'primary', eventId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok && res.status !== 204) {
    const data = await res.json()
    throw new Error(data.error?.message || 'Failed to delete event')
  }
}

// ── Google Drive API ────────────────────────────────────

/** Find or create the "ABC Templates" folder in Drive */
export async function getOrCreateTemplatesFolder(userId) {
  const token = await getAccessToken(userId)

  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='ABC Templates' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()
  if (searchData.files?.length > 0) return searchData.files[0].id

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'ABC Templates',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const folder = await createRes.json()
  if (!createRes.ok) throw new Error(folder.error?.message || 'Failed to create folder')
  return folder.id
}

/** Create a new Google Doc in the templates folder */
export async function createGoogleDoc(userId, title, folderId) {
  const token = await getAccessToken(userId)
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: folderId ? [folderId] : [],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to create Google Doc')
  return data
}

/** Copy an existing Google Doc (for creating a send copy) */
export async function copyGoogleDoc(userId, fileId, newTitle, folderId) {
  const token = await getAccessToken(userId)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: newTitle,
      parents: folderId ? [folderId] : [],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to copy document')
  return data
}

/** Export a Google Doc as PDF (returns Blob) */
export async function exportDocAsPdf(userId, fileId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to export as PDF')
  }
  return await res.blob()
}

/** Get the plain text content of a Google Doc (for parsing field placeholders) */
export async function getDocPlainText(userId, fileId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error('Failed to get document text')
  return await res.text()
}

/** Parse {{Field:Role}} placeholders from text */
export function parseFieldPlaceholders(text) {
  const regex = /\{\{(\w+):(\w+)\}\}/g
  const fields = []
  let match
  while ((match = regex.exec(text)) !== null) {
    fields.push({
      fieldType: match[1].toLowerCase(),
      role: match[2].toLowerCase(),
      placeholder: match[0],
      index: fields.length,
      fieldId: `field_${fields.length}`,
    })
  }
  return fields
}

/** List all Google Docs in the ABC Templates folder */
export async function listTemplateDocs(userId) {
  const token = await getAccessToken(userId)
  const folderId = await getOrCreateTemplatesFolder(userId)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`)}&fields=files(id,name,modifiedTime,createdTime)&orderBy=modifiedTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Failed to list templates')
  return data.files || []
}

/** Get a Google Doc's thumbnail/preview as HTML */
export async function getDocAsHtml(userId, fileId) {
  const token = await getAccessToken(userId)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error('Failed to export as HTML')
  return await res.text()
}

/** Make a Google Doc publicly viewable (for embedding) */
export async function shareDocPublicly(userId, fileId) {
  const token = await getAccessToken(userId)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'writer',
      type: 'anyone',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Failed to share doc:', err)
    throw new Error(err.error?.message || 'Failed to share document')
  }
  return true
}
