import { useRef } from 'react'
import type { RefObject } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import './Panel.css'

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>
  onClose: () => void
}

export function PhotoMode({ canvasRef, onClose }: Props) {
  const { incrementPhotos } = usePlayerStore()

  const handleCapture = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `ocean-photo-${Date.now()}.png`
    link.href = dataUrl
    link.click()
    incrementPhotos()
  }

  return (
    <div className="photo-mode" id="photo-mode">
      <div className="photo-corners">
        <div className="photo-corner tl" />
        <div className="photo-corner tr" />
        <div className="photo-corner bl" />
        <div className="photo-corner br" />
      </div>

      <div className="photo-controls">
        <button className="photo-capture-btn" onClick={handleCapture} id="btn-capture-photo">
          <span className="photo-capture-ring" />
          📷
        </button>
        <button className="photo-exit-btn" onClick={onClose} id="btn-exit-photo">
          Exit Photo Mode
        </button>
      </div>

      <div className="photo-label text-mono">PHOTO MODE — UI HIDDEN</div>
    </div>
  )
}
