import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { getGmailSignature } from '@/lib/google'

const DraftContext = createContext(null)

let nextDraftId = 1

export function DraftProvider({ children }) {
  const [drafts, setDrafts] = useState([])
  const signatureCache = useRef({ userId: null, html: null, loading: false })

  // Fetch and cache signature
  const fetchSignature = useCallback(async (userId) => {
    if (!userId) return ''
    if (signatureCache.current.userId === userId && signatureCache.current.html !== null) {
      return signatureCache.current.html
    }
    if (signatureCache.current.loading) return ''
    signatureCache.current.loading = true
    try {
      const html = await getGmailSignature(userId)
      signatureCache.current = { userId, html: html || '', loading: false }
      return html || ''
    } catch (e) {
      console.warn('Signature fetch failed:', e)
      signatureCache.current = { userId, html: '', loading: false }
      return ''
    }
  }, [])

  const openDraft = useCallback(({ to, cc, bcc, subject, body, replyTo, forwardMsg, caseId, caseType, userId, attachments: initialAttachments } = {}) => {
    const id = nextDraftId++

    let initialSubject = subject || ''
    let initialBody = body || ''
    let initialTo = to || ''

    if (replyTo) {
      const fromEmail = replyTo.from?.match(/<([^>]+)>/)?.[1] || replyTo.from
      initialTo = fromEmail || ''
      initialSubject = replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject || ''}`
      initialBody = `<p></p><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:12px;color:#666">On ${replyTo.date}, ${replyTo.from} wrote:<br/>${replyTo.bodyHtml || ''}</div>`
    } else if (forwardMsg) {
      initialTo = ''
      initialSubject = `Fwd: ${forwardMsg.subject || ''}`
      initialBody = `<p></p><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:12px;color:#666">---------- Forwarded message ----------<br/>From: ${forwardMsg.from}<br/>Date: ${forwardMsg.date}<br/>Subject: ${forwardMsg.subject}<br/><br/>${forwardMsg.bodyHtml || ''}</div>`
    } else {
      initialBody = `<p></p>`
    }

    const draft = {
      id,
      to: initialTo,
      cc: cc || '',
      bcc: bcc || '',
      subject: initialSubject,
      body: initialBody,
      attachments: initialAttachments || [],
      caseId: caseId ? String(caseId) : '',
      caseType: caseType || '',
      minimized: false,
      showCcBcc: false,
    }

    setDrafts(prev => [...prev, draft])

    // Backfill signature async — stored separately, not in editor body
    fetchSignature(userId).then(sig => {
      if (sig) {
        setDrafts(prev => prev.map(d => {
          if (d.id !== id) return d
          if (d.signatureHtml) return d
          return { ...d, signatureHtml: sig }
        }))
      }
    }).catch(() => {})

    return id
  }, [fetchSignature])

  const updateDraft = useCallback((id, updates) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
  }, [])

  const closeDraft = useCallback((id) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }, [])

  const minimizeDraft = useCallback((id) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, minimized: true } : d))
  }, [])

  const expandDraft = useCallback((id) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, minimized: false } : d))
  }, [])

  return (
    <DraftContext.Provider value={{ drafts, openDraft, updateDraft, closeDraft, minimizeDraft, expandDraft }}>
      {children}
    </DraftContext.Provider>
  )
}

export function useDrafts() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDrafts must be used within DraftProvider')
  return ctx
}
