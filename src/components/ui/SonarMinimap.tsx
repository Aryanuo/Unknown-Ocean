import { useState, useEffect } from 'react'
import { useSonarStore } from '../../store/useSonarStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { heroSubYaw } from '../ocean3d/Hero'
import './SonarMinimap.css'

const BLIP_LIFETIME_MS = 8000

const BLIP_COLORS: Record<string, string> = {
  common:    '#90a4ae',
  uncommon:  '#66bb6a',
  rare:      '#42a5f5',
  epic:      '#ce93d8',
  legendary: '#ffc300',
  mythical:  '#ff006e',
}

export function SonarMinimap() {
  const { lastPingTime, isPinging, blips, triggerPing, pruneExpiredBlips } = useSonarStore()
  const sonarLvl = usePlayerStore((s) => s.equipmentLevel?.sonar ?? 0)

  const [, setTick] = useState(0)      // used only to force re-render for blip fade
  const [cooldownPct, setCooldownPct] = useState(100)
  const [cooldownLeft, setCooldownLeft] = useState(0)

  // Tick every 250ms to update cooldown display AND blip fade
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastPingTime
      const totalCooldown = 10000

      if (elapsed >= totalCooldown) {
        setCooldownPct(100)
        setCooldownLeft(0)
      } else {
        setCooldownPct((elapsed / totalCooldown) * 100)
        setCooldownLeft(Math.ceil((totalCooldown - elapsed) / 1000))
      }

      // Trigger blip age re-render and prune expired blips
      setTick(t => t + 1)
      pruneExpiredBlips()
    }, 250)

    return () => clearInterval(interval)
  }, [lastPingTime, pruneExpiredBlips])

  const maxRange = 500 * (sonarLvl >= 1 ? 1.5 : 1.0)
  const mapRadius = 70 // pixels from center in 160px container
  const now = Date.now()

  return (
    <div className={`sonar-minimap-root glass ${isPinging ? 'pinging' : ''}`} id="sonar-minimap">
      <div className="minimap-circle">
        {/* Range rings */}
        <div className="ring r1" />
        <div className="ring r2" />

        {/* Crosshairs */}
        <div className="crosshair-v" />
        <div className="crosshair-h" />

        {/* Radar sweep */}
        <div className={`radar-sweep ${isPinging ? 'sweeping' : ''}`} />

        {/* Submarine center marker & heading arrow */}
        <div
          className="sub-center-container"
          style={{ transform: `translate(-50%, -50%) rotate(${-(heroSubYaw.current * (180 / Math.PI))}deg)` }}
        >
          <div className="sub-heading-arrow" />
          <div className="sub-center-dot" />
        </div>

        {/* Blips with age-based fade */}
        {blips.map((b) => {
          // Clamp relative coords to map radius
          const nx = (b.relX / maxRange) * mapRadius
          const ny = (b.relZ / maxRange) * mapRadius

          // Clamp within circle radius
          const distFromCenter = Math.sqrt(nx * nx + ny * ny)
          if (distFromCenter > mapRadius) return null

          const color = BLIP_COLORS[b.rarity] || BLIP_COLORS.common
          const age = now - b.timestamp
          const lifeFrac = Math.max(0, 1 - age / BLIP_LIFETIME_MS)
          const opacity = lifeFrac

          const relYRounded = Math.round(b.relY ?? 0)
          const depthLabel = relYRounded > 0 ? `▲ +${relYRounded}m` : relYRounded < 0 ? `▼ ${relYRounded}m` : `• 0m`

          return (
            <div
              key={b.id}
              className="sonar-blip"
              title={`Distance: ${Math.round(b.distance)}m | Vertical: ${depthLabel} (${b.rarity})`}
              style={{
                left: `calc(50% + ${nx}px)`,
                top: `calc(50% + ${ny}px)`,
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}`,
                opacity,
              }}
            >
              <span className="blip-vertical-indicator text-mono">
                {relYRounded > 5 ? '▲' : relYRounded < -5 ? '▼' : '='}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bottom info & keybind prompt */}
      <div className="minimap-info text-mono">
        <div className="mi-top">
          <span className="mi-label">SONAR</span>
          <span className="mi-range">{Math.round(maxRange)}M</span>
        </div>

        <button
          className={`sonar-ping-btn ${cooldownLeft === 0 ? 'ready' : 'cooldown'}`}
          onClick={() => {
            // Read current hero pos if available
            const heroPos = (window as any).__heroSubPos
            if (heroPos) triggerPing(heroPos)
          }}
          title="Trigger sonar ping (R)"
        >
          {cooldownLeft > 0 ? (
            <span>CD {cooldownLeft}S</span>
          ) : (
            <span>[R] PING</span>
          )}
        </button>

        {/* Blip count */}
        {blips.length > 0 && (
          <div className="mi-blip-count">
            {blips.length} CONTACT{blips.length !== 1 ? 'S' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
