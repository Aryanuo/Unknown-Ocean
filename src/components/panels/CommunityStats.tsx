import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useWorldStore } from '../../store/useWorldStore'
import './Panel.css'

interface Props { onClose: () => void }

function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration * 60)
    const interval = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(interval) }
      else setVal(Math.floor(start))
    }, 1000 / 60)
    return () => clearInterval(interval)
  }, [target, duration])
  return <>{val.toLocaleString()}</>
}

const RECENT_DISCOVERIES = [
  { name: 'Azure Ghostfin', by: 'OceanRider_42', depth: '2341m', time: '3m ago' },
  { name: 'Phantom Tailglow', by: 'DeepDiver99',  depth: '891m',  time: '11m ago' },
  { name: 'Crystal Eyeveil', by: 'AquaMarine',    depth: '445m',  time: '22m ago' },
  { name: 'Shadow Lurker',   by: 'CrystalFin',    depth: '3120m', time: '31m ago' },
  { name: 'Ember Drifterscale',by: 'AbyssWalker',  depth: '670m',  time: '45m ago' },
  { name: 'Void Huntereye',  by: 'CoralKnight',   depth: '5500m', time: '1h ago' },
  { name: 'Solar Gliderlight',by: 'TidalForce',   depth: '128m',  time: '1h 20m ago' },
]

export function CommunityStats({ onClose }: Props) {
  const { globalStats } = useWorldStore()

  return (
    <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} onClick={onClose} id="panel-community-stats">
      <motion.div className="panel glass" initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>

        <div className="panel-header">
          <h2 className="panel-title text-cinematic">The Global Ocean</h2>
          <button className="panel-close" onClick={onClose} id="btn-close-stats">✕</button>
        </div>

        <div className="global-subtitle text-mono">
          Humanity's collective expedition progress
        </div>

        <div className="global-hero">
          <div className="global-percent">
            <AnimatedCounter target={globalStats.oceanExplored} />
            <span className="global-percent-sign">%</span>
          </div>
          <div className="global-percent-label text-mono">OF THE OCEAN EXPLORED</div>
          <div className="global-progress-bar">
            <div className="global-progress-fill" style={{ width: `${globalStats.oceanExplored}%` }} />
          </div>
        </div>

        <div className="global-grid">
          <div className="global-stat-card">
            <div className="gsc-val"><AnimatedCounter target={globalStats.mappedRegions} /></div>
            <div className="gsc-label text-mono">MAPPED REGIONS</div>
          </div>
          <div className="global-stat-card">
            <div className="gsc-val" style={{ color: 'var(--ocean-glow)' }}>
              <AnimatedCounter target={globalStats.speciesFound} />
            </div>
            <div className="gsc-label text-mono">SPECIES FOUND</div>
          </div>
          <div className="global-stat-card">
            <div className="gsc-val" style={{ color: '#ffd60a' }}>
              <AnimatedCounter target={globalStats.artifacts} />
            </div>
            <div className="gsc-label text-mono">ARTIFACTS</div>
          </div>
          <div className="global-stat-card">
            <div className="gsc-val" style={{ color: '#ff6b9d' }}>
              <AnimatedCounter target={globalStats.activExplorers} />
            </div>
            <div className="gsc-label text-mono">ACTIVE NOW</div>
          </div>
        </div>

        <div className="panel-section-label text-mono">RECENT DISCOVERIES</div>
        <div className="recent-list">
          {RECENT_DISCOVERIES.map((d, i) => (
            <div key={i} className="recent-item">
              <div className="ri-dot" />
              <div className="ri-info">
                <span className="ri-name">{d.name}</span>
                <span className="ri-meta text-mono">by {d.by} · {d.depth} · {d.time}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
