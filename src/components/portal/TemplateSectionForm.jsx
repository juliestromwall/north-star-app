// Renders one section of a form template (src/data/formTemplates/*.js) using
// the portal's own field styling, so template-driven sections sit alongside
// the hand-built ones (Clinic & Hospital, References, …) without looking
// different to the applicant.
//
// Field schema is documented at the top of applicationGc.js. Supported here:
//   type      text | textarea | number | date | email | tel | select | yesno
//   required  enforced only while the field is visible
//   showWhen  { field, equals } | { field, notEquals }
//   group     visual subsection heading within the section
//   span      'full' to take the whole grid row
//   rows      textarea height
//   options   [{ value, label }] for select
//
// `prefillFrom` is resolved by the caller (it needs profile + intake data) and
// handed in as a flat { key: value } map.

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, CheckCircle2, Circle, Loader2, Save, Sparkles } from 'lucide-react'

const isYes = v => v === 'yes' || v === true
const isAnswered = v => v === 'yes' || v === 'no' || v === true || v === false

/** showWhen predicate. A field with no condition is always visible. */
export function isFieldVisible(field, form) {
  const w = field.showWhen
  if (!w?.field) return true
  const observed = form?.[w.field]
  if ('notEquals' in w) return observed !== w.notEquals
  if ('equals' in w) return observed === w.equals
  return true
}

function isFieldFilled(field, value) {
  if (field.type === 'yesno') return isAnswered(value)
  return value !== undefined && value !== null && value.toString().trim() !== ''
}

/** Flat list of a section's fields (the template nests ynDetail pairs). */
export function sectionFields(section) {
  return (section.fields || []).flat().filter(Boolean)
}

/** True when every currently-visible required field has an answer. */
export function isTemplateSectionComplete(section, data) {
  if (!data) return false
  return sectionFields(section)
    .filter(f => f.required && isFieldVisible(f, data))
    .every(f => isFieldFilled(f, data[f.key]))
}

function YesNo({ value, onChange, disabled }) {
  return (
    <div className="flex gap-2">
      <button type="button" disabled={disabled} onClick={() => onChange('yes')}
        className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${isYes(value) ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
        Yes
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange('no')}
        className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${value === 'no' || value === false ? 'bg-red-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
        No
      </button>
    </div>
  )
}

function Field({ field, value, onChange, prefilled, readOnly }) {
  const common = {
    id: field.key,
    value: value ?? '',
    disabled: readOnly,
    placeholder: field.placeholder,
    onChange: e => onChange(field.key, e.target.value),
  }
  return (
    <div className={`space-y-1 ${field.span === 'full' || field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={field.key} className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
        {field.label}
        {field.required && <span className="text-red-400">*</span>}
        {prefilled && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#5A9EA2]" title="Filled in from your profile — edit if anything has changed">
            <Sparkles className="size-3" /> from your profile
          </span>
        )}
      </label>

      {field.type === 'yesno' ? (
        <YesNo value={value} disabled={readOnly} onChange={v => onChange(field.key, v)} />
      ) : field.type === 'textarea' ? (
        <Textarea {...common} rows={field.rows || 3} />
      ) : field.type === 'select' ? (
        <Select value={value || ''} onValueChange={v => onChange(field.key, v)} disabled={readOnly}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map(o => (
              <SelectItem key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          {...common}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
        />
      )}

      {field.help && <p className="text-[11px] text-stone-400">{field.help}</p>}
    </div>
  )
}

export default function TemplateSectionForm({
  section, data, onSave, saving, readOnly, isOpen, onToggle, prefills = {},
}) {
  const fields = useMemo(() => sectionFields(section), [section])

  // Prefills only seed blank fields — a saved answer always wins, so an
  // applicant's edit is never overwritten by their profile on reload.
  const [form, setForm] = useState({})
  const [prefilledKeys, setPrefilledKeys] = useState(() => new Set())
  // Read through a ref: prefills is derived data and gets a fresh object
  // identity on every parent render, so depending on it here would reset the
  // form (and wipe in-progress typing) on each keystroke elsewhere.
  const prefillsRef = useRef(prefills)
  prefillsRef.current = prefills
  useEffect(() => {
    const next = {}
    const seeded = new Set()
    for (const f of fields) {
      const saved = data?.[f.key]
      if (saved !== undefined && saved !== null && saved !== '') { next[f.key] = saved; continue }
      const pre = prefillsRef.current[f.key]
      if (pre !== undefined && pre !== null && pre !== '') { next[f.key] = pre; seeded.add(f.key) }
      else next[f.key] = ''
    }
    setForm(next)
    setPrefilledKeys(seeded)
  }, [data, section, fields])

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // Once touched it's the applicant's own answer, not a profile echo.
    setPrefilledKeys(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev); next.delete(key); return next
    })
  }

  const visible = fields.filter(f => isFieldVisible(f, form))
  const allFilled = visible.filter(f => f.required).every(f => isFieldFilled(f, form[f.key]))
  const complete = isTemplateSectionComplete(section, data)

  // Group consecutive fields under their `group` heading, preserving order.
  const groups = []
  for (const f of visible) {
    const name = f.group || ''
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.fields.push(f)
    else groups.push({ name, fields: [f] })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {complete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>

      {isOpen && (
        <CardContent className={`space-y-5 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          {groups.map((g, i) => (
            <div key={`${g.name}-${i}`} className="space-y-3">
              {g.name && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#1A3638]/60 border-b border-stone-100 pb-1">
                  {g.name}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {g.fields.map(f => (
                  <Field
                    key={f.key}
                    field={f}
                    value={form[f.key]}
                    onChange={set}
                    prefilled={prefilledKeys.has(f.key)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          ))}

          {!readOnly && (
            <Button
              size="sm" className="gap-1.5" style={{ backgroundColor: '#1A3638' }}
              onClick={() => onSave(section.key, form)} disabled={saving || !allFilled}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
