import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  FileText, Download, Eye, Printer, Scale, Stethoscope, DollarSign,
  User, Users, Heart, Shield, Briefcase, Clock, Pencil, Mail, Phone, Hospital,
  Save, Send, CalendarDays, Ruler, Activity, Baby,
} from 'lucide-react'
import { mockUsers, getAdminStaff } from '@/data/mock/users'
import { useDrafts } from '@/context/DraftContext'
import { formatDate } from '@/lib/utils'
import { useRole } from '@/context/RoleContext'

// Custom embryo/IVF icon based on the embryo creation concept
function EmbryoIcon({ size = 14, color = '#000' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="12" r="8.5" />
      <ellipse cx="9.5" cy="13" rx="3.5" ry="4.5" transform="rotate(-20 9.5 13)" />
      <circle cx="8.5" cy="14.5" r="1.2" fill={color} stroke="none" />
      <line x1="19.5" y1="8" x2="14" y2="10.5" />
      <line x1="19.5" y1="8" x2="21.5" y2="7" />
      <line x1="19.5" y1="8" x2="20.5" y2="6" />
    </svg>
  )
}
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { fetchSurrogateProfileByEmail } from '@/lib/db'
import { supabase } from '@/lib/supabase'

const SHEET_TYPES = [
  { id: 'clinic', label: 'Clinic Match Sheet', icon: Stethoscope, color: '#9b2ea7', description: 'For RE / IVF clinic — surrogate snapshot, pregnancy history, and IVF logistics.' },
  { id: 'escrow', label: 'Escrow Match Sheet', icon: DollarSign, color: '#10b981', description: 'For escrow company — compensation, payment terms, escrow funding, and employment details.' },
  { id: 'attorney', label: 'Attorney Match Sheet', icon: Scale, color: '#1A3638', description: 'For legal counsel — IP & GC contact info, demographics, embryo creation, attorney details, and journey terms.' },
]

function parseDate(dateStr) {
  if (!dateStr) return null
  // Handle MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdyMatch) return new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2,'0')}-${mdyMatch[2].padStart(2,'0')}T00:00:00`)
  // Handle YYYY-MM-DD (ISO)
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
}

// formatDate is now imported from @/lib/utils

function formatPhone(phone) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  if (digits.length === 11) return `+${digits[0]} (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  return phone
}

function calcAge(dob) {
  if (!dob) return null
  const birth = parseDate(dob)
  if (!birth || isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function fmtCurrency(val) {
  if (!val) return '—'
  const str = String(val)
  return str.startsWith('$') ? str : `$${str}`
}

function yesNo(val) {
  if (val === true || val === 'yes' || val === 'Yes') return 'Yes'
  if (val === false || val === 'no' || val === 'No') return 'No'
  return '—'
}

// ── Editable Field (inline in preview, plain text in PDF) ──

function EditableValue({ value, field, msData, onChange, placeholder, displayPrefix }) {
  const [editing, setEditing] = useState(false)
  const val = msData?.[field] ?? value ?? ''
  const display = val || null
  // Apply prefix only at display time (e.g. "Dr. ") and only when the stored
  // value doesn't already include it. Edit mode shows the raw value.
  const prefixed = display && displayPrefix && !/^dr\.?\s/i.test(String(display))
    ? `${displayPrefix}${display}`
    : display

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => onChange(field, e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(false); if (e.key === 'Escape') setEditing(false) }}
        style={{ fontSize: 13, fontWeight: 500, color: '#1c1917', border: 'none', borderBottom: '2px solid #1A3638', outline: 'none', padding: '0 0 1px 0', width: '100%', backgroundColor: 'transparent', fontFamily: 'inherit' }}
        placeholder={placeholder || 'Click to enter...'}
        className="no-print-border"
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: display ? '#1c1917' : '#a8a29e', borderBottom: display ? 'none' : '1px dashed #d6d3d1', paddingBottom: display ? 0 : 1, fontStyle: display ? 'normal' : 'italic' }}
      title="Click to edit"
    >
      {prefixed || (placeholder || 'Click to enter...')}
    </span>
  )
}

// ── Editable Yes/No Select ──

function EditableSelect({ value, field, msData, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const dropRef = useRef(null)
  const val = msData?.[field] ?? value ?? ''
  const display = val || null
  const opts = options || ['Yes', 'No']

  function openDropdown() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setCoords({ left: r.left, top: r.bottom + 2, minWidth: Math.max(180, r.width) })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (dropRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
      <span
        ref={triggerRef}
        onClick={openDropdown}
        style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: display ? '#1c1917' : '#a8a29e', borderBottom: display ? 'none' : '1px dashed #d6d3d1', paddingBottom: display ? 0 : 1, fontStyle: display ? 'normal' : 'italic' }}
        title="Click to select"
      >
        {display || (placeholder || 'Select...')}
      </span>
      {open && coords && createPortal(
        <div ref={dropRef} style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999, background: 'white', border: '1px solid #e7e5e4', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: coords.minWidth, overflow: 'hidden' }}>
          {opts.map(o => (
            <div key={o} onClick={() => { onChange(field, o); setOpen(false) }}
              style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: val === o ? 600 : 400, color: val === o ? '#D4A853' : '#1c1917', backgroundColor: val === o ? '#D4A85310' : 'white' }}
              onMouseEnter={e => { if (val !== o) e.target.style.backgroundColor = '#fdf2f8' }}
              onMouseLeave={e => { e.target.style.backgroundColor = val === o ? '#D4A85310' : 'white' }}
            >{val === o ? '✓ ' : ''}{o}</div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Section Components for the PDF render ──

function SheetHeader({ title, journey, color }) {
  // Find case manager from assigned_to email
  const cmEmail = journey.assigned_to
  const caseManager = mockUsers.find(u => u.email === cmEmail) || { name: 'North Star Surrogacy', email: 'info@northstarsurrogacy.com', phone: '(818) 321-9329' }

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Top row: logo left, title center, case manager right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        {/* Logo — left */}
        <img src="/north-star-logo.png" alt="North Star Surrogacy" style={{ height: 56, flexShrink: 0 }} crossOrigin="anonymous" />
        {/* Title — center */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3638', margin: 0, letterSpacing: '0.3px', textAlign: 'center', flex: 1 }}>{title}</h1>
        {/* Case Manager — right */}
        <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 11, lineHeight: 1.7 }}>
          <div><span style={{ color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>Case Manager: </span><span style={{ color: '#44403c', fontWeight: 600 }}>{caseManager.name}</span></div>
          <div><span style={{ color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>Email: </span><span style={{ color: '#44403c' }}>{caseManager.email}</span></div>
          {caseManager.phone && <div><span style={{ color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>Phone: </span><span style={{ color: '#44403c' }}>{caseManager.phone}</span></div>}
        </div>
      </div>
      {/* Divider */}
      <div style={{ height: 1.5, background: '#1A3638', borderRadius: 1 }} />
    </div>
  )
}

// Party banner — big colored divider for IP vs Surrogate sections
function PartyBanner({ children, color, icon: Icon }) {
  return (
    <div style={{ marginTop: 32, marginBottom: 16, padding: '12px 20px', borderRadius: 12, background: `linear-gradient(135deg, ${color}10, ${color}08)`, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>}
        <h2 style={{ fontSize: 15, fontWeight: 700, color, margin: 0, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{children}</h2>
      </div>
    </div>
  )
}

function SectionTitle({ children, color, icon: Icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 20, marginBottom: 8 }}>
      {Icon && <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={12} color={color} />
      </div>}
      <h2 style={{ fontSize: 11, fontWeight: 600, color, margin: 0, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{children}</h2>
    </div>
  )
}

function InfoGrid({ items, columns = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1px', backgroundColor: '#e7e5e4', borderRadius: 10, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
      {items.filter(Boolean).map((item, i) => (
        <div key={i} style={{ backgroundColor: 'white', padding: '7px 14px', ...(item.span ? { gridColumn: `span ${item.span}` } : {}) }}>
          <div style={{ fontSize: 9, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 1 }}>{item.label}</div>
          {item.editable ? item.value : (
            <div style={{ fontSize: 13, color: '#1c1917', fontWeight: 500 }}>{item.value || '—'}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function PartyLabel({ children, color }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: color || '#a8a29e', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: 16, marginBottom: 4 }}>{children}</p>
  )
}

function PartyName({ name }) {
  return (
    <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', marginTop: 0, marginBottom: 8 }}>{name || '—'}</p>
  )
}

// Surrogate hero stat tiles — Age (with DOB), Height, Weight, BMI, Status.
// Five horizontal cards with a leading lucide icon + bold value + small label.
// Inline styles only — has to render through html2canvas for the PDF export.
function StatTile({ Icon, value, label, sub }) {
  return (
    <div style={{
      flex: 1,
      borderRadius: 12,
      border: '1px solid #e7e5e4',
      background: 'white',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    }}>
      {Icon ? <Icon size={16} color="#a8a29e" strokeWidth={2} /> : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        <div style={{ fontSize: 9, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>
          {label}{sub ? <span style={{ marginLeft: 4, color: '#78716c', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>{sub}</span> : null}
        </div>
      </div>
    </div>
  )
}

function SurrogateStatTiles({ gcDob, heightFt, heightIn, weight, bmi, maritalStatus }) {
  const age = calcAge(gcDob)
  const heightStr = heightFt ? `${heightFt}'${heightIn || 0}"` : '—'
  const weightStr = weight ? `${weight} lbs` : '—'
  const bmiStr = bmi || '—'
  // Heart for partnered/married statuses, User for single (or unknown).
  const partnered = /married|partnered|domestic|relationship|engaged/i.test(String(maritalStatus || ''))
  const StatusIcon = partnered ? Heart : User
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 12 }}>
      <StatTile Icon={CalendarDays} value={age != null ? String(age) : '—'} label="Age" sub={gcDob ? formatDate(gcDob) : ''} />
      <StatTile Icon={Ruler}        value={heightStr} label="Height" />
      <StatTile Icon={Scale}        value={weightStr} label="Weight" />
      <StatTile Icon={Activity}     value={bmiStr}    label="BMI" />
      <StatTile Icon={StatusIcon}   value={maritalStatus || '—'} label="Status" />
    </div>
  )
}

