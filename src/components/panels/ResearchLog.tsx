import { motion } from 'framer-motion'
import { usePlayerStore } from '../../store/usePlayerStore'
import { BIOMES } from '../../engine/procedural/biomeGenerator'
import './Panel.css'

interface Props { onClose: () => void }

export function ResearchLog({ onClose }: Props) {
  const { discoveries, playerName, totalDistance, photosCapture, depth } = usePlayerStore()

  const sorted = [...discoveries].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <motion.div
      className="panel-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      id="panel-research-log"
    >
      <motion.div
        className="panel glass"
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -60, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 className="panel-title text-cinematic">Research Log</h2>
          <button className="panel-close" onClick={onClose} id="btn-close-log">✕</button>
        </div>

        <div className="panel-researcher">
          <div className="researcher-avatar">🔬</div>
          <div>
            <div className="researcher-name">{playerName}</div>
            <div className="researcher-title text-mono">Marine Researcher</div>
          </div>
        </div>

        <div className="panel-stats-row">
          <div className="panel-stat-box">
            <div className="psb-val">{discoveries.length}</div>
            <div className="psb-label text-mono">SPECIES</div>
          </div>
          <div className="panel-stat-box">
            <div className="psb-val">{Math.round(totalDistance / 100)}</div>
            <div className="psb-label text-mono">KM TRAVELED</div>
          </div>
          <div className="panel-stat-box">
            <div className="psb-val">{photosCapture}</div>
            <div className="psb-label text-mono">PHOTOS</div>
          </div>
          <div className="panel-stat-box">
            <div className="psb-val">{depth.toLocaleString()}</div>
            <div className="psb-label text-mono">MAX DEPTH</div>
          </div>
        </div>

        <div className="panel-section-label text-mono">DISCOVERIES</div>

        {discoveries.length === 0 ? (
          <div className="panel-empty">
            <div className="panel-empty-icon">🌊</div>
            <p>No discoveries yet. Explore the ocean and approach creatures to discover them.</p>
          </div>
        ) : (
          <div className="panel-list">
            {sorted.map(d => (
              <div key={d.id} className="discovery-item">
                <div className="di-top">
                  <span className="di-name">{d.name}</span>
                  {d.isFirstEver && <span className="di-first">WORLD FIRST</span>}
                </div>
                <div className="di-meta text-mono">
                  <span>{d.speciesId}</span>
                  <span>{d.biome}</span>
                  <span>{d.depth}m</span>
                  <span>{new Date(d.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
