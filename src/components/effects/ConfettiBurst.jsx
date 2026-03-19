import React, { useCallback, useEffect, useRef, useState } from 'react'

function degToRad(deg) {
  return (deg * Math.PI) / 180
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min
}

class Particle {
  constructor(x, y, opts) {
    this.x = x
    this.y = y

    const angle = degToRad(randomRange(-opts.spread / 2, opts.spread / 2) - 90)
    const velocity = randomRange(opts.startVelocity * 0.4, opts.startVelocity)

    this.vx = Math.cos(angle) * velocity
    this.vy = Math.sin(angle) * velocity

    this.gravity = opts.gravity
    this.decay = opts.decay
    this.lifetime = opts.lifetime
    this.age = 0

    this.size = opts.scalar * randomRange(0.6, 1.2)
    this.rotation = randomRange(0, 360)
    this.rotationSpeed = randomRange(-8, 8)

    this.wobbleX = randomRange(-2, 2)
    this.wobbleY = randomRange(-1, 1)

    this.opacity = 1
  }

  update() {
    this.vx *= this.decay
    this.vy *= this.decay
    this.vy += this.gravity

    this.x += this.vx + this.wobbleX * Math.sin(this.age * 0.1)
    this.y += this.vy + this.wobbleY * Math.cos(this.age * 0.1)

    this.rotation += this.rotationSpeed
    this.age++

    const fadeStart = this.lifetime * 0.6
    if (this.age > fadeStart) {
      this.opacity = Math.max(0, 1 - (this.age - fadeStart) / (this.lifetime - fadeStart))
    }

    return this.age < this.lifetime
  }

  draw(ctx, img) {
    ctx.save()
    ctx.globalAlpha = this.opacity
    ctx.translate(this.x, this.y)
    ctx.rotate((this.rotation * Math.PI) / 180)

    const half = this.size / 2
    ctx.drawImage(img, -half, -half, this.size, this.size)

    ctx.restore()
  }
}

const DEFAULT_BUG_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <ellipse cx="32" cy="38" rx="18" ry="20" fill="#e53935"/>
  <line x1="32" y1="18" x2="32" y2="58" stroke="#222" stroke-width="2"/>
  <circle cx="24" cy="30" r="3.5" fill="#222"/>
  <circle cx="40" cy="30" r="3.5" fill="#222"/>
  <circle cx="26" cy="42" r="3" fill="#222"/>
  <circle cx="38" cy="42" r="3" fill="#222"/>
  <circle cx="32" cy="52" r="2.5" fill="#222"/>
  <circle cx="32" cy="20" r="9" fill="#222"/>
  <circle cx="28" cy="18" r="2" fill="#fff"/>
  <circle cx="36" cy="18" r="2" fill="#fff"/>
  <line x1="28" y1="13" x2="22" y2="5" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <line x1="36" y1="13" x2="42" y2="5" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <circle cx="22" cy="5" r="2" fill="#222"/>
  <circle cx="42" cy="5" r="2" fill="#222"/>
  <line x1="16" y1="32" x2="8"  y2="26" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <line x1="48" y1="32" x2="56" y2="26" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="6"  y2="40" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <line x1="50" y1="40" x2="58" y2="40" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <line x1="16" y1="48" x2="8"  y2="54" stroke="#222" stroke-width="2" stroke-linecap="round"/>
  <line x1="48" y1="48" x2="56" y2="54" stroke="#222" stroke-width="2" stroke-linecap="round"/>
</svg>
`)}` 

const ConfettiBurst = React.forwardRef(function ConfettiBurst(
  {
    particleCount = 40,
    spread = 360,
    startVelocity = 18,
    gravity = 0.35,
    decay = 0.94,
    lifetime = 90,
    scalar = 28,
    iconSrc,
    origin,
    zIndex = 9999,
    style,
    ...rest
  },
  ref
) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)
  const imgRef = useRef(null)
  const [imgReady, setImgReady] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImgReady(true)
    }
    img.src = iconSrc || DEFAULT_BUG_SVG
  }, [iconSrc])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement || document.body
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width || window.innerWidth
      canvas.height = rect.height || window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !imgRef.current) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    particlesRef.current = particlesRef.current.filter((p) => {
      const alive = p.update()
      if (alive || p.opacity > 0) {
        p.draw(ctx, imgRef.current)
        return true
      }
      return false
    })

    if (particlesRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [])

  const fire = useCallback((overrides = {}) => {
    const canvas = canvasRef.current
    if (!canvas || !imgReady) return

    const ox = overrides.origin?.x ?? origin?.x ?? 0.5
    const oy = overrides.origin?.y ?? origin?.y ?? 0.5

    const cx = canvas.width * ox
    const cy = canvas.height * oy

    const opts = {
      spread: overrides.spread ?? spread,
      startVelocity: overrides.startVelocity ?? startVelocity,
      gravity: overrides.gravity ?? gravity,
      decay: overrides.decay ?? decay,
      lifetime: overrides.lifetime ?? lifetime,
      scalar: overrides.scalar ?? scalar,
    }

    const count = overrides.particleCount ?? particleCount

    for (let i = 0; i < count; i++) {
      particlesRef.current.push(new Particle(cx, cy, opts))
    }

    if (!rafRef.current || particlesRef.current.length === count) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [animate, imgReady, particleCount, spread, startVelocity, gravity, decay, lifetime, scalar, origin])

  React.useImperativeHandle(ref, () => ({ fire }), [fire])

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex,
        ...style,
      }}
      {...rest}
    />
  )
})

export function useConfetti() {
  const ref = useRef(null)

  const fire = useCallback((overrides) => {
    ref.current?.fire(overrides)
  }, [])

  return { fire, ref }
}

export default ConfettiBurst
