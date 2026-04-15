import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Baby, Stethoscope, User, Heart, HeartPulse, BookOpen, CheckCircle2, Circle, ChevronDown, Loader2, Upload, X, Camera, Eye, ShieldCheck, Trash2, ChevronLeft, ChevronRight, RotateCw, Crop as CropIcon, CalendarDays, MapPin } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Cropper from 'react-easy-crop'
import { findCaseByEmail, updateIntakeSubmission, uploadProfilePhoto, deleteProfilePhoto, listProfilePhotos } from '@/lib/db'
import ConfirmDialog from '@/components/ui/confirm-dialog'

// ── Field definitions ──

const FERTILITY_FIELDS = [
  { key: 'reasonForSurrogacy', label: 'What led to your decision to pursue surrogacy?', type: 'textarea' },
  { key: 'fertilityProcedures', label: 'What fertility procedures have you tried?', type: 'textarea' },
  { key: 'hasFrozenEmbryos', label: 'Do you have frozen embryos?', type: 'yesno' },
  { key: 'frozenEmbryoCount', label: 'How many frozen embryos?', type: 'text', conditional: d => d.hasFrozenEmbryos === 'yes' },
  { key: 'embryosGeneticallyTested', label: 'Have the embryos been genetically tested?', type: 'textarea' },
  { key: 'usingEggDonor', label: 'Using an egg donor?', type: 'yesno' },
  { key: 'usingSpermDonor', label: 'Using a sperm donor?', type: 'yesno' },
  { key: 'embryoTransferCount', label: 'Transfer one embryo or two?', type: 'select', options: ['1', '2', 'Undecided'] },
  { key: 'anticipatedTransferDate', label: 'When do you anticipate having the embryo transfer?', type: 'text' },
  { key: 'hasOtherChildren', label: 'Do you have other children?', type: 'yesno' },
  { key: 'otherChildrenDetails', label: 'How many and what age(s)?', type: 'text', conditional: d => d.hasOtherChildren === 'yes' },
]

const SURROGACY_FIELDS = [
  { key: 'clinicName', label: 'Name and location of your clinic and RE?', type: 'text' },
  { key: 'surrogatePreference', label: 'Prefer single, married, or no preference for surrogate?', type: 'select', options: ['Single', 'Married', 'No Preference'] },
  { key: 'locationPreference', label: 'Preference on where surrogate resides?', type: 'yesno' },
  { key: 'locationPreferenceStates', label: 'Which state(s)?', type: 'text', conditional: d => d.locationPreference === 'yes' },
  { key: 'firstTimeOrRepeat', label: 'First time or repeat surrogate?', type: 'textarea' },
  { key: 'attendAppointments', label: 'Attend milestone OB appointments?', type: 'yesno' },
  { key: 'terminationForAbnormalities', label: 'If abnormalities, would you terminate?', type: 'textarea' },
  { key: 'relationshipWithSurrogate', label: 'What kind of relationship during pregnancy?', type: 'textarea' },
  { key: 'inDeliveryRoom', label: 'Want to be in the delivery room?', type: 'yesno' },
  { key: 'tandemSurrogacy', label: 'Pursue tandem surrogacy?', type: 'yesno' },
  { key: 'whatTellChild', label: 'What will you tell your child about the birth process?', type: 'textarea' },
  { key: 'messageToGC', label: 'Anything you\'d like to say to a potential GC?', type: 'textarea' },
]

const PERSONAL_FIELDS = [
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'birthplace', label: 'Birthplace', type: 'text' },
  { key: 'ethnicity', label: 'Ethnicity', type: 'text' },
  { key: 'languages', label: 'Languages', type: 'text' },
  { key: 'usCitizen', label: 'US Citizen?', type: 'yesno' },
  { key: 'citizenshipCountry', label: 'Citizenship Country', type: 'text', conditional: d => d.usCitizen === 'no' },
  { key: 'criminalHistory', label: 'Ever been arrested or convicted?', type: 'textarea' },
]

const HEALTH_CONDITIONS = [
  'Blood Transfusion', 'Polio or Meningitis', 'High Blood Pressure', 'Scarlet Fever',
  'Nervous Breakdown', 'Heart Disease', 'Low Blood Pressure', 'Gonorrhea/Syphilis',
  'Jaundice', 'Epilepsy', 'Migraines', 'Tuberculosis', 'Cancer', 'Hepatitis',
  'HIV/AIDS', 'Herpes', 'Chicken Pox', 'None of the above',
]

