import { useState, useEffect, useRef } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import { getAppConfig, setAppConfig } from '@/lib/db'

export default function QuickNote({ caseId, caseType = 'gc' }) {
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef(null)
  const configKey = `quick_note_${caseType}_${caseId}`

  // Load from Supabase app_config
  useEffect(() => {
    if (!caseId) return
    getAppConfig(configKey).then(saved => {
      if (saved) {
        setNote(saved)
        setOpen(true)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [configKey])

  // Auto-save (debounced)
  function handleChange(val) {
    setNote(val)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setAppConfig(configKey, val || '').catch(() => {})
    }, 1000)
  }

  if (!loaded) return null

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${note ? 'text-[#1A3638]' : 'text-stone-400 hover:text-stone-600'}`}
      >
        <FileText className="size-3.5" />
        Quick Note
        {note && !open && <span className="text-[10px] text-stone-300 ml-1 max-w-[200px] truncate">— {note}</span>}
        <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <textarea
          value={note}
          onChange={e => handleChange(e.target.value)}
          placeholder="Type a quick note for this case..."
          className="mt-1.5 w-full rounded-lg border border-stone-200 bg-yellow-50/50 px-3 py-2 text-sm text-stone-700 resize-none outline-none focus:border-[#1A3638]/40 focus:ring-1 focus:ring-[#1A3638]/20 placeholder:text-stone-300"
          rows={2}
        />
      )}
    </div>
  )
}
