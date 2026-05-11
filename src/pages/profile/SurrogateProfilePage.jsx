import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react'
import {
  User, Home, Baby, Stethoscope, HeartPulse, Apple, Briefcase,
  Heart, Camera, ChevronDown, CheckCircle2, Circle, Plus, Trash2,
  Ruler, Scale, CalendarDays, MapPin, Upload,
  Loader2, X, RotateCw, Crop as CropIcon, Eye, Send, AlertTriangle,
  Weight as WeightIcon, Droplets, Activity, Shield as ShieldIcon,
  DollarSign, ChevronLeft, ChevronRight, ShieldCheck, ShieldX, Flag
} from 'lucide-react'

export const QUALITIES_OPTIONS = [
  'Compassionate','Organized','Optimistic','Calm','Resilient','Thoughtful','Honest',
  'Patient','Supportive','Independent','Warm','Reliable','Open-minded','Flexible',
  'Encouraging','Determined','Nurturing','Empathetic','Communicative','Loyal',
  'Easygoing','Confident','Hopeful','Grounded',
]

// Multi-select chip field limited to `max` selections.
function QualitiesMaxField({ label, value, onChange, options, max = 3 }) {
  const selected = Array.isArray(value) ? value : []
  const atMax = selected.length >= max
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(v => v !== opt))
    else if (!atMax) onChange([...selected, opt])
  }
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-[#1A3638]">{label}</label>
      <p className="text-xs text-stone-500">Pick up to {max} — {selected.length}/{max} selected</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isOn = selected.includes(opt)
          const disabled = !isOn && atMax
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)} disabled={disabled}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors border ${
                isOn
                  ? 'bg-[#1A3638] text-white border-[#1A3638]'
                  : disabled
                    ? 'bg-stone-50 text-stone-300 border-stone-200 cursor-not-allowed'
                    : 'bg-white text-stone-600 border-stone-300 hover:border-[#1A3638] hover:text-[#1A3638]'
              }`}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import { fetchIntakeByEmail, uploadProfilePhoto, deleteProfilePhoto, listProfilePhotos, saveSurrogateProfile, fetchSurrogateProfile, fetchInsurance, upsertInsurance, ensureIntakeForProfile, updateSurrogateProfileStatus, createCaseTask, setRecordTracking as setRecordTrackingDB, getRecordTracking } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Cropper from 'react-easy-crop'

// ─── Helper: load / save (per-user) ───
function getStorageKey(userId) {
  return `abc-surrogate-profile-${userId || 'anonymous'}`
}
function loadProfile(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function saveProfile(userId, data) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(data))
}

// ─────────────────────────────────────────────────────────
// Field helper components
// ─────────────────────────────────────────────────────────

function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text', disabled = false, className = '' }) {
  return (
    <Field label={label} className={className}>
      <Input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-white border-stone-200 text-sm h-9 focus:border-[#1A3638] focus:ring-1 focus:ring-[#1A3638]/20"
      />
    </Field>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3, className = '' }) {
  return (
    <Field label={label} className={className}>
      <Textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="bg-white border-stone-200 text-sm focus:border-[#1A3638] focus:ring-1 focus:ring-[#1A3638]/20"
      />
    </Field>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...', className = '' }) {
  return (
    <Field label={label} className={className}>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white border-stone-200 text-sm h-9">
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

function YesNoField({ label, value, onChange, className = '' }) {
  return (
    <Field label={label} className={className}>
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onChange('yes')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
            value === 'yes'
              ? 'bg-[#1A3638] text-white shadow-sm'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange('no')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
            value === 'no'
              ? 'bg-[#1A3638] text-white shadow-sm'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          No
        </button>
      </div>
    </Field>
  )
}

function CheckboxGroupField({ label, options, value = [], onChange, className = '' }) {
  const toggle = (opt) => {
    const set = new Set(value)
    if (set.has(opt)) set.delete(opt)
    else set.add(opt)
    onChange([...set])
  }
  return (
    <Field label={label} className={className}>
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

function CurrencyField({ label, value, onChange, className = '' }) {
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
    <Field label={label} className={className}>
      <Input
        value={formatCurrency(value)}
        onChange={e => handleChange(e.target.value)}
        placeholder="$0"
        className="bg-white"
      />
    </Field>
  )
}

// Hourly rate with automatic decimal placement — typing "1640" shows "$16.40",
// "850" → "$8.50", "10500" → "$105.00". Stripping digits means admins can't
// accidentally desync the cents portion from the displayed value.
function HourlyRateField({ label, value, onChange, className = '' }) {
  const formatHourly = (val) => {
    const digits = String(val).replace(/[^0-9]/g, '')
    if (!digits) return ''
    const cents = digits.padStart(3, '0')
    const dollars = cents.slice(0, -2)
    const cc = cents.slice(-2)
    return '$' + Number(dollars).toLocaleString('en-US') + '.' + cc
  }
  const handleChange = (raw) => {
    const digits = raw.replace(/[^0-9]/g, '')
    onChange(digits ? formatHourly(digits) : '')
  }
  return (
    <Field label={label} className={className}>
      <Input
        value={formatHourly(value)}
        onChange={e => handleChange(e.target.value)}
        placeholder="$0.00"
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
  const requiresChildAge = (relationship) => ['Stepson', 'Stepdaughter'].includes(relationship || '')
  const isValidStepchildDob = (dob) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob || '')) return false
    const [day, month, year] = String(dob).split('/').map(Number)
    const date = new Date(year, month - 1, day)
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    )
  }
  const formatStepchildDobInput = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  }

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
          {Array.from({ length: count }).map((_, idx) => {
            const member = value[idx] || {}
            const showAge = requiresChildAge(member.relationship)
            return (
              <div key={idx} className={`${idx < count - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className={`grid gap-3 px-3 py-2 ${showAge ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_180px]' : 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px]'}`}>
                  <div className="px-3 py-2">
                    <Input
                      value={member.name || ''}
                      onChange={e => updateMember(idx, 'name', e.target.value)}
                      placeholder={`Person ${idx + 1}`}
                      className="bg-white h-9"
                    />
                  </div>
                  <div className="px-3 py-2">
                    <Select value={member.relationship || ''} onValueChange={val => updateMember(idx, 'relationship', val)}>
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
                  {showAge && (
                    <div className="px-3 py-2">
                      <Field label="Stepchild's DOB">
                        <Input
                          type="text"
                          value={member.stepchildDob || ''}
                          onChange={e => updateMember(idx, 'stepchildDob', formatStepchildDobInput(e.target.value))}
                          placeholder="DD/MM/YYYY"
                          className="bg-white h-9"
                        />
                      </Field>
                      {member.stepchildDob && !isValidStepchildDob(member.stepchildDob) && (
                        <p className="mt-1 text-[11px] text-red-500">Use DD/MM/YYYY</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Resize image via canvas, returns JPEG File
function resizeViaCanvas(imageFile, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(imageFile)
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => {
          URL.revokeObjectURL(url)
          if (blob) resolve(new File([blob], imageFile.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          else reject(new Error('Conversion failed'))
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.src = url
  })
}

// Convert any image to JPEG — tries canvas first (Safari supports HEIC natively),
// falls back to heic2any for Chrome/Firefox
async function convertToJpeg(file, maxSize = 1200) {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
  // For non-HEIC files under 2MB, skip processing
  if (!isHeic && file.size < 2 * 1024 * 1024) return file
  // Try canvas first (works for JPEG/PNG/WebP, and HEIC on Safari)
  try {
    return await resizeViaCanvas(isHeic ? file : file, maxSize)
  } catch {
    // Canvas failed (HEIC on Chrome/Firefox) — use heic2any
    if (isHeic) {
      try {
        const heic2any = (await import('heic2any')).default
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
        const jpegFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
        return await resizeViaCanvas(jpegFile, maxSize)
      } catch {
        throw new Error('HEIC is not supported in this browser. Open the photo in Preview → File → Export as JPEG, then upload the JPEG.')
      }
    }
    throw new Error('Could not process this image')
  }
}

// Crop helper — takes a URL + crop area, returns a JPEG blob
function getCroppedImg(imageSrc, crop, rotation = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const rad = (rotation * Math.PI) / 180
      // Calculate bounding box of rotated image
      const sin = Math.abs(Math.sin(rad))
      const cos = Math.abs(Math.cos(rad))
      const bw = img.width * cos + img.height * sin
      const bh = img.width * sin + img.height * cos
      canvas.width = crop.width
      canvas.height = crop.height
      ctx.translate(-crop.x, -crop.y)
      ctx.translate(bw / 2, bh / 2)
      ctx.rotate(rad)
      ctx.translate(-img.width / 2, -img.height / 2)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Crop failed')), 'image/jpeg', 0.9)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageSrc
  })
}

function ProfilePhotoUpload({ label = 'Profile Photo', hint, userId, fallbackId, subfolder = 'headshot', onPhotoChange }) {
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      // Try userId first
      const photos = await listProfilePhotos(`${userId}/${subfolder}`).catch(() => [])
      if (photos.length > 0) { setPhoto(photos[0]); return }
      // Try fallback ID (intake case ID)
      if (fallbackId && fallbackId !== userId) {
        const fallbackPhotos = await listProfilePhotos(`${fallbackId}/${subfolder}`).catch(() => [])
        if (fallbackPhotos.length > 0) setPhoto(fallbackPhotos[0])
      }
    }
    load()
  }, [userId, fallbackId, subfolder])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
    setUploading(true)
    setError(null)
    try {
      if (photo) await deleteProfilePhoto(photo.path).catch(() => {})
      const jpeg = await convertToJpeg(file)
      const result = await uploadProfilePhoto(`${userId}/${subfolder}`, jpeg)
      if (result) {
        setPhoto(result)
        if (onPhotoChange) onPhotoChange(result.url)
      }
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete() {
    if (!photo) return
    try {
      await deleteProfilePhoto(photo.path)
      setPhoto(null)
      if (onPhotoChange) onPhotoChange(null)
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  return (
    <Field label={label}>
      {hint && <p className="text-xs text-gray-400 -mt-0.5 mb-1.5">{hint}</p>}
      {photo ? (
        <div className="relative group w-32 h-32">
          <img src={photo.url} alt="Profile" className="w-32 h-32 rounded-2xl object-cover border border-gray-200" />
          <button
            onClick={handleDelete}
            className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className={`flex items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-[#D4A853]/50 hover:bg-pink-50/30 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="text-center">
            {uploading ? (
              <Loader2 className="w-6 h-6 mx-auto text-[#D4A853] animate-spin" />
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto text-gray-400" />
                <span className="text-xs text-gray-400 mt-1 block">Upload</span>
              </>
            )}
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </Field>
  )
}

// ─────────────────────────────────────────────────────────
// Progress ring SVG
// ─────────────────────────────────────────────────────────
function ProgressRing({ percent, size = 80, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (percent / 100) * circ
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="#D4A853" strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-[#1A3638]">{percent}%</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────

import {
  SECTION_META as SHARED_SECTION_META,
  REQUIRED_FIELDS as SHARED_REQUIRED_FIELDS,
  CONDITIONAL_REQUIRED as SHARED_CONDITIONAL_REQUIRED,
  countCompleted as sharedCountCompleted,
  isPregnancyComplete,
} from '@/components/profile/profileConstants'

// Filter out followUp — those are application/admin questions, not portal profile sections
const SECTION_META = SHARED_SECTION_META.filter(s => s.key !== 'followUp')
const REQUIRED_FIELDS = SHARED_REQUIRED_FIELDS
const CONDITIONAL_REQUIRED = SHARED_CONDITIONAL_REQUIRED
const countCompleted = sharedCountCompleted

// ─────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────

function calculateBMI(ft, inches, lbs) {
  const f = parseFloat(ft); const i = parseFloat(inches); const w = parseFloat(lbs)
  if (!f || !w) return ''
  const totalInches = f * 12 + (i || 0)
  return ((w / (totalInches * totalInches)) * 703).toFixed(1)
}

function normalizeJourneyList(journeys) {
  if (Array.isArray(journeys)) return journeys
  if (journeys && typeof journeys === 'object') {
    return Object.keys(journeys)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => journeys[key])
      .filter(Boolean)
  }
  return []
}

export default function SurrogateProfilePage() {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
  const [intakeCaseId, setIntakeCaseId] = useState(null)
  const [insuranceStatus, setInsuranceStatus] = useState(null)
  const [profile, setProfile] = useState(() => loadProfile(userId))
  const [profileApproved, setProfileApproved] = useState(false)
  const [profileSubmitted, setProfileSubmitted] = useState(false)
  const [profileStatusLoaded, setProfileStatusLoaded] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openSections, setOpenSections] = useState(() => {
    // If URL has a hash like #family, open that section instead of about
    const hash = window.location.hash.replace('#', '')
    if (hash && SECTION_META.some(s => s.key === hash)) {
      return { [hash]: true }
    }
    return { about: true }
  })

  // Reload profile when user changes
  useEffect(() => {
    setProfile(loadProfile(userId))
  }, [userId])

  // Scroll to section if URL has a hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      const el = document.getElementById(`section-${hash}`)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [])

  // Migrate old about/family keys → personal (one-time)
  useEffect(() => {
    const existing = loadProfile(userId)
    if (!existing?.personal?.firstName && (existing?.about?.firstName || existing?.family?.maritalStatus)) {
      setProfile(prev => ({
        ...prev,
        personal: {
          ...prev.about,
          ...prev.family,
          ...prev.personal,
        },
      }))
    }
  }, [userId])

  // Resolve the intake_submissions.id (the surrogate's "case_id") for this user.
  // If they reached the Profile page without completing the intake form (manual
  // admin add, or direct signup), ensureIntakeForProfile creates a stub row once
  // they have at least a first name. Guard against refiring once we've resolved.
  useEffect(() => {
    if (!currentUser?.email || !supabase) return
    if (intakeCaseId) return
    const personal = profile?.personal || {}
    ensureIntakeForProfile({
      email: currentUser.email,
      firstName: personal.firstName,
      lastName: personal.lastName,
      phone: personal.phone,
    }).then(id => {
      if (!id) return
      setIntakeCaseId(String(id))
      fetchInsurance(id, 'surrogate').then(ins => {
        if (ins) setInsuranceStatus(ins.insurance_status)
      }).catch(() => {})
    }).catch(() => {})
  }, [currentUser?.email, intakeCaseId, profile?.personal?.firstName, profile?.personal?.lastName, profile?.personal?.phone])

  // Pre-fill from intake quiz answers
  useEffect(() => {
    if (!currentUser?.email) return
    const existing = loadProfile(userId)
    // Only pre-fill if personal section is empty
    if (existing?.personal?.firstName) return
    const STATE_ABBR_TO_NAME = {
      AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
    }
    fetchIntakeByEmail(currentUser.email).then(answers => {
      if (!answers) return
      const bmi = calculateBMI(answers.heightFt, answers.heightIn, answers.weightLbs)
      const rawState = answers.state || ''
      const state = STATE_ABBR_TO_NAME[rawState.toUpperCase()] || rawState
      setProfile(prev => ({
        ...prev,
        personal: {
          ...prev.personal,
          firstName: answers.firstName || '',
          dob: answers.dob || '',
          city: answers.city || '',
          state,
          heightFt: answers.heightFt?.toString() || '',
          heightIn: answers.heightIn?.toString() || '',
          weight: answers.weightLbs?.toString() || '',
          bmi: bmi || '',
          maritalStatus: answers.maritalStatus || '',
          partnerName: answers.partnerName || '',
          usCitizen: answers.usCitizen === true ? 'yes' : answers.usCitizen === false ? 'no' : '',
        },
        experiencedSurrogate: {
          ...prev.experiencedSurrogate,
          // Only pre-fill if not already set
          ...(prev.experiencedSurrogate?.previousSurrogate ? {} : {
            previousSurrogate: answers.experiencedSurrogate === true ? 'yes' : answers.experiencedSurrogate === false ? 'no' : '',
          }),
        },
      }))
    })
  }, [currentUser?.email])

  // Auto-save on change (localStorage immediately, Supabase debounced)
  // Skip remote saves until the status is known, and while the profile is approved.
  const saveTimer = useRef(null)
  useEffect(() => {
    saveProfile(userId, profile)
    if (!profileStatusLoaded || profileApproved) return
    if (currentUser?.id && currentUser?.email) {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveSurrogateProfile(currentUser.id, currentUser.email, profile).catch(() => {})
      }, 2000)
    }
    return () => clearTimeout(saveTimer.current)
  }, [profile, userId, currentUser?.id, currentUser?.email, profileStatusLoaded, profileApproved])

  // Sync the Employment → "Do you have insurance?" answer into surrogate_insurance.
  // - has_insurance mirrors yes/no.
  // - On first-time yes, seed insurance_status='policy_check' (shows as
  //   "Verifying Policy" in the profile header and "ART Risk Policy Check" in
  //   the Insurance tab) — but only if the admin hasn't already set a status.
  const lastSyncedInsurance = useRef(null)
  useEffect(() => {
    if (profileApproved) return
    if (!intakeCaseId) return
    const answer = profile?.employment?.healthInsurance
    if (answer !== 'yes' && answer !== 'no') return
    if (lastSyncedInsurance.current === answer) return
    const timer = setTimeout(async () => {
      try {
        const hasIns = answer === 'yes'
        const existing = await fetchInsurance(intakeCaseId, 'surrogate')
        const updates = { has_insurance: hasIns }
        if (hasIns && !existing?.insurance_status) updates.insurance_status = 'policy_check'
        await upsertInsurance(intakeCaseId, 'surrogate', updates)
        lastSyncedInsurance.current = answer
      } catch (err) {
        console.error('Insurance sync failed:', err)
      }
    }, 2500)
    return () => clearTimeout(timer)
  }, [profile?.employment?.healthInsurance, intakeCaseId, profileApproved])

  // Sync with Supabase on first visit
  useEffect(() => {
    if (!currentUser?.id || !currentUser?.email) return
    fetchSurrogateProfile(currentUser.id).then(result => {
      if (result?.status === 'approved') setProfileApproved(true)
      if (result?.status === 'pending_review') setProfileSubmitted(true)
      setProfileStatusLoaded(true)
      if (result?.profile_data && Object.keys(result.profile_data).length > 0) {
        // Supabase has data — merge with localStorage, migrating old keys
        setProfile(prev => {
          const merged = { ...result.profile_data }
          // Migrate old section keys → new ones
          if (merged.about || merged.family) {
            merged.personal = { ...merged.about, ...merged.family, ...merged.personal }
          }
          if (merged.lifestyle && !merged.general) {
            merged.general = merged.lifestyle
          }
          if (merged.preferences && !merged.hopesWishes) {
            merged.hopesWishes = merged.preferences
          }
          for (const [section, fields] of Object.entries(prev)) {
            if (!merged[section]) merged[section] = fields
            else merged[section] = { ...fields, ...merged[section] }
          }
          return merged
        })
      } else {
        // No Supabase data yet — push localStorage to Supabase now
        const local = loadProfile(userId)
        if (local && Object.keys(local).length > 0) {
          saveSurrogateProfile(currentUser.id, currentUser.email, local).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [currentUser?.id, currentUser?.email])

  const updateSection = useCallback((section, field, value) => {
    setProfile(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }))
  }, [])

  const getVal = useCallback((section, field) => {
    return profile?.[section]?.[field] ?? ''
  }, [profile])

  const toggleSection = useCallback((key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Overall completion
  const overallCompletion = useMemo(() => {
    let totalFields = 0
    let totalFilled = 0
    for (const s of SECTION_META) {
      const { filled, total } = countCompleted(profile, s.key)
      totalFields += total
      totalFilled += filled
    }
    return totalFields === 0 ? 0 : Math.round((totalFilled / totalFields) * 100)
  }, [profile])

  // First-visit welcome modal
  useEffect(() => {
    if (!profileStatusLoaded || profileApproved || profileSubmitted) return
    const key = `abc-profile-welcome-shown-${userId}`
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      setShowWelcomeModal(true)
    }
  }, [profileStatusLoaded, userId])

  // Submit profile for review
  async function handleSubmitForReview() {
    setSubmitting(true)
    try {
      // Get full name — try profile first, then fetch from intake quiz
      let firstName = profile?.personal?.firstName || currentUser?.name?.split(' ')[0] || 'Surrogate'
      let lastName = profile?.personal?.lastName || currentUser?.name?.split(' ').slice(1).join(' ') || ''
      if (!lastName && currentUser?.email) {
        try {
          const intake = await fetchIntakeByEmail(currentUser.email)
          if (intake) {
            if (!profile?.personal?.firstName && intake.firstName) firstName = intake.firstName
            if (intake.lastName) lastName = intake.lastName
          }
        } catch {}
      }
      const surrogateName = `${firstName} ${lastName}`.trim()

      // 0. Persist profile to Supabase first. If this fails, abort —
      // otherwise status flips to pending_review without the data landing.
      if (currentUser?.id && currentUser?.email) {
        try {
          await saveSurrogateProfile(currentUser.id, currentUser.email, profile)
        } catch (err) {
          console.error('Profile save before submit failed:', err)
          alert("We couldn't save your profile to our servers. Please check your internet connection and try again. If this keeps happening, contact support@northstarsurrogacy.com and we'll help you finish submitting.")
          return
        }
      }

      // 1. Update profile status to "pending_review"
      if (currentUser?.email) {
        try {
          await updateSurrogateProfileStatus(currentUser.email, 'pending_review')
        } catch (err) {
          console.error('Status update failed:', err)
          alert("Your profile was saved, but we couldn't mark it as submitted. Please contact support@northstarsurrogacy.com so we can finalize your submission.")
          return
        }
      }
      setProfileSubmitted(true)

      // 2. Send notification email
      try {
        await fetch('/api/notify-profile-submitted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ surrogateName, surrogateEmail: currentUser?.email, caseId: intakeCaseId }),
        })
      } catch (err) { console.error('Profile notify email failed:', err) }

      // 3. Create task for intake to review (high priority)
      if (intakeCaseId) {
        const today = new Date().toISOString().split('T')[0]
        await createCaseTask({
          case_id: intakeCaseId,
          case_type: 'surrogate',
          title: `Review ${surrogateName}'s Profile`,
          assigned_to: 'intake@northstarsurrogacy.com',
          due_date: today,
          priority: 'high',
          status: 'open',
        }).catch(err => console.error('Task creation failed:', err))
      }

      // 4. Checklist logging is handled server-side in /api/notify-profile-submitted

      setShowSubmitModal(false)
    } catch (err) {
      console.error('Submit for review failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPhotos, setPreviewPhotos] = useState([])

  // Shorthand helpers
  const v = (section, field) => getVal(section, field)
  const u = (section, field) => (val) => updateSection(section, field, val)

  async function openPreview() {
    if (previewOpen) {
      setPreviewOpen(false)
      return
    }
    // Raw mode for the slot folders so ProfilePreview gets both `original_*`
    // (used for the gallery thumbnails / lightbox) and `cropped_*` (used for
    // the hero banner). Gallery folder has no crops so default mode is fine.
    const [gallery, headshots, portraits] = await Promise.all([
      listProfilePhotos(userId).catch(() => []),
      listProfilePhotos(`${userId}/headshot`, { raw: true }).catch(() => []),
      listProfilePhotos(`${userId}/portrait`, { raw: true }).catch(() => []),
    ])
    let allGallery = gallery, allHeadshots = headshots, allPortraits = portraits
    if (intakeCaseId && intakeCaseId !== userId) {
      const [g2, h2, p2] = await Promise.all([
        listProfilePhotos(intakeCaseId).catch(() => []),
        listProfilePhotos(`${intakeCaseId}/headshot`, { raw: true }).catch(() => []),
        listProfilePhotos(`${intakeCaseId}/portrait`, { raw: true }).catch(() => []),
      ])
      allGallery = [...gallery, ...g2]
      allHeadshots = [...headshots, ...h2]
      allPortraits = [...portraits, ...p2]
    }
    // Order: cover (headshot) first, then portrait, then gallery
    setPreviewPhotos([...allHeadshots, ...allPortraits, ...allGallery])
    setPreviewOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-stone-50/60">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto space-y-5">

        {/* ── Page Header ── */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-100 flex flex-col sm:flex-row items-center gap-5">
            <ProgressRing percent={overallCompletion} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-xl font-bold text-[#1A3638]">My Surrogate Profile</h1>
              <p className="text-stone-400 text-sm mt-0.5">Complete your matching profile so intended parents can get to know you.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={openPreview} variant="outline" size="sm" className="gap-1.5 rounded-lg border-stone-300 text-stone-600 hover:text-[#1A3638] hover:border-[#1A3638]/30">
                <Eye className="w-3.5 h-3.5" /> {previewOpen ? 'Edit' : 'Preview'}
              </Button>
              {!profileApproved && !profileSubmitted && overallCompletion === 100 && (
                <Button
                  size="sm"
                  onClick={() => setShowSubmitModal(true)}
                  className="gap-1.5 rounded-lg"
                  style={{ backgroundColor: '#1A3638', color: '#fff' }}
                >
                  <Send className="w-3.5 h-3.5" /> Submit
                </Button>
              )}
            </div>
          </div>
          <div className="px-6 py-3 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-stone-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1F3A3C] to-[#5A9EA2] rounded-full transition-all duration-700"
                  style={{ width: `${overallCompletion}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-stone-400 tabular-nums">{overallCompletion}%</span>
            </div>
          </div>
        </div>

        {/* Submitted banner */}
        {profileSubmitted && !profileApproved && (
          <div className="flex items-center gap-3 p-5 rounded-xl bg-blue-50 border-2 border-blue-200 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-blue-800">Profile Submitted for Review</p>
              <p className="text-sm text-blue-600 mt-0.5">Your profile has been submitted! Our team will review it and reach out with any questions. If you need to make edits, please reach out to <a href="mailto:jenn@northstarsurrogacy.com" className="font-semibold underline">jenn@northstarsurrogacy.com</a>.</p>
            </div>
          </div>
        )}

        {/* Approved banner */}
        {profileApproved && (
          <div className="flex items-center gap-3 p-5 rounded-xl bg-green-50 border-2 border-green-300 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-green-800">Profile Approved</p>
              <p className="text-sm text-green-600 mt-0.5">Your profile has been reviewed and approved by the North Star Surrogacy team. It is now visible to intended parents. If you need to make changes, please reach out to <a href="mailto:jenn@northstarsurrogacy.com" className="font-semibold underline">jenn@northstarsurrogacy.com</a>.</p>
            </div>
          </div>
        )}

        {previewOpen ? (
          /* ── Inline Preview ── */
          <div className="max-w-[850px] mx-auto">
            <ProfilePreview profile={profile} photos={previewPhotos} insuranceStatus={insuranceStatus} />
          </div>
        ) : (
          /* ── Section Cards ── */
          <>
            {SECTION_META.map(sec => {
              const { filled, total, complete } = countCompleted(profile, sec.key)
              const Icon = sec.icon
              const isOpen = !!openSections[sec.key]

              const isLocked = profileApproved || profileSubmitted
              return (
                <Collapsible key={sec.key} open={isLocked ? false : isOpen} onOpenChange={() => !isLocked && toggleSection(sec.key)}>
                  <div id={`section-${sec.key}`} className={`bg-white rounded-xl border border-stone-200 overflow-hidden ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CollapsibleTrigger asChild>
                      <button className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${isLocked ? 'cursor-default' : 'hover:bg-stone-50/60'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          complete ? 'bg-emerald-50' : 'bg-[#1A3638]/5'
                        }`}>
                          <Icon className={`w-4 h-4 ${complete ? 'text-emerald-500' : 'text-[#1A3638]/70'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-800">{sec.title}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5">{sec.description}</p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          {total > 0 && (
                            <span className={`text-[11px] font-medium tabular-nums ${complete ? 'text-emerald-500' : 'text-stone-400'}`}>{filled}/{total}</span>
                          )}
                          {complete ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : total > 0 ? (
                            <Circle className="w-4 h-4 text-stone-300" />
                          ) : null}
                          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-5 pb-5 pt-2 border-t border-stone-100">
                        <SectionBody sectionKey={sec.key} v={v} u={u} profile={profile} setProfile={setProfile} />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
            {/* Submit Profile button */}
            {!profileApproved && !profileSubmitted && (
              <div className="text-center pt-4">
                <Button
                  onClick={() => {
                    if (overallCompletion < 100) {
                      setShowIncompleteWarning(true)
                    } else {
                      setShowSubmitModal(true)
                    }
                  }}
                  className="gap-2 px-8 py-3 text-base rounded-xl"
                  style={{ backgroundColor: overallCompletion === 100 ? '#D4A853' : '#1A3638', color: '#fff' }}
                >
                  <Send className="w-4 h-4" /> Submit Profile for Review
                </Button>
              </div>
            )}

          </>
        )}

        {/* ── 100% Complete Submit Modal ── */}
        <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
          <DialogContent className="max-w-md">
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-blue-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-[#1A3638]">This is great! Your profile is 100% Complete!</h2>
              <p className="text-stone-600">Please submit your profile for review so our team can start matching you with intended parents.</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </Button>
                <Button variant="outline" className="border-[#1A3638] text-[#1A3638]" onClick={() => { setShowSubmitModal(false); openPreview() }}>
                  <Eye className="w-4 h-4 mr-1.5" /> Preview
                </Button>
                <Button
                  onClick={handleSubmitForReview}
                  disabled={submitting}
                  style={{ backgroundColor: '#D4A853', color: '#fff' }}
                  className="gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit for Review
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Incomplete Warning Modal ── */}
        <Dialog open={showIncompleteWarning} onOpenChange={setShowIncompleteWarning}>
          <DialogContent className="max-w-md">
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-stone-800">Profile Not Complete</h2>
              <p className="text-stone-600">Your profile is <strong>{overallCompletion}%</strong> complete. Please answer all the sections so your profile is fully complete before submitting.</p>
              <div className="space-y-1.5 text-left max-h-40 overflow-y-auto">
                {SECTION_META.map(sec => {
                  const { complete, filled, total } = countCompleted(profile, sec.key)
                  if (total === 0 || complete) return null
                  return (
                    <div key={sec.key} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-red-50">
                      <span className="text-stone-700">{sec.title}</span>
                      <span className="text-red-500 font-medium">{filled}/{total}</span>
                    </div>
                  )
                })}
              </div>
              <Button onClick={() => setShowIncompleteWarning(false)} className="w-full" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
                Got it — I'll complete my profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── First-Visit Welcome Modal ── */}
        <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
          <DialogContent className="max-w-md">
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-blue-100 flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8 text-[#1A3638]" />
              </div>
              <h2 className="text-xl font-bold text-[#1A3638]">Welcome to Your Profile!</h2>
              <p className="text-stone-600 leading-relaxed">
                This profile may be shared with prospective Intended Parents. Please be sure to add photos to your gallery that represent you and your family.
              </p>
              <p className="text-stone-600 leading-relaxed">
                Once you have completed every section, be sure to click <strong>"Submit Profile for Review."</strong>
              </p>
              <Button onClick={() => setShowWelcomeModal(false)} className="w-full gap-1.5" style={{ backgroundColor: '#D4A853', color: '#fff' }}>
                Got it — Let's go!
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Profile Preview — shows what IPs will see
// ─────────────────────────────────────────────────────────
// Context for hidden fields in profile preview
const HiddenFieldsContext = createContext([])

// Editorial section with big pink serif number + title in a pink-tinted strip
function PVSection({ title, icon: Icon, number, children }) {
  return (
    <div>
      {/* Magazine-style header: big pink number + serif title. Keep header + first card together. */}
      <div className="flex items-baseline gap-4 mb-4 pb-3 border-b-2 border-[#D4A853]/20 print:break-after-avoid">
        {number && (
          <span className="text-4xl font-heading font-black text-[#D4A853]/60 leading-none tabular-nums">
            {String(number).padStart(2, '0')}
          </span>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-[#D4A853] shrink-0" />}
          <h3 className="text-xl font-heading font-black text-[#1A3638] tracking-tight leading-tight">{title}</h3>
        </div>
      </div>
      {/* Content area — sections CAN split across pages, but individual cards (below) cannot */}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// Bordered Q&A card with warm stone background
function PVField({ label, value, className = '', fp }) {
  const hiddenFields = useContext(HiddenFieldsContext)
  if (fp && hiddenFields.includes(fp)) return null
  if (!value && value !== 0) return null
  return (
    <div className={`bg-white rounded-lg border border-stone-200 px-4 py-3 print:break-inside-avoid ${className}`}>
      <p className="text-[13px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-[15px] text-stone-800 leading-relaxed">{value}</p>
    </div>
  )
}

// Yes/No with subtle tinted background + bold colored answer (no dot)
function PVYesNo({ label, value, fp }) {
  const hiddenFields = useContext(HiddenFieldsContext)
  if (fp && hiddenFields.includes(fp)) return null
  const displayVal = value === 'yes' || value === 'Yes' ? 'Yes' : value === 'no' || value === 'No' ? 'No' : value || '—'
  const isYes = displayVal === 'Yes'
  const isNo = displayVal === 'No'
  const bg = isYes ? 'bg-emerald-50/60 border-emerald-200/70'
    : isNo ? 'bg-rose-50/60 border-rose-200/70'
    : 'bg-white border-stone-200'
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 print:break-inside-avoid ${bg}`}>
      <span className="text-[13px] text-stone-700 flex-1 leading-snug">{label}</span>
      <span className={`text-[12px] font-bold shrink-0 ${isYes ? 'text-emerald-600' : isNo ? 'text-rose-500' : 'text-stone-400'}`}>{displayVal}</span>
    </div>
  )
}

// 2-column grid wrapper for mixed-width layouts
function PVGrid({ children, cols = 2 }) {
  const colsClass = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return <div className={`grid grid-cols-1 ${colsClass} gap-2`}>{children}</div>
}

// Beautiful pregnancy card — shows ALL captured details with the surrogate's exact question labels
function PregnancyCard({ pregnancy: pr, index }) {
  if (!pr) return null
  const num = index + 1
  const isLive = pr.outcome === 'Live Birth'
  const isLoss = pr.outcome === 'Miscarriage' || pr.outcome === 'Termination' || pr.outcome === 'Ectopic Pregnancy'
  const isStillborn = pr.outcome === 'Stillborn'
  // Miscarriage/Termination: show only a compact header; fold additional details inline
  const headerOnly = pr.outcome === 'Miscarriage' || pr.outcome === 'Termination'

  // Build baby summary for Live Birth
  const babies = []
  if (isLive) {
    const isMultiples = pr.singleOrMultiples === 'Twins' || pr.singleOrMultiples === 'Triplets+'
    if (pr.name || pr.sex || pr.weight) babies.push({ label: isMultiples ? 'Baby A' : '', name: pr.name, sex: pr.sex, weight: pr.weight, length: pr.length, deliveryType: pr.deliveryType })
    if (pr.babyBName || pr.babyBSex || pr.babyBWeight) babies.push({ label: 'Baby B', name: pr.babyBName, sex: pr.babyBSex, weight: pr.babyBWeight, length: pr.babyBLength, deliveryType: pr.babyBDeliveryType })
    if (pr.babyCName || pr.babyCSex || pr.babyCWeight) babies.push({ label: 'Baby C', name: pr.babyCName, sex: pr.babyCSex, weight: pr.babyCWeight, length: pr.babyCLength, deliveryType: pr.babyCDeliveryType })
  }

  const complications = (pr.complicationsList || []).filter(c => c !== 'None of the above')
  const hasNoneSelected = (pr.complicationsList || []).includes('None of the above')
  const gestation = pr.gestationWeeks ? `${pr.gestationWeeks}w${pr.gestationDays ? ' ' + pr.gestationDays + 'd' : ''}` : null

  const outcomeColor = isLive ? 'bg-emerald-100 text-emerald-700'
    : isStillborn ? 'bg-stone-200 text-stone-700'
    : isLoss ? 'bg-amber-100 text-amber-700'
    : 'bg-stone-100 text-stone-600'

  return (
    <div className={`bg-white rounded-xl border border-stone-200 overflow-hidden print:break-inside-avoid`}>
      {/* Header strip */}
      <div className={`flex items-start gap-3 px-5 py-3 bg-gradient-to-r from-[#1A3638]/5 to-transparent ${headerOnly ? '' : 'border-b border-stone-100'}`}>
        <div className="w-9 h-9 rounded-full bg-[#1A3638] text-white flex items-center justify-center font-heading font-black text-sm shrink-0">P{num}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {pr.outcome && <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${outcomeColor}`}>{pr.outcome}</span>}
            {pr.wasSurrogacy === 'yes' && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D4A853]/10 text-[#D4A853]">Surrogacy</span>}
            {gestation && <span className="text-xs font-semibold text-[#1A3638]">{gestation}</span>}
            {pr.dob && (() => {
              const dob = new Date(pr.dob + 'T00:00')
              const dateStr = dob.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
              // Calculate child's age (only for non-surrogacy live births)
              let ageStr = ''
              if (isLive && pr.wasSurrogacy !== 'yes') {
                const today = new Date()
                let age = today.getFullYear() - dob.getFullYear()
                const m = today.getMonth() - dob.getMonth()
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
                if (age >= 0) ageStr = ` · ${age} ${age === 1 ? 'yr' : 'yrs'} old`
              }
              return <span className="text-xs text-stone-400">· {dateStr}{ageStr}</span>
            })()}
          </div>
          {headerOnly && (pr.deliveryType || pr.name || pr.complications) && (
            <div className="mt-1.5 space-y-0.5">
              {pr.deliveryType && (
                <p className="text-[12px] text-stone-600 leading-relaxed">
                  <span className="text-stone-400">Delivery Type: </span>{pr.deliveryType}
                </p>
              )}
              {pr.name && (
                <p className="text-[12px] text-stone-600 leading-relaxed">
                  <span className="text-stone-400">Notes: </span>{pr.name}
                </p>
              )}
              {pr.complications && (
                <p className="text-[12px] text-stone-600 leading-relaxed">
                  <span className="text-stone-400">Additional details about this pregnancy: </span>{pr.complications}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Birth: Baby cards */}
      {isLive && babies.length > 0 && (
        <div className={`grid ${babies.length > 1 ? 'sm:grid-cols-2' : ''} gap-0 border-b border-stone-100`}>
          {babies.map((baby, bi) => (
            <div key={bi} className={`p-4 ${bi > 0 ? 'sm:border-l border-stone-100' : ''}`}>
              {baby.label && <p className="text-[10px] font-bold text-[#D4A853] uppercase tracking-widest mb-1">{baby.label}</p>}
              <div className="flex items-baseline gap-2 flex-wrap">
                {baby.name && <p className="text-base font-heading font-bold text-[#1A3638]">{baby.name}</p>}
                {baby.sex && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${baby.sex === 'Male' || baby.sex === 'Boy' ? 'bg-blue-50 text-blue-600' : baby.sex === 'Female' || baby.sex === 'Girl' ? 'bg-pink-50 text-pink-600' : 'bg-stone-50 text-stone-500'}`}>{baby.sex}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-stone-500">
                {baby.weight && <span className="font-semibold text-stone-700">{baby.weight}</span>}
                {baby.length && <span><span className="font-semibold text-stone-700">{baby.length}"</span> long</span>}
                {baby.deliveryType && <span>{baby.deliveryType}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail rows using FULL question labels */}
      {!headerOnly && (
      <div className="divide-y divide-stone-100">
        {pr.wasSurrogacy === 'yes' && pr.transfersUntilPregnant && <PCRow label="How many embryo transfers did it take until pregnancy was achieved?" value={pr.transfersUntilPregnant} />}
        {pr.wasSurrogacy !== 'yes' && pr.cyclesToConceive && <PCRow label="About how many months did it take you to get pregnant?" value={pr.cyclesToConceive} />}
        {(isLoss || isStillborn) && pr.deliveryType && <PCRow label="Delivery / Procedure Type" value={pr.deliveryType} />}

        {/* Complications */}
        {(complications.length > 0 || hasNoneSelected) && (
          <div className="px-5 py-3">
            <p className="text-[11px] font-semibold text-stone-500 mb-2">Pregnancy complications</p>
            {complications.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {complications.map(c => (
                  <span key={c} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">{c}</span>
                ))}
              </div>
            ) : (
              <span className="text-[12px] text-emerald-600 font-semibold">None reported</span>
            )}
            {pr.complicationsExplanation && (
              <p className="text-[13px] text-stone-700 mt-2 leading-relaxed">{pr.complicationsExplanation}</p>
            )}
          </div>
        )}

        {/* Additional details */}
        {pr.complications && (
          <div className="px-5 py-3">
            <p className="text-[11px] font-semibold text-stone-500 mb-1">Additional details about this pregnancy</p>
            <p className="text-[13px] text-stone-700 leading-relaxed">{pr.complications}</p>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function PCRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-3 px-5 py-2.5">
      <span className="text-[12px] text-stone-500 flex-1 leading-snug">{label}</span>
      <span className="text-[13px] font-semibold text-stone-800 shrink-0 max-w-[50%] text-right">{value}</span>
    </div>
  )
}

export function ProfilePreview({ profile, photos, hideFooter = false, insuranceStatus }) {
  const hiddenFields = Array.isArray(profile?._hiddenFields) ? profile._hiddenFields : []
  const p = profile?.personal || profile?.about || {}
  const family = profile?.family || {}
  const about = { ...p, ...family }
  const fertility = profile?.fertility || {}
  const general = profile?.general || profile?.lifestyle || {}
  const health = profile?.health || {}
  const employment = profile?.employment || {}
  const interests = profile?.interests || {}
  const academic = profile?.academic || {}
  const expSurr = profile?.experiencedSurrogate || {}
  const hopes = profile?.hopesWishes || profile?.preferences || {}
  const pregHistory = profile?.pregnancyHistory || {}
  const pregnancies = pregHistory?.pregnancies || []

  const firstName = about.firstName || 'Your Name'
  const heightStr = about.heightFt ? `${about.heightFt}'${about.heightIn || 0}"` : ''
  const bmi = about.bmi || (about.heightFt && about.weight ? ((parseFloat(about.weight) / ((parseInt(about.heightFt)*12 + parseInt(about.heightIn||0)) ** 2)) * 703).toFixed(1) : '')
  const [lightboxIdx, setLightboxIdx] = useState(null)
  // When the caller passes raw photos (both `original_*` and `cropped_*`), the
  // hero/banner uses the cropped version (admins crop specifically for the
  // banner) while the thumbnail strip + lightbox show the originals so
  // viewers see the full un-cropped image at its native aspect. If only one
  // version is present (legacy / no crop yet), it gets used in both spots.
  const allPhotos = photos || []
  const headshotCropped = allPhotos.find(p => p.kind === 'cropped' && p.path?.includes('/headshot/'))
  const headshotOriginal = allPhotos.find(p => p.kind === 'original' && p.path?.includes('/headshot/'))
  const portraitCropped = allPhotos.find(p => p.kind === 'cropped' && p.path?.includes('/portrait/'))
  const portraitOriginal = allPhotos.find(p => p.kind === 'original' && p.path?.includes('/portrait/'))
  const heroPhoto = headshotCropped || headshotOriginal || allPhotos[0]
  const portraitPhoto = portraitCropped || portraitOriginal || allPhotos.find(p => p.path?.includes('/portrait/'))
  // Gallery (thumbnails + lightbox) — show un-cropped versions. Drop any
  // cropped_* entries so the squat banner crop doesn't appear as a separate
  // thumbnail; viewers click the cover thumbnail and see the full original.
  const galleryPhotos = allPhotos.filter(p => p.kind !== 'cropped')
  const hasPartner = ['In a Relationship', 'Married', 'Domestic Partnership'].includes(about.maritalStatus)
  const householdMembers = about.householdMembers || []
  const parseStepchildDob = (raw) => {
    if (!raw) return null
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/').map(Number)
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date
      return null
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const date = new Date(`${raw}T00:00:00`)
      return Number.isNaN(date.getTime()) ? null : date
    }
    return null
  }
  const getStepchildAge = (rawDob) => {
    const dob = parseStepchildDob(rawDob)
    if (!dob) return ''
    const today = new Date()
    let years = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) years--
    return years >= 0 ? String(years) : ''
  }
  const formatCurrency = (value) => {
    const digits = String(value || '').replace(/[^0-9]/g, '')
    if (!digits) return ''
    return `$${Number(digits).toLocaleString('en-US')}`
  }

  const age = (() => {
    if (!about.dob) return null
    const birth = new Date(about.dob)
    const today = new Date()
    let a = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--
    return a > 0 ? a : null
  })()

  return (
    <HiddenFieldsContext.Provider value={hiddenFields}>
    <div className="bg-[#fdf8f3] min-h-full print:bg-white">
      {/* ── Hero Section — cover photo + overlapping portrait + overlapping name card ── */}
      <div className="relative print:break-inside-avoid">
        {/* Cover photo (hidden on print to give more space to content) */}
        <div data-pdf="cover" className="relative overflow-hidden">
          {heroPhoto ? (
            <img src={heroPhoto.url} alt="" className="w-full h-72 sm:h-80 object-cover object-top" />
          ) : (
            <div className="w-full h-72 sm:h-80 bg-gradient-to-br from-[#D4A853]/20 via-[#fce7f0] to-[#1A3638]/10 flex items-center justify-center">
              <Camera className="w-12 h-12 text-white/70" />
            </div>
          )}
          {/* Subtle bottom gradient for name card legibility */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#fdf8f3] to-transparent" />
          {galleryPhotos.length > 1 && (
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-[#1A3638] text-xs font-bold px-3 py-1 rounded-full print:hidden">
              {galleryPhotos.length} photos
            </div>
          )}
        </div>

        {/* Overlapping portrait + name card row — pulled up into the cover */}
        <div className="relative -mt-20 sm:-mt-24 px-8 sm:px-12 print:px-10 print:-mt-16">
          <div className="flex flex-col sm:flex-row items-end gap-5">
            {/* Portrait — square rounded, white border, shadow */}
            {portraitPhoto ? (
              <img data-pdf="portrait" src={portraitPhoto.url} alt=""
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl object-cover border-4 border-white shadow-xl shadow-[#88C0C4]/40 shrink-0 print:shadow-none"
              />
            ) : (
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-white border-4 border-white shadow-xl flex items-center justify-center shrink-0">
                <Camera className="w-10 h-10 text-stone-300" />
              </div>
            )}

            {/* Name card — overlaps cover image from bottom */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg shadow-[#1A3638]/10 border border-stone-100 px-6 py-5 print:shadow-none">
              <p className="text-xs font-bold text-[#D4A853] uppercase tracking-[0.25em] mb-1">Hi there, I'm</p>
              <h1 className="text-3xl sm:text-4xl font-heading font-black text-[#1A3638] leading-tight tracking-tight">
                {firstName}.
              </h1>
              {(about.city || about.state) && (
                <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D4A853]" />
                  {[about.city, about.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats byline + compensation row — below name card */}
        <div className="px-8 sm:px-12 pt-6 pb-2 print:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[#1A3638]">
            {age && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black leading-none">{age}</span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">yrs</span>
              </div>
            )}
            {heightStr && (
              <><span className="h-6 w-px bg-stone-300" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black leading-none">{heightStr}</span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">ht</span>
              </div></>
            )}
            {about.weight && (
              <><span className="h-6 w-px bg-stone-300" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black leading-none">{about.weight}</span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">lbs</span>
              </div></>
            )}
            {bmi && (
              <><span className="h-6 w-px bg-stone-300" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black leading-none">{bmi}</span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">bmi</span>
              </div></>
            )}
            {about.maritalStatus && (
              <><span className="h-6 w-px bg-stone-300" />
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-[#D4A853]" fill="currentColor" />
                <span className="text-base font-heading font-bold">{about.maritalStatus}</span>
              </div></>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#D4A853] font-bold">Base Fee</span>
              <span className="text-2xl font-heading font-black text-[#1A3638] leading-none">{formatCurrency(hopes.desiredCompensation) || '—'}</span>
            </div>
            {(() => {
              const isVerified = insuranceStatus === 'active_policy' || insuranceStatus === 'verified_open_enrollment' || insuranceStatus === 'complete'
              const isVerifying = insuranceStatus === 'policy_check'
              const config = isVerified
                ? { Icon: ShieldCheck, color: 'text-emerald-600', label: 'Verified' }
                : isVerifying
                ? { Icon: ShieldIcon, color: 'text-amber-500', label: 'Verifying' }
                : { Icon: ShieldX, color: 'text-rose-500', label: 'Needs Policy' }
              const { Icon, color, label } = config
              return (
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className={`text-sm font-bold ${color}`}>{label}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-semibold ml-1">Insurance</span>
                </div>
              )
            })()}
            {Array.isArray(interests?.qualities) && interests.qualities.length > 0 && !hiddenFields.includes('interests.qualities') && (
              <div className="flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-emerald-500" fill="currentColor" />
                <span className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
                  {interests.qualities.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Thumbnail Strip (hidden in print) — fixed height, variable
          width so each thumbnail preserves its native aspect instead of
          being squashed to a square. */}
      {galleryPhotos?.length > 1 && (
        <div data-pdf="thumbs" className="flex gap-2 px-8 sm:px-12 pt-4 pb-2 overflow-x-auto print:hidden">
          {galleryPhotos.map((ph, i) => (
            <button key={ph.path} onClick={() => setLightboxIdx(i)}
              className="h-16 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 hover:scale-105 transition-all ring-1 ring-stone-200">
              <img src={ph.url} alt="" className="h-full w-auto block" />
            </button>
          ))}
        </div>
      )}

      {/* ── All Sections ── */}
      <div className="px-8 sm:px-12 py-6 space-y-6 print:px-10">

        {/* Personal Information */}
        <PVSection title="Personal" icon={User} number={1}>
          <PVYesNo label="Are you a U.S. Citizen or Permanent Resident?" value={about.usCitizen} fp="personal.usCitizen" />
          <PVGrid cols={2}>
            <PVField label="Current Marital/Relationship Status" value={about.maritalStatus} fp="personal.maritalStatus" />
            <PVField label="How many sexual partners in past 6 months" value={about.sexualPartners} fp="personal.sexualPartners" />
          </PVGrid>
          {hasPartner && <PVYesNo label="Are you currently in a monogamous relationship?" value={about.monogamous} fp="personal.monogamous" />}
          {hasPartner && (
            <PVGrid cols={2}>
              <PVField label="How long have you been together?" value={about.relationshipLength} fp="personal.relationshipLength" />
              <PVField label="First name of your spouse or partner" value={about.partnerName} fp="personal.partnerName" />
              <PVField label="Spouse/Partner's Date of Birth" value={about.partnerDob} fp="personal.partnerDob" />
            </PVGrid>
          )}
          {hasPartner && <PVYesNo label="Is your Spouse/Partner a U.S. Citizen or Permanent Resident?" value={about.partnerUsCitizen} fp="personal.partnerUsCitizen" />}
          {householdMembers.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Household</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {householdMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-[#fdf8f3] rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-800">{m.name || '—'}</span>
                    {m.relationship && (
                      <span className="text-[11px] text-gray-400">
                        ({m.relationship}{['Stepson', 'Stepdaughter'].includes(m.relationship) && getStepchildAge(m.stepchildDob) ? ` - ${getStepchildAge(m.stepchildDob)} yrs old` : ''})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </PVSection>

        {/* Pregnancy History */}
        <PVSection title="Pregnancy History" icon={Baby} number={2}>
          {pregnancies.length > 0 && (
            <div className="mt-4 space-y-4">
              {pregnancies.map((pr, i) => (
                <PregnancyCard key={i} pregnancy={pr} index={i} />
              ))}
            </div>
          )}
        </PVSection>

        {/* Fertility */}
        <PVSection title="Fertility Information" icon={Stethoscope} number={3}>
          <div className="space-y-1">
            <PVYesNo label="Are you currently breastfeeding?" value={fertility.breastfeeding} fp="fertility.breastfeeding" />
            {fertility.breastfeeding === 'yes' && fertility.breastfeedingAdminNotes && <PVField label="Details" value={fertility.breastfeedingAdminNotes} fp="fertility.breastfeedingAdminNotes" />}
            <PVYesNo label="Is the biological father the same for all of your biological children?" value={fertility.sameBioFather} fp="fertility.sameBioFather" />
            {fertility.sameBioFather === 'no' && <PVField label="Please explain" value={fertility.sameBioFatherDetails} fp="fertility.sameBioFatherDetails" />}
            <PVYesNo label="Have you ever been seen by a doctor for infertility treatment?" value={fertility.infertilityTreatment} fp="fertility.infertilityTreatment" />
            {fertility.infertilityTreatment === 'yes' && <PVField label="Please provide details" value={fertility.infertilityTreatmentDetails} fp="fertility.infertilityTreatmentDetails" />}
            <PVYesNo label="Have you ever been diagnosed with any gynecological issues (such as endometriosis, ovarian cysts, fibroids, abnormal pap smears, etc.)?" value={fertility.gynecologicalProblems} fp="fertility.gynecologicalProblems" />
            {fertility.gynecologicalProblems === 'yes' && <PVField label="Please provide details" value={fertility.gynecologicalProblemsDetails} fp="fertility.gynecologicalProblemsDetails" />}
            <PVYesNo label="Did you ever take medication (aside from prenatals) during pregnancy?" value={fertility.pregnancyMedication} fp="fertility.pregnancyMedication" />
            {fertility.pregnancyMedication === 'yes' && <PVField label="Please list medications" value={fertility.pregnancyMedicationList} fp="fertility.pregnancyMedicationList" />}
            <PVField label="Which contraceptive method do you currently use?" value={fertility.contraceptiveMethod} fp="fertility.contraceptiveMethod" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50">
            <PVField label="We want to hear all the details about your pregnancy(s). Be sure to describe in detail about any complications you experienced. Please share the ups and downs." value={fertility.pregnancyDetails} fp="fertility.pregnancyDetails" />
          </div>
        </PVSection>

        {/* General Information */}
        <PVSection title="General Information" icon={Home} number={4}>
          <PVGrid cols={2}>
            <PVField label="Do you own or rent your home?" value={general.homeOwnership} fp="general.homeOwnership" />
            <PVField label="How long have you lived in your current home?" value={general.homeDuration} fp="general.homeDuration" />
          </PVGrid>
          <div className="space-y-2">
            <PVYesNo label="Do your children live with you full time?" value={general.childrenFullTime} fp="general.childrenFullTime" />
            {general.childrenFullTime === 'no' && general.childrenFullTimeDetails && <PVField label="Please explain" value={general.childrenFullTimeDetails} fp="general.childrenFullTimeDetails" />}
            <PVField label="If you are divorced or separated from the other parent(s) of your child(ren), please describe this relationship" value={general.divorcedRelationship} fp="general.divorcedRelationship" />
            <PVYesNo label="Do any of your children have special needs or medical conditions?" value={general.childrenSpecialNeeds} fp="general.childrenSpecialNeeds" />
            {general.childrenSpecialNeeds === 'yes' && general.childrenSpecialNeedsDetails && <PVField label="Please explain" value={general.childrenSpecialNeedsDetails} fp="general.childrenSpecialNeedsDetails" />}
            <PVYesNo label="Do you plan to have any more children of your own?" value={general.planMoreChildren} fp="general.planMoreChildren" />
            {general.planMoreChildren === 'yes' && general.planMoreChildrenDetails && <PVField label="Please share your thoughts" value={general.planMoreChildrenDetails} fp="general.planMoreChildrenDetails" />}
            <PVYesNo label="Do you have any piercings or tattoos?" value={general.piercingsTattoos} fp="general.piercingsTattoos" />
            <PVYesNo label="Have you or anyone in your household ever been arrested or convicted?" value={general.criminalHistory} fp="general.criminalHistory" />
            {general.criminalHistory === 'yes' && general.criminalHistoryDetails && <PVField label="Please explain" value={general.criminalHistoryDetails} fp="general.criminalHistoryDetails" />}
            <PVYesNo label="Do you plan on traveling within or outside of the U.S. in the next 6 months?" value={general.travelPlans} fp="general.travelPlans" />
            {general.travelPlans === 'yes' && general.travelPlansDetails && <PVField label="Please explain" value={general.travelPlansDetails} fp="general.travelPlansDetails" />}
            <PVYesNo label="Do you have a reliable vehicle to drive?" value={general.reliableVehicle} fp="general.reliableVehicle" />
            <PVYesNo label="Do you currently smoke or vape?" value={general.smokeVape} fp="general.smokeVape" />
            <PVYesNo label="Do you have a history of smoking in the past?" value={general.smokingHistory} fp="general.smokingHistory" />
            {general.smokingHistory === 'yes' && general.smokingHistoryDetails && <PVField label="For how long and when did you quit?" value={general.smokingHistoryDetails} fp="general.smokingHistoryDetails" />}
            <PVYesNo label="Does anyone else in your household currently smoke or vape?" value={general.householdSmoker} fp="general.householdSmoker" />
            {general.householdSmoker === 'yes' && general.householdSmokerDetails && <PVField label="Please provide details (who, how often, where and what)" value={general.householdSmokerDetails} fp="general.householdSmokerDetails" />}
            <PVYesNo label="Do you drink alcohol or use recreational drugs?" value={general.alcoholDrugs} fp="general.alcoholDrugs" />
            {general.alcoholDrugs === 'yes' && general.alcoholDrugsDetails && <PVField label="Please list frequency and type" value={general.alcoholDrugsDetails} fp="general.alcoholDrugsDetails" />}
            <PVYesNo label="Are there any guns in your home?" value={general.gunsInHome} fp="general.gunsInHome" />
            {general.gunsInHome === 'yes' && general.gunsInHomeAdminNotes && <PVField label="Details" value={general.gunsInHomeAdminNotes} fp="general.gunsInHomeAdminNotes" />}
            <PVYesNo label="Have you ever been advised to limit your use of alcohol or any drugs?" value={general.advisedLimitSubstances} fp="general.advisedLimitSubstances" />
            {general.advisedLimitSubstances === 'yes' && general.advisedLimitDetails && <PVField label="Please provide details" value={general.advisedLimitDetails} fp="general.advisedLimitDetails" />}
            <PVYesNo label="Does anyone in your household drink alcohol, use controlled substances or recreational drugs?" value={general.householdControlledSubstances} fp="general.householdControlledSubstances" />
            {general.householdControlledSubstances === 'yes' && general.householdSubstancesDetails && <PVField label="What, how often, and when/where?" value={general.householdSubstancesDetails} fp="general.householdSubstancesDetails" />}
            {general.religiousBackground && <PVField label="What is your religious background or faith tradition, if any?" value={general.religiousBackground} fp="general.religiousBackground" />}
            {general.comfortableDifferentReligion && <PVField label="Are you comfortable supporting Intended Parents regardless of their religious beliefs or background?" value={general.comfortableDifferentReligion} fp="general.comfortableDifferentReligion" />}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
            <PVField label="Please describe your typical diet and eating habits. Do you cook at home? How often do you eat out? Do you have any special dietary restrictions?" value={general.typicalDiet} fp="general.typicalDiet" />
            <PVField label="List the forms and frequency of regular exercise" value={general.exerciseFrequency} fp="general.exerciseFrequency" />
          </div>
        </PVSection>

        {/* Health */}
        <PVSection title="Health Information" icon={HeartPulse} number={5}>
          <div className="space-y-1">
            <PVYesNo label="Have you ever been formally or informally diagnosed with any mental health challenge (e.g. depression, anxiety, bipolar disorder, postpartum depression)?" value={health.mentalHealthDiagnosis} fp="health.mentalHealthDiagnosis" />
            {health.mentalHealthDiagnosis === 'yes' && health.mentalHealthDetails && <PVField label="Please provide details" value={health.mentalHealthDetails} fp="health.mentalHealthDetails" />}
            <PVYesNo label="Have you ever been hospitalized for a mental health challenge?" value={health.mentalHealthHospitalization} fp="health.mentalHealthHospitalization" />
            {health.mentalHealthHospitalization === 'yes' && health.mentalHealthHospDetails && <PVField label="Please provide details" value={health.mentalHealthHospDetails} fp="health.mentalHealthHospDetails" />}
            <PVYesNo label="Do you currently or have you ever taken medication for a mental health challenge?" value={health.mentalHealthMedication} fp="health.mentalHealthMedication" />
            {health.mentalHealthMedication === 'yes' && health.mentalHealthMedDetails && <PVField label="Please list dates and medication type" value={health.mentalHealthMedDetails} fp="health.mentalHealthMedDetails" />}
            <PVYesNo label="Are you currently or have you ever participated in counseling or psychotherapy?" value={health.counselingTherapy} fp="health.counselingTherapy" />
            {health.counselingTherapy === 'yes' && health.counselingDetails && <PVField label="Please provide details" value={health.counselingDetails} fp="health.counselingDetails" />}
            <PVYesNo label="Has anyone in your family ever had a mental health challenge such as depression, anxiety, alcoholism or drug abuse?" value={health.familyMentalHealth} fp="health.familyMentalHealth" />
            {health.familyMentalHealth === 'yes' && health.familyMentalHealthDetails && <PVField label="Please explain" value={health.familyMentalHealthDetails} fp="health.familyMentalHealthDetails" />}
            <PVYesNo label="Were you ever involved in a relationship where you experienced domestic violence?" value={health.domesticViolence} fp="health.domesticViolence" />
            {health.domesticViolence === 'yes' && health.domesticViolenceDetails && <PVField label="Please explain" value={health.domesticViolenceDetails} fp="health.domesticViolenceDetails" />}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
            <PVField label="Do you currently have any allergies?" value={health.allergies} fp="health.allergies" />
            <PVField label="Do you currently have any medical conditions we should be made aware of?" value={health.medicalConditions} fp="health.medicalConditions" />
            <PVField label="Hospitalization/surgery history over past 5 years. Please list surgery and year." value={health.surgeries} fp="health.surgeries" />
          </div>
          {health.diseaseHistory && Array.isArray(health.diseaseHistory) && health.diseaseHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <PVField label="Health conditions history" value={health.diseaseHistory.join(', ')} fp="health.diseaseHistory" />
              {health.diseaseHistoryDetails && <PVField label="Please explain any checked conditions" value={health.diseaseHistoryDetails} fp="health.diseaseHistoryDetails" />}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
            <PVField label="Non-prescription medication use (such as Tylenol, Advil, allergy/cold medication, etc.)" value={health.nonPrescriptionMeds} fp="health.nonPrescriptionMeds" />
            <PVField label="Prescription medications taken in the past 5 years, their purpose and dates of use" value={health.prescriptionMeds} fp="health.prescriptionMeds" />
            <PVField label="Current medications and supplements" value={health.currentMeds} fp="health.currentMeds" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
            <PVYesNo label="Are you open to vaccinations if recommended by the clinic?" value={health.openToVaccinations} fp="health.openToVaccinations" />
            {health.openToVaccinations === 'no' && health.vaccinesNotWilling && (
              <PVField label="Vaccines not willing to receive" value={health.vaccinesNotWilling} fp="health.vaccinesNotWilling" />
            )}
            <PVField label="When was your most recent Pap test completed and results?" value={health.lastPap} fp="health.lastPap" />
          </div>
        </PVSection>

        {/* Employment */}
        <PVSection title="Employment" icon={Briefcase} number={6}>
          <PVYesNo label="Are you currently employed?" value={employment.currentlyEmployed} fp="employment.currentlyEmployed" />
          {employment.currentlyEmployed === 'yes' && (
            <>
              <PVField label="Please share details on the industry you work in." value={employment.employmentIndustry} fp="employment.employmentIndustry" />
              <PVGrid cols={2}>
                <PVField label="Occupation / position" value={employment.occupation} fp="employment.occupation" />
                <PVField label="Hours per week" value={employment.workHours} fp="employment.workHours" />
                <PVField label="Length at current employer" value={employment.lengthAtEmployer} fp="employment.lengthAtEmployer" />
                <PVField label="Hourly rate" value={employment.hourlyRate} fp="employment.hourlyRate" />
                <PVField label="Weekly income" value={employment.weeklyIncome} fp="employment.weeklyIncome" />
              </PVGrid>
            </>
          )}
          {hasPartner && (
            <>
              <PVYesNo label="Is your spouse/partner employed?" value={employment.partnerEmployed} fp="employment.partnerEmployed" />
              {employment.partnerEmployed === 'yes' && (
                <>
                  <PVField label="Spouse/partner's occupation" value={employment.partnerOccupation} fp="employment.partnerOccupation" />
                  <PVField label="Hours/days spouse or partner works each week" value={employment.partnerWorkHours} fp="employment.partnerWorkHours" />
                  <PVField label="Spouse/partner's weekly income" value={employment.partnerWeeklyIncome} fp="employment.partnerWeeklyIncome" />
                </>
              )}
            </>
          )}
          <PVYesNo label="Do you receive any government assistance (WIC, food stamps)?" value={employment.governmentAssistance} fp="employment.governmentAssistance" />
          {employment.governmentAssistance === 'yes' && employment.governmentAssistanceDetails && <PVField label="Please explain" value={employment.governmentAssistanceDetails} fp="employment.governmentAssistanceDetails" />}
          <PVYesNo label="Do you currently have health insurance?" value={employment.healthInsurance} fp="employment.healthInsurance" />
          {employment.healthInsurance === 'yes' && employment.insuranceType && <PVField label="What type of health insurance?" value={employment.insuranceType} fp="employment.insuranceType" />}
        </PVSection>

        {/* Education */}
        <PVSection title="Education" icon={Apple} number={7}>
          <PVField label="Highest level of education" value={academic.educationLevel} fp="academic.educationLevel" />
          <PVYesNo label="Are you currently enrolled in school?" value={academic.currentlyInSchool} fp="academic.currentlyInSchool" />
          {academic.currentlyInSchool === 'yes' && academic.currentlyInSchoolDetails && <PVField label="Please provide details" value={academic.currentlyInSchoolDetails} fp="academic.currentlyInSchoolDetails" />}
        </PVSection>

        {/* Interests */}
        <PVSection title="Interests & Personality" icon={Heart} number={8}>
          <PVGrid cols={3}>
            <PVField label="Favorite music" value={interests.favoriteMusic} fp="interests.favoriteMusic" />
            <PVField label="Favorite movie" value={interests.favoriteMovie} fp="interests.favoriteMovie" />
            <PVField label="Favorite book" value={interests.favoriteBook} fp="interests.favoriteBook" />
            <PVField label="Favorite foods" value={interests.favoriteFoods} fp="interests.favoriteFoods" />
            <PVField label="Favorite color" value={interests.favoriteColor} fp="interests.favoriteColor" />
            <PVField label="Favorite flower" value={interests.favoriteFlower} fp="interests.favoriteFlower" />
          </PVGrid>
          <PVGrid cols={2}>
            <PVField label="Do you have any pets, including chickens and livestock?" value={interests.pets} fp="interests.pets" />
            <PVField label="If you have cats, who changes the litter box?" value={interests.catLitter} fp="interests.catLitter" />
            <PVField label="Do you collect anything special?" value={interests.collections} fp="interests.collections" />
            <PVField label="Where would you most like to travel and why?" value={interests.dreamTravel} fp="interests.dreamTravel" />
          </PVGrid>
          <PVField label="What do you like to do in your free time?" value={interests.hobbies} fp="interests.hobbies" />
          <PVField label="How would you describe yourself? Please include a description of your personality and temperament." value={interests.personality} fp="interests.personality" />
        </PVSection>

        {/* Experienced Surrogate — only show if they've been a surrogate before */}
        {expSurr.previousSurrogate === 'yes' && (
          <PVSection title="Surrogacy Experience" icon={Stethoscope} number={9}>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#D4A853]/10 text-[#D4A853] text-sm font-semibold px-4 py-1.5">
                <CheckCircle2 className="w-4 h-4" /> Experienced Surrogate — {expSurr.surrogacyTimes || '?'} time(s)
              </div>
              {normalizeJourneyList(expSurr.journeys).map((j, i) => (
                <div key={i} className="rounded-xl bg-[#fdf8f3] p-4 space-y-2">
                  <p className="text-xs font-bold text-[#1A3638] uppercase">Journey #{i + 1}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                    <PVField label="What was the name of the Reproductive Doctor?" value={j.reName} fp={`experiencedSurrogate.journeys.${i}.reName`} />
                    <PVField label="What City/State was the IVF clinic located in?" value={j.reLocation} fp={`experiencedSurrogate.journeys.${i}.reLocation`} />
                    <PVField label="What years were you seen there?" value={j.reDates} fp={`experiencedSurrogate.journeys.${i}.reDates`} />
                    <PVField label="What was the outcome of this surrogacy journey?" value={j.outcome} fp={`experiencedSurrogate.journeys.${i}.outcome`} />
                    <PVField label="Embryo source" value={Array.isArray(j.embryoSourceList) && j.embryoSourceList.length > 0 ? j.embryoSourceList.join(', ') : null} fp={`experiencedSurrogate.journeys.${i}.embryoSourceList`} />
                  </div>
                </div>
              ))}
              {expSurr.overallExperience && <PVField label="Overall Experience" value={expSurr.overallExperience} fp="experiencedSurrogate.overallExperience" />}
            </div>
          </PVSection>
        )}

        {/* Journey Hopes & Wishes */}
        <PVSection title="Journey Hopes & Wishes" icon={Heart} number={10}>
          <div className="space-y-4">
            <PVField label="Why do you want to become a surrogate (or be a repeat surrogate), and how long have you been thinking about it?" value={hopes.reasonForSurrogacy} fp="hopesWishes.reasonForSurrogacy" />
            <PVField label="How do you plan to use the money that you make from being a surrogate?" value={hopes.compensationUse} fp="hopesWishes.compensationUse" />
            <PVField label="Please explain how you see surrogacy fitting into your life" value={hopes.surrogacyFit} fp="hopesWishes.surrogacyFit" />
            <PVField label="Who will be your resource to help with your children for appointments / possible bed rest etc.?" value={hopes.supportSystem} fp="hopesWishes.supportSystem" />
          </div>
          <div className="mt-5 pt-4 border-t border-gray-50 space-y-1">
            <PVYesNo label="Are you willing to have 3 transfer attempts with the same IP if that is what it takes to achieve a pregnancy?" value={hopes.threeTransferAttempts} fp="hopesWishes.threeTransferAttempts" />
            <PVYesNo label="Are you willing to reduce the amount of caffeine and soda you consume during the pregnancy?" value={hopes.reduceCaffeine} fp="hopesWishes.reduceCaffeine" />
            <PVField label="Are you open to making other lifestyle changes at the request of the Intended Parents?" value={hopes.lifestyleChanges} fp="hopesWishes.lifestyleChanges" />
            <PVField label="Are you open to pumping colostrum and breast milk for your IP if they were to request this?" value={hopes.pumpBreastmilk} fp="hopesWishes.pumpBreastmilk" />
            <PVField label="Would you be willing to have the Intended Parents at doctor appointments and in delivery room?" value={hopes.ipsAtAppointments} fp="hopesWishes.ipsAtAppointments" />
            {hopes.ipsAtAppointments === 'No' && hopes.ipsAtAppointmentsDetails && <PVField label="Please explain" value={hopes.ipsAtAppointmentsDetails} fp="hopesWishes.ipsAtAppointmentsDetails" />}
            <PVYesNo label="Are you willing to match with Intended Parents who already have children?" value={hopes.ipsWithChildren} fp="hopesWishes.ipsWithChildren" />
            <PVYesNo label="Are you open to matching with LGBTQ+ individual/couples?" value={hopes.openLGBTQ} fp="hopesWishes.openLGBTQ" />
            <PVYesNo label="Are you willing to match with a single Intended Parent?" value={hopes.openSingleIP} fp="hopesWishes.openSingleIP" />
            <PVYesNo label="Are you willing to have the embryo transfer in another state?" value={hopes.transferAnotherState} fp="hopesWishes.transferAnotherState" />
            {hopes.transferAnotherState === 'no' && hopes.transferAnotherStateDetails && (
              <PVField label="Please explain" value={hopes.transferAnotherStateDetails} fp="hopesWishes.transferAnotherStateDetails" />
            )}
            <PVYesNo label="Are you willing to match with Intended Parents who live outside of the U.S.?" value={hopes.ipsOutsideUS} fp="hopesWishes.ipsOutsideUS" />
            <PVYesNo label="If recommended by a physician, would you be willing to undergo CVS, amniocentesis or other diagnostic testing?" value={hopes.cvsAmnio} fp="hopesWishes.cvsAmnio" />
            {hopes.cvsAmnio === 'no' && hopes.cvsAmnioDetails && <PVField label="Please explain" value={hopes.cvsAmnioDetails} fp="hopesWishes.cvsAmnioDetails" />}
            <PVField label="Willingness to terminate for a serious genetic or medical condition and follow IP(s) direction and doctor recommendation?" value={hopes.willingnessToTerminate} fp="hopesWishes.willingnessToTerminate" />
            {hasPartner && <PVYesNo label="Would your spouse or support person support the decision for termination?" value={hopes.partnerAgreesTermination} fp="hopesWishes.partnerAgreesTermination" />}
            <PVYesNo label="Are there any specific conditions where you would not terminate a pregnancy?" value={hopes.conditionsWontTerminate} fp="hopesWishes.conditionsWontTerminate" />
            {hopes.conditionsWontTerminate === 'yes' && hopes.conditionsWontTerminateDetails && (
              <PVField label="Please explain" value={hopes.conditionsWontTerminateDetails} fp="hopesWishes.conditionsWontTerminateDetails" />
            )}
            <PVField label="How many embryos are you in agreement to transfer at a time?" value={hopes.embryosToTransfer} fp="hopesWishes.embryosToTransfer" />
            {hopes.embryosToTransfer === '1' && (
              <PVYesNo label="If the 1 transferred embryo splits, would you be in agreement to carrying twins?" value={hopes.carryTwins} fp="hopesWishes.carryTwins" />
            )}
          </div>
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-50">
            <PVField label="Describe your ideal intended parent(s) for whom you would like to be a surrogate" value={hopes.idealIPs} fp="hopesWishes.idealIPs" />
            <PVField label="What is the best form of communication that you are comfortable using?" value={hopes.preferredCommunication} fp="hopesWishes.preferredCommunication" />
            <PVField label="How much involvement from the Intended Parents do you want during the pregnancy?" value={hopes.ipInvolvement} fp="hopesWishes.ipInvolvement" />
            <PVField label="When are you ready to begin?" value={hopes.whenReadyToBegin} fp="hopesWishes.whenReadyToBegin" />
            {hopes.adminNotes && <PVField label="Agency Notes" value={hopes.adminNotes} fp="hopesWishes.adminNotes" />}
            <PVField label="Ideal relationship with Intended Parent(s) post birth" value={hopes.postBirthRelationship} fp="hopesWishes.postBirthRelationship" />
            <PVField label="Is there anyone else you would like to have in the delivery room (partner/spouse, friend, mom)?" value={hopes.deliveryRoomOthers} fp="hopesWishes.deliveryRoomOthers" />
            <PVField label="How do you feel about having Intended Parents who cannot attend doctor appointments and see you on a regular basis?" value={hopes.ipsCantAttend} fp="hopesWishes.ipsCantAttend" />
            <PVField label="Who will care for your child(ren) when you need to travel for surrogacy?" value={hopes.childCareTraveling} fp="hopesWishes.childCareTraveling" />
          </div>
        </PVSection>

        {/* ── Letter to Intended Parents (full-width standout card) ── */}
        {hopes.additionalComments && (
          <div className="mt-8 print:break-inside-avoid">
            <div className="bg-[#fce7f0] rounded-2xl overflow-hidden border border-[#D4A853]/20 shadow-sm print:shadow-none">
              <div className="px-7 pt-6 pb-4">
                <p className="font-heading font-black text-2xl tracking-tight" style={{ color: '#c2185b' }}>Dear Intended Parent(s),</p>
              </div>
              <div className="px-7 pb-7">
                <p className="text-[15px] text-stone-700 leading-[1.75] whitespace-pre-wrap font-serif italic">{hopes.additionalComments}</p>
                <p className="text-right text-base font-heading font-bold mt-5" style={{ color: '#c2185b' }}>— {firstName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Print-only photo gallery at bottom */}
        {photos?.length > 1 && (
          <div className="hidden print:block print:break-inside-avoid">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#1A3638]/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <Camera className="w-4.5 h-4.5 text-[#1A3638]" />
                <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wide">Photos</h3>
              </div>
            </div>
            <div className="px-6 py-4 grid grid-cols-5 gap-2">
              {photos.slice(0, 10).map(ph => (
                <div key={ph.path} className="aspect-square rounded-lg overflow-hidden">
                  <img src={ph.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {!hideFooter && (
          <div className="text-center py-6 print:hidden">
            <div className="inline-flex items-center gap-2 text-xs text-gray-400">
              <img src="/north-star-logo.png" alt="" className="h-5 opacity-30" />
              This is a preview of how intended parents will see your profile.
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Photo Lightbox Modal ── */}
    {lightboxIdx !== null && galleryPhotos?.length > 0 && (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
        <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10" onClick={() => setLightboxIdx(null)}>
          <X className="w-8 h-8" />
        </button>
        <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
          <img src={galleryPhotos[lightboxIdx].url} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />
          {galleryPhotos.length > 1 && (
            <>
              <button onClick={() => setLightboxIdx(i => (i - 1 + galleryPhotos.length) % galleryPhotos.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={() => setLightboxIdx(i => (i + 1) % galleryPhotos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm font-medium px-3 py-1 rounded-full">
                {lightboxIdx + 1} / {galleryPhotos.length}
              </div>
            </>
          )}
        </div>
        {/* Thumbnail strip — fixed height, variable width so each thumbnail
            preserves its native aspect (no more cropped-to-square preview). */}
        {galleryPhotos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 mb-10 max-w-[90vw] overflow-x-auto">
            {galleryPhotos.map((ph, i) => (
              <button key={ph.path} onClick={(e) => { e.stopPropagation(); setLightboxIdx(i) }}
                className={`h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === lightboxIdx ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
                <img src={ph.url} alt="" className="h-full w-auto block" />
              </button>
            ))}
          </div>
        )}
      </div>
    )}

    </HiddenFieldsContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────
// Section body router
// ─────────────────────────────────────────────────────────
function SectionBody({ sectionKey, v, u, profile, setProfile }) {
  switch (sectionKey) {
    case 'personal': return <PersonalSection v={v} u={u} />
    case 'followUp': return <FollowUpSection v={v} u={u} profile={profile} />
    case 'pregnancyHistory': return <PregnancyHistorySection v={v} u={u} profile={profile} setProfile={setProfile} />
    case 'fertility': return <FertilitySection v={v} u={u} profile={profile} />
    case 'general': return <GeneralSection v={v} u={u} profile={profile} />
    case 'health': return <HealthSection v={v} u={u} />
    case 'employment': return <EmploymentSection v={v} u={u} profile={profile} />
    case 'interests': return <InterestsSection v={v} u={u} />
    case 'academic': return <AcademicSection v={v} u={u} />
    case 'experiencedSurrogate': return <ExperiencedSurrogateSection v={v} u={u} profile={profile} setProfile={setProfile} />
    case 'hopesWishes': return <HopesWishesSection v={v} u={u} profile={profile} />
    case 'photos': return <PhotosSection v={v} u={u} />
    default: return null
  }
}

// ─────────────────────────────────────────────────────────
// 1. Personal Information (merged About Me + Family)
// ─────────────────────────────────────────────────────────
function FollowUpSection({ v, u, profile }) {
  const s = 'followUp'
  // Pre-fill from original sections if followUp data is empty
  const val = (key) => {
    const followUpVal = v(s, key)
    if (followUpVal !== undefined && followUpVal !== '' && followUpVal !== null) return followUpVal
    // Check original sections for migration
    for (const origSection of ['personal', 'fertility', 'general', 'health', 'employment', 'academic', 'hopesWishes']) {
      const origVal = profile?.[origSection]?.[key]
      if (origVal !== undefined && origVal !== '' && origVal !== null) return origVal
    }
    return ''
  }
  const set = (key) => u(s, key)

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-400 italic">These questions help us complete your screening. Please answer honestly.</p>

      <YesNoField label="Are your cycles typically between 28 to 30 days?" value={val('cycleLength')} onChange={set('cycleLength')} />
      {val('cycleLength') === 'no' && <TextField label="What is your typical cycle length?" value={val('cycleLengthDetails')} onChange={set('cycleLengthDetails')} />}
      <TextField label="When was the start of your last period?" value={val('lastPeriod')} onChange={set('lastPeriod')} />
      <TextField label="What is the nearest hospital with a Level II or III NICU?" value={val('nearestNICU')} onChange={set('nearestNICU')} />
      <YesNoField label="Are you ok traveling to a hospital with at least a Level II NICU?" value={val('willingToTravelNICU')} onChange={set('willingToTravelNICU')} />
      <TextField label="How long after stopping contraceptives did it take to get pregnant?" value={val('timeToConceive')} onChange={set('timeToConceive')} />

      <YesNoField label="Have you ever placed a child for adoption?" value={val('placedForAdoption')} onChange={set('placedForAdoption')} />
      {val('piercingsTattoos') === 'yes' && <TextField label="When did you have your last tattoo?" value={val('lastTattooDate')} onChange={set('lastTattooDate')} />}
      <YesNoField label="Have you been tattooed or had a non-sterile skin piercing in the last 12 months?" value={val('nonSterilePiercing')} onChange={set('nonSterilePiercing')} />
      <YesNoField label="Do you have a history of eating disorders?" value={val('eatingDisorders')} onChange={set('eatingDisorders')} />
      <YesNoField label="Have you traveled outside of the U.S. in the last 6 months?" value={val('recentTravel')} onChange={set('recentTravel')} />
      <YesNoField label="Do you have any issues with sleeping?" value={val('sleepIssues')} onChange={set('sleepIssues')} />
      <TextField label="How many hours do you typically sleep each night?" value={val('sleepHours')} onChange={set('sleepHours')} />
      <YesNoField label="Do you have automobile insurance?" value={val('autoInsurance')} onChange={set('autoInsurance')} />
      <YesNoField label="Do you have a valid driver's license?" value={val('validLicense')} onChange={set('validLicense')} />
      <YesNoField label="Will your partner submit to the FDA required lab tests?" value={val('partnerFdaTests')} onChange={set('partnerFdaTests')} />

      <TextField label="When was your last annual physical?" value={val('lastPhysical')} onChange={set('lastPhysical')} />

      <YesNoField label="Is your Surrogate Base Fee negotiable?" value={val('compensationNegotiable')} onChange={set('compensationNegotiable')} />
    </div>
  )
}

function PersonalSection({ v, u }) {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
  const [fallbackId, setFallbackId] = useState(null)
  useEffect(() => {
    if (!currentUser?.email || !supabase) return
    supabase.from('intake_submissions').select('id').eq('applicant_email', currentUser.email.trim().toLowerCase()).order('submitted_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data?.id) setFallbackId(String(data.id)) }).catch(() => {})
  }, [currentUser?.email])
  const s = 'personal'
  const heightFt = parseInt(v(s, 'heightFt')) || 0
  const heightIn = parseInt(v(s, 'heightIn')) || 0
  const weight = parseFloat(v(s, 'weight')) || 0
  const totalInches = heightFt * 12 + heightIn
  const bmi = totalInches > 0 && weight > 0
    ? ((weight / (totalInches * totalInches)) * 703).toFixed(1)
    : '—'
  const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProfilePhotoUpload label="Profile Photo" hint="Upload a favorite recent photo of just you!" userId={userId} fallbackId={fallbackId} subfolder="portrait" onPhotoChange={(url) => { u('personal', 'profilePhotoUrl', url || ''); }} />
        <ProfilePhotoUpload label="Cover Photo" hint="Upload a favorite picture of you with your family or kids!" userId={userId} fallbackId={fallbackId} subfolder="headshot" />
      </div>
      <YesNoField label="Are you a U.S. Citizen or Permanent Resident?" value={v(s, 'usCitizen')} onChange={u(s, 'usCitizen')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="First name (or nickname)" value={v(s, 'firstName')} onChange={u(s, 'firstName')} placeholder="First name ONLY or nickname" />
        <TextField label="Date of Birth" value={v(s, 'dob')} onChange={u(s, 'dob')} type="date" disabled placeholder="From signup" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="City" value={v(s, 'city')} onChange={u(s, 'city')} placeholder="Your city" />
        <SelectField label="State" value={v(s, 'state')} onChange={u(s, 'state')} placeholder="Select state" options={US_STATES} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectField label="Height (ft)" value={v(s, 'heightFt')} onChange={u(s, 'heightFt')} placeholder="Ft"
          options={['4','5','6'].map(n => ({ value: n, label: `${n} ft` }))} />
        <SelectField label="Height (in)" value={v(s, 'heightIn')} onChange={u(s, 'heightIn')} placeholder="In"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i} in` }))} />
        <TextField label="Weight (lbs)" value={v(s, 'weight')} onChange={u(s, 'weight')} type="number" placeholder="lbs" />
        <Field label="BMI (auto)">
          <div className="h-9 flex items-center px-3 rounded-md border bg-gray-50 text-sm font-medium text-[#1A3638]">{bmi}</div>
        </Field>
      </div>

      <div className="p-4 rounded-xl bg-[#1A3638]/5 border border-[#1A3638]/10">
        <h4 className="font-medium text-[#1A3638] mb-3">Relationship & Household</h4>
        <div className="space-y-4">
          <SelectField label="Current Marital/Relationship Status" value={v(s, 'maritalStatus')} onChange={u(s, 'maritalStatus')}
            options={['Single', 'In a Relationship', 'Married', 'Domestic Partnership', 'Divorced', 'Separated', 'Widowed']} />
          {!['Single', 'Divorced', 'Widowed'].includes(v(s, 'maritalStatus')) && v(s, 'maritalStatus') && (
            <YesNoField label="Are you currently in a monogamous relationship?" value={v(s, 'monogamous')} onChange={u(s, 'monogamous')} />
          )}
          <SelectField label="How many sexual partners have you had in the past 6 months?" value={v(s, 'sexualPartners')} onChange={u(s, 'sexualPartners')}
            options={['0', '1', '2', '3', '4+']} className="max-w-xs" />

          {['In a Relationship', 'Married', 'Domestic Partnership'].includes(v(s, 'maritalStatus')) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="How long have you been together?" value={v(s, 'relationshipLength')} onChange={u(s, 'relationshipLength')} placeholder="e.g. 5 years" />
                <TextField label="First name ONLY of your spouse or partner" value={v(s, 'partnerName')} onChange={u(s, 'partnerName')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="Spouse/Partner's Date of Birth" value={v(s, 'partnerDob')} onChange={u(s, 'partnerDob')} type="date" />
                <YesNoField label="Is your Spouse/Partner a U.S. Citizen or Permanent Resident?" value={v(s, 'partnerUsCitizen')} onChange={u(s, 'partnerUsCitizen')} />
              </div>
            </>
          )}

          <HouseholdMembers value={v(s, 'householdMembers') || []} onChange={u(s, 'householdMembers')}
            partnerName={v(s, 'partnerName')} maritalStatus={v(s, 'maritalStatus')} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 3. Pregnancy History
// ─────────────────────────────────────────────────────────
function PregnancyHistorySection({ v, u, profile, setProfile }) {
  const s = 'pregnancyHistory'
  const pregnancies = profile?.pregnancyHistory?.pregnancies || []
  const numberOfPregnancies = parseInt(v(s, 'numberOfPregnancies')) || 0
  const [expandedIdx, setExpandedIdx] = useState(null)

  // Ensure pregnancy slots exist when count changes
  useEffect(() => {
    if (numberOfPregnancies < 1) return
    const current = profile?.pregnancyHistory?.pregnancies || []
    if (current.length >= numberOfPregnancies) return
    const newSlots = []
    for (let i = current.length; i < numberOfPregnancies; i++) {
      newSlots.push({
        id: Date.now() + i, name: '', dob: '', sex: '', outcome: '', deliveryType: '',
        singleOrMultiples: 'Single', weight: '', length: '', gestationWeeks: '', gestationDays: '',
        wasSurrogacy: '', cyclesToConceive: '', complications: ''
      })
    }
    setProfile(prev => ({
      ...prev,
      pregnancyHistory: {
        ...prev.pregnancyHistory,
        pregnancies: [...current, ...newSlots].slice(0, numberOfPregnancies)
      }
    }))
  }, [numberOfPregnancies])

  const updatePregnancy = (idx, field, value) => {
    setProfile(prev => ({
      ...prev,
      pregnancyHistory: {
        ...prev.pregnancyHistory,
        pregnancies: (prev.pregnancyHistory?.pregnancies || []).map((p, i) =>
          i === idx ? { ...p, [field]: value } : p
        )
      }
    }))
  }

  const filledCount = pregnancies.filter(p => isPregnancyComplete(p)).length

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <Field label="Total number of pregnancies">
          <p className="text-xs text-stone-400 -mt-1 mb-1.5">Include every time you've been pregnant — live births, miscarriages, terminations, stillborns, ectopic pregnancies, etc.</p>
          <Input
            type="number"
            min="0"
            max="20"
            value={v(s, 'numberOfPregnancies')}
            onChange={e => u(s, 'numberOfPregnancies')(e.target.value)}
            className="rounded-xl h-11"
          />
        </Field>
      </div>

      {numberOfPregnancies > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-stone-700">Enter details for each pregnancy:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: numberOfPregnancies }).map((_, idx) => {
              const p = pregnancies[idx] || {}
              const complete = isPregnancyComplete(p)
              const hasData = p.outcome || p.dob
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    expandedIdx === idx
                      ? 'border-[#1A3638] bg-[#1A3638]/5 shadow-md'
                      : complete
                      ? 'border-emerald-300 bg-emerald-50 hover:shadow-sm'
                      : hasData
                      ? 'border-amber-300 bg-amber-50 hover:shadow-sm'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-stone-800">Pregnancy #{idx + 1}</span>
                    {complete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-300" />
                    )}
                  </div>
                  {p.outcome ? (
                    <p className="text-xs text-stone-500 mt-1">
                      {p.outcome}{p.name ? ` — ${p.name}` : ''}
                      {p.wasSurrogacy === 'yes' ? ' (surrogacy)' : ''}
                      {p.gestationWeeks ? ` · ${p.gestationWeeks}w${p.gestationDays ? `${p.gestationDays}d` : ''}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400 mt-1">Click to enter details</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Expanded pregnancy detail form */}
          {expandedIdx !== null && expandedIdx < numberOfPregnancies && (
            <div className="rounded-xl border-2 border-[#1A3638] bg-white p-5 space-y-4 shadow-lg mt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-[#1A3638] text-lg">Pregnancy #{expandedIdx + 1} Details</h4>
                <Button variant="ghost" size="sm" onClick={() => setExpandedIdx(null)} className="text-stone-400 text-xs">
                  Done
                </Button>
              </div>

              <SelectField label="Pregnancy Outcome" value={pregnancies[expandedIdx]?.outcome || ''} onChange={val => updatePregnancy(expandedIdx, 'outcome', val)}
                options={['Live Birth', 'Miscarriage', 'Stillborn', 'Ectopic Pregnancy', 'Termination']} />

              {profile?.experiencedSurrogate?.previousSurrogate === 'yes' && (
                <YesNoField label="Was this a surrogacy pregnancy?" value={pregnancies[expandedIdx]?.wasSurrogacy || ''} onChange={val => updatePregnancy(expandedIdx, 'wasSurrogacy', val)} />
              )}

              {pregnancies[expandedIdx]?.wasSurrogacy !== 'yes' && (
                <TextField label="About how many months did it take you to get pregnant?" value={pregnancies[expandedIdx]?.cyclesToConceive || ''} onChange={val => updatePregnancy(expandedIdx, 'cyclesToConceive', val)} required className="max-w-xs" />
              )}
              {pregnancies[expandedIdx]?.wasSurrogacy === 'yes' && (
                <TextField label="How many embryo transfers did it take until pregnancy was achieved?" value={pregnancies[expandedIdx]?.transfersUntilPregnant || ''} onChange={val => updatePregnancy(expandedIdx, 'transfersUntilPregnant', val)} type="number" className="max-w-xs" />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pregnancies[expandedIdx]?.outcome !== 'Live Birth' && (
                  <TextField label="Notes (optional)" value={pregnancies[expandedIdx]?.name || ''} onChange={val => updatePregnancy(expandedIdx, 'name', val)} placeholder={pregnancies[expandedIdx]?.outcome === 'Miscarriage' ? 'e.g. how far along' : ''} />
                )}
                {/* Non-delivery outcomes (miscarriage / termination / ectopic / chemical) — surrogates
                    often don't remember the day. Ask MM/YYYY only. Live Birth + Stillborn ask MM/DD/YYYY. */}
                {(() => {
                  const outcome = pregnancies[expandedIdx]?.outcome
                  const isNonDel = outcome && outcome !== 'Live Birth' && outcome !== 'Stillborn'
                  const raw = pregnancies[expandedIdx]?.dob || ''
                  return (
                    <TextField
                      label={isNonDel ? 'Date of event (MM/YYYY)' : 'Date (DOB or date of event)'}
                      value={isNonDel ? String(raw).slice(0, 7) : raw}
                      onChange={val => updatePregnancy(expandedIdx, 'dob', val)}
                      type={isNonDel ? 'month' : 'date'}
                    />
                  )
                })()}
              </div>

              {/* Gestation: weeks + days */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  {pregnancies[expandedIdx]?.outcome === 'Live Birth' ? 'Gestation at time of delivery'
                    : pregnancies[expandedIdx]?.outcome === 'Miscarriage' ? 'Gestation at time of miscarriage'
                    : pregnancies[expandedIdx]?.outcome === 'Termination' ? 'Gestation at time of termination'
                    : pregnancies[expandedIdx]?.outcome === 'Stillborn' ? 'Gestation at time of stillbirth'
                    : pregnancies[expandedIdx]?.outcome === 'Ectopic Pregnancy' ? 'Gestation at time of ectopic pregnancy'
                    : 'Gestation'}
                </Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Input
                    type="number" min="0" max="45"
                    value={pregnancies[expandedIdx]?.gestationWeeks || ''}
                    onChange={e => updatePregnancy(expandedIdx, 'gestationWeeks', e.target.value)}
                    className="rounded-xl h-11 w-20"
                  />
                  <span className="text-sm text-stone-500">weeks</span>
                  <Input
                    type="number" min="0" max="6"
                    value={pregnancies[expandedIdx]?.gestationDays || ''}
                    onChange={e => updatePregnancy(expandedIdx, 'gestationDays', e.target.value)}
                    className="rounded-xl h-11 w-20"
                  />
                  <span className="text-sm text-stone-500">days</span>
                </div>
              </div>

              {pregnancies[expandedIdx]?.outcome === 'Live Birth' && (() => {
                const p = pregnancies[expandedIdx]
                const isMultiples = p?.singleOrMultiples === 'Twins' || p?.singleOrMultiples === 'Triplets+'
                const isTriplets = p?.singleOrMultiples === 'Triplets+'
                return (
                  <>
                    <SelectField label="Single or Multiples" value={p?.singleOrMultiples || ''} onChange={val => updatePregnancy(expandedIdx, 'singleOrMultiples', val)}
                      options={['Single', 'Twins', 'Triplets+']} />

                    {/* Baby A */}
                    <div className={isMultiples ? 'rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-4' : ''}>
                      {isMultiples && <p className="text-xs font-bold text-[#1A3638] uppercase tracking-wider">Baby A</p>}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <TextField label="Name" value={p?.name || ''} onChange={val => updatePregnancy(expandedIdx, 'name', val)} placeholder="Baby's name" />
                        <SelectField label="Sex" value={p?.sex || ''} onChange={val => updatePregnancy(expandedIdx, 'sex', val)}
                          options={['Male', 'Female']} />
                        <SelectField label="Delivery Type" value={p?.deliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'deliveryType', val)}
                          options={['Vaginal', 'C-Section']} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField label="Birth Weight" value={p?.weight || ''} onChange={val => updatePregnancy(expandedIdx, 'weight', val)} placeholder="e.g. 7 lbs 4 oz" />
                        <TextField label="Birth Length" value={p?.length || ''} onChange={val => updatePregnancy(expandedIdx, 'length', val)} placeholder="inches" />
                      </div>
                    </div>

                    {/* Baby B */}
                    {isMultiples && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-4">
                        <p className="text-xs font-bold text-[#1A3638] uppercase tracking-wider">Baby B</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <TextField label="Name" value={p?.babyBName || ''} onChange={val => updatePregnancy(expandedIdx, 'babyBName', val)} placeholder="Baby's name" />
                          <SelectField label="Sex" value={p?.babyBSex || ''} onChange={val => updatePregnancy(expandedIdx, 'babyBSex', val)}
                            options={['Male', 'Female']} />
                          <SelectField label="Delivery Type" value={p?.babyBDeliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'babyBDeliveryType', val)}
                            options={['Vaginal', 'C-Section']} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField label="Birth Weight" value={p?.babyBWeight || ''} onChange={val => updatePregnancy(expandedIdx, 'babyBWeight', val)} placeholder="e.g. 7 lbs 4 oz" />
                          <TextField label="Birth Length" value={p?.babyBLength || ''} onChange={val => updatePregnancy(expandedIdx, 'babyBLength', val)} placeholder="inches" />
                        </div>
                      </div>
                    )}

                    {/* Baby C */}
                    {isTriplets && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-4">
                        <p className="text-xs font-bold text-[#1A3638] uppercase tracking-wider">Baby C</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <TextField label="Name" value={p?.babyCName || ''} onChange={val => updatePregnancy(expandedIdx, 'babyCName', val)} placeholder="Baby's name" />
                          <SelectField label="Sex" value={p?.babyCSex || ''} onChange={val => updatePregnancy(expandedIdx, 'babyCSex', val)}
                            options={['Male', 'Female']} />
                          <SelectField label="Delivery Type" value={p?.babyCDeliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'babyCDeliveryType', val)}
                            options={['Vaginal', 'C-Section']} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField label="Birth Weight" value={p?.babyCWeight || ''} onChange={val => updatePregnancy(expandedIdx, 'babyCWeight', val)} placeholder="e.g. 7 lbs 4 oz" />
                          <TextField label="Birth Length" value={p?.babyCLength || ''} onChange={val => updatePregnancy(expandedIdx, 'babyCLength', val)} placeholder="inches" />
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

              {pregnancies[expandedIdx]?.outcome === 'Stillborn' && (
                <SelectField label="Delivery/Procedure Type" value={pregnancies[expandedIdx]?.deliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'deliveryType', val)}
                  options={['Vaginal', 'C-Section']} />
              )}
              {(pregnancies[expandedIdx]?.outcome === 'Miscarriage' || pregnancies[expandedIdx]?.outcome === 'Ectopic Pregnancy' || pregnancies[expandedIdx]?.outcome === 'Termination') && (
                <SelectField label="Delivery/Procedure Type" value={pregnancies[expandedIdx]?.deliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'deliveryType', val)}
                  options={['Natural', 'Medicated', 'Surgical']} />
              )}

              <CheckboxGroupField label="Pregnancy complications (check all that apply)" options={[
                'C-Section', 'Gestational Diabetes', 'High Blood Pressure',
                'IUGR (Intrauterine Growth Restriction)', 'Physician Ordered Bed Rest', 'Placenta Previa',
                'Postpartum Depression', 'Premature Birth', 'Retained Placenta', 'Toxemia', 'Other', 'None of the above'
              ]} value={pregnancies[expandedIdx]?.complicationsList || []} onChange={val => updatePregnancy(expandedIdx, 'complicationsList', val)} />
              {(pregnancies[expandedIdx]?.complicationsList || []).some(c => c !== 'None of the above') && (
                <TextAreaField label="Please explain any checked complications" value={pregnancies[expandedIdx]?.complicationsExplanation || ''} onChange={val => updatePregnancy(expandedIdx, 'complicationsExplanation', val)} rows={2} />
              )}
              <TextAreaField label="Additional details about this pregnancy" value={pregnancies[expandedIdx]?.complications || ''} onChange={val => updatePregnancy(expandedIdx, 'complications', val)}
                placeholder="Any other details about pregnancy, delivery, or recovery" rows={2} />

              <div className="flex justify-end">
                <Button onClick={() => setExpandedIdx(null)} className="gap-2 rounded-xl" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
                  <CheckCircle2 className="w-4 h-4" /> Save & Close
                </Button>
              </div>
            </div>
          )}

          {numberOfPregnancies > 0 && (
            <p className="text-xs text-stone-400">{filledCount} of {numberOfPregnancies} pregnancies completed</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 3. Fertility Information
// ─────────────────────────────────────────────────────────
function FertilitySection({ v, u, profile }) {
  const s = 'fertility'

  return (
    <div className="space-y-6">
      <YesNoField label="Are you currently breastfeeding?" value={v(s, 'breastfeeding')} onChange={u(s, 'breastfeeding')} />
      <YesNoField label="Is the biological father the same for all of your biological children?" value={v(s, 'sameBioFather')} onChange={u(s, 'sameBioFather')} />
      {v(s, 'sameBioFather') === 'no' && (
        <TextAreaField label="Please explain" value={v(s, 'sameBioFatherDetails')} onChange={u(s, 'sameBioFatherDetails')} rows={2} />
      )}

      <TextAreaField label="We want to hear all the details about your pregnancy(s). Be sure to describe in detail about any complications you experienced. Please share the ups and downs." value={v(s, 'pregnancyDetails')} onChange={u(s, 'pregnancyDetails')} rows={4} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Have you ever been seen by a doctor for infertility treatment?" value={v(s, 'infertilityTreatment')} onChange={u(s, 'infertilityTreatment')} />
        <YesNoField label="Have you ever been diagnosed with any gynecological issues (such as endometriosis, ovarian cysts, fibroids, abnormal pap smears, etc.)?" value={v(s, 'gynecologicalProblems')} onChange={u(s, 'gynecologicalProblems')} />
      </div>
      {v(s, 'infertilityTreatment') === 'yes' && (
        <TextAreaField label="Please provide details" value={v(s, 'infertilityTreatmentDetails')} onChange={u(s, 'infertilityTreatmentDetails')} rows={2} />
      )}
      {v(s, 'gynecologicalProblems') === 'yes' && (
        <TextAreaField label="Please provide details" value={v(s, 'gynecologicalProblemsDetails')} onChange={u(s, 'gynecologicalProblemsDetails')} rows={2} />
      )}

      <YesNoField label="Did you ever take medication (aside from prenatals) during pregnancy?" value={v(s, 'pregnancyMedication')} onChange={u(s, 'pregnancyMedication')} />
      {v(s, 'pregnancyMedication') === 'yes' && (
        <TextAreaField label="Please list medications" value={v(s, 'pregnancyMedicationList')} onChange={u(s, 'pregnancyMedicationList')} rows={2} />
      )}

      <SelectField label="Which contraceptive method do you currently use?" value={v(s, 'contraceptiveMethod')} onChange={u(s, 'contraceptiveMethod')}
        options={['Oral contraceptive pill', 'IUD', 'Implant', 'Injection', 'Vaginal ring', 'Patch', 'Condoms', 'Natural family planning / cycle tracking', 'Tubal Ligation', 'Bilateral Salpingectomy', 'Permanent sterilization', 'Vasectomy', 'Same sex partner', 'Abstinence', 'No current birth control', 'Other']} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 5. Health Information
// ─────────────────────────────────────────────────────────
function HealthSection({ v, u }) {
  const s = 'health'
  const diseases = [
    'Anemia', 'Autoimmune disorder', 'Blood sugar issues', 'Breast Disorders', 'Cancer', 'Chest Pain',
    'Chlamydia', 'CMV', 'Cyst (uterine/ovarian)', 'Gonorrhea (or other STI)', 'Hepatitis B',
    'High Blood Pressure', 'High Cholesterol', 'HIV/AIDS', 'HPV', 'Hypoglycemia or hyperglycemia',
    'HSV 1 (cold sores)', 'HSV 2 (genital herpes)', 'Leukemia', 'Liver Disease', 'Migraine Headaches',
    'Psychiatric Disorders', 'Reproductive Disorders', 'Thyroid Disorder', 'Tumor', 'Tuberculosis',
    'Other', 'None of the Above'
  ]
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[#1A3638]/5 border border-[#1A3638]/10">
        <h4 className="font-medium text-[#1A3638] mb-3">Mental Health</h4>
        <div className="space-y-4">
          <YesNoField label="Have you ever been formally or informally diagnosed with any mental health challenge (e.g. depression, anxiety, bipolar disorder, postpartum depression)?" value={v(s, 'mentalHealthDiagnosis')} onChange={u(s, 'mentalHealthDiagnosis')} />
          {v(s, 'mentalHealthDiagnosis') === 'yes' && (
            <TextAreaField label="Please provide details" value={v(s, 'mentalHealthDetails')} onChange={u(s, 'mentalHealthDetails')} rows={2} />
          )}
          <YesNoField label="Have you ever been hospitalized for a mental health challenge?" value={v(s, 'mentalHealthHospitalization')} onChange={u(s, 'mentalHealthHospitalization')} />
          {v(s, 'mentalHealthHospitalization') === 'yes' && (
            <TextAreaField label="Please provide details" value={v(s, 'mentalHealthHospDetails')} onChange={u(s, 'mentalHealthHospDetails')} rows={2} />
          )}
          <YesNoField label="Do you currently or have you ever taken medication for a mental health challenge?" value={v(s, 'mentalHealthMedication')} onChange={u(s, 'mentalHealthMedication')} />
          {v(s, 'mentalHealthMedication') === 'yes' && (
            <TextAreaField label="Please list dates and medication type" value={v(s, 'mentalHealthMedDetails')} onChange={u(s, 'mentalHealthMedDetails')} rows={2} />
          )}
          <YesNoField label="Are you currently or have you ever participated in counseling or psychotherapy?" value={v(s, 'counselingTherapy')} onChange={u(s, 'counselingTherapy')} />
          {v(s, 'counselingTherapy') === 'yes' && (
            <TextAreaField label="Please provide details" value={v(s, 'counselingDetails')} onChange={u(s, 'counselingDetails')} rows={2} />
          )}
          <YesNoField label="Has anyone in your family ever had a mental health challenge such as depression, anxiety, alcoholism or drug abuse?" value={v(s, 'familyMentalHealth')} onChange={u(s, 'familyMentalHealth')} />
          {v(s, 'familyMentalHealth') === 'yes' && (
            <TextAreaField label="Please explain" value={v(s, 'familyMentalHealthDetails')} onChange={u(s, 'familyMentalHealthDetails')} rows={2} />
          )}
          <YesNoField label="Were you ever involved in a relationship where you experienced domestic violence?" value={v(s, 'domesticViolence')} onChange={u(s, 'domesticViolence')} />
          {v(s, 'domesticViolence') === 'yes' && (
            <TextAreaField label="Please explain" value={v(s, 'domesticViolenceDetails')} onChange={u(s, 'domesticViolenceDetails')} rows={2} />
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-pink-50/50 border border-pink-100">
        <h4 className="font-medium text-[#1A3638] mb-3">Medications</h4>
        <div className="space-y-4">
          <TextAreaField label="Non-prescription medication use (such as Tylenol, Advil, allergy/cold medication, etc.)" value={v(s, 'nonPrescriptionMeds')} onChange={u(s, 'nonPrescriptionMeds')} rows={2} />
          <TextAreaField label="Prescription medications taken in the past 5 years, their purpose and dates of use" value={v(s, 'prescriptionMeds')} onChange={u(s, 'prescriptionMeds')} rows={2} />
          <TextAreaField label="Current medications and supplements" value={v(s, 'currentMeds')} onChange={u(s, 'currentMeds')} rows={2} />
        </div>
      </div>

      <TextAreaField label="Do you currently have any allergies?" value={v(s, 'allergies')} onChange={u(s, 'allergies')} placeholder="List any allergies and details" rows={2} />
      <TextAreaField label="Do you currently have any medical conditions we should be made aware of?" value={v(s, 'medicalConditions')} onChange={u(s, 'medicalConditions')} rows={2} />
      <TextAreaField label="Hospitalization/surgery history over past 5 years. Please list surgery and year." value={v(s, 'surgeries')} onChange={u(s, 'surgeries')} rows={2} />

      <CheckboxGroupField label="Please indicate whether you have had any of the following conditions or diseases (check all that apply)" options={diseases}
        value={v(s, 'diseaseHistory') || []} onChange={u(s, 'diseaseHistory')} />
      {(v(s, 'diseaseHistory') || []).some(d => d !== 'None of the Above') && (
        <TextAreaField label="Please explain any checked conditions" value={v(s, 'diseaseHistoryDetails')} onChange={u(s, 'diseaseHistoryDetails')} rows={2} />
      )}

      <YesNoField label="Are you open to vaccinations if recommended by the clinic?" value={v(s, 'openToVaccinations')} onChange={u(s, 'openToVaccinations')} />
      {v(s, 'openToVaccinations') === 'no' && (
        <TextAreaField label="Please explain which vaccines you are not willing to receive" value={v(s, 'vaccinesNotWilling')} onChange={u(s, 'vaccinesNotWilling')} rows={2} />
      )}
      <TextAreaField label="When was your most recent Pap test completed and results?" value={v(s, 'lastPap')} onChange={u(s, 'lastPap')} rows={2} placeholder="Date and any relevant results" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 4. General Information
// ─────────────────────────────────────────────────────────
function GeneralSection({ v, u, profile }) {
  const s = 'general'
  const hasPartner = ['In a Relationship', 'Married', 'Domestic Partnership'].includes(profile?.personal?.maritalStatus)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Do you own or rent your home?" value={v(s, 'homeOwnership')} onChange={u(s, 'homeOwnership')}
          options={['Own', 'Rent', 'Other']} />
        <TextField label="How long have you lived in your current home?" value={v(s, 'homeDuration')} onChange={u(s, 'homeDuration')} placeholder="e.g. 3 years" />
      </div>
      <YesNoField label="Do your children live with you full time?" value={v(s, 'childrenFullTime')} onChange={u(s, 'childrenFullTime')} />
      {v(s, 'childrenFullTime') === 'no' && (
        <TextAreaField label="Please explain" value={v(s, 'childrenFullTimeDetails')} onChange={u(s, 'childrenFullTimeDetails')} rows={2} />
      )}
      <TextAreaField label="If you are divorced or separated from the other parent(s) of your child(ren), please describe this relationship" value={v(s, 'divorcedRelationship')} onChange={u(s, 'divorcedRelationship')} rows={2} />
      <YesNoField label="Do any of your children have special needs or medical conditions?" value={v(s, 'childrenSpecialNeeds')} onChange={u(s, 'childrenSpecialNeeds')} />
      {v(s, 'childrenSpecialNeeds') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'childrenSpecialNeedsDetails')} onChange={u(s, 'childrenSpecialNeedsDetails')} rows={2} />
      )}
      <YesNoField label="Do you plan to have any more children of your own?" value={v(s, 'planMoreChildren')} onChange={u(s, 'planMoreChildren')} />
      {v(s, 'planMoreChildren') === 'yes' && (
        <TextAreaField label="Please share your thoughts" value={v(s, 'planMoreChildrenDetails')} onChange={u(s, 'planMoreChildrenDetails')} rows={2} />
      )}
      <YesNoField label="Do you have any piercings or tattoos?" value={v(s, 'piercingsTattoos')} onChange={u(s, 'piercingsTattoos')} />
      <YesNoField label="Have you or anyone in your household ever been arrested or convicted?" value={v(s, 'criminalHistory')} onChange={u(s, 'criminalHistory')} />
      {v(s, 'criminalHistory') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'criminalHistoryDetails')} onChange={u(s, 'criminalHistoryDetails')} rows={2} />
      )}
      <YesNoField label="Do you plan on traveling within or outside of the U.S. in the next 6 months?" value={v(s, 'travelPlans')} onChange={u(s, 'travelPlans')} />
      {v(s, 'travelPlans') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'travelPlansDetails')} onChange={u(s, 'travelPlansDetails')} rows={2} />
      )}
      <YesNoField label="Do you have a reliable vehicle to drive?" value={v(s, 'reliableVehicle')} onChange={u(s, 'reliableVehicle')} />

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#1A3638] mb-3">Smoking, Alcohol & Substances</h4>
        <div className="space-y-4">
          <YesNoField label="Do you currently smoke or vape?" value={v(s, 'smokeVape')} onChange={u(s, 'smokeVape')} />
          <YesNoField label="Do you have a history of smoking in the past?" value={v(s, 'smokingHistory')} onChange={u(s, 'smokingHistory')} />
          {v(s, 'smokingHistory') === 'yes' && (
            <TextField label="For how long and when did you quit?" value={v(s, 'smokingHistoryDetails')} onChange={u(s, 'smokingHistoryDetails')} />
          )}
          <YesNoField label="Does anyone else in your household currently smoke or vape?" value={v(s, 'householdSmoker')} onChange={u(s, 'householdSmoker')} />
          {v(s, 'householdSmoker') === 'yes' && (
            <TextAreaField label="Please provide details (who, how often, where and what)" value={v(s, 'householdSmokerDetails')} onChange={u(s, 'householdSmokerDetails')} rows={2} />
          )}
          <YesNoField label="Do you drink alcohol or use recreational drugs?" value={v(s, 'alcoholDrugs')} onChange={u(s, 'alcoholDrugs')} />
          {v(s, 'alcoholDrugs') === 'yes' && (
            <TextAreaField label="Please list frequency and type" value={v(s, 'alcoholDrugsDetails')} onChange={u(s, 'alcoholDrugsDetails')} rows={2} />
          )}
          <YesNoField label="Are there any guns in your home?" value={v(s, 'gunsInHome')} onChange={u(s, 'gunsInHome')} />
          <YesNoField label="Have you ever been advised to limit your use of alcohol or any drugs?" value={v(s, 'advisedLimitSubstances')} onChange={u(s, 'advisedLimitSubstances')} />
          {v(s, 'advisedLimitSubstances') === 'yes' && (
            <TextAreaField label="Please provide details" value={v(s, 'advisedLimitDetails')} onChange={u(s, 'advisedLimitDetails')} rows={2} />
          )}
          <YesNoField label="Does anyone in your household drink alcohol, use controlled substances or recreational drugs?" value={v(s, 'householdControlledSubstances')} onChange={u(s, 'householdControlledSubstances')} />
          {v(s, 'householdControlledSubstances') === 'yes' && (
            <>
              <TextAreaField label="What, how often, and when/where?" value={v(s, 'householdSubstancesDetails')} onChange={u(s, 'householdSubstancesDetails')} rows={2} />
              <TextAreaField label="If a controlled substance, what is the purpose for use?" value={v(s, 'householdSubstancesPurpose')} onChange={u(s, 'householdSubstancesPurpose')} rows={2} />
            </>
          )}
          <TextField label="What is your religious background or faith tradition, if any?" value={v(s, 'religiousBackground')} onChange={u(s, 'religiousBackground')} />
          <TextField label="Are you comfortable supporting Intended Parents regardless of their religious beliefs or background?" value={v(s, 'comfortableDifferentReligion')} onChange={u(s, 'comfortableDifferentReligion')} />
        </div>
      </div>

      <TextAreaField label="Please describe your typical diet and eating habits. Do you cook at home? How often do you eat out? Do you have any special dietary restrictions?" value={v(s, 'typicalDiet')} onChange={u(s, 'typicalDiet')} rows={3} />
      <TextAreaField label="List the forms and frequency of regular exercise" value={v(s, 'exerciseFrequency')} onChange={u(s, 'exerciseFrequency')} rows={2} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 6. Employment Information
// ─────────────────────────────────────────────────────────
function EmploymentSection({ v, u, profile }) {
  const s = 'employment'
  const hasPartner = ['In a Relationship', 'Married', 'Domestic Partnership'].includes(profile?.personal?.maritalStatus)
  return (
    <div className="space-y-6">
      <YesNoField label="Are you currently employed?" value={v(s, 'currentlyEmployed')} onChange={u(s, 'currentlyEmployed')} />
      {v(s, 'currentlyEmployed') === 'yes' && (
        <>
          <TextAreaField label="Please share details on the industry you work in." value={v(s, 'employmentIndustry')} onChange={u(s, 'employmentIndustry')} rows={2} />
          <TextField label="How many hours a week do you work, and what are your typical hours?" value={v(s, 'workHours')} onChange={u(s, 'workHours')} />
          <TextField label="What specifically is your occupation/position?" value={v(s, 'occupation')} onChange={u(s, 'occupation')} />
          <TextField label="How long have you worked for your current employer?" value={v(s, 'lengthAtEmployer')} onChange={u(s, 'lengthAtEmployer')} placeholder="e.g. 2 years" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HourlyRateField label="What is your earned hourly rate?" value={v(s, 'hourlyRate')} onChange={u(s, 'hourlyRate')} />
            <TextField label="What is your approximate weekly income?" value={v(s, 'weeklyIncome')} onChange={u(s, 'weeklyIncome')} placeholder="$" />
          </div>
        </>
      )}

      {hasPartner && (
        <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
          <h4 className="font-medium text-[#1A3638] mb-3">Spouse/Partner Employment</h4>
          <div className="space-y-4">
            <YesNoField label="Is your spouse/partner employed?" value={v(s, 'partnerEmployed')} onChange={u(s, 'partnerEmployed')} />
            {v(s, 'partnerEmployed') === 'yes' && (
              <>
                <TextField label="Spouse/partner's occupation" value={v(s, 'partnerOccupation')} onChange={u(s, 'partnerOccupation')} />
                <TextAreaField label="What hours and days does your spouse/partner work each week?" value={v(s, 'partnerWorkHours')} onChange={u(s, 'partnerWorkHours')} rows={2} placeholder="e.g. Mon-Fri, 8am-5pm" />
                <TextField label="Spouse/partner's approximate weekly income" value={v(s, 'partnerWeeklyIncome')} onChange={u(s, 'partnerWeeklyIncome')} placeholder="$" />
              </>
            )}
          </div>
        </div>
      )}

      <YesNoField label="Do you receive any government assistance (WIC, food stamps)?" value={v(s, 'governmentAssistance')} onChange={u(s, 'governmentAssistance')} />
      {v(s, 'governmentAssistance') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'governmentAssistanceDetails')} onChange={u(s, 'governmentAssistanceDetails')} rows={2} />
      )}

      <YesNoField label="Do you currently have health insurance?" value={v(s, 'healthInsurance')} onChange={u(s, 'healthInsurance')} />
      {v(s, 'healthInsurance') === 'yes' && (
        <SelectField label="What type of insurance do you have?" value={v(s, 'insuranceType')} onChange={u(s, 'insuranceType')}
          options={[
            'Employer-sponsored insurance (my own employer)',
            'Employer-sponsored insurance (spouse / partner)',
            'Employer-sponsored insurance (through parent)',
            'Individual / private plan',
            'ACA Policy',
            'Military / VA coverage',
            'State funded insurance',
            'Other',
          ]} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 7. Interests
// ─────────────────────────────────────────────────────────
function InterestsSection({ v, u }) {
  const s = 'interests'
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Favorite music" value={v(s, 'favoriteMusic')} onChange={u(s, 'favoriteMusic')} />
        <TextField label="Favorite movie" value={v(s, 'favoriteMovie')} onChange={u(s, 'favoriteMovie')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Favorite book" value={v(s, 'favoriteBook')} onChange={u(s, 'favoriteBook')} />
        <TextField label="Favorite foods" value={v(s, 'favoriteFoods')} onChange={u(s, 'favoriteFoods')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Favorite color" value={v(s, 'favoriteColor')} onChange={u(s, 'favoriteColor')} />
        <TextField label="Favorite flower" value={v(s, 'favoriteFlower')} onChange={u(s, 'favoriteFlower')} />
      </div>
      <TextAreaField label="Do you have any pets, including chickens and livestock?" value={v(s, 'pets')} onChange={u(s, 'pets')} rows={2} />
      <TextField label="If you have cats, who changes the litter box?" value={v(s, 'catLitter')} onChange={u(s, 'catLitter')} />
      <TextAreaField label="What do you like to do in your free time?" value={v(s, 'hobbies')} onChange={u(s, 'hobbies')} rows={3} />
      <TextField label="Do you collect anything special?" value={v(s, 'collections')} onChange={u(s, 'collections')} />
      <TextAreaField label="Where would you most like to travel and why?" value={v(s, 'dreamTravel')} onChange={u(s, 'dreamTravel')} rows={2} />
      <QualitiesMaxField label="Choose 3 qualities that feel most like you today"
        value={v(s, 'qualities')} onChange={u(s, 'qualities')} options={QUALITIES_OPTIONS} max={3} />
      <TextAreaField label="How would you describe yourself? Please include a description of your personality and temperament." value={v(s, 'personality')} onChange={u(s, 'personality')}
        placeholder="Share a bit about your personality, hobbies, and what makes you you..." rows={4} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 8. Academic Information
// ─────────────────────────────────────────────────────────
function AcademicSection({ v, u }) {
  const s = 'academic'
  return (
    <div className="space-y-6">
      <SelectField label="Highest level of education" value={v(s, 'educationLevel')} onChange={u(s, 'educationLevel')}
        options={['Some High School', 'High School Diploma / GED', 'Some College', 'Associate Degree', "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Vocational / Trade School', 'Other']} />
      <YesNoField label="Are you currently enrolled in school?" value={v(s, 'currentlyInSchool')} onChange={u(s, 'currentlyInSchool')} />
      {v(s, 'currentlyInSchool') === 'yes' && (
        <TextAreaField label="Please provide details" value={v(s, 'currentlyInSchoolDetails')} onChange={u(s, 'currentlyInSchoolDetails')} rows={2} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 9. Experienced Surrogate Information
// ─────────────────────────────────────────────────────────
function ExperiencedSurrogateSection({ v, u, profile, setProfile }) {
  const s = 'experiencedSurrogate'
  const journeys = normalizeJourneyList(profile?.experiencedSurrogate?.journeys)
  const journeyCount = parseInt(v(s, 'surrogacyTimes')) || 0

  const updateJourneyCount = (val) => {
    const n = Math.max(0, Math.min(10, parseInt(val) || 0))
    u(s, 'surrogacyTimes')(String(n))
    const current = [...journeys]
    if (n > current.length) {
      for (let i = current.length; i < n; i++) {
        current.push({ reName: '', reLocation: '', reDates: '', outcome: '', embryoSourceList: [] })
      }
    }
    setProfile(prev => ({
      ...prev,
      experiencedSurrogate: { ...prev.experiencedSurrogate, journeys: current.slice(0, n) }
    }))
  }

  const updateJourney = (idx, field, val) => {
    setProfile(prev => {
      const updated = normalizeJourneyList(prev.experiencedSurrogate?.journeys)
      updated[idx] = { ...updated[idx], [field]: val }
      return { ...prev, experiencedSurrogate: { ...prev.experiencedSurrogate, journeys: updated } }
    })
  }

  return (
    <div className="space-y-6">
      <YesNoField label="Have you ever been a surrogate before?" value={v(s, 'previousSurrogate')} onChange={u(s, 'previousSurrogate')} />
      {v(s, 'previousSurrogate') === 'yes' && (
        <>
          <div className="max-w-xs">
            <Field label="How many times?">
              <Input type="number" min="1" max="10" value={v(s, 'surrogacyTimes')} onChange={e => updateJourneyCount(e.target.value)} className="bg-white" />
            </Field>
          </div>

          {journeyCount > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-700">Please provide details for each surrogacy journey:</p>
              {Array.from({ length: journeyCount }).map((_, idx) => {
                const j = journeys[idx] || {}
                return (
                  <div key={idx} className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#1A3638]/5 border-b border-gray-200">
                      <span className="text-sm font-semibold text-[#1A3638]">Surrogacy Journey #{idx + 1}</span>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <TextField label="What was the name of the Reproductive Doctor?" value={j.reName || ''} onChange={val => updateJourney(idx, 'reName', val)} placeholder="Dr. Smith" />
                        <TextField label="What City/State was the IVF clinic located in?" value={j.reLocation || ''} onChange={val => updateJourney(idx, 'reLocation', val)} placeholder="e.g. Los Angeles, CA" />
                      </div>
                      <TextField label="What years were you seen there?" value={j.reDates || ''} onChange={val => updateJourney(idx, 'reDates', val)} placeholder="e.g. 2022-2023" />
                      <SelectField label="What was the outcome of this surrogacy journey?" value={j.outcome || ''} onChange={val => updateJourney(idx, 'outcome', val)}
                        options={['Healthy delivery', 'Delivery with complications', 'Miscarriage', 'Chemical pregnancy', 'No pregnancy achieved', 'Other']} />
                      <CheckboxGroupField
                        label="Embryo source (select all that apply)"
                        value={Array.isArray(j.embryoSourceList) ? j.embryoSourceList : []}
                        onChange={val => updateJourney(idx, 'embryoSourceList', val)}
                        options={["IM's Egg", 'Donor Egg', "IF's Sperm", 'Donor Sperm', 'Embryo Adoption', 'Unknown']}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <TextAreaField label="Please describe the overall experience. What did you like and what would you like to avoid in your next journey?" value={v(s, 'overallExperience')} onChange={u(s, 'overallExperience')} rows={3} />
        </>
      )}
      {v(s, 'previousSurrogate') === 'no' && (
        <p className="text-sm text-stone-400 italic">This section is for experienced surrogates. If this is your first journey, you can skip ahead!</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 10. Journey Hopes & Wishes
// ─────────────────────────────────────────────────────────
function HopesWishesSection({ v, u, profile }) {
  const s = 'hopesWishes'
  const hasPartner = ['In a Relationship', 'Married', 'Domestic Partnership'].includes(profile?.personal?.maritalStatus)
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-pink-50/50 border border-pink-100">
        <h4 className="font-medium text-[#1A3638] mb-3">Your Motivation</h4>
        <div className="space-y-4">
          <TextAreaField label="Why do you want to become a surrogate (or be a repeat surrogate), and how long have you been thinking about it?" value={v(s, 'reasonForSurrogacy')} onChange={u(s, 'reasonForSurrogacy')}
            placeholder="Please be specific with your answer" rows={4} />
          <TextAreaField label="How do you plan to use the money that you make from being a surrogate?" value={v(s, 'compensationUse')} onChange={u(s, 'compensationUse')} rows={2} />
          <TextAreaField label="Please explain how you see surrogacy fitting into your life" value={v(s, 'surrogacyFit')} onChange={u(s, 'surrogacyFit')} rows={2} />
          <TextAreaField label="Who will be your resource to help with your children for appointments / possible bed rest etc.? Please provide specific details on your support system." value={v(s, 'supportSystem')} onChange={u(s, 'supportSystem')} rows={3} />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-[#1A3638]">Willingness</h4>
        <YesNoField label="Are you willing to have 3 transfer attempts with the same IP if that is what it takes to achieve a pregnancy?" value={v(s, 'threeTransferAttempts')} onChange={u(s, 'threeTransferAttempts')} />
        <YesNoField label="Are you willing to reduce the amount of caffeine and soda you consume during the pregnancy?" value={v(s, 'reduceCaffeine')} onChange={u(s, 'reduceCaffeine')} />
        <TextAreaField label="Are you open to making other lifestyle changes at the request of the Intended Parents?" value={v(s, 'lifestyleChanges')} onChange={u(s, 'lifestyleChanges')} rows={2} placeholder="Please explain..." />
        {false && (
          <TextAreaField label="Please explain" value={v(s, 'lifestyleChangesDetails')} onChange={u(s, 'lifestyleChangesDetails')} rows={2} />
        )}
        <SelectField label="Are you open to pumping colostrum and breast milk for your IP if they were to request this?" value={v(s, 'pumpBreastmilk')} onChange={u(s, 'pumpBreastmilk')}
          options={['Yes', 'No', 'Willing to try', 'Undecided']} />
      </div>

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#1A3638] mb-3">Ideal Match & Communication</h4>
        <div className="space-y-4">
          <TextAreaField label="Describe ideal intended parent(s) for whom you would like to be a surrogate" value={v(s, 'idealIPs')} onChange={u(s, 'idealIPs')} rows={3} />
          <SelectField label="What is the best form of communication that you are comfortable using?" value={v(s, 'preferredCommunication')} onChange={u(s, 'preferredCommunication')}
            options={['Text', 'Email', 'Phone Calls', 'FaceTime / Video Calls', 'Mix of Everything']} />
          <SelectField label="How much involvement from the Intended Parents do you want during the pregnancy?" value={v(s, 'ipInvolvement')} onChange={u(s, 'ipInvolvement')}
            options={['Very Involved', 'Moderately Involved', 'Occasional Check-ins', 'Minimal']} />
          <SelectField label="Would you be willing to have the Intended Parents at doctor appointments and in delivery room?" value={v(s, 'ipsAtAppointments')} onChange={u(s, 'ipsAtAppointments')}
            options={['Yes', 'No', 'Undecided']} />
          {v(s, 'ipsAtAppointments') === 'No' && (
            <TextAreaField label="Please explain" value={v(s, 'ipsAtAppointmentsDetails')} onChange={u(s, 'ipsAtAppointmentsDetails')} rows={2} />
          )}
          <TextAreaField label="Is there anyone else you would like to have in the delivery room (partner/spouse, friend, mom)?" value={v(s, 'deliveryRoomOthers')} onChange={u(s, 'deliveryRoomOthers')} rows={2} />
          <TextAreaField label="How do you feel about having Intended Parents who cannot attend doctor appointments and see you on a regular basis?" value={v(s, 'ipsCantAttend')} onChange={u(s, 'ipsCantAttend')} rows={2} />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-[#1A3638]">Matching Preferences</h4>
        <YesNoField label="Are you willing to match with Intended Parents who already have children?" value={v(s, 'ipsWithChildren')} onChange={u(s, 'ipsWithChildren')} />
        <YesNoField label="Are you open to matching with LGBTQ+ individual/couples?" value={v(s, 'openLGBTQ')} onChange={u(s, 'openLGBTQ')} />
        <YesNoField label="Are you willing to match with a single Intended Parent?" value={v(s, 'openSingleIP')} onChange={u(s, 'openSingleIP')} />
        <YesNoField label="Are you willing to have the embryo transfer in another state?" value={v(s, 'transferAnotherState')} onChange={u(s, 'transferAnotherState')} />
        {v(s, 'transferAnotherState') === 'no' && (
          <TextAreaField label="Please explain" value={v(s, 'transferAnotherStateDetails')} onChange={u(s, 'transferAnotherStateDetails')} rows={2} />
        )}
        <YesNoField label="Are you willing to match with Intended Parents who live outside of the U.S.?" value={v(s, 'ipsOutsideUS')} onChange={u(s, 'ipsOutsideUS')} />
        <TextAreaField label="Who will care for your child(ren) when you need to travel for surrogacy?" value={v(s, 'childCareTraveling')} onChange={u(s, 'childCareTraveling')} rows={2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="When are you ready to begin?" value={v(s, 'whenReadyToBegin')} onChange={u(s, 'whenReadyToBegin')}
          options={['Immediately', 'Within 1-3 months', 'Within 3-6 months', 'Within 6-12 months', '1+ year']} />
        <TextAreaField label="Ideal relationship with Intended Parent(s) post birth" value={v(s, 'postBirthRelationship')} onChange={u(s, 'postBirthRelationship')} rows={2} placeholder="Describe your ideal post-birth relationship..." />
      </div>

      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <h4 className="font-medium text-[#1A3638] mb-3">Medical Decisions</h4>
        <div className="space-y-4">
          <YesNoField label="If recommended by a physician, would you be willing to undergo CVS, amniocentesis or other diagnostic testing?" value={v(s, 'cvsAmnio')} onChange={u(s, 'cvsAmnio')} />
          {v(s, 'cvsAmnio') === 'no' && (
            <TextAreaField label="Please explain" value={v(s, 'cvsAmnioDetails')} onChange={u(s, 'cvsAmnioDetails')} rows={2} />
          )}
          <TextAreaField label="Willingness to terminate for a serious genetic or medical condition and follow IP(s) direction and doctor recommendation?" value={v(s, 'willingnessToTerminate')} onChange={u(s, 'willingnessToTerminate')} rows={2} />
          {hasPartner && (
            <YesNoField label="Would your spouse or support person support the decision for termination?" value={v(s, 'partnerAgreesTermination')} onChange={u(s, 'partnerAgreesTermination')} />
          )}
          <YesNoField label="Are there any specific conditions where you would not terminate a pregnancy?" value={v(s, 'conditionsWontTerminate')} onChange={u(s, 'conditionsWontTerminate')} />
          {v(s, 'conditionsWontTerminate') === 'yes' && (
            <TextAreaField label="Please explain" value={v(s, 'conditionsWontTerminateDetails')} onChange={u(s, 'conditionsWontTerminateDetails')} rows={2} />
          )}
          <SelectField label="How many embryos are you in agreement to transfer at a time?" value={v(s, 'embryosToTransfer')} onChange={u(s, 'embryosToTransfer')}
            options={['1', '2', 'Doctor recommendation', 'Open to discussion']} />
          {v(s, 'embryosToTransfer') === '1' && (
            <YesNoField label="If the 1 transferred embryo splits, would you be in agreement to carrying twins?" value={v(s, 'carryTwins')} onChange={u(s, 'carryTwins')} />
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#1A3638]/5 border border-[#1A3638]/10">
        <h4 className="font-medium text-[#1A3638] mb-3">Compensation</h4>
        <div className="space-y-4">
          <CurrencyField label="Surrogate base fee" value={v(s, 'desiredCompensation')} onChange={u(s, 'desiredCompensation')} />
        </div>
      </div>

      <TextAreaField label="What would you like to add or say to potential Intended Parent(s) who are considering working with you as their surrogate?" value={v(s, 'additionalComments')} onChange={u(s, 'additionalComments')}
        placeholder="Help them get to know you better or reassure them" rows={4} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 9. Photos — drag-to-reorder, click-to-edit (crop/rotate)
// ─────────────────────────────────────────────────────────

function SortablePhoto({ photo, index, total, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.path })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-200 touch-none" {...attributes} {...listeners}>
      <img src={photo.url} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(photo) }}
          className="p-1.5 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow-sm">
          <CropIcon className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(photo) }}
          className="p-1.5 rounded-full bg-white/90 text-red-500 hover:bg-white shadow-sm">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function PhotoEditor({ photo, onSave, onClose }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedArea, setCroppedArea] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!croppedArea) return
    setSaving(true)
    try {
      const blob = await getCroppedImg(photo.url, croppedArea, rotation)
      const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
      await onSave(photo, file)
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full h-80 sm:h-96 bg-gray-900 rounded-xl overflow-hidden">
        <Cropper
          image={photo.url}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, area) => setCroppedArea(area)}
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="text-xs text-gray-500 shrink-0">Zoom</label>
        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))}
          className="flex-1 accent-[#D4A853]" />
        <Button variant="outline" size="sm" onClick={() => setRotation(r => (r + 90) % 360)} className="gap-1.5">
          <RotateCw className="w-3.5 h-3.5" /> Rotate
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#D4A853', color: '#fff' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function PhotosSection() {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
  const [caseId, setCaseId] = useState(null)
  const [photos, setPhotos] = useState([])
  const [coverPhoto, setCoverPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  // Fetch intake case ID for photos uploaded by admin
  useEffect(() => {
    if (!currentUser?.email || !supabase) return
    supabase.from('intake_submissions').select('id').eq('applicant_email', currentUser.email.trim().toLowerCase()).order('submitted_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data?.id) setCaseId(String(data.id)) })
      .catch(() => {})
  }, [currentUser?.email])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    async function loadPhotos() {
      // Load from userId (auth UUID)
      const [gallery, headshots] = await Promise.all([
        listProfilePhotos(userId).catch(() => []),
        listProfilePhotos(`${userId}/headshot`).catch(() => []),
      ])
      // Also try caseId (intake submission ID) if different from userId
      if (caseId && caseId !== userId) {
        const [gallery2, headshots2] = await Promise.all([
          listProfilePhotos(caseId).catch(() => []),
          listProfilePhotos(`${caseId}/headshot`).catch(() => []),
        ])
        const allGallery = [...gallery, ...gallery2]
        const allHeadshots = [...headshots, ...headshots2]
        setPhotos(allGallery)
        setCoverPhoto(allHeadshots.length > 0 ? allHeadshots[0] : null)
      } else {
        setPhotos(gallery)
        setCoverPhoto(headshots.length > 0 ? headshots[0] : null)
      }
    }
    loadPhotos()
  }, [userId, caseId])

  // Combine cover + gallery for display
  const allPhotos = useMemo(() => {
    if (!coverPhoto) return photos
    return [{ ...coverPhoto, isCover: true }, ...photos]
  }, [coverPhoto, photos])

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { setError('Photos must be under 10MB each'); continue }
        const jpeg = await convertToJpeg(file)
        const result = await uploadProfilePhoto(userId, jpeg)
        if (result) setPhotos(prev => [...prev, result])
      }
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(photo) {
    try {
      await deleteProfilePhoto(photo.path)
      setPhotos(prev => prev.filter(p => p.path !== photo.path))
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  async function handleCropSave(oldPhoto, croppedFile) {
    try {
      // Upload cropped version, delete old
      const result = await uploadProfilePhoto(userId, croppedFile)
      if (result) {
        await deleteProfilePhoto(oldPhoto.path).catch(() => {})
        setPhotos(prev => prev.map(p => p.path === oldPhoto.path ? result : p))
      }
      setEditing(null)
    } catch (err) {
      setError(err.message || 'Save failed')
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPhotos(prev => {
      const oldIndex = prev.findIndex(p => p.path === active.id)
      const newIndex = prev.findIndex(p => p.path === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const emptySlots = Math.max(0, 4 - photos.length)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload photos that show your personality! Your cover photo is set in Personal Information above. Drag to reorder gallery photos. Tap a photo to crop or rotate.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map(p => p.path)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {/* Cover photo from About Me — not draggable */}
            {coverPhoto && (
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200">
                <img src={coverPhoto.url} alt="" className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#D4A853] text-white text-[10px] font-bold shadow-sm">Cover</span>
              </div>
            )}

            {/* Gallery photos — draggable */}
            {photos.map((photo, i) => (
              <SortablePhoto key={photo.path} photo={photo} index={coverPhoto ? i + 1 : i} total={photos.length + (coverPhoto ? 1 : 0)}
                onEdit={setEditing} onDelete={handleDelete} />
            ))}

            {/* Upload button */}
            <label className={`aspect-square rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-[#D4A853]/50 hover:bg-pink-50/30 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="text-center">
                {uploading ? (
                  <Loader2 className="w-8 h-8 mx-auto text-[#D4A853] animate-spin" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 mx-auto text-gray-300" />
                    <span className="text-xs text-gray-400 mt-1 block">Upload</span>
                  </>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple
                onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>

            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50" />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-gray-400">JPG, PNG, or HEIC — up to 10MB each.</p>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && <PhotoEditor photo={editing} onSave={handleCropSave} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
