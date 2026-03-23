import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  User, Home, Baby, Stethoscope, HeartPulse, Apple, Briefcase,
  Heart, Camera, ChevronDown, CheckCircle2, Circle, Plus, Trash2,
  Ruler, Scale, CalendarDays, MapPin, Upload,
  Loader2, X, RotateCw, Crop as CropIcon, Eye,
  Weight as WeightIcon, Droplets, Activity, Shield as ShieldIcon
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
import { fetchIntakeByEmail, uploadProfilePhoto, deleteProfilePhoto, listProfilePhotos } from '@/lib/db'
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

function ProfilePhotoUpload({ label = 'Profile Photo', userId }) {
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check for existing profile photo in headshot subfolder
    listProfilePhotos(`${userId}/headshot`).then(photos => {
      if (photos.length > 0) setPhoto(photos[0])
    }).catch(() => {})
  }, [userId])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
    setUploading(true)
    setError(null)
    try {
      if (photo) await deleteProfilePhoto(photo.path).catch(() => {})
      const jpeg = await convertToJpeg(file)
      const result = await uploadProfilePhoto(`${userId}/headshot`, jpeg)
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
  { key: 'about', title: 'About Me', icon: User, description: 'Basic information and personality' },
  { key: 'family', title: 'Family & Household', icon: Home, description: 'Your family and living situation' },
  { key: 'pregnancyHistory', title: 'Pregnancy History', icon: Baby, description: 'Previous pregnancies and deliveries' },
  { key: 'fertility', title: 'Fertility & Medical Details', icon: Stethoscope, description: 'Reproductive health information' },
  { key: 'health', title: 'Health & Wellness', icon: HeartPulse, description: 'Mental health, medications, and conditions' },
  { key: 'lifestyle', title: 'Lifestyle', icon: Apple, description: 'Daily habits and personal details' },
  { key: 'employment', title: 'Employment & Finances', icon: Briefcase, description: 'Work and financial information' },
  { key: 'preferences', title: 'Surrogacy Preferences', icon: Heart, description: 'Your ideal surrogacy experience' },
  { key: 'photos', title: 'Photos', icon: Camera, description: 'Share photos for your matching profile' },
]

// Required fields per section for completion tracking
function isPregnancyComplete(p) {
  if (!p.outcome || !p.dob || !p.gestationWeeks || !p.deliveryType) return false
  if (p.outcome === 'Live Birth' && !p.weight) return false
  return true
}

