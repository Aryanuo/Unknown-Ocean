import { useState } from 'react'
import type { RefObject } from 'react'
import { usePlayerStore, SavedPhoto } from '../../store/usePlayerStore'
import { useWorldStore } from '../../store/useWorldStore'
import { calculatePhotoScore, PhotoScoreResult } from '../../engine/photography/photoScorer'
import './Panel.css'

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>
  onClose: () => void
}

const RARITY_COLORS: Record<string, string> = {
  common:    '#90a4ae',
  uncommon:  '#66bb6a',
  rare:      '#42a5f5',
  epic:      '#ce93d8',
  legendary: '#ffc300',
  mythical:  '#ff006e',
}

export function PhotoMode({ canvasRef, onClose }: Props) {
  const addPhoto = usePlayerStore((s) => s.addPhoto)
  const playerDepth = usePlayerStore((s) => s.depth)
  const equipmentLevel = usePlayerStore((s) => s.equipmentLevel)
  const currentBiome = useWorldStore((s) => s.currentBiome)

  const cameraLvl = equipmentLevel?.camera ?? 0
  const [photoResult, setPhotoResult] = useState<{
    photo: SavedPhoto
    result: PhotoScoreResult
  } | null>(null)

  const handleCapture = () => {
    const canvas = canvasRef.current || document.querySelector('canvas')
    if (!canvas) {
      console.warn('Canvas element not found for Photo Mode capture')
      return
    }

    try {
      const result = calculatePhotoScore(cameraLvl)
      const dataUrl = canvas.toDataURL('image/png')
      const timestamp = Date.now()

      const savedPhoto: SavedPhoto = {
        id: `photo_${timestamp}`,
        dataUrl,
        timestamp,
        score: result.score,
        rpEarned: result.rpEarned,
        subjectName: result.subjectName,
        subjectRarity: result.subjectRarity,
        subjectBehavior: result.subjectBehavior,
        biome: currentBiome || 'Ocean',
        depth: playerDepth,
        creaturesCount: result.creaturesCount,
      }

      addPhoto(savedPhoto)
      setPhotoResult({ photo: savedPhoto, result })
    } catch (err) {
      console.error('Failed to capture photo:', err)
    }
  }

  const handleDownload = () => {
    if (!photoResult) return
    const link = document.createElement('a')
    link.download = `ocean-photo-${photoResult.photo.timestamp}.png`
    link.href = photoResult.photo.dataUrl
    link.click()
  }

  return (
    <div className="photo-mode" id="photo-mode">
      {/* Top-Right Exit Button — Always accessible */}
      <button className="photo-top-close-btn" onClick={onClose} id="btn-top-exit-photo" title="Exit Photo Mode">
        ✕
      </button>

      {/* Viewfinder frame */}
      <div className="photo-corners">
        <div className="photo-corner tl" />
        <div className="photo-corner tr" />
        <div className="photo-corner bl" />
        <div className="photo-corner br" />
      </div>

      {/* Grid overlay for Camera Upgrade Level 1+ */}
      {cameraLvl >= 1 && (
        <div className="photo-grid-overlay">
          <div className="pgo-line h1" />
          <div className="pgo-line h2" />
          <div className="pgo-line v1" />
          <div className="pgo-line v2" />
        </div>
      )}

      {/* Mode Indicator */}
      <div className="photo-label text-mono">
        PHOTO MODE — CAMERA LVL {cameraLvl} {cameraLvl >= 1 ? '• RULE OF THIRDS GRID' : ''}
      </div>

      {/* Capture Controls */}
      {!photoResult && (
        <div className="photo-controls">
          <button className="photo-capture-btn" onClick={handleCapture} id="btn-capture-photo">
            <span className="photo-capture-ring" />
            📷
          </button>
          <button className="photo-exit-btn" onClick={onClose} id="btn-exit-photo">
            Exit Photo Mode
          </button>
        </div>
      )}

      {/* Photo Result Modal */}
      {photoResult && (
        <div className="photo-result-overlay">
          <div className="photo-result-card glass">
            <div className="prc-header">
              <div className="prc-title text-cinematic">Snapshot Analysis</div>
              <div
                className="prc-rarity-badge text-mono"
                style={{
                  color: RARITY_COLORS[photoResult.result.subjectRarity] || '#00e5ff',
                  borderColor: RARITY_COLORS[photoResult.result.subjectRarity] || '#00e5ff',
                }}
              >
                {photoResult.result.subjectRarity.toUpperCase()}
              </div>
            </div>

            {/* Thumbnail Preview */}
            <div className="prc-preview">
              <img src={photoResult.photo.dataUrl} alt="Captured photo" className="prc-img" />
              <div className="prc-score-overlay">
                <span className="prc-score-num text-mono">{photoResult.result.score}</span>
                <span className="prc-score-label text-mono">PTS</span>
              </div>
            </div>

            {/* Subject details & RP reward */}
            <div className="prc-subject-row">
              <div>
                <div className="prc-subject-name">{photoResult.result.subjectName}</div>
                <div className="prc-subject-meta text-mono">
                  {photoResult.result.creaturesCount} SUBJECT(S) IN FRAME • BEHAVIOR: {photoResult.result.subjectBehavior.toUpperCase()}
                </div>
              </div>
              <div className="prc-rp-badge">
                <span className="prc-rp-val">+{photoResult.result.rpEarned}</span>
                <span className="prc-rp-unit text-mono">RP</span>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="prc-breakdown">
              <div className="prc-bd-row text-mono">
                <span>BASE COMPOSITION</span>
                <span>+{photoResult.result.breakdown.basePoints} PTS</span>
              </div>
              <div className="prc-bd-row text-mono">
                <span>RARITY MULTIPLIER</span>
                <span>{photoResult.result.breakdown.rarityMultiplier.toFixed(1)}x</span>
              </div>
              {photoResult.result.breakdown.distanceBonus > 0 && (
                <div className="prc-bd-row text-mono">
                  <span>OPTIMAL RANGE BONUS</span>
                  <span>+{photoResult.result.breakdown.distanceBonus} PTS</span>
                </div>
              )}
              {photoResult.result.breakdown.behaviorBonusPct > 0 && (
                <div className="prc-bd-row text-mono">
                  <span>ACTIVE BEHAVIOR</span>
                  <span>+{photoResult.result.breakdown.behaviorBonusPct}%</span>
                </div>
              )}
              {photoResult.result.breakdown.multiCreatureBonusPct > 0 && (
                <div className="prc-bd-row text-mono">
                  <span>MULTI-SUBJECT BONUS</span>
                  <span>+{photoResult.result.breakdown.multiCreatureBonusPct}%</span>
                </div>
              )}
              {photoResult.result.breakdown.cameraLevelBonusPct > 0 && (
                <div className="prc-bd-row text-mono">
                  <span>OPTICS SUITE BONUS</span>
                  <span>+{photoResult.result.breakdown.cameraLevelBonusPct}%</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="prc-actions">
              <button className="prc-btn secondary" onClick={handleDownload} id="btn-photo-download">
                ⬇ Save Image
              </button>
              <button className="prc-btn primary" onClick={() => setPhotoResult(null)} id="btn-photo-continue">
                Take Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
