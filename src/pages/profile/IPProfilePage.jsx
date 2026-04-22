import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Baby, Stethoscope, User, Heart, HeartPulse, BookOpen, CheckCircle2, Circle, ChevronDown, Loader2, Upload, X, Camera, Eye, ShieldCheck, Trash2, ChevronLeft, ChevronRight, RotateCw, Crop as CropIcon, CalendarDays, MapPin, Send, AlertTriangle } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Cropper from 'react-easy-crop'
import { findCaseByEmail, updateIntakeSubmission, uploadProfilePhoto, deleteProfilePhoto, listProfilePhotos, createCaseTask } from '@/lib/db'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'

// ── Field definitions ──

const FERTILITY_FIELDS = [
  { key: 'reasonForSurrogacy', label: 'What led to your decision to pursue surrogacy?', type: 'textarea' },
  { key: 'fertilityProcedures', label: 'What fertility procedures have you tried?', type: 'textarea' },
  { key: 'hasFrozenEmbryos', label: 'Do you have frozen embryos?', type: 'yesno' },
  { key: 'frozenEmbryoCount', label: 'How many frozen embryos do you have?', type: 'text', conditional: d => d.hasFrozenEmbryos === 'yes' },
  { key: 'embryosGeneticallyTested', label: 'Have the embryos been genetically tested?', type: 'select', options: ['Yes', 'No', 'Not Yet'] },
  { key: 'usingEggDonor', label: 'Are you using an egg donor?', type: 'yesno' },
  { key: 'usingSpermDonor', label: 'Are you using a sperm donor?', type: 'yesno' },
  { key: 'embryoTransferCount', label: 'Would you like to transfer one embryo or two?', type: 'select', options: ['1', '2', 'Undecided'] },
  { key: 'anticipatedTransferDate', label: 'When do you anticipate having the embryo transfer?', type: 'text' },
  { key: 'hasOtherChildren', label: 'Do you have other children?', type: 'yesno' },
  { key: 'otherChildrenDetails', label: 'How many children do you have and what are their ages?', type: 'text', conditional: d => d.hasOtherChildren === 'yes' },
]

const SURROGACY_FIELDS = [
  { key: 'clinicName', label: 'What is the name and location of your fertility clinic and Reproductive Endocrinologist (RE)?', type: 'text' },
  { key: 'surrogatePreference', label: 'Do you prefer a surrogate who is single, married, or do you have no preference?', type: 'select', options: ['Single', 'Married/Partnered', 'No Preference'] },
  { key: 'locationPreference', label: 'Do you have a preference on where your surrogate resides?', type: 'yesno' },
  { key: 'locationPreferenceStates', label: 'Which state(s) would you prefer?', type: 'text', conditional: d => d.locationPreference === 'yes' },
  { key: 'firstTimeOrRepeat', label: 'Do you prefer a first-time or an experienced surrogate?', type: 'text', fullWidth: true },
  { key: 'attendAppointments', label: 'Would you like to attend milestone OB appointments with your surrogate?', type: 'yesno' },
  { key: 'attendAppointmentsDetails', label: 'Please explain', type: 'text' },
  { key: 'inDeliveryRoom', label: 'Would you like to be in the delivery room when your baby is born?', type: 'yesno' },
  { key: 'inDeliveryRoomDetails', label: 'Please explain', type: 'text' },
  { key: 'terminationForAbnormalities', label: 'If a serious abnormality were detected during pregnancy, would you consider termination? Please share your thoughts.', type: 'textarea' },
  { key: 'relationshipWithSurrogate', label: 'What kind of relationship would you like to have with your surrogate during the pregnancy?', type: 'textarea' },
  { key: 'tandemSurrogacy', label: 'Are you planning on pursuing tandem surrogacy (two surrogates carrying simultaneously)?', type: 'yesno' },
  { key: 'tandemSurrogacyDetails', label: 'Please explain', type: 'textarea', conditional: d => d.tandemSurrogacy === 'yes' },
]

