import { useState, useEffect, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Download, Eye, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function PortalDocumentsPage() {
  const { currentUser } = useRole()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [caseId, setCaseId] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!currentUser?.email || !supabase) { setLoading(false); return }
    loadDocuments()
  }, [currentUser?.email])

  async function loadDocuments() {
    setLoading(true)
    try {
      // 1. Find the user's case ID from intake_submissions
      const { data: intake } = await supabase
        .from('intake_submissions')
        .select('id')
        .eq('applicant_email', currentUser.email.trim().toLowerCase())
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()

      if (intake?.id) setCaseId(intake.id)
      const docs = []

      // 2. Fetch case_documents: only e-signature docs OR ones uploaded by this user
      if (intake?.id) {
        const { data: caseDocs } = await supabase
          .from('case_documents')
          .select('*')
          .eq('surrogate_id', intake.id)
          .order('created_at', { ascending: false })

        if (caseDocs) {
          for (const d of caseDocs) {
            const isEsign = d.category === 'e-signature'
            const isUserUpload = d.uploaded_by === currentUser.email || d.uploaded_by === currentUser.name
            if (!isEsign && !isUserUpload) continue
            docs.push({
              id: `cd_${d.id}`,
              title: d.file_name,
              url: d.public_url,
              date: d.created_at,
              category: d.category || 'general',
              source: 'case',
            })
          }
        }
      }

      // 3. Also fetch completed esign_documents where this user is a signer
      const { data: esignDocs } = await supabase
        .from('esign_documents')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (esignDocs) {
        for (const ed of esignDocs) {
          const signers = ed.signers || []
          const isSigner = signers.some(s => s.email?.toLowerCase() === currentUser.email.toLowerCase())
          if (!isSigner) continue
          const alreadyHave = docs.some(d => d.title?.includes(ed.title))
          if (alreadyHave) continue
          const meta = JSON.parse(ed.document_hash || '{}')
          const filePath = meta.pdfPath || ed.file_path
          if (!filePath) continue
          const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(filePath)
          if (urlData?.publicUrl) {
            docs.push({
              id: `es_${ed.id}`,
              title: `[Signed] ${ed.title || 'Document'}`,
              url: urlData.publicUrl,
              date: ed.completed_at || ed.created_at,
              category: 'e-signature',
              source: 'esign',
            })
          }
        }
      }

      setDocuments(docs)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !caseId || !supabase) return
    setUploading(true)
    try {
      const path = `${caseId}/uploads/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(uploadData.path)
      await supabase.from('case_documents').insert({
        surrogate_id: caseId,
        category: 'uploads',
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: uploadData.path,
        public_url: urlData.publicUrl,
        uploaded_by: currentUser.email,
      })
      await loadDocuments()
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Documents"
          subtitle="Signed documents and files you've uploaded."
        />
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || !caseId}>
            {uploading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Upload className="size-4 mr-2" />}
            Upload
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="size-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">No documents yet</p>
            <p className="text-stone-400 text-sm mt-1">Documents will appear here once they've been shared with you.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="size-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="size-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{doc.title}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(doc.url, '_blank')}>
                    <Eye className="size-4 text-stone-500" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                    <a href={doc.url} download target="_blank" rel="noopener noreferrer">
                      <Download className="size-4 text-stone-500" />
                    </a>
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
