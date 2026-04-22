import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown, Save, Baby, Stethoscope, User, Heart, HeartPulse, BookOpen, Camera, Upload, X, Loader2, Trash2,
  Eye, EyeOff, Download, ShieldCheck, ShieldX, Unlock, Send
} from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { IPProfilePreview, SortablePhoto, PhotoEditor, SECTIONS } from '@/pages/profile/IPProfilePage'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { uploadProfilePhoto, deleteProfilePhoto, listProfilePhotos } from '@/lib/db'
import ConfirmDialog from '@/components/ui/confirm-dialog'

// ─────────────────────────────────────────────────────────
// Field Components
// ─────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="text-xs text-stone-400 uppercase tracking-wide font-semibold">
      {children}
    </label>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white rounded-xl"
      />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="bg-white rounded-xl resize-none"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white rounded-xl">
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
    </div>
  )
}

function YesNoField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
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
    </div>
  )
}

function CheckboxGroupField({ label, options, value = [], onChange }) {
  const toggle = (opt) => {
    const set = new Set(value)
    if (set.has(opt)) set.delete(opt)
    else set.add(opt)
    onChange([...set])
  }
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={(value || []).includes(opt)}
              onCheckedChange={() => toggle(opt)}
            />
            <span className="text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Display Components (read-only)
// ─────────────────────────────────────────────────────────

function DisplayField({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  let display = value
  if (Array.isArray(value)) display = value.join(', ')
  if (typeof value === 'boolean') display = value ? 'Yes' : 'No'
  if (value === 'yes') display = 'Yes'
  if (value === 'no') display = 'No'
  return (
    <div>
      <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-sm font-medium whitespace-pre-wrap">{String(display)}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────

// Field / SECTIONS definitions are the single source of truth in
// src/pages/profile/IPProfilePage.jsx — we import them here so the admin tab
// can never drift from what the IP fills out on their side.

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function countSectionCompletion(profile, section, hasPartner) {
  let total = 0, filled = 0
  if (section.perPerson) {
    for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
      const d = profile?.[person]?.[section.key] || {}
      for (const f of section.fields) {
        if (f.conditional && !f.conditional(d)) continue
        total++
        if (isFieldFilled(d[f.key])) filled++
      }
    }
  } else {
    const d = profile?.[section.key] || {}
    for (const f of section.fields) {
      if (f.conditional && !f.conditional(d)) continue
      total++
      if (isFieldFilled(d[f.key])) filled++
    }
  }
  return { filled, total, complete: total > 0 && filled === total }
}

function countProfileCompletion(profile, hasPartner) {
  let total = 0
  let filled = 0

  for (const section of SECTIONS) {
    if (section.perPerson) {
      // Count IP1 fields
      const ip1Data = profile?.ip1?.[section.key] || {}
      for (const f of section.fields) {
        if (f.conditional && !f.conditional(ip1Data)) continue
        total++
        if (isFieldFilled(ip1Data[f.key])) filled++
      }
      // Count IP2 fields if couple
      if (hasPartner) {
        const ip2Data = profile?.ip2?.[section.key] || {}
        for (const f of section.fields) {
          if (f.conditional && !f.conditional(ip2Data)) continue
          total++
          if (isFieldFilled(ip2Data[f.key])) filled++
        }
      }
    } else {
      const sData = profile?.[section.key] || {}
      for (const f of section.fields) {
        if (f.conditional && !f.conditional(sData)) continue
        total++
        if (isFieldFilled(sData[f.key])) filled++
      }
    }
  }

  return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 }
}

function isFieldFilled(value) {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

// ─────────────────────────────────────────────────────────
// Hide-from-IPs toggle (click to hide a specific field from Preview/
// Send/Save PDF — mirrors the GC profile pattern)
// ─────────────────────────────────────────────────────────

function HideToggle({ hidden, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle() }}
      disabled={disabled}
      className={`shrink-0 p-0.5 rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed text-gray-300' : hidden ? 'text-red-400 hover:text-red-600' : 'text-gray-300 hover:text-gray-500'}`}
      title={disabled ? 'Unapprove the profile to change visibility' : hidden ? 'Hidden from IPs — click to show' : 'Visible to IPs — click to hide'}
    >
      {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// Render field in edit mode
// ─────────────────────────────────────────────────────────

function renderEditField(field, data, onChange) {
  // Check conditional visibility
  if (field.conditional && !field.conditional(data)) return null

  const value = data[field.key]
  const handleChange = (val) => onChange(field.key, val)

  switch (field.type) {
    case 'text':
      return <TextField key={field.key} label={field.label} value={value} onChange={handleChange} />
    case 'date':
      return <TextField key={field.key} label={field.label} value={value} onChange={handleChange} type="date" />
    case 'textarea':
      return <TextAreaField key={field.key} label={field.label} value={value} onChange={handleChange} />
    case 'yesno':
      return <YesNoField key={field.key} label={field.label} value={value} onChange={handleChange} />
    case 'select':
      return <SelectField key={field.key} label={field.label} value={value} onChange={handleChange} options={field.options} />
    case 'checkboxGroup':
      return <CheckboxGroupField key={field.key} label={field.label} value={value} onChange={handleChange} options={field.options} />
    case 'qualitiesMax3':
      return <QualitiesMaxField key={field.key} label={field.label} value={value} onChange={handleChange} options={field.options} max={3} />
    default:
      return <TextField key={field.key} label={field.label} value={value} onChange={handleChange} />
  }
}

function QualitiesMaxField({ label, value, onChange, options, max = 3 }) {
  const selected = Array.isArray(value) ? value : []
  const atMax = selected.length >= max
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(v => v !== opt))
    else if (!atMax) onChange([...selected, opt])
  }
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-[#283693]">{label}</label>
      <p className="text-xs text-stone-500">Pick up to {max} — {selected.length}/{max} selected</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isOn = selected.includes(opt)
          const disabled = !isOn && atMax
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)} disabled={disabled}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors border ${
                isOn ? 'bg-[#283693] text-white border-[#283693]' : disabled ? 'bg-stone-50 text-stone-300 border-stone-200 cursor-not-allowed' : 'bg-white text-stone-600 border-stone-300 hover:border-[#283693] hover:text-[#283693]'
              }`}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Render field in display (read-only) mode
// ─────────────────────────────────────────────────────────

function renderDisplayField(field, data) {
  if (field.conditional && !field.conditional(data)) return null
  const value = data[field.key]
  return <DisplayField key={field.key} label={field.label} value={value} />
}

// ─────────────────────────────────────────────────────────
// Section Editor (shared section)
// ─────────────────────────────────────────────────────────

function SharedSectionCard({ section, profile, onSave, onToggleHide, id, isApproved }) {
  const [open, setOpen] = useState(false)
  const sectionData = profile?.[section.key] || {}
  const hiddenFields = Array.isArray(profile?._hiddenFields) ? profile._hiddenFields : []
  const Icon = section.icon

  function handleFieldChange(key, value) {
    const updated = { ...sectionData, [key]: value }
    onSave(section.key, updated)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-2xl" id={id}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#283693]/10 flex items-center justify-center">
                  <Icon className="size-5 text-[#283693]" />
                </div>
                <CardTitle className="text-base text-[#283693]">{section.label}</CardTitle>
              </div>
              <ChevronDown className={`size-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map(f => {
                const node = renderEditField(f, sectionData, handleFieldChange)
                if (!node) return null
                const path = `${section.key}.${f.key}`
                const hidden = hiddenFields.includes(path)
                const spanClass = f.type === 'textarea' || f.type === 'checkboxGroup' || f.fullWidth ? 'md:col-span-2' : ''
                return (
                  <div key={f.key} className={spanClass}>
                    <div className={`relative ${hidden ? 'opacity-60' : ''}`}>
                      <div className="absolute -top-1 right-0 z-10">
                        <HideToggle hidden={hidden} onToggle={() => onToggleHide(path)} disabled={isApproved} />
                      </div>
                      {node}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────
// Section Editor (per-person section with IP1/IP2 tabs)
// ─────────────────────────────────────────────────────────

function PerPersonSectionCard({ section, profile, hasPartner, ip1Name, ip2Name, onSave, onToggleHide, id, isApproved }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('ip1')
  const hiddenFields = Array.isArray(profile?._hiddenFields) ? profile._hiddenFields : []
  const Icon = section.icon

  function getPersonData(person) {
    return profile?.[person]?.[section.key] || {}
  }

  function handleFieldChange(person, key, value) {
    const updated = { ...getPersonData(person), [key]: value }
    onSave(person, section.key, updated)
  }

  function renderPersonContent(person) {
    const personData = getPersonData(person)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.fields.map(f => {
          const node = renderEditField(f, personData, (k, v) => handleFieldChange(person, k, v))
          if (!node) return null
          const path = `${person}.${section.key}.${f.key}`
          const hidden = hiddenFields.includes(path)
          const spanClass = f.type === 'textarea' || f.type === 'checkboxGroup' || f.fullWidth ? 'md:col-span-2' : ''
          return (
            <div key={f.key} className={spanClass}>
              <div className={`relative ${hidden ? 'opacity-60' : ''}`}>
                <div className="absolute -top-1 right-0 z-10">
                  <HideToggle hidden={hidden} onToggle={() => onToggleHide(path)} disabled={isApproved} />
                </div>
                {node}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-2xl" id={id}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#283693]/10 flex items-center justify-center">
                  <Icon className="size-5 text-[#283693]" />
                </div>
                <CardTitle className="text-base text-[#283693]">{section.label}</CardTitle>
              </div>
              <ChevronDown className={`size-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {hasPartner ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="ip1">{ip1Name || 'IP1'}</TabsTrigger>
                  <TabsTrigger value="ip2">{ip2Name || 'IP2'}</TabsTrigger>
                </TabsList>
                <TabsContent value="ip1">{renderPersonContent('ip1')}</TabsContent>
                <TabsContent value="ip2">{renderPersonContent('ip2')}</TabsContent>
              </Tabs>
            ) : (
              renderPersonContent('ip1')
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// Admin Photos Section (profile + cover photo upload)
// ─────────────────────────────────────────────────────────

async function convertToJpeg(file, maxSize = 1200) {
  if (file.name?.match(/\.hei[cf]$/i)) {
    const heic2any = (await import('heic2any')).default
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    file = new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' })
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = Math.round(height * maxSize / width); width = maxSize }
        else { width = Math.round(width * maxSize / height); height = maxSize }
      }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}

function AdminPhotoSlot({ label, hint, storagePath, onChange }) {
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!storagePath) return
    let cancelled = false
    listProfilePhotos(storagePath).then(photos => {
      if (cancelled) return
      if (photos.length > 0) setPhoto(photos[0])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [storagePath])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
    setUploading(true); setError(null)
    try {
      if (photo) await deleteProfilePhoto(photo.path).catch(() => {})
      const jpeg = await convertToJpeg(file)
      const result = await uploadProfilePhoto(storagePath, jpeg)
      if (result) { setPhoto(result); if (onChange) onChange(result.url) }
    } catch (err) { setError(err.message || 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete() {
    if (!photo) return
    try { await deleteProfilePhoto(photo.path); setPhoto(null); if (onChange) onChange(null) }
    catch (err) { setError(err.message || 'Delete failed') }
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-stone-700">{label}</p>
        {hint && <p className="text-xs text-stone-400 mt-0.5">{hint}</p>}
      </div>
      {photo ? (
        <div className="relative group w-40 h-40">
          <img src={photo.url} alt={label} className="w-40 h-40 rounded-2xl object-cover border border-stone-200" />
          <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <label className="p-2 rounded-full bg-white text-stone-700 cursor-pointer hover:bg-stone-100" title="Replace">
              <Upload className="w-4 h-4" />
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className={`flex items-center justify-center w-40 h-40 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#283693]/50 hover:bg-[#283693]/5 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="text-center">
            {uploading ? <Loader2 className="w-6 h-6 mx-auto text-[#283693] animate-spin" /> : (
              <><Upload className="w-6 h-6 mx-auto text-stone-400" /><span className="text-xs text-stone-400 mt-1 block">Upload</span></>
            )}
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <ConfirmDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} title="Delete photo?" message="This photo will be permanently deleted." onConfirm={handleDelete} />
    </div>
  )
}

function IPAdminPhotosSection({ ip, profile, onProfileChange }) {
  // Stable case-keyed path so admin and portal share storage
  const baseId = `ip-${ip?.id}`

  function handlePortraitChange(url) {
    onProfileChange({ ...profile, profilePhotoUrl: url || '' })
  }
  function handleCoverChange(url) {
    onProfileChange({ ...profile, coverPhotoUrl: url || '' })
  }
  function handleOrderChange(newOrder) {
    onProfileChange({ ...profile, _photoOrder: newOrder })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="w-4 h-4 text-[#283693]" /> Profile Photos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AdminPhotoSlot
            label="Profile Photo"
            hint="A picture of the IP(s) — couples or single"
            storagePath={`${baseId}/portrait`}
            onChange={handlePortraitChange}
          />
          <AdminPhotoSlot
            label="Cover Photo"
            hint="A favorite picture doing something they love"
            storagePath={`${baseId}/cover`}
            onChange={handleCoverChange}
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-700 mb-1">Photo Gallery</p>
          <p className="text-xs text-stone-400 mb-3">Additional favorite photos shown in the carousel on the profile preview. Drag to reorder. Click to crop or rotate.</p>
          <AdminPhotoGallery
            storagePath={`${baseId}/gallery`}
            order={profile?._photoOrder}
            onOrderChange={handleOrderChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Admin Photo Gallery (drag-reorder, crop, rotate, multi-upload, delete) ──
function AdminPhotoGallery({ storagePath, order, onOrderChange }) {
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    if (!storagePath) return
    let cancelled = false
    listProfilePhotos(storagePath).then(list => {
      if (cancelled) return
      const loaded = list || []
      if (order && order.length > 0) {
        const byPath = Object.fromEntries(loaded.map(p => [p.path, p]))
        const ordered = order.map(path => byPath[path]).filter(Boolean)
        const extras = loaded.filter(p => !order.includes(p.path))
        setPhotos([...ordered, ...extras])
      } else {
        setPhotos(loaded)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [storagePath]) // eslint-disable-line react-hooks/exhaustive-deps

  function persistOrder(list) {
    if (onOrderChange) onOrderChange(list.map(p => p.path))
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true); setError(null)
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { setError('Photos must be under 10MB each'); continue }
        const jpeg = await convertToJpeg(file)
        const result = await uploadProfilePhoto(storagePath, jpeg)
        if (result) {
          setPhotos(prev => { const next = [...prev, result]; persistOrder(next); return next })
        }
      }
    } catch (err) { setError(err.message || 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete(photo) {
    try {
      await deleteProfilePhoto(photo.path)
      setPhotos(prev => { const next = prev.filter(p => p.path !== photo.path); persistOrder(next); return next })
    } catch (err) { setError(err.message || 'Delete failed') }
  }

  async function handleCropSave(oldPhoto, croppedFile) {
    try {
      const result = await uploadProfilePhoto(storagePath, croppedFile)
      if (result) {
        await deleteProfilePhoto(oldPhoto.path).catch(() => {})
        setPhotos(prev => { const next = prev.map(p => p.path === oldPhoto.path ? result : p); persistOrder(next); return next })
      }
      setEditing(null)
    } catch (err) { setError(err.message || 'Save failed') }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPhotos(prev => {
      const oldIndex = prev.findIndex(p => p.path === active.id)
      const newIndex = prev.findIndex(p => p.path === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      persistOrder(next)
      return next
    })
  }

  if (editing) {
    return <PhotoEditor photo={editing} onSave={handleCropSave} onClose={() => setEditing(null)} />
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map(p => p.path)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {photos.map(photo => (
              <SortablePhoto key={photo.path} photo={photo} onEdit={setEditing} onDelete={setDeleteTarget} />
            ))}
            <label className={`flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#283693]/50 hover:bg-[#283693]/5 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="text-center">
                {uploading ? <Loader2 className="w-5 h-5 mx-auto text-[#283693] animate-spin" /> : (
                  <><Upload className="w-5 h-5 mx-auto text-stone-400" /><span className="text-[10px] text-stone-400 mt-1 block">Add</span></>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </SortableContext>
      </DndContext>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="Delete photo?" message="This photo will be permanently deleted." onConfirm={() => { handleDelete(deleteTarget); setDeleteTarget(null) }} />
    </>
  )
}

export default function IPProfileTab({ ip, onUpdate }) {
  const { currentUser } = useRole()
  const answers = ip?.answers || {}
  // Local copy of profile for immediate UI updates; debounced save bubbles up
  const [localProfile, setLocalProfile] = useState(answers._ipProfile || {})
  const saveTimer = useRef(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPhotos, setPreviewPhotos] = useState([])
  const [approvalSaving, setApprovalSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const previewRef = useRef(null)

  // Sync localProfile when ip prop changes (e.g., navigating to a different IP)
  useEffect(() => {
    setLocalProfile(answers._ipProfile || {})
  }, [ip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const profile = localProfile
  const hasPartner = answers.hasPartner === 'yes' || answers.hasPartner === true
  const isApproved = !!profile?._approved

  const ip1Name = answers.primaryFirstName || 'IP1'
  const ip2Name = answers.ip2FirstName || 'IP2'

  const { filled, total, percent } = countProfileCompletion(profile, hasPartner)

  function scheduleAutoSave(updatedProfile) {
    setLocalProfile(updatedProfile)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onUpdate({ ...answers, _ipProfile: updatedProfile })
    }, 1500)
  }

  async function openPreview() {
    if (previewOpen) { setPreviewOpen(false); return }
    const baseId = `ip-${ip?.id}`
    try {
      const [portrait, cover, gallery] = await Promise.all([
        listProfilePhotos(`${baseId}/portrait`).catch(() => []),
        listProfilePhotos(`${baseId}/cover`).catch(() => []),
        listProfilePhotos(`${baseId}/gallery`).catch(() => []),
      ])
      const order = profile?._photoOrder
      let orderedGallery = gallery
      if (order && order.length > 0) {
        const byPath = Object.fromEntries(gallery.map(p => [p.path, p]))
        orderedGallery = [
          ...order.map(path => byPath[path]).filter(Boolean),
          ...gallery.filter(p => !order.includes(p.path)),
        ]
      }
      const tagged = [
        ...portrait.map(p => ({ ...p, kind: 'portrait' })),
        ...cover.map(p => ({ ...p, kind: 'cover' })),
        ...orderedGallery.map(p => ({ ...p, kind: 'gallery' })),
      ]
      setPreviewPhotos(tagged)
    } catch {
      setPreviewPhotos([])
    }
    setPreviewOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleApproval() {
    setApprovalSaving(true)
    const updatedProfile = isApproved
      ? { ...profile, _approved: false, _approvedAt: null }
      : { ...profile, _approved: true, _approvedAt: new Date().toISOString() }
    setLocalProfile(updatedProfile)
    try {
      await onUpdate({ ...answers, _ipProfile: updatedProfile })
    } catch {} finally { setApprovalSaving(false) }
  }

  async function handleReopen() {
    const ipFirstName = answers.primaryFirstName || 'this IP'
    if (!window.confirm(`Reopen ${ipFirstName}'s profile so they can edit it again?`)) return
    setReopening(true)
    const updatedProfile = { ...profile, _approved: false, _approvedAt: null }
    setLocalProfile(updatedProfile)
    try {
      await onUpdate({
        ...answers,
        _ipProfile: updatedProfile,
        _profileReleasedAt: new Date().toISOString(),
        _profileReleasedBy: currentUser?.name || currentUser?.email || '',
      })
    } catch {} finally { setReopening(false) }
  }


  function downloadPDF() {
    if (!previewOpen) {
      openPreview().then(() => setTimeout(doPrint, 400))
    } else {
      doPrint()
    }
  }

  function doPrint() {
    if (!previewRef.current) return
    const name = (ip?.ip1Name || answers.primaryFirstName || 'IP').replace(/[^a-zA-Z0-9]/g, '')
    const printWin = window.open('', '_blank')
    if (!printWin) { alert('Please allow popups to save as PDF'); return }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML).join('\n')
    const html = `<!DOCTYPE html><html><head><title>${name} - IP Profile</title>${styles}
      <style>
        @page { size: letter; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0 !important; padding: 0 !important; }
          .print-bar { display: none !important; }
          .print-container { max-width: 100% !important; padding: 0 !important; }
        }
        body { background: #fff; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        .print-container { max-width: 100%; margin: 0; padding: 0; }
        .print-bar { position: sticky; top: 0; z-index: 100; padding: 14px 24px; background: #283693; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
        .print-bar button { background: white; color: #283693; border: none; padding: 8px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
      </style></head><body>
      <div class="print-bar">
        <strong>${name}'s Intended Parent Profile</strong>
        <button onclick="window.print()">Save as PDF</button>
      </div>
      <div class="print-container">${previewRef.current.innerHTML}</div>
      </body></html>`
    printWin.document.write(html)
    printWin.document.close()
  }

  // Save a shared section (fertility, surrogacy)
  function handleSharedSave(sectionKey, data) {
    const updatedProfile = { ...profile, [sectionKey]: data }
    scheduleAutoSave(updatedProfile)
  }

  // Save a per-person section (personal, health, history)
  function handlePerPersonSave(person, sectionKey, data) {
    const updatedProfile = {
      ...profile,
      [person]: {
        ...(profile[person] || {}),
        [sectionKey]: data,
      },
    }
    scheduleAutoSave(updatedProfile)
  }

  // Toggle a single field's visibility in Preview/Send/Save PDF. Path
  // is dot-separated: "fertility.hasFrozenEmbryos" for shared sections,
  // "ip1.health.mentalHealth" for per-person.
  function handleToggleHide(path) {
    if (isApproved) return
    const current = Array.isArray(profile._hiddenFields) ? profile._hiddenFields : []
    const updated = current.includes(path) ? current.filter(p => p !== path) : [...current, path]
    scheduleAutoSave({ ...profile, _hiddenFields: updated })
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Approved banner */}
      {isApproved && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">Profile is approved. The IP can no longer edit it.</p>
        </div>
      )}

      {/* Progress Bar + action buttons */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile Completion</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={openPreview}>
              <Eye className="size-3.5" /> {previewOpen ? 'Edit View' : 'Preview'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={downloadPDF}>
              <Download className="size-3.5" /> Save as PDF
            </Button>
            {(() => {
              const isLockedFromSubmit = !!answers._profileSubmitted && !answers._profileReleasedAt
              const isLocked = isLockedFromSubmit || isApproved
              if (!isLocked) return null
              return (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={handleReopen}
                  disabled={reopening}
                >
                  {reopening ? <Loader2 className="size-3.5 animate-spin" /> : <Unlock className="size-3.5" />}
                  {reopening ? 'Reopening...' : 'Reopen for Editing'}
                </Button>
              )
            })()}
            <Button
              size="sm"
              className={`gap-1.5 rounded-full ${isApproved ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'} text-white`}
              onClick={toggleApproval}
              disabled={approvalSaving}
            >
              {approvalSaving ? <Loader2 className="size-3.5 animate-spin" /> : isApproved ? <ShieldX className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {isApproved ? 'Unapprove' : 'Approve'}
            </Button>
          </div>
        </CardHeader>
        {!previewOpen && (
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
                </div>
              </div>
              <span className="text-sm font-bold text-[#283693]">{percent}%</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {SECTIONS.map(sec => {
                const { filled: sf, total: st, complete: sc } = countSectionCompletion(profile, sec, hasPartner)
                return (
                  <button key={sec.key}
                    onClick={() => document.getElementById(`ip-sec-${sec.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`rounded-xl border p-3 text-center cursor-pointer hover:shadow-sm transition-shadow ${sc ? 'border-green-200 bg-green-50' : sf > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="text-xs font-medium text-gray-600 truncate">{sec.label}</p>
                    <p className={`text-sm font-bold mt-1 ${sc ? 'text-green-600' : sf > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {st > 0 ? `${sf}/${st}` : '—'}
                    </p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {previewOpen ? (
        <div className="max-w-[850px] mx-auto" ref={previewRef}>
          <IPProfilePreview
            profile={profile}
            photos={previewPhotos}
            hasPartner={hasPartner}
            ip1Name={ip1Name}
            ip2Name={ip2Name}
            primaryName={answers.primaryFirstName || 'Intended Parent'}
            ip2FullName={answers.ip2FirstName || ''}
            location={[answers.city, ({'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California','CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'})[answers.stateProv?.toUpperCase()] || answers.stateProv].filter(Boolean).join(', ')}
          />
        </div>
      ) : (
        <>
          {/* Admin Photos */}
          <IPAdminPhotosSection ip={ip} profile={profile} onProfileChange={scheduleAutoSave} />

          {/* Sections */}
          {SECTIONS.map(section =>
            section.perPerson ? (
              <PerPersonSectionCard
                key={section.key}
                section={section}
                profile={profile}
                hasPartner={hasPartner}
                ip1Name={ip1Name}
                ip2Name={ip2Name}
                onSave={handlePerPersonSave}
                onToggleHide={handleToggleHide}
                isApproved={isApproved}
                id={`ip-sec-${section.key}`}
              />
            ) : (
              <SharedSectionCard
                key={section.key}
                section={section}
                profile={profile}
                onSave={handleSharedSave}
                onToggleHide={handleToggleHide}
                isApproved={isApproved}
                id={`ip-sec-${section.key}`}
              />
            )
          )}
        </>
      )}
    </div>
  )
}
