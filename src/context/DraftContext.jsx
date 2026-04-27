import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { getGmailSendAs } from '@/lib/google'

const DraftContext = createContext(null)

let nextDraftId = 1

export function DraftProvider({ children }) {
  const [drafts, setDrafts] = useState([])
  const sendAsCache = useRef({ userId: null, info: null, loading: false })

  // Fetch and cache sendAs info (displayName + email + signature)
  const fetchSendAs = useCallback(async (userId) => {
    if (!userId) return null
    if (sendAsCache.current.userId === userId && sendAsCache.current.info) {
      return sendAsCache.current.info
    }
    if (sendAsCache.current.loading) return null
    sendAsCache.current.loading = true
    try {
      const info = await getGmailSendAs(userId)
      sendAsCache.current = { userId, info, loading: false }
      return info
    } catch (e) {
      console.warn('sendAs fetch failed:', e)
      sendAsCache.current = { userId, info: { displayName: '', sendAsEmail: '', signature: '' }, loading: false }
      return sendAsCache.current.info
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
      // Reply All: include all To + CC recipients (minus self)
      if (replyTo._replyAll && userId) {
        const myEmail = replyTo._myEmail || ''
        const allTo = (replyTo.to || '').split(',').map(e => e.trim()).filter(Boolean)
        const allCc = (replyTo.cc || '').split(',').map(e => e.trim()).filter(Boolean)
        const everyone = [...allTo, ...allCc, fromEmail].filter(Boolean)
        const unique = [...new Set(everyone.map(e => (e.match(/<([^>]+)>/)?.[1] || e).toLowerCase()))]
        const withoutMe = unique.filter(e => e !== myEmail.toLowerCase())
        initialTo = fromEmail || ''
        cc = withoutMe.filter(e => e !== (fromEmail?.match(/<([^>]+)>/)?.[1] || fromEmail)?.toLowerCase()).join(', ')
      }
    } else if (forwardMsg) {
      initialTo = ''
      initialSubject = `Fwd: ${forwardMsg.subject || ''}`
      initialBody = `<p></p><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:12px;color:#666">---------- Forwarded message ----------<br/>From: ${forwardMsg.from}<br/>Date: ${forwardMsg.date}<br/>Subject: ${forwardMsg.subject}<br/><br/>${forwardMsg.bodyHtml || ''}</div>`
    } else if (!body) {
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
      showCcBcc: true,
      senderInfoLoading: Boolean(userId),
    }

    setDrafts(prev => [...prev, draft])

    // Backfill sendAs info (display name for From header + signature) async
    fetchSendAs(userId).then(info => {
      if (!info) return
      setDrafts(prev => prev.map(d => {
        if (d.id !== id) return d
        return {
          ...d,
          signatureHtml: d.signatureHtml || info.signature || '',
          senderName: d.senderName || info.displayName || '',
          senderEmail: d.senderEmail || info.sendAsEmail || '',
          senderInfoLoading: false,
        }
      }))
    }).catch(() => {
      setDrafts(prev => prev.map(d => (
        d.id === id ? { ...d, senderInfoLoading: false } : d
      )))
    })

    return id
  }, [fetchSendAs])

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
