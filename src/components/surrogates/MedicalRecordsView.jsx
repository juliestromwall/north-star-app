import { useState, useMemo } from 'react'
import { Check, X, Pencil, Trash2, Phone as PhoneIcon, Printer, Mail as MailIcon, Plus } from 'lucide-react'

/**
 * Stacked-list medical records UI. Each record is a full-width card that's
 * always expanded: header (badge + delivery year + inline-editable title +
 * provider details inline) → status pills → "+ Log" panel → history
 * (always visible, oldest → newest). No two-pane, no clicking to navigate
 * between records — Desiree's preference for list-style.
 *
 * Status options reflect the records-collection workflow (Faxed Request,
 * Refaxed, Confirmed Fax Received, etc.). Internally `complete` is reused
 * for "Records Complete" and `na` for "Skip" to keep existing tracking
 * data interpretable.
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
  { id: 'complete',                   label: 'Records Complete' },        // id stays 'complete' for back-compat
  { id: 'already_collected',          label: 'Already Collected' },
  { id: 'na',                         label: 'Skip' },                    // id stays 'na' for back-compat
]

const TERMINAL_STATUSES = new Set(['complete', 'na', 'already_collected'])

// Legacy ids that may exist in old tracking data — keep them recognizable
// in the history readout even though they're not currently selectable.
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

function formatRelativeTime(iso) {
  if (!iso) return ''
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function statusLabel(id) {
  return STATUS_PILLS.find(p => p.id === id)?.label || LEGACY_LABELS[id] || (id || '').replace(/_/g, ' ')
}

export default function MedicalRecordsView({ medSteps, tracking = {}, onUpdate, currentUserName, onStatusLog, providerDefaults = {} }) {
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
    <div className="space-y-3">
      {/* Progress summary header */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Records</p>
          <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${counts.total > 0 ? (counts.complete / counts.total) * 100 : 0}%`,
                background: counts.complete === counts.total ? '#10b981' : 'linear-gradient(90deg, #283693, #ed148c)',
              }}
            />
          </div>
        </div>
        <p className="text-xs text-stone-500 font-medium tabular-nums">{counts.complete} / {counts.total} complete</p>
      </div>

      {/* Stacked list of records — every record fully expanded */}
      <div className="space-y-3">
        {stepsWithMeta.map((step, idx) => (
          <RecordCard
            key={step.id}
            step={step}
            recordNumber={idx + 1}
            onUpdate={onUpdate}
            onStatusLog={onStatusLog}
            currentUserName={currentUserName}
          />
        ))}
      </div>
    </div>
  )
}

function RecordCard({ step, recordNumber, onUpdate, onStatusLog, currentUserName }) {
  const entry = step._entry
  const status = step._status
  const log = useMemo(() => Array.isArray(entry.log) ? entry.log : [], [entry.log])
  const isComplete = TERMINAL_STATUSES.has(status)

  // Inline edit state for header fields
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')

  // Note (per-record sticky note)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(entry.note || '')

  // Log creation/edit panel
  const [logMode, setLogMode] = useState(null) // null | { kind: 'create', status } | { kind: 'edit', logId }
  const [logDate, setLogDate] = useState(todayIsoDate())
  const [logNote, setLogNote] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

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

  function openLogCreate(newStatus) {
    setLogMode({ kind: 'create', status: newStatus })
    setLogDate(todayIsoDate())
    setLogNote('')
  }
  function openLogEdit(logEntry) {
    setLogMode({ kind: 'edit', logId: logEntry.id || logEntry._idx })
    setLogDate(isoDatePart(logEntry.changed_at) || todayIsoDate())
    setLogNote(logEntry.note || '')
  }
  function cancelLog() { setLogMode(null) }

  function saveLog() {
    if (!logMode) return
    const isoFromDate = `${logDate}T${new Date().toTimeString().slice(0, 8)}Z`
    if (logMode.kind === 'create') {
      const newLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: logMode.status,
        from: status,
        changed_at: isoFromDate,
        changed_by: currentUserName,
        note: logNote || '',
      }
      onUpdate(step.id, { ...entry, status: logMode.status, log: [...log, newLog] })
      if (onStatusLog) onStatusLog({ stepLabel: entry.customLabel || step.label, status: logMode.status, by: currentUserName })
    } else if (logMode.kind === 'edit') {
      const newList = log.map((l, idx) => {
        const id = l.id || `_idx_${idx}`
        if (id !== logMode.logId) return l
        return { ...l, changed_at: isoFromDate, note: logNote }
      })
      onUpdate(step.id, { ...entry, log: newList })
    }
    setLogMode(null)
  }

  function deleteLog(logEntry) {
    const id = logEntry.id || logEntry._idx
    const newList = log.filter((l, idx) => (l.id || `_idx_${idx}`) !== id)
    let newStatus = entry.status
    if (newList.length !== log.length) {
      newStatus = newList.length ? newList[newList.length - 1].status : 'not_started'
    }
    onUpdate(step.id, { ...entry, status: newStatus, log: newList })
  }

  function saveNote() {
    onUpdate(step.id, { ...entry, note: noteDraft })
    setNoteOpen(false)
  }

  const cardBg = isComplete ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-stone-200'

  return (
    <div className={`rounded-2xl border ${cardBg} px-5 py-4`}>
      {/* HEADER ROW: number + title + badge + year */}
      <div className="flex items-baseline gap-3 mb-2 pb-2 border-b border-stone-100">
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
            <h3
              className="text-base font-heading font-black text-[#283693] tracking-tight leading-tight cursor-text hover:underline decoration-dotted decoration-stone-300 underline-offset-4 truncate inline-block"
              title="Click to rename"
              onClick={() => startInlineEdit('label', entry.customLabel || step.label)}
            >
              {entry.customLabel || step.label}
            </h3>
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
            {/* CURRENT STATUS BADGE — visually distinct from the action pills below */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isComplete ? 'bg-emerald-100 text-emerald-700' :
              status === 'not_started' ? 'bg-stone-100 text-stone-500' :
              'bg-[#283693]/10 text-[#283693]'
            }`}>
              {status === 'not_started' ? 'Not Started' : statusLabel(status)}
            </span>
          </div>
        </div>
      </div>

      {/* PROVIDER ROW — name (prominent) + phone/fax/email inline */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Provider</span>
          {editingField === 'name' ? (
            <InlineEditInput
              value={draft}
              onChange={setDraft}
              onCommit={commitInlineEdit}
              onCancel={cancelInlineEdit}
              className="text-sm font-medium text-stone-800 min-w-[200px]"
              autoFocus
              placeholder="Provider name"
            />
          ) : (
            <button
              onClick={() => startInlineEdit('name', step._provider.name)}
              className={`text-sm font-medium ${step._provider.name ? 'text-stone-800' : 'text-stone-300 italic'} hover:underline decoration-dotted decoration-stone-300 underline-offset-4 text-left`}
            >
              {step._provider.name || '+ Add provider name'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap text-xs">
          <ContactInline icon={PhoneIcon} label="Phone" field="phone" value={step._provider.phone}
            editing={editingField === 'phone'} draft={draft} setDraft={setDraft}
            startEdit={() => startInlineEdit('phone', step._provider.phone)} commit={commitInlineEdit} cancel={cancelInlineEdit} inputType="tel" />
          <ContactInline icon={Printer} label="Fax" field="fax" value={step._provider.fax}
            editing={editingField === 'fax'} draft={draft} setDraft={setDraft}
            startEdit={() => startInlineEdit('fax', step._provider.fax)} commit={commitInlineEdit} cancel={cancelInlineEdit} inputType="tel" />
          <ContactInline icon={MailIcon} label="Email" field="email" value={step._provider.email}
            editing={editingField === 'email'} draft={draft} setDraft={setDraft}
            startEdit={() => startInlineEdit('email', step._provider.email)} commit={commitInlineEdit} cancel={cancelInlineEdit} inputType="email" />
        </div>
      </div>

      {/* STATUS PILLS — clicking opens the log confirm panel.
          Active pill (= current record status) gets a thicker emerald ring + filled bg. */}
      <div className="mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_PILLS.map(s => {
            const active = status === s.id
            const isTerminal = TERMINAL_STATUSES.has(s.id)
            const cls = active
              ? isTerminal
                ? 'bg-emerald-500 border-emerald-500 text-white font-bold ring-2 ring-emerald-200 shadow-sm'
                : 'bg-[#283693] border-[#283693] text-white font-bold ring-2 ring-[#283693]/20 shadow-sm'
              : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            return (
              <button
                key={s.id}
                onClick={() => openLogCreate(s.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full border-2 transition-all ${cls}`}
              >
                {active && <Check className="size-3 inline mr-0.5 -mt-0.5" strokeWidth={3} />}
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* LOG CONFIRM PANEL — date + single-line note side-by-side */}
      {logMode && (
        <div className="mb-3 rounded-xl border-2 border-[#283693]/40 bg-[#283693]/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#283693] uppercase tracking-wider">
              {logMode.kind === 'create' ? `New log · ${statusLabel(logMode.status)}` : 'Edit log'}
            </p>
            <button onClick={cancelLog} className="text-stone-400 hover:text-stone-600">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="space-y-1 shrink-0">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Note (optional)</label>
              <input
                type="text"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveLog() }}
                placeholder="Quick note…"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={cancelLog} className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5">Cancel</button>
              <button
                onClick={saveLog}
                className="text-xs font-semibold text-white bg-[#283693] hover:bg-[#1f2a73] rounded-lg px-4 py-1.5 transition-colors"
              >
                {logMode.kind === 'create' ? 'Create log' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY — always visible, oldest → newest */}
      {log.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">History</p>
          <ul className="space-y-1 border-l-2 border-stone-200 pl-3">
            {log.map((l, idx) => {
              const stableId = l.id || `_idx_${idx}`
              const withIdx = { ...l, _idx: stableId }
              return (
                <li key={stableId} className="group flex items-start gap-2 text-[11px]">
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-stone-700">{statusLabel(l.status)}</span>
                    <span className="ml-1.5 text-stone-400">
                      {new Date(l.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{l.changed_by || 'Unknown'}
                    </span>
                    {l.note && <span className="block mt-0.5 italic text-stone-500">"{l.note}"</span>}
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
                        <button onClick={() => openLogEdit(withIdx)} className="p-0.5 text-stone-400 hover:text-[#283693] hover:bg-[#283693]/5 rounded" title="Edit log">
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
          </ul>
        </div>
      )}

      {/* NOTE (per-record sticky) */}
      <div>
        {noteOpen ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveNote() }}
              className="w-full text-sm rounded-lg border border-stone-200 px-3 py-1.5 bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none"
              placeholder="Sticky note for this record (admin only)…"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setNoteOpen(false); setNoteDraft(entry.note || '') }} className="text-xs text-stone-400 hover:text-stone-700">Cancel</button>
              <button onClick={saveNote} className="text-xs font-semibold text-[#283693] hover:underline">Save</button>
            </div>
          </div>
        ) : entry.note ? (
          <button onClick={() => { setNoteOpen(true); setNoteDraft(entry.note) }} className="block text-[11px] text-stone-500 italic hover:text-stone-700 text-left">
            "{entry.note}"
          </button>
        ) : (
          <button onClick={() => { setNoteOpen(true); setNoteDraft('') }} className="text-[10px] text-stone-400 hover:text-[#283693]">+ Sticky note</button>
        )}
      </div>
    </div>
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
