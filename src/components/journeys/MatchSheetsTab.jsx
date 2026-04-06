import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  FileText, Download, Eye, Printer, Scale, Stethoscope, DollarSign,
  User, Users, Heart, Shield, Briefcase, Clock, Pencil, Mail, Phone, Hospital,
  Save, Send,
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

const SHEET_TYPES = [
  { id: 'clinic', label: 'Clinic Match Sheet', icon: Stethoscope, color: '#9b2ea7', description: 'For RE / IVF clinic — medical history, pregnancy details, insurance, and transfer logistics.' },
  { id: 'escrow', label: 'Escrow Match Sheet', icon: DollarSign, color: '#10b981', description: 'For escrow company — compensation, payment terms, escrow funding, and employment details.' },
  { id: 'attorney', label: 'Attorney Match Sheet', icon: Scale, color: '#283693', description: 'For legal counsel — IP & GC contact info, demographics, embryo creation, attorney details, and journey terms.' },
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

function EditableValue({ value, field, msData, onChange, placeholder }) {
  const [editing, setEditing] = useState(false)
  const val = msData?.[field] ?? value ?? ''
  const display = val || null

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={e => onChange(field, e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(false); if (e.key === 'Escape') setEditing(false) }}
        style={{ fontSize: 13, fontWeight: 500, color: '#1c1917', border: 'none', borderBottom: '2px solid #283693', outline: 'none', padding: '0 0 1px 0', width: '100%', backgroundColor: 'transparent', fontFamily: 'inherit' }}
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
      {display || (placeholder || 'Click to enter...')}
    </span>
  )
}

// ── Editable Yes/No Select ──

function EditableSelect({ value, field, msData, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)
  const val = msData?.[field] ?? value ?? ''
  const display = val || null
  const opts = options || ['Yes', 'No']

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (open) {
    return (
      <div ref={dropRef} style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: -4, left: 0, zIndex: 50, background: 'white', border: '1px solid #e7e5e4', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 180, overflow: 'hidden' }}>
          {opts.map(o => (
            <div key={o} onClick={() => { onChange(field, o); setOpen(false) }}
              style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: val === o ? 600 : 400, color: val === o ? '#ed148c' : '#1c1917', backgroundColor: val === o ? '#ed148c10' : 'white' }}
              onMouseEnter={e => { if (val !== o) e.target.style.backgroundColor = '#fdf2f8' }}
              onMouseLeave={e => { e.target.style.backgroundColor = val === o ? '#ed148c10' : 'white' }}
            >{val === o ? '✓ ' : ''}{o}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <span
      onClick={() => setOpen(true)}
      style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: display ? '#1c1917' : '#a8a29e', borderBottom: display ? 'none' : '1px dashed #d6d3d1', paddingBottom: display ? 0 : 1, fontStyle: display ? 'normal' : 'italic' }}
      title="Click to select"
    >
      {display || (placeholder || 'Select...')}
    </span>
  )
}

// ── Section Components for the PDF render ──

