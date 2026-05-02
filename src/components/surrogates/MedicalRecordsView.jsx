import { useState, useMemo } from 'react'
import { Check, X, Pencil, Trash2, Phone as PhoneIcon, Printer, Mail as MailIcon, Plus, ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Stacked-list medical records UI. Each record is a full-width card. Cards
 * collapse by default once the record reaches a terminal status (Records
 * Complete / Already Collected / Skip); otherwise expanded. Click the card
 * header to toggle.
 *
 * Logging is inline: an always-visible "next log" row at the bottom of the
 * history takes [Status select] [Date] [Note] [+ Log]. Pick a status, type
 * an optional note, click + → log appended and current status updated.
 *
 * Status ids: `complete` and `na` reused from legacy tracking shape so
 * existing data is interpretable.
 */

const STATUS_PILLS = [
  { id: 'faxed_request',              label: 'Faxed Request' },
  { id: 'refaxed_request',            label: 'Refaxed Request' },
  { id: 'confirmed_fax_received',     label: 'Confirmed Fax Received' },
  { id: 'followed_up',                label: 'Followed Up' },
  { id: 'records_sent_by_mail',       label: 'Records Sent by Mail' },
  { id: 'fax_received_reviewing',     label: 'Fax Received - Reviewing' },
  { id: 'partial_records_incomplete', label: 'Partial Records (Incomplete)' },
  { id: 'partial_records_complete',   label: 'Partial Records (Complete)' },
  { id: 'complete',                   label: 'Records Complete' },
  { id: 'already_collected',          label: 'Already Collected' },
  { id: 'na',                         label: 'Skip' },
]

// Statuses that count as "done" for the progress bar and trigger auto-collapse.
// Partial Records (Complete) is treated as done since it means we've collected
// everything we're going to collect from this provider.
const TERMINAL_STATUSES = new Set(['complete', 'na', 'already_collected', 'partial_records_complete'])

// Color buckets — each status maps to a visual state so admins can scan the
// records list and immediately see which ones need follow-up.
//   yellow → request sent, waiting on provider
//   blue   → response received, in review
//   green  → fully done (records in hand, or already collected)
//   gray   → skipped (not applicable)
//   white  → not started yet
const YELLOW_STATUSES = new Set(['faxed_request', 'refaxed_request', 'records_sent_by_mail', 'followed_up'])
const BLUE_STATUSES   = new Set(['confirmed_fax_received', 'fax_received_reviewing', 'partial_records_incomplete'])
const GREEN_STATUSES  = new Set(['complete', 'already_collected', 'partial_records_complete'])
const GRAY_STATUSES   = new Set(['na'])

function statusColors(status) {
  if (GRAY_STATUSES.has(status))   return { card: 'bg-stone-100/60 border-stone-200',   badge: 'bg-stone-200 text-stone-600' }
  if (GREEN_STATUSES.has(status))  return { card: 'bg-emerald-50/50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' }
  if (BLUE_STATUSES.has(status))   return { card: 'bg-sky-50/60 border-sky-200',         badge: 'bg-sky-100 text-sky-700' }
  if (YELLOW_STATUSES.has(status)) return { card: 'bg-amber-50/60 border-amber-200',     badge: 'bg-amber-100 text-amber-800' }
  return { card: 'bg-white border-stone-200', badge: 'bg-stone-100 text-stone-500' }
}

function formatLogDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

// "Julie Stromwall" → "JS", "Desiree Melchiori" → "DM"; falls back to first
// 2 chars uppercased if there's only one word.
function initialsOf(name) {
  if (!name) return '—'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const LEGACY_LABELS = {
  not_started:         'Not Started',
  requested:           'Requested',
  fax_received:        'Fax Received',
  received:            'Received',
  incomplete_resubmit: 'Incomplete — Needs Resubmission',
}

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDatePart(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function statusLabel(id) {
  return STATUS_PILLS.find(p => p.id === id)?.label || LEGACY_LABELS[id] || (id || '').replace(/_/g, ' ')
}

export default function MedicalRecordsView({ medSteps, tracking = {}, onUpdate, onDelete, currentUserName, onStatusLog, providerDefaults = {} }) {
  const stepsWithMeta = useMemo(() => medSteps.map(step => {
    const entry = tracking[step.id] || {}
    const status = entry.status || 'not_started'
    const provider = entry.provider || {}
    const fallback = providerDefaults[step.id] || {}
    return {
      ...step,
      _status: status,
      _entry: entry,
      _provider: {
        name:  provider.name  ?? fallback.name  ?? '',
        phone: provider.phone ?? fallback.phone ?? '',
        fax:   provider.fax   ?? '',
        email: provider.email ?? '',
      },
      _deliveryYear: step._deliveryYear || fallback.deliveryYear || '',
    }
  }), [medSteps, tracking, providerDefaults])

  const counts = useMemo(() => ({
    total: stepsWithMeta.length,
    complete: stepsWithMeta.filter(s => TERMINAL_STATUSES.has(s._status)).length,
  }), [stepsWithMeta])

  if (stepsWithMeta.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-8">No medical records to track.</p>
  }

  return (
    <div className="space-y-4">
      {/* HEADER — prominent, with progress bar + count */}
      <div className="rounded-2xl bg-gradient-to-r from-[#283693]/8 via-[#283693]/5 to-[#ed148c]/8 border border-[#283693]/15 px-5 py-4">
        <div className="flex items-center justify-between gap-4 mb-2.5">
          <h2 className="font-heading font-black text-lg sm:text-xl text-[#283693] tracking-tight">
            Medical Records to Collect
          </h2>
          <p className="text-sm font-bold text-stone-600 tabular-nums shrink-0">
            {counts.complete} <span className="text-stone-400 font-medium">/ {counts.total} complete</span>
          </p>
        </div>
        <div className="h-2 rounded-full bg-white/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${counts.total > 0 ? (counts.complete / counts.total) * 100 : 0}%`,
              background: counts.complete === counts.total ? '#10b981' : 'linear-gradient(90deg, #283693, #ed148c)',
            }}
          />
        </div>
      </div>

      {/* RECORD CARDS — stacked */}
      <div className="space-y-3">
        {stepsWithMeta.map((step, idx) => (
          <RecordCard
            key={step.id}
            step={step}
            recordNumber={idx + 1}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onStatusLog={onStatusLog}
            currentUserName={currentUserName}
          />
        ))}
      </div>
    </div>
  )
}

function RecordCard({ step, recordNumber, onUpdate, onDelete, onStatusLog, currentUserName }) {
  // Manually-added records (added via the "+ Add Record" button) get a delete
  // affordance — auto-generated rows can't be deleted here since they'd just
  // re-render from the pregnancy-data auto-gen on next paint.
  const canDelete = typeof onDelete === 'function' && /^custom_record_/.test(step.id)
  const [confirmingDeleteRecord, setConfirmingDeleteRecord] = useState(false)
  const entry = step._entry
  const status = step._status
  const log = useMemo(() => Array.isArray(entry.log) ? entry.log : [], [entry.log])
  const isComplete = TERMINAL_STATUSES.has(status)

  // Auto-collapse when terminal; user can manually toggle.
  const [manualExpanded, setManualExpanded] = useState(null) // null = use default, true/false = override
  const expanded = manualExpanded === null ? !isComplete : manualExpanded

  // Inline edit state for header fields
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')

  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogDate, setEditLogDate] = useState('')
  const [editLogNote, setEditLogNote] = useState('')

  // Inline new-log row state — always present at the bottom of history.
  const [newLogStatus, setNewLogStatus] = useState('')
  const [newLogDate, setNewLogDate] = useState(todayIsoDate())
  const [newLogNote, setNewLogNote] = useState('')

  function startInlineEdit(field, current) {
    setEditingField(field); setDraft(current || '')
  }
  function commitInlineEdit() {
    const trimmed = (draft || '').trim()
    if (editingField === 'label') {
      const current = entry.customLabel || step.label
      if (trimmed && trimmed !== current) onUpdate(step.id, { ...entry, customLabel: trimmed })
    } else if (['name', 'phone', 'fax', 'email'].includes(editingField)) {
      const provider = { ...step._provider, [editingField]: trimmed }
      onUpdate(step.id, { ...entry, provider })
    }
    setEditingField(null); setDraft('')
  }
  function cancelInlineEdit() { setEditingField(null); setDraft('') }

  function addNewLog() {
    if (!newLogStatus) return
    const isoFromDate = `${newLogDate}T${new Date().toTimeString().slice(0, 8)}Z`
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: newLogStatus,
      from: status,
      changed_at: isoFromDate,
      changed_by: currentUserName,
      note: newLogNote || '',
    }
    onUpdate(step.id, { ...entry, status: newLogStatus, log: [...log, newLog] })
    if (onStatusLog) onStatusLog({ stepLabel: entry.customLabel || step.label, status: newLogStatus, by: currentUserName })
    // Reset row for the next log
    setNewLogStatus('')
    setNewLogDate(todayIsoDate())
    setNewLogNote('')
  }

  function startEditLog(logEntry) {
    setEditingLogId(logEntry.id || logEntry._idx)
    setEditLogDate(isoDatePart(logEntry.changed_at) || todayIsoDate())
    setEditLogNote(logEntry.note || '')
  }
  function saveEditLog() {
    if (!editingLogId) return
    const isoFromDate = `${editLogDate}T${new Date().toTimeString().slice(0, 8)}Z`
    const newList = log.map((l, idx) => {
      const id = l.id || `_idx_${idx}`
      if (id !== editingLogId) return l
      return { ...l, changed_at: isoFromDate, note: editLogNote }
    })
    onUpdate(step.id, { ...entry, log: newList })
    setEditingLogId(null)
  }
  function cancelEditLog() { setEditingLogId(null) }

  function deleteLog(logEntry) {
    const id = logEntry.id || logEntry._idx
    const newList = log.filter((l, idx) => (l.id || `_idx_${idx}`) !== id)
    let newStatus = entry.status
    if (newList.length !== log.length) {
      newStatus = newList.length ? newList[newList.length - 1].status : 'not_started'
    }
    onUpdate(step.id, { ...entry, status: newStatus, log: newList })
  }

  const colors = statusColors(status)
  const cardBg = colors.card
  const headerCursor = 'cursor-pointer'

  return (
    <div className={`rounded-2xl border ${cardBg} overflow-hidden`}>
      {/* HEADER ROW — clickable to toggle expand/collapse */}
      <div
        className={`flex items-start gap-3 px-5 py-3 ${headerCursor} hover:bg-stone-50/40 transition-colors`}
        onClick={(e) => {
          // Don't toggle when clicking interactive children (title rename input, etc.)
          if (e.target.closest('input, button, a')) return
          setManualExpanded(!expanded)
        }}
      >
        <button
          className="mt-1 text-stone-400 hover:text-[#283693] shrink-0"
          onClick={(e) => { e.stopPropagation(); setManualExpanded(!expanded) }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span className="text-2xl font-heading font-black text-[#ed148c]/60 leading-none tabular-nums shrink-0">
          {String(recordNumber).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          {editingField === 'label' ? (
            <InlineEditInput
              value={draft}
              onChange={setDraft}
              onCommit={commitInlineEdit}
              onCancel={cancelInlineEdit}
              className="text-base font-heading font-black text-[#283693] tracking-tight"
              autoFocus
            />
          ) : (
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3
                className="text-base font-heading font-black text-[#283693] tracking-tight leading-tight cursor-text hover:underline decoration-dotted decoration-stone-300 underline-offset-4"
                title="Click to rename"
                onClick={(e) => { e.stopPropagation(); startInlineEdit('label', entry.customLabel || step.label) }}
              >
                {entry.customLabel || step.label}
              </h3>
              {/* Note inline with the title */}
              <span className="min-w-[120px] max-w-[400px]" onClick={e => e.stopPropagation()}>
                <HeaderNote entry={entry} stepId={step.id} onUpdate={onUpdate} />
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {step.badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${step.badge.color}`}>{step.badge.label}</span>
            )}
            {step._deliveryYear && (
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                Delivery year · {step._deliveryYear}
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors.badge}`}>
              {status === 'not_started' ? 'Not Started' : statusLabel(status)}
            </span>
          </div>
          {/* Provider contacts — visible on header (collapsed AND expanded) */}
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs mt-1.5" onClick={e => e.stopPropagation()}>
            <ContactInline icon={PhoneIcon} label="Phone" value={step._provider.phone}
              editing={editingField === 'phone'} draft={draft} setDraft={setDraft}
              startEdit={() => startInlineEdit('phone', step._provider.phone)} commit={commitInlineEdit} cancel={cancelInlineEdit} inputType="tel" />
            <ContactInline icon={Printer} label="Fax" value={step._provider.fax}
              editing={editingField === 'fax'} draft={draft} setDraft={setDraft}
              startEdit={() => startInlineEdit('fax', step._provider.fax)} commit={commitInlineEdit} cancel={cancelInlineEdit} inputType="tel" />
            <ContactInline icon={MailIcon} label="Email" value={step._provider.email}
              editing={editingField === 'email'} draft={draft} setDraft={setDraft}
              startEdit={() => startInlineEdit('email', step._provider.email)} commit={commitInlineEdit} cancel={cancelInlineEdit} inputType="email" />
          </div>
        </div>
        {canDelete && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            {confirmingDeleteRecord ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] text-red-500 font-semibold mr-1">Delete record?</span>
                <button onClick={() => { onDelete(step.id); setConfirmingDeleteRecord(false) }} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded">Yes</button>
                <button onClick={() => setConfirmingDeleteRecord(false)} className="text-[10px] text-stone-500 hover:bg-stone-100 px-1.5 py-0.5 rounded">No</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingDeleteRecord(true)}
                className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete this record"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* EXPANDED BODY */}
      {expanded && (
        <div className="px-5 pb-4 pt-2 border-t border-stone-100">
          {/* HISTORY + INLINE NEW-LOG ROW — primary interaction surface */}
          <div className="mb-2">
            <ul className="space-y-1.5 border-l-2 border-stone-200 pl-3">
              {log.map((l, idx) => {
                const stableId = l.id || `_idx_${idx}`
                const withIdx = { ...l, _idx: stableId }
                const isEditing = editingLogId === stableId
                if (isEditing) {
                  return (
                    <li key={stableId} className="rounded-lg border border-[#283693]/30 bg-[#283693]/5 p-2 space-y-1.5">
                      <p className="text-[10px] font-bold text-[#283693] uppercase tracking-wider">Editing · {statusLabel(l.status)}</p>
                      <div className="flex flex-col sm:flex-row gap-1.5 sm:items-center">
                        <input type="date" value={editLogDate} onChange={e => setEditLogDate(e.target.value)} className="text-xs rounded border border-stone-200 bg-white px-2 py-1 outline-none focus:border-[#283693]" />
                        <input type="text" value={editLogNote} onChange={e => setEditLogNote(e.target.value)} placeholder="Note…" className="flex-1 text-xs rounded border border-stone-200 bg-white px-2 py-1 outline-none focus:border-[#283693]" />
                        <div className="flex gap-1">
                          <button onClick={cancelEditLog} className="text-[11px] text-stone-500 hover:text-stone-700 px-2 py-1">Cancel</button>
                          <button onClick={saveEditLog} className="text-[11px] font-semibold text-white bg-[#283693] rounded px-2.5 py-1">Save</button>
                        </div>
                      </div>
                    </li>
                  )
                }
                return (
                  <li key={stableId} className="group flex items-start gap-2 text-[11px]">
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-stone-700">{statusLabel(l.status)}</span>
                      <span className="ml-1.5 text-stone-400">
                        {formatLogDate(l.changed_at)}
                        {' · '}<span title={l.changed_by || 'Unknown'}>{initialsOf(l.changed_by)}</span>
                      </span>
                      {l.note && <span className="ml-2 font-medium text-[#283693]">{l.note}</span>}
                    </span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {pendingDeleteId === stableId ? (
                        <>
                          <span className="text-[10px] text-red-500 font-semibold mr-1">Delete?</span>
                          <button onClick={() => { deleteLog(withIdx); setPendingDeleteId(null) }} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded">Yes</button>
                          <button onClick={() => setPendingDeleteId(null)} className="text-[10px] text-stone-500 hover:bg-stone-100 px-1.5 py-0.5 rounded">No</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditLog(withIdx)} className="p-0.5 text-stone-400 hover:text-[#283693] hover:bg-[#283693]/5 rounded" title="Edit log">
                            <Pencil className="size-3" />
                          </button>
                          <button onClick={() => setPendingDeleteId(stableId)} className="p-0.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded" title="Delete log">
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}

              {/* INLINE NEW-LOG ROW — always present, becomes a real log on submit */}
              <li className="pt-1.5">
                <div className="flex flex-col sm:flex-row gap-1.5 sm:items-center rounded-lg border-2 border-dashed border-stone-200 bg-stone-50/40 p-2 hover:border-[#283693]/30 hover:bg-[#283693]/5 transition-colors focus-within:border-[#283693] focus-within:bg-[#283693]/5">
                  <select
                    value={newLogStatus}
                    onChange={e => setNewLogStatus(e.target.value)}
                    className="text-xs rounded border border-stone-200 bg-white px-2 py-1.5 outline-none focus:border-[#283693] min-w-[160px]"
                  >
                    <option value="">Choose status…</option>
                    {STATUS_PILLS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <input
                    type="date"
                    value={newLogDate}
                    onChange={e => setNewLogDate(e.target.value)}
                    className="text-xs rounded border border-stone-200 bg-white px-2 py-1.5 outline-none focus:border-[#283693]"
                    title="Log date"
                  />
                  <input
                    type="text"
                    value={newLogNote}
                    onChange={e => setNewLogNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newLogStatus) addNewLog() }}
                    placeholder="Optional note…"
                    className="flex-1 text-xs rounded border border-stone-200 bg-white px-2 py-1.5 outline-none focus:border-[#283693]"
                  />
                  <button
                    onClick={addNewLog}
                    disabled={!newLogStatus}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#283693] hover:bg-[#1f2a73] disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition-colors shrink-0"
                  >
                    <Plus className="size-3.5" /> Log
                  </button>
                </div>
              </li>
            </ul>
          </div>

        </div>
      )}
    </div>
  )
}

/**
 * Inline note that lives in the top-right of every record header. Always
 * visible (collapsed or expanded card). Plain styling — integrates with the
 * card rather than reading as a separate post-it.
 */
function HeaderNote({ entry, stepId, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  function save() {
    onUpdate(stepId, { ...entry, note: draft })
    setOpen(false)
  }
  function cancel() {
    setOpen(false)
    setDraft(entry.note || '')
  }
  if (open) {
    return (
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        onBlur={save}
        autoFocus
        placeholder="Note…"
        className="w-full text-xs rounded-md border border-stone-300 bg-white px-2 py-1 outline-none focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20"
      />
    )
  }
  if (entry.note) {
    return (
      <button
        onClick={() => { setOpen(true); setDraft(entry.note) }}
        className="block text-left text-xs text-stone-600 hover:text-[#283693] hover:underline decoration-dotted decoration-stone-300 underline-offset-4 w-full"
        title="Click to edit"
      >
        {entry.note}
      </button>
    )
  }
  return (
    <button
      onClick={() => { setOpen(true); setDraft('') }}
      className="text-[11px] text-stone-300 hover:text-[#283693] italic"
    >
      + Add note
    </button>
  )
}

function ContactInline({ icon: Icon, label, value, editing, draft, setDraft, startEdit, commit, cancel, inputType = 'text' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3 text-stone-400 shrink-0" />
      {editing ? (
        <input
          autoFocus
          type={inputType}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          placeholder={label}
          className="text-xs rounded border border-[#283693]/30 px-1.5 py-0.5 bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none min-w-[140px]"
        />
      ) : (
        <button
          onClick={startEdit}
          className={`text-xs ${value ? 'text-stone-700' : 'text-stone-300 italic'} hover:underline decoration-dotted decoration-stone-300 underline-offset-4`}
        >
          {value || `+ ${label}`}
        </button>
      )}
    </span>
  )
}

function InlineEditInput({ value, onChange, onCommit, onCancel, className, autoFocus, placeholder }) {
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder={placeholder}
        className={`flex-1 rounded-lg border-2 border-[#283693]/30 px-2 py-0.5 bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none ${className}`}
      />
      <button onClick={onCommit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="size-3.5" /></button>
      <button onClick={onCancel} className="p-1 text-stone-400 hover:bg-stone-100 rounded"><X className="size-3.5" /></button>
    </div>
  )
}
