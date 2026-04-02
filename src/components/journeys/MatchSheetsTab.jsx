import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText, Download, Eye, Printer, Scale, Stethoscope, DollarSign,
  User, Users, Baby, Heart, Shield, Briefcase, Clock, Pencil,
} from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { fetchSurrogateProfileByEmail } from '@/lib/db'

const SHEET_TYPES = [
  { id: 'attorney', label: 'Attorney Match Sheet', icon: Scale, color: '#283693', description: 'For legal counsel — IP & GC contact info, demographics, embryo creation, attorney details, and journey terms.' },
  { id: 'clinic', label: 'Clinic Match Sheet', icon: Stethoscope, color: '#9b2ea7', description: 'For RE / IVF clinic — medical history, pregnancy details, insurance, and transfer logistics.' },
  { id: 'escrow', label: 'Escrow Match Sheet', icon: DollarSign, color: '#10b981', description: 'For escrow company — compensation, payment terms, escrow funding, and employment details.' },
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch { return dateStr }
}

function formatPhone(phone) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  if (digits.length === 11) return `+${digits[0]} (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  return phone
}

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
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

// ── Section Components for the PDF render ──

function SheetHeader({ title, journey, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 20, borderBottom: `3px solid ${color}` }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color, margin: 0, letterSpacing: '-0.5px' }}>{title}</h1>
        <p style={{ fontSize: 12, color: '#78716c', marginTop: 4 }}>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <img src="/abc-logo.png" alt="ABC Surrogacy" style={{ height: 48, marginBottom: 4 }} crossOrigin="anonymous" />
        <p style={{ fontSize: 10, color: '#78716c', margin: 0 }}>Abundant Beginnings Company</p>
        <p style={{ fontSize: 10, color: '#78716c', margin: 0 }}>desiree@abcsurrogacy.com</p>
        <p style={{ fontSize: 10, color: '#78716c', margin: 0 }}>+1 (818) 321-9329</p>
      </div>
    </div>
  )
}

function SectionTitle({ children, color, icon: Icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 }}>
      {Icon && <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </div>}
      <h2 style={{ fontSize: 14, fontWeight: 700, color, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{children}</h2>
    </div>
  )
}

function InfoGrid({ items, columns = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1px', backgroundColor: '#e7e5e4', borderRadius: 12, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
      {items.filter(Boolean).map((item, i) => (
        <div key={i} style={{ backgroundColor: 'white', padding: '10px 16px', ...(item.span ? { gridColumn: `span ${item.span}` } : {}) }}>
          <div style={{ fontSize: 10, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>{item.label}</div>
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
    <p style={{ fontSize: 11, fontWeight: 600, color: color || '#a8a29e', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: 24, marginBottom: 4 }}>{children}</p>
  )
}

function PartyName({ name }) {
  return (
    <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', marginTop: 0, marginBottom: 10 }}>{name || '—'}</p>
  )
}

function ConfidentialFooter() {
  return (
    <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e7e5e4', fontSize: 9, color: '#a8a29e', textAlign: 'center' }}>
      Confidential — Abundant Beginnings Company — This document contains privileged information intended solely for the named recipient(s).
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
      <SectionTitle color={color} icon={Users}>Intended Parents</SectionTitle>

      <PartyLabel color={color}>Intended Parent #1</PartyLabel>
      <PartyName name={`${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()} />
      <InfoGrid items={[
        { label: 'Full Name', value: `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim() },
        { label: 'Date of Birth', value: `${formatDate(a.primaryDob)}${a.primaryDob ? ` (Age ${calcAge(a.primaryDob)})` : ''}` },
        { label: 'Email', value: ipCase?.email },
        { label: 'Phone', value: formatPhone(ipCase?.phone) },
      ]} />

      {(a.hasPartner === true || a.hasPartner === 'yes') && (
        <>
          <PartyLabel color={color}>Intended Parent #2</PartyLabel>
          <PartyName name={`${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim()} />
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

      <SectionTitle color="#9b2ea7" icon={Baby}>Embryo Creation</SectionTitle>
      <InfoGrid items={[
        { label: 'Sperm Contribution', value: ipCase?.usingSpermDonor ? 'Donor Sperm' : "IP's Sperm" },
        { label: 'Egg Source', value: ipCase?.usingEggDonor ? 'Donor Egg' : "IP's Eggs" },
        { label: 'Frozen Embryos', value: yesNo(ipCase?.hasFrozenEmbryos) },
        { label: 'Embryo Details', value: ipCase?.frozenEmbryoDetails },
      ]} />

      <SectionTitle color={color} icon={Scale}>Intended Parents' Attorney</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'Name and Email of Attorney', editable: true, value: <EditableValue field="ipAttorney" msData={msData} onChange={onChange} placeholder="Enter attorney name & email..." /> },
      ]} />

      {/* Surrogate */}
      <SectionTitle color="#ed148c" icon={User}>Surrogate</SectionTitle>

      <PartyLabel color="#ed148c">Gestational Carrier</PartyLabel>
      <PartyName name={gcCase?.name} />
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
      ]} />

      <SectionTitle color="#ed148c" icon={Heart}>Surrogate Details</SectionTitle>
      <InfoGrid items={[
        { label: 'Surrogate Friendly Insurance', editable: true, value: <EditableValue field="surrogacyFriendlyInsurance" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
        { label: 'Insurance Carrier', editable: true, value: <EditableValue field="insuranceCarrier" msData={msData} onChange={onChange} placeholder="Enter carrier name..." /> },
        { label: 'IP to Pay Monthly Premium', editable: true, value: <EditableValue field="ipPayPremium" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
        { label: 'Previously Been a Surrogate', value: previousSurrogate ? 'Yes' : 'No' },
        { label: 'Marital Status', value: ga.maritalStatus || personal.maritalStatus },
        { label: '# of Children Born To', value: numPreg || '—' },
        { label: 'Surrogacy Type', editable: true, value: <EditableValue field="surrogacyType" msData={msData} onChange={onChange} placeholder="Gestational Surrogacy" value="Gestational Surrogacy" /> },
        { label: 'US Citizen', value: yesNo(ga.usCitizen || personal.usCitizen) },
      ]} />

      {(ga.maritalStatus === 'Married' || personal.maritalStatus === 'Married' || ga.maritalStatus === 'married') && (
        <InfoGrid items={[
          { label: 'Spouse/Partner Name', value: [personal.partnerFirstName || ga.partnerFirstName, personal.partnerLastName || ga.partnerLastName].filter(Boolean).join(' ') || personal.partnerName },
          { label: 'Spouse/Partner DOB', value: formatDate(personal.partnerDob) },
          { label: 'Spouse/Partner Email', value: personal.partnerEmail },
          { label: 'Spouse/Partner Phone', value: formatPhone(personal.partnerPhone) },
        ]} />
      )}

      <SectionTitle color="#ed148c" icon={Scale}>Surrogate's Attorney</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'Name and Email of Attorney', editable: true, value: <EditableValue field="gcAttorney" msData={msData} onChange={onChange} placeholder="Enter attorney name & email..." /> },
      ]} />

      {/* Journey Details */}
      <SectionTitle color="#723bb4" icon={FileText}>Journey Details</SectionTitle>
      <InfoGrid items={[
        { label: 'Escrow Account Holder', editable: true, value: <EditableValue field="escrowCompany" msData={msData} onChange={onChange} placeholder="Enter escrow company..." /> },
        { label: 'Escrow to Be Funded', editable: true, value: <EditableValue field="escrowFunding" msData={msData} onChange={onChange} placeholder="Enter amount..." /> },
        { label: 'Minimum Balance Requirement', editable: true, value: <EditableValue field="escrowMinimum" msData={msData} onChange={onChange} placeholder="$10,000" value={fmtCurrency(jd.escrowMin)} /> },
        { label: 'Lost Wages Entitled', value: yesNo(jd.lostWages) },
        { label: "Surrogate's Employment Status", value: employment.currentlyEmployed ? `Employed — ${employment.occupation || ''}` : 'Not Employed' },
        { label: "Spouse/Partner's Employment Status", value: employment.partnerOccupation ? `Employed — ${employment.partnerOccupation}` : '—' },
        { label: 'Amnio / Invasive Testing', editable: true, value: <EditableValue field="amnioTesting" msData={msData} onChange={onChange} placeholder="Only if Medically Necessary" /> },
        { label: 'Number of Fetuses to Carry', editable: true, value: <EditableValue field="numberOfFetuses" msData={msData} onChange={onChange} placeholder="1" /> },
        { label: 'Willing to Carry Twins (Split)', editable: true, value: <EditableValue field="willingTwins" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
        { label: 'Abort/Reduce for Medical Reason', editable: true, value: <EditableValue field="abortReduce" msData={msData} onChange={onChange} placeholder="Any medical reason" /> },
        { label: 'Psych Counseling', editable: true, value: <EditableValue field="psychCounseling" msData={msData} onChange={onChange} placeholder="Required / Allowed" /> },
        { label: 'Can Do Over Phone', editable: true, value: <EditableValue field="psychOverPhone" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
        { label: 'Max Counseling Sessions', editable: true, value: <EditableValue field="maxCounselingSessions" msData={msData} onChange={onChange} placeholder="15" /> },
        { label: 'Support Group Meetings Required', editable: true, value: <EditableValue field="supportGroupMeetings" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
      ]} />

      <SectionTitle color="#723bb4" icon={Stethoscope}>IVF Physician</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'Name of IVF Physician', value: ipCase?.reDoctorName || '—' },
        { label: 'City, State of IVF Physician', editable: true, value: <EditableValue field="reClinicLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." /> },
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
      <SectionTitle color={color} icon={Stethoscope}>IVF Details</SectionTitle>
      <InfoGrid items={[
        { label: 'RE Doctor / Clinic', value: ipCase?.reDoctorName || '—' },
        { label: 'Clinic Location', editable: true, value: <EditableValue field="reClinicLocation" msData={msData} onChange={onChange} placeholder="Enter city, state..." /> },
        { label: 'Frozen Embryos', value: yesNo(ipCase?.hasFrozenEmbryos) },
        { label: 'Embryo Details', value: ipCase?.frozenEmbryoDetails || '—' },
        { label: 'Egg Source', value: ipCase?.usingEggDonor ? 'Donor Egg' : "IP's Eggs" },
        { label: 'Sperm Source', value: ipCase?.usingSpermDonor ? 'Donor Sperm' : "IP's Sperm" },
      ]} />

      {/* Intended Parents */}
      <SectionTitle color="#283693" icon={Users}>Intended Parents</SectionTitle>

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
      <SectionTitle color="#ed148c" icon={User}>Surrogate</SectionTitle>

      <PartyLabel color="#ed148c">Gestational Carrier</PartyLabel>
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
      <SectionTitle color="#ed148c" icon={Baby}>Pregnancy History</SectionTitle>
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
        { label: 'Surrogacy-Friendly Policy', editable: true, value: <EditableValue field="surrogacyFriendlyInsurance" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
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
  const employment = pd.employment || {}
  const hopesWishes = pd.hopesWishes || {}
  const color = '#10b981'
  const gcDob = gcCase?.dob || ga.dob || personal.dob

  return (
    <div ref={sheetRef} style={{ width: 816, padding: '48px 56px', backgroundColor: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1c1917', lineHeight: 1.5 }}>
      <SheetHeader title="Escrow Match Sheet" journey={journey} color={color} />

      {/* Escrow Details */}
      <SectionTitle color={color} icon={DollarSign}>Escrow Details</SectionTitle>
      <InfoGrid items={[
        { label: 'Escrow Account Holder', editable: true, value: <EditableValue field="escrowCompany" msData={msData} onChange={onChange} placeholder="Enter escrow company..." /> },
        { label: 'Escrow to Be Funded', editable: true, value: <EditableValue field="escrowFunding" msData={msData} onChange={onChange} placeholder="Enter amount..." /> },
        { label: 'Minimum Balance Requirement', editable: true, value: <EditableValue field="escrowMinimum" msData={msData} onChange={onChange} placeholder="$10,000" value={fmtCurrency(jd.escrowMin)} /> },
        { label: 'Match Date', value: formatDate(journey.created_at) },
      ]} />

      {/* Compensation */}
      <SectionTitle color={color} icon={Briefcase}>Compensation & Terms</SectionTitle>
      <InfoGrid items={[
        { label: 'Base Compensation', editable: true, value: <EditableValue field="baseCompensation" msData={msData} onChange={onChange} placeholder="Enter amount..." value={hopesWishes.desiredCompensation} /> },
        { label: 'Lost Wages Entitled', value: yesNo(jd.lostWages) },
        { label: 'Pumping Compensation', value: yesNo(jd.pumping) },
        { label: 'Number of Fetuses', editable: true, value: <EditableValue field="numberOfFetuses" msData={msData} onChange={onChange} placeholder="1" /> },
        { label: 'Willing to Carry Twins', editable: true, value: <EditableValue field="willingTwins" msData={msData} onChange={onChange} placeholder="Yes / No" /> },
        { label: 'Amnio / Invasive Testing', editable: true, value: <EditableValue field="amnioTesting" msData={msData} onChange={onChange} placeholder="Only if Medically Necessary" /> },
        { label: 'Psych Counseling', editable: true, value: <EditableValue field="psychCounseling" msData={msData} onChange={onChange} placeholder="Required / Allowed" /> },
        { label: 'Max Counseling Sessions', editable: true, value: <EditableValue field="maxCounselingSessions" msData={msData} onChange={onChange} placeholder="15" /> },
      ]} />

      {/* Intended Parents */}
      <SectionTitle color="#283693" icon={Users}>Intended Parents</SectionTitle>
      <PartyLabel color="#283693">Intended Parent #1</PartyLabel>
      <PartyName name={`${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()} />
      <InfoGrid items={[
        { label: 'Email', value: ipCase?.email },
        { label: 'Phone', value: formatPhone(ipCase?.phone) },
        { label: 'Location', value: [a.city, a.stateProv].filter(Boolean).join(', ') },
        { label: 'Country', value: a.country || 'United States' },
        ...(a.hasPartner === true || a.hasPartner === 'yes' ? [
          { label: 'IP 2 Name', value: `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() },
          { label: 'IP 2 Email', value: ipCase?.ip2Email },
        ] : []),
      ]} />

      {/* Surrogate */}
      <SectionTitle color="#ed148c" icon={User}>Surrogate</SectionTitle>
      <PartyLabel color="#ed148c">Gestational Carrier</PartyLabel>
      <PartyName name={gcCase?.name} />
      <InfoGrid items={[
        { label: 'Date of Birth', value: formatDate(gcDob) },
        { label: 'Email', value: gcCase?.email },
        { label: 'Phone', value: formatPhone(gcCase?.phone) },
        { label: 'Marital Status', value: ga.maritalStatus || personal.maritalStatus || '—' },
        { label: 'Address', value: [personal.streetAddress || ga.streetAddress, ga.city || personal.city, ga.state || personal.state].filter(Boolean).join(', '), span: 2 },
        { label: 'US Citizen', value: yesNo(ga.usCitizen || personal.usCitizen) },
        { label: '# Children', value: parseInt(pd.pregnancyHistory?.numberOfPregnancies) || '—' },
      ]} />

      {/* Employment */}
      <SectionTitle color="#ed148c" icon={Briefcase}>Employment Details</SectionTitle>
      <InfoGrid items={[
        { label: 'Currently Employed', value: yesNo(employment.currentlyEmployed) },
        { label: 'Occupation', value: employment.occupation || '—' },
        { label: 'Weekly Income', value: employment.weeklyIncome ? `$${employment.weeklyIncome}` : '—' },
        { label: 'Hourly Rate', value: employment.hourlyRate ? `$${employment.hourlyRate}/hr` : '—' },
        { label: 'Spouse/Partner Employed', value: employment.partnerOccupation ? 'Yes' : '—' },
        { label: 'Partner Occupation', value: employment.partnerOccupation || '—' },
        { label: 'Partner Weekly Income', value: employment.partnerWeeklyIncome ? `$${employment.partnerWeeklyIncome}` : '—' },
        { label: 'Government Assistance', value: yesNo(employment.governmentAssistance) },
      ]} />

      {/* Attorneys */}
      <SectionTitle color="#723bb4" icon={Scale}>Legal</SectionTitle>
      <InfoGrid columns={1} items={[
        { label: 'IP Attorney', editable: true, value: <EditableValue field="ipAttorney" msData={msData} onChange={onChange} placeholder="Enter attorney name & email..." /> },
        { label: 'GC Attorney', editable: true, value: <EditableValue field="gcAttorney" msData={msData} onChange={onChange} placeholder="Enter attorney name & email..." /> },
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

  async function downloadPDF() {
    if (!sheetRef.current) return
    setGenerating(true)
    try {
      // Save data first
      await saveMatchSheetData()

      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF('p', 'pt', 'letter')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const sheetType = SHEET_TYPES.find(s => s.id === activeSheet)
      const fileName = `${sheetType?.label || 'Match Sheet'} - ${gcCase?.name || 'GC'} & ${ipCase?.names || 'IP'}.pdf`
      pdf.save(fileName)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setGenerating(false)
    }
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
              <Button size="sm" className="gap-1.5 rounded-full" style={{ backgroundColor: SHEET_TYPES.find(s => s.id === activeSheet)?.color }} onClick={downloadPDF} disabled={generating}>
                {generating ? <Clock className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                {generating ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-stone-400 flex items-center gap-1.5">
            <Pencil className="size-3" /> Click any <span className="italic text-stone-500 border-b border-dashed border-stone-300">dashed underline</span> field to enter or edit information. Changes are saved when you download.
          </p>

          {/* Preview Container */}
          <div className="rounded-2xl border border-stone-200 bg-stone-100 p-6 overflow-x-auto">
            <div className="mx-auto shadow-2xl rounded-lg overflow-hidden" style={{ width: 816 }}>
              <SheetComponent journey={journey} gcCase={gcCase} ipCase={ipCase} profileData={profileData} sheetRef={sheetRef} msData={msData} onChange={handleFieldChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
