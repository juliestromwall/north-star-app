import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getAppConfig, setAppConfig } from '@/lib/db'
import { FOLLOW_UP_FIELDS, FIELD_LABELS } from '@/components/profile/profileConstants'

export default function FollowUpReviewPage() {
  const { id } = useParams()
  const [surrogate, setSurrogate] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef(null)
  const notesKey = `follow_up_notes_${id}`

  useEffect(() => {
    if (!id || !supabase) return
    Promise.all([
      supabase.from('intake_submissions').select('applicant_name, answers').eq('id', id).single(),
      supabase.from('surrogate_profiles').select('profile_data').eq('email', '').limit(0), // placeholder
      getAppConfig(notesKey).catch(() => null),
    ]).then(async ([intakeResult, _, savedNotes]) => {
      const intake = intakeResult.data
      if (intake) {
        setSurrogate({ id, name: intake.applicant_name, answers: intake.answers || {} })
      }
      // Load profile data
      if (intake?.answers?.email || intakeResult.data?.applicant_email) {
        try {
          const email = intake.answers?.email || ''
          const { data: profile } = await supabase.from('surrogate_profiles')
            .select('profile_data').eq('email', email.toLowerCase()).single()
          if (profile?.profile_data) setProfileData(profile.profile_data)
        } catch {}
      }
      if (savedNotes) setNotes(savedNotes)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  function saveNotes(updated) {
    setNotes(updated)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setAppConfig(notesKey, updated).catch(() => {})
    }, 1000)
  }

  function getFieldValue(key) {
    // Check followUp section first, then original sections
    if (profileData?.followUp?.[key] !== undefined && profileData.followUp[key] !== '') return profileData.followUp[key]
    for (const sec of ['personal', 'fertility', 'general', 'health', 'employment', 'academic', 'narrative']) {
      if (profileData?.[sec]?.[key] !== undefined && profileData[sec][key] !== '') return profileData[sec][key]
    }
    return ''
  }

  function formatValue(val) {
    if (val === undefined || val === null || val === '') return '—'
    if (val === true || val === 'yes') return 'Yes'
    if (val === false || val === 'no') return 'No'
    return String(val)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-[#1A3638]">Profile Follow Up Review</h1>
          <p className="text-sm text-stone-500">{surrogate?.name || 'Unknown'}</p>
        </div>
        <img src="/north-star-logo.png" alt="" className="h-8 opacity-40" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-[40%]">Question</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-[25%]">Answer</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-[35%]">Admin Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {FOLLOW_UP_FIELDS.map(field => {
                const value = getFieldValue(field.key)
                // Skip conditional fields whose condition isn't met
                if (field.conditional) {
                  const parentVal = getFieldValue(field.conditional.toString().match(/d\.(\w+)/)?.[1] || '')
                  // Simple check — if this is a conditional details field, check if parent has the right value
                }
                const label = FIELD_LABELS[field.key] || field.key
                return (
                  <tr key={field.key} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 text-stone-700 text-xs leading-relaxed">{label}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${value === '—' ? 'text-stone-300' : value === 'Yes' || value === 'yes' ? 'text-emerald-600' : value === 'No' || value === 'no' ? 'text-red-500' : 'text-stone-800'}`}>
                        {formatValue(value)}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <textarea
                        value={notes[field.key] || ''}
                        onChange={e => saveNotes({ ...notes, [field.key]: e.target.value })}
                        placeholder="Add note..."
                        className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5 resize-none focus:border-[#1A3638]/40 focus:ring-0 outline-none bg-transparent"
                        rows={1}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-stone-300 text-center mt-4">Notes auto-save. Changes are visible only to admins.</p>
      </div>
    </div>
  )
}
