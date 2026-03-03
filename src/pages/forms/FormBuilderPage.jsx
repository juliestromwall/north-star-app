import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageHeader from '@/components/shared/PageHeader'
import FormFieldRenderer from '@/components/forms/FormFieldRenderer'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { mockFormDefinitions } from '@/data/mock/forms'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, EyeOff, GripVertical,
} from 'lucide-react'

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multi-select', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'file', label: 'File Upload' },
  { value: 'section-header', label: 'Section Header' },
]

function makeId() {
  return 'f-' + Math.random().toString(36).slice(2, 9)
}

export default function FormBuilderPage() {
  const { formId } = useParams()
  const existingForm = formId ? mockFormDefinitions.find(f => f.id === formId) : null

  const [formTitle, setFormTitle] = useState(existingForm?.title || '')
  const [formDescription, setFormDescription] = useState(existingForm?.description || '')
  const [sections, setSections] = useState(
    existingForm?.sections || [
      { id: makeId(), title: 'Section 1', fields: [] },
    ]
  )
  const [preview, setPreview] = useState(false)
  const [saved, setSaved] = useState(false)

  const addSection = () => {
    setSections(prev => [...prev, {
      id: makeId(),
      title: `Section ${prev.length + 1}`,
      fields: [],
    }])
  }

  const removeSection = (sIdx) => {
    setSections(prev => prev.filter((_, i) => i !== sIdx))
  }

  const updateSectionTitle = (sIdx, title) => {
    setSections(prev => prev.map((s, i) => i === sIdx ? { ...s, title } : s))
  }

  const addField = (sIdx) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s
      return {
        ...s,
        fields: [...s.fields, {
          id: makeId(),
          type: 'text',
          label: 'New Field',
          required: false,
          placeholder: '',
          helpText: '',
          options: [],
        }],
      }
    }))
  }

  const removeField = (sIdx, fIdx) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s
      return { ...s, fields: s.fields.filter((_, j) => j !== fIdx) }
    }))
  }

  const updateField = (sIdx, fIdx, updates) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s
      return {
        ...s,
        fields: s.fields.map((f, j) => j === fIdx ? { ...f, ...updates } : f),
      }
    }))
  }

  const moveField = (sIdx, fIdx, direction) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s
      const fields = [...s.fields]
      const newIdx = fIdx + direction
      if (newIdx < 0 || newIdx >= fields.length) return s
      ;[fields[fIdx], fields[newIdx]] = [fields[newIdx], fields[fIdx]]
      return { ...s, fields }
    }))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const needsOptions = (type) => ['select', 'multi-select', 'radio'].includes(type)

  if (preview) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={formTitle || 'Untitled Form'}
          subtitle={formDescription || 'Form preview'}
          actions={
            <Button variant="outline" onClick={() => setPreview(false)}>
              <EyeOff className="size-4" /> Exit Preview
            </Button>
          }
        />
        {sections.map(section => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.fields.map(field => (
                  <FormFieldRenderer key={field.id} field={field} disabled />
                ))}
                {section.fields.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No fields in this section</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={formId ? 'Edit Form' : 'New Form'}
        subtitle="Build your form by adding sections and fields"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/forms"><ArrowLeft className="size-4" /> Back</Link>
            </Button>
            <Button variant="outline" onClick={() => setPreview(true)}>
              <Eye className="size-4" /> Preview
            </Button>
            <Button onClick={handleSave}>
              <Save className="size-4" /> {saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        }
      />

      {/* Form Meta */}
      <Card>
        <CardHeader>
          <CardTitle>Form Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Form Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Enter form title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this form"
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {sections.map((section, sIdx) => (
        <Card key={section.id}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Input
                value={section.title}
                onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                className="font-heading font-semibold text-base"
              />
              {sections.length > 1 && (
                <Button variant="ghost" size="icon-sm" onClick={() => removeSection(sIdx)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {section.fields.map((field, fIdx) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Field {fIdx + 1}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon-xs"
                        onClick={() => moveField(sIdx, fIdx, -1)}
                        disabled={fIdx === 0}
                      >
                        <ChevronUp className="size-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon-xs"
                        onClick={() => moveField(sIdx, fIdx, 1)}
                        disabled={fIdx === section.fields.length - 1}
                      >
                        <ChevronDown className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => removeField(sIdx, fIdx)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(sIdx, fIdx, { label: e.target.value })}
                        placeholder="Field label"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(val) => updateField(sIdx, fIdx, { type: val, options: needsOptions(val) ? (field.options?.length ? field.options : ['Option 1', 'Option 2']) : field.options })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(sIdx, fIdx, { placeholder: e.target.value })}
                        placeholder="Placeholder text"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Help Text</Label>
                      <Input
                        value={field.helpText || ''}
                        onChange={(e) => updateField(sIdx, fIdx, { helpText: e.target.value })}
                        placeholder="Help text"
                      />
                    </div>
                  </div>

                  {needsOptions(field.type) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Options (comma-separated)</Label>
                      <Input
                        value={(field.options || []).join(', ')}
                        onChange={(e) => updateField(sIdx, fIdx, {
                          options: e.target.value.split(',').map(o => o.trim()).filter(Boolean),
                        })}
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(val) => updateField(sIdx, fIdx, { required: val })}
                    />
                    <Label className="text-xs">Required</Label>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={() => addField(sIdx)} className="w-full">
                <Plus className="size-4" /> Add Field
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection} className="w-full">
        <Plus className="size-4" /> Add Section
      </Button>
    </div>
  )
}
