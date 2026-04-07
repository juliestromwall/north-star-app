export async function onRequestGet() {
  try {
    const res = await fetch('https://zenquotes.io/api/today')
    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return new Response(JSON.stringify([{ q: 'Every day is a chance to begin again.', a: 'Unknown' }]), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
