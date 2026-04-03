import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Upload, FileText, Send, Eye, Trash2, Plus, Search, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronDown, Users, FileSignature, Download, Pencil, Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PageHeader from '@/components/shared/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import {
  uploadTemplate, fetchTemplates, deleteTemplate, getTemplateFileUrl,
  createDocument, sendDocument, fetchDocuments, voidDocument, fetchAuditLog,
  createBlankTemplate, uploadLetterhead, getLetterhead,
} from '@/lib/esign'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { supabase } from '@/lib/supabase'
import { getGoogleStatus, listTemplateDocs, getOrCreateTemplatesFolder } from '@/lib/google'

const TEMPLATE_CATEGORIES = ['General', 'Agency Agreement', 'Medical Records Release', 'HIPAA', 'Background Check Authorization', 'Credit Card Authorization', 'Legal', 'Medical', 'Insurance', 'Other']

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-stone-100 text-stone-600', icon: FileText },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  partially_signed: { label: 'Partially Signed', color: 'bg-blue-100 text-blue-700', icon: FileSignature },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  voided: { label: 'Voided', color: 'bg-red-100 text-red-700', icon: XCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="size-3" /> {cfg.label}
    </span>
  )
}

// ── Templates Tab (Google Drive) ─────────────────────────
function TemplatesTab({ prefillCaseType, prefillCaseId, prefillJourneyId } = {}) {
  const { currentUser } = useRole()
  const userId = currentUser?.id
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(null)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!userId) return
    getGoogleStatus(userId)
      .then(s => {
        setConnected(s.connected)
        if (s.connected) return listTemplateDocs(userId)
        return []
      })
      .then(docs => setTemplates(docs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  async function handleRefresh() {
    if (!userId) return
    setRefreshing(true)
    try {
      const docs = await listTemplateDocs(userId)
      setTemplates(docs || [])
    } catch {}
    setRefreshing(false)
  }

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  )

  if (connected === false) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <FileText className="size-12 text-stone-300 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connect Google to manage templates</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Templates are stored as Google Docs in your "ABC Templates" Drive folder.
        </p>
        <Button asChild><Link to="/settings">Go to Settings</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" className="gap-1.5" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Refresh
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => {
          if (!userId) return
          getOrCreateTemplatesFolder(userId).then(folderId => {
            window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank')
          }).catch(err => alert('Failed: ' + err.message))
        }}>
          Open Drive Folder
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Create and edit templates in your <strong>Google Drive → ABC Templates</strong> folder. They appear here automatically.
        Use <code className="bg-stone-100 px-1 rounded">{'{{Signature:GC}}'}</code>, <code className="bg-stone-100 px-1 rounded">{'{{Name:GC}}'}</code>, <code className="bg-stone-100 px-1 rounded">{'{{Date:GC}}'}</code>, <code className="bg-stone-100 px-1 rounded">{'{{Email:GC}}'}</code>, <code className="bg-stone-100 px-1 rounded">{'{{Text:GC}}'}</code> as signing field placeholders.
        Replace <code className="bg-stone-100 px-1 rounded">GC</code> with <code className="bg-stone-100 px-1 rounded">IP1</code>, <code className="bg-stone-100 px-1 rounded">IP2</code>, or <code className="bg-stone-100 px-1 rounded">Admin</code>.
      </p>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="size-6 animate-spin text-[#283693] mx-auto mb-2" />
          <p className="text-sm text-stone-400">Loading templates from Google Drive...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching templates' : 'No templates yet'}
          description={search ? 'Try a different search.' : 'Create a Google Doc in your "ABC Templates" Drive folder to get started.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card key={doc.id} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#283693]/10 flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-[#283693]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Modified {new Date(doc.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 flex-1 text-xs" style={{ backgroundColor: '#283693', color: '#fff' }} asChild>
                    <Link to={`/e-signature/edit/${doc.id}${prefillJourneyId ? `?journeyId=${prefillJourneyId}` : prefillCaseType ? `?caseType=${prefillCaseType}&caseId=${prefillCaseId}` : ''}`}>
                      <Pencil className="size-3" /> Edit & Send
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => window.open(`https://docs.google.com/document/d/${doc.id}/edit`, '_blank')}>
                    <FileText className="size-3" /> Google Docs
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Documents Tab ───────────────────────────────────────
function DocumentsTab() {
  const { currentUser } = useRole()
  const [documents, setDocuments] = useState([])
  const [templates, setTemplates] = useState([])
  const [cases, setCases] = useState({ gc: [], ip: [] })
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [auditDoc, setAuditDoc] = useState(null)
  const [auditLog, setAuditLog] = useState([])

  // New document form
  const [newDoc, setNewDoc] = useState({ templateId: '', caseType: '', caseId: '', title: '', signers: [] })
  const [creating, setCreating] = useState(false)
  const [caseSearch, setCaseSearch] = useState('')
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchDocuments(),
      fetchTemplates(),
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
      fetchMatchedJourneys(),
    ]).then(([docs, tmpls, gcs, ips, jrnys]) => {
      setDocuments(docs)
      setTemplates(tmpls)
      setCases({ gc: gcs, ip: ips })
      setJourneys(jrnys || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function getCaseName(doc) {
    if (!doc.case_id) return '—'
    const list = doc.case_type === 'ip' ? cases.ip : cases.gc
    const c = list.find(x => x.id === doc.case_id)
    return c ? (c.names || c.name || '—') : `#${doc.case_id}`
  }

  /** Get the link for a case — matched journey if exists, else individual case */
  function getCaseLink(doc) {
    if (!doc.case_id) return null
    // Check if this case is part of a matched journey
    const journey = journeys.find(j =>
      (doc.case_type === 'gc' && j.gc_case_id === doc.case_id) ||
      (doc.case_type === 'ip' && j.ip_case_id === doc.case_id)
    )
    if (journey) return `/journeys/${journey.id}`
    // Fallback to individual case
    return doc.case_type === 'ip' ? `/intended-parents/${doc.case_id}` : `/surrogates/${doc.case_id}`
  }

  async function handleCreate() {
    if (!newDoc.title || !newDoc.templateId) return
    setCreating(true)
    try {
      const template = templates.find(t => t.id === Number(newDoc.templateId))
      const doc = await createDocument({
        templateId: Number(newDoc.templateId),
        caseId: newDoc.caseId ? Number(newDoc.caseId) : null,
        caseType: newDoc.caseType || null,
        title: newDoc.title,
        signers: newDoc.signers,
        filePath: template?.file_path || null,
        createdBy: currentUser.name,
      })
      // Auto-send
      const sent = await sendDocument(doc.id)
      setDocuments(prev => [sent || doc, ...prev])
      setShowNew(false)
      setNewDoc({ templateId: '', caseType: '', caseId: '', title: '', signers: [] })
    } catch (err) {
      alert('Failed: ' + (err.message || 'Unknown error'))
    } finally { setCreating(false) }
  }

  function addSigner() {
    setNewDoc(prev => ({
      ...prev,
      signers: [...prev.signers, { role: '', name: '', email: '', status: 'pending' }]
    }))
  }

  function updateSigner(idx, key, val) {
    setNewDoc(prev => {
      const signers = [...prev.signers]
      signers[idx] = { ...signers[idx], [key]: val }
      return { ...prev, signers }
    })
  }

  function removeSigner(idx) {
    setNewDoc(prev => ({ ...prev, signers: prev.signers.filter((_, i) => i !== idx) }))
  }

  // Auto-populate signers from case
  function handleCaseSelect(caseType, caseId) {
    setNewDoc(prev => ({ ...prev, caseType, caseId }))
    if (!caseId) return
    const list = caseType === 'ip' ? cases.ip : cases.gc
    const c = list.find(x => x.id === Number(caseId))
    if (!c) return
    const signers = []
    if (caseType === 'gc') {
      signers.push({ role: 'Surrogate', name: c.name || '', email: c.email || '', status: 'pending' })
      if (c.partnerName) signers.push({ role: 'Partner', name: c.partnerName, email: c.partnerEmail || '', status: 'pending' })
    } else {
      signers.push({ role: 'Intended Parent 1', name: c.ip1Name || c.names || '', email: c.email || '', status: 'pending' })
      if (c.ip2Name) signers.push({ role: 'Intended Parent 2', name: c.ip2Name, email: c.ip2Email || '', status: 'pending' })
    }
    setNewDoc(prev => ({ ...prev, signers }))
  }

  async function handleVoid(doc) {
    if (!confirm(`Void "${doc.title}"? This cannot be undone.`)) return
    const updated = await voidDocument(doc.id, currentUser.name).catch(() => null)
    if (updated) setDocuments(prev => prev.map(d => d.id === doc.id ? updated : d))
  }

  async function showAudit(doc) {
    setAuditDoc(doc)
    const log = await fetchAuditLog(doc.id)
    setAuditLog(log)
  }

  const filtered = documents.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const caseOptions = newDoc.caseType === 'ip' ? cases.ip : newDoc.caseType === 'gc' ? cases.gc : []

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SelectUI value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTriggerUI className="w-[160px]"><SelectValueUI placeholder="Status" /></SelectTriggerUI>
          <SelectContentUI>
            <SelectItemUI value="all">All Statuses</SelectItemUI>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItemUI key={k} value={k}>{v.label}</SelectItemUI>)}
          </SelectContentUI>
        </SelectUI>
      </div>

      {loading ? (
        <p className="text-center py-12 text-stone-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No documents" description="Send a template for signature to get started." />
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Document</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Case</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Signers</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-500">Sent</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const signedCount = (doc.signers || []).filter(s => s.status === 'signed').length
                  const totalSigners = (doc.signers || []).length
                  return (
                    <tr key={doc.id} className="border-b last:border-0 hover:bg-stone-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-xs text-stone-400">{doc.case_type === 'ip' ? 'IP' : 'GC'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const caseLink = getCaseLink(doc)
                          const name = getCaseName(doc)
                          return caseLink ? (
                            <Link to={caseLink} className="text-[#283693] hover:underline font-medium text-sm">{name}</Link>
                          ) : (
                            <span className="text-stone-600">{name}</span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {(doc.signers || []).map((s, si) => (
                            <div key={si} className="flex items-center gap-1.5 text-xs">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'signed' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                              <span className="font-medium">{s.name}</span>
                              <span className="text-stone-400">({s.role})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-4 py-3 text-xs text-stone-400">
                        {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => {
                            try {
                              const meta = JSON.parse(doc.document_hash || '{}')
                              const pdfPath = meta.pdfPath || doc.file_path
                              if (pdfPath && supabase) {
                                const { data } = supabase.storage.from('esign-documents').getPublicUrl(pdfPath)
                                if (data?.publicUrl) window.open(data.publicUrl, '_blank')
                              } else {
                                alert('No PDF available for this document.')
                              }
                            } catch { alert('Could not load PDF.') }
                          }}>
                            <Download className="size-3" /> PDF
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => showAudit(doc)}>
                            <Eye className="size-3" /> Audit
                          </Button>
                          {(doc.status === 'pending' || doc.status === 'partially_signed') && (
                            <Button variant="ghost" size="sm" className="text-xs gap-1 text-red-500" onClick={() => handleVoid(doc)}>
                              <XCircle className="size-3" /> Void
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* New Document Dialog */}
      <Dialog open={showNew} onOpenChange={v => { setShowNew(v); if (!v) { setCaseSearch(''); setCaseDropdownOpen(false) } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Send Document for Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1">
              <Label className="text-xs">Template *</Label>
              <SelectUI value={newDoc.templateId ? String(newDoc.templateId) : ''} onValueChange={v => {
                const tmpl = templates.find(t => t.id === Number(v))
                setNewDoc(prev => ({ ...prev, templateId: v, title: prev.title || tmpl?.name || '' }))
              }}>
                <SelectTriggerUI><SelectValueUI placeholder="Select a template..." /></SelectTriggerUI>
                <SelectContentUI>
                  {templates.map(t => <SelectItemUI key={t.id} value={String(t.id)}>{t.name} ({t.category})</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Document Title *</Label>
              <Input value={newDoc.title} onChange={e => setNewDoc(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g., Agency Agreement — Smith" />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Case Type</Label>
                <SelectUI value={newDoc.caseType} onValueChange={v => { setNewDoc(prev => ({ ...prev, caseType: v, caseId: '' })); setCaseSearch(''); }}>
                  <SelectTriggerUI><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="gc">Surrogate (GC)</SelectItemUI>
                    <SelectItemUI value="ip">Intended Parent (IP)</SelectItemUI>
                  </SelectContentUI>
                </SelectUI>
              </div>
              <div className="space-y-1 relative">
                <Label className="text-xs">Case</Label>
                <Input
                  placeholder={newDoc.caseType ? 'Search by name...' : 'Select case type first'}
                  value={caseSearch}
                  onChange={e => { setCaseSearch(e.target.value); setCaseDropdownOpen(true) }}
                  onFocus={() => newDoc.caseType && setCaseDropdownOpen(true)}
                  disabled={!newDoc.caseType}
                  className="text-sm"
                />
                {caseDropdownOpen && caseOptions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {caseOptions
                      .filter(c => {
                        if (!caseSearch.trim()) return true
                        const q = caseSearch.toLowerCase()
                        return (c.names || c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
                      })
                      .map(c => (
                        <button key={c.id} type="button" className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 text-left border-b last:border-0"
                          onClick={() => { handleCaseSelect(newDoc.caseType, String(c.id)); setCaseSearch(c.names || c.name || ''); setCaseDropdownOpen(false) }}>
                          <div className="w-7 h-7 rounded-full bg-[#283693]/10 text-[#283693] flex items-center justify-center text-[11px] font-bold shrink-0">
                            {(c.names || c.name || '?').charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.names || c.name}</p>
                            <p className="text-xs text-stone-400 truncate">{c.email || 'No email'}{c.assignedTo ? ` · ${c.assignedTo}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    {caseOptions.filter(c => {
                      if (!caseSearch.trim()) return true
                      const q = caseSearch.toLowerCase()
                      return (c.names || c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
                    }).length === 0 && (
                      <p className="text-xs text-stone-400 text-center py-3">No cases match "{caseSearch}"</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Signers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-stone-500">Signers</Label>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addSigner}>
                  <Plus className="size-3" /> Add Signer
                </Button>
              </div>
              {newDoc.signers.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-3">Select a case to auto-populate signers, or add manually.</p>
              )}
              {newDoc.signers.map((s, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2 bg-stone-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-500">Signer #{i + 1}</span>
                    <button onClick={() => removeSigner(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <SelectUI value={s.role} onValueChange={v => updateSigner(i, 'role', v)}>
                      <SelectTriggerUI className="text-xs h-8"><SelectValueUI placeholder="Role..." /></SelectTriggerUI>
                      <SelectContentUI>
                        <SelectItemUI value="Surrogate">Surrogate</SelectItemUI>
                        <SelectItemUI value="Partner">Partner</SelectItemUI>
                        <SelectItemUI value="Intended Parent 1">Intended Parent 1</SelectItemUI>
                        <SelectItemUI value="Intended Parent 2">Intended Parent 2</SelectItemUI>
                        <SelectItemUI value="Admin">Admin</SelectItemUI>
                      </SelectContentUI>
                    </SelectUI>
                    <Input placeholder="Name" value={s.name} onChange={e => updateSigner(i, 'name', e.target.value)} className="text-xs h-8" />
                    <Input placeholder="Email" type="email" value={s.email} onChange={e => updateSigner(i, 'email', e.target.value)} className="text-xs h-8" />
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleCreate} disabled={creating || !newDoc.title || !newDoc.templateId || newDoc.signers.length === 0}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {creating ? 'Sending...' : 'Send for Signature'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={!!auditDoc} onOpenChange={() => setAuditDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Trail — {auditDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {auditDoc && (
              <div className="rounded-lg bg-stone-50 p-3 text-xs space-y-1">
                <p><span className="font-semibold">Document ID:</span> {auditDoc.id}</p>
                <p><span className="font-semibold">Status:</span> {auditDoc.status}</p>
                <p><span className="font-semibold">Created:</span> {new Date(auditDoc.created_at).toLocaleString()}</p>
                {auditDoc.sent_at && <p><span className="font-semibold">Sent:</span> {new Date(auditDoc.sent_at).toLocaleString()}</p>}
                {auditDoc.completed_at && <p><span className="font-semibold">Completed:</span> {new Date(auditDoc.completed_at).toLocaleString()}</p>}
                <div className="pt-2">
                  <p className="font-semibold mb-1">Signers:</p>
                  {(auditDoc.signers || []).map((s, i) => (
                    <p key={i} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s.status === 'signed' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      {s.name} ({s.role}) — {s.email} — {s.status === 'signed' ? `Signed ${new Date(s.signedAt).toLocaleString()}` : s.status}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs font-semibold text-stone-500 uppercase">Activity Log</p>
            {auditLog.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">No audit events recorded.</p>
            ) : (
              auditLog.map(entry => (
                <div key={entry.id} className="text-xs border-b border-stone-100 pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold capitalize ${entry.action === 'signed' ? 'text-emerald-600' : entry.action === 'voided' ? 'text-red-600' : 'text-stone-600'}`}>
                      {entry.action}
                    </span>
                    <span className="text-stone-400">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-stone-500">{entry.actor_name}{entry.actor_email ? ` (${entry.actor_email})` : ''}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────
export default function ESignaturePage() {
  const [searchParams] = useSearchParams()
  const prefillCaseType = searchParams.get('caseType') || ''
  const prefillCaseId = searchParams.get('caseId') || ''
  const prefillJourneyId = searchParams.get('journeyId') || ''
  const [tab, setTab] = useState((prefillCaseType || prefillJourneyId) ? 'templates' : 'documents')

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-Signature"
        subtitle="Manage document templates and track signing status"
      />

      {(prefillCaseType || prefillJourneyId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-[#283693]">
          <span className="font-semibold">Sending for case:</span> Select a template below to send for signature. {prefillJourneyId ? 'All parties will be pre-populated.' : 'Case will be pre-selected.'}
        </div>
      )}

      <div className="flex gap-2 border-b pb-2">
        {[
          { key: 'documents', label: 'Sent Documents' },
          { key: 'templates', label: 'Send for Signature' },
        ].map(t => (
          <button
            key={t.key}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-[#283693] text-white' : 'text-stone-600 hover:bg-stone-100'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'documents' ? <DocumentsTab /> : <TemplatesTab prefillCaseType={prefillCaseType} prefillCaseId={prefillCaseId} prefillJourneyId={prefillJourneyId} />}
    </div>
  )
}
