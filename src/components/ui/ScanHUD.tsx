import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Discovery } from '../../store/usePlayerStore'
import { getBiomeAt } from '../../engine/procedural/biomeGenerator'
import './ScanHUD.css'

// ─── Scan state machine ───────────────────────────────────────────────────────
export type ScanPhase = 'idle' | 'selected' | 'scanning' | 'result'

export interface ScanState {
  phase: ScanPhase
  id?: string
  speciesId?: string
  name?: string
  dna?: any
  wx?: number
  wy?: number
  wz?: number
  progress?: number       // 0–100
  discovery?: Discovery
}

interface Props {
  scanState: ScanState
  playerName: string
  onScanStart: () => void
  onScanComplete: (d: Discovery) => void
  onDismiss: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
export function ScanHUD({
  scanState, playerName,
  onScanStart, onScanComplete, onDismiss,
}: Props) {
  const [naming, setNaming]       = useState(false)
  const [customName, setCustomName] = useState('')
  const [named, setNamed]         = useState(false)
  const progressRef = useRef(0)
  const scanningRef = useRef(false)
  const frameIdRef  = useRef<number>(0)

  // Reset naming state whenever a new scan result arrives
  useEffect(() => {
    if (scanState.phase === 'result') {
      setNaming(false)
      setCustomName(scanState.name ?? '')
      setNamed(false)
    }
    if (scanState.phase === 'idle') {
      setNaming(false)
      setNamed(false)
      progressRef.current = 0
      scanningRef.current = false
    }
  }, [scanState.phase, scanState.name])

  // ── Scan progress animation (rAF, not useFrame – pure UI) ─────────────────
  useEffect(() => {
    if (scanState.phase !== 'scanning') {
      cancelAnimationFrame(frameIdRef.current)
      scanningRef.current = false
      return
    }

    scanningRef.current = true
    progressRef.current = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      if (!scanningRef.current) return
      const dt = (now - lastTime) / 1000
      lastTime = now
      progressRef.current = Math.min(100, progressRef.current + dt * 33.3) // 3 seconds

      // Force re-render to show progress (only ScanHUD, not the 3D scene)
      setProgressDisplay(Math.floor(progressRef.current))

      if (progressRef.current >= 100) {
        scanningRef.current = false
        // Build discovery object
        const d = scanState
        const currentDepth = Math.round(Math.abs(d.wy ?? 0))
        const discovery: Discovery = {
          id:           (d.speciesId ?? '') + '-' + Date.now(),
          speciesId:    d.speciesId ?? 'UNKNOWN',
          name:         d.name ?? 'Unknown Species',
          discoveredBy: playerName,
          depth:        currentDepth,
          biome:        getBiomeAt(d.wx ?? 0, d.wz ?? 0, currentDepth),
          temperature:  Math.max(1, 25 - currentDepth * 0.018),
          coords:       { x: Math.round(d.wx ?? 0), y: Math.round(d.wz ?? 0) },
          timestamp:    Date.now(),
          dna:          d.dna,
          isFirstEver:  Math.random() > 0.7,
        }
        onScanComplete(discovery)
        return
      }
      frameIdRef.current = requestAnimationFrame(tick)
    }

    frameIdRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frameIdRef.current); scanningRef.current = false }
  }, [scanState.phase]) // eslint-disable-line

  const [progressDisplay, setProgressDisplay] = useState(0)

  const handleNameConfirm = () => {
    setNamed(true)
  }

  // ── Render based on phase ──────────────────────────────────────────────────
  if (scanState.phase === 'idle') return null

  if (scanState.phase === 'selected') {
    return (
      <div className="scan-hud scan-selected" id="scan-hud-selected">
        <div className="scan-pill">
          <div className="scan-pill-icon">◎</div>
          <div className="scan-pill-text">
            <span className="scan-unknown-label">Unknown Lifeform</span>
            <span className="scan-species-id">{scanState.speciesId}</span>
          </div>
          <button className="scan-btn-start" onClick={onScanStart} id="btn-scan-start">
            Scan
          </button>
          <button className="scan-btn-dismiss" onClick={onDismiss} title="Dismiss" id="btn-scan-dismiss">✕</button>
        </div>
      </div>
    )
  }

  if (scanState.phase === 'scanning') {
    return (
      <div className="scan-hud scan-active" id="scan-hud-active">
        <div className="scan-active-panel">
          <div className="scan-sonar-rings">
            <div className="scan-ring sr-1" />
            <div className="scan-ring sr-2" />
            <div className="scan-ring sr-3" />
          </div>
          <div className="scan-label text-mono">SCANNING UNKNOWN LIFEFORM</div>
          <div className="scan-species-id-sm text-mono">{scanState.speciesId}</div>
          <div className="scan-bar-wrap">
            <div className="scan-bar-fill" style={{ width: `${progressDisplay}%` }} />
          </div>
          <div className="scan-progress-pct text-mono">{progressDisplay}%</div>
        </div>
      </div>
    )
  }

  if (scanState.phase === 'result' && scanState.discovery) {
    const d = scanState.discovery
    const behavior = d.dna?.behavior ?? 'unknown'
    const approxSize = d.dna ? ((d.dna.size * 5).toFixed(1) + 'm') : '?'

    return (
      <div className="scan-hud scan-result" id="scan-hud-result">
        <div className="scan-result-card glass">
          <div className="src-header">
            <span className="src-new text-mono">NEW SPECIES DISCOVERED</span>
            <button className="src-close" onClick={onDismiss} id="btn-scan-result-close">✕</button>
          </div>

          <div className="src-species-id text-mono">{d.speciesId}</div>
          <div className="src-name text-cinematic">
            {named ? customName : d.name}
          </div>

          {d.isFirstEver && !named && (
            <div className="src-first-badge">⭐ WORLD FIRST DISCOVERY</div>
          )}

          <div className="src-stats">
            <div className="src-stat"><span className="src-label">DEPTH</span><span className="src-val">{d.depth.toLocaleString()} m</span></div>
            <div className="src-stat"><span className="src-label">BIOME</span><span className="src-val">{d.biome}</span></div>
            <div className="src-stat"><span className="src-label">TEMP</span><span className="src-val">{d.temperature.toFixed(1)}°C</span></div>
            <div className="src-stat"><span className="src-label">SIZE</span><span className="src-val">{approxSize}</span></div>
            <div className="src-stat"><span className="src-label">BEHAVIOR</span><span className="src-val">{behavior}</span></div>
            <div className="src-stat"><span className="src-label">COORDS</span><span className="src-val">{d.coords.x}, {d.coords.y}</span></div>
          </div>

          <div className="src-discovered-by text-mono">
            Discovered by {d.discoveredBy}
          </div>

          {d.isFirstEver && !named && (
            <div className="src-naming">
              {!naming ? (
                <button
                  className="src-name-btn"
                  onClick={() => setNaming(true)}
                  id="btn-name-discovery"
                >
                  Name this Discovery
                </button>
              ) : (
                <div className="src-name-row">
                  <input
                    className="src-name-input"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Enter species name…"
                    maxLength={40}
                    autoFocus
                    id="input-discovery-name"
                  />
                  <button
                    className="src-name-confirm"
                    onClick={handleNameConfirm}
                    id="btn-confirm-discovery-name"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="src-continue text-mono" onClick={onDismiss} id="btn-continue-exploring">
            Continue exploring →
          </button>
        </div>
      </div>
    )
  }

  return null
}