const HEALTH_FIELDS = [
  { key: 'generalHealth', label: 'General health condition', type: 'textarea' },
  { key: 'medicalConditions', label: 'Any medical conditions?', type: 'textarea' },
  { key: 'hepatitisBC', label: 'Tested positive for Hep B or C?', type: 'textarea' },
  { key: 'hivAids', label: 'HIV/AIDS?', type: 'yesno' },
  { key: 'mentalHealthDiagnosis', label: 'Mental health diagnosis?', type: 'yesno' },
  { key: 'mentalHealthDiagnosisDetails', label: 'Diagnosis details', type: 'textarea', conditional: d => d.mentalHealthDiagnosis === 'yes' },
  { key: 'mentalHealthMedication', label: 'Mental health medication?', type: 'yesno' },
  { key: 'mentalHealthMedicationDetails', label: 'Medication details', type: 'textarea', conditional: d => d.mentalHealthMedication === 'yes' },
  { key: 'mentalHealthHospitalization', label: 'Mental health hospitalization?', type: 'yesno' },
  { key: 'mentalHealthHospitalizationDetails', label: 'Hospitalization details', type: 'textarea', conditional: d => d.mentalHealthHospitalization === 'yes' },
  { key: 'healthConditionsList', label: 'Health conditions (check all that apply)', type: 'checkboxGroup', options: HEALTH_CONDITIONS },
  { key: 'healthConditionsDetails', label: 'Dates for any of the above', type: 'textarea', conditional: d => {
    const list = d.healthConditionsList
    return Array.isArray(list) && list.length > 0 && !list.every(v => v === 'None of the above')
  }},
]

const HISTORY_FIELDS = [
  { key: 'favoriteMusic', label: 'Favorite Music', type: 'text' },
  { key: 'favoriteMovie', label: 'Favorite Movie', type: 'text' },
  { key: 'favoriteBook', label: 'Favorite Book', type: 'text' },
  { key: 'favoriteFoods', label: 'Favorite Foods', type: 'text' },
  { key: 'favoriteColor', label: 'Favorite Color', type: 'text' },
  { key: 'favoriteFlower', label: 'Favorite Flower', type: 'text' },
  { key: 'pets', label: 'Pets', type: 'textarea' },
  { key: 'freeTime', label: 'What do you do in your free time?', type: 'textarea' },
  { key: 'collections', label: 'Collections', type: 'text' },
  { key: 'travelDestination', label: 'Favorite travel destination', type: 'textarea' },
  { key: 'personality', label: 'Describe yourself and personality', type: 'textarea' },
  { key: 'messageToSurrogate', label: 'What else would you like to tell the prospective surrogate?', type: 'textarea' },
]

// ── Photo helpers ──

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

