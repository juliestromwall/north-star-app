// Admin-side view of one template-driven application section.
//
// The surrogate fills these in via TemplateSectionForm in the portal; this
// renders the same fields read-only for staff, with an Edit mode that writes
// back to answers[section.key]. Field definitions come from the template, so
// the two sides can never drift apart.

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Save, Loader2, ChevronDown } from 'lucide-react'
import { updateIntakeSubmission } from '@/lib/db'
import { sectionFields, isFieldVisible } from '@/components/portal/TemplateSectionForm'

function display(field, value) {
  if (value === undefined || value === null || value === '') return null
  if (field.type === 'yesno') return value === 'yes' || value === true ? 'Yes' : 'No'
  return String(value)
}

export default function TemplateAnswersSection({ surrogate, section, answers, onSaved, search }) {
  const stored = answers?.[section.key] || {}
  const fields = sectionFields(section)

  const [open, setOpen] = useState(false)
  const [showBlank, setShowBlank] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  // Search filters whole sections by title or any question text.
  const hasMatch = !search || section.title.toLowerCase().includes(search) ||
    fields.some(f => String(f.label || '').toLowerCase().includes(search))
  if (!hasMatch) return null

  const visible = fields.filter(f => isFieldVisible(f, editing ? form : stored))
  const answeredCount = fields.filter(f => display(f, stored[f.key]) !== null).length

  // Read-mode rows: answered first-class, blanks optional. `wide` promotes
  // free-text and anything long enough to look cramped in a third of a row.
  const answeredRows = visible
    .map(field => ({ field, value: display(field, stored[field.key]) }))
    .map(r => ({ ...r, wide: r.field.type === 'textarea' || (r.value?.length ?? 0) > 60 }))
  const readRows = showBlank ? answeredRows : answeredRows.filter(r => r.value !== null)
  const blankCount = answeredRows.length - answeredRows.filter(r => r.value !== null).length

  function startEdit() {
    setForm({ ...stored })
    setEditing(true)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = { ...answers, [section.key]: form }
      await updateIntakeSubmission(surrogate.id, { answers: updated })
      if (onSaved) onSaved(updated)
      setEditing(false)
    } catch { /* surfaced by the caller's own error handling */ }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader
        className={editing ? 'flex flex-row items-center justify-between' : 'cursor-pointer select-none'}
        onClick={editing ? undefined : () => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {!editing && <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />}
          <div>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {answeredCount} of {fields.length} answered
            </p>
          </div>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
          </div>
        ) : (
          <CardAction>
            <Button variant="ghost" size="sm" className="gap-1" onClick={e => { e.stopPropagation(); startEdit() }}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>

      {(open || editing) && (
        <CardContent className="space-y-3">
          {/* Edit mode uses the same two-up grid so it doesn't balloon either. */}
          {editing && <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {visible.map(f => {
            if (editing) {
              return (
                <div key={f.key} className={`space-y-1 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                  <p className="text-[11px] font-medium text-muted-foreground">{f.label}</p>
                  {f.type === 'yesno' ? (
                    <div className="flex gap-2">
                      {['yes', 'no'].map(v => (
                        <button key={v} type="button"
                          onClick={() => setForm(p => ({ ...p, [f.key]: v }))}
                          className={`px-3 py-1 text-xs rounded-full font-medium capitalize ${
                            (form[f.key] === v || form[f.key] === (v === 'yes'))
                              ? (v === 'yes' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')
                              : 'bg-stone-100 text-stone-500'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : f.type === 'textarea' ? (
                    <Textarea rows={f.rows || 3} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  ) : f.type === 'select' ? (
                    <Select value={form[f.key] || ''} onValueChange={v => setForm(p => ({ ...p, [f.key]: v }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {(f.options || []).map(o => <SelectItem key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </div>
              )
            }
            return null
          })}
          </div>}

          {/* Read mode is a dense grid: short answers sit two or three to a
              row, long ones take the full width, and unanswered questions are
              folded away behind a counter so a mostly-empty section stays a
              few lines instead of a full screen. */}
          {!editing && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
                {readRows.map(({ field, value, wide }) => (
                  <div key={field.key} className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
                    <p className="text-[10px] font-medium text-muted-foreground leading-tight">{field.label}</p>
                    <p className="text-[13px] text-stone-700 whitespace-pre-wrap leading-snug">
                      {value ?? <span className="text-stone-300">—</span>}
                    </p>
                  </div>
                ))}
              </div>
              {blankCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBlank(v => !v)}
                  className="text-[11px] font-medium text-[#1A3638]/70 hover:text-[#1A3638] hover:underline"
                >
                  {showBlank ? 'Hide' : 'Show'} {blankCount} unanswered
                </button>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
