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

/** List events for a specific case/journey */
export async function listCaseEvents(userId, caseId, caseType, { calendarId = 'primary', timeMin, timeMax, maxResults = 50 } = {}) {
  const token = await getAccessToken(userId)
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
    privateExtendedProperty: `caseId=${caseType}_${caseId}`,
  })
  if (timeMin) params.set('timeMin', timeMin)
  if (timeMax) params.set('timeMax', timeMax)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!res.ok) return { items: [] }
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

/** Find or create the "ABC Drafts" folder in Drive (for temporary editing copies) */
export async function getOrCreateDraftsFolder(userId) {
  const token = await getAccessToken(userId)
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='ABC Drafts' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()
  if (searchData.files?.length > 0) return searchData.files[0].id
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ABC Drafts', mimeType: 'application/vnd.google-apps.folder' }),
  })
  const folder = await createRes.json()
  if (!createRes.ok) throw new Error(folder.error?.message || 'Failed to create drafts folder')
  return folder.id
}

/** Delete a Google Drive file */
export async function deleteGoogleDriveFile(userId, fileId) {
  const token = await getAccessToken(userId)
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
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

/** Replace text placeholders in a Google Doc via Docs API */
export async function replaceTextInDoc(userId, docId, replacements) {
  const token = await getAccessToken(userId)
  const requests = Object.entries(replacements).map(([find, replace]) => ({
    replaceAllText: {
      containsText: { text: find, matchCase: true },
      replaceText: replace || '',
    },
  }))
  if (requests.length === 0) return
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to update document')
  }
}

/** Find text position within a Google Doc body */
function findTextInDoc(doc, searchText) {
  function searchElements(elements) {
    for (const el of elements || []) {
      if (el.paragraph) {
        for (const pe of el.paragraph.elements || []) {
          const text = pe.textRun?.content || ''
          const idx = text.indexOf(searchText)
          if (idx !== -1) return { startIndex: pe.startIndex + idx, endIndex: pe.startIndex + idx + searchText.length }
        }
      }
      if (el.table) {
        for (const row of el.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            const found = searchElements(cell.content)
            if (found) return found
          }
        }
      }
    }
    return null
  }
  return searchElements(doc.body?.content)
}