const HEALTH_FIELDS = [
  { key: 'generalHealth', label: 'How would you describe your general health?', type: 'textarea' },
  { key: 'medicalConditions', label: 'Do you have any medical conditions we should be aware of?', type: 'yesno' },
  { key: 'medicalConditionsDetails', label: 'Please explain', type: 'textarea', conditional: d => d.medicalConditions === 'yes' },
  { key: 'hepatitisBC', label: 'Have you ever tested positive for Hepatitis B or C?', type: 'yesno' },
  { key: 'hepatitisBCDetails', label: 'Please explain', type: 'textarea', conditional: d => d.hepatitisBC === 'yes' },
  { key: 'hivAids', label: 'Have you ever tested positive for HIV/AIDS?', type: 'yesno' },
  { key: 'hivAidsDetails', label: 'Please explain', type: 'textarea', conditional: d => d.hivAids === 'yes' },
  { key: 'mentalHealthDiagnosis', label: 'Have you ever been diagnosed with a mental health condition?', type: 'yesno' },
  { key: 'mentalHealthDiagnosisDetails', label: 'Please provide details about your diagnosis', type: 'textarea', conditional: d => d.mentalHealthDiagnosis === 'yes' },
  { key: 'mentalHealthMedication', label: 'Have you ever taken medication for a mental health condition?', type: 'yesno' },
  { key: 'mentalHealthMedicationDetails', label: 'Please provide details about your medication', type: 'textarea', conditional: d => d.mentalHealthMedication === 'yes' },
  { key: 'mentalHealthHospitalization', label: 'Have you ever been hospitalized for a mental health condition?', type: 'yesno' },
  { key: 'mentalHealthHospitalizationDetails', label: 'Please provide details about your hospitalization', type: 'textarea', conditional: d => d.mentalHealthHospitalization === 'yes' },
]

const QUALITIES_OPTIONS = [
  'Compassionate','Organized','Optimistic','Calm','Resilient','Thoughtful','Honest',
  'Patient','Supportive','Independent','Warm','Reliable','Open-minded','Flexible',
  'Encouraging','Determined','Nurturing','Empathetic','Communicative','Loyal',
  'Easygoing','Confident','Hopeful','Grounded',
]

