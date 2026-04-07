import { supabase } from './supabase'

const BUCKET = 'esign-documents'

function generateSigningToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

// ── Templates ─────────────────────────────────────────────

export async function uploadTemplate(file, metadata) {
  if (!supabase) return null
  const ext = file.name.split('.').pop()
  const path = `templates/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('esign_templates')
    .insert({
      name: metadata.name || file.name,
      category: metadata.category || 'General',
      description: metadata.description || '',
      file_path: uploadData.path,
      file_name: file.name,
      file_size: file.size,
      created_by: metadata.createdBy || '',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Create a blank template (no file upload) */
export async function createBlankTemplate(metadata) {
  if (!supabase) return null
  // Create a blank HTML file
  const blankHtml = '<p></p>'
  const blob = new Blob([blankHtml], { type: 'text/html' })
  const path = `templates/${Date.now()}_blank.html`
  await supabase.storage.from(BUCKET).upload(path, blob, { cacheControl: '3600', upsert: false })

  const { data, error } = await supabase
    .from('esign_templates')
    .insert({
      name: metadata.name || 'Untitled Template',
      category: metadata.category || 'General',
      description: metadata.description || '',
      file_path: path,
      file_name: `${Date.now()}_blank.html`,
      file_size: blob.size,
      created_by: metadata.createdBy || '',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Upload a letterhead image (header or footer) and store URL in app_config */
export async function uploadLetterhead(file, type = 'header') {
  if (!supabase) return null
  const path = `letterhead/${type}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true })
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // Merge into existing config
  const { getAppConfig, setAppConfig } = await import('./db')
  const existing = (await getAppConfig('esign_letterhead')) || {}
  await setAppConfig('esign_letterhead', { ...existing, [type]: urlData.publicUrl })
  return urlData.publicUrl
}

/** Get letterhead config from app_config — returns { header, footer } */
export async function getLetterhead() {
  const { getAppConfig } = await import('./db')
  const config = await getAppConfig('esign_letterhead')
  return config || {}
}

export async function fetchTemplates() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('esign_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function updateTemplate(id, updates) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('esign_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveTemplateHtml(templateId, html) {
  if (!supabase) return null
  const blob = new Blob([html], { type: 'text/html' })
  const path = `templates/${templateId}_edited.html`
  await supabase.storage.from(BUCKET).upload(path, blob, { cacheControl: '3600', upsert: true })
  // Store edited HTML path on the template
  return await updateTemplate(templateId, { file_path: path, file_name: `${templateId}_edited.html` })
}

export async function deleteTemplate(id, filePath) {
  if (!supabase) throw new Error('Database not configured')
  // Remove any documents referencing this template first (FK constraint)
  await supabase.from('esign_documents').delete().eq('template_id', id)
  // Delete the file from storage
  if (filePath) {
    try { await supabase.storage.from(BUCKET).remove([filePath]) } catch {}
  }
  // Delete the database record
  const { error } = await supabase.from('esign_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function getTemplateFileUrl(filePath) {
  if (!supabase || !filePath) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return data?.publicUrl || null
}

// ── Documents ─────────────────────────────────────────────

export async function createDocument(doc) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('esign_documents')
    .insert({
      template_id: doc.templateId,
      case_id: doc.caseId || null,
      case_type: doc.caseType || null,
      title: doc.title,
      status: 'draft',
      signers: doc.signers || [],
      file_path: doc.filePath || null,
      created_by: doc.createdBy || '',
      signing_token: generateSigningToken(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function sendDocument(docId) {
  if (!supabase) return null
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('esign_documents')
    .update({
      status: 'pending',
      sent_at: now,
      signers: undefined, // keep existing
    })
    .eq('id', docId)
    .select()
    .single()
  if (error) throw error

  // Update signers status to 'pending'
  if (data.signers?.length > 0) {
    const updatedSigners = data.signers.map(s => ({ ...s, status: s.status || 'pending' }))
    await supabase.from('esign_documents').update({ signers: updatedSigners }).eq('id', docId)
  }

  await logAuditEvent(docId, 'sent', data.created_by, null, { title: data.title })
  return data
}

export async function fetchDocuments(filters = {}) {
  if (!supabase) return []
  let query = supabase.from('esign_documents').select('*').order('created_at', { ascending: false })
  if (filters.caseId) query = query.eq('case_id', filters.caseId)
  if (filters.caseType) query = query.eq('case_type', filters.caseType)
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  if (error) return []
  return data || []
}

export async function fetchDocument(id) {
  if (!supabase) return null
  const { data, error } = await supabase.from('esign_documents').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function fetchDocumentByToken(token) {
  if (!supabase || !token) return null
  const { data, error } = await supabase.from('esign_documents').select('*').eq('signing_token', token).single()
  if (error) return null
  return data
}

export async function updateDocument(id, updates) {
  if (!supabase) return null
  const { data, error } = await supabase.from('esign_documents').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function voidDocument(id, actorName) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('esign_documents')
    .update({ status: 'voided', voided_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAuditEvent(id, 'voided', actorName, null, { title: data.title })
  return data
}

// ── Signing ───────────────────────────────────────────────

export async function signDocument(docId, signerEmail, signatureData) {
  if (!supabase) return null

  const doc = await fetchDocument(docId)
  if (!doc) throw new Error('Document not found')

  // Update the signer's status
  const signers = (doc.signers || []).map(s => {
    if (s.email.toLowerCase() === signerEmail.toLowerCase()) {
      return {
        ...s,
        status: 'signed',
        signedAt: new Date().toISOString(),
        signatureType: signatureData.type, // 'typed' or 'drawn'
        signatureName: signatureData.name || '',
        signatureImage: signatureData.type === 'drawn' ? signatureData.image : null,
        fieldValues: signatureData.fieldValues || {},
        placeholderValues: signatureData.placeholderValues || {},
      }
    }
    return s
  })

  // Check if all signers have signed
  const allSigned = signers.every(s => s.status === 'signed')
  const updates = {
    signers,
    status: allSigned ? 'completed' : 'partially_signed',
    ...(allSigned ? { completed_at: new Date().toISOString() } : {}),
  }

  const { data, error } = await supabase
    .from('esign_documents')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()
  if (error) throw error

  await logAuditEvent(docId, 'signed', signatureData.name, signerEmail, {
    signatureType: signatureData.type,
    allSigned,
  })

  return data
}

// ── Audit Log ─────────────────────────────────────────────

export async function logAuditEvent(documentId, action, actorName, actorEmail, details) {
  if (!supabase) return
  try {
    await supabase.from('esign_audit_log').insert({
      document_id: documentId,
      action,
      actor_name: actorName || '',
      actor_email: actorEmail || '',
      ip_address: '',
      user_agent: navigator?.userAgent || '',
      details: details || {},
    })
  } catch {}
}

export async function fetchAuditLog(documentId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('esign_audit_log')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data || []
}

// ── File helpers ──────────────────────────────────────────

export async function uploadDocumentFile(file, docId) {
  if (!supabase) return null
  const path = `documents/${docId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: true })
  if (error) throw error
  return data.path
}

export function getDocumentFileUrl(filePath) {
  if (!supabase || !filePath) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
  return data?.publicUrl || null
}