// Pregnancy history one-liner: GTPAL code (G6P4024 etc.) plus colored
// counter dots for Pregnancies / Term / Preterm / Losses / Living. Mirrors
// the visual on /surrogates list cards but rendered inline for the sheet.
function GtpalDot({ count, color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18, height: 18,
        borderRadius: '50%',
        background: color, color: 'white',
        fontSize: 10, fontWeight: 700,
        lineHeight: 1,
      }}>{count}</span>
      <span style={{ fontSize: 11, color: '#44403c', fontWeight: 500 }}>{label}</span>
    </span>
  )
}

function PregnancyHistorySummary({ pregnancies = [], numPreg }) {
  if (!pregnancies.length && !numPreg) return null
  const g = parseInt(numPreg) || pregnancies.length
  let term = 0, preterm = 0, abortions = 0, living = 0
  for (const p of pregnancies) {
    if (p.outcome === 'Live Birth') {
      const weeks = parseInt(p.gestationWeeks) || 40
      if (weeks >= 37) term++
      else preterm++
      living++
    } else {
      abortions++
    }
  }
  const code = `G${g}P${term}${preterm}${abortions}${living}`
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '10px 14px',
      borderRadius: 10,
      background: 'linear-gradient(90deg, #fdf2f8, #f0f1fa)',
      border: '1px solid #f5d0e6',
      marginBottom: 14,
      flexWrap: 'wrap',
    }}>
      <Baby size={14} color="#D4A853" strokeWidth={2} />
      <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 14, fontWeight: 700, color: '#1A3638', letterSpacing: '0.4px' }}>{code}</span>
      <GtpalDot count={g}        color="#1A3638" label="Pregnancies" />
      <GtpalDot count={term}     color="#10b981" label="Term" />
      <GtpalDot count={preterm}  color="#f59e0b" label="Preterm" />
      <GtpalDot count={abortions} color="#ef4444" label="Losses" />
      <GtpalDot count={living}   color="#8b5cf6" label="Living" />
    </div>
  )
}

function ConfidentialFooter() {
  return (
    <div style={{ marginTop: 32, paddingTop: 14, borderTop: '1.5px solid #1A3638', textAlign: 'center' }}>
      <img src="/north-star-logo.png" alt="northstarsurrogacy.com" style={{ height: 22, margin: '0 auto 6px' }} crossOrigin="anonymous" />
      <p style={{ fontSize: 9, color: '#78716c', margin: '0 0 2px' }}>
        5627 Kanan Road #229, Agoura Hills, CA 91301 &nbsp;·&nbsp; O: (323) 207-5762 &nbsp;·&nbsp; F: (323) 843-9433
      </p>
      <p style={{ fontSize: 7, color: '#a8a29e', margin: 0 }}>
        This document contains privileged and confidential information intended solely for the named recipient(s).
      </p>
    </div>
  )
}

// ── Attorney Match Sheet ──