const HISTORY_FIELDS = [
  { key: 'favoriteMusic', label: 'Favorite music', type: 'text' },
  { key: 'favoriteMovie', label: 'Favorite movie', type: 'text' },
  { key: 'favoriteBook', label: 'Favorite book', type: 'text' },
  { key: 'favoriteFoods', label: 'Favorite foods', type: 'text' },
  { key: 'pets', label: 'Do you have any pets?', type: 'textarea' },
  { key: 'freeTime', label: 'What do you like to do in your free time?', type: 'textarea' },
  { key: 'personality', label: 'How would you describe yourself? Please include a description of your personality and temperament.', type: 'textarea' },
  { key: 'qualities', label: 'Choose 3 qualities that feel most like you today', type: 'qualitiesMax3', options: QUALITIES_OPTIONS },
  { key: 'messageToSurrogate', label: 'What else would you like to share with your prospective surrogate?', type: 'textarea' },
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
      <label className="text-sm font-bold text-[#283693]">{label}</label>
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
  // Admin-hidden fields/photos — filter them out of preview, PDF, and share paths.
  const hiddenFields = Array.isArray(profile?._hiddenFields) ? profile._hiddenFields : []
  const hiddenPhotos = Array.isArray(profile?._hiddenPhotos) ? profile._hiddenPhotos : []
  const visiblePhotos = Array.isArray(photos) ? photos.filter(p => !hiddenPhotos.includes(p.path)) : []

  // Photos can be tagged with kind, or fall back to path matching
  const profilePhoto = visiblePhotos.find(p => p.kind === 'portrait') || visiblePhotos.find(p => p.path?.includes('/portrait/') || p.path?.includes('/ip-portrait/'))
  const coverPhoto = visiblePhotos.find(p => p.kind === 'cover') || visiblePhotos.find(p => p.path?.includes('/cover/') || p.path?.includes('/ip-cover/'))
  const galleryPhotos = visiblePhotos.filter(p => p.kind === 'gallery' || (p.path?.includes('/gallery/') && !p.path?.includes('/portrait/') && !p.path?.includes('/cover/'))) || []
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

  // New magazine-style sub-components matching GC profile
  const NewPVField = ({ label, value }) => {
    if (!value && value !== 0) return null
    return (
      <div className="bg-white rounded-lg border border-stone-200 px-4 py-3 print:break-inside-avoid">
        <p className="text-[13px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">{label}</p>
        <p className="text-[15px] text-stone-800 leading-relaxed">{value}</p>
      </div>
    )
  }
  const NewPVYesNo = ({ label, value }) => {
    const display = value === 'yes' || value === 'Yes' ? 'Yes' : value === 'no' || value === 'No' ? 'No' : value || '—'
    const isYes = display === 'Yes'
    const isNo = display === 'No'
    const bg = isYes ? 'bg-emerald-50/60 border-emerald-200/70'
      : isNo ? 'bg-rose-50/60 border-rose-200/70'
      : 'bg-white border-stone-200'
    return (
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 print:break-inside-avoid ${bg}`}>
        <span className="text-[13px] text-stone-700 flex-1 leading-snug">{label}</span>
        <span className={`text-[12px] font-bold shrink-0 ${isYes ? 'text-emerald-600' : isNo ? 'text-rose-500' : 'text-stone-400'}`}>{display}</span>
      </div>
    )
  }
  const NewSection = ({ title, icon: Icon, number, children }) => (
    <div>
      <div className="flex items-baseline gap-4 mb-4 pb-3 border-b-2 border-[#ed148c]/20 print:break-after-avoid">
        {number && (
          <span className="text-4xl font-heading font-black text-[#ed148c]/60 leading-none tabular-nums">
            {String(number).padStart(2, '0')}
          </span>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-[#ed148c] shrink-0" />}
          <h3 className="text-xl font-heading font-black text-[#283693] tracking-tight leading-tight">{title}</h3>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )

  // Render a section of fields with proper Y/N styling. basePath is
  // the dot-path prefix used to look up hidden-field markers
  // (e.g. "fertility", "surrogacy", "ip1.personal", "ip2.health").
  const renderFields = (data, fieldDefs, basePath = '') => {
    return fieldDefs.map(f => {
      if (f.conditional && !f.conditional(data)) return null
      const path = basePath ? `${basePath}.${f.key}` : f.key
      if (hiddenFields.includes(path)) return null
      const val = data[f.key]
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) return null
      if (f.type === 'yesno') return <NewPVYesNo key={f.key} label={f.label} value={val} />
      const display = fmtFieldValue(f, data)
      return <NewPVField key={f.key} label={f.label} value={display} />
    })
  }

  // Title - "Hi there, We're {ip1} & {ip2}." or "Hi there, I'm {ip1}."
  const greetingTitle = hasPartner
    ? `We're ${primaryName} & ${ip2FullName}.`
    : `${primaryName}.`
  const greetingPrefix = hasPartner ? "Hi there, we're" : "Hi there, I'm"

  return (
    <>
    <div className="bg-[#fdf8f3] min-h-full print:bg-white">
      {/* Hero: cover + overlapping portrait + name card */}
      <div className="relative print:break-inside-avoid">
        <div data-pdf="cover" className="relative overflow-hidden">
          {coverPhoto ? (
            <img src={coverPhoto.url} alt="" className="w-full h-72 sm:h-80 object-cover" />
          ) : (
            <div className="w-full h-72 sm:h-80 bg-gradient-to-br from-[#ed148c]/20 via-[#fce7f0] to-[#283693]/10 flex items-center justify-center">
              <Camera className="w-12 h-12 text-white/70" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#fdf8f3] to-transparent" />
          {lightboxPhotos.length > 1 && (
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-[#283693] text-xs font-bold px-3 py-1 rounded-full print:hidden">
              {lightboxPhotos.length} photos
            </div>
          )}
        </div>

        {/* Overlapping portrait + name card */}
        <div className="relative -mt-20 sm:-mt-24 px-8 sm:px-12 print:px-10 print:-mt-16">
          <div className="flex flex-col sm:flex-row items-end gap-5">
            {profilePhoto ? (
              <img data-pdf="portrait" src={profilePhoto.url} alt=""
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl object-cover border-4 border-white shadow-xl shadow-[#283693]/15 shrink-0 print:shadow-none"
              />
            ) : (
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-white border-4 border-white shadow-xl flex items-center justify-center shrink-0">
                <Camera className="w-10 h-10 text-stone-300" />
              </div>
            )}

            <div className="flex-1 bg-white rounded-2xl shadow-lg shadow-[#283693]/10 border border-stone-100 px-6 py-5 print:shadow-none">
              <p className="text-xs font-bold text-[#ed148c] uppercase tracking-[0.25em] mb-1">{greetingPrefix}</p>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#283693] leading-tight tracking-tight">
                {greetingTitle}
              </h1>
              {location && (
                <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#ed148c]" />
                  {location}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats byline — ages */}
        <div className="px-8 sm:px-12 pt-6 pb-2 print:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[#283693]">
            {ip1Age && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black leading-none">{ip1Age}</span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{hasPartner ? ip1Name : 'yrs'}</span>
              </div>
            )}
            {ip2Age && (
              <><span className="h-6 w-px bg-stone-300" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black leading-none">{ip2Age}</span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{ip2Name}</span>
              </div></>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {lightboxPhotos.length > 1 && (
        <div data-pdf="thumbs" className="flex gap-2 px-8 sm:px-12 pt-4 pb-2 overflow-x-auto print:hidden">
          {lightboxPhotos.map((ph, i) => (
            <button key={ph.path} onClick={() => setLightboxIdx(i)}
              className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0 hover:scale-105 transition-all ring-1 ring-stone-200">
              <img src={ph.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="px-8 sm:px-12 py-6 space-y-6 print:px-10">
        <NewSection title="Fertility Information" icon={Baby} number={1}>
          {renderFields(fertility, FERTILITY_FIELDS, 'fertility')}
        </NewSection>

        <NewSection title="Surrogacy Information" icon={Heart} number={2}>
          {renderFields(surrogacy, SURROGACY_FIELDS, 'surrogacy')}
        </NewSection>

        {/* Per-person sections */}
        {(['health', 'history']).map((secKey, idx) => {
          const rawDefs = secKey === 'health' ? HEALTH_FIELDS : HISTORY_FIELDS
          // Exclude messageToSurrogate — it renders as a special letter card below
          const fieldDefs = rawDefs.filter(f => f.key !== 'messageToSurrogate')
          const sectionLabel = secKey === 'health' ? 'Health Information' : 'Personal History'
          const Icon = sectionIcons[secKey]
          const sectionNum = 3 + idx

          if (!hasPartner) {
            return (
              <NewSection key={secKey} title={sectionLabel} icon={Icon} number={sectionNum}>
                {renderFields(ip1[secKey] || {}, fieldDefs, `ip1.${secKey}`)}
              </NewSection>
            )
          }

          return (
            <NewSection key={secKey} title={sectionLabel} icon={Icon} number={sectionNum}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#ed148c] uppercase tracking-[0.2em] mb-1">{ip1Name}</p>
                  {renderFields(ip1[secKey] || {}, fieldDefs, `ip1.${secKey}`)}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#ed148c] uppercase tracking-[0.2em] mb-1">{ip2Name}</p>
                  {renderFields(ip2[secKey] || {}, fieldDefs, `ip2.${secKey}`)}
                </div>
              </div>
            </NewSection>
          )
        })}

        {/* ── Letter to Surrogate (Dear Surrogate) ── */}
        {(() => {
          const ip1Msg = ip1?.history?.messageToSurrogate
          const ip2Msg = hasPartner ? ip2?.history?.messageToSurrogate : null
          const messages = []
          if (ip1Msg) messages.push({ name: hasPartner ? ip1Name : primaryName, text: ip1Msg })
          if (ip2Msg) messages.push({ name: ip2Name, text: ip2Msg })
          if (messages.length === 0) return null
          return (
            <div className="mt-8 print:break-inside-avoid">
              <div className="bg-[#fce7f0] rounded-2xl overflow-hidden border border-[#ed148c]/20 shadow-sm print:shadow-none">
                <div className="px-7 pt-6 pb-4">
                  <p className="font-heading font-black text-2xl tracking-tight" style={{ color: '#c2185b' }}>Dear Surrogate,</p>
                </div>
                <div className="px-7 pb-7 space-y-5">
                  {messages.map((m, i) => (
                    <div key={i}>
                      <p className="text-[15px] text-stone-700 leading-[1.75] whitespace-pre-wrap font-serif italic">{m.text}</p>
                      <p className="text-right text-base font-heading font-bold mt-3" style={{ color: '#c2185b' }}>— {m.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
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

export const SECTIONS = [
  { key: 'fertility', label: 'Fertility Information', description: 'Embryos, donors, and fertility history', icon: Baby, fields: FERTILITY_FIELDS, perPerson: false },
  { key: 'surrogacy', label: 'Surrogacy Information', description: 'Preferences, expectations, and clinic details', icon: Heart, fields: SURROGACY_FIELDS, perPerson: false },
  { key: 'health', label: 'Health Information', description: 'Medical history and health conditions', icon: HeartPulse, fields: HEALTH_FIELDS, perPerson: true },
  { key: 'history', label: 'Personal History', description: 'Interests, favorites, and personality', icon: BookOpen, fields: HISTORY_FIELDS, perPerson: true },
]

// ── Completion helpers ──

// Conditional fields (e.g. "details" follow-ups that only appear when the parent
// question is answered Yes) are only counted when their parent condition is met.
// For per-person sections, visibility is evaluated against THAT person's own
// answers — IP1 saying "no" must not make the field disappear from IP2's count
// when IP2 said "yes", and vice versa.
function fillStats(fields, data) {
  let filled = 0, total = 0
  for (const f of fields) {
    if (f.conditional && !f.conditional(data)) continue
    total++
    const val = data[f.key]
    if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++
  }
  return { filled, total }
}

export function countCompletion(profile, hasPartner) {
  let filled = 0, total = 0
  for (const sec of SECTIONS) {
    if (sec.perPerson) {
      for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
        const s = fillStats(sec.fields, profile?.[person]?.[sec.key] || {})
        filled += s.filled; total += s.total
      }
    } else {
      const s = fillStats(sec.fields, profile?.[sec.key] || {})
      filled += s.filled; total += s.total
    }
  }
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

function countSectionCompletion(profile, section, hasPartner) {
  let filled = 0, total = 0
  if (section.perPerson) {
    for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
      const s = fillStats(section.fields, profile?.[person]?.[section.key] || {})
      filled += s.filled; total += s.total
    }
  } else {
    const s = fillStats(section.fields, profile?.[section.key] || {})
    filled += s.filled; total += s.total
  }
  return { filled, total, complete: total > 0 && filled === total }
}

// ── Inline Field Components (always editable, like GC profile) ──

function TextField({ label, value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-[#283693]">{label}</label>
      <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-9" />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-[#283693]">{label}</label>
      <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </div>
  )
}

function YesNoField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-[#283693]">{label}</label>
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
      <label className="text-sm font-bold text-[#283693]">{label}</label>
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
      <label className="text-sm font-bold text-[#283693]">{label}</label>
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
      <label className="text-sm font-bold text-[#283693]">{label}</label>
      <p className="text-xs text-stone-500">Pick up to {max} — {selected.length}/{max} selected</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isOn = selected.includes(opt)
          const disabled = !isOn && atMax
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)} disabled={disabled}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors border ${
                isOn
                  ? 'bg-[#283693] text-white border-[#283693]'
                  : disabled
                    ? 'bg-stone-50 text-stone-300 border-stone-200 cursor-not-allowed'
                    : 'bg-white text-stone-600 border-stone-300 hover:border-[#283693] hover:text-[#283693]'
              }`}>
              {opt}
            </button>
          )
        })}
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
  if (field.type === 'qualitiesMax3') return <QualitiesMaxField label={field.label} value={value} onChange={onChange} options={field.options} max={3} />
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
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    findCaseByEmail(currentUser.email).then(data => {
      if (data) {
        setCaseData(data)
        const existing = data.answers?._ipProfile || {}
        // Pre-fill from intake answers — done per-field (not per-section) so
        // the IP doesn't lose intake answers if they edit one field in a
        // section. Only fills empty fields; never overwrites existing data.
        const a = data.answers || {}
        const boolToYN = (v) => v === true ? 'yes' : v === false ? 'no' : undefined
        const fillIfEmpty = (obj, key, val) => {
          if (val === undefined || val === null || val === '') return
          if (obj[key] === undefined || obj[key] === null || obj[key] === '') obj[key] = val
        }
        existing.fertility = existing.fertility || {}
        fillIfEmpty(existing.fertility, 'hasFrozenEmbryos', boolToYN(a.hasFrozenEmbryos))
        fillIfEmpty(existing.fertility, 'frozenEmbryoCount', a.frozenEmbryoCount || a.frozenEmbryoDetails)
        fillIfEmpty(existing.fertility, 'usingEggDonor', boolToYN(a.usingEggDonor))
        fillIfEmpty(existing.fertility, 'usingSpermDonor', boolToYN(a.usingSpermDonor))
        fillIfEmpty(existing.fertility, 'hasOtherChildren', boolToYN(a.hasOtherChildren))
        fillIfEmpty(existing.fertility, 'otherChildrenDetails', a.otherChildrenDetails)
        existing.surrogacy = existing.surrogacy || {}
        fillIfEmpty(existing.surrogacy, 'clinicName', a.clinicName)
        fillIfEmpty(existing.surrogacy, 'reDoctorName', a.reDoctorName)
        const hp = a.hasPartner === 'yes' || a.hasPartner === true
        existing.ip1 = existing.ip1 || {}
        existing.ip1.personal = existing.ip1.personal || {}
        fillIfEmpty(existing.ip1.personal, 'dob', a.primaryDob)
        if (hp) {
          existing.ip2 = existing.ip2 || {}
          existing.ip2.personal = existing.ip2.personal || {}
          fillIfEmpty(existing.ip2.personal, 'dob', a.ip2Dob)
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
  // Lock state: profile submitted and not released back by admin
  const profileSubmitted = !!caseData?.answers?._profileSubmitted
  const profileReleasedAt = caseData?.answers?._profileReleasedAt
  // Once released, profileSubmitted stays true but isLocked goes false so the IP can edit
  const isLocked = (profileSubmitted && !profileReleasedAt) || isApproved

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
    if (isLocked) return
    const updated = { ...profile, [sectionKey]: { ...profile[sectionKey], [fieldKey]: value } }
    setProfile(updated)
    scheduleAutoSave(updated)
  }

  // Update a per-person section field
  function updatePersonField(person, sectionKey, fieldKey, value) {
    if (isLocked) return
    const updated = { ...profile, [person]: { ...profile[person], [sectionKey]: { ...profile[person]?.[sectionKey], [fieldKey]: value } } }
    setProfile(updated)
    scheduleAutoSave(updated)
  }

  // Submit profile for review
  async function handleSubmitForReview() {
    if (!caseData?.id) return
    setSubmitting(true)
    try {
      const a = caseData.answers || {}
      const primaryName = `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()
      const ip2Name = hasPartner ? `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() : ''
      const ipName = ip2Name ? `${primaryName} & ${ip2Name}` : primaryName || 'Intended Parent'

      // 1. Flush any pending profile edits + mark as submitted on the same row
      const now = new Date().toISOString()
      const updatedAnswers = {
        ...a,
        _ipProfile: profile,
        _profileSubmitted: true,
        _profileSubmittedAt: now,
        _profileSubmittedBy: currentUser?.name || currentUser?.email || '',
        // If a previously-released profile is being re-submitted, clear the release flag.
        _profileReleasedAt: null,
        _profileReleasedBy: null,
      }
      try {
        await updateIntakeSubmission(caseData.id, { answers: updatedAnswers })
        setCaseData({ ...caseData, answers: updatedAnswers })
      } catch (err) {
        console.error('IP profile submit save failed:', err)
        alert("We couldn't save your profile. Please check your internet connection and try again.")
        return
      }

      // 2. Notify Julie/Nicole/intake
      try {
        await fetch('/api/notify-ip-profile-submitted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ipName, ipEmail: currentUser?.email, caseId: caseData.id }),
        })
      } catch (err) { console.error('IP profile notify email failed:', err) }

      // 3. Task for the assigned admin (IP cases fall back to Julie —
      // intake coordinator handles surrogates only).
      try {
        const today = new Date().toISOString().split('T')[0]
        const assignedTo = caseData.assigned_to || 'julie@abcsurrogacy.com'
        await createCaseTask({
          case_id: caseData.id,
          case_type: 'ip',
          title: `Review ${ipName}'s Profile`,
          assigned_to: assignedTo,
          due_date: today,
          priority: 'high',
          status: 'open',
        })
      } catch (err) { console.error('IP profile task creation failed:', err) }

      setShowSubmitModal(false)
    } finally {
      setSubmitting(false)
    }
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

      {/* Submitted banner */}
      {profileSubmitted && !profileReleasedAt && !isApproved && (
        <div className="flex items-center gap-3 p-5 rounded-xl bg-blue-50 border-2 border-blue-200 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-blue-800">Profile Submitted for Review</p>
            <p className="text-sm text-blue-600 mt-0.5">Your profile has been submitted. Our team will review and reach out with any additional questions. If you need to make edits, please contact <a href="mailto:info@abcsurrogacy.com" className="font-semibold underline">info@abcsurrogacy.com</a>.</p>
          </div>
        </div>
      )}

      {/* Reopened banner — admin released profile back to IP */}
      {profileSubmitted && profileReleasedAt && !isApproved && (
        <div className="flex items-center gap-3 p-5 rounded-xl bg-amber-50 border-2 border-amber-200 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-amber-800">Profile reopened for edits</p>
            <p className="text-sm text-amber-700 mt-0.5">Our team has reopened your profile. Please make your updates and re-submit when you're ready.</p>
          </div>
        </div>
      )}

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
      <div className={isLocked ? 'opacity-50 pointer-events-none space-y-6' : 'space-y-6'}>
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
      </div>
      )}

      {/* Submit Profile for Review button */}
      {!previewOpen && !isApproved && !profileSubmitted && (
        <div className="text-center pt-4">
          <Button
            onClick={() => completion < 100 ? setShowIncompleteWarning(true) : setShowSubmitModal(true)}
            disabled={submitting}
            className="gap-2 px-8 py-3 text-base rounded-xl"
            style={{ backgroundColor: '#ed148c', color: '#fff' }}
          >
            <Send className="w-4 h-4" /> Submit Profile for Review
          </Button>
          <p className="text-xs text-stone-400 mt-2">You won't be able to edit after submitting, but our team can reopen it for you if needed.</p>
        </div>
      )}

      {/* Re-submit button when profile was reopened */}
      {!previewOpen && !isApproved && profileSubmitted && profileReleasedAt && (
        <div className="text-center pt-4">
          <Button
            onClick={() => completion < 100 ? setShowIncompleteWarning(true) : setShowSubmitModal(true)}
            disabled={submitting}
            className="gap-2 px-8 py-3 text-base rounded-xl"
            style={{ backgroundColor: '#ed148c', color: '#fff' }}
          >
            <Send className="w-4 h-4" /> Re-Submit Profile for Review
          </Button>
        </div>
      )}

      {/* Submit confirmation modal */}
      <Dialog open={showSubmitModal} onOpenChange={(v) => !submitting && setShowSubmitModal(v)}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-[#283693]">Ready to submit your profile?</h2>
            <div className="text-stone-600 text-sm space-y-2">
              <p>Once submitted, <strong>you won't be able to edit your profile</strong> until our team reviews it. If you need to make a correction after submitting, please contact us and we'll reopen it for you.</p>
              <p>Our team will review your profile and reach out with any additional questions and next steps.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowSubmitModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitForReview}
                disabled={submitting}
                style={{ backgroundColor: '#ed148c', color: '#fff' }}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit for Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incomplete warning modal */}
      <Dialog open={showIncompleteWarning} onOpenChange={setShowIncompleteWarning}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-stone-800">Profile Not Complete</h2>
            <p className="text-stone-600">Your profile is <strong>{completion}%</strong> complete. Please finish the sections below before submitting.</p>
            <div className="space-y-1.5 text-left max-h-40 overflow-y-auto">
              {SECTIONS.map(sec => {
                const { complete, filled, total } = countSectionCompletion(profile, sec, hasPartner)
                if (total === 0 || complete) return null
                return (
                  <div key={sec.key} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-red-50">
                    <span className="text-stone-700">{sec.label}</span>
                    <span className="text-red-500 font-medium">{filled}/{total}</span>
                  </div>
                )
              })}
            </div>
            <Button onClick={() => setShowIncompleteWarning(false)} className="w-full" style={{ backgroundColor: '#283693', color: '#fff' }}>
              Got it — I'll complete my profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          <div key={f.key} className={f.type === 'textarea' || f.type === 'checkboxGroup' || f.fullWidth ? 'md:col-span-2' : ''}>
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
            <div key={f.key} className={f.type === 'textarea' || f.type === 'checkboxGroup' || f.fullWidth ? 'md:col-span-2' : ''}>
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
