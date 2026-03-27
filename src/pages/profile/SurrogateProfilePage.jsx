import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  User, Home, Baby, Stethoscope, HeartPulse, Apple, Briefcase,
  Heart, Camera, ChevronDown, CheckCircle2, Circle, Plus, Trash2,
  Ruler, Scale, CalendarDays, MapPin, Upload,
  Loader2, X, RotateCw, Crop as CropIcon, Eye,
  Weight as WeightIcon, Droplets, Activity, Shield as ShieldIcon,
  DollarSign
} from 'lucide-react'
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
import { fetchIntakeByEmail, uploadProfilePhoto, deleteProfilePhoto, listProfilePhotos, saveSurrogateProfile, fetchSurrogateProfile } from '@/lib/db'
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
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
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
        className="bg-white"
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
        className="bg-white"
      />
    </Field>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...', className = '' }) {
  return (
    <Field label={label} className={className}>
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

function YesNoField({ label, value, onChange, className = '' }) {
  return (
    <Field label={label} className={className}>
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

function ProfilePhotoUpload({ label = 'Profile Photo', hint, userId, subfolder = 'headshot' }) {
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    listProfilePhotos(`${userId}/${subfolder}`).then(photos => {
      if (photos.length > 0) setPhoto(photos[0])
    }).catch(() => {})
  }, [userId, subfolder])

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
      if (result) setPhoto(result)
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
        <label className={`flex items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-[#ed148c]/50 hover:bg-pink-50/30 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="text-center">
            {uploading ? (
              <Loader2 className="w-6 h-6 mx-auto text-[#ed148c] animate-spin" />
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
          stroke="#ed148c" strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-[#283693]">{percent}%</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────

const SECTION_META = [
  { key: 'personal', title: 'Personal Information', icon: User, description: 'Basic info, relationships, and household' },
  { key: 'pregnancyHistory', title: 'Pregnancy History', icon: Baby, description: 'Previous pregnancies and deliveries' },
  { key: 'fertility', title: 'Fertility Information', icon: Stethoscope, description: 'Reproductive health and fertility details' },
  { key: 'general', title: 'General Information', icon: Home, description: 'Housing, lifestyle, habits, and background' },
  { key: 'health', title: 'Health Information', icon: HeartPulse, description: 'Medical history, medications, and conditions' },
  { key: 'employment', title: 'Employment Information', icon: Briefcase, description: 'Work, income, and insurance details' },
  { key: 'interests', title: 'Interests', icon: Heart, description: 'Favorites, hobbies, and personality' },
  { key: 'academic', title: 'Academic Information', icon: Apple, description: 'Education and training' },
  { key: 'experiencedSurrogate', title: 'Experienced Surrogate Information', icon: Stethoscope, description: 'Previous surrogacy journey details' },
  { key: 'hopesWishes', title: 'Journey Hopes & Wishes', icon: Heart, description: 'Your surrogacy goals, preferences, and compensation' },
  { key: 'photos', title: 'Photos', icon: Camera, description: 'Share photos for your matching profile' },
]

// Required fields per section for completion tracking
function isPregnancyComplete(p) {
  if (!p.outcome || !p.dob || !p.gestationWeeks || !p.deliveryType) return false
  if (p.outcome === 'Live Birth' && !p.weight) return false
  return true
}

const REQUIRED_FIELDS = {
  personal: ['firstName', 'city', 'state', 'heightFt', 'weight', 'maritalStatus'],
  pregnancyHistory: ['numberOfPregnancies'],
  fertility: ['sameBioFather', 'contraceptiveMethod', 'cycleLength'],
  general: ['smokeVape', 'alcoholDrugs', 'typicalDiet', 'exerciseFrequency', 'sleepHours', 'reliableVehicle'],
  health: ['mentalHealthDiagnosis', 'bloodType', 'rhFactor', 'openToVaccinations'],
  employment: ['currentlyEmployed', 'healthInsurance'],
  interests: ['personality'],
  academic: ['educationLevel'],
  experiencedSurrogate: [],
  hopesWishes: ['reasonForSurrogacy', 'whenReadyToBegin', 'desiredCompensation'],
  photos: [],
}

function countCompleted(data, sectionKey) {
  const fields = REQUIRED_FIELDS[sectionKey] || []
  if (fields.length === 0) return { filled: 0, total: 0, complete: false }
  let filled = 0
  for (const f of fields) {
    const val = data?.[sectionKey]?.[f]
    if (val !== undefined && val !== '' && val !== null) filled++
  }
  // Special: pregnancy section requires all pregnancy details filled
  if (sectionKey === 'pregnancyHistory') {
    const numPreg = parseInt(data?.pregnancyHistory?.numberOfPregnancies) || 0
    const pregnancies = data?.pregnancyHistory?.pregnancies || []
    if (numPreg < 1) return { filled: 0, total: 1, complete: false }
    const completedPregs = pregnancies.filter(p => isPregnancyComplete(p)).length
    const allPregsComplete = completedPregs >= numPreg
    return { filled: allPregsComplete ? numPreg + 1 : completedPregs, total: numPreg + 1, complete: allPregsComplete }
  }
  return { filled, total: fields.length, complete: filled === fields.length }
}

// ─────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────

function calculateBMI(ft, inches, lbs) {
  const f = parseFloat(ft); const i = parseFloat(inches); const w = parseFloat(lbs)
  if (!f || !w) return ''
  const totalInches = f * 12 + (i || 0)
  return ((w / (totalInches * totalInches)) * 703).toFixed(1)
}

export default function SurrogateProfilePage() {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
  const [profile, setProfile] = useState(() => loadProfile(userId))
  const [profileApproved, setProfileApproved] = useState(false)
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
      }))
    })
  }, [currentUser?.email])

  // Auto-save on change (localStorage immediately, Supabase debounced)
  // Skip saving if profile is approved
  const saveTimer = useRef(null)
  useEffect(() => {
    if (profileApproved) return
    saveProfile(userId, profile)
    if (currentUser?.id && currentUser?.email) {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveSurrogateProfile(currentUser.id, currentUser.email, profile).catch(() => {})
      }, 2000)
    }
    return () => clearTimeout(saveTimer.current)
  }, [profile, userId, currentUser?.id, currentUser?.email, profileApproved])

  // Sync with Supabase on first visit
  useEffect(() => {
    if (!currentUser?.id || !currentUser?.email) return
    fetchSurrogateProfile(currentUser.id).then(result => {
      if (result?.status === 'approved') setProfileApproved(true)
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
            else merged[section] = { ...merged[section], ...fields }
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
    const photos = await listProfilePhotos(userId)
    const headshot = await listProfilePhotos(`${userId}/headshot`)
    setPreviewPhotos([...headshot, ...photos])
    setPreviewOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <ProgressRing percent={overallCompletion} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#283693]">My Surrogate Profile</h1>
            <p className="text-gray-500 mt-1">
              Complete your matching profile so intended parents can get to know you.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ed148c] to-[#283693] rounded-full transition-all duration-700"
                  style={{ width: `${overallCompletion}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500">{overallCompletion}% complete</span>
            </div>
          </div>
          <Button onClick={openPreview} variant="outline" className="gap-1.5 shrink-0 border-[#283693] text-[#283693]">
            <Eye className="w-4 h-4" /> {previewOpen ? 'Edit Profile' : 'Preview'}
          </Button>
        </div>

        {/* Approved banner */}
        {profileApproved && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Profile Approved</p>
              <p className="text-xs text-green-600">Your profile has been reviewed and approved by the ABC team. It is now visible to intended parents.</p>
            </div>
          </div>
        )}

        {previewOpen ? (
          /* ── Inline Preview ── */
          <div className="max-w-[850px] mx-auto">
            <ProfilePreview profile={profile} photos={previewPhotos} />
          </div>
        ) : (
          /* ── Section Cards ── */
          <>
            {SECTION_META.map(sec => {
              const { filled, total, complete } = countCompleted(profile, sec.key)
              const Icon = sec.icon
              const isOpen = !!openSections[sec.key]

              return (
                <Collapsible key={sec.key} open={isOpen} onOpenChange={() => toggleSection(sec.key)}>
                  <Card id={`section-${sec.key}`} className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            complete ? 'bg-green-100' : 'bg-[#283693]/10'
                          }`}>
                            <Icon className={`w-5 h-5 ${complete ? 'text-green-600' : 'text-[#283693]'}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{sec.title}</CardTitle>
                            <CardDescription>{sec.description}</CardDescription>
                          </div>
                        </div>
                        <CardAction>
                          <div className="flex items-center gap-3">
                            {total > 0 && (
                              <span className="text-xs text-gray-400">{filled}/{total}</span>
                            )}
                            {complete ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : total > 0 ? (
                              <Circle className="w-5 h-5 text-gray-300" />
                            ) : null}
                            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </CardAction>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className={profileApproved ? 'pointer-events-none opacity-60' : ''}>
                        <SectionBody sectionKey={sec.key} v={v} u={u} profile={profile} setProfile={setProfile} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })}
          </>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Profile Preview — shows what IPs will see
// ─────────────────────────────────────────────────────────
function PVSection({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#283693]/5 to-transparent">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4.5 h-4.5 text-[#283693]" />}
          <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wide">{title}</h3>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function PVField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="italic text-gray-300">Not provided</span>}</p>
    </div>
  )
}

function PVYesNo({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
        value === 'yes' ? 'bg-green-50 text-green-700' : value === 'no' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
      }`}>{value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '—'}</span>
    </div>
  )
}

export function ProfilePreview({ profile, photos }) {
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
  const heroPhoto = photos?.[0]
  const hasPartner = ['In a Relationship', 'Married', 'Domestic Partnership'].includes(about.maritalStatus)
  const householdMembers = about.householdMembers || []

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
    <div className="bg-gradient-to-b from-[#fdf8f3] to-[#f5f0eb] min-h-full">
      {/* ── Cover Photo ── */}
      {heroPhoto ? (
        <div className="w-full h-72 sm:h-96 overflow-hidden relative">
          <img src={heroPhoto.url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-[#ed148c]/20 via-[#283693]/10 to-[#ed148c]/10 flex items-center justify-center">
          <Camera className="w-10 h-10 text-gray-300" />
        </div>
      )}

      {/* ── Photo Gallery ── */}
      {photos.length > 1 && (
        <div className="flex gap-3 px-8 -mt-8 relative z-10">
          {photos.slice(1, 6).map(ph => (
            <div key={ph.path} className="w-16 h-16 rounded-xl overflow-hidden border-3 border-white shadow-md shrink-0">
              <img src={ph.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {photos.length > 6 && (
            <div className="w-16 h-16 rounded-xl bg-white/90 border-3 border-white shadow-md flex items-center justify-center text-sm font-bold text-[#283693]">
              +{photos.length - 6}
            </div>
          )}
        </div>
      )}

      {/* ── Summary Header ── */}
      <div className="mx-6 sm:mx-8 mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h2 className="text-3xl font-heading font-bold text-[#283693]">{firstName}</h2>
            {(about.city || about.state) && (
              <p className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-gray-500 mt-1.5">
                <MapPin className="w-4 h-4" />
                {[about.city, about.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {age && (
              <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-[#283693]/5">
                <CalendarDays className="w-5 h-5 text-[#283693] mb-1" />
                <span className="text-2xl font-bold text-[#283693]">{age}</span>
                <span className="text-[11px] text-gray-400">Age</span>
              </div>
            )}
            <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-[#ed148c]/5">
              <DollarSign className="w-5 h-5 text-[#ed148c] mb-1" />
              <span className="text-2xl font-bold text-[#ed148c]">{hopes.desiredCompensation || '—'}</span>
              <span className="text-[11px] text-gray-400">Base Fee</span>
            </div>
          </div>
        </div>
        {/* Bio */}
        {(interests.personality || about.personality) && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-sm leading-relaxed text-gray-600 italic text-center">
              "{(interests.personality || about.personality)}"
            </p>
          </div>
        )}
      </div>

      {/* ── All Sections ── */}
      <div className="px-6 sm:px-8 py-6 space-y-5">

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: Ruler, label: 'Height', value: heightStr },
            { icon: Scale, label: 'Weight', value: about.weight ? `${about.weight} lbs` : '' },
            { icon: Activity, label: 'BMI', value: bmi },
            { icon: Droplets, label: 'Blood Type', value: health.bloodType },
            { icon: Heart, label: 'Status', value: about.maritalStatus },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center text-center p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
              <s.icon className="w-4 h-4 text-[#283693] mb-1.5" />
              <span className="text-sm font-bold text-[#283693]">{s.value || '—'}</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Personal Information */}
        <PVSection title="Personal Information" icon={User}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <PVField label="U.S. Citizen" value={about.usCitizen === 'yes' ? 'Yes' : about.usCitizen === 'no' ? 'No' : null} />
            <PVField label="Real ID" value={about.realId === 'yes' ? 'Yes' : about.realId === 'no' ? 'No' : null} />
            <PVField label="Valid Passport" value={about.validPassport === 'yes' ? 'Yes' : about.validPassport === 'no' ? 'No' : null} />
            <PVField label="Other Languages" value={about.otherLanguages === 'yes' ? (about.otherLanguagesDetails || 'Yes') : about.otherLanguages === 'no' ? 'No' : null} />
            {hasPartner && <PVField label="Partner" value={about.partnerName} />}
            {hasPartner && <PVField label="Together" value={about.relationshipLength} />}
          </div>
          {householdMembers.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Household</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {householdMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-[#fdf8f3] rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-800">{m.name || '—'}</span>
                    {m.relationship && <span className="text-[11px] text-gray-400">({m.relationship})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </PVSection>

        {/* Pregnancy History */}
        <PVSection title="Pregnancy History" icon={Baby}>
          <PVField label="Total Pregnancies" value={pregHistory.numberOfPregnancies} />
          {pregnancies.length > 0 && (
            <div className="mt-4 space-y-3">
              {pregnancies.map((pr, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-[#fdf8f3]">
                  <div className="w-8 h-8 rounded-full bg-[#283693]/10 flex items-center justify-center text-xs font-bold text-[#283693] shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{pr.outcome || 'Not specified'}{pr.name ? ` — ${pr.name}` : ''}</p>
                    <p className="text-xs text-gray-400">
                      {[
                        pr.gestationWeeks && `${pr.gestationWeeks}w${pr.gestationDays || ''}`,
                        pr.deliveryType,
                        pr.weight,
                        pr.wasSurrogacy === 'yes' && 'Surrogacy'
                      ].filter(Boolean).join(' · ') || 'Details not yet entered'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PVSection>

        {/* Fertility */}
        <PVSection title="Fertility Information" icon={Stethoscope}>
          <div className="space-y-1">
            <PVYesNo label="Same biological father for all children" value={fertility.sameBioFather} />
            <PVYesNo label="Infertility treatment" value={fertility.infertilityTreatment} />
            <PVYesNo label="Gynecological problems" value={fertility.gynecologicalProblems} />
            <PVYesNo label="Currently breastfeeding" value={fertility.breastfeeding} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-50">
            <PVField label="Contraceptive Method" value={fertility.contraceptiveMethod} />
            <PVField label="Cycles 28–30 days" value={fertility.cycleLength === 'yes' ? 'Yes' : fertility.cycleLength === 'no' ? (fertility.cycleLengthDetails || 'No') : null} />
            <PVField label="Nearest NICU" value={fertility.nearestNICU} />
          </div>
        </PVSection>

        {/* General Information */}
        <PVSection title="General Information" icon={Home}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <PVField label="Home" value={general.homeOwnership} />
            <PVField label="Time at Home" value={general.homeDuration} />
            <PVField label="Children Full Time" value={general.childrenFullTime === 'yes' ? 'Yes' : general.childrenFullTime === 'no' ? 'No' : null} />
            <PVField label="Plan More Children" value={general.planMoreChildren === 'yes' ? 'Yes' : general.planMoreChildren === 'no' ? 'No' : null} />
            <PVField label="Ethnicity" value={general.ethnicity} />
            <PVField label="Religion" value={general.religion} />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-1">
            <PVYesNo label="Smoke or vape" value={general.smokeVape} />
            <PVYesNo label="Alcohol or recreational drugs" value={general.alcoholDrugs} />
            <PVYesNo label="Piercings or tattoos" value={general.piercingsTattoos} />
            <PVYesNo label="Reliable vehicle" value={general.reliableVehicle} />
            <PVYesNo label="Valid driver's license" value={general.validLicense} />
          </div>
          {general.typicalDiet && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <PVField label="Diet & Eating Habits" value={general.typicalDiet} />
            </div>
          )}
          {general.exerciseFrequency && (
            <div className="mt-3">
              <PVField label="Exercise" value={general.exerciseFrequency} />
            </div>
          )}
        </PVSection>

        {/* Health */}
        <PVSection title="Health Information" icon={HeartPulse}>
          <div className="space-y-1">
            <PVYesNo label="Mental health challenge diagnosis" value={health.mentalHealthDiagnosis} />
            <PVYesNo label="Hospitalized for mental health" value={health.mentalHealthHospitalization} />
            <PVYesNo label="Mental health medication" value={health.mentalHealthMedication} />
            <PVYesNo label="Counseling or psychotherapy" value={health.counselingTherapy} />
            <PVYesNo label="Family mental health history" value={health.familyMentalHealth} />
            <PVYesNo label="Open to vaccinations" value={health.openToVaccinations} />
            <PVYesNo label="Covid-19 vaccinated" value={health.covidVaccine} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-50">
            <PVField label="Blood Type" value={health.bloodType} />
            <PVField label="Allergies" value={health.allergies} />
            <PVField label="Last Physical" value={health.lastPhysical} />
            <PVField label="Last Pap" value={health.lastPap} />
          </div>
          {health.medicalConditions && (
            <div className="mt-3">
              <PVField label="Medical Conditions" value={health.medicalConditions} />
            </div>
          )}
        </PVSection>

        {/* Employment */}
        <PVSection title="Employment" icon={Briefcase}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <PVField label="Currently Employed" value={employment.currentlyEmployed === 'yes' ? 'Yes' : employment.currentlyEmployed === 'no' ? 'No' : null} />
            {employment.currentlyEmployed === 'yes' && (
              <>
                <PVField label="Occupation" value={employment.occupation} />
                <PVField label="Work Hours" value={employment.workHours} />
              </>
            )}
            <PVField label="Health Insurance" value={employment.healthInsurance || (employment.insuranceType === 'No insurance' ? 'None' : null)} />
          </div>
        </PVSection>

        {/* Interests */}
        <PVSection title="Interests & Personality" icon={Heart}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <PVField label="Favorite Music" value={interests.favoriteMusic} />
            <PVField label="Favorite Movie" value={interests.favoriteMovie} />
            <PVField label="Favorite Book" value={interests.favoriteBook} />
            <PVField label="Favorite Foods" value={interests.favoriteFoods} />
            <PVField label="Favorite Color" value={interests.favoriteColor} />
            <PVField label="Favorite Flower" value={interests.favoriteFlower} />
          </div>
          {(interests.pets || interests.hobbies || interests.dreamTravel) && (
            <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
              <PVField label="Pets" value={interests.pets} />
              <PVField label="Hobbies & Free Time" value={interests.hobbies} />
              <PVField label="Dream Travel Destination" value={interests.dreamTravel} />
              <PVField label="Collections" value={interests.collections} />
            </div>
          )}
        </PVSection>

        {/* Academic */}
        <PVSection title="Academic Information" icon={Apple}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <PVField label="Education Level" value={academic.educationLevel} />
            <PVField label="Currently in School" value={academic.currentlyInSchool === 'yes' ? (academic.currentlyInSchoolDetails || 'Yes') : academic.currentlyInSchool === 'no' ? 'No' : null} />
          </div>
        </PVSection>

        {/* Experienced Surrogate — only show if they've been a surrogate before */}
        {expSurr.previousSurrogate === 'yes' && (
          <PVSection title="Surrogacy Experience" icon={Stethoscope}>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#ed148c]/10 text-[#ed148c] text-sm font-semibold px-4 py-1.5">
                <CheckCircle2 className="w-4 h-4" /> Experienced Surrogate — {expSurr.surrogacyTimes || '?'} time(s)
              </div>
              <PVField label="RE Doctors" value={expSurr.reDoctors} />
              <PVField label="Surrogacy Pregnancy History" value={expSurr.surrogacyPregnancyHistory} />
              <PVField label="Embryo Details" value={expSurr.embryoSource} />
              <PVField label="Overall Experience" value={expSurr.overallExperience} />
            </div>
          </PVSection>
        )}

        {/* Journey Hopes & Wishes */}
        <PVSection title="Journey Hopes & Wishes" icon={Heart}>
          <div className="space-y-4">
            <PVField label="Why I Want to Be a Surrogate" value={hopes.reasonForSurrogacy} />
            <PVField label="How I'll Use the Compensation" value={hopes.compensationUse} />
            <PVField label="How Surrogacy Fits Into My Life" value={hopes.surrogacyFit} />
            <PVField label="My Support System" value={hopes.supportSystem} />
          </div>
          <div className="mt-5 pt-4 border-t border-gray-50 space-y-1">
            <PVYesNo label="Willing to have 3 transfer attempts" value={hopes.threeTransferAttempts} />
            <PVYesNo label="Willing to reduce caffeine" value={hopes.reduceCaffeine} />
            <PVYesNo label="Open to lifestyle changes at IP request" value={hopes.lifestyleChanges} />
            <PVYesNo label="Open to pumping colostrum/breast milk" value={hopes.pumpBreastmilk} />
            <PVYesNo label="IPs at appointments and delivery" value={hopes.ipsAtAppointments} />
            <PVYesNo label="Match with IPs who have children" value={hopes.ipsWithChildren} />
            <PVYesNo label="Open to LGBTQ+ IPs" value={hopes.openLGBTQ} />
            <PVYesNo label="Open to single IP" value={hopes.openSingleIP} />
            <PVYesNo label="Embryo transfer in another state" value={hopes.transferAnotherState} />
            <PVYesNo label="IPs outside the U.S." value={hopes.ipsOutsideUS} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-50">
            <PVField label="Ideal Intended Parents" value={hopes.idealIPs} />
            <PVField label="Preferred Communication" value={hopes.preferredCommunication} />
            <PVField label="IP Involvement During Pregnancy" value={hopes.ipInvolvement} />
            <PVField label="Ready to Begin" value={hopes.whenReadyToBegin} />
            <PVField label="Post-Birth Relationship" value={hopes.postBirthRelationship} />
            <PVField label="Embryos to Transfer" value={hopes.embryosToTransfer} />
          </div>
          <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-[#283693]/5 to-[#ed148c]/5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Base Fee</p>
                <p className="text-xl font-bold text-[#ed148c]">{hopes.desiredCompensation || '—'}</p>
              </div>
              {hopes.compensationNegotiable && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${hopes.compensationNegotiable === 'yes' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {hopes.compensationNegotiable === 'yes' ? 'Negotiable' : 'Firm'}
                </span>
              )}
            </div>
          </div>
          {hopes.additionalComments && (
            <div className="mt-4 p-4 rounded-xl bg-[#fdf8f3] border border-gray-100">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Message to Intended Parents</p>
              <p className="text-sm text-gray-700 leading-relaxed">{hopes.additionalComments}</p>
            </div>
          )}
        </PVSection>

        {/* Footer */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 text-xs text-gray-400">
            <img src="/abc-logo.png" alt="" className="h-5 opacity-30" />
            This is a preview of how intended parents will see your profile.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Section body router
// ─────────────────────────────────────────────────────────
function SectionBody({ sectionKey, v, u, profile, setProfile }) {
  switch (sectionKey) {
    case 'personal': return <PersonalSection v={v} u={u} />
    case 'pregnancyHistory': return <PregnancyHistorySection v={v} u={u} profile={profile} setProfile={setProfile} />
    case 'fertility': return <FertilitySection v={v} u={u} profile={profile} />
    case 'general': return <GeneralSection v={v} u={u} profile={profile} />
    case 'health': return <HealthSection v={v} u={u} />
    case 'employment': return <EmploymentSection v={v} u={u} profile={profile} />
    case 'interests': return <InterestsSection v={v} u={u} />
    case 'academic': return <AcademicSection v={v} u={u} />
    case 'experiencedSurrogate': return <ExperiencedSurrogateSection v={v} u={u} />
    case 'hopesWishes': return <HopesWishesSection v={v} u={u} profile={profile} />
    case 'photos': return <PhotosSection v={v} u={u} />
    default: return null
  }
}

// ─────────────────────────────────────────────────────────
// 1. Personal Information (merged About Me + Family)
// ─────────────────────────────────────────────────────────
function PersonalSection({ v, u }) {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
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
        <ProfilePhotoUpload label="Profile Photo" hint="Upload a favorite recent photo of just you!" userId={userId} subfolder="portrait" />
        <ProfilePhotoUpload label="Cover Photo" hint="Upload a favorite picture of you with your family or kids!" userId={userId} subfolder="headshot" />
      </div>
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
          <div className="h-9 flex items-center px-3 rounded-md border bg-gray-50 text-sm font-medium text-[#283693]">{bmi}</div>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Are you a U.S. Citizen or Permanent Resident?" value={v(s, 'usCitizen')} onChange={u(s, 'usCitizen')} />
        <YesNoField label="Do you have a Real ID?" value={v(s, 'realId')} onChange={u(s, 'realId')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Do you have a current/valid passport?" value={v(s, 'validPassport')} onChange={u(s, 'validPassport')} />
        <YesNoField label="Do you (or anyone in your household) speak a language other than English?" value={v(s, 'otherLanguages')} onChange={u(s, 'otherLanguages')} />
      </div>
      {v(s, 'otherLanguages') === 'yes' && (
        <TextField label="Which language(s)?" value={v(s, 'otherLanguagesDetails')} onChange={u(s, 'otherLanguagesDetails')} />
      )}

      <div className="p-4 rounded-xl bg-[#283693]/5 border border-[#283693]/10">
        <h4 className="font-medium text-[#283693] mb-3">Relationship & Household</h4>
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
                      ? 'border-[#283693] bg-[#283693]/5 shadow-md'
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
            <div className="rounded-xl border-2 border-[#283693] bg-white p-5 space-y-4 shadow-lg mt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-[#283693] text-lg">Pregnancy #{expandedIdx + 1} Details</h4>
                <Button variant="ghost" size="sm" onClick={() => setExpandedIdx(null)} className="text-stone-400 text-xs">
                  Done
                </Button>
              </div>

              <SelectField label="Pregnancy Outcome" value={pregnancies[expandedIdx]?.outcome || ''} onChange={val => updatePregnancy(expandedIdx, 'outcome', val)}
                options={['Live Birth', 'Miscarriage', 'Stillborn', 'Ectopic Pregnancy', 'Termination']} />

              <YesNoField label="Was this a surrogacy pregnancy?" value={pregnancies[expandedIdx]?.wasSurrogacy || ''} onChange={val => updatePregnancy(expandedIdx, 'wasSurrogacy', val)} />

              {pregnancies[expandedIdx]?.wasSurrogacy === 'yes' && (
                <TextField label="Cycles to conceive" value={pregnancies[expandedIdx]?.cyclesToConceive || ''} onChange={val => updatePregnancy(expandedIdx, 'cyclesToConceive', val)} type="number" className="max-w-xs" />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label={pregnancies[expandedIdx]?.outcome === 'Live Birth' ? "Child's Name" : "Notes (optional)"} value={pregnancies[expandedIdx]?.name || ''} onChange={val => updatePregnancy(expandedIdx, 'name', val)} placeholder={pregnancies[expandedIdx]?.outcome === 'Miscarriage' ? 'e.g. how far along' : ''} />
                <TextField label="Date (DOB or date of event)" value={pregnancies[expandedIdx]?.dob || ''} onChange={val => updatePregnancy(expandedIdx, 'dob', val)} type="date" />
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

              {pregnancies[expandedIdx]?.outcome === 'Live Birth' && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <SelectField label="Sex" value={pregnancies[expandedIdx]?.sex || ''} onChange={val => updatePregnancy(expandedIdx, 'sex', val)}
                      options={['Male', 'Female']} />
                    <SelectField label="Delivery Type" value={pregnancies[expandedIdx]?.deliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'deliveryType', val)}
                      options={['Vaginal', 'C-Section']} />
                    <SelectField label="Single or Multiples" value={pregnancies[expandedIdx]?.singleOrMultiples || ''} onChange={val => updatePregnancy(expandedIdx, 'singleOrMultiples', val)}
                      options={['Single', 'Twins', 'Triplets+']} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField label="Birth Weight" value={pregnancies[expandedIdx]?.weight || ''} onChange={val => updatePregnancy(expandedIdx, 'weight', val)} placeholder="e.g. 7 lbs 4 oz" />
                    <TextField label="Birth Length" value={pregnancies[expandedIdx]?.length || ''} onChange={val => updatePregnancy(expandedIdx, 'length', val)} placeholder="inches" />
                  </div>
                </>
              )}

              {(pregnancies[expandedIdx]?.outcome === 'Miscarriage' || pregnancies[expandedIdx]?.outcome === 'Stillborn' || pregnancies[expandedIdx]?.outcome === 'Ectopic Pregnancy' || pregnancies[expandedIdx]?.outcome === 'Termination') && (
                <SelectField label="Delivery/Procedure Type" value={pregnancies[expandedIdx]?.deliveryType || ''} onChange={val => updatePregnancy(expandedIdx, 'deliveryType', val)}
                  options={['Natural', 'Surgical / D&C', 'Medical (medication)', 'C-Section', 'N/A']} />
              )}

              <YesNoField label={`Did you have an infection, fever or bleeding following ${
                pregnancies[expandedIdx]?.outcome === 'Miscarriage' || pregnancies[expandedIdx]?.outcome === 'Ectopic Pregnancy'
                  ? 'the natural miscarriage or procedure'
                  : pregnancies[expandedIdx]?.outcome === 'Termination'
                  ? 'the termination'
                  : 'this delivery'
              }?`} value={pregnancies[expandedIdx]?.infectionAfter || ''} onChange={val => updatePregnancy(expandedIdx, 'infectionAfter', val)} />
              {pregnancies[expandedIdx]?.infectionAfter === 'yes' && (
                <TextAreaField label="Please provide details" value={pregnancies[expandedIdx]?.infectionAfterDetails || ''} onChange={val => updatePregnancy(expandedIdx, 'infectionAfterDetails', val)} rows={2} />
              )}
              <YesNoField label="Did this pregnancy result in a baby with a birth defect or genetic abnormality?" value={pregnancies[expandedIdx]?.birthDefect || ''} onChange={val => updatePregnancy(expandedIdx, 'birthDefect', val)} />
              {pregnancies[expandedIdx]?.birthDefect === 'yes' && (
                <TextAreaField label="Please provide details" value={pregnancies[expandedIdx]?.birthDefectDetails || ''} onChange={val => updatePregnancy(expandedIdx, 'birthDefectDetails', val)} rows={2} />
              )}
              <CheckboxGroupField label="Pregnancy complications (check all that apply)" options={[
                'C-Section', 'Ectopic Pregnancy', 'Gestational Diabetes', 'High Blood Pressure',
                'IUGR (Intrauterine Growth Restriction)', 'Physician Ordered Bed Rest', 'Placenta Previa',
                'Postpartum Depression', 'Premature Birth', 'Retained Placenta', 'Toxemia', 'Other', 'None of the above'
              ]} value={pregnancies[expandedIdx]?.complicationsList || []} onChange={val => updatePregnancy(expandedIdx, 'complicationsList', val)} />
              {(pregnancies[expandedIdx]?.complicationsList || []).some(c => c !== 'None of the above') && (
                <TextAreaField label="Please explain any checked complications" value={pregnancies[expandedIdx]?.complicationsExplanation || ''} onChange={val => updatePregnancy(expandedIdx, 'complicationsExplanation', val)} rows={2} />
              )}
              <TextAreaField label="Additional details about this pregnancy" value={pregnancies[expandedIdx]?.complications || ''} onChange={val => updatePregnancy(expandedIdx, 'complications', val)}
                placeholder="Any other details about pregnancy, delivery, or recovery" rows={2} />

              <div className="flex justify-end">
                <Button onClick={() => setExpandedIdx(null)} className="gap-2 rounded-xl" style={{ backgroundColor: '#283693', color: '#fff' }}>
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
      <YesNoField label="Is the biological father the same for all of your biological children?" value={v(s, 'sameBioFather')} onChange={u(s, 'sameBioFather')} />
      {v(s, 'sameBioFather') === 'no' && (
        <TextAreaField label="Please explain" value={v(s, 'sameBioFatherDetails')} onChange={u(s, 'sameBioFatherDetails')} rows={2} />
      )}

      <TextAreaField label="We want to hear all the details about your pregnancy(s). Be sure to describe in detail about any complications you experienced. Please share the ups and downs." value={v(s, 'pregnancyDetails')} onChange={u(s, 'pregnancyDetails')} rows={4} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Have you ever been seen by a doctor for infertility treatment?" value={v(s, 'infertilityTreatment')} onChange={u(s, 'infertilityTreatment')} />
        <YesNoField label="Have you ever been told of any gynecological problems (endometriosis, ovarian cysts, fibroids, abnormal pap smears, etc.)?" value={v(s, 'gynecologicalProblems')} onChange={u(s, 'gynecologicalProblems')} />
      </div>
      {v(s, 'infertilityTreatment') === 'yes' && (
        <TextAreaField label="Please provide details" value={v(s, 'infertilityTreatmentDetails')} onChange={u(s, 'infertilityTreatmentDetails')} rows={2} />
      )}
      {v(s, 'gynecologicalProblems') === 'yes' && (
        <TextAreaField label="Please provide details" value={v(s, 'gynecologicalProblemsDetails')} onChange={u(s, 'gynecologicalProblemsDetails')} rows={2} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Which contraceptive method do you currently use?" value={v(s, 'contraceptiveMethod')} onChange={u(s, 'contraceptiveMethod')}
          options={['None', 'Birth Control Pills', 'IUD', 'Condoms', 'Implant', 'Depo Shot', 'Natural Family Planning', 'Celibacy', 'Vasectomy', 'Same Sex Partner', 'Other']} />
        <TextField label="When was the start of your last period?" value={v(s, 'lastPeriod')} onChange={u(s, 'lastPeriod')} type="date" />
      </div>
      <YesNoField label="Are your cycles typically between 28 to 30 days?" value={v(s, 'cycleLength')} onChange={u(s, 'cycleLength')} />
      {v(s, 'cycleLength') === 'no' && (
        <TextField label="What is your typical cycle length?" value={v(s, 'cycleLengthDetails')} onChange={u(s, 'cycleLengthDetails')} placeholder="e.g. 35 days" />
      )}
      <YesNoField label="Are you currently breastfeeding/lactating?" value={v(s, 'breastfeeding')} onChange={u(s, 'breastfeeding')} />
      {v(s, 'breastfeeding') === 'yes' && (
        <TextField label="When do you expect to stop?" value={v(s, 'breastfeedingStopDate')} onChange={u(s, 'breastfeedingStopDate')} placeholder="e.g. In 2 months" />
      )}
      <TextAreaField label="How long after stopping contraceptives did it take to get pregnant?" value={v(s, 'timeToConceive')} onChange={u(s, 'timeToConceive')} rows={2} />
      <YesNoField label="Did you ever take medication (aside from prenatals) during pregnancy?" value={v(s, 'pregnancyMedication')} onChange={u(s, 'pregnancyMedication')} />
      {v(s, 'pregnancyMedication') === 'yes' && (
        <TextAreaField label="Please list medications" value={v(s, 'pregnancyMedicationList')} onChange={u(s, 'pregnancyMedicationList')} rows={2} />
      )}
      <TextField label="What is the nearest hospital with a Level II or III NICU?" value={v(s, 'nearestNICU')} onChange={u(s, 'nearestNICU')} placeholder="Hospital name and city" />
      <YesNoField label="If only a Level I is close, are you ok traveling to a hospital with at least a Level II NICU?" value={v(s, 'willingToTravelNICU')} onChange={u(s, 'willingToTravelNICU')} />
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
      <div className="p-4 rounded-xl bg-[#283693]/5 border border-[#283693]/10">
        <h4 className="font-medium text-[#283693] mb-3">Mental Health</h4>
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
        <h4 className="font-medium text-[#283693] mb-3">Medications</h4>
        <div className="space-y-4">
          <TextAreaField label="Non-prescription medication use (such as Tylenol, Advil, allergy/cold medication, etc.)" value={v(s, 'nonPrescriptionMeds')} onChange={u(s, 'nonPrescriptionMeds')} rows={2} />
          <TextAreaField label="Prescription medications taken in the past 5 years, their purpose and dates of use" value={v(s, 'prescriptionMeds')} onChange={u(s, 'prescriptionMeds')} rows={2} />
          <TextAreaField label="Current medications and supplements" value={v(s, 'currentMeds')} onChange={u(s, 'currentMeds')} rows={2} />
        </div>
      </div>

      <SelectField label="Blood type" value={v(s, 'bloodType')} onChange={u(s, 'bloodType')}
        options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']} className="max-w-xs" />
      <TextAreaField label="Do you currently have any allergies?" value={v(s, 'allergies')} onChange={u(s, 'allergies')} placeholder="List any allergies and details" rows={2} />
      <TextAreaField label="Do you currently have any medical conditions we should be made aware of?" value={v(s, 'medicalConditions')} onChange={u(s, 'medicalConditions')} rows={2} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="When was your last annual physical?" value={v(s, 'lastPhysical')} onChange={u(s, 'lastPhysical')} placeholder="Date and results" />
        <TextField label="Most recent Pap and results" value={v(s, 'lastPap')} onChange={u(s, 'lastPap')} />
      </div>
      <TextAreaField label="Hospitalization/surgery history over past 5 years. Please list surgery and year." value={v(s, 'surgeries')} onChange={u(s, 'surgeries')} rows={2} />

      <CheckboxGroupField label="Please indicate whether you have had any of the following conditions or diseases (check all that apply)" options={diseases}
        value={v(s, 'diseaseHistory') || []} onChange={u(s, 'diseaseHistory')} />
      {(v(s, 'diseaseHistory') || []).some(d => d !== 'None of the Above') && (
        <TextAreaField label="Please explain any checked conditions" value={v(s, 'diseaseHistoryDetails')} onChange={u(s, 'diseaseHistoryDetails')} rows={2} />
      )}

      <YesNoField label="If required for the surrogacy process, are you open to being vaccinated (i.e Hep B, Flu, Varicella etc.)?" value={v(s, 'openToVaccinations')} onChange={u(s, 'openToVaccinations')} />
      {v(s, 'openToVaccinations') === 'no' && (
        <TextAreaField label="Please share your reasons" value={v(s, 'vaccinationReasons')} onChange={u(s, 'vaccinationReasons')} rows={2} />
      )}

      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">COVID-19</h4>
        <div className="space-y-4">
          <YesNoField label="Have you received the Covid 19 vaccination?" value={v(s, 'covidVaccine')} onChange={u(s, 'covidVaccine')} />
          {v(s, 'covidVaccine') === 'no' && (
            <YesNoField label="Are you willing to receive the vaccination if recommended by the fertility doctor/OB or if your Intended Parents request this?" value={v(s, 'covidVaccineWilling')} onChange={u(s, 'covidVaccineWilling')} />
          )}
          <YesNoField label="Have you had Covid-19 before?" value={v(s, 'hadCovid')} onChange={u(s, 'hadCovid')} />
          <YesNoField label="Have you received the booster?" value={v(s, 'covidBooster')} onChange={u(s, 'covidBooster')} />
          {v(s, 'covidBooster') === 'no' && (
            <YesNoField label="Are you comfortable getting this if requested?" value={v(s, 'covidBoosterWilling')} onChange={u(s, 'covidBoosterWilling')} />
          )}
        </div>
      </div>
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
      <YesNoField label="Do any of your children have special needs or medical conditions (e.g., autism, developmental delays)?" value={v(s, 'childrenSpecialNeeds')} onChange={u(s, 'childrenSpecialNeeds')} />
      {v(s, 'childrenSpecialNeeds') === 'yes' && (
        <TextAreaField label="Please briefly describe" value={v(s, 'childrenSpecialNeedsDetails')} onChange={u(s, 'childrenSpecialNeedsDetails')} rows={2} />
      )}
      <YesNoField label="Have you ever placed a child for adoption?" value={v(s, 'placedForAdoption')} onChange={u(s, 'placedForAdoption')} />
      {v(s, 'placedForAdoption') === 'yes' && (
        <TextAreaField label="Please provide details" value={v(s, 'placedForAdoptionDetails')} onChange={u(s, 'placedForAdoptionDetails')} rows={2} />
      )}
      <TextAreaField label="If you are divorced or separated from the other parent(s) of your child(ren), please describe this relationship" value={v(s, 'divorcedRelationship')} onChange={u(s, 'divorcedRelationship')} rows={2} />
      <YesNoField label="Do you plan to have any more children of your own?" value={v(s, 'planMoreChildren')} onChange={u(s, 'planMoreChildren')} />
      {v(s, 'planMoreChildren') === 'yes' && (
        <TextAreaField label="Please share your thoughts" value={v(s, 'planMoreChildrenDetails')} onChange={u(s, 'planMoreChildrenDetails')} rows={2} />
      )}

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Smoking, Alcohol & Substances</h4>
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
        </div>
      </div>

      <YesNoField label="Do you own any guns?" value={v(s, 'gunsOwned')} onChange={u(s, 'gunsOwned')} />
      {v(s, 'gunsOwned') === 'yes' && (
        <TextField label="How many and where do you keep them?" value={v(s, 'gunsDetails')} onChange={u(s, 'gunsDetails')} />
      )}

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Piercings & Tattoos</h4>
        <div className="space-y-4">
          <YesNoField label="Do you have any piercings or tattoos?" value={v(s, 'piercingsTattoos')} onChange={u(s, 'piercingsTattoos')} />
          {v(s, 'piercingsTattoos') === 'yes' && (
            <>
              <TextAreaField label="Please list location and quantity for both" value={v(s, 'piercingsTattoosDetails')} onChange={u(s, 'piercingsTattoosDetails')} rows={2} />
              <TextField label="What month/year did you have your last tattoo? Was it a licensed facility?" value={v(s, 'lastTattooDate')} onChange={u(s, 'lastTattooDate')} />
            </>
          )}
          <YesNoField label="Have you been tattooed or had a non-sterile skin piercing in the last 12 months?" value={v(s, 'nonSterilePiercing')} onChange={u(s, 'nonSterilePiercing')} />
        </div>
      </div>

      <YesNoField label="Do you have a history of eating disorders?" value={v(s, 'eatingDisorders')} onChange={u(s, 'eatingDisorders')} />
      {v(s, 'eatingDisorders') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'eatingDisordersDetails')} onChange={u(s, 'eatingDisordersDetails')} rows={2} />
      )}
      <TextAreaField label="Please describe your typical diet and eating habits. Do you cook at home? How often do you eat out? Do you have any special dietary restrictions?" value={v(s, 'typicalDiet')} onChange={u(s, 'typicalDiet')} rows={3} />

      {hasPartner && (
        <YesNoField label="Will your partner submit to the FDA required lab tests (STD and drug testing)?" value={v(s, 'partnerFdaTests')} onChange={u(s, 'partnerFdaTests')} />
      )}
      <TextField label="What is your Ethnic Origin/Ancestry?" value={v(s, 'ethnicity')} onChange={u(s, 'ethnicity')} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="What is your current religious affiliation, if you have one?" value={v(s, 'religion')} onChange={u(s, 'religion')} />
        <SelectField label="How important is religion to you?" value={v(s, 'religionImportance')} onChange={u(s, 'religionImportance')}
          options={['Not Important', 'Somewhat Important', 'Important', 'Very Important']} />
      </div>
      <TextAreaField label="If the Intended Parents had a different religious belief system than yours, would this create a problem?" value={v(s, 'differentReligion')} onChange={u(s, 'differentReligion')} rows={2} />

      <YesNoField label="Have you or anyone in your household ever been arrested and/or convicted of a crime/misdemeanor/felony?" value={v(s, 'criminalHistory')} onChange={u(s, 'criminalHistory')} />
      {v(s, 'criminalHistory') === 'yes' && (
        <TextAreaField label="Please provide dates and explain" value={v(s, 'criminalHistoryDetails')} onChange={u(s, 'criminalHistoryDetails')} rows={2} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Have you traveled outside of the U.S. in the last 6 months?" value={v(s, 'recentTravel')} onChange={u(s, 'recentTravel')} />
        <YesNoField label="Do you plan on traveling within or outside of the U.S. in the next 6-8 months?" value={v(s, 'travelPlans')} onChange={u(s, 'travelPlans')} />
      </div>
      {v(s, 'recentTravel') === 'yes' && (
        <TextField label="When and where?" value={v(s, 'recentTravelDetails')} onChange={u(s, 'recentTravelDetails')} />
      )}
      {v(s, 'travelPlans') === 'yes' && (
        <TextField label="When and where?" value={v(s, 'travelPlansDetails')} onChange={u(s, 'travelPlansDetails')} />
      )}

      <TextAreaField label="List the forms and frequency of regular exercise" value={v(s, 'exerciseFrequency')} onChange={u(s, 'exerciseFrequency')} rows={2} />
      <YesNoField label="Do you have any issues with sleeping?" value={v(s, 'sleepIssues')} onChange={u(s, 'sleepIssues')} />
      {v(s, 'sleepIssues') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'sleepIssuesDetails')} onChange={u(s, 'sleepIssuesDetails')} rows={2} />
      )}
      <TextField label="How many hours do you typically sleep each night?" value={v(s, 'sleepHours')} onChange={u(s, 'sleepHours')} type="number" placeholder="e.g. 7" className="max-w-xs" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <YesNoField label="Do you have a reliable vehicle to drive?" value={v(s, 'reliableVehicle')} onChange={u(s, 'reliableVehicle')} />
        <YesNoField label="Do you have automobile insurance?" value={v(s, 'autoInsurance')} onChange={u(s, 'autoInsurance')} />
        <YesNoField label="Do you have a valid driver's license?" value={v(s, 'validLicense')} onChange={u(s, 'validLicense')} />
      </div>
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
          <TextAreaField label="Please share details on the industry you work in" value={v(s, 'employmentIndustry')} onChange={u(s, 'employmentIndustry')} rows={2} />
          <TextField label="How many hours a week do you work, and what are your typical hours?" value={v(s, 'workHours')} onChange={u(s, 'workHours')} />
          <TextField label="What specifically is your occupation/position?" value={v(s, 'occupation')} onChange={u(s, 'occupation')} />
          <TextField label="How long have you worked for your current employer?" value={v(s, 'lengthAtEmployer')} onChange={u(s, 'lengthAtEmployer')} placeholder="e.g. 2 years" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="What is your earned hourly rate?" value={v(s, 'hourlyRate')} onChange={u(s, 'hourlyRate')} placeholder="$" />
            <TextField label="What is your approximate weekly income?" value={v(s, 'weeklyIncome')} onChange={u(s, 'weeklyIncome')} placeholder="$" />
          </div>
        </>
      )}

      {hasPartner && (
        <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
          <h4 className="font-medium text-[#283693] mb-3">Spouse/Partner Employment</h4>
          <div className="space-y-4">
            <TextField label="Spouse/partner's occupation" value={v(s, 'partnerOccupation')} onChange={u(s, 'partnerOccupation')} />
            <TextField label="Spouse/partner's approximate weekly income" value={v(s, 'partnerWeeklyIncome')} onChange={u(s, 'partnerWeeklyIncome')} placeholder="$" />
          </div>
        </div>
      )}

      <TextAreaField label="Do you have health insurance coverage? If yes, please provide name of provider" value={v(s, 'healthInsurance')} onChange={u(s, 'healthInsurance')} rows={2} />
      <SelectField label="Is it a private/personal policy or through you or your spouse's employer?" value={v(s, 'insuranceType')} onChange={u(s, 'insuranceType')}
        options={['Private/Personal', "Through my employer", "Through spouse's employer", 'No insurance', 'Other']} />
      <YesNoField label="Do you receive any government assistance (WIC, food stamps)?" value={v(s, 'governmentAssistance')} onChange={u(s, 'governmentAssistance')} />
      {v(s, 'governmentAssistance') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'governmentAssistanceDetails')} onChange={u(s, 'governmentAssistanceDetails')} rows={2} />
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
      {v(s, 'pets') && v(s, 'pets').toLowerCase().includes('cat') && (
        <TextField label="If you have cats, who changes the litter box?" value={v(s, 'catLitter')} onChange={u(s, 'catLitter')} />
      )}
      <TextAreaField label="What do you like to do in your free time?" value={v(s, 'hobbies')} onChange={u(s, 'hobbies')} rows={3} />
      <TextField label="Do you collect anything special?" value={v(s, 'collections')} onChange={u(s, 'collections')} />
      <TextAreaField label="Where would you most like to travel and why?" value={v(s, 'dreamTravel')} onChange={u(s, 'dreamTravel')} rows={2} />
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
      <SelectField label="Highest level of education and/or type of vocational training" value={v(s, 'educationLevel')} onChange={u(s, 'educationLevel')}
        options={['Some High School', 'High School Diploma / GED', 'Some College', 'Associate Degree', 'Bachelor\'s Degree', 'Master\'s Degree', 'Doctorate', 'Vocational / Trade School', 'Other']} />
      <YesNoField label="Are you currently in school?" value={v(s, 'currentlyInSchool')} onChange={u(s, 'currentlyInSchool')} />
      {v(s, 'currentlyInSchool') === 'yes' && (
        <TextAreaField label="Please explain" value={v(s, 'currentlyInSchoolDetails')} onChange={u(s, 'currentlyInSchoolDetails')} rows={2} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 9. Experienced Surrogate Information
// ─────────────────────────────────────────────────────────
function ExperiencedSurrogateSection({ v, u }) {
  const s = 'experiencedSurrogate'
  return (
    <div className="space-y-6">
      <YesNoField label="Have you ever been a surrogate before?" value={v(s, 'previousSurrogate')} onChange={u(s, 'previousSurrogate')} />
      {v(s, 'previousSurrogate') === 'yes' && (
        <>
          <TextField label="How many times?" value={v(s, 'surrogacyTimes')} onChange={u(s, 'surrogacyTimes')} type="number" className="max-w-xs" />
          <TextAreaField label="Name, Location & Dates of each Reproductive Doctor" value={v(s, 'reDoctors')} onChange={u(s, 'reDoctors')} rows={3} />
          <TextAreaField label="Please share surrogacy pregnancy history (was there a pregnancy, complications, healthy baby, weeks when delivered)" value={v(s, 'surrogacyPregnancyHistory')} onChange={u(s, 'surrogacyPregnancyHistory')} rows={3} />
          <TextAreaField label="How many attempts or transfers were there until you became pregnant?" value={v(s, 'attemptsTransfers')} onChange={u(s, 'attemptsTransfers')} rows={2} />
          <TextAreaField label="What do you know about the embryos? Donor eggs or IM's eggs? How old was donor/IM at retrieval?" value={v(s, 'embryoSource')} onChange={u(s, 'embryoSource')} rows={2} />
          <YesNoField label="Were there any unsuccessful cycles (lining issues, miscarriages, negative tests, chemical pregnancies)?" value={v(s, 'unsuccessfulCycles')} onChange={u(s, 'unsuccessfulCycles')} />
          {v(s, 'unsuccessfulCycles') === 'yes' && (
            <TextAreaField label="Please explain" value={v(s, 'unsuccessfulCyclesDetails')} onChange={u(s, 'unsuccessfulCyclesDetails')} rows={2} />
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
        <h4 className="font-medium text-[#283693] mb-3">Your Motivation</h4>
        <div className="space-y-4">
          <TextAreaField label="Why do you want to become a surrogate (or be a repeat surrogate), and how long have you been thinking about it?" value={v(s, 'reasonForSurrogacy')} onChange={u(s, 'reasonForSurrogacy')}
            placeholder="Please be specific with your answer" rows={4} />
          <TextAreaField label="How do you plan to use the money that you make from being a surrogate?" value={v(s, 'compensationUse')} onChange={u(s, 'compensationUse')} rows={2} />
          <TextAreaField label="Please explain how you see surrogacy fitting into your life" value={v(s, 'surrogacyFit')} onChange={u(s, 'surrogacyFit')} rows={2} />
          <TextAreaField label="Who will be your resource to help with your children for appointments / possible bed rest etc.? Please provide specific details on your support system." value={v(s, 'supportSystem')} onChange={u(s, 'supportSystem')} rows={3} />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-[#283693]">Willingness</h4>
        <YesNoField label="Are you willing to have 3 transfer attempts with the same IP if that is what it takes to achieve a pregnancy?" value={v(s, 'threeTransferAttempts')} onChange={u(s, 'threeTransferAttempts')} />
        <YesNoField label="Are you willing to reduce the amount of caffeine and soda you consume during the pregnancy?" value={v(s, 'reduceCaffeine')} onChange={u(s, 'reduceCaffeine')} />
        <YesNoField label="Are you open to making other lifestyle changes at the request of the Intended Parents?" value={v(s, 'lifestyleChanges')} onChange={u(s, 'lifestyleChanges')} />
        {v(s, 'lifestyleChanges') === 'yes' && (
          <TextAreaField label="Please explain" value={v(s, 'lifestyleChangesDetails')} onChange={u(s, 'lifestyleChangesDetails')} rows={2} />
        )}
        <YesNoField label="Are you open to pumping colostrum and breast milk for your IP if they were to request this?" value={v(s, 'pumpBreastmilk')} onChange={u(s, 'pumpBreastmilk')} />
      </div>

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Ideal Match & Communication</h4>
        <div className="space-y-4">
          <TextAreaField label="Describe ideal intended parent(s) for whom you would like to be a surrogate" value={v(s, 'idealIPs')} onChange={u(s, 'idealIPs')} rows={3} />
          <SelectField label="What is the best form of communication that you are comfortable using?" value={v(s, 'preferredCommunication')} onChange={u(s, 'preferredCommunication')}
            options={['Text', 'Email', 'Phone Calls', 'FaceTime / Video Calls', 'Mix of Everything']} />
          <SelectField label="How much involvement from the Intended Parents do you want during the pregnancy?" value={v(s, 'ipInvolvement')} onChange={u(s, 'ipInvolvement')}
            options={['Very Involved', 'Moderately Involved', 'Occasional Check-ins', 'Minimal']} />
          <YesNoField label="Would you be willing to have the Intended Parents at doctor appointments and in delivery room?" value={v(s, 'ipsAtAppointments')} onChange={u(s, 'ipsAtAppointments')} />
          {v(s, 'ipsAtAppointments') === 'no' && (
            <TextAreaField label="Please explain" value={v(s, 'ipsAtAppointmentsDetails')} onChange={u(s, 'ipsAtAppointmentsDetails')} rows={2} />
          )}
          <TextAreaField label="Is there anyone else you would like to have in the delivery room (partner/spouse, friend, mom)?" value={v(s, 'deliveryRoomOthers')} onChange={u(s, 'deliveryRoomOthers')} rows={2} />
          <TextAreaField label="How do you feel about having Intended Parents who cannot attend doctor appointments and see you on a regular basis?" value={v(s, 'ipsCantAttend')} onChange={u(s, 'ipsCantAttend')} rows={2} />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-[#283693]">Matching Preferences</h4>
        <YesNoField label="Are you willing to match with Intended Parents who already have children?" value={v(s, 'ipsWithChildren')} onChange={u(s, 'ipsWithChildren')} />
        <YesNoField label="Are you open to matching with LGBTQ+ individual/couples?" value={v(s, 'openLGBTQ')} onChange={u(s, 'openLGBTQ')} />
        <YesNoField label="Are you willing to match with a single Intended Parent?" value={v(s, 'openSingleIP')} onChange={u(s, 'openSingleIP')} />
        <YesNoField label="Are you willing to have the embryo transfer in another state?" value={v(s, 'transferAnotherState')} onChange={u(s, 'transferAnotherState')} />
        <YesNoField label="Are you willing to match with Intended Parents who live outside of the U.S.?" value={v(s, 'ipsOutsideUS')} onChange={u(s, 'ipsOutsideUS')} />
        <TextAreaField label="Who will care for your child(ren) when you need to travel for surrogacy?" value={v(s, 'childCareTraveling')} onChange={u(s, 'childCareTraveling')} rows={2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="When are you ready to begin?" value={v(s, 'whenReadyToBegin')} onChange={u(s, 'whenReadyToBegin')}
          options={['Immediately', 'Within 1-3 months', 'Within 3-6 months', 'Within 6-12 months', '1+ year']} />
        <SelectField label="Ideal relationship with Intended Parent(s) post birth" value={v(s, 'postBirthRelationship')} onChange={u(s, 'postBirthRelationship')}
          options={['Close / Ongoing', 'Occasional Updates', 'Holiday Cards / Photos', 'Clean Break', 'Open to Whatever Develops']} />
      </div>

      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Medical Decisions</h4>
        <div className="space-y-4">
          <YesNoField label="If recommended by a physician, would you be willing to undergo CVS, amniocentesis or other diagnostic testing?" value={v(s, 'cvsAmnio')} onChange={u(s, 'cvsAmnio')} />
          {v(s, 'cvsAmnio') === 'no' && (
            <TextAreaField label="Please explain" value={v(s, 'cvsAmnioDetails')} onChange={u(s, 'cvsAmnioDetails')} rows={2} />
          )}
          <TextAreaField label="Willingness to terminate for a serious genetic or medical condition and follow IP(s) direction and doctor recommendation?" value={v(s, 'willingnessToTerminate')} onChange={u(s, 'willingnessToTerminate')} rows={2} />
          {hasPartner && (
            <YesNoField label="Would your partner agree and support the decision for termination?" value={v(s, 'partnerAgreesTermination')} onChange={u(s, 'partnerAgreesTermination')} />
          )}
          <TextAreaField label="Are there any specific conditions where you would not terminate a pregnancy? Please explain." value={v(s, 'conditionsWontTerminate')} onChange={u(s, 'conditionsWontTerminate')} rows={2} />
          <SelectField label="How many embryos are you in agreement to transfer at a time?" value={v(s, 'embryosToTransfer')} onChange={u(s, 'embryosToTransfer')}
            options={['1', '2', 'Doctor recommendation', 'Open to discussion']} />
          <YesNoField label="If you only prefer to transfer 1 embryo and the embryo splits, would you be in agreement to carry twins?" value={v(s, 'carryTwins')} onChange={u(s, 'carryTwins')} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#283693]/5 border border-[#283693]/10">
        <h4 className="font-medium text-[#283693] mb-3">Compensation</h4>
        <div className="space-y-4">
          <TextField label="Surrogate base fee" value={v(s, 'desiredCompensation')} onChange={u(s, 'desiredCompensation')} placeholder="$" />
          <YesNoField label="Is this negotiable?" value={v(s, 'compensationNegotiable')} onChange={u(s, 'compensationNegotiable')} />
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
          className="flex-1 accent-[#ed148c]" />
        <Button variant="outline" size="sm" onClick={() => setRotation(r => (r + 90) % 360)} className="gap-1.5">
          <RotateCw className="w-3.5 h-3.5" /> Rotate
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#ed148c', color: '#fff' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function PhotosSection() {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
  const [photos, setPhotos] = useState([])
  const [coverPhoto, setCoverPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    listProfilePhotos(userId).then(setPhotos).catch(() => {})
    listProfilePhotos(`${userId}/headshot`).then(list => {
      setCoverPhoto(list.length > 0 ? list[0] : null)
    }).catch(() => {})
  }, [userId])

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
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#ed148c] text-white text-[10px] font-bold shadow-sm">Cover</span>
              </div>
            )}

            {/* Gallery photos — draggable */}
            {photos.map((photo, i) => (
              <SortablePhoto key={photo.path} photo={photo} index={coverPhoto ? i + 1 : i} total={photos.length + (coverPhoto ? 1 : 0)}
                onEdit={setEditing} onDelete={handleDelete} />
            ))}

            {/* Upload button */}
            <label className={`aspect-square rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-[#ed148c]/50 hover:bg-pink-50/30 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="text-center">
                {uploading ? (
                  <Loader2 className="w-8 h-8 mx-auto text-[#ed148c] animate-spin" />
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