function SheetHeader({ title, journey, color }) {
  // Find case manager from assigned_to email
  const cmEmail = journey.assigned_to
  const caseManager = mockUsers.find(u => u.email === cmEmail) || { name: 'ABC Surrogacy', email: 'info@abcsurrogacy.com', phone: '(818) 321-9329' }

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Top row: logo left, title center, case manager right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        {/* Logo — left */}
        <img src="/abc-logo.png" alt="ABC Surrogacy" style={{ height: 56, flexShrink: 0 }} crossOrigin="anonymous" />
        {/* Title — center */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#283693', margin: 0, letterSpacing: '0.3px', textAlign: 'center', flex: 1 }}>{title}</h1>
        {/* Case Manager — right */}
        <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 11, lineHeight: 1.7 }}>
          <div><span style={{ color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>Case Manager: </span><span style={{ color: '#44403c', fontWeight: 600 }}>{caseManager.name}</span></div>
          <div><span style={{ color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>Email: </span><span style={{ color: '#44403c' }}>{caseManager.email}</span></div>
          {caseManager.phone && <div><span style={{ color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.5px' }}>Phone: </span><span style={{ color: '#44403c' }}>{caseManager.phone}</span></div>}
        </div>
      </div>
      {/* Divider */}
      <div style={{ height: 1.5, background: '#283693', borderRadius: 1 }} />
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

function ConfidentialFooter() {
  return (
    <div style={{ marginTop: 32, paddingTop: 14, borderTop: '1.5px solid #283693', textAlign: 'center' }}>
      <img src="/abc-website-banner.png" alt="abcsurrogacy.com" style={{ height: 22, margin: '0 auto 6px' }} crossOrigin="anonymous" />
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
  const ga = gcCase?.answers || {}
  const jd = journey.journey_data || {}
  const pd = profileData || {}
  const personal = pd.personal || {}
  const employment = pd.employment || {}
  const pregnancyHistory = pd.pregnancyHistory || {}
  const color = '#283693'

  const pregnancies = pregnancyHistory.pregnancies || []
  const numPreg = parseInt(pregnancyHistory.numberOfPregnancies) || pregnancies.length
  const previousSurrogate = pregnancies.some(p => p.wasSurrogacy === 'Yes' || p.wasSurrogacy === true)

  const gcDob = gcCase?.dob || ga.dob || personal.dob

  return (
    <div ref={sheetRef} style={{ width: 816, padding: '48px 56px', backgroundColor: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1c1917', lineHeight: 1.5 }}>
      <SheetHeader title="Attorney Match Sheet" journey={journey} color={color} />

      {/* Intended Parents */}
      <PartyBanner color={color} icon={Users}>Intended Parents</PartyBanner>

      <PartyLabel color={color}>Intended Parent #1</PartyLabel>
      <InfoGrid items={[
        { label: 'Full Name', value: `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim() },
        { label: 'Date of Birth', value: `${formatDate(a.primaryDob)}${a.primaryDob ? ` (Age ${calcAge(a.primaryDob)})` : ''}` },
        { label: 'Email', value: ipCase?.email },
        { label: 'Phone', value: formatPhone(ipCase?.phone) },
      ]} />

      {(a.hasPartner === true || a.hasPartner === 'yes') && (
        <>
          <PartyLabel color={color}>Intended Parent #2</PartyLabel>
          <InfoGrid items={[
            { label: 'Full Name', value: `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() },
            { label: 'Date of Birth', value: `${formatDate(a.ip2Dob)}${a.ip2Dob ? ` (Age ${calcAge(a.ip2Dob)})` : ''}` },
            { label: 'Email', value: ipCase?.ip2Email },
            { label: 'Phone', value: formatPhone(ipCase?.ip2Phone) },
          ]} />
        </>
      )}

      <SectionTitle color={color} icon={FileText}>Demographics</SectionTitle>
      <InfoGrid items={[
        { label: 'Street Address', value: [a.street, a.street2].filter(Boolean).join(', '), span: 2 },
        { label: 'City', value: a.city },
        { label: 'State', value: a.stateProv },
        { label: 'Zip Code', value: a.zipCode },
        { label: 'Country', value: a.country || 'United States' },
      ]} />

      <SectionTitle color={color} icon={EmbryoIcon}>Embryo Creation</SectionTitle>
      <InfoGrid items={[
        { label: 'Sperm Contribution', editable: true, value: <EditableSelect field="spermContribution" msData={msData} onChange={onChange} options={["IF's Sperm", "Anonymous Donor Sperm", "Known Sperm Donor", "Embryo Adoption"]} placeholder="Select..." value={ipCase?.usingSpermDonor ? 'Anonymous Donor Sperm' : "IF's Sperm"} /> },
        { label: 'Egg Source', editable: true, value: <EditableSelect field="eggSource" msData={msData} onChange={onChange} options={["IM's Eggs", "Anonymous Egg Donor", "Known Egg Donor", "Embryo Adoption"]} placeholder="Select..." value={ipCase?.usingEggDonor ? 'Anonymous Egg Donor' : "IM's Eggs"} /> },
      ]} />

      <SectionTitle color={color} icon={Scale}>Intended Parents' Attorney</SectionTitle>
      <InfoGrid items={[
        { label: 'Attorney Name', editable: true, value: <EditableValue field="ipAttorneyName" msData={msData} onChange={onChange} placeholder="Enter attorney name..." /> },
        { label: 'Attorney Email', editable: true, value: <EditableValue field="ipAttorneyEmail" msData={msData} onChange={onChange} placeholder="Enter attorney email..." /> },
      ]} />

      {/* Surrogate — page 2 */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 1, margin: 0 }} className="pdf-page-break" />
      <PartyBanner color="#ed148c" icon={User}>Surrogate</PartyBanner>

      <SectionTitle color="#ed148c" icon={FileText}>Demographics</SectionTitle>
      <InfoGrid items={[
        { label: 'Full Name', value: gcCase?.name },
        { label: 'Date of Birth', value: `${formatDate(gcDob)}${gcDob ? ` (Age ${calcAge(gcDob)})` : ''}` },
        { label: 'Email', value: gcCase?.email },
        { label: 'Phone', value: formatPhone(gcCase?.phone) },
        { label: 'Street Address', value: personal.streetAddress || ga.streetAddress, span: 2 },
        { label: 'City', value: ga.city || personal.city },
        { label: 'State', value: ga.state || personal.state },
        { label: 'Zip Code', value: personal.zipCode || ga.zipCode },
        { label: 'Country', value: 'United States' },
        { label: 'Relationship Status', value: ga.maritalStatus || personal.maritalStatus || '—' },
        { label: 'US Citizen', value: yesNo(ga.usCitizen || personal.usCitizen) },
      ]} />

      {(ga.maritalStatus === 'Married' || personal.maritalStatus === 'Married' || ga.maritalStatus === 'married' || ga.maritalStatus === 'Domestic Partnership') && (
        <>
          <SectionTitle color="#ed148c" icon={Users}>Spouse / Partner</SectionTitle>
          <InfoGrid items={[
            { label: 'Full Name', value: [personal.partnerFirstName || ga.partnerFirstName, personal.partnerLastName || ga.partnerLastName].filter(Boolean).join(' ') || personal.partnerName || '—' },
            { label: 'Date of Birth', value: (() => { const dob = personal.partnerDob || ga.partnerDob; return `${formatDate(dob)}${dob && calcAge(dob) !== null ? ` (Age ${calcAge(dob)})` : ''}` })() },
            { label: 'Email', value: personal.partnerEmail || ga.partnerEmail || '—' },
            { label: 'Phone', value: formatPhone(personal.partnerPhone || ga.partnerPhone) },
          ]} />
        </>
      )}

      <SectionTitle color="#ed148c" icon={Heart}>Surrogate Details</SectionTitle>
      <InfoGrid items={[
        { label: 'Surrogate Friendly Insurance', editable: true, value: <EditableSelect field="surrogacyFriendlyInsurance" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Insurance Carrier', editable: true, value: <EditableValue field="insuranceCarrier" msData={msData} onChange={onChange} placeholder="Enter carrier name..." /> },
        { label: 'IP to Pay Monthly Premium', editable: true, value: <EditableSelect field="ipPayPremium" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Previously Been a Surrogate', value: previousSurrogate ? 'Yes' : 'No' },
        { label: '# of Children (Live Births)', value: pregnancies.filter(p => p.outcome === 'Live Birth').length || '—' },
        { label: 'Surrogacy Type', editable: true, value: <EditableSelect field="surrogacyType" msData={msData} onChange={onChange} options={['Gestational Surrogacy', 'Traditional Surrogacy']} placeholder="Select type..." value="Gestational Surrogacy" /> },
      ]} />

      <SectionTitle color="#ed148c" icon={Scale}>Surrogate's Attorney</SectionTitle>
      <InfoGrid items={[
        { label: 'Attorney Name', editable: true, value: <EditableValue field="gcAttorneyName" msData={msData} onChange={onChange} placeholder="Enter attorney name..." /> },
        { label: 'Attorney Email', editable: true, value: <EditableValue field="gcAttorneyEmail" msData={msData} onChange={onChange} placeholder="Enter attorney email..." /> },
      ]} />

      {/* Journey Details — page 3 */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 1, margin: 0 }} className="pdf-page-break" />
      <PartyBanner color="#723bb4" icon={FileText}>Journey Details</PartyBanner>
      <InfoGrid items={[
        { label: 'Escrow Account Holder', editable: true, value: <EditableValue field="escrowCompany" msData={msData} onChange={onChange} placeholder="SeedTrust Escrow, LLC" value="SeedTrust Escrow, LLC" /> },
        { label: 'Escrow to Be Funded', editable: true, value: <EditableValue field="escrowFunding" msData={msData} onChange={onChange} placeholder="Enter amount..." /> },
        { label: 'Minimum Balance Requirement', editable: true, value: <EditableValue field="escrowMinimum" msData={msData} onChange={onChange} placeholder="$10,000" value={fmtCurrency(jd.escrowMin)} /> },
        { label: 'Lost Wages Entitled', value: yesNo(jd.lostWages) },
        { label: "Surrogate's Employment Status", value: employment.currentlyEmployed ? `Employed — ${employment.occupation || ''}` : 'Not Employed' },
        { label: "Spouse/Partner's Employment Status", value: employment.partnerOccupation ? `Employed — ${employment.partnerOccupation}` : '—' },
        { label: 'Amnio / Invasive Testing', editable: true, value: <EditableSelect field="amnioTesting" msData={msData} onChange={onChange} options={['Only if Medically Necessary', 'Yes', 'No']} placeholder="Select..." /> },
        { label: 'Number of Fetuses to Carry', editable: true, value: <EditableValue field="numberOfFetuses" msData={msData} onChange={onChange} placeholder="1" /> },
        { label: 'Willing to Carry Twins (Split)', editable: true, value: <EditableSelect field="willingTwins" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Abort/Reduce for Medical Reason', editable: true, value: <EditableSelect field="abortReduce" msData={msData} onChange={onChange} options={['Any medical reason', 'Life-threatening only', 'No']} placeholder="Select..." /> },
        { label: 'Psych Counseling', editable: true, value: <EditableSelect field="psychCounseling" msData={msData} onChange={onChange} options={['Required', 'Allowed', 'Not Required']} placeholder="Select..." /> },
        { label: 'Psych Can Be Done Over the Phone', editable: true, value: <EditableSelect field="psychOverPhone" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Max Counseling Sessions', editable: true, value: <EditableValue field="maxCounselingSessions" msData={msData} onChange={onChange} placeholder="15" value="15" /> },
        { label: 'Support Group Meetings Required', editable: true, value: <EditableSelect field="supportGroupMeetings" msData={msData} onChange={onChange} placeholder="Select..." /> },
      ]} />

      <SectionTitle color="#723bb4" icon={Stethoscope}>IVF Physician</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'Name of IVF Physician', value: ipCase?.reDoctorName || '—' },
        { label: 'City, State of IVF Physician', editable: true, value: <EditableValue field="reClinicLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." /> },
      ]} />

      <SectionTitle color="#723bb4" icon={Hospital}>Delivery Hospital</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'Hospital Name', editable: true, value: <EditableValue field="deliveryHospital" msData={msData} onChange={onChange} placeholder="Enter hospital name..." value={jd.hospital} /> },
        { label: 'City, State', editable: true, value: <EditableValue field="deliveryHospitalLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." /> },
      ]} />

      <ConfidentialFooter />
    </div>
  )
}

// ── Clinic Match Sheet ──

function ClinicSheet({ journey, gcCase, ipCase, profileData, sheetRef, msData, onChange }) {
  const a = ipCase?.answers || {}
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

      {/* IVF / Clinic Info */}
      <PartyBanner color={color} icon={Stethoscope}>IVF Details</PartyBanner>
      <InfoGrid items={[
        { label: 'RE Doctor / Clinic', value: ipCase?.reDoctorName || '—' },
        { label: 'Clinic Location', editable: true, value: <EditableValue field="reClinicLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." /> },
        { label: 'Frozen Embryos', value: yesNo(ipCase?.hasFrozenEmbryos) },
        { label: 'Embryo Details', value: ipCase?.frozenEmbryoDetails || '—' },
        { label: 'Egg Source', value: ipCase?.usingEggDonor ? 'Donor Egg' : "IP's Eggs" },
        { label: 'Sperm Source', value: ipCase?.usingSpermDonor ? 'Donor Sperm' : "IP's Sperm" },
      ]} />

      {/* Intended Parents */}
      <PartyBanner color="#283693" icon={Users}>Intended Parents</PartyBanner>

      <PartyLabel color="#283693">Intended Parent #1</PartyLabel>
      <PartyName name={`${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()} />
      <InfoGrid items={[
        { label: 'Email', value: ipCase?.email },
        { label: 'Phone', value: formatPhone(ipCase?.phone) },
        { label: 'Date of Birth', value: formatDate(a.primaryDob) },
        { label: 'Location', value: [a.city, a.stateProv].filter(Boolean).join(', ') },
        ...(a.hasPartner === true || a.hasPartner === 'yes' ? [
          { label: 'IP 2 Name', value: `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() },
          { label: 'IP 2 DOB', value: formatDate(a.ip2Dob) },
          { label: 'IP 2 Email', value: ipCase?.ip2Email },
          { label: 'IP 2 Phone', value: formatPhone(ipCase?.ip2Phone) },
        ] : []),
      ]} />

      {/* Surrogate — detailed medical */}
      <PartyBanner color="#ed148c" icon={User}>Surrogate</PartyBanner>

      <PartyName name={gcCase?.name} />
      <InfoGrid items={[
        { label: 'Date of Birth', value: `${formatDate(gcDob)}${gcDob ? ` (Age ${calcAge(gcDob)})` : ''}` },
        { label: 'Blood Type', value: personal.bloodType || '—' },
        { label: 'Height', value: `${ga.heightFt || personal.heightFt || '—'}'${ga.heightIn || personal.heightIn || '0'}"` },
        { label: 'Weight', value: `${ga.weightLbs || personal.weight || '—'} lbs` },
        { label: 'BMI', value: gcCase?.bmi || '—' },
        { label: 'Marital Status', value: ga.maritalStatus || personal.maritalStatus || '—' },
        { label: 'Email', value: gcCase?.email },
        { label: 'Phone', value: formatPhone(gcCase?.phone) },
        { label: 'City / State', value: [ga.city || personal.city, ga.state || personal.state].filter(Boolean).join(', ') },
        { label: 'US Citizen', value: yesNo(ga.usCitizen || personal.usCitizen) },
      ]} />

      {/* Pregnancy History */}
      <SectionTitle color="#ed148c" icon={EmbryoIcon}>Pregnancy History</SectionTitle>
      <InfoGrid items={[
        { label: 'Total Pregnancies', value: numPreg },
        { label: 'Previous Surrogacies', value: pregnancies.filter(p => p.wasSurrogacy === 'Yes' || p.wasSurrogacy === true).length },
        { label: 'C-Sections', value: pregnancies.filter(p => p.deliveryType === 'C-Section').length },
        { label: 'Vaginal Deliveries', value: pregnancies.filter(p => p.deliveryType === 'Vaginal' || p.deliveryType === 'vaginal').length },
      ]} />

      {pregnancies.length > 0 && (
        <div style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#fafaf9' }}>
                {['#', 'Year', 'Outcome', 'Delivery', 'Surrogacy', 'Complications'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pregnancies.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e7e5e4' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px' }}>{p.dob ? new Date(p.dob + 'T00:00:00').getFullYear() : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{p.outcome || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{p.deliveryType || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{p.wasSurrogacy === 'Yes' || p.wasSurrogacy === true ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 10 }}>{p.complications || p.complicationsExplanation || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fertility & Health */}
      <SectionTitle color="#ed148c" icon={Heart}>Fertility & Health</SectionTitle>
      <InfoGrid items={[
        { label: 'Last Period', value: formatDate(fertility.lastPeriod) },
        { label: 'Cycle Length', value: fertility.cycleLength ? `${fertility.cycleLength} days` : '—' },
        { label: 'Contraceptive Method', value: fertility.contraceptiveMethod || '—' },
        { label: 'Breastfeeding', value: yesNo(fertility.breastfeeding) },
        { label: 'Nearest NICU', value: fertility.nearestNICU || '—' },
        { label: 'Willing to Travel for NICU', value: yesNo(fertility.willingToTravelNICU) },
        { label: 'Current Medications', value: health.currentMeds || 'None' },
        { label: 'Allergies', value: health.allergies || 'None' },
        { label: 'Last Physical', value: formatDate(health.lastPhysical) },
        { label: 'Last Pap', value: formatDate(health.lastPap) },
        { label: 'COVID Vaccinated', value: yesNo(health.covidVaccine) },
        { label: 'Open to Vaccinations', value: yesNo(health.openToVaccinations) },
      ]} />

      {/* Insurance */}
      <SectionTitle color="#ed148c" icon={Shield}>Insurance</SectionTitle>
      <InfoGrid items={[
        { label: 'Has Health Insurance', value: yesNo(employment.healthInsurance) },
        { label: 'Insurance Type', value: employment.insuranceType || '—' },
        { label: 'Surrogacy-Friendly Policy', editable: true, value: <EditableSelect field="surrogacyFriendlyInsurance" msData={msData} onChange={onChange} placeholder="Select..." /> },
        { label: 'Insurance Carrier', editable: true, value: <EditableValue field="insuranceCarrier" msData={msData} onChange={onChange} placeholder="Enter carrier..." /> },
      ]} />

      <ConfidentialFooter />
    </div>
  )
}

// ── Escrow Match Sheet ──

function EscrowSheet({ journey, gcCase, ipCase, profileData, sheetRef, msData, onChange }) {
  const a = ipCase?.answers || {}
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
      <PartyBanner color="#283693" icon={Users}>Intended Parents</PartyBanner>

      <PartyLabel color="#283693">Intended Parent #1</PartyLabel>
      <InfoGrid items={[
        { label: 'Full Name', value: `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim() },
        { label: 'Date of Birth', value: `${formatDate(a.primaryDob)}${a.primaryDob ? ` (Age ${calcAge(a.primaryDob)})` : ''}` },
        { label: 'Email', value: ipCase?.email },
        { label: 'Phone', value: formatPhone(ipCase?.phone) },
      ]} />

      {(a.hasPartner === true || a.hasPartner === 'yes') && (
        <>
          <PartyLabel color="#283693">Intended Parent #2</PartyLabel>
          <InfoGrid items={[
            { label: 'Full Name', value: `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() },
            { label: 'Date of Birth', value: `${formatDate(a.ip2Dob)}${a.ip2Dob ? ` (Age ${calcAge(a.ip2Dob)})` : ''}` },
            { label: 'Email', value: ipCase?.ip2Email },
            { label: 'Phone', value: formatPhone(ipCase?.ip2Phone) },
          ]} />
        </>
      )}

      {/* Surrogate */}
      <PartyBanner color="#ed148c" icon={User}>Surrogate</PartyBanner>
      <InfoGrid items={[
        { label: 'Full Name', value: gcCase?.name },
        { label: 'Date of Birth', value: `${formatDate(gcDob)}${gcDob ? ` (Age ${calcAge(gcDob)})` : ''}` },
        { label: 'Email', value: gcCase?.email },
        { label: 'Phone', value: formatPhone(gcCase?.phone) },
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

  function getFileName() {
    const sheetType = SHEET_TYPES.find(s => s.id === activeSheet)
    return `${sheetType?.label || 'Match Sheet'} - ${gcCase?.name || 'GC'} & ${ipCase?.names || 'IP'}.pdf`
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
      const breakOffsets = pageBreaks.map(pb => pb.offsetTop)
      pageBreaks.forEach(pb => pb.style.display = 'none')
      const sections = []
      let prevTop = 0
      for (const offset of breakOffsets) { sections.push({ top: prevTop, height: offset - prevTop }); prevTop = offset }
      sections.push({ top: prevTop, height: container.scrollHeight - prevTop })
      const fullCanvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const renderScale = fullCanvas.width / container.offsetWidth
      const usableWidth = pageWidth - margin * 2
      for (let i = 0; i < sections.length; i++) {
        if (i > 0) pdf.addPage()
        const s = sections[i]
        const srcY = Math.round(s.top * renderScale)
        const srcH = Math.round(s.height * renderScale)
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = fullCanvas.width
        cropCanvas.height = srcH
        const ctx = cropCanvas.getContext('2d')
        ctx.drawImage(fullCanvas, 0, srcY, fullCanvas.width, srcH, 0, 0, cropCanvas.width, srcH)
        const imgData = cropCanvas.toDataURL('image/jpeg', 0.95)
        const imgHeight = (srcH * usableWidth) / fullCanvas.width
        pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, imgHeight)
      }
      pageBreaks.forEach(pb => pb.style.display = '')
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

  async function sendMatchSheet() {
    setGenerating(true)
    try {
      const pdf = await generatePDF()
      if (!pdf) return
      const fileName = getFileName()
      const pdfBase64 = pdf.output('datauristring').split(',')[1]

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

      const attachment = { filename: fileName, mimeType: 'application/pdf', base64Data: pdfBase64 }

      if (activeSheet === 'attorney') {
        // Show picker for IP Attorney vs GC Attorney
        setPendingPdf(attachment)
        setAttorneyPickerOpen(true)
      } else if (activeSheet === 'escrow') {
        // Escrow: To = SeedTrust, CC = IPs
        const ipEmails = [ipCase?.email, ipCase?.ip2Email].filter(Boolean).join(', ')
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
        const body = `<p>Hello,</p><p>My name is ${adminName}, and I am the Case Manager working with IP's: ${ipNames} and GS: ${gcName}. I am looking forward to working with you all on this case.</p><p>Attached, please find the Match Sheet. If you need anything else to proceed please let me know.</p><p>Please let me know when you anticipate being able to bring her in for a medical evaluation.</p><p>If you could let me know what your medical evaluation process includes that would be great. For the group psych eval, are you fine using one of our therapists? I have attached ${gcName?.split(' ')[0] || 'the surrogate'}'s Psych Report.</p>`
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

  function sendAttorneySheet(recipient) {
    const jd = journey?.journey_data || {}
    const ipAnswers = ipCase?.answers || {}
    const ip1Name = `${ipAnswers.primaryFirstName || ''} ${ipAnswers.primaryLastName || ''}`.trim()
    const ip2Name = (ipAnswers.hasPartner === true || ipAnswers.hasPartner === 'yes') ? `${ipAnswers.ip2FirstName || ''} ${ipAnswers.ip2LastName || ''}`.trim() : ''
    const ipNames = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name
    const toEmail = recipient === 'ip' ? jd.ipAttorneyEmail : jd.gcAttorneyEmail
    const attorneyName = recipient === 'ip' ? jd.ipAttorneyName : jd.gcAttorneyName
    openDraft({
      to: toEmail || '',
      subject: `Attorney Match Sheet - ${ipNames} with GC ${gcCase?.name || ''}`,
      body: '',
      userId: currentUser?.id,
      caseId: journey.id,
      caseType: 'journey',
      attachments: pendingPdf ? [pendingPdf] : [],
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
                  <Eye className="size-3.5" /> Preview & Download
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
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={saveToDocuments} disabled={generating}>
                {generating ? <Clock className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save to Documents
              </Button>
              <Button size="sm" className="gap-1.5 rounded-full" style={{ backgroundColor: SHEET_TYPES.find(s => s.id === activeSheet)?.color }} onClick={sendMatchSheet} disabled={generating}>
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

      {/* Attorney Picker Dialog */}
      <Dialog open={attorneyPickerOpen} onOpenChange={v => { if (!v) { setAttorneyPickerOpen(false); setPendingPdf(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="size-5 text-[#283693]" /> Send to which attorney?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <button onClick={() => sendAttorneySheet('ip')}
              className="w-full text-left rounded-xl border border-stone-200 px-4 py-3 hover:border-[#283693] hover:shadow-sm transition-all">
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