function AttorneySheet({ journey, gcCase, ipCase, profileData, sheetRef, msData, onChange }) {
  const a = ipCase?.answers || {}
  const ipContact = a._ipContact || {}
  const ga = gcCase?.answers || {}
  const gcApp = ga._application || {}
  const jd = journey.journey_data || {}
  const pd = profileData || {}
  const personal = pd.personal || {}
  const employment = pd.employment || {}
  const hopes = pd.hopesWishes || {}
  const pregnancyHistory = pd.pregnancyHistory || {}
  const color = '#1A3638'

  const pregnancies = pregnancyHistory.pregnancies || []
  const numPreg = parseInt(pregnancyHistory.numberOfPregnancies) || pregnancies.length
  const previousSurrogate = pregnancies.some((p) => {
    const value = p?.wasSurrogacy
    return value === true || String(value || '').toLowerCase() === 'yes'
  })

  const gcDob = gcApp.dob || gcCase?.dob || ga.dob || personal.dob
  const ipHasPartner = a.hasPartner === true || a.hasPartner === 'yes'
  const gcHasPartner = gcApp.hasSpouse === 'yes' || gcApp.hasSpouse === true
  const gcPartnerName = [gcApp.spouseFirstName, gcApp.spouseLastName].filter(Boolean).join(' ').trim()
  const gcPartnerDob = gcApp.spouseDob || ''
  const gcPartnerEmail = gcApp.spouseEmail || ''
  const gcPartnerPhone = gcApp.spousePhone || ''
  const reClinicLocation = [jd.ivfCity, jd.ivfState].filter(Boolean).join(', ')
  const deliveryHospitalLocation = [jd.deliveryHospitalCity, jd.deliveryHospitalState].filter(Boolean).join(', ')
  const lostWagesDisplay = employment.currentlyEmployed === 'yes' || employment.currentlyEmployed === true ? 'Yes' : 'Not Employed'
  const gcEmploymentDisplay = employment.currentlyEmployed === 'yes' || employment.currentlyEmployed === true ? 'Yes' : 'No'
  const partnerEmploymentDisplay = gcHasPartner
    ? ((employment.partnerEmployed === 'yes' || employment.partnerEmployed === true) ? 'Yes' : 'No')
    : null

  return (
    <div ref={sheetRef} style={{ width: 816, padding: '48px 56px', backgroundColor: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1c1917', lineHeight: 1.5 }}>
      <SheetHeader title="Attorney Match Sheet" journey={journey} color={color} />

      {/* Intended Parents */}
      <PartyBanner color={color} icon={Users}>Intended Parents</PartyBanner>

      <PartyLabel color={color}>Intended Parent #1</PartyLabel>
      <InfoGrid items={[
        { label: 'Full Name', value: `${ipContact.ip1FirstName || a.primaryFirstName || ''} ${ipContact.ip1LastName || a.primaryLastName || ''}`.trim() },
        { label: 'Date of Birth', value: `${formatDate(ipContact.ip1Dob || a.primaryDob)}${(ipContact.ip1Dob || a.primaryDob) ? ` (Age ${calcAge(ipContact.ip1Dob || a.primaryDob)})` : ''}` },
        { label: 'Email', value: ipContact.ip1Email || ipCase?.email },
        { label: 'Phone', value: formatPhone(ipContact.ip1Phone || ipCase?.phone) },
      ]} />

      {ipHasPartner && (
        <>
          <PartyLabel color={color}>Intended Parent #2</PartyLabel>
          <InfoGrid items={[
            { label: 'Full Name', value: `${ipContact.ip2FirstName || a.ip2FirstName || ''} ${ipContact.ip2LastName || a.ip2LastName || ''}`.trim() },
            { label: 'Date of Birth', value: `${formatDate(ipContact.ip2Dob || a.ip2Dob)}${(ipContact.ip2Dob || a.ip2Dob) ? ` (Age ${calcAge(ipContact.ip2Dob || a.ip2Dob)})` : ''}` },
            { label: 'Email', value: ipContact.ip2Email || ipCase?.ip2Email },
            { label: 'Phone', value: formatPhone(ipContact.ip2Phone || ipCase?.ip2Phone) },
          ]} />
        </>
      )}

      <SectionTitle color={color} icon={FileText}>Demographics</SectionTitle>
      <InfoGrid items={[
        { label: 'Street Address', value: [ipContact.street || a.street, a.street2].filter(Boolean).join(', '), span: 2 },
        { label: 'City', value: ipContact.city || a.city },
        { label: 'State', value: ipContact.state || a.stateProv },
        { label: 'Zip Code', value: ipContact.zipCode || a.zipCode },
        { label: 'Country', value: ipContact.country || a.country || 'United States' },
      ]} />

      <SectionTitle color={color} icon={EmbryoIcon}>Embryo Creation</SectionTitle>
      <InfoGrid items={[
        { label: 'Sperm Contribution', editable: true, value: <EditableSelect field="spermContribution" msData={msData} onChange={onChange} options={["IF's Sperm", "Anonymous Donor Sperm", "Known Sperm Donor", "Embryo Adoption"]} placeholder="Select..." value={ipCase?.usingSpermDonor ? 'Anonymous Donor Sperm' : "IF's Sperm"} /> },
        { label: 'Egg Source', editable: true, value: <EditableSelect field="eggSource" msData={msData} onChange={onChange} options={["IM's Eggs", "Anonymous Egg Donor", "Known Egg Donor", "Embryo Adoption"]} placeholder="Select..." value={ipCase?.usingEggDonor ? 'Anonymous Egg Donor' : "IM's Eggs"} /> },
      ]} />

      <SectionTitle color={color} icon={Scale}>Intended Parents' Attorney</SectionTitle>
      <InfoGrid items={[
        { label: 'Attorney Name', editable: true, value: <EditableValue field="ipAttorneyName" msData={msData} onChange={onChange} placeholder="Enter attorney name..." value={jd.ipAttorneyName} /> },
        { label: 'Attorney Email', editable: true, value: <EditableValue field="ipAttorneyEmail" msData={msData} onChange={onChange} placeholder="Enter attorney email..." value={jd.ipAttorneyEmail} /> },
      ]} />

      {/* Surrogate — page 2 */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 1, margin: 0 }} className="pdf-page-break" />
      <PartyBanner color="#D4A853" icon={User}>Surrogate</PartyBanner>

      <SectionTitle color="#D4A853" icon={FileText}>Demographics</SectionTitle>
      <InfoGrid items={[
        { label: 'Full Name', value: gcApp.fullLegalName || gcCase?.name },
        { label: 'Date of Birth', value: `${formatDate(gcDob)}${gcDob ? ` (Age ${calcAge(gcDob)})` : ''}` },
        { label: 'Email', value: gcCase?.email },
        { label: 'Phone', value: formatPhone(gcCase?.phone) },
        { label: 'Street Address', value: gcApp.street || personal.streetAddress || ga.streetAddress, span: 2 },
        { label: 'City', value: gcApp.city || ga.city || personal.city },
        { label: 'State', value: gcApp.state || ga.state || personal.state },
        { label: 'Zip Code', value: gcApp.zipCode || personal.zipCode || ga.zipCode },
        { label: 'Country', value: 'United States' },
        { label: 'Relationship Status', value: ga.maritalStatus || personal.maritalStatus || '—' },
        { label: 'US Citizen', value: yesNo(ga.usCitizen || personal.usCitizen) },
      ]} />

      {gcHasPartner && (
        <>
          <SectionTitle color="#D4A853" icon={Users}>Spouse / Partner</SectionTitle>
          <InfoGrid items={[
            { label: 'Full Name', value: gcPartnerName || '—' },
            { label: 'Date of Birth', value: `${formatDate(gcPartnerDob)}${gcPartnerDob && calcAge(gcPartnerDob) !== null ? ` (Age ${calcAge(gcPartnerDob)})` : ''}` },
            { label: 'Email', value: gcPartnerEmail || '—' },
            { label: 'Phone', value: formatPhone(gcPartnerPhone) },
          ]} />
        </>
      )}

      <SectionTitle color="#D4A853" icon={Heart}>Surrogate Details</SectionTitle>
      <InfoGrid items={[
        { label: 'Surrogate Friendly Insurance', editable: true, value: <EditableSelect field="surrogacyFriendlyInsurance" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Insurance Carrier', editable: true, value: <EditableValue field="insuranceCarrier" msData={msData} onChange={onChange} placeholder="Enter carrier name..." /> },
        { label: 'IP to Pay Monthly Premium', editable: true, value: <EditableSelect field="ipPayPremium" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Previously Been a Surrogate', value: previousSurrogate ? 'Yes' : 'No' },
        { label: '# of Children (Live Births)', value: pregnancies.filter(p => p.outcome === 'Live Birth').length || '—' },
        { label: 'Surrogacy Type', editable: true, value: <EditableSelect field="surrogacyType" msData={msData} onChange={onChange} options={['Gestational Surrogacy', 'Traditional Surrogacy']} placeholder="Select type..." value="Gestational Surrogacy" /> },
      ]} />

      <SectionTitle color="#D4A853" icon={Scale}>Surrogate's Attorney</SectionTitle>
      <InfoGrid items={[
        { label: 'Attorney Name', editable: true, value: <EditableValue field="gcAttorneyName" msData={msData} onChange={onChange} placeholder="Enter attorney name..." value={jd.gcAttorneyName} /> },
        { label: 'Attorney Email', editable: true, value: <EditableValue field="gcAttorneyEmail" msData={msData} onChange={onChange} placeholder="Enter attorney email..." value={jd.gcAttorneyEmail} /> },
      ]} />

      {/* Journey Details — page 3 */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 1, margin: 0 }} className="pdf-page-break" />
      <PartyBanner color="#723bb4" icon={FileText}>Journey Details</PartyBanner>
      <InfoGrid items={[
        { label: 'Escrow Account Holder', editable: true, value: <EditableValue field="escrowCompany" msData={msData} onChange={onChange} placeholder="SeedTrust Escrow, LLC" value="SeedTrust Escrow, LLC" /> },
        { label: 'Escrow to Be Funded', editable: true, value: <EditableValue field="escrowFunding" msData={msData} onChange={onChange} placeholder="$100,000" value="$100,000" /> },
        { label: 'Minimum Balance Requirement', editable: true, value: <EditableValue field="escrowMinimum" msData={msData} onChange={onChange} placeholder="$10,000" value={fmtCurrency(jd.escrowMin) !== '—' ? fmtCurrency(jd.escrowMin) : '$10,000'} /> },
        { label: 'Lost Wages Entitled', value: lostWagesDisplay },
        { label: "Surrogate's Employment Status", value: gcEmploymentDisplay },
        { label: "Spouse/Partner's Employment Status", value: gcHasPartner ? partnerEmploymentDisplay : '—' },
        { label: 'Amnio / Invasive Testing', editable: true, value: <EditableSelect field="amnioTesting" msData={msData} onChange={onChange} options={['Only if Medically Necessary', 'Yes', 'No']} placeholder="Select..." value={hopes.cvsAmnio === 'yes' ? 'Yes' : hopes.cvsAmnio === 'no' ? 'No' : ''} /> },
        { label: 'Number of Fetuses to Carry', editable: true, value: <EditableValue field="numberOfFetuses" msData={msData} onChange={onChange} placeholder="1" value={hopes.embryosToTransfer || ''} /> },
        { label: 'Willing to Carry Twins (Split)', editable: true, value: <EditableSelect field="willingTwins" msData={msData} onChange={onChange} placeholder="Select..." value={hopes.carryTwins === 'yes' ? 'Yes' : hopes.carryTwins === 'no' ? 'No' : ''} /> },
        { label: 'Abort/Reduce for Medical Reason', editable: true, value: <EditableSelect field="abortReduce" msData={msData} onChange={onChange} options={['Any medical reason', 'Life-threatening only', 'No']} placeholder="Select..." /> },
        { label: 'Psych Counseling', editable: true, value: <EditableSelect field="psychCounseling" msData={msData} onChange={onChange} options={['Required', 'Allowed', 'Not Required']} placeholder="Select..." value="Required" /> },
        { label: 'Psych Can Be Done Over the Phone', editable: true, value: <EditableSelect field="psychOverPhone" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Max Counseling Sessions', editable: true, value: <EditableValue field="maxCounselingSessions" msData={msData} onChange={onChange} placeholder="15" value="15" /> },
        { label: 'Support Group Meetings Required', editable: true, value: <EditableSelect field="supportGroupMeetings" msData={msData} onChange={onChange} options={['Yes', 'Optional']} placeholder="Select..." value="Optional" /> },
      ]} />

      <SectionTitle color="#723bb4" icon={Stethoscope}>IVF Physician</SectionTitle>
      <InfoGrid items={[
        { label: 'Name of IVF Physician', editable: true, value: <EditableValue field="ivfPhysicianName" msData={msData} onChange={onChange} placeholder="Enter physician name..." displayPrefix="Dr. " value={jd.ivfDoctor || ipCase?.reDoctorName || ''} /> },
        { label: 'IVF Clinic', editable: true, value: <EditableValue field="ivfClinicName" msData={msData} onChange={onChange} placeholder="Enter clinic name..." value={jd.ivfClinic || ''} /> },
        { label: 'City, State of IVF Physician', editable: true, value: <EditableValue field="reClinicLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." value={reClinicLocation} />, span: 2 },
      ]} />

      <SectionTitle color="#723bb4" icon={Hospital}>Delivery Hospital</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'Hospital Name', editable: true, value: <EditableValue field="deliveryHospital" msData={msData} onChange={onChange} placeholder="Enter hospital name..." value={jd.deliveryHospital || jd.hospital || ''} /> },
        { label: 'City, State', editable: true, value: <EditableValue field="deliveryHospitalLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." value={deliveryHospitalLocation} /> },
      ]} />

      <ConfidentialFooter />
    </div>
  )
}

