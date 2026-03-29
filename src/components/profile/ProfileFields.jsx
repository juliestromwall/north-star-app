import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

// ─────────────────────────────────────────────────────────
// Field helper components (extracted from SurrogateProfilePage)
// ─────────────────────────────────────────────────────────
// Each field component accepts an optional `wrapper` prop:
//   wrapper: ({ fieldPath, children }) => ReactNode
// When provided, the wrapper wraps the field's content.
// When not provided, children render directly.
// This supports the admin toggle-off feature.

function Field({ label, children, className = '', wrapper, fieldPath }) {
  const content = (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  )
  if (wrapper && fieldPath) {
    return wrapper({ fieldPath, children: content })
  }
  return content
}

function TextField({ label, value, onChange, placeholder, type = 'text', disabled = false, className = '', wrapper, fieldPath }) {
  return (
    <Field label={label} className={className} wrapper={wrapper} fieldPath={fieldPath}>
      <Input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-white"
      />
    </Field>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3, className = '', wrapper, fieldPath }) {
  return (
    <Field label={label} className={className} wrapper={wrapper} fieldPath={fieldPath}>
      <Textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="bg-white"
      />
    </Field>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...', className = '', wrapper, fieldPath }) {
  return (
    <Field label={label} className={className} wrapper={wrapper} fieldPath={fieldPath}>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value
            const lbl = typeof opt === 'string' ? opt : opt.label
            return <SelectItem key={val} value={val}>{lbl}</SelectItem>
          })}
        </SelectContent>
      </Select>
    </Field>
  )
}

function YesNoField({ label, value, onChange, className = '', wrapper, fieldPath }) {
  return (
    <Field label={label} className={className} wrapper={wrapper} fieldPath={fieldPath}>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange('yes')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            value === 'yes'
              ? 'bg-[#283693] text-white shadow-md'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange('no')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            value === 'no'
              ? 'bg-[#283693] text-white shadow-md'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    </Field>
  )
}

function CheckboxGroupField({ label, options, value = [], onChange, className = '', wrapper, fieldPath }) {
  const toggle = (opt) => {
    const set = new Set(value)
    if (set.has(opt)) set.delete(opt)
    else set.add(opt)
    onChange([...set])
  }
  return (
    <Field label={label} className={className} wrapper={wrapper} fieldPath={fieldPath}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={value.includes(opt)}
              onCheckedChange={() => toggle(opt)}
            />
            <span className="text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </Field>
  )
}

function CurrencyField({ label, value, onChange, className = '', wrapper, fieldPath }) {
  const formatCurrency = (val) => {
    const digits = String(val).replace(/[^0-9]/g, '')
    if (!digits) return ''
    return '$' + Number(digits).toLocaleString('en-US')
  }
  const handleChange = (raw) => {
    const digits = raw.replace(/[^0-9]/g, '')
    onChange(digits ? '$' + Number(digits).toLocaleString('en-US') : '')
  }
  return (
    <Field label={label} className={className} wrapper={wrapper} fieldPath={fieldPath}>
      <Input
        value={formatCurrency(value)}
        onChange={e => handleChange(e.target.value)}
        placeholder="$0"
        className="bg-white"
      />
    </Field>
  )
}

const HOUSEHOLD_RELATIONSHIPS = [
  'Spouse', 'Partner', 'Son', 'Daughter', 'Stepson', 'Stepdaughter',
  'Mother', 'Father', 'Sibling', 'Cousin', 'Aunt', 'Uncle',
  'Grandparent', 'Grandchild', 'Roommate', 'Friend', 'Other'
]

function HouseholdMembers({ value = [], onChange, partnerName, maritalStatus }) {
  const [count, setCount] = useState(value.length || 0)
  const hasPartner = ['Married', 'Domestic Partnership', 'In a Relationship'].includes(maritalStatus)
  const autoRelationship = maritalStatus === 'Married' ? 'Spouse' : 'Partner'

  useEffect(() => {
    if (value.length > 0 && count === 0) setCount(value.length)
  }, [value])

  // Auto-fill person #1 with partner info
  useEffect(() => {
    if (!hasPartner || !partnerName || value.length === 0) return
    const first = value[0]
    if (!first.name && !first.relationship) {
      const updated = [...value]
      updated[0] = { name: partnerName, relationship: autoRelationship }
      onChange(updated)
    }
  }, [hasPartner, partnerName, value.length])

  const handleCountChange = (newCount) => {
    const n = Math.max(0, Math.min(20, parseInt(newCount) || 0))
    setCount(n)
    const current = [...value]
    if (n > current.length) {
      for (let i = current.length; i < n; i++) {
        // Auto-fill first slot with partner if applicable
        if (i === 0 && hasPartner && partnerName) {
          current.push({ name: partnerName, relationship: autoRelationship })
        } else {
          current.push({ name: '', relationship: '' })
        }
      }
    }
    onChange(current.slice(0, n))
  }

  const updateMember = (idx, field, val) => {
    const updated = [...value]
    updated[idx] = { ...updated[idx], [field]: val }
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <Field label="How many other people live in your household?">
          <Input
            type="number" min="0" max="20"
            value={count || ''}
            onChange={e => handleCountChange(e.target.value)}
            className="bg-white"
          />
        </Field>
      </div>
      {count > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr] bg-gray-50 border-b border-gray-200">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">First Name</div>
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Relationship</div>
          </div>
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className={`grid grid-cols-[1fr_1fr] ${idx < count - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="px-3 py-2">
                <Input
                  value={value[idx]?.name || ''}
                  onChange={e => updateMember(idx, 'name', e.target.value)}
                  placeholder={`Person ${idx + 1}`}
                  className="bg-white h-9"
                />
              </div>
              <div className="px-3 py-2">
                <Select value={value[idx]?.relationship || ''} onValueChange={val => updateMember(idx, 'relationship', val)}>
                  <SelectTrigger className="bg-white h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSEHOLD_RELATIONSHIPS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export {
  Field,
  TextField,
  TextAreaField,
  SelectField,
  YesNoField,
  CheckboxGroupField,
  CurrencyField,
  HouseholdMembers,
  HOUSEHOLD_RELATIONSHIPS,
}
