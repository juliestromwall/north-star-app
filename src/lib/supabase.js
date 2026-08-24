import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Localhost-vs-prod safety guard ──────────────────────────
// Local dev pointed at production once already wiped admin-customized
// app_config rows because background loaders silently auto-save to
// whichever Supabase the browser is talking to. This block detects the
// dangerous combination — running on localhost while pointed at a known
// prod Supabase host — and refuses to start. The escape hatch is an
// explicit env var so debugging-against-prod is still possible if
// someone really needs it.
//
// IMPORTANT: add First Star's prod project ref / hostname to the list
// below once known (e.g. /<your-prod-project-ref>\.supabase\.co/i).
const PROD_HOST_PATTERNS = []
function looksLikeProd(url) {
  if (!url) return false
  return PROD_HOST_PATTERNS.some(re => re.test(url))
}
function isLocalhost() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')
}
const allowProdLocally = String(import.meta.env.VITE_ALLOW_LOCALHOST_PROD || '').toLowerCase() === 'yes'
if (typeof window !== 'undefined' && isLocalhost() && looksLikeProd(supabaseUrl) && !allowProdLocally) {
  const banner = `
╔═══════════════════════════════════════════════════════════════════════╗
║  REFUSING TO CONNECT — LOCAL DEV IS POINTED AT PRODUCTION SUPABASE.   ║
║                                                                       ║
║  Add this to .env.local:                                              ║
║                                                                       ║
║    VITE_SUPABASE_URL=<your STAGING Supabase URL>                      ║
║    VITE_SUPABASE_PUBLISHABLE_KEY=<your staging publishable key>       ║
║                                                                       ║
║  Then restart \`npm run dev\`.                                          ║
║                                                                       ║
║  Need to debug against prod for some reason? Set:                     ║
║    VITE_ALLOW_LOCALHOST_PROD=yes                                      ║
║  in .env.local (NOT .env). Use sparingly.                             ║
╚═══════════════════════════════════════════════════════════════════════╝
`
  // eslint-disable-next-line no-console
  console.error(banner)
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `<pre style="font:14px/1.5 monospace;color:#7f1d1d;background:#fef2f2;padding:24px;margin:0;min-height:100vh;white-space:pre-wrap;">${banner}</pre>`
  }
  throw new Error('Local dev is pointed at production Supabase. Refusing to start.')
}

// Diagnostic: print the Supabase URL on app load so we can confirm staging vs prod.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[FirstStar] Supabase URL in use:', supabaseUrl)
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