/** Get the role code for a signer */
function getSignerRoleCode(role) {
  const r = role?.toLowerCase() || ''
  if (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2'))) return 'IP1'
  if (r.includes('intended parent 2') || r.includes('ip2')) return 'IP2'
  if (r.includes('admin') || r.includes('agency')) return 'Admin'
  if (r.includes('partner')) return 'Partner'
  return 'GC'
}

/** Copy a Google Doc, fill in fields, export as PDF, delete the copy */
export async function generateSignedPdf(userId, templateDocId, fieldValues, signers) {
  const token = await getAccessToken(userId)

  // 1. Copy the template
  const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${templateDocId}/copy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '[Temp Signed Copy]' }),
  })
  const copy = await copyRes.json()
  if (!copyRes.ok) throw new Error(copy.error?.message || 'Failed to copy document')
  const copyId = copy.id

  try {
    // 2. Build replacement map — keep signatures separate for special handling
    const nonSigReplacements = {}
    const signatureInfo = [] // { placeholders, signer }

    // Build a lookup of field values by placeholder
    const fieldValuesByPlaceholder = {}
    if (fieldValues) {
      for (const [key, val] of Object.entries(fieldValues)) {
        if (val !== undefined && val !== null) fieldValuesByPlaceholder[key] = val
      }
    }

    let fieldIdx = 0
    for (const signer of signers) {
      const roleCode = getSignerRoleCode(signer.role)
      const signDate = signer.signedAt
        ? new Date(signer.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const computedInitials = signer.name ? signer.name.split(' ').map(w => w[0]).join('').toUpperCase() : ''

      // Role code variants including common typos
      const variants = [roleCode, roleCode.toLowerCase()]
      if (roleCode === 'Partner') variants.push('Parnter', 'parnter')

      // Get typed field values from the signer (stored during signing)
      const signerFields = signer.fieldValues || {}
      // Find initials value from field values (look for any field that has short text like initials)
      let typedInitials = computedInitials
      for (const [key, val] of Object.entries(signerFields)) {
        if (typeof val === 'string' && val.length >= 1 && val.length <= 5 && val !== signer.name && val !== signer.email) {
          typedInitials = val // Use the first short non-name, non-email value as initials
          break
        }
      }

      const sigPlaceholders = []
      for (const rv of variants) {
        nonSigReplacements[`{{Name:${rv}}}`] = signer.signatureName || signer.name || ''
        nonSigReplacements[`{{Email:${rv}}}`] = signer.email || ''
        nonSigReplacements[`{{Date:${rv}}}`] = signDate
        nonSigReplacements[`{{Initials:${rv}}}`] = typedInitials
        nonSigReplacements[`{{OptionalInitials:${rv}}}`] = typedInitials
        nonSigReplacements[`{{Text:${rv}}}`] = signer.signatureName || signer.name || ''
        nonSigReplacements[`{{OptionalText:${rv}}}`] = ''
        nonSigReplacements[`{{Checkbox:${rv}}}`] = '☑'
        sigPlaceholders.push(`{{Signature:${rv}}}`)
      }
      signatureInfo.push({ placeholders: sigPlaceholders, signer })
    }

    // 3. Replace non-signature fields first
    await replaceTextInDoc(userId, copyId, nonSigReplacements)

    // 4. Handle signature fields — drawn images or styled handwriting text
    try {
      // Upload drawn signature images to Supabase for public URLs
      const { supabase: sb } = await import('./supabase')
      const sigImageUrls = {}
      for (const { signer } of signatureInfo) {
        if (signer.signatureType === 'drawn' && signer.signatureImage && sb) {
          try {
            const base64 = signer.signatureImage.split(',')[1]
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const blob = new Blob([bytes], { type: 'image/png' })
            const path = `signatures/sig_${Date.now()}_${(signer.name || '').replace(/[^a-zA-Z0-9]/g, '_')}.png`
            await sb.storage.from('esign-documents').upload(path, blob, { contentType: 'image/png' })
            const { data } = sb.storage.from('esign-documents').getPublicUrl(path)
            sigImageUrls[signer.email] = data.publicUrl
          } catch (e) { console.error('Signature image upload failed:', e) }
        }
      }

      // Read the document to find signature placeholder positions
      const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${copyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const docData = await docRes.json()

      // Find positions of each signature placeholder
      const sigPositions = []
      for (const { placeholders, signer } of signatureInfo) {
        for (const placeholder of placeholders) {
          const pos = findTextInDoc(docData, placeholder)
          if (pos) { sigPositions.push({ ...pos, signer, placeholder }); break }
        }
      }

      // Process from end to start so index shifts don't affect earlier positions
      sigPositions.sort((a, b) => b.startIndex - a.startIndex)

      const requests = []
      for (const pos of sigPositions) {
        const { signer, startIndex, endIndex } = pos
        const isDrawn = signer.signatureType === 'drawn' && sigImageUrls[signer.email]
        const name = signer.signatureName || signer.name || ''

        // Delete the placeholder text
        requests.push({ deleteContentRange: { range: { startIndex, endIndex } } })

        if (isDrawn) {
          // Insert the hand-drawn signature image
          requests.push({
            insertInlineImage: {
              location: { index: startIndex },
              uri: sigImageUrls[signer.email],
              objectSize: {
                height: { magnitude: 30, unit: 'PT' },
                width: { magnitude: 110, unit: 'PT' },
              },
            },
          })
        } else {
          // Insert typed name with a handwriting-style font
          requests.push({ insertText: { location: { index: startIndex }, text: name } })
          if (name.length > 0) {
            requests.push({
              updateTextStyle: {
                range: { startIndex, endIndex: startIndex + name.length },
                textStyle: {
                  weightedFontFamily: { fontFamily: 'Dancing Script' },
                  fontSize: { magnitude: 14, unit: 'PT' },
                  foregroundColor: { color: { rgbColor: { red: 0.05, green: 0.1, blue: 0.35 } } },
                },
                fields: 'weightedFontFamily,fontSize,foregroundColor',
              },
            })
          }
        }
      }

      if (requests.length > 0) {
        const styleRes = await fetch(`https://docs.googleapis.com/v1/documents/${copyId}:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        })
        if (!styleRes.ok) throw new Error('Signature styling batch failed')
      }
    } catch (sigErr) {
      console.error('Signature styling failed, using plain text fallback:', sigErr)
      const fallback = {}
      for (const { placeholders, signer } of signatureInfo) {
        const name = signer.signatureName || signer.name || ''
        for (const p of placeholders) fallback[p] = name
      }
      await replaceTextInDoc(userId, copyId, fallback)
    }

    // 5. Append compact, styled audit trail on a new page
    try {
      // Insert page break first
      const docInfo1 = await fetch(`https://docs.googleapis.com/v1/documents/${copyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      const endIdx1 = docInfo1.body?.content?.slice(-1)?.[0]?.endIndex || 1

      await fetch(`https://docs.googleapis.com/v1/documents/${copyId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ insertPageBreak: { location: { index: endIdx1 - 1 } } }],
        }),
      })

      // Read doc again for new end index
      const docInfo2 = await fetch(`https://docs.googleapis.com/v1/documents/${copyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      const endIdx2 = docInfo2.body?.content?.slice(-1)?.[0]?.endIndex || 1

      const completed = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })

      // Build compact audit trail text
      const header = 'ELECTRONIC SIGNATURE CERTIFICATE'
      const divider = '─────────────────────────────────────────────────────────────────'
      const signerLines = signers.map(s => {
        const signedAt = s.signedAt
          ? new Date(s.signedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '—'
        const type = s.signatureType === 'drawn' ? 'Hand-drawn' : 'Typed'
        return `✓  ${s.name}  ·  ${s.role}  ·  ${type}\n     ${s.email}  ·  ${signedAt}`
      })

      const auditText = [
        '\n',
        divider,
        header,
        `Completed: ${completed}`,
        divider,
        ...signerLines,
        divider,
        'Electronically signed via ABC Surrogacy (app.abcsurrogacy.com) in accordance with the ESIGN Act and UETA.',
        'A tamper-proof audit trail has been recorded for each signature event.',
      ].join('\n')

      const insertIdx = endIdx2 - 1
      const headerStart = insertIdx + auditText.indexOf(header)
      const headerEnd = headerStart + header.length

      await fetch(`https://docs.googleapis.com/v1/documents/${copyId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            // Insert the audit trail text
            { insertText: { location: { index: insertIdx }, text: auditText } },
            // Style the entire audit trail: small, gray, clean font
            {
              updateTextStyle: {
                range: { startIndex: insertIdx, endIndex: insertIdx + auditText.length },
                textStyle: {
                  fontSize: { magnitude: 8, unit: 'PT' },
                  foregroundColor: { color: { rgbColor: { red: 0.35, green: 0.35, blue: 0.35 } } },
                },
                fields: 'fontSize,foregroundColor,bold',
              },
            },
            // Style the header: slightly larger, bold, darker
            {
              updateTextStyle: {
                range: { startIndex: headerStart, endIndex: headerEnd },
                textStyle: {
                  fontSize: { magnitude: 10, unit: 'PT' },
                  bold: true,
                  foregroundColor: { color: { rgbColor: { red: 0.15, green: 0.15, blue: 0.15 } } },
                },
                fields: 'fontSize,bold,foregroundColor',
              },
            },
          ],
        }),
      })
    } catch (auditErr) {
      console.error('Audit trail append failed:', auditErr)
    }

    // 6. Export as PDF
    const pdfRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${copyId}/export?mimeType=application/pdf`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!pdfRes.ok) throw new Error('Failed to export PDF')
    const pdfBlob = await pdfRes.blob()

    // 7. Delete the temporary copy
    await fetch(`https://www.googleapis.com/drive/v3/files/${copyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})

    return pdfBlob
  } catch (err) {
    // Clean up copy on error
    await fetch(`https://www.googleapis.com/drive/v3/files/${copyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    throw err
  }
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
