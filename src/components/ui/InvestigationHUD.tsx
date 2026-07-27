/**
 * InvestigationHUD.tsx — Overlay shown when player investigates a hidden mystery
 */
import { useState, useEffect } from 'react'
import { MysteryInstance } from '../../engine/procedural/mysteryGenerator'
import './InvestigationHUD.css'

const RARITY_COLORS: Record<string, string> = {
  uncommon:  '#66bb6a',
  rare:      '#42a5f5',
  epic:      '#ce93d8',
  legendary: '#ffc300',
}

const RARITY_LABELS: Record<string, string> = {
  uncommon:  'UNCOMMON DISCOVERY',
  rare:      'RARE DISCOVERY',
  epic:      'EPIC DISCOVERY',
  legendary: '✦ LEGENDARY DISCOVERY ✦',
}

const TYPE_ICONS: Record<string, string> = {
  abandoned_lab:    '🔬',
  ancient_ruins:    '🏛️',
  ghost_submarine:  '🚢',
  giant_fossil:     '🦴',
  alien_obelisk:    '👁️',
  mysterious_eggs:  '🥚',
  shipwreck:        '⚓',
}

interface Props {
  mystery: MysteryInstance
  isNew: boolean
  rpGained: number
  onClose: () => void
}

export function InvestigationHUD({ mystery, isNew, rpGained, onClose }: Props) {
  const [phase, setPhase] = useState<'scan' | 'reveal' | 'artifact'>('scan')
  const [scanProgress, setScanProgress] = useState(0)

  const { def } = mystery
  const rarityColor = RARITY_COLORS[def.rarity] || '#90a4ae'
  const rarityLabel = RARITY_LABELS[def.rarity] || 'DISCOVERY'
  const icon = TYPE_ICONS[def.type] || '🔍'

  // 2.5s scan → reveal → artifact (if applicable)
  useEffect(() => {
    let frame: number
    const start = performance.now()

    const tick = () => {
      const elapsed = performance.now() - start
      const progress = Math.min(elapsed / 2500, 1)
      setScanProgress(progress)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        setTimeout(() => setPhase('reveal'), 200)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleCollectArtifact = () => {
    if (def.artifactName) setPhase('artifact')
  }

  return (
    <div className="investigation-overlay" id="investigation-hud">
      {/* Backdrop blur */}
      <div className="investigation-backdrop" onClick={onClose} />

      <div className="investigation-card glass" style={{ '--rarity-color': rarityColor } as any}>

        {/* Header */}
        <div className="inv-header">
          <div className="inv-icon">{icon}</div>
          <div className="inv-header-text">
            <div className="inv-rarity-label" style={{ color: rarityColor }}>{rarityLabel}</div>
            <div className="inv-name text-cinematic">{def.name}</div>
          </div>
          <button className="inv-close-btn" onClick={onClose} id="inv-close">✕</button>
        </div>

        {/* Scan phase */}
        {phase === 'scan' && (
          <div className="inv-scan-phase">
            <div className="inv-scan-ring">
              <svg viewBox="0 0 100 100" className="inv-scan-svg">
                <circle cx="50" cy="50" r="42" className="inv-scan-track" />
                <circle
                  cx="50" cy="50" r="42"
                  className="inv-scan-fill"
                  style={{
                    strokeDasharray: `${scanProgress * 264} 264`,
                    stroke: rarityColor,
                  }}
                />
              </svg>
              <div className="inv-scan-pct" style={{ color: rarityColor }}>
                {Math.round(scanProgress * 100)}%
              </div>
            </div>
            <div className="inv-scan-label text-mono">ANALYZING ANOMALY…</div>
          </div>
        )}

        {/* Reveal phase */}
        {phase === 'reveal' && (
          <div className="inv-reveal-phase">
            {isNew && (
              <div className="inv-new-badge" style={{ background: rarityColor }}>
                FIRST CONTACT
              </div>
            )}

            <div className="inv-lore-text">{def.lore}</div>

            <div className="inv-reward-row">
              <div className="inv-rp-gain" style={{ color: '#ffd60a' }}>
                +{rpGained} RP
              </div>
              {def.artifactName && isNew && (
                <button
                  className="inv-artifact-btn"
                  style={{ borderColor: rarityColor, color: rarityColor }}
                  onClick={handleCollectArtifact}
                  id="btn-collect-artifact"
                >
                  🗂 Collect Artifact
                </button>
              )}
            </div>

            <button className="inv-dismiss-btn" onClick={onClose} id="btn-inv-dismiss">
              Log Discovery
            </button>
          </div>
        )}

        {/* Artifact phase */}
        {phase === 'artifact' && def.artifactName && (
          <div className="inv-artifact-phase">
            <div className="inv-artifact-title text-mono">ARTIFACT RECOVERED</div>
            <div className="inv-artifact-name" style={{ color: rarityColor }}>
              {def.artifactName}
            </div>
            <div className="inv-artifact-lore">{def.artifactLore}</div>
            <button className="inv-dismiss-btn" onClick={onClose} id="btn-artifact-done">
              Secure Artifact
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
