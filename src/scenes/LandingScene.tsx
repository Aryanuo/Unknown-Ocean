import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { motion, AnimatePresence } from 'framer-motion'
import './LandingScene.css'

export default function LandingScene() {
  const setPhase = useAppStore(s => s.setPhase)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function drawScene() {
      const W = canvas.width
      const H = canvas.height
      t += 0.008

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62)
      sky.addColorStop(0,   '#020a1a')
      sky.addColorStop(0.3, '#041627')
      sky.addColorStop(0.7, '#0a2a4a')
      sky.addColorStop(1,   '#0d3d6b')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Stars
      ctx.save()
      const starSeed = [0.13, 0.27, 0.41, 0.59, 0.73, 0.87, 0.19, 0.33, 0.55, 0.69, 0.81, 0.95,
                        0.07, 0.23, 0.47, 0.63, 0.77, 0.91, 0.05, 0.35, 0.51, 0.67, 0.89, 0.97]
      starSeed.forEach((s, i) => {
        const sx = (s * 0.9 + i * 0.04) * W
        const sy = ((s * 1.3 + i * 0.03) % 0.55) * H * 0.65
        const r  = 0.4 + s * 1.1
        const alpha = 0.3 + Math.sin(t * 1.5 + i) * 0.2
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(202,240,248,${alpha})`
        ctx.fill()
      })
      ctx.restore()

      // Moon glow
      const moonX = W * 0.82, moonY = H * 0.12
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 120)
      moonGlow.addColorStop(0, 'rgba(202,240,248,0.12)')
      moonGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = moonGlow
      ctx.fillRect(0, 0, W, H)
      ctx.beginPath()
      ctx.arc(moonX, moonY, 22, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(220,245,255,0.9)'
      ctx.shadowBlur = 30
      ctx.shadowColor = 'rgba(144,224,239,0.6)'
      ctx.fill()
      ctx.shadowBlur = 0

      // Clouds
      ctx.save()
      ctx.globalAlpha = 0.12
      ;[
        { x: 0.1, y: 0.22, w: 280, speed: 0.4 },
        { x: 0.35, y: 0.18, w: 360, speed: 0.25 },
        { x: 0.62, y: 0.28, w: 240, speed: 0.35 },
        { x: 0.78, y: 0.35, w: 200, speed: 0.3 },
      ].forEach(c => {
        const cx = (c.x * W + t * c.speed * 30) % (W + c.w) - c.w / 2
        const cy = c.y * H
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.w / 2)
        g.addColorStop(0, '#90b4d0')
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(cx, cy, c.w / 2, c.w / 8, 0, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.restore()

      // Water horizon glow
      const horizonY = H * 0.62
      const horizGlow = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 20)
      horizGlow.addColorStop(0, 'rgba(0,180,216,0.18)')
      horizGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = horizGlow
      ctx.fillRect(0, horizonY - 40, W, 60)

      // Ocean waves
      const waterGrad = ctx.createLinearGradient(0, horizonY, 0, H)
      waterGrad.addColorStop(0,   '#0d3d6b')
      waterGrad.addColorStop(0.15,'#0a2a4a')
      waterGrad.addColorStop(0.4, '#041627')
      waterGrad.addColorStop(1,   '#020d1a')
      ctx.fillStyle = waterGrad
      ctx.beginPath()
      ctx.moveTo(0, H)
      ctx.lineTo(0, horizonY)

      const waveCount = 6
      for (let wx = 0; wx <= W; wx += 4) {
        const wave =
          Math.sin(wx * 0.012 + t * 1.3) * 6 +
          Math.sin(wx * 0.007 + t * 0.9 + 1) * 4 +
          Math.sin(wx * 0.02  + t * 1.8 + 2) * 2
        ctx.lineTo(wx, horizonY + wave)
      }
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fill()

      // Wave foam/reflection lines
      for (let i = 0; i < 4; i++) {
        const wy = horizonY + 8 + i * 14
        ctx.beginPath()
        ctx.globalAlpha = 0.04 + i * 0.01
        for (let wx = 0; wx <= W; wx += 3) {
          const wave = Math.sin(wx * 0.018 + t * 1.1 + i) * 4
          if (wx === 0) ctx.moveTo(wx, wy + wave)
          else ctx.lineTo(wx, wy + wave)
        }
        ctx.strokeStyle = '#90e0ef'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Moonlight reflection
      const reflX = moonX, reflY = horizonY
      const refl = ctx.createLinearGradient(reflX - 60, reflY, reflX + 60, reflY + H * 0.3)
      refl.addColorStop(0, 'rgba(202,240,248,0.08)')
      refl.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = refl
      ctx.beginPath()
      ctx.moveTo(reflX - 20, reflY)
      ctx.lineTo(reflX + 20, reflY)
      ctx.lineTo(reflX + 90, H)
      ctx.lineTo(reflX - 90, H)
      ctx.closePath()
      ctx.fill()

      animFrameRef.current = requestAnimationFrame(drawScene)
    }

    drawScene()
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const handleDive = () => {
    setPhase('diving')
  }

  return (
    <div className="landing-root">
      <canvas ref={canvasRef} className="landing-canvas" />

      <div className="landing-overlay">
        <motion.div
          className="landing-text-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 2 }}
        >
          <motion.p
            className="landing-stat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 1.5 }}
          >
            95% of this ocean has never been explored.
          </motion.p>

          <motion.div
            className="landing-divider"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 3.2, duration: 1.2 }}
          />

          <motion.button
            className="landing-cta"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.8, duration: 1 }}
            onClick={handleDive}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            id="begin-expedition-btn"
          >
            Begin your expedition
            <span className="landing-cta-arrow">↓</span>
          </motion.button>
        </motion.div>

        <motion.div
          className="landing-scroll-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ delay: 5, duration: 2.5, repeat: Infinity }}
        >
          CLICK TO DIVE
        </motion.div>
      </div>
    </div>
  )
}