function PhotoUpload({ label, hint, userId, subfolder, onPhotoChange }) {
  const [photo, setPhoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId || userId === 'anonymous') return
    let cancelled = false
    listProfilePhotos(`${userId}/${subfolder}`).then(photos => {
      if (cancelled) return
      if (photos.length > 0) setPhoto(photos[0])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId, subfolder])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
    setUploading(true); setError(null)
    try {
      if (photo) await deleteProfilePhoto(photo.path).catch(() => {})
      const jpeg = await convertToJpeg(file)
      const result = await uploadProfilePhoto(`${userId}/${subfolder}`, jpeg)
      if (result) { setPhoto(result); if (onPhotoChange) onPhotoChange(result.url) }
    } catch (err) { setError(err.message || 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete() {
    if (!photo) return
    try { await deleteProfilePhoto(photo.path); setPhoto(null); if (onPhotoChange) onPhotoChange(null) }
    catch (err) { setError(err.message || 'Delete failed') }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
      {photo ? (
        <div className="relative group w-32 h-32">
          <img src={photo.url} alt={label} className="w-32 h-32 rounded-2xl object-cover border border-stone-200" />
          <button onClick={handleDelete}
            className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className={`flex items-center justify-center w-32 h-32 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#283693]/50 hover:bg-[#283693]/5 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="text-center">
            {uploading ? <Loader2 className="w-6 h-6 mx-auto text-[#283693] animate-spin" /> : (
              <><Upload className="w-6 h-6 mx-auto text-stone-400" /><span className="text-xs text-stone-400 mt-1 block">Upload</span></>
            )}
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ── Crop helper ──
function getCroppedImg(imageSrc, crop, rotation = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const rad = (rotation * Math.PI) / 180
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

// ── Sortable photo tile ──
export function SortablePhoto({ photo, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.path })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-2xl overflow-hidden border border-stone-200 touch-none" {...attributes} {...listeners}>
      <img src={photo.url} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(photo) }}
          className="p-1.5 rounded-full bg-white/90 text-stone-700 hover:bg-white shadow-sm">
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

// ── Photo Editor (crop + rotate) ──
export function PhotoEditor({ photo, onSave, onClose, aspect = 1 }) {
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
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full h-80 sm:h-96 bg-stone-900 rounded-xl overflow-hidden">
        <Cropper image={photo.url} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect} showGrid
          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, area) => setCroppedArea(area)} />
      </div>
      <div className="flex items-center gap-4">
        <label className="text-xs text-stone-500 shrink-0">Zoom</label>
        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-[#283693]" />
        <button onClick={() => setRotation(r => (r + 90) % 360)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg hover:bg-stone-50">
          <RotateCw className="w-3.5 h-3.5" /> Rotate
        </button>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg text-white" style={{ backgroundColor: '#283693' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Photo Gallery (drag to reorder, click to edit, multi-upload, delete) ──

function PhotoGallery({ storagePath, order, onOrderChange }) {
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
      // Apply persisted order if provided
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
          setPhotos(prev => {
            const next = [...prev, result]
            persistOrder(next)
            return next
          })
        }
      }
    } catch (err) { setError(err.message || 'Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete(photo) {
    try {
      await deleteProfilePhoto(photo.path)
      setPhotos(prev => {
        const next = prev.filter(p => p.path !== photo.path)
        persistOrder(next)
        return next
      })
    } catch (err) { setError(err.message || 'Delete failed') }
  }

  async function handleCropSave(oldPhoto, croppedFile) {
    try {
      const result = await uploadProfilePhoto(storagePath, croppedFile)
      if (result) {
        await deleteProfilePhoto(oldPhoto.path).catch(() => {})
        setPhotos(prev => {
          const next = prev.map(p => p.path === oldPhoto.path ? result : p)
          persistOrder(next)
          return next
        })
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
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Add favorite photos that show your personality. Drag to reorder. Tap a photo to crop or rotate.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map(p => p.path)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map(photo => (
              <SortablePhoto key={photo.path} photo={photo} onEdit={setEditing} onDelete={setDeleteTarget} />
            ))}
            <label className={`flex items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#283693]/50 hover:bg-[#283693]/5 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="text-center">
                {uploading ? <Loader2 className="w-6 h-6 mx-auto text-[#283693] animate-spin" /> : (
                  <><Upload className="w-6 h-6 mx-auto text-stone-400" /><span className="text-xs text-stone-400 mt-1 block">Add Photo</span></>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </SortableContext>
      </DndContext>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }} title="Delete photo?" message="This photo will be permanently deleted." onConfirm={() => { handleDelete(deleteTarget); setDeleteTarget(null) }} />
    </div>
  )
}

// ── IP Profile Preview Component ──

const STATE_ABBR = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' }
function expandState(s) { return (s && STATE_ABBR[s.toUpperCase()]) || s }

export function IPProfilePreview({ profile, photos, hasPartner, ip1Name, ip2Name, primaryName, ip2FullName, location }) {
  // Photos can be tagged with kind, or fall back to path matching
  const profilePhoto = photos?.find(p => p.kind === 'portrait') || photos?.find(p => p.path?.includes('/portrait/') || p.path?.includes('/ip-portrait/'))
  const coverPhoto = photos?.find(p => p.kind === 'cover') || photos?.find(p => p.path?.includes('/cover/') || p.path?.includes('/ip-cover/'))
  const galleryPhotos = photos?.filter(p => p.kind === 'gallery' || (p.path?.includes('/gallery/') && !p.path?.includes('/portrait/') && !p.path?.includes('/cover/'))) || []
  // All viewable photos for lightbox: cover first, then gallery
  const lightboxPhotos = coverPhoto ? [coverPhoto, ...galleryPhotos] : galleryPhotos
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const fertility = profile?.fertility || {}
  const surrogacy = profile?.surrogacy || {}
  const ip1 = profile?.ip1 || {}
  const ip2 = profile?.ip2 || {}

  const yn = (v) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : null

  function calcAge(dob) {
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let a = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--
    return a > 0 ? a : null
  }

  function fmtDate(d) {
    if (!d) return null
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  function fmtFieldValue(f, data) {
    const val = data[f.key]
    if (f.type === 'yesno') return yn(val)
    if (f.type === 'date') return fmtDate(val)
    if (f.key === 'healthConditionsList' && Array.isArray(val)) {
      if (val.includes('None of the above')) return 'None'
      return val.join(', ')
    }
    if (Array.isArray(val)) return val.join(', ')
    return val
  }

  const ip1Age = calcAge(ip1?.personal?.dob)
  const ip2Age = hasPartner ? calcAge(ip2?.personal?.dob) : null

  const PVField = ({ label, value }) => (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="italic text-gray-300">Not provided</span>}</p>
    </div>
  )

  const IPSection = ({ title, icon: Icon, children }) => (
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

  const renderSectionContent = (data, fieldDefs) => {
    const visible = fieldDefs.filter(f => {
      if (f.conditional && !f.conditional(data)) return false
      const val = data[f.key]
      return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)
    })
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        {visible.map(f => <PVField key={f.key} label={f.label} value={fmtFieldValue(f, data)} />)}
      </div>
    )
  }

  const sectionIcons = {
    fertility: Baby,
    surrogacy: Heart,
    personal: User,
    health: HeartPulse,
    history: BookOpen,
  }

  return (
    <>
    <div className="bg-gradient-to-b from-[#fdf8f3] to-[#f5f0eb] rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      {/* Cover photo — full image, no crop */}
      {coverPhoto ? (
        <div className="w-full bg-stone-100 relative">
          <img src={coverPhoto.url} alt="Cover" className="w-full h-auto max-h-[500px] object-contain" />
          {lightboxPhotos.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {lightboxPhotos.length} photos
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-[#283693]/20 via-[#4a4fbf]/10 to-[#283693]/10" />
      )}

      {/* Thumbnail strip — peeks under the cover, opens lightbox */}
      {lightboxPhotos.length > 1 && (
        <div className="flex gap-2 px-6 -mt-6 relative z-10 overflow-x-auto pb-1">
          {lightboxPhotos.map((ph, i) => (
            <button key={ph.path} onClick={() => setLightboxIdx(i)}
              className="w-14 h-14 rounded-lg overflow-hidden border-2 border-white shadow-md shrink-0 hover:scale-105 transition-all">
              <img src={ph.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Summary Header — matches GC profile pattern */}
      <div className="mx-6 mt-6 bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h2 className="text-3xl font-heading font-bold text-[#283693]">
              {hasPartner ? `${primaryName} & ${ip2FullName}` : primaryName}
            </h2>
            {location && (
              <p className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-stone-500 mt-1.5">
                <MapPin className="w-4 h-4" /> {location}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {ip1Age && (
              <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-[#283693]/5">
                <CalendarDays className="w-5 h-5 text-[#283693] mb-1" />
                <span className="text-2xl font-bold text-[#283693]">{ip1Age}</span>
                <span className="text-[11px] text-stone-400">{hasPartner ? ip1Name : 'Age'}</span>
              </div>
            )}
            {ip2Age && (
              <div className="flex flex-col items-center px-5 py-3 rounded-2xl bg-[#ed148c]/5">
                <CalendarDays className="w-5 h-5 text-[#ed148c] mb-1" />
                <span className="text-2xl font-bold text-[#ed148c]">{ip2Age}</span>
                <span className="text-[11px] text-stone-400">{ip2Name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="px-6 sm:px-8 py-6 space-y-5">
        <IPSection title="Fertility Information" icon={Baby}>
          {renderSectionContent(fertility, FERTILITY_FIELDS)}
        </IPSection>

        <IPSection title="Surrogacy Information" icon={Heart}>
          {renderSectionContent(surrogacy, SURROGACY_FIELDS)}
        </IPSection>

        {/* Per-person sections */}
        {(['personal', 'health', 'history']).map(secKey => {
          const fieldDefs = secKey === 'personal' ? PERSONAL_FIELDS : secKey === 'health' ? HEALTH_FIELDS : HISTORY_FIELDS
          const sectionLabel = secKey === 'personal' ? 'Personal Information' : secKey === 'health' ? 'Health Information' : 'Personal History'
          const Icon = sectionIcons[secKey]

          if (!hasPartner) {
            return (
              <IPSection key={secKey} title={sectionLabel} icon={Icon}>
                {renderSectionContent(ip1[secKey] || {}, fieldDefs)}
              </IPSection>
            )
          }

          return (
            <IPSection key={secKey} title={sectionLabel} icon={Icon}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-xs font-bold text-[#283693] uppercase tracking-wider border-b border-gray-100 pb-2">{ip1Name}</p>
                  {renderSectionContent(ip1[secKey] || {}, fieldDefs)}
                </div>
                <div className="space-y-4 lg:border-l lg:border-gray-100 lg:pl-6">
                  <p className="text-xs font-bold text-[#283693] uppercase tracking-wider border-b border-gray-100 pb-2">{ip2Name}</p>
                  {renderSectionContent(ip2[secKey] || {}, fieldDefs)}
                </div>
              </div>
            </IPSection>
          )
        })}
      </div>
    </div>

    {/* ── Photo Lightbox Modal ── */}
    {lightboxIdx !== null && lightboxPhotos.length > 0 && (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
        <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10" onClick={() => setLightboxIdx(null)}>
          <X className="w-8 h-8" />
        </button>
        <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
          <img src={lightboxPhotos[lightboxIdx].url} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />
          {lightboxPhotos.length > 1 && (
            <>
              <button onClick={() => setLightboxIdx(i => (i - 1 + lightboxPhotos.length) % lightboxPhotos.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={() => setLightboxIdx(i => (i + 1) % lightboxPhotos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors">
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm font-medium px-3 py-1 rounded-full">
                {lightboxIdx + 1} / {lightboxPhotos.length}
              </div>
            </>
          )}
        </div>
        {/* Thumbnail strip */}
        {lightboxPhotos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 mb-10">
            {lightboxPhotos.map((ph, i) => (
              <button key={ph.path} onClick={(e) => { e.stopPropagation(); setLightboxIdx(i) }}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === lightboxIdx ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
                <img src={ph.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    </>
  )
}

const SECTIONS = [
  { key: 'fertility', label: 'Fertility Information', description: 'Embryos, donors, and fertility history', icon: Baby, fields: FERTILITY_FIELDS, perPerson: false },
  { key: 'surrogacy', label: 'Surrogacy Information', description: 'Preferences, expectations, and clinic details', icon: Heart, fields: SURROGACY_FIELDS, perPerson: false },
  { key: 'personal', label: 'Personal Information', description: 'Background, citizenship, and personal details', icon: User, fields: PERSONAL_FIELDS, perPerson: true },
  { key: 'health', label: 'Health Information', description: 'Medical history and health conditions', icon: HeartPulse, fields: HEALTH_FIELDS, perPerson: true },
  { key: 'history', label: 'Personal History', description: 'Interests, favorites, and personality', icon: BookOpen, fields: HISTORY_FIELDS, perPerson: true },
]

// ── Completion helpers ──

function countCompletion(profile, hasPartner) {
  let filled = 0, total = 0
  for (const sec of SECTIONS) {
    const data = sec.perPerson ? profile?.ip1?.[sec.key] || {} : profile?.[sec.key] || {}
    const visibleFields = sec.fields.filter(f => !f.conditional || f.conditional(data))
    if (sec.perPerson) {
      for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
        const d = profile?.[person]?.[sec.key] || {}
        for (const f of visibleFields) { total++; const val = d[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
      }
    } else {
      for (const f of visibleFields) { total++; const val = data[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
    }
  }
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

function countSectionCompletion(profile, section, hasPartner) {
  const data = section.perPerson ? profile?.ip1?.[section.key] || {} : profile?.[section.key] || {}
  const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(data))
  let filled = 0, total = 0
  if (section.perPerson) {
    for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
      const d = profile?.[person]?.[section.key] || {}
      for (const f of visibleFields) { total++; const val = d[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
    }
  } else {
    for (const f of visibleFields) { total++; const val = data[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
  }
  return { filled, total, complete: total > 0 && filled === total }
}

// ── Inline Field Components (always editable, like GC profile) ──

function TextField({ label, value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-9" />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </div>
  )
}

function YesNoField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange('yes')}
          className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${value === 'yes' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>Yes</button>
        <button type="button" onClick={() => onChange('no')}
          className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${value === 'no' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>No</button>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function CheckboxGroupField({ label, value, onChange, options }) {
  const selected = Array.isArray(value) ? value : []
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={selected.includes(opt)}
              onChange={e => onChange(e.target.checked ? [...selected, opt] : selected.filter(v => v !== opt))}
              className="rounded border-stone-300" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Progress Ring ──

function ProgressRing({ percent, size = 80 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#283693" strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="text-sm font-bold fill-stone-700">{percent}%</text>
    </svg>
  )
}

// ── Render fields for a section ──

function renderField(field, value, onChange) {
  if (field.type === 'text' || field.type === 'date') return <TextField label={field.label} value={value} onChange={onChange} type={field.type} />
  if (field.type === 'textarea') return <TextAreaField label={field.label} value={value} onChange={onChange} />
  if (field.type === 'yesno') return <YesNoField label={field.label} value={value} onChange={onChange} />
  if (field.type === 'select') return <SelectField label={field.label} value={value} onChange={onChange} options={field.options} />
  if (field.type === 'checkboxGroup') return <CheckboxGroupField label={field.label} value={value} onChange={onChange} options={field.options} />
  return null
}

// ── Main Component ──

export default function IPProfilePage() {
  const { currentUser } = useRole()
  const [caseData, setCaseData] = useState(null)
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPhotos, setPreviewPhotos] = useState([])
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    findCaseByEmail(currentUser.email).then(data => {
      if (data) {
        setCaseData(data)
        const existing = data.answers?._ipProfile || {}
        // Pre-fill from intake answers if profile sections are empty
        const a = data.answers || {}
        const boolToYN = (v) => v === true ? 'yes' : v === false ? 'no' : undefined
        if (!existing.fertility || Object.keys(existing.fertility).length === 0) {
          existing.fertility = {
            hasFrozenEmbryos: boolToYN(a.hasFrozenEmbryos),
            frozenEmbryoCount: a.frozenEmbryoDetails || '',
            usingEggDonor: boolToYN(a.usingEggDonor),
            usingSpermDonor: boolToYN(a.usingSpermDonor),
            hasOtherChildren: boolToYN(a.hasOtherChildren),
            otherChildrenDetails: a.otherChildrenDetails || '',
          }
        }
        if (!existing.surrogacy || Object.keys(existing.surrogacy).length === 0) {
          const clinicParts = [a.reDoctorName, a.hasRE === true ? 'RE' : ''].filter(Boolean)
          existing.surrogacy = {
            clinicName: clinicParts.length > 0 ? clinicParts.join(' — ') : '',
          }
        }
        const hp = a.hasPartner === 'yes' || a.hasPartner === true
        if (!existing.ip1?.personal || Object.keys(existing.ip1?.personal || {}).length === 0) {
          existing.ip1 = { ...existing.ip1, personal: { dob: a.primaryDob || '', ...(existing.ip1?.personal || {}) } }
        }
        if (hp && (!existing.ip2?.personal || Object.keys(existing.ip2?.personal || {}).length === 0)) {
          existing.ip2 = { ...existing.ip2, personal: { dob: a.ip2Dob || '', ...(existing.ip2?.personal || {}) } }
        }
        setProfile(existing)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.email])

  const hasPartner = caseData?.answers?.hasPartner === 'yes' || caseData?.answers?.hasPartner === true
  const ip1Name = caseData?.answers?.primaryFirstName || 'IP1'
  const ip2Name = caseData?.answers?.ip2FirstName || 'IP2'
  const completion = useMemo(() => countCompletion(profile, hasPartner), [profile, hasPartner])
  const isApproved = !!profile?._approved

  // Auto-save with debounce (2 seconds after last change)
  const scheduleAutoSave = useCallback((updatedProfile) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!caseData?.id) return
      try {
        await updateIntakeSubmission(caseData.id, { answers: { ...caseData.answers, _ipProfile: updatedProfile } })
      } catch {}
    }, 2000)
  }, [caseData])

  // Update a shared section field
  function updateField(sectionKey, fieldKey, value) {
    if (profile?._approved) return
    const updated = { ...profile, [sectionKey]: { ...profile[sectionKey], [fieldKey]: value } }
    setProfile(updated)
    scheduleAutoSave(updated)
  }

  // Update a per-person section field
  function updatePersonField(person, sectionKey, fieldKey, value) {
    if (profile?._approved) return
    const updated = { ...profile, [person]: { ...profile[person], [sectionKey]: { ...profile[person]?.[sectionKey], [fieldKey]: value } } }
    setProfile(updated)
    scheduleAutoSave(updated)
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function openPreview() {
    if (previewOpen) { setPreviewOpen(false); return }
    if (!caseData?.id) { setPreviewOpen(true); return }
    const base = `ip-${caseData.id}`
    try {
      const [portrait, cover, gallery] = await Promise.all([
        listProfilePhotos(`${base}/portrait`).catch(() => []),
        listProfilePhotos(`${base}/cover`).catch(() => []),
        listProfilePhotos(`${base}/gallery`).catch(() => []),
      ])
      // Apply user-defined gallery ordering if persisted
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-stone-400" /></div>
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="py-12 text-center text-stone-400 text-sm">No case data found. Please contact the agency.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress header — title inside card like GC profile */}
      <Card className="rounded-2xl">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <ProgressRing percent={completion} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="font-heading font-bold text-xl text-stone-800">My Profile</p>
              <p className="text-sm text-stone-500 mt-1">Complete your matching profile so surrogates can get to know you.</p>
              <div className="mt-3 max-w-sm mx-auto sm:mx-0">
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completion}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">{completion}% complete</p>
              </div>
            </div>
            <Button onClick={openPreview} variant="outline" className="gap-1.5 shrink-0 border-[#283693] text-[#283693]">
              <Eye className="size-4" /> {previewOpen ? 'Edit Profile' : 'Preview'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approved banner */}
      {isApproved && (
        <div className="flex items-center gap-3 p-5 rounded-xl bg-green-50 border-2 border-green-300 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-green-800">Profile Approved</p>
            <p className="text-sm text-green-600 mt-0.5">Your profile has been reviewed and approved by the ABC Surrogacy team. If you need to make changes, please contact the agency.</p>
          </div>
        </div>
      )}

      {previewOpen ? (
        <div className="max-w-[850px] mx-auto">
          <IPProfilePreview
            profile={profile}
            photos={previewPhotos}
            hasPartner={hasPartner}
            ip1Name={ip1Name}
            ip2Name={ip2Name}
            primaryName={caseData?.answers?.primaryFirstName || 'Intended Parent'}
            ip2FullName={caseData?.answers?.ip2FirstName || ''}
            location={[caseData?.answers?.city, expandState(caseData?.answers?.stateProv)].filter(Boolean).join(', ')}
          />
        </div>
      ) : (
      <>
      {/* Basic Information — Photos */}
      <Collapsible open={openSections['basic']} onOpenChange={() => toggleSection('basic')}>
        <Card className="rounded-2xl">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center gap-3 flex-1">
                <div className="size-10 rounded-xl flex items-center justify-center bg-[#283693]/10">
                  <Camera className="size-5 text-[#283693]" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base text-[#283693]">Basic Information</CardTitle>
                  <CardDescription>Profile photo and cover photo</CardDescription>
                </div>
              </div>
              <CardAction>
                <ChevronDown className={`size-5 text-stone-400 transition-transform ${openSections['basic'] ? 'rotate-180' : ''}`} />
              </CardAction>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <PhotoUpload
                  label="Profile Photo"
                  hint={hasPartner ? 'Upload a favorite picture of the two of you!' : 'Upload a favorite picture of just you!'}
                  userId={`ip-${caseData?.id}`}
                  subfolder="portrait"
                  onPhotoChange={(url) => {
                    const updated = { ...profile, profilePhotoUrl: url || '' }
                    setProfile(updated)
                    scheduleAutoSave(updated)
                  }}
                />
                <PhotoUpload
                  label="Cover Photo"
                  hint="Upload a favorite picture of you doing something you love!"
                  userId={`ip-${caseData?.id}`}
                  subfolder="cover"
                  onPhotoChange={(url) => {
                    const updated = { ...profile, coverPhotoUrl: url || '' }
                    setProfile(updated)
                    scheduleAutoSave(updated)
                  }}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Photo Gallery */}
      <Collapsible open={openSections['gallery']} onOpenChange={() => toggleSection('gallery')}>
        <Card className="rounded-2xl">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center gap-3 flex-1">
                <div className="size-10 rounded-xl flex items-center justify-center bg-[#283693]/10">
                  <Camera className="size-5 text-[#283693]" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base text-[#283693]">Photo Gallery</CardTitle>
                  <CardDescription>Upload favorite photos to share with surrogates</CardDescription>
                </div>
              </div>
              <CardAction>
                <ChevronDown className={`size-5 text-stone-400 transition-transform ${openSections['gallery'] ? 'rotate-180' : ''}`} />
              </CardAction>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <PhotoGallery
                storagePath={`ip-${caseData?.id}/gallery`}
                order={profile?._photoOrder}
                onOrderChange={(newOrder) => {
                  const updated = { ...profile, _photoOrder: newOrder }
                  setProfile(updated)
                  scheduleAutoSave(updated)
                }}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sections */}
      {SECTIONS.map(sec => {
        const Icon = sec.icon
        const { filled, total, complete } = countSectionCompletion(profile, sec, hasPartner)
        const isOpen = openSections[sec.key]

        return (
          <Collapsible key={sec.key} open={isOpen} onOpenChange={() => toggleSection(sec.key)}>
            <Card className={`rounded-2xl ${complete ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${complete ? 'bg-emerald-100' : 'bg-[#283693]/10'}`}>
                      <Icon className={`size-5 ${complete ? 'text-emerald-600' : 'text-[#283693]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-[#283693]">{sec.label}</CardTitle>
                      <CardDescription>{sec.description}</CardDescription>
                    </div>
                    <span className="text-sm text-stone-400 font-medium shrink-0">{filled}/{total}</span>
                    {complete ? <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> : <Circle className="size-5 text-stone-300 shrink-0" />}
                  </div>
                  <CardAction>
                    <ChevronDown className={`size-5 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </CardAction>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {sec.perPerson ? (
                    <PerPersonFields
                      section={sec}
                      profile={profile}
                      hasPartner={hasPartner}
                      ip1Name={ip1Name}
                      ip2Name={ip2Name}
                      onUpdate={updatePersonField}
                    />
                  ) : (
                    <SharedFields
                      section={sec}
                      data={profile[sec.key] || {}}
                      onUpdate={(fieldKey, value) => updateField(sec.key, fieldKey, value)}
                    />
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}
      </>
      )}

      {/* Contact */}
      <Card className="bg-stone-50 border-dashed rounded-2xl">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-stone-500">Need help? Contact us at</p>
          <a href="mailto:info@abcsurrogacy.com" className="text-sm font-semibold text-[#283693] hover:underline">info@abcsurrogacy.com</a>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Shared section fields (always editable) ──

function SharedFields({ section, data, onUpdate }) {
  const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(data))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map(f => (
          <div key={f.key} className={f.type === 'textarea' || f.type === 'checkboxGroup' ? 'md:col-span-2' : ''}>
            {renderField(f, data[f.key], val => onUpdate(f.key, val))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Per-person section fields (IP1 / IP2 tabs) ──

function PerPersonFields({ section, profile, hasPartner, ip1Name, ip2Name, onUpdate }) {
  const [activeTab, setActiveTab] = useState('ip1')

  const renderPerson = (person) => {
    const data = profile[person]?.[section.key] || {}
    const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(data))
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleFields.map(f => (
            <div key={f.key} className={f.type === 'textarea' || f.type === 'checkboxGroup' ? 'md:col-span-2' : ''}>
              {renderField(f, data[f.key], val => onUpdate(person, section.key, f.key, val))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!hasPartner) return renderPerson('ip1')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="ip1">{ip1Name}</TabsTrigger>
        <TabsTrigger value="ip2">{ip2Name}</TabsTrigger>
      </TabsList>
      <TabsContent value="ip1" className="mt-4">{renderPerson('ip1')}</TabsContent>
      <TabsContent value="ip2" className="mt-4">{renderPerson('ip2')}</TabsContent>
    </Tabs>
  )
}
