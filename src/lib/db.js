import { supabase } from './supabase'

// Wrap a Supabase call with timeout. Returns null if Supabase is not configured.
async function withTimeout(buildQuery, ms = 12000) {
  if (!supabase) return null
  try {
    return await Promise.race([
      buildQuery(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ])
  } catch {
    return null
  }
}

// ── Admin Notes ──────────────────────────────────────────

export async function fetchActiveAdminNotes() {
  const result = await withTimeout(
    () => supabase.from('admin_notes').select('*, admin_note_dismissals(*)').eq('is_active', true).order('created_at', { ascending: false })
  )
  if (!result) return []
  if (result.error) throw result.error
  return result.data
}

export async function fetchAllAdminNotes() {
  const result = await withTimeout(
    () => supabase.from('admin_notes').select('*, admin_note_dismissals(*)').order('created_at', { ascending: false })
  )
  if (!result) return []
  if (result.error) throw result.error
  return result.data
}

export async function insertAdminNote(note) {
  const result = await withTimeout(
    () => supabase.from('admin_notes').insert(note).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function updateAdminNote(id, updates) {
  const result = await withTimeout(
    () => supabase.from('admin_notes').update(updates).eq('id', id).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function deleteAdminNote(id) {
  const result = await withTimeout(
    () => supabase.from('admin_notes').delete().eq('id', id)
  )
  if (!result) return
  if (result.error) throw result.error
}

export async function dismissAdminNote(noteId) {
  const result = await withTimeout(
    () => supabase.from('admin_note_dismissals').insert({ note_id: noteId }).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}