const REQUIRED_FIELDS = {
  about: ['firstName', 'city', 'state', 'heightFt', 'weight', 'personality'],
  family: ['maritalStatus', 'whoLivesWithYou', 'planMoreChildren'],
  pregnancyHistory: ['numberOfPregnancies'],
  fertility: ['sameBioFather', 'contraceptiveMethod', 'cycleLength'],
  health: ['mentalHealthDiagnosis', 'bloodType', 'rhFactor', 'openToVaccinations'],
  lifestyle: ['smokeVape', 'alcoholDrugs', 'typicalDiet', 'exerciseFrequency', 'sleepHours', 'reliableVehicle'],
  employment: ['currentlyEmployed', 'healthInsurance'],
  preferences: ['previousSurrogate', 'reasonForSurrogacy', 'whenReadyToBegin', 'desiredCompensation'],
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

  // Pre-fill from intake quiz answers on first load
  useEffect(() => {
    if (!currentUser?.email) return
    const existing = loadProfile(userId)
    // Only pre-fill if profile is mostly empty (first visit)
    if (existing?.about?.firstName) return
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
        about: {
          ...prev.about,
          firstName: answers.firstName || '',
          dob: answers.dob || '',
          city: answers.city || '',
          state,
          heightFt: answers.heightFt?.toString() || '',
          heightIn: answers.heightIn?.toString() || '',
          weight: answers.weightLbs?.toString() || '',
          bmi: bmi || '',
        },
        family: {
          ...prev.family,
          maritalStatus: answers.maritalStatus || '',
          partnerName: answers.partnerName || '',
        },
      }))
    })
  }, [currentUser?.email])

  // Auto-save on change (per-user)
  useEffect(() => {
    saveProfile(userId, profile)
  }, [profile, userId])

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
    const photos = await listProfilePhotos(userId)
    const headshot = await listProfilePhotos(`${userId}/headshot`)
    setPreviewPhotos([...headshot, ...photos])
    setPreviewOpen(true)
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
            <Eye className="w-4 h-4" /> Preview
          </Button>
        </div>

        {/* ── Section Cards ── */}
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
                  <CardContent>
                    <SectionBody sectionKey={sec.key} v={v} u={u} profile={profile} setProfile={setProfile} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}

        {/* Profile Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <ProfilePreview profile={profile} photos={previewPhotos} />
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Profile Preview — shows what IPs will see
// ─────────────────────────────────────────────────────────
function PreviewSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-heading font-semibold text-[#283693]">{title}</h3>
      {children}
    </div>
  )
}

function PreviewStat({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-[#fdf8f3]">
      {Icon && <Icon className="w-4 h-4 text-[#283693] mb-1" />}
      <span className="text-sm font-bold text-[#283693]">{value}</span>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  )
}

function ProfilePreview({ profile, photos }) {
  const about = profile?.about || {}
  const family = profile?.family || {}
  const health = profile?.health || {}
  const lifestyle = profile?.lifestyle || {}
  const employment = profile?.employment || {}
  const prefs = profile?.preferences || {}

  const firstName = about.firstName || 'Your Name'
  const heightStr = about.heightFt ? `${about.heightFt}'${about.heightIn || 0}"` : ''
  const bmi = about.bmi || ''

  const heroPhoto = photos?.[0]

  return (
    <div className="bg-[#fdf8f3]">
      {/* Hero photo */}
      {heroPhoto ? (
        <div className="w-full h-64 sm:h-80 overflow-hidden">
          <img src={heroPhoto.url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-[#ed148c]/20 to-[#283693]/20 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No photos uploaded yet</p>
        </div>
      )}

      {/* Photo thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-6 -mt-6 relative z-10">
          {photos.slice(1, 5).map(p => (
            <div key={p.path} className="w-14 h-14 rounded-lg overflow-hidden border-2 border-white shadow-sm shrink-0">
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {photos.length > 5 && (
            <div className="w-14 h-14 rounded-lg bg-white/80 border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-gray-500">
              +{photos.length - 5}
            </div>
          )}
        </div>
      )}

      <div className="px-6 py-6 space-y-6">
        {/* Name & location */}
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-[#283693]">
            Meet {firstName}
          </h2>
          {(about.city || about.state) && (
            <p className="text-gray-500 text-sm mt-1">
              {[about.city, about.state].filter(Boolean).join(', ')}
            </p>
          )}
          {about.personality && (
            <p className="text-sm italic text-[#283693]/70 max-w-md mx-auto mt-3">
              "{about.personality}"
            </p>
          )}
        </div>

        {/* About Me */}
        <PreviewSection title="About Me">
          <div className="grid grid-cols-2 gap-3">
            {family.maritalStatus && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#283693]/10 flex items-center justify-center shrink-0">
                  <Heart className="w-3.5 h-3.5 text-[#283693]" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Marital Status</p>
                  <p className="text-sm font-medium">{family.maritalStatus}</p>
                </div>
              </div>
            )}
            {employment.currentlyEmployed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#283693]/10 flex items-center justify-center shrink-0">
                  <BriefcaseIcon className="w-3.5 h-3.5 text-[#283693]" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Employed</p>
                  <p className="text-sm font-medium capitalize">{employment.currentlyEmployed}</p>
                </div>
              </div>
            )}
          </div>
        </PreviewSection>

        {/* Surrogacy */}
        <PreviewSection title="Surrogacy Experience">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ed148c]/10 text-[#283693] text-sm font-medium px-3 py-1.5">
              {prefs.previousSurrogate === 'yes' ? 'Experienced Surrogate' : 'First-Time Surrogate'}
            </span>
            {prefs.reasonForSurrogacy && (
              <span className="inline-flex items-center rounded-full bg-[#283693]/10 text-[#283693] text-sm font-medium px-3 py-1.5">
                {prefs.reasonForSurrogacy}
              </span>
            )}
          </div>
        </PreviewSection>

        {/* Medical snapshot */}
        {(heightStr || about.weight || bmi || health.bloodType) && (
          <PreviewSection title="Medical Snapshot">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <PreviewStat icon={Ruler} label="Height" value={heightStr} />
              <PreviewStat icon={WeightIcon} label="Weight" value={about.weight ? `${about.weight} lbs` : ''} />
              <PreviewStat icon={Activity} label="BMI" value={bmi} />
              <PreviewStat icon={Droplets} label="Blood Type" value={health.bloodType} />
            </div>
          </PreviewSection>
        )}

        {/* Lifestyle */}
        {(lifestyle.typicalDiet || lifestyle.exerciseFrequency) && (
          <PreviewSection title="Lifestyle">
            <div className="flex flex-wrap gap-2">
              {lifestyle.typicalDiet && (
                <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 text-sm px-3 py-1">
                  {lifestyle.typicalDiet}
                </span>
              )}
              {lifestyle.exerciseFrequency && (
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-sm px-3 py-1">
                  Exercise: {lifestyle.exerciseFrequency}
                </span>
              )}
            </div>
          </PreviewSection>
        )}

        {/* Insurance */}
        {employment.healthInsurance && (
          <PreviewSection title="Insurance">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4 text-[#283693]" />
              <span className="text-sm capitalize">{employment.healthInsurance}</span>
            </div>
          </PreviewSection>
        )}

        {/* Banner */}
        <div className="text-center py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            This is a preview of how intended parents will see your profile.
          </p>
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
    case 'about': return <AboutSection v={v} u={u} />
    case 'family': return <FamilySection v={v} u={u} />
    case 'pregnancyHistory': return <PregnancyHistorySection v={v} u={u} profile={profile} setProfile={setProfile} />
    case 'fertility': return <FertilitySection v={v} u={u} profile={profile} />
    case 'health': return <HealthSection v={v} u={u} />
    case 'lifestyle': return <LifestyleSection v={v} u={u} />
    case 'employment': return <EmploymentSection v={v} u={u} />
    case 'preferences': return <PreferencesSection v={v} u={u} />
    case 'photos': return <PhotosSection v={v} u={u} />
    default: return null
  }
}

