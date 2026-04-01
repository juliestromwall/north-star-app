import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, FileText, Send, Eye, Trash2, Plus, Search, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronDown, Users, FileSignature, Download, Pencil,
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
} from '@/lib/esign'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'

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

// ── Templates Tab ───────────────────────────────────────
function TemplatesTab() {
  const { currentUser } = useRole()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'General', description: '' })
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const fileRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameForm, setRenameForm] = useState({ name: '', category: '', description: '' })
  const [renameSaving, setRenameSaving] = useState(false)

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleUpload() {
    if (!selectedFile || !uploadForm.name) return
    setUploading(true)
    try {
      const newTemplate = await uploadTemplate(selectedFile, {
        name: uploadForm.name,
        category: uploadForm.category,
        description: uploadForm.description,
        createdBy: currentUser.name,
      })
      setTemplates(prev => [newTemplate, ...prev])
      setShowUpload(false)
      setUploadForm({ name: '', category: 'General', description: '' })
      setSelectedFile(null)
    } catch (err) {
      alert('Failed to upload: ' + (err.message || 'Unknown error'))
    } finally { setUploading(false) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTemplate(deleteTarget.id, deleteTarget.file_path)
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      alert('Failed to delete template: ' + (err.message || 'Unknown error'))
    } finally { setDeleting(false) }
  }

  function startRename(t) {
    setRenameForm({ name: t.name, category: t.category || 'General', description: t.description || '' })
    setRenameTarget(t)
  }

  async function handleRename() {
    if (!renameTarget || !renameForm.name) return
    setRenameSaving(true)
    try {
      const { updateTemplate } = await import('@/lib/esign')
      const updated = await updateTemplate(renameTarget.id, {
        name: renameForm.name,
        category: renameForm.category,
        description: renameForm.description,
      })
      setTemplates(prev => prev.map(t => t.id === renameTarget.id ? { ...t, ...updated } : t))
      setRenameTarget(null)
    } catch {} finally { setRenameSaving(false) }
  }

  // Get unique tags from templates for filter
  const usedTags = [...new Set(templates.map(t => t.category || 'General'))]

  const filtered = templates.filter(t => {
    if (tagFilter !== 'all' && (t.category || 'General') !== tagFilter) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !(t.category || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button className="gap-1.5" onClick={() => setShowUpload(true)}>
          <Upload className="size-4" /> Upload Template
        </Button>
      </div>

      {/* Tag filter */}
      {usedTags.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tagFilter === 'all' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            onClick={() => setTagFilter('all')}
          >All ({templates.length})</button>
          {usedTags.map(tag => {
            const count = templates.filter(t => (t.category || 'General') === tag).length
            return (
              <button key={tag}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tagFilter === tag ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
              >{tag} ({count})</button>
            )
          })}
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-stone-400">Loading templates...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No templates" description="Upload a Word document (.docx) to use as a signing template." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <Card key={t.id} className="rounded-2xl group hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#283693]/10 flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-[#283693]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.category}</p>
                  </div>
                </div>
                {t.description && <p className="text-xs text-stone-500 line-clamp-2">{t.description}</p>}
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>{t.file_name?.endsWith('_edited.html') ? '' : t.file_name?.replace(/^\d+_/, '') || ''}</span>
                  <span>{t.file_size ? `${(t.file_size / 1024).toFixed(0)} KB` : ''}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-1 text-xs flex-1" style={{ backgroundColor: '#283693', color: '#fff' }} asChild>
                    <Link to={`/e-signature/edit/${t.id}`}>
                      <Pencil className="size-3" /> Edit & Send
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" title="Rename" onClick={() => startRename(t)}>
                    <FileText className="size-3" />
                  </Button>
                  {getTemplateFileUrl(t.file_path) && (
                    <Button variant="outline" size="sm" className="text-xs" title="Download" asChild>
                      <a href={getTemplateFileUrl(t.file_path)} target="_blank" rel="noopener noreferrer">
                        <Download className="size-3" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50" title="Delete" onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Template Name *</Label>
              <Input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Agency Agreement" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <SelectUI value={uploadForm.category} onValueChange={v => setUploadForm(f => ({ ...f, category: v }))}>
                <SelectTriggerUI><SelectValueUI /></SelectTriggerUI>
                <SelectContentUI>
                  {TEMPLATE_CATEGORIES.map(c => <SelectItemUI key={c} value={c}>{c}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief description of this template..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">File (.docx, .pdf) *</Label>
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-[#283693]/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center gap-2 justify-center">
                    <FileText className="size-5 text-[#283693]" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-stone-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <>
                    <Upload className="size-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-500">Click to select a file</p>
                    <p className="text-xs text-stone-400">.docx or .pdf</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".docx,.pdf,.doc" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setSelectedFile(file)
                    if (!uploadForm.name) setUploadForm(f => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }))
                  }
                }}
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !uploadForm.name} className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {uploading ? 'Uploading...' : 'Upload Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="size-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">
                Are you sure you want to permanently delete <span className="font-semibold">"{deleteTarget?.name}"</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" className="gap-1" onClick={confirmDelete} disabled={deleting}>
                <Trash2 className="size-3.5" /> {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Template Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input value={renameForm.name} onChange={e => setRenameForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tag / Category</Label>
              <SelectUI value={renameForm.category} onValueChange={v => setRenameForm(f => ({ ...f, category: v }))}>
                <SelectTriggerUI><SelectValueUI /></SelectTriggerUI>
                <SelectContentUI>
                  {TEMPLATE_CATEGORIES.map(c => <SelectItemUI key={c} value={c}>{c}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={renameForm.description} onChange={e => setRenameForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />
            </div>
            <Button onClick={handleRename} disabled={renameSaving || !renameForm.name} className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {renameSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Documents Tab ───────────────────────────────────────
function DocumentsTab() {
  const { currentUser } = useRole()
  const [documents, setDocuments] = useState([])
  const [templates, setTemplates] = useState([])
  const [cases, setCases] = useState({ gc: [], ip: [] })
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [auditDoc, setAuditDoc] = useState(null)
  const [auditLog, setAuditLog] = useState([])

  // New document form
  const [newDoc, setNewDoc] = useState({ templateId: '', caseType: '', caseId: '', title: '', signers: [] })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchDocuments(),
      fetchTemplates(),
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
    ]).then(([docs, tmpls, gcs, ips]) => {
      setDocuments(docs)
      setTemplates(tmpls)
      setCases({ gc: gcs, ip: ips })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function getCaseName(doc) {
    if (!doc.case_id) return '—'
    const list = doc.case_type === 'ip' ? cases.ip : cases.gc
    const c = list.find(x => x.id === doc.case_id)
    return c ? (c.names || c.name || '—') : `#${doc.case_id}`
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
        <Button className="gap-1.5" onClick={() => setShowNew(true)}>
          <Send className="size-4" /> Send for Signature
        </Button>
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
                      <td className="px-4 py-3 text-stone-600">{getCaseName(doc)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">{signedCount}/{totalSigners} signed</span>
                        <div className="flex gap-1 mt-1">
                          {(doc.signers || []).map((s, i) => (
                            <span key={i} title={`${s.name} (${s.role}) — ${s.status}`}
                              className={`w-2 h-2 rounded-full ${s.status === 'signed' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-4 py-3 text-xs text-stone-400">
                        {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => showAudit(doc)}>
                            <Eye className="size-3" /> Audit
                          </Button>
                          {doc.status === 'pending' && (
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
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Case Type</Label>
                <SelectUI value={newDoc.caseType} onValueChange={v => { setNewDoc(prev => ({ ...prev, caseType: v, caseId: '' })); }}>
                  <SelectTriggerUI><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="gc">Surrogate (GC)</SelectItemUI>
                    <SelectItemUI value="ip">Intended Parent (IP)</SelectItemUI>
                  </SelectContentUI>
                </SelectUI>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Case</Label>
                <SelectUI value={newDoc.caseId ? String(newDoc.caseId) : ''} onValueChange={v => handleCaseSelect(newDoc.caseType, v)}>
                  <SelectTriggerUI><SelectValueUI placeholder="Select case..." /></SelectTriggerUI>
                  <SelectContentUI>
                    {caseOptions.map(c => <SelectItemUI key={c.id} value={String(c.id)}>{c.names || c.name}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
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
                    <Input placeholder="Role" value={s.role} onChange={e => updateSigner(i, 'role', e.target.value)} className="text-xs h-8" />
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
  const [tab, setTab] = useState('documents')

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-Signature"
        subtitle="Manage document templates and track signing status"
      />

      <div className="flex gap-2 border-b pb-2">
        {[
          { key: 'documents', label: 'Documents' },
          { key: 'templates', label: 'Templates' },
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

      {tab === 'documents' ? <DocumentsTab /> : <TemplatesTab />}
    </div>
  )
}
