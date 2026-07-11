import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { motion } from 'framer-motion'
import './DiveTransition.css'

export default function DiveTransition() {
  const setPhase = useAppStore(s => s.setPhase)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef<number>(0)
  const startTime = useRef(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const W = canvas.width, H = canvas.height
    const start = Date.now()
    const DURATION = 3800 // ms

    function drawFrame() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / DURATION, 1)
      const ease = 1 - Math.pow(1 - progress, 4) // ease-in-quart

      ctx.clearRect(0, 0, W, H)

      // Phase 0–0.3: surface splash
      // Phase 0.3–0.7: underwater transition
      // Phase 0.7–1.0: deep blue emergence

      // Background blending
      const surfaceColor = { r: 13,  g: 61,  b: 107 }
      const deepColor    = { r: 2,   g: 13,  b: 26  }
      const r = Math.round(surfaceColor.r + (deepColor.r - surfaceColor.r) * ease)
      const g = Math.round(surfaceColor.g + (deepColor.g - surfaceColor.g) * ease)
      const b = Math.round(surfaceColor.b + (deepColor.b - surfaceColor.b) * ease)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(0, 0, W, H)

      // Caustic light rays (appear as we go under)
      if (progress > 0.15) {
        const rayAlpha = Math.min((progress - 0.15) / 0.4, 1) * 0.18
        ctx.save()
        ctx.globalAlpha = rayAlpha * (1 - Math.max(0, (progress - 0.7) / 0.3))
        for (let i = 0; i < 8; i++) {
          const rayX  = W * (0.1 + i * 0.11 + Math.sin(progress * 4 + i) * 0.04)
          const angle = -0.15 + (i % 3) * 0.15
          ctx.save()
          ctx.translate(rayX, -30)
          ctx.rotate(angle)
          const rl = ctx.createLinearGradient(0, 0, 0, H * 0.8)
          rl.addColorStop(0, 'rgba(144,224,239,0.5)')
          rl.addColorStop(1, 'rgba(0,119,182,0)')
          ctx.fillStyle = rl
          ctx.beginPath()
          ctx.moveTo(-15 - i * 2, 0)
          ctx.lineTo(15 + i * 2, 0)
          ctx.lineTo(30 + i * 3, H * 0.9)
          ctx.lineTo(-30 - i * 3, H * 0.9)
          ctx.fill()
          ctx.restore()
        }
        ctx.restore()
      }

      // Bubble particles
      if (progress > 0.1 && progress < 0.85) {
        const numBubbles = Math.floor(progress * 35)
        ctx.save()
        for (let i = 0; i < numBubbles; i++) {
          const bx = W * ((i * 0.0731 + progress * 0.3 + i * 0.04) % 1)
          const by = H * ((1 - progress) * 0.5 + (i * 0.067) % 0.5) - progress * 20
          const br = 1 + (i % 5) * 1.5
          ctx.beginPath()
          ctx.arc(bx, by, br, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(144,224,239,${0.3 + (i % 3) * 0.15})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }
        ctx.restore()
      }

      // Surface water shimmer
      if (progress < 0.55) {
        const shimmerY = H * (0.5 - progress * 0.8) + progress * H * 0.2
        const shimmerAlpha = Math.max(0, (0.55 - progress) / 0.55)
        ctx.save()
        ctx.globalAlpha = shimmerAlpha * 0.7
        for (let x = 0; x < W; x += 3) {
          const wave = Math.sin(x * 0.02 + progress * 15) * 6
          const col = ctx.createLinearGradient(x, shimmerY + wave, x, shimmerY + wave + 40)
          col.addColorStop(0, 'rgba(202,240,248,0.6)')
          col.addColorStop(1, 'transparent')
          ctx.fillStyle = col
          ctx.fillRect(x, shimmerY + wave, 2, 40)
        }
        ctx.restore()
      }

      // Bioluminescent particles emerge at depth
      if (progress > 0.6) {
        const partAlpha = (progress - 0.6) / 0.4
        for (let i = 0; i < 30; i++) {
          const px = W * ((i * 0.0913 + progress * 0.1) % 1)
          const py = H * (0.2 + (i * 0.0731) % 0.7)
          const pr = 0.8 + (i % 4) * 0.8
          const glow = ctx.createRadialGradient(px, py, 0, px, py, pr * 4)
          glow.addColorStop(0, `rgba(144,224,239,${partAlpha * 0.8})`)
          glow.addColorStop(1, 'transparent')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(px, py, pr * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Vignette
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.2, W/2, H/2, H)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, `rgba(0,5,8,${0.3 + ease * 0.5})`)
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(drawFrame)
      } else {
        setTimeout(() => setPhase('ocean'), 200)
      }
    }

    drawFrame()
    return () => cancelAnimationFrame(frameRef.current)
  }, [setPhase])

  return (
    <div className="dive-root">
      <canvas ref={canvasRef} className="dive-canvas" />
      <motion.div
        className="dive-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ delay: 0.8, duration: 2.5 }}
      >
        Descending...
      </motion.div>
    </div>
  )
}
