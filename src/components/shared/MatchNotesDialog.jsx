import { useState, useEffect } from 'react'
import { StickyNote, Pencil, Save, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { updateIntakeSubmission } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export default function MatchNotesDialog({ open, onOpenChange, caseId, answers, onSaved, currentUser }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setNotes(answers?._matchNotes || '')
  }, [open, answers])

  async function handleSave() {
    setSaving(true)
    try {
      // Always fetch fresh answers from DB to avoid overwriting other fields
      let currentAnswers = answers || {}
      if (supabase) {
        const { data } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
        if (data?.answers) currentAnswers = data.answers
      }
      const updatedAnswers = { ...currentAnswers, _matchNotes: notes }
      await updateIntakeSubmission(caseId, { answers: updatedAnswers })
      if (onSaved) onSaved(updatedAnswers)
      onOpenChange(false)
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'))
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="size-5 text-amber-500" /> Match Notes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-stone-500">Internal notes about this case for matching purposes. These are visible to agency staff only.</p>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about this case for matching... e.g. 'Great fit for couples wanting experienced surrogate', 'Prefers local IPs', etc."
            rows={5}
            className="bg-white"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Compact inline display for cards
export function MatchNotesPreview({ notes, onClick }) {
  if (!notes) {
    return (
      <button onClick={onClick} className="w-full flex items-center gap-1.5 text-xs text-stone-400 hover:text-amber-600 transition-colors py-1">
        <StickyNote className="size-3" />
        <span>Add match notes...</span>
      </button>
    )
  }
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg bg-amber-50/50 border border-amber-100 p-2 hover:border-amber-200 transition-colors group">
      <div className="flex items-center gap-1.5 mb-0.5">
        <StickyNote className="size-3 text-amber-500" />
        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Match Notes</span>
        <Pencil className="size-2.5 text-stone-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-xs text-stone-600 line-clamp-2 whitespace-pre-line">{notes}</p>
    </button>
  )
}
