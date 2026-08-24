// Reset script — clears all user data, keeps app_config (checklists/statuses)
// Run: node scripts/reset-data.js
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
// (or pass them inline: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-data.js)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Usage: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/reset-data.js')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

const KEEP_EMAIL = 'juliestromwall@gmail.com'

async function query(method, table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`
  const res = await fetch(url, { method, headers })
  if (!res.ok) {
    const text = await res.text()
    console.error(`  ✗ ${method} ${table}: ${res.status} ${text}`)
    return false
  }
  console.log(`  ✓ ${table}`)
  return true
}

async function clearStorage(bucket) {
  try {
    // List all files
    const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix: '', limit: 10000 }),
    })
    const files = await listRes.json()
    if (!Array.isArray(files) || files.length === 0) {
      console.log(`  ✓ ${bucket} (empty)`)
      return
    }
    // Files might be in subdirectories, need to list recursively
    const paths = []
    for (const f of files) {
      if (f.id) {
        paths.push(f.name)
      } else if (f.name) {
        // It's a folder, list its contents
        const subRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prefix: f.name, limit: 10000 }),
        })
        const subFiles = await subRes.json()
        if (Array.isArray(subFiles)) {
          for (const sf of subFiles) {
            if (sf.id) paths.push(`${f.name}/${sf.name}`)
            else if (sf.name) {
              // Go one more level deep
              const subSubRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prefix: `${f.name}/${sf.name}`, limit: 10000 }),
              })
              const subSubFiles = await subSubRes.json()
              if (Array.isArray(subSubFiles)) {
                for (const ssf of subSubFiles) {
                  if (ssf.id) paths.push(`${f.name}/${sf.name}/${ssf.name}`)
                }
              }
            }
          }
        }
      }
    }
    if (paths.length === 0) {
      console.log(`  ✓ ${bucket} (no files)`)
      return
    }
    // Delete in batches
    const batchSize = 100
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize)
      await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ prefixes: batch }),
      })
    }
    console.log(`  ✓ ${bucket} (${paths.length} files deleted)`)
  } catch (err) {
    console.error(`  ✗ ${bucket}: ${err.message}`)
  }
}

async function deleteAuthUsers() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    })
    const data = await res.json()
    const users = data.users || []
    let deleted = 0
    for (const user of users) {
      if (user.email?.toLowerCase() === KEEP_EMAIL.toLowerCase()) {
        console.log(`  ⏭ Keeping ${user.email}`)
        continue
      }
      const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      })
      if (delRes.ok) deleted++
      else console.error(`  ✗ Failed to delete ${user.email}`)
    }
    console.log(`  ✓ Deleted ${deleted} auth users (kept ${KEEP_EMAIL})`)
  } catch (err) {
    console.error(`  ✗ Auth users: ${err.message}`)
  }
}

async function resetSequence() {
  // Reset intake_submissions ID sequence to 1
  const sql = `ALTER SEQUENCE intake_submissions_id_seq RESTART WITH 1;`
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: sql }),
    })
    if (res.ok) {
      console.log('  ✓ Reset intake_submissions ID sequence to 1')
    } else {
      // Try via pg_catalog approach
      console.log('  ⚠ Could not reset sequence via RPC — you may need to run this in the Supabase SQL editor:')
      console.log(`    ALTER SEQUENCE intake_submissions_id_seq RESTART WITH 1;`)
    }
  } catch {
    console.log('  ⚠ Reset sequence manually in Supabase SQL editor:')
    console.log(`    ALTER SEQUENCE intake_submissions_id_seq RESTART WITH 1;`)
  }
}

async function main() {
  console.log('\n🗑  Resetting First Star Surrogacy data...\n')
  console.log(`Keeping: ${KEEP_EMAIL}`)
  console.log(`Keeping: app_config table (checklists, statuses, settings)\n`)

  // 1. Delete data tables (order matters for foreign keys)
  console.log('Clearing tables...')
  // Children first
  await query('DELETE', 'admin_note_dismissals', '?id=gt.0')
  await query('DELETE', 'admin_notes', '?id=gt.0')
  await query('DELETE', 'match_questions', '?id=gt.0')
  await query('DELETE', 'profile_shares', '?id=gt.0')
  await query('DELETE', 'journey_expenses', '?id=gt.0')
  await query('DELETE', 'journey_notes', '?id=gt.0')
  await query('DELETE', 'matched_journeys', '?id=gt.0')
  await query('DELETE', 'insurance_payments', '?id=gt.0')
  await query('DELETE', 'surrogate_insurance', '?id=gt.0')
  await query('DELETE', 'case_tasks', '?id=gt.0')
  await query('DELETE', 'case_emails', '?id=gt.0')
  await query('DELETE', 'case_notes', '?id=gt.0')
  await query('DELETE', 'case_documents', '?id=gt.0')
  await query('DELETE', 'esign_audit_log', '?id=gt.0')
  await query('DELETE', 'esign_documents', '?id=gt.0')
  await query('DELETE', 'esign_templates', '?id=gt.0')
  await query('DELETE', 'surrogate_profiles', '?id=gt.0')
  // Parent last
  await query('DELETE', 'intake_submissions', '?id=gt.0')

  // 2. Clear storage buckets
  console.log('\nClearing storage...')
  await clearStorage('profile-photos')
  await clearStorage('esign-documents')
  await clearStorage('case-documents')

  // 3. Delete auth users (except you)
  console.log('\nDeleting auth users...')
  await deleteAuthUsers()

  // 4. Reset ID sequence
  console.log('\nResetting ID sequence...')
  await resetSequence()

  console.log('\n✅ Done! The system is fresh.\n')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