// ─────────────────────────────────────────────────────────
// 1. About Me
// ─────────────────────────────────────────────────────────
function AboutSection({ v, u }) {
  const { currentUser } = useRole()
  const userId = currentUser?.id || currentUser?.email || 'anonymous'
  const s = 'about'
  const heightFt = parseInt(v(s, 'heightFt')) || 0
  const heightIn = parseInt(v(s, 'heightIn')) || 0
  const weight = parseFloat(v(s, 'weight')) || 0
  const totalInches = heightFt * 12 + heightIn
  const bmi = totalInches > 0 && weight > 0
    ? ((weight / (totalInches * totalInches)) * 703).toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="First Name" value={v(s, 'firstName')} onChange={u(s, 'firstName')} placeholder="Your first name" />
        <TextField label="Date of Birth" value={v(s, 'dob')} onChange={u(s, 'dob')} type="date" disabled placeholder="From signup" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="City" value={v(s, 'city')} onChange={u(s, 'city')} placeholder="Your city" />
        <SelectField label="State" value={v(s, 'state')} onChange={u(s, 'state')} placeholder="Select state"
          options={['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectField label="Height (ft)" value={v(s, 'heightFt')} onChange={u(s, 'heightFt')} placeholder="Ft"
          options={['4','5','6'].map(n => ({ value: n, label: `${n} ft` }))} />
        <SelectField label="Height (in)" value={v(s, 'heightIn')} onChange={u(s, 'heightIn')} placeholder="In"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i} in` }))} />
        <TextField label="Weight (lbs)" value={v(s, 'weight')} onChange={u(s, 'weight')} type="number" placeholder="lbs" />
        <Field label="BMI (auto)">
          <div className="h-9 flex items-center px-3 rounded-md border bg-gray-50 text-sm font-medium text-[#283693]">
            {bmi}
          </div>
        </Field>
      </div>
      <TextAreaField label="Tell us about yourself" value={v(s, 'personality')} onChange={u(s, 'personality')}
        placeholder="Share a bit about your personality, hobbies, and what makes you you..." rows={4} />
      <ProfilePhotoUpload label="Profile Photo" userId={userId} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 2. Family & Household
// ─────────────────────────────────────────────────────────
function FamilySection({ v, u }) {
  const s = 'family'
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Marital Status" value={v(s, 'maritalStatus')} onChange={u(s, 'maritalStatus')}
          options={['Single', 'Married', 'Domestic Partnership', 'Divorced', 'Separated', 'Widowed']} />
        <TextField label="Partner Name" value={v(s, 'partnerName')} onChange={u(s, 'partnerName')} placeholder="If applicable" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Partner Date of Birth" value={v(s, 'partnerDob')} onChange={u(s, 'partnerDob')} type="date" />
        <TextField label="Relationship Length" value={v(s, 'relationshipLength')} onChange={u(s, 'relationshipLength')} placeholder="e.g. 5 years" />
      </div>
      <SelectField label="Sexual partners in the last 6 months" value={v(s, 'sexualPartners')} onChange={u(s, 'sexualPartners')}
        options={['0', '1', '2', '3', '4+']} className="max-w-xs" />
      <TextAreaField label="Who lives in your household?" value={v(s, 'whoLivesWithYou')} onChange={u(s, 'whoLivesWithYou')}
        placeholder="List everyone who lives with you and their relationship to you" rows={3} />
      <YesNoField label="Do any of your children have special needs?" value={v(s, 'childrenSpecialNeeds')} onChange={u(s, 'childrenSpecialNeeds')} />
      {v(s, 'childrenSpecialNeeds') === 'yes' && (
        <TextAreaField label="Please describe" value={v(s, 'childrenSpecialNeedsDetails')} onChange={u(s, 'childrenSpecialNeedsDetails')}
          placeholder="Details about special needs" />
      )}
      <YesNoField label="Do you plan to have more children?" value={v(s, 'planMoreChildren')} onChange={u(s, 'planMoreChildren')} />
      <YesNoField label="Have you ever placed a child for adoption?" value={v(s, 'placedForAdoption')} onChange={u(s, 'placedForAdoption')} />
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

              <TextAreaField label="Complications or additional details" value={pregnancies[expandedIdx]?.complications || ''} onChange={val => updatePregnancy(expandedIdx, 'complications', val)}
                placeholder="Any complications during pregnancy, delivery, or recovery" rows={2} />

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
// 4. Fertility & Medical Details
// ─────────────────────────────────────────────────────────
function FertilitySection({ v, u, profile }) {
  const s = 'fertility'
  const pregnancies = profile?.pregnancyHistory?.pregnancies || []
  const totalPregnancies = parseInt(profile?.pregnancyHistory?.numberOfPregnancies) || 0
  const liveBirths = pregnancies.filter(p => p.outcome === 'Live Birth').length
  const miscarriages = pregnancies.filter(p => ['Miscarriage', 'Ectopic Pregnancy', 'Stillborn'].includes(p.outcome)).length
  const terminations = pregnancies.filter(p => p.outcome === 'Termination').length

  const complications = [
    'C-Section', 'Ectopic Pregnancy', 'Gestational Diabetes', 'High Blood Pressure',
    'IUGR', 'Bed Rest', 'Placenta Previa', 'Postpartum Depression', 'Premature Birth',
    'Retained Placenta', 'Still Birth', 'Toxemia', 'None'
  ]
  return (
    <div className="space-y-6">
      {totalPregnancies > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-2xl font-bold text-[#283693]">{totalPregnancies}</p>
            <p className="text-xs text-stone-500 mt-1">Pregnancies</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{liveBirths}</p>
            <p className="text-xs text-stone-500 mt-1">Live Births</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{miscarriages}</p>
            <p className="text-xs text-stone-500 mt-1">Miscarriages</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-2xl font-bold text-stone-600">{terminations}</p>
            <p className="text-xs text-stone-500 mt-1">Terminations</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-stone-400 italic">Complete the Pregnancy History section above to auto-fill these counts.</p>
      )}
      <YesNoField label="For your own biological children, is the biological father the same for all?" value={v(s, 'sameBioFather')} onChange={u(s, 'sameBioFather')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Longest Hospital Stay After Delivery" value={v(s, 'hospitalStay')} onChange={u(s, 'hospitalStay')} placeholder="e.g. 2 days" />
        <YesNoField label="Infections after delivery?" value={v(s, 'infectionsAfterDelivery')} onChange={u(s, 'infectionsAfterDelivery')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Infertility treatment?" value={v(s, 'infertilityTreatment')} onChange={u(s, 'infertilityTreatment')} />
        <YesNoField label="Gynecological problems?" value={v(s, 'gynecologicalProblems')} onChange={u(s, 'gynecologicalProblems')} />
      </div>
      <YesNoField label="Any birth defects?" value={v(s, 'birthDefects')} onChange={u(s, 'birthDefects')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Contraceptive Method" value={v(s, 'contraceptiveMethod')} onChange={u(s, 'contraceptiveMethod')}
          options={['None', 'Birth Control Pills', 'IUD', 'Condoms', 'Implant', 'Depo Shot', 'Natural Family Planning', 'Other']} />
        <TextField label="Cycle Length (days)" value={v(s, 'cycleLength')} onChange={u(s, 'cycleLength')} type="number" placeholder="e.g. 28" />
      </div>
      <TextField label="Nearest Level II/III NICU Hospital" value={v(s, 'nearestNICU')} onChange={u(s, 'nearestNICU')} placeholder="Hospital name and city" />
      <CheckboxGroupField label="Pregnancy Complications History" options={complications}
        value={v(s, 'pregnancyComplications') || []} onChange={u(s, 'pregnancyComplications')} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 5. Health & Wellness
// ─────────────────────────────────────────────────────────
function HealthSection({ v, u }) {
  const s = 'health'
  const diseases = [
    'Anemia', 'Autoimmune Disease', 'Blood Sugar Issues', 'Cancer', 'Chlamydia',
    'CMV', 'Hepatitis B', 'High Blood Pressure', 'High Cholesterol', 'HIV/AIDS',
    'HPV', 'Kidney Disease', 'Lupus', 'Sickle Cell', 'Thyroid Disease', 'None'
  ]
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[#283693]/5 border border-[#283693]/10">
        <h4 className="font-medium text-[#283693] mb-3">Mental Health</h4>
        <div className="space-y-4">
          <YesNoField label="Have you been diagnosed with a mental health condition?" value={v(s, 'mentalHealthDiagnosis')} onChange={u(s, 'mentalHealthDiagnosis')} />
          {v(s, 'mentalHealthDiagnosis') === 'yes' && (
            <TextAreaField label="Please describe" value={v(s, 'mentalHealthDetails')} onChange={u(s, 'mentalHealthDetails')} rows={2} />
          )}
          <YesNoField label="Hospitalized for mental health?" value={v(s, 'mentalHealthHospitalization')} onChange={u(s, 'mentalHealthHospitalization')} />
          <YesNoField label="Medication for mental health?" value={v(s, 'mentalHealthMedication')} onChange={u(s, 'mentalHealthMedication')} />
          <YesNoField label="Currently in counseling or therapy?" value={v(s, 'counselingTherapy')} onChange={u(s, 'counselingTherapy')} />
          <YesNoField label="Family history of mental health conditions?" value={v(s, 'familyMentalHealth')} onChange={u(s, 'familyMentalHealth')} />
          <YesNoField label="History of domestic violence?" value={v(s, 'domesticViolence')} onChange={u(s, 'domesticViolence')} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-pink-50/50 border border-pink-100">
        <h4 className="font-medium text-[#283693] mb-3">Medications</h4>
        <div className="space-y-4">
          <TextAreaField label="Non-prescription medications" value={v(s, 'nonPrescriptionMeds')} onChange={u(s, 'nonPrescriptionMeds')}
            placeholder="Vitamins, supplements, OTC medications" rows={2} />
          <TextAreaField label="Prescription medications (past 5 years)" value={v(s, 'prescriptionMeds')} onChange={u(s, 'prescriptionMeds')} rows={2} />
          <TextAreaField label="Current medications and supplements" value={v(s, 'currentMeds')} onChange={u(s, 'currentMeds')} rows={2} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="RH Factor" value={v(s, 'rhFactor')} onChange={u(s, 'rhFactor')}
          options={['Positive', 'Negative', 'Unknown']} />
        <SelectField label="Blood Type" value={v(s, 'bloodType')} onChange={u(s, 'bloodType')}
          options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']} />
      </div>
      <TextAreaField label="Allergies" value={v(s, 'allergies')} onChange={u(s, 'allergies')} placeholder="List any allergies" rows={2} />
      <TextAreaField label="Medical conditions" value={v(s, 'medicalConditions')} onChange={u(s, 'medicalConditions')} rows={2} />
      <TextAreaField label="Surgeries in the past 5 years" value={v(s, 'surgeries')} onChange={u(s, 'surgeries')} rows={2} />

      <CheckboxGroupField label="Disease History" options={diseases}
        value={v(s, 'diseaseHistory') || []} onChange={u(s, 'diseaseHistory')} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Hepatitis B/C antibodies?" value={v(s, 'hepAntibodies')} onChange={u(s, 'hepAntibodies')} />
        <YesNoField label="Hepatitis B immunized?" value={v(s, 'hepBImmunized')} onChange={u(s, 'hepBImmunized')} />
      </div>
      <YesNoField label="Open to vaccinations?" value={v(s, 'openToVaccinations')} onChange={u(s, 'openToVaccinations')} />

      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">COVID-19</h4>
        <div className="space-y-4">
          <YesNoField label="COVID-19 vaccine?" value={v(s, 'covidVaccine')} onChange={u(s, 'covidVaccine')} />
          {v(s, 'covidVaccine') === 'yes' && (
            <TextField label="Which vaccine?" value={v(s, 'covidVaccineType')} onChange={u(s, 'covidVaccineType')} placeholder="e.g. Pfizer, Moderna" />
          )}
          <YesNoField label="COVID-19 booster?" value={v(s, 'covidBooster')} onChange={u(s, 'covidBooster')} />
          <YesNoField label="Have you had COVID-19?" value={v(s, 'hadCovid')} onChange={u(s, 'hadCovid')} />
          {v(s, 'hadCovid') === 'yes' && (
            <TextAreaField label="Details" value={v(s, 'covidDetails')} onChange={u(s, 'covidDetails')} rows={2} />
          )}
          <YesNoField label="Is your partner vaccinated?" value={v(s, 'partnerVaccinated')} onChange={u(s, 'partnerVaccinated')} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 6. Lifestyle
// ─────────────────────────────────────────────────────────
function LifestyleSection({ v, u }) {
  const s = 'lifestyle'
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Do you smoke or vape?" value={v(s, 'smokeVape')} onChange={u(s, 'smokeVape')} />
        <YesNoField label="History of smoking?" value={v(s, 'smokingHistory')} onChange={u(s, 'smokingHistory')} />
      </div>
      <YesNoField label="Does anyone in your household smoke?" value={v(s, 'householdSmoker')} onChange={u(s, 'householdSmoker')} />
      <YesNoField label="Do you use alcohol or recreational drugs?" value={v(s, 'alcoholDrugs')} onChange={u(s, 'alcoholDrugs')} />
      <YesNoField label="Controlled substances in household?" value={v(s, 'householdControlledSubstances')} onChange={u(s, 'householdControlledSubstances')} />

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Piercings & Tattoos</h4>
        <div className="space-y-4">
          <YesNoField label="Do you have piercings or tattoos?" value={v(s, 'piercingsTattoos')} onChange={u(s, 'piercingsTattoos')} />
          {v(s, 'piercingsTattoos') === 'yes' && (
            <>
              <TextAreaField label="Describe" value={v(s, 'piercingsTattoosDetails')} onChange={u(s, 'piercingsTattoosDetails')} rows={2} />
              <TextField label="Date of last tattoo" value={v(s, 'lastTattooDate')} onChange={u(s, 'lastTattooDate')} type="date" />
            </>
          )}
          <YesNoField label="Non-sterile piercing in the last 12 months?" value={v(s, 'nonSterilePiercing')} onChange={u(s, 'nonSterilePiercing')} />
        </div>
      </div>

      <YesNoField label="Ever advised to limit alcohol or drugs?" value={v(s, 'advisedLimitSubstances')} onChange={u(s, 'advisedLimitSubstances')} />
      <YesNoField label="History of eating disorders?" value={v(s, 'eatingDisorders')} onChange={u(s, 'eatingDisorders')} />
      <TextAreaField label="Describe your typical diet" value={v(s, 'typicalDiet')} onChange={u(s, 'typicalDiet')}
        placeholder="What does a typical day of eating look like?" rows={3} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Exercise type & frequency" value={v(s, 'exerciseFrequency')} onChange={u(s, 'exerciseFrequency')} placeholder="e.g. Walking 3x/week" />
        <TextField label="Hours of sleep per night" value={v(s, 'sleepHours')} onChange={u(s, 'sleepHours')} type="number" placeholder="e.g. 7" />
      </div>
      <YesNoField label="Any sleep issues?" value={v(s, 'sleepIssues')} onChange={u(s, 'sleepIssues')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Religion" value={v(s, 'religion')} onChange={u(s, 'religion')} />
        <SelectField label="How important is religion to you?" value={v(s, 'religionImportance')} onChange={u(s, 'religionImportance')}
          options={['Not Important', 'Somewhat Important', 'Important', 'Very Important']} />
      </div>
      <SelectField label="Ethnicity" value={v(s, 'ethnicity')} onChange={u(s, 'ethnicity')}
        options={['White', 'Black or African American', 'Hispanic or Latino', 'Asian', 'Native American', 'Pacific Islander', 'Middle Eastern', 'Mixed / Multiracial', 'Other', 'Prefer not to say']}
        className="max-w-xs" />
      <YesNoField label="Any criminal history?" value={v(s, 'criminalHistory')} onChange={u(s, 'criminalHistory')} />
      {v(s, 'criminalHistory') === 'yes' && (
        <TextAreaField label="Please describe" value={v(s, 'criminalHistoryDetails')} onChange={u(s, 'criminalHistoryDetails')} rows={2} />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Recent international travel?" value={v(s, 'recentTravel')} onChange={u(s, 'recentTravel')} />
        <YesNoField label="Travel plans in the near future?" value={v(s, 'travelPlans')} onChange={u(s, 'travelPlans')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <YesNoField label="Do you have a reliable vehicle?" value={v(s, 'reliableVehicle')} onChange={u(s, 'reliableVehicle')} />
        <YesNoField label="Valid driver's license?" value={v(s, 'validLicense')} onChange={u(s, 'validLicense')} />
      </div>
      <YesNoField label="Do you have auto insurance?" value={v(s, 'autoInsurance')} onChange={u(s, 'autoInsurance')} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 7. Employment & Finances
// ─────────────────────────────────────────────────────────
function EmploymentSection({ v, u }) {
  const s = 'employment'
  return (
    <div className="space-y-6">
      <YesNoField label="Are you currently employed?" value={v(s, 'currentlyEmployed')} onChange={u(s, 'currentlyEmployed')} />
      {v(s, 'currentlyEmployed') === 'yes' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Occupation" value={v(s, 'occupation')} onChange={u(s, 'occupation')} />
            <TextField label="Work hours per week" value={v(s, 'workHours')} onChange={u(s, 'workHours')} type="number" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Length at current employer" value={v(s, 'lengthAtEmployer')} onChange={u(s, 'lengthAtEmployer')} placeholder="e.g. 2 years" />
            <TextField label="Hourly rate" value={v(s, 'hourlyRate')} onChange={u(s, 'hourlyRate')} type="number" placeholder="$" />
          </div>
          <TextField label="Weekly income" value={v(s, 'weeklyIncome')} onChange={u(s, 'weeklyIncome')} type="number" placeholder="$" className="max-w-xs" />
        </>
      )}

      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Partner Employment</h4>
        <div className="space-y-4">
          <TextField label="Partner's occupation" value={v(s, 'partnerOccupation')} onChange={u(s, 'partnerOccupation')} />
          <TextField label="Partner's weekly income" value={v(s, 'partnerWeeklyIncome')} onChange={u(s, 'partnerWeeklyIncome')} type="number" placeholder="$" />
        </div>
      </div>

      <TextAreaField label="Health insurance details" value={v(s, 'healthInsurance')} onChange={u(s, 'healthInsurance')}
        placeholder="Provider, plan type, policy number (if applicable)" rows={3} />
      <YesNoField label="Do you receive government assistance?" value={v(s, 'governmentAssistance')} onChange={u(s, 'governmentAssistance')} />
      {v(s, 'governmentAssistance') === 'yes' && (
        <TextAreaField label="Please describe" value={v(s, 'governmentAssistanceDetails')} onChange={u(s, 'governmentAssistanceDetails')} rows={2} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 8. Surrogacy Preferences
// ─────────────────────────────────────────────────────────
function PreferencesSection({ v, u }) {
  const s = 'preferences'
  return (
    <div className="space-y-6">
      {/* Previous surrogacy experience */}
      <div className="p-4 rounded-xl bg-[#283693]/5 border border-[#283693]/10">
        <h4 className="font-medium text-[#283693] mb-3">Previous Surrogacy Experience</h4>
        <div className="space-y-4">
          <YesNoField label="Have you been a surrogate before?" value={v(s, 'previousSurrogate')} onChange={u(s, 'previousSurrogate')} />
          {v(s, 'previousSurrogate') === 'yes' && (
            <>
              <TextField label="How many times?" value={v(s, 'surrogacyTimes')} onChange={u(s, 'surrogacyTimes')} type="number" className="max-w-xs" />
              <TextAreaField label="Surrogacy pregnancy history" value={v(s, 'surrogacyPregnancyHistory')} onChange={u(s, 'surrogacyPregnancyHistory')} rows={2} />
              <TextField label="Number of attempts/transfers" value={v(s, 'attemptsTransfers')} onChange={u(s, 'attemptsTransfers')} type="number" className="max-w-xs" />
              <SelectField label="Embryo source" value={v(s, 'embryoSource')} onChange={u(s, 'embryoSource')}
                options={['Donor Egg', 'Intended Mother', 'Both', 'Unknown']} />
              <TextField label="Unsuccessful cycles" value={v(s, 'unsuccessfulCycles')} onChange={u(s, 'unsuccessfulCycles')} type="number" className="max-w-xs" />
              <TextAreaField label="Overall surrogacy experience" value={v(s, 'overallExperience')} onChange={u(s, 'overallExperience')} rows={3} />
            </>
          )}
        </div>
      </div>

      {/* Motivation */}
      <div className="p-4 rounded-xl bg-pink-50/50 border border-pink-100">
        <h4 className="font-medium text-[#283693] mb-3">Your Motivation</h4>
        <div className="space-y-4">
          <TextAreaField label="Why do you want to be a surrogate?" value={v(s, 'reasonForSurrogacy')} onChange={u(s, 'reasonForSurrogacy')}
            placeholder="Share your heart — what draws you to surrogacy?" rows={4} />
          <TextAreaField label="How would you use the compensation?" value={v(s, 'compensationUse')} onChange={u(s, 'compensationUse')} rows={2} />
          <TextAreaField label="How does surrogacy fit into your life right now?" value={v(s, 'surrogacyFit')} onChange={u(s, 'surrogacyFit')} rows={2} />
          <TextAreaField label="Describe your support system" value={v(s, 'supportSystem')} onChange={u(s, 'supportSystem')}
            placeholder="Who supports you in this journey?" rows={2} />
        </div>
      </div>

      {/* Willingness */}
      <div className="space-y-4">
        <h4 className="font-medium text-[#283693]">Willingness</h4>
        <YesNoField label="Willing to have up to 3 transfer attempts?" value={v(s, 'threeTransferAttempts')} onChange={u(s, 'threeTransferAttempts')} />
        <YesNoField label="Willing to reduce caffeine intake?" value={v(s, 'reduceCaffeine')} onChange={u(s, 'reduceCaffeine')} />
        <YesNoField label="Willing to make lifestyle changes at IP request?" value={v(s, 'lifestyleChanges')} onChange={u(s, 'lifestyleChanges')} />
        <YesNoField label="Willing to pump colostrum/breastmilk?" value={v(s, 'pumpBreastmilk')} onChange={u(s, 'pumpBreastmilk')} />
      </div>

      {/* Ideal match */}
      <div className="p-4 rounded-xl bg-[#faf8f5] border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Ideal Match</h4>
        <div className="space-y-4">
          <TextAreaField label="Describe your ideal intended parents" value={v(s, 'idealIPs')} onChange={u(s, 'idealIPs')} rows={3} />
          <SelectField label="Preferred communication style" value={v(s, 'preferredCommunication')} onChange={u(s, 'preferredCommunication')}
            options={['Text/Message', 'Phone Calls', 'Video Calls', 'Email', 'Mix of Everything']} />
          <SelectField label="Ideal IP involvement during pregnancy" value={v(s, 'ipInvolvement')} onChange={u(s, 'ipInvolvement')}
            options={['Very Involved', 'Moderately Involved', 'Occasional Check-ins', 'Minimal']} />
          <YesNoField label="IPs present at appointments and delivery?" value={v(s, 'ipsAtAppointments')} onChange={u(s, 'ipsAtAppointments')} />
          <TextAreaField label="Who else would you like in the delivery room?" value={v(s, 'deliveryRoomOthers')} onChange={u(s, 'deliveryRoomOthers')} rows={2} />
          <TextAreaField label="How would you feel if IPs can't attend appointments?" value={v(s, 'ipsCantAttend')} onChange={u(s, 'ipsCantAttend')} rows={2} />
          <YesNoField label="Match with IPs who already have children?" value={v(s, 'ipsWithChildren')} onChange={u(s, 'ipsWithChildren')} />
        </div>
      </div>

      {/* Openness */}
      <div className="space-y-4">
        <h4 className="font-medium text-[#283693]">Openness</h4>
        <YesNoField label="Open to LGBTQ+ intended parents?" value={v(s, 'openLGBTQ')} onChange={u(s, 'openLGBTQ')} />
        <YesNoField label="Open to a single intended parent?" value={v(s, 'openSingleIP')} onChange={u(s, 'openSingleIP')} />
        <YesNoField label="Willing to give birth in another state?" value={v(s, 'birthAnotherState')} onChange={u(s, 'birthAnotherState')} />
        <YesNoField label="Willing to have embryo transfer in another state?" value={v(s, 'transferAnotherState')} onChange={u(s, 'transferAnotherState')} />
        <YesNoField label="Open to IPs outside the US?" value={v(s, 'ipsOutsideUS')} onChange={u(s, 'ipsOutsideUS')} />
        <YesNoField label="Willing to bring children when traveling?" value={v(s, 'bringChildrenTraveling')} onChange={u(s, 'bringChildrenTraveling')} />
      </div>

      {/* Timeline & relationship */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="When are you ready to begin?" value={v(s, 'whenReadyToBegin')} onChange={u(s, 'whenReadyToBegin')}
          options={['Immediately', 'Within 1-3 months', 'Within 3-6 months', 'Within 6-12 months', '1+ year']} />
        <SelectField label="Ideal post-birth relationship" value={v(s, 'postBirthRelationship')} onChange={u(s, 'postBirthRelationship')}
          options={['Close / Ongoing', 'Occasional Updates', 'Holiday Cards / Photos', 'Clean Break', 'Open to Whatever Develops']} />
      </div>

      {/* Medical decisions */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <h4 className="font-medium text-[#283693] mb-3">Medical Decisions</h4>
        <div className="space-y-4">
          <YesNoField label="Willing to undergo CVS/amniocentesis?" value={v(s, 'cvsAmnio')} onChange={u(s, 'cvsAmnio')} />
          <SelectField label="Willingness to terminate pregnancy" value={v(s, 'willingnessToTerminate')} onChange={u(s, 'willingnessToTerminate')}
            options={['Yes, if medically necessary', 'Yes, for any reason IPs decide', 'Only for fatal conditions', 'No, under no circumstances', 'Need more discussion']} />
          <YesNoField label="Does your partner agree with your termination decision?" value={v(s, 'partnerAgreesTermination')} onChange={u(s, 'partnerAgreesTermination')} />
          <TextAreaField label="Specific conditions where you would not terminate" value={v(s, 'conditionsWontTerminate')} onChange={u(s, 'conditionsWontTerminate')} rows={2} />
          <SelectField label="Number of embryos willing to transfer" value={v(s, 'embryosToTransfer')} onChange={u(s, 'embryosToTransfer')}
            options={['1', '2', '3', 'Open to discussion']} />
          <YesNoField label="Willing to carry twins if embryo splits?" value={v(s, 'carryTwins')} onChange={u(s, 'carryTwins')} />
          <YesNoField label="Open to selective reduction for triplets?" value={v(s, 'selectiveReduction')} onChange={u(s, 'selectiveReduction')} />
        </div>
      </div>

      {/* Compensation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Desired base compensation" value={v(s, 'desiredCompensation')} onChange={u(s, 'desiredCompensation')} placeholder="$" />
      </div>
      <TextAreaField label="Additional comments" value={v(s, 'additionalComments')} onChange={u(s, 'additionalComments')}
        placeholder="Anything else you'd like us or intended parents to know?" rows={4} />
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
      {index === 0 && total > 1 && (
        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#ed148c] text-white text-[10px] font-bold shadow-sm">Cover</span>
      )}
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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    listProfilePhotos(userId).then(setPhotos).catch(() => {})
  }, [userId])

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
        Upload photos that show your personality! Drag to reorder — the first photo is your cover. Tap a photo to crop or rotate.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map(p => p.path)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo, i) => (
              <SortablePhoto key={photo.path} photo={photo} index={i} total={photos.length}
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
