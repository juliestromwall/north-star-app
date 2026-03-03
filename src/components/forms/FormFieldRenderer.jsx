import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'

export default function FormFieldRenderer({ field, value, onChange, disabled = false }) {
  const handleChange = (val) => {
    if (onChange) onChange(field.id, val)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {field.type === 'text' && (
        <Input
          id={field.id}
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {field.type === 'number' && (
        <Input
          id={field.id}
          type="number"
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {field.type === 'date' && (
        <Input
          id={field.id}
          type="date"
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          id={field.id}
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          rows={4}
        />
      )}

      {field.type === 'select' && (
        <Select value={value || ''} onValueChange={handleChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'radio' && (
        <RadioGroup value={value || ''} onValueChange={handleChange} disabled={disabled}>
          <div className="space-y-2">
            {field.options?.map(opt => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                <Label htmlFor={`${field.id}-${opt}`} className="text-sm font-normal">{opt}</Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      )}

      {field.type === 'multi-select' && (
        <div className="space-y-2">
          {field.options?.map(opt => {
            const selected = Array.isArray(value) ? value : []
            const checked = selected.includes(opt)
            return (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-${opt}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    const updated = c
                      ? [...selected, opt]
                      : selected.filter(v => v !== opt)
                    handleChange(updated)
                  }}
                  disabled={disabled}
                />
                <Label htmlFor={`${field.id}-${opt}`} className="text-sm font-normal">{opt}</Label>
              </div>
            )
          })}
        </div>
      )}

      {field.type === 'checkbox' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={!!value}
            onCheckedChange={handleChange}
            disabled={disabled}
          />
          <Label htmlFor={field.id} className="text-sm font-normal">{field.placeholder || 'Yes'}</Label>
        </div>
      )}

      {field.type === 'file' && (
        <Input
          id={field.id}
          type="file"
          disabled={disabled}
          onChange={(e) => handleChange(e.target.files?.[0]?.name || '')}
        />
      )}

      {field.type === 'section-header' && (
        <div className="pt-4 pb-2 border-b">
          <h3 className="font-heading font-semibold text-lg">{field.label}</h3>
          {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
        </div>
      )}

      {field.helpText && field.type !== 'section-header' && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  )
}