// ── Clinic Match Sheet ──

function ClinicSheet({ journey, gcCase, ipCase, profileData, sheetRef, msData, onChange }) {
  const a = ipCase?.answers || {}
  // Admin-edited overrides for IP info live in answers._ipContact. Without
  // this fallback chain, address/name/DOB updates the admin makes through
  // the IP application tab don't reach the Clinic sheet.
  const ipContact = a._ipContact || {}
  const ga = gcCase?.answers || {}
  const jd = journey.journey_data || {}
  const pd = profileData || {}
  const personal = pd.personal || {}
  const pregnancyHistory = pd.pregnancyHistory || {}
  const fertility = pd.fertility || {}
  const health = pd.health || {}
  const employment = pd.employment || {}
  const color = '#9b2ea7'
  const gcDob = gcCase?.dob || ga.dob || personal.dob

  const pregnancies = pregnancyHistory.pregnancies || []
  const numPreg = parseInt(pregnancyHistory.numberOfPregnancies) || pregnancies.length

  return (
    <div ref={sheetRef} style={{ width: 816, padding: '48px 56px', backgroundColor: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1c1917', lineHeight: 1.5 }}>
      <SheetHeader title="Clinic Match Sheet" journey={journey} color={color} />

      {/* Clinic Details — pulled from journey hero card */}
      <PartyBanner color={color} icon={Stethoscope}>Clinic Details</PartyBanner>
      <InfoGrid items={[
        { label: 'Clinic Name', value: jd.ivfClinic || '—' },
        { label: 'RE', value: jd.ivfDoctor ? (/^dr\.?\s/i.test(jd.ivfDoctor) ? jd.ivfDoctor : `Dr. ${jd.ivfDoctor}`) : '—' },
      ]} />

      {/* Intended Parents — same 4-col structured layout as Escrow Sheet */}
      <PartyBanner color="#1A3638" icon={Users}>Intended Parents</PartyBanner>

      <PartyLabel color="#1A3638">Intended Parent #1</PartyLabel>
      <InfoGrid columns={4} items={[
        { label: 'Full Name', value: `${ipContact.ip1FirstName || a.primaryFirstName || ''} ${ipContact.ip1LastName || a.primaryLastName || ''}`.trim(), span: 2 },
        { label: 'Date of Birth', value: `${formatDate(ipContact.ip1Dob || a.primaryDob)}${(ipContact.ip1Dob || a.primaryDob) ? ` (Age ${calcAge(ipContact.ip1Dob || a.primaryDob)})` : ''}`, span: 2 },
        { label: 'Email', value: ipContact.ip1Email || ipCase?.email, span: 2 },
        { label: 'Phone', value: formatPhone(ipContact.ip1Phone || ipCase?.phone), span: 2 },
        { label: 'Street Address', value: [ipContact.street || a.street, a.street2].filter(Boolean).join(', ') },
        { label: 'City', value: ipContact.city || a.city },
        { label: 'State', value: ipContact.state || a.stateProv },
        { label: 'Zip', value: ipContact.zipCode || a.zipCode },
      ]} />

      {(a.hasPartner === true || a.hasPartner === 'yes') && (
        <>
          <PartyLabel color="#1A3638">Intended Parent #2</PartyLabel>
          <InfoGrid items={[
            { label: 'Full Name', value: `${ipContact.ip2FirstName || a.ip2FirstName || ''} ${ipContact.ip2LastName || a.ip2LastName || ''}`.trim() },
            { label: 'Date of Birth', value: `${formatDate(ipContact.ip2Dob || a.ip2Dob)}${(ipContact.ip2Dob || a.ip2Dob) ? ` (Age ${calcAge(ipContact.ip2Dob || a.ip2Dob)})` : ''}` },
            { label: 'Email', value: ipContact.ip2Email || ipCase?.ip2Email },
            { label: 'Phone', value: formatPhone(ipContact.ip2Phone || ipCase?.ip2Phone) },
          ]} />
        </>
      )}

      {/* Surrogate — detailed medical */}
      <PartyBanner color="#D4A853" icon={User}>Surrogate</PartyBanner>

      {/* Hero stats: Age (DOB), Height, Weight, BMI, Marital Status */}
      <SurrogateStatTiles
        gcDob={gcDob}
        heightFt={ga.heightFt || personal.heightFt}
        heightIn={ga.heightIn || personal.heightIn}
        weight={ga.weightLbs || personal.weight}
        bmi={gcCase?.bmi}
        maritalStatus={ga.maritalStatus || personal.maritalStatus}
      />

      {/* Surrogate identity grid — same Full Name / DOB / Email / Phone
          shape the IP block uses, so the clinic reads both blocks the
          same way. */}
      <InfoGrid items={[
        { label: 'Full Name',     value: gcCase?.name || '—' },
        { label: 'Date of Birth', value: gcDob ? `${formatDate(gcDob)}${calcAge(gcDob) ? ` (Age ${calcAge(gcDob)})` : ''}` : '—' },
        { label: 'Email',         value: gcCase?.email || '—' },
        { label: 'Phone',         value: formatPhone(gcCase?.phone) || '—' },
      ]} />

      {/* Spouse / Partner — surfaces below the surrogate identity grid
          when ANY partner data exists. Same Full Name / DOB / Email /
          Phone shape so it mirrors both the surrogate above and the IP
          partner block. */}
      {(() => {
        const conf = ga._confidential || {}
        const app = ga._application || {}
        const spouseFullName = conf.spouseFullName || app.spouseFullName || personal.spouseFullName || ''
        const parts = spouseFullName.trim().split(/\s+/).filter(Boolean)
        const partnerFirst = app.spouseFirstName || conf.spouseFirstName || personal.partnerName || parts[0] || ''
        const partnerLast = app.spouseLastName || conf.spouseLastName || (parts.length > 1 ? parts.slice(1).join(' ') : '')
        const partnerDob = app.spouseDob || conf.spouseDob || personal.partnerDob || ''
        const partnerEmail = app.spouseEmail || conf.spouseEmail || personal.partnerEmail || ''
        const partnerPhone = app.spousePhone || conf.spousePhone || personal.partnerPhone || ''
        const partnerName = [partnerFirst, partnerLast].filter(Boolean).join(' ').trim() || spouseFullName
        const hasPartner = !!(partnerName || partnerDob || partnerEmail || partnerPhone)
        if (!hasPartner) return null
        return (
          <>
            <SectionTitle color="#D4A853" icon={Users}>Spouse / Partner</SectionTitle>
            <InfoGrid items={[
              { label: 'Full Name',     value: partnerName || '—' },
              { label: 'Date of Birth', value: partnerDob ? `${formatDate(partnerDob)}${calcAge(partnerDob) ? ` (Age ${calcAge(partnerDob)})` : ''}` : '—' },
              { label: 'Email',         value: partnerEmail || '—' },
              { label: 'Phone',         value: formatPhone(partnerPhone) || '—' },
            ]} />
          </>
        )
      })()}

      {/* Pregnancy History — page 2: GTPAL summary directly above the per-row table. */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 1, margin: 0 }} className="pdf-page-break" />
      <PartyBanner color="#D4A853" icon={Baby}>Pregnancy History</PartyBanner>
      <PregnancyHistorySummary pregnancies={pregnancies} numPreg={numPreg} />

      {/* Pregnancy detail table — Live Birth deliveries default to
          "Vaginal" when the source data is blank. */}
      {pregnancies.length > 0 && (
        <div style={{ marginTop: 4, borderRadius: 12, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#fafaf9' }}>
                {['#', 'Year', 'Outcome', 'Delivery', 'Gestational Age', 'Weight / Length', 'Surrogacy', 'Complications'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pregnancies.map((p, i) => {
                const outcome = String(p.outcome || '').trim()
                const isLiveBirth = /live\s*birth/i.test(outcome)
                const delivery = p.deliveryType || (isLiveBirth ? 'Vaginal' : '—')
                const weeks = p.gestationWeeks ? String(p.gestationWeeks).trim() : ''
                const days = p.gestationDays ? String(p.gestationDays).trim() : ''
                const gestationalAge = weeks ? `${weeks}w${days ? ` ${days}d` : ''}` : '—'
                const babies = []
                if (p.weight || p.length) babies.push({ weight: p.weight, length: p.length })
                if (p.babyBWeight || p.babyBLength) babies.push({ weight: p.babyBWeight, length: p.babyBLength })
                if (p.babyCWeight || p.babyCLength) babies.push({ weight: p.babyCWeight, length: p.babyCLength })
                return (
                  <tr key={i} style={{ borderTop: '1px solid #e7e5e4' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '8px 12px' }}>{p.dob ? new Date(p.dob + 'T00:00:00').getFullYear() : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{outcome || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{delivery}</td>
                    <td style={{ padding: '8px 12px' }}>{gestationalAge}</td>
                    <td style={{ padding: '8px 12px', fontSize: 10 }}>
                      {babies.length === 0 ? '—' : babies.map((b, j) => (
                        <div key={j}>{[b.weight, b.length ? `${b.length}"` : null].filter(Boolean).join(', ') || '—'}</div>
                      ))}
                    </td>
                    <td style={{ padding: '8px 12px' }}>{p.wasSurrogacy === 'Yes' || p.wasSurrogacy === true ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 10 }}>{p.complications || p.complicationsExplanation || 'None'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfidentialFooter />
    </div>
  )
}

// ── Escrow Match Sheet ──

function EscrowSheet({ journey, gcCase, ipCase, profileData, sheetRef, msData, onChange }) {
  const a = ipCase?.answers || {}
  // Same _ipContact fallback chain the Attorney/Clinic sheets use, so admin
  // edits to IP info reach this sheet too.
  const ipContact = a._ipContact || {}
  const ga = gcCase?.answers || {}
  const jd = journey.journey_data || {}
  const pd = profileData || {}
  const personal = pd.personal || {}
  const color = '#10b981'
  const gcDob = gcCase?.dob || ga.dob || personal.dob

  return (
    <div ref={sheetRef} style={{ width: 816, padding: '48px 56px', backgroundColor: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1c1917', lineHeight: 1.5 }}>
      <SheetHeader title="Escrow Match Sheet" journey={journey} color={color} />

      {/* Intended Parents */}
      <PartyBanner color="#1A3638" icon={Users}>Intended Parents</PartyBanner>

      <PartyLabel color="#1A3638">Intended Parent #1</PartyLabel>
      <InfoGrid columns={4} items={[
        { label: 'Full Name', value: `${ipContact.ip1FirstName || a.primaryFirstName || ''} ${ipContact.ip1LastName || a.primaryLastName || ''}`.trim(), span: 2 },
        { label: 'Date of Birth', value: `${formatDate(ipContact.ip1Dob || a.primaryDob)}${(ipContact.ip1Dob || a.primaryDob) ? ` (Age ${calcAge(ipContact.ip1Dob || a.primaryDob)})` : ''}`, span: 2 },
        { label: 'Email', value: ipContact.ip1Email || ipCase?.email, span: 2 },
        { label: 'Phone', value: formatPhone(ipContact.ip1Phone || ipCase?.phone), span: 2 },
        { label: 'Street Address', value: [ipContact.street || a.street, a.street2].filter(Boolean).join(', ') },
        { label: 'City', value: ipContact.city || a.city },
        { label: 'State', value: ipContact.state || a.stateProv },
        { label: 'Zip', value: ipContact.zipCode || a.zipCode },
      ]} />

      {(a.hasPartner === true || a.hasPartner === 'yes') && (
        <>
          <PartyLabel color="#1A3638">Intended Parent #2</PartyLabel>
          <InfoGrid items={[
            { label: 'Full Name', value: `${ipContact.ip2FirstName || a.ip2FirstName || ''} ${ipContact.ip2LastName || a.ip2LastName || ''}`.trim() },
            { label: 'Date of Birth', value: `${formatDate(ipContact.ip2Dob || a.ip2Dob)}${(ipContact.ip2Dob || a.ip2Dob) ? ` (Age ${calcAge(ipContact.ip2Dob || a.ip2Dob)})` : ''}` },
            { label: 'Email', value: ipContact.ip2Email || ipCase?.ip2Email },
            { label: 'Phone', value: formatPhone(ipContact.ip2Phone || ipCase?.ip2Phone) },
          ]} />
        </>
      )}

      {/* Surrogate */}
      <PartyBanner color="#D4A853" icon={User}>Surrogate</PartyBanner>
      <InfoGrid columns={4} items={[
        { label: 'Full Name', value: gcCase?.name, span: 2 },
        { label: 'Date of Birth', value: `${formatDate(gcDob)}${gcDob ? ` (Age ${calcAge(gcDob)})` : ''}`, span: 2 },
        { label: 'Email', value: gcCase?.email, span: 2 },
        { label: 'Phone', value: formatPhone(gcCase?.phone), span: 2 },
        { label: 'Street Address', value: personal.streetAddress || ga.streetAddress },
        { label: 'City', value: ga.city || personal.city },
        { label: 'State', value: ga.state || personal.state },
        { label: 'Zip', value: personal.zipCode || ga.zipCode },
      ]} />

      {/* Escrow Details */}
      <PartyBanner color={color} icon={DollarSign}>Escrow Details</PartyBanner>
      <InfoGrid items={[
        { label: 'Match Date', value: formatDate(journey.created_at) },
        { label: 'Escrow Opening Amount', editable: true, value: <EditableValue field="escrowOpeningAmount" msData={msData} onChange={onChange} placeholder="$5,000" value="$5,000" /> },
        { label: 'Minimum Balance', editable: true, value: <EditableValue field="escrowMinimum" msData={msData} onChange={onChange} placeholder="$10,000" value={fmtCurrency(jd.escrowMin) !== '—' ? fmtCurrency(jd.escrowMin) : '$10,000'} /> },
        { label: 'Amount to Fund After Legal Clearance', editable: true, value: <EditableValue field="escrowFundAfterLegal" msData={msData} onChange={onChange} placeholder="$100,000" value="$100,000" /> },
      ]} />

      <ConfidentialFooter />
    </div>
  )
}

// ── Main Tab Component ──

export default function MatchSheetsTab({ journey, gcCase, ipCase, onUpdate }) {
  const [activeSheet, setActiveSheet] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const sheetRef = useRef(null)
  const autosaveTimerRef = useRef(null)
  const { openDraft } = useDrafts()
  const { currentUser } = useRole()


  // Match sheet editable data stored in journey_data._matchSheetData
  const [msData, setMsData] = useState(journey.journey_data?._matchSheetData || {})

  // Load surrogate profile data
  useEffect(() => {
    if (gcCase?.email) {
      fetchSurrogateProfileByEmail(gcCase.email).then(data => {
        if (data?.profile_data) setProfileData(data.profile_data)
      }).catch(() => {})
    }
  }, [gcCase?.email])

  // Sync msData from journey on load
  useEffect(() => {
    if (journey.journey_data?._matchSheetData) {
      setMsData(journey.journey_data._matchSheetData)
    }
  }, [journey.journey_data?._matchSheetData])

  function handleFieldChange(field, value) {
    setMsData(prev => ({ ...prev, [field]: value }))
  }

  async function saveMatchSheetData() {
    setSaving(true)
    try {
      const jd = { ...(journey.journey_data || {}), _matchSheetData: msData }
      await onUpdate({ journey_data: jd })
    } catch {} finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const savedData = journey.journey_data?._matchSheetData || {}
    const current = JSON.stringify(msData || {})
    const saved = JSON.stringify(savedData)
    if (current === saved) return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      saveMatchSheetData()
    }, 800)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [msData, journey.journey_data?._matchSheetData])

  function getFileName() {
    const sheetType = SHEET_TYPES.find(s => s.id === activeSheet)
    return `${sheetType?.label || 'Match Sheet'} - ${gcCase?.name || 'GC'} & ${ipCase?.names || 'IP'}.pdf`
  }

  async function buildCurrentSheetAttachment() {
    const pdf = await generatePDF()
    if (!pdf) return null
    return {
      filename: getFileName(),
      mimeType: 'application/pdf',
      base64Data: pdf.output('datauristring').split(',')[1],
    }
  }

  async function generatePDF() {
    if (!sheetRef.current) return null
    await saveMatchSheetData()

    const container = sheetRef.current
    const pageBreaks = [...container.querySelectorAll('.pdf-page-break')]
    const pdf = new jsPDF('p', 'pt', 'letter')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 24

    if (pageBreaks.length === 0) {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const usableWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * usableWidth) / canvas.width
      let heightLeft = imgHeight, position = margin
      pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, imgHeight)
      heightLeft -= (pageHeight - margin * 2)
      while (heightLeft > 0) { position -= (pageHeight - margin); pdf.addPage(); pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, imgHeight); heightLeft -= (pageHeight - margin * 2) }
    } else {
      // Use getBoundingClientRect against the container — pb.offsetTop is
      // relative to the nearest positioned ancestor, which (depending on
      // wrapping styles) can be the page <body> instead of the sheet div.
      // That bug made every break collapse to "0 above first break, all
      // content below" → effectively a one-page PDF.
      const containerRect = container.getBoundingClientRect()
      const breakOffsets = pageBreaks.map(pb => pb.getBoundingClientRect().top - containerRect.top)
      const sections = []
      let prevTop = 0
      for (const offset of breakOffsets) { sections.push({ top: prevTop, height: offset - prevTop }); prevTop = offset }
      sections.push({ top: prevTop, height: container.scrollHeight - prevTop })
      // Capture the full canvas with breaks left visible (they're 1px each
      // — invisible in the rendered output but they hold their position so
      // our offsets stay accurate).
      const fullCanvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const renderScale = fullCanvas.width / container.offsetWidth
      const usableWidth = pageWidth - margin * 2
      for (let i = 0; i < sections.length; i++) {
        if (i > 0) pdf.addPage()
        const s = sections[i]
        const srcY = Math.round(s.top * renderScale)
        const srcH = Math.max(1, Math.round(s.height * renderScale))
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = fullCanvas.width
        cropCanvas.height = srcH
        const ctx = cropCanvas.getContext('2d')
        ctx.drawImage(fullCanvas, 0, srcY, fullCanvas.width, srcH, 0, 0, cropCanvas.width, srcH)
        const imgData = cropCanvas.toDataURL('image/jpeg', 0.95)
        const imgHeight = (srcH * usableWidth) / fullCanvas.width
        pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, imgHeight)
      }
    }

    return pdf
  }

  async function saveToDocuments() {
    setGenerating(true)
    try {
      const pdf = await generatePDF()
      if (pdf) pdf.save(getFileName())
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  // Attorney sheet: ask which attorney to send to
  const [attorneyPickerOpen, setAttorneyPickerOpen] = useState(false)
  const [pendingPdf, setPendingPdf] = useState(null)
  // "Have you reviewed all the information?" gate before any send.
  const [reviewConfirmOpen, setReviewConfirmOpen] = useState(false)

  async function sendMatchSheet() {
    setGenerating(true)
    try {
      const ipAnswers = ipCase?.answers || {}
      const jd = journey?.journey_data || {}
      const ip1First = ipAnswers.primaryFirstName || ''
      const ip1Last = ipAnswers.primaryLastName || ''
      const ip1Name = `${ip1First} ${ip1Last}`.trim()
      const ip2First = ipAnswers.ip2FirstName || ''
      const ip2Last = ipAnswers.ip2LastName || ''
      const hasPartner = ipAnswers.hasPartner === true || ipAnswers.hasPartner === 'yes'
      const ip2Name = hasPartner ? `${ip2First} ${ip2Last}`.trim() : ''
      const ipNames = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name
      const gcName = gcCase?.name || ''
      const adminName = currentUser?.name || ''

      const attachment = await buildCurrentSheetAttachment()
      if (!attachment) return

      if (activeSheet === 'attorney') {
        // Show picker for IP Attorney vs GC Attorney
        setPendingPdf(attachment)
        setAttorneyPickerOpen(true)
      } else if (activeSheet === 'escrow') {
        // Escrow: To = SeedTrust, CC = IP1 + IP2 (if applicable)
        const ip1Email = ipCase?.email || ipAnswers.email || ipAnswers.primaryEmail || ''
        const ip2Email = hasPartner ? (ipCase?.ip2Email || ipAnswers.ip2Email || '') : ''
        const ipEmails = [ip1Email, ip2Email].filter(Boolean).join(', ')
        const body = `<p>Hi ${ip1First}${ip2First ? ' & ' + ip2First : ''},</p><p>Now that you have started with legal contracts, we can begin escrow and get your account funded.</p><p>SeedTrust is very easy to use for all involved, and they keep great records and give you access to your escrow portal so that you are able to view your account and keep close track of the account.</p><p>Your escrow management team will be reaching out to get you all set up.</p><p>Please let me know if you have any questions.</p>`
        openDraft({
          to: 'info@seedtrustescrow.com',
          cc: ipEmails,
          subject: `Escrow Match Sheet - ${ipNames} with GC ${gcName}`,
          body,
          userId: currentUser?.id,
          caseId: journey.id,
          caseType: 'journey',
          attachments: [attachment],
        })
      } else if (activeSheet === 'clinic') {
        // Clinic: To = 3rd party coordinator
        const coordinatorEmail = jd.ivfCoordinatorEmail || ''
        const subjectLabel = ip2Name ? `Intended Parents: ${ip1Name} & ${ip2Name}` : `Intended Parent: ${ip1Name}`
        const ipPossessive = hasPartner ? 'IPs' : 'IP'
        const body = `<p>Hello,</p><p>My name is ${adminName}, and I am the Case Manager working with ${ipPossessive}: ${ipNames} and GS: ${gcName}. I am looking forward to working with you all on this case.</p><p>Attached, please find the Match Sheet. If you need anything else to proceed please let me know.</p><p>Please let me know when you anticipate being able to bring her in for a medical evaluation.</p><p>If you could let me know what your medical evaluation process includes that would be great. For the group psych eval, are you fine using one of our therapists?</p>`
        openDraft({
          to: coordinatorEmail,
          subject: `Match Sheet for ${subjectLabel} with Surrogate: ${gcName}`,
          body,
          userId: currentUser?.id,
          caseId: journey.id,
          caseType: 'journey',
          attachments: [attachment],
        })
      }
    } catch (err) {
      console.error('Send match sheet failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  /** Fetch a remote URL and return it as a draft-ready attachment object. */
  async function urlToAttachment(url, filename) {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const blob = await res.blob()
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(blob)
      })
      return { filename, mimeType: blob.type || 'application/octet-stream', base64Data: base64 }
    } catch { return null }
  }

  async function sendAttorneySheet(recipient) {
    const jd = journey?.journey_data || {}
    const ipAnswers = ipCase?.answers || {}
    const gcApp = gcCase?.answers?._application || {}
    const ip1First = ipAnswers.primaryFirstName || ''
    const ip1Last = ipAnswers.primaryLastName || ''
    const ip1Name = `${ip1First} ${ip1Last}`.trim()
    const ipHasPartner = ipAnswers.hasPartner === true || ipAnswers.hasPartner === 'yes'
    const ip2First = ipAnswers.ip2FirstName || ''
    const ip2Last = ipAnswers.ip2LastName || ''
    const ip2Name = ipHasPartner ? `${ip2First} ${ip2Last}`.trim() : ''
    const ipNames = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name
    const gcFullName = gcApp.fullLegalName || gcCase?.name || ''
    const gcFirstName = gcFullName.split(/\s+/)[0] || gcFullName
    const gcHasPartner = gcApp.hasSpouse === 'yes' || gcApp.hasSpouse === true
    const gcPartnerFirst = gcApp.spouseFirstName || ''
    const gcPartnerLast = gcApp.spouseLastName || ''
    const gcPartnerFull = `${gcPartnerFirst} ${gcPartnerLast}`.trim()
    const partnerRelationship = (gcApp.maritalStatus || gcApp.relationshipStatus || 'spouse/partner').toLowerCase()

    const toEmail = recipient === 'ip' ? jd.ipAttorneyEmail : jd.gcAttorneyEmail
    const attorneyFullName = recipient === 'ip' ? (jd.ipAttorneyName || '') : (jd.gcAttorneyName || '')
    const attorneyFirst = attorneyFullName.split(/\s+/)[0] || attorneyFullName
    const otherAttorneyFullName = recipient === 'ip' ? (jd.gcAttorneyName || '') : (jd.ipAttorneyName || '')
    const otherAttorneyFirst = otherAttorneyFullName.split(/\s+/)[0] || otherAttorneyFullName
    // Clinic name lives on the journey row as `ivfClinic`. The match-sheet
    // editor stores user overrides at `_matchSheetData.ivfClinicName`. Prefer
    // the override, then fall back to the journey field.
    const clinicName = msData.ivfClinicName || jd.ivfClinic || jd.ivfClinicName || jd.clinicName || ''
    const clinicState = msData.reClinicLocation?.split(',').pop()?.trim() || jd.ivfState || jd.clinicState || ''
    const matchSheetAttachment = pendingPdf || await buildCurrentSheetAttachment()
    if (!matchSheetAttachment) return

    // Pull labeled docs from BOTH the GC and IP cases. We dedupe nothing
    // intentionally — a GC could (rarely) have multiple docs sharing the
    // same label (e.g. several paystubs), and we attach each.
    let labeledDocs = []
    try {
      const ids = [gcCase?.id, ipCase?.id].filter(Boolean)
      if (ids.length && supabase) {
        const { data } = await supabase
          .from('case_documents')
          .select('id, file_name, public_url, doc_label, surrogate_id')
          .in('surrogate_id', ids)
          .not('doc_label', 'is', null)
        labeledDocs = data || []
      }
    } catch (err) { console.error('Could not load labeled docs:', err) }

    const docsByLabel = {}
    for (const d of labeledDocs) {
      if (!docsByLabel[d.doc_label]) docsByLabel[d.doc_label] = []
      docsByLabel[d.doc_label].push(d)
    }

    // Build the bullet list and the attachment list in lockstep — only
    // include a bullet when we actually have at least one labeled doc to
    // back it up. Match Sheet is the exception (always present, comes
    // from the rendered PDF in pendingPdf).
    const bullets = ['Attorney Match Sheet']
    const attachments = [matchSheetAttachment]

    // GC ID
    if ((docsByLabel['gc'] || []).length > 0) {
      bullets.push(`${gcFirstName}'s ID`)
      for (const d of docsByLabel['gc']) {
        const a = await urlToAttachment(d.public_url, d.file_name || `${gcFirstName}-ID.pdf`)
        if (a) attachments.push(a)
      }
    }
    // Partner ID — only when partnered
    if (gcHasPartner && (docsByLabel['partner'] || []).length > 0) {
      const partnerLabel = gcPartnerFull ? `${gcPartnerFull}'s ID (${partnerRelationship})` : `Partner's ID (${partnerRelationship})`
      bullets.push(partnerLabel)
      for (const d of docsByLabel['partner']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'Partner-ID.pdf')
        if (a) attachments.push(a)
      }
    }
    // GC Benefit Package
    if ((docsByLabel['gc-benefit-package'] || []).length > 0) {
      bullets.push('GC Benefit Package')
      for (const d of docsByLabel['gc-benefit-package']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'GC-Benefit-Package.pdf')
        if (a) attachments.push(a)
      }
    }
    // GC Insurance Card
    if ((docsByLabel['gc-insurance-card'] || []).length > 0) {
      bullets.push('GC Insurance Card')
      for (const d of docsByLabel['gc-insurance-card']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'GC-Insurance-Card.pdf')
        if (a) attachments.push(a)
      }
    }
    // GC Insurance Review
    if ((docsByLabel['gc-insurance-review'] || []).length > 0) {
      bullets.push('GC Insurance Review')
      for (const d of docsByLabel['gc-insurance-review']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'GC-Insurance-Review.pdf')
        if (a) attachments.push(a)
      }
    }
    // GC Paystubs
    if ((docsByLabel['gc-paystubs'] || []).length > 0) {
      bullets.push(`${gcFirstName}'s Paystubs`)
      for (const d of docsByLabel['gc-paystubs']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'GC-Paystubs.pdf')
        if (a) attachments.push(a)
      }
    }
    // Partner Paystubs — only when partnered
    if (gcHasPartner && (docsByLabel['partner-paystubs'] || []).length > 0) {
      const label = gcPartnerFull ? `${gcPartnerFull}'s Paystubs (${partnerRelationship})` : `Partner Paystubs (${partnerRelationship})`
      bullets.push(label)
      for (const d of docsByLabel['partner-paystubs']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'Partner-Paystubs.pdf')
        if (a) attachments.push(a)
      }
    }
    // IP Background Reports — combine into one bullet with both IPs' first
    // names if both are labeled.
    const ip1Bg = docsByLabel['ip1-background-report'] || []
    const ip2Bg = ipHasPartner ? (docsByLabel['ip2-background-report'] || []) : []
    if (ip1Bg.length > 0 || ip2Bg.length > 0) {
      const names = [
        ip1Bg.length > 0 ? ip1First : null,
        ip2Bg.length > 0 ? ip2First : null,
      ].filter(Boolean).join(' & ')
      bullets.push(`${names || 'IP'}'s Background Report${(ip1Bg.length + ip2Bg.length) > 1 ? 's' : ''}`)
      for (const d of [...ip1Bg, ...ip2Bg]) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'IP-Background-Report.pdf')
        if (a) attachments.push(a)
      }
    }
    // IP1/IP2 IDs (separate from background reports — independently labeled)
    if ((docsByLabel['ip1'] || []).length > 0) {
      bullets.push(`${ip1First || 'IP1'}'s ID`)
      for (const d of docsByLabel['ip1']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'IP1-ID.pdf')
        if (a) attachments.push(a)
      }
    }
    if (ipHasPartner && (docsByLabel['ip2'] || []).length > 0) {
      bullets.push(`${ip2First || 'IP2'}'s ID`)
      for (const d of docsByLabel['ip2']) {
        const a = await urlToAttachment(d.public_url, d.file_name || 'IP2-ID.pdf')
        if (a) attachments.push(a)
      }
    }

    const bulletsHtml = bullets.map(b => `<li>${b}</li>`).join('')

    // Body intro is recipient-specific. The IP attorney version leads
    // with the IPs; the GC attorney version leads with the surrogate
    // (everything else flips the same way — "represented by" names the
    // OTHER attorney, "I'll reach out to" too).
    const introParagraph = recipient === 'gc'
      ? `<p>I am writing to let you know that our gestational surrogate ${gcFullName} and her Intended Parents ${ipNames} are working with ${clinicName || '{clinic name}'} in ${clinicState || '{clinic state}'} and are ready to begin legal contracts. We will use SeedTrust Escrow, LLC to hold escrow.</p>`
      : `<p>I am writing to let you know that our Intended Parents ${ipNames} and their gestational surrogate ${gcFullName} are working with ${clinicName || '{clinic name}'} in ${clinicState || '{clinic state}'} and are ready to begin legal contracts. We will use SeedTrust Escrow, LLC to hold escrow.</p>`

    const representationParagraph = recipient === 'gc'
      ? `<p>${ipNames} will be represented by ${jd.ipAttorneyName || '{IP Attorney Full Name}'}. I will be reaching out to ${otherAttorneyFirst || '{IP Attorney first name}'} shortly and I will send ${otherAttorneyFirst ? 'them' : 'them'} this information as well.</p>`
      : `<p>${gcFullName} will be represented by ${jd.gcAttorneyName || '{GC Attorney Full Name}'}. I will be reaching out to ${otherAttorneyFirst || '{GC Attorney first name}'} shortly and I will send ${otherAttorneyFirst ? 'them' : 'her'} this information as well.</p>`

    const body = `<p>Hi ${attorneyFirst || ''},</p>
${introParagraph}
${representationParagraph}
<p>Attached, you will find the following:</p>
<ul>${bulletsHtml}</ul>
<p>Please let me know if any additional information is needed. I look forward to working with you.</p>
<p>Thank you,</p>`

    openDraft({
      to: toEmail || '',
      subject: recipient === 'gc'
        ? `Attorney Referral for ${gcFullName} with ${ipNames}`
        : `Attorney Referral for ${ipNames} with ${gcFullName}`,
      body,
      userId: currentUser?.id,
      caseId: journey.id,
      caseType: 'journey',
      attachments,
    })
    setAttorneyPickerOpen(false)
    setPendingPdf(null)
  }

  function printSheet() {
    if (!sheetRef.current) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html><head><title>Match Sheet</title>
      <style>body { margin: 0; } input { border: none !important; border-bottom: none !important; outline: none; font-family: inherit; font-size: inherit; font-weight: inherit; color: inherit; } @media print { @page { margin: 0.25in; } }</style>
      </head><body>${sheetRef.current.outerHTML}</body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  }

  const SheetComponent = activeSheet === 'attorney' ? AttorneySheet : activeSheet === 'clinic' ? ClinicSheet : activeSheet === 'escrow' ? EscrowSheet : null

  // Check if msData has changed from what's saved
  const hasUnsaved = JSON.stringify(msData) !== JSON.stringify(journey.journey_data?._matchSheetData || {})

  return (
    <div className="space-y-6">
      {!activeSheet ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SHEET_TYPES.map(sheet => (
            <Card key={sheet.id} className="rounded-2xl cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 border-transparent hover:border-current" style={{ '--tw-border-opacity': 0.2 }}
              onClick={() => setActiveSheet(sheet.id)}>
              <CardContent className="pt-6 pb-6 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: sheet.color + '15' }}>
                  <sheet.icon size={24} style={{ color: sheet.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: sheet.color }}>{sheet.label}</h3>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">{sheet.description}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs mt-2" style={{ color: sheet.color, borderColor: sheet.color + '40' }}>
                  <Eye className="size-3.5" /> Preview & Send
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <button onClick={() => setActiveSheet(null)} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1">
              ← Back to Match Sheets
            </button>
            <div className="flex gap-2">
              {hasUnsaved && (
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={saveMatchSheetData} disabled={saving}>
                  {saving ? <Clock className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={printSheet}>
                <Printer className="size-3.5" /> Print
              </Button>
              <Button size="sm" className="gap-1.5 rounded-full" style={{ backgroundColor: SHEET_TYPES.find(s => s.id === activeSheet)?.color }} onClick={() => setReviewConfirmOpen(true)} disabled={generating}>
                {generating ? <Clock className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Send Match Sheet
              </Button>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-stone-400 flex items-center gap-1.5">
            <Pencil className="size-3" /> Click any <span className="italic text-stone-500 border-b border-dashed border-stone-300">dashed underline</span> field to enter or edit information. Changes are saved when you download.
          </p>

          {/* Preview Container */}
          <div className="rounded-2xl border border-stone-200 bg-stone-100 p-6 overflow-x-auto">
            <div className="mx-auto shadow-2xl rounded-lg" style={{ width: 816 }}>
              <SheetComponent journey={journey} gcCase={gcCase} ipCase={ipCase} profileData={profileData} sheetRef={sheetRef} msData={msData} onChange={handleFieldChange} />
            </div>
          </div>
        </div>
      )}

      {/* "Have you reviewed all the information?" gate — shown before any
          send, regardless of which sheet type. "Go back" closes; "Yes,
          send" runs the original sendMatchSheet flow which (for attorney
          sheets) opens the attorney picker, and (for escrow/clinic) opens
          a draft directly. */}
      <Dialog open={reviewConfirmOpen} onOpenChange={v => { if (!v) setReviewConfirmOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Have you reviewed all the information?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            Please double-check that everything on the match sheet is correct before sending.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setReviewConfirmOpen(false)}>
              Go back
            </Button>
            <Button
              size="sm"
              style={{ backgroundColor: SHEET_TYPES.find(s => s.id === activeSheet)?.color, color: '#fff' }}
              onClick={() => { setReviewConfirmOpen(false); sendMatchSheet() }}
            >
              Yes, send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attorney Picker Dialog */}
      <Dialog open={attorneyPickerOpen} onOpenChange={v => { if (!v) { setAttorneyPickerOpen(false); setPendingPdf(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="size-5 text-[#1A3638]" /> Send to which attorney?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <button onClick={() => sendAttorneySheet('ip')}
              className="w-full text-left rounded-xl border border-stone-200 px-4 py-3 hover:border-[#1A3638] hover:shadow-sm transition-all">
              <p className="text-sm font-semibold text-stone-800">IP Attorney</p>
              <p className="text-xs text-stone-500 mt-0.5">{journey?.journey_data?.ipAttorneyName || 'Not set'} {journey?.journey_data?.ipAttorneyEmail ? `· ${journey.journey_data.ipAttorneyEmail}` : ''}</p>
            </button>
            <button onClick={() => sendAttorneySheet('gc')}
              className="w-full text-left rounded-xl border border-stone-200 px-4 py-3 hover:border-pink-400 hover:shadow-sm transition-all">
              <p className="text-sm font-semibold text-stone-800">GC Attorney</p>
              <p className="text-xs text-stone-500 mt-0.5">{journey?.journey_data?.gcAttorneyName || 'Not set'} {journey?.journey_data?.gcAttorneyEmail ? `· ${journey.journey_data.gcAttorneyEmail}` : ''}</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
