import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Discovery } from '../../store/usePlayerStore'
import './DiscoveryAlert.css'

interface Props {
  discovery: Discovery
  onClose: () => void
}

export function DiscoveryAlert({ discovery, onClose }: Props) {
  const [naming, setNaming] = useState(false)
  const [customName, setCustomName] = useState(discovery.name)
  const [named, setNamed] = useState(false)

  useEffect(() => {
    if (!discovery.isFirstEver) {
      const timer = setTimeout(onClose, 7000)
      return () => clearTimeout(timer)
    }
  }, [discovery.isFirstEver, onClose])

  const handleName = () => {
    setNamed(true)
    setTimeout(onClose, 2000)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="discovery-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={!discovery.isFirstEver ? onClose : undefined}
        id="discovery-alert"
      >
        {/* Rings */}
        <div className="discovery-rings">
          <div className="discovery-ring ring-1" />
          <div className="discovery-ring ring-2" />
          <div className="discovery-ring ring-3" />
        </div>

        <motion.div
          className="discovery-panel glass"
          initial={{ scale: 0.7, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          onClick={e => e.stopPropagation()}
        >
          {discovery.isFirstEver && (
            <div className="discovery-first-badge">
              ⭐ WORLD FIRST DISCOVERY
            </div>
          )}

          <div className="discovery-header">
            <div className="discovery-new-label text-mono">NEW DISCOVERY</div>
            <div className="discovery-species-id text-mono">{discovery.speciesId}</div>
          </div>

          {/* Creature preview — animated SVG */}
          <div className="discovery-creature-preview">
            <CreaturePreview dna={discovery.dna} />
          </div>

          <div className="discovery-name text-cinematic">
            {named ? customName : discovery.name}
          </div>

          <div className="discovery-stats">
            <div className="discovery-stat">
              <span className="ds-label text-mono">DEPTH</span>
              <span className="ds-val">{discovery.depth.toLocaleString()} m</span>
            </div>
            <div className="discovery-stat">
              <span className="ds-label text-mono">TEMP</span>
              <span className="ds-val">{discovery.temperature.toFixed(1)}°C</span>
            </div>
            <div className="discovery-stat">
              <span className="ds-label text-mono">BIOME</span>
              <span className="ds-val">{discovery.biome}</span>
            </div>
            <div className="discovery-stat">
              <span className="ds-label text-mono">COORDS</span>
              <span className="ds-val">{discovery.coords.x}, {discovery.coords.y}</span>
            </div>
          </div>

          {discovery.isFirstEver && !named && (
            <div className="discovery-naming">
              {!naming ? (
                <button
                  className="discovery-name-btn"
                  onClick={() => setNaming(true)}
                  id="btn-name-species"
                >
                  Name this species
                </button>
              ) : (
                <div className="discovery-name-input-row">
                  <input
                    className="discovery-name-input"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Enter species name"
                    maxLength={40}
                    autoFocus
                    id="input-species-name"
                  />
                  <button
                    className="discovery-name-confirm"
                    onClick={handleName}
                    id="btn-confirm-name"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="discovery-close-btn" onClick={onClose} id="btn-close-discovery">
            Continue exploring →
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Mini SVG creature preview
function CreaturePreview({ dna }: { dna: Discovery['dna'] }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    let frame: number
    const animate = () => {
      setT(prev => prev + 0.04)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const bodyLen = 30 + dna.bodyLength * 15
  const bodyH   = 10 + dna.bodyWidth * 8
  const sway    = Math.sin(t * dna.speed * 1.5) * 8
  const tailWag = Math.sin(t * dna.speed * 2) * 12

  return (
    <svg width="220" height="120" viewBox="-110 -60 220 120" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="glow-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={dna.glowColor} stopOpacity={dna.glowIntensity * 0.8} />
          <stop offset="100%" stopColor={dna.glowColor} stopOpacity="0" />
        </radialGradient>
        <filter id="blur-f">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Glow */}
      {dna.glowIntensity > 0.2 && (
        <ellipse cx="0" cy={sway * 0.3} rx={bodyLen + 15} ry={bodyH + 15}
          fill="url(#glow-g)" filter="url(#blur-f)" />
      )}

      {/* Body */}
      <ellipse cx="0" cy={sway * 0.3} rx={bodyLen} ry={bodyH}
        fill={dna.primaryColor} opacity="0.85" />

      {/* Fins */}
      {Array.from({ length: Math.min(dna.finCount, 3) }).map((_, i) => {
        const fa = (i * Math.PI * 2) / Math.min(dna.finCount, 3) + Math.PI / 2
        const fx = Math.cos(fa) * bodyH * 0.8
        const fy = Math.sin(fa) * bodyH * 0.8 + sway * 0.3
        return (
          <ellipse key={i} cx={fx} cy={fy} rx={5 + i * 2} ry={9 + i * 3}
            fill={dna.primaryColor} opacity="0.6"
            transform={`rotate(${(fa * 180) / Math.PI}, ${fx}, ${fy})`} />
        )
      })}

      {/* Tail */}
      <path d={`M ${-bodyLen} ${sway * 0.3} Q ${-bodyLen - 12} ${tailWag} ${-bodyLen - 22} ${tailWag * 1.5}`}
        stroke={dna.primaryColor} strokeWidth={bodyH * 0.5} strokeLinecap="round" fill="none" opacity="0.8" />

      {/* Eyes */}
      {Array.from({ length: Math.min(dna.eyeCount, 2) }).map((_, i) => {
        const ex = bodyLen * 0.65
        const ey = (i === 0 ? -bodyH * 0.5 : bodyH * 0.5) + sway * 0.3
        return (
          <g key={i}>
            <circle cx={ex} cy={ey} r="3.5" fill="white" />
            <circle cx={ex + 0.8} cy={ey} r="1.8" fill="black" />
          </g>
        )
      })}
    </svg>
  )
}
