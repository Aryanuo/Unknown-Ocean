import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useWorldStore } from '../../store/useWorldStore'
import { BIOMES, BiomeType } from '../../engine/procedural/biomeGenerator'
import { heroSpeedRef } from '../ocean3d/Hero'
import './HUD.css'

interface HUDProps {
  onOpenLog: () => void
  onOpenEncyclopedia: () => void
  onOpenStats: () => void
  onPhotoMode: () => void
  currentBiome: BiomeType
}

export function HUD({ onOpenLog, onOpenEncyclopedia, onOpenStats, onPhotoMode, currentBiome }: HUDProps) {
  const { coords, depth, discoveries } = usePlayerStore()
  const biomeConf = BIOMES[currentBiome] || BIOMES.open
  const [prevBiome, setPrevBiome] = useState(currentBiome)
  const [biomeFlash, setBiomeFlash] = useState(false)
  const [speedPct, setSpeedPct] = useState(0)

  useEffect(() => {
    if (currentBiome !== prevBiome) {
      setBiomeFlash(true)
      setTimeout(() => setBiomeFlash(false), 2000)
      setPrevBiome(currentBiome)
    }
  }, [currentBiome, prevBiome])

  // Poll heroSpeedRef at 10fps for the speed gauge
  useEffect(() => {
    const id = setInterval(() => {
      setSpeedPct(Math.round(heroSpeedRef.current * 100))
    }, 100)
    return () => clearInterval(id)
  }, [])

  const pressure = depth > 0 ? (1 + depth / 10).toFixed(1) : '1.0'
  const temp     = Math.max(1, 25 - depth * 0.018).toFixed(1)
  const heading  = depth > 0 ? `${depth.toLocaleString()} m` : 'Surface'

  return (
    <div className="hud-root" id="hud">
      {/* Top-left: coordinates + depth */}
      <div className="hud-coords glass" id="hud-coords">
        <div className="hud-coords-label">POSITION</div>
        <div className="hud-coords-row">
          <span className="text-mono">X</span>
          <span className="hud-coord-val text-mono">{coords.x.toLocaleString()}</span>
        </div>
        <div className="hud-coords-row">
          <span className="text-mono">Y</span>
          <span className="hud-coord-val text-mono">{coords.y.toLocaleString()}</span>
        </div>
        <div className="hud-depth-bar">
          <div className="hud-depth-label text-mono">DEPTH</div>
          <div className="hud-depth-value text-mono">{heading}</div>
          <div className="hud-depth-track">
            <div
              className="hud-depth-fill"
              style={{ height: `${Math.min(depth / 11000 * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top-right: env data + speed */}
      <div className="hud-env glass" id="hud-env">
        <div className="hud-env-row">
          <span className="hud-env-label text-mono">TEMP</span>
          <span className="hud-env-val text-mono">{temp}°C</span>
        </div>
        <div className="hud-env-row">
          <span className="hud-env-label text-mono">PRES</span>
          <span className="hud-env-val text-mono">{pressure} atm</span>
        </div>
        <div className="hud-env-row">
          <span className="hud-env-label text-mono">FOUND</span>
          <span className="hud-env-val text-mono" style={{ color: 'var(--ocean-glow)' }}>
            {discoveries.length}
          </span>
        </div>

        {/* Speed gauge */}
        <div className="hud-env-row" style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
          <span className="hud-env-label text-mono">SPD</span>
          <span className="hud-env-val text-mono" style={{ color: speedPct > 70 ? '#00e5ff' : 'inherit' }}>
            {speedPct}%
          </span>
        </div>
        <div className="hud-speed-track">
          <div
            className="hud-speed-fill"
            style={{ width: `${speedPct}%`, background: speedPct > 70 ? '#00e5ff' : '#48cae4' }}
          />
        </div>
      </div>

      {/* Biome banner */}
      {biomeFlash && (
        <div className="hud-biome-banner" id="hud-biome">
          <div className="hud-biome-name text-cinematic">{biomeConf.name}</div>
          <div className="hud-biome-desc">{biomeConf.description}</div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="hud-nav" id="hud-nav">
        <button className="hud-nav-btn" onClick={onOpenLog} id="btn-log" title="Research Log">
          <span className="hud-nav-icon">📋</span>
          <span className="hud-nav-label">Log</span>
        </button>
        <button className="hud-nav-btn" onClick={onOpenEncyclopedia} id="btn-encyclopedia" title="Encyclopedia">
          <span className="hud-nav-icon">📖</span>
          <span className="hud-nav-label">Species</span>
        </button>
        <button className="hud-nav-btn" onClick={onOpenStats} id="btn-stats" title="Community Stats">
          <span className="hud-nav-icon">🌊</span>
          <span className="hud-nav-label">Ocean</span>
        </button>
        <button className="hud-nav-btn" onClick={onPhotoMode} id="btn-photo" title="Photo Mode">
          <span className="hud-nav-icon">📷</span>
          <span className="hud-nav-label">Photo</span>
        </button>
      </nav>

      {/* Controls panel */}
      <div className="hud-controls" id="hud-controls">
        <div className="hud-controls-row"><kbd>W</kbd><kbd>S</kbd><span>Forward / Reverse</span></div>
        <div className="hud-controls-row"><kbd>A</kbd><kbd>D</kbd><span>Turn Left / Right</span></div>
        <div className="hud-controls-row"><kbd>Q</kbd><kbd>E</kbd><span>Ascend / Descend</span></div>
        <div className="hud-controls-row"><kbd>Shift</kbd><span>Boost</span></div>
        <div className="hud-controls-row"><kbd>V</kbd><span>Camera View</span></div>
        <div className="hud-controls-row"><kbd>F</kbd><span>Headlights</span></div>
      </div>
    </div>
  )
}
