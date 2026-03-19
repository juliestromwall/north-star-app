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

    this.kind = Math.random() < opts.iconRate ? 'icon' : 'confetti'
    const baseSize = this.kind === 'icon' ? (opts.iconScalar ?? opts.scalar) : opts.scalar
    this.size = baseSize * randomRange(0.65, 1.2)
    this.rotation = randomRange(0, 360)
    this.rotationSpeed = randomRange(-12, 12)

    this.wobbleX = randomRange(-2, 2)
    this.wobbleY = randomRange(-1, 1)
    this.shape = Math.random() < 0.75 ? 'rect' : 'circle'
    this.width = this.size * randomRange(0.55, 1)
    this.height = this.size * randomRange(0.28, 0.62)
    this.color = opts.colors[Math.floor(Math.random() * opts.colors.length)]

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

    const fadeStart = this.lifetime * 0.72
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
    if (this.kind === 'icon' && img) {
      const half = this.size / 2
      ctx.drawImage(img, -half, -half, this.size, this.size)
    } else {
      ctx.fillStyle = this.color
      if (this.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height)
      }
    }

    ctx.restore()
  }
}

const DEFAULT_CONFETTI_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFB3AB"/>
      <stop offset="100%" stop-color="#464DA0"/>
    </linearGradient>
  </defs>
  <rect x="5" y="8" width="26" height="20" rx="5" fill="url(#g1)"/>
  <rect x="8" y="11" width="20" height="4" rx="2" fill="rgba(255,255,255,.55)"/>
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
    iconScalar,
    iconRate = 0.22,
    colors = ['#FFB3AB', '#464DA0', '#FDBA74', '#F43F5E', '#10B981', '#60A5FA', '#FDE047'],
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
    img.src = iconSrc || DEFAULT_CONFETTI_SVG
  }, [iconSrc])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

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
    if (!canvas || (!imgReady && iconRate > 0)) return

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
      iconScalar: overrides.iconScalar ?? iconScalar,
      iconRate: overrides.iconRate ?? iconRate,
      colors: overrides.colors ?? colors,
    }

    const count = overrides.particleCount ?? particleCount

    for (let i = 0; i < count; i++) {
      particlesRef.current.push(new Particle(cx, cy, opts))
    }

    if (!rafRef.current || particlesRef.current.length === count) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [animate, imgReady, particleCount, spread, startVelocity, gravity, decay, lifetime, scalar, iconScalar, iconRate, colors, origin])

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
