import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// Diagnostic: print the Supabase URL on app load so we can confirm staging vs prod.
// Remove after the staging env is confirmed working.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[ABC] Supabase URL in use:', supabaseUrl)
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
