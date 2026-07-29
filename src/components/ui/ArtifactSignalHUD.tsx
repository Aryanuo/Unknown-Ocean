import React, { useState, useEffect } from 'react'
import { useArtifactScannerStore, calculateDirection } from '../../store/useArtifactScannerStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { heroSubWorldPos, heroSubYaw } from '../ocean3d/Hero'
import './ArtifactSignalHUD.css'

export function ArtifactSignalHUD() {
  const {
    lastScanTime, isScanning, activeSignal, scanToast,
    triggerScan, clearToast, clearSignal,
  } = useArtifactScannerStore()

  const { activeWaypoint, clearActiveWaypoint, equipmentLevel } = usePlayerStore()
  const scannerLvl = equipmentLevel?.scanner ?? 0

  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [, setTick] = useState(0)

  // Real-time tracking data for active signal and active waypoint
  const [liveSignalDistance, setLiveSignalDistance] = useState<number | null>(null)
  const [liveSignalDir, setLiveSignalDir] = useState<{ cardinal: string; arrow: string } | null>(null)
  const [liveSignalDepth, setLiveSignalDepth] = useState<number | null>(null)

  const [liveWpDistance, setLiveWpDistance] = useState<number | null>(null)
  const [liveWpDir, setLiveWpDir] = useState<{ cardinal: string; arrow: string } | null>(null)

  const cooldownMs = scannerLvl >= 4 ? 8000 : scannerLvl === 3 ? 10000 : scannerLvl === 2 ? 12000 : scannerLvl === 1 ? 14000 : 15000

  // Tick every 200ms to update cooldown & live relative positions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastScanTime

      if (elapsed >= cooldownMs) {
        setCooldownLeft(0)
      } else {
        setCooldownLeft(Math.ceil((cooldownMs - elapsed) / 1000))
      }

      const subPos = heroSubWorldPos.current
      const yaw = heroSubYaw.current

      // Live update active signal distance & direction
      if (activeSignal) {
        const dx = activeSignal.position[0] - subPos.x
        const dz = activeSignal.position[2] - subPos.z
        const dy = activeSignal.position[1] - subPos.y
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz))

        setLiveSignalDistance(dist)
        setLiveSignalDepth(Math.round(dy))
        setLiveSignalDir(calculateDirection(dx, dz, yaw))
      } else {
        setLiveSignalDistance(null)
      }

      // Live update active waypoint distance & direction
      if (activeWaypoint) {
        const dx = activeWaypoint.position[0] - subPos.x
        const dz = activeWaypoint.position[2] - subPos.z
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz))

        setLiveWpDistance(dist)
        setLiveWpDir(calculateDirection(dx, dz, yaw))
      } else {
        setLiveWpDistance(null)
      }

      setTick(t => t + 1)
    }, 200)

    return () => clearInterval(interval)
  }, [lastScanTime, cooldownMs, activeSignal, activeWaypoint])

  // Clear toast automatically after 5 seconds
  useEffect(() => {
    if (scanToast) {
      const timer = setTimeout(clearToast, 5000)
      return () => clearTimeout(timer)
    }
  }, [scanToast, clearToast])

  return (
    <div className="artifact-signal-hud-root">
      {/* Toast Notification */}
      {scanToast && (
        <div className="artifact-toast glass">
          <span className="artifact-toast-icon">📡</span>
          <span>{scanToast}</span>
        </div>
      )}

      {/* Active Navigation Waypoint Card */}
      {activeWaypoint && liveWpDistance !== null && (
        <div className="waypoint-hud-card glass">
          <div className="wh-header">
            <span className="wh-tag text-mono">NAV WAYPOINT</span>
            <button className="wh-clear-btn" onClick={clearActiveWaypoint} title="Clear Waypoint">✕</button>
          </div>
          <div className="wh-body">
            <div className="wh-arrow-box">{liveWpDir?.arrow ?? '⬆'}</div>
            <div className="wh-info">
              <div className="wh-name">{activeWaypoint.name}</div>
              <div className="wh-meta text-mono">
                {liveWpDir?.cardinal} &nbsp;|&nbsp; {liveWpDistance}m AWAY
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detected Signal Indicator Card */}
      {activeSignal && liveSignalDistance !== null && (
        <div className="signal-hud-card glass">
          <div className="sh-header">
            <span className="sh-title text-mono">ARTIFACT SIGNAL DETECTED</span>
            <button className="sh-close-btn" onClick={clearSignal} title="Dismiss Signal">✕</button>
          </div>

          <div className="sh-content">
            <div className="sh-direction-box">
              <div className="sh-arrow">{liveSignalDir?.arrow ?? activeSignal.arrowIcon}</div>
              <div className="sh-cardinal text-mono">{liveSignalDir?.cardinal ?? activeSignal.cardinalDir}</div>
            </div>

            <div className="sh-details">
              <div className="sh-item-name">{activeSignal.name}</div>
              <div className="sh-distance text-mono">
                Approx. {liveSignalDistance} m
              </div>

              {(scannerLvl >= 4 || liveSignalDepth !== null) && (
                <div className="sh-depth text-mono">
                  {liveSignalDepth !== null && liveSignalDepth > 5
                    ? `▲ +${liveSignalDepth}m above`
                    : liveSignalDepth !== null && liveSignalDepth < -5
                    ? `▼ ${Math.abs(liveSignalDepth)}m below`
                    : '• Level depth'}
                </div>
              )}

              <div className="sh-strength-row text-mono">
                <span>Signal:</span>
                <span className={`sh-strength-val strength-${activeSignal.signalStrength.replace(/\s+/g, '-').toLowerCase()}`}>
                  {activeSignal.signalStrength}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Activation Button & Prompt */}
      <div className="scanner-btn-container">
        <button
          className={`scanner-trigger-btn glass ${cooldownLeft === 0 ? 'ready' : 'cooldown'} ${isScanning ? 'scanning' : ''}`}
          onClick={() => {
            const subPos = heroSubWorldPos.current
            const yaw = heroSubYaw.current
            triggerScan(subPos, yaw)
          }}
          id="btn-artifact-scanner"
          title="Activate Artifact Scanner (X)"
        >
          <span className="scanner-btn-icon">{isScanning ? '🌐' : '📡'}</span>
          <span className="scanner-btn-text text-mono">
            {isScanning ? 'SCANNING...' : cooldownLeft > 0 ? `CD ${cooldownLeft}S` : '[X] ARTIFACT SCANNER'}
          </span>
        </button>
      </div>
    </div>
  )
}
