import { useEffect } from 'react'

// True when this document is rendered inside a cross-origin (or any) iframe.
export function isEmbedded() {
  return typeof window !== 'undefined' && window.parent !== window
}

// Ask the host page to scroll so the iframe is visible at the top of its viewport.
// Safe to call even when not embedded (no-op).
export function scrollParentToIframeTop() {
  if (!isEmbedded()) return
  try {
    window.parent.postMessage({ type: 'abc:scroll-to-top' }, '*')
  } catch {}
}

// When rendered inside a cross-origin iframe (e.g. embedded on ABC's marketing site),
// report our current document height to the parent so it can resize the iframe.
// Parent can listen: window.addEventListener('message', e => { if (e.data?.type === 'abc:height') iframe.style.height = e.data.height + 'px' })
export function useIframeHeightReporter() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return
    const post = () => {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      )
      window.parent.postMessage({ type: 'abc:height', height: h }, '*')
    }
    post()
    const ro = new ResizeObserver(post)
    ro.observe(document.documentElement)
    const onResize = () => post()
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])
}
