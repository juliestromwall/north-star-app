import { supabase } from './supabase'

export async function getAuthHeaders(extra = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const token = data?.session?.access_token
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
