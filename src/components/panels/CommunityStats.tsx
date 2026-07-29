import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorldStore } from '../../store/useWorldStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import './Panel.css'

interface Props { onClose: () => void }

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 2, decimals = 0 }: { target: number; duration?: number; decimals?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration * 60)
    const interval = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(interval) }
      else setVal(decimals > 0 ? parseFloat(start.toFixed(decimals)) : Math.floor(start))
    }, 1000 / 60)
    return () => clearInterval(interval)
  }, [target, duration, decimals])
  return <>{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString()}</>
}

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'global' | 'leaderboard' | 'mycontrib'

// ── Recent discoveries (seeded, stable per day) ───────────────────────────────
function getSeededDiscoveries() {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const rng = (() => { let s = day * 4973 + 17; return () => { s = (s * 16807) & 0x7fffffff; return (s & 0xffff) / 0xffff } })()
  const adj  = ['Azure','Phantom','Crystal','Shadow','Ember','Void','Solar','Brine','Deep','Obsidian']
  const noun = ['Ghostfin','Tailglow','Eyeveil','Lurker','Drifter','Hunter','Glider','Crawler','Whisper','Specter']
  const handles = ['OceanRider_42','DeepDiver99','AquaMarine','CrystalFin','AbyssWalker','CoralKnight','TidalForce','StormChaser','NautilEye','PelagicDrift']
  const times = ['2m ago','7m ago','14m ago','23m ago','41m ago','58m ago','1h 12m ago','1h 34m ago','2h ago','2h 22m ago']

  return Array.from({ length: 8 }, (_, i) => ({
    name: `${adj[Math.floor(rng() * adj.length)]} ${noun[Math.floor(rng() * noun.length)]}`,
    by:   handles[Math.floor(rng() * handles.length)],
    depth: `${Math.floor(rng() * 8000 + 100)}m`,
    time:  times[i],
    rarity: ['common','uncommon','rare','epic','legendary'][Math.floor(rng() * 5)] as string,
  }))
}

const RARITY_COLORS: Record<string, string> = {
  common: '#64748b', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#f59e0b', mythical: '#ec4899',
}

const RECENT_DISCOVERIES = getSeededDiscoveries()

export function CommunityStats({ onClose }: Props) {
  const { globalStats, leaderboard } = useWorldStore()
  const { discoveries, deepestDive, artefacts, researchPoints, playerName, photos } = usePlayerStore()
  const [tab, setTab] = useState<Tab>('global')

  // Compute player's community rank approximation
  const playerRank = leaderboard.findIndex(e => e.discoveries < discoveries.length) + 1
  const estimatedRank = playerRank > 0 ? playerRank : leaderboard.length + 1

  return (
    <motion.div
      className="panel-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      id="panel-community-stats"
    >
      <motion.div
        className="panel glass"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        style={{ maxWidth: 620, width: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 className="panel-title text-cinematic">The Global Ocean</h2>
          <button className="panel-close" onClick={onClose} id="btn-close-stats">✕</button>
        </div>

        <div className="global-subtitle text-mono">
          Humanity's collective expedition — {globalStats.activExplorers.toLocaleString()} researchers active now
        </div>

        {/* Tab bar */}
        <div className="cs-tab-bar">
          {(['global', 'leaderboard', 'mycontrib'] as Tab[]).map(t => (
            <button
              key={t}
              className={`cs-tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              id={`cs-tab-${t}`}
            >
              {t === 'global' ? '🌊 Global' : t === 'leaderboard' ? '🏆 Leaders' : '🔬 My Contribution'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'global' && (
            <motion.div key="global" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {/* Hero stat */}
              <div className="global-hero">
                <div className="global-percent">
                  <AnimatedCounter target={globalStats.oceanExplored} decimals={2} />
                  <span className="global-percent-sign">%</span>
                </div>
                <div className="global-percent-label text-mono">OF THE OCEAN EXPLORED</div>
                <div className="global-progress-bar">
                  <div className="global-progress-fill" style={{ width: `${globalStats.oceanExplored}%` }} />
                </div>
              </div>

              {/* Stats grid — expanded */}
              <div className="global-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  { label: 'MAPPED KM²',       val: globalStats.mappedRegions,    color: 'var(--ocean-glow)' },
                  { label: 'SPECIES FOUND',     val: globalStats.speciesFound,     color: '#48cae4' },
                  { label: 'ARTEFACTS',         val: globalStats.artifacts,        color: '#ffd60a' },
                  { label: 'ACTIVE NOW',        val: globalStats.activExplorers,   color: '#ff6b9d' },
                  { label: 'MYSTERIES SOLVED',  val: globalStats.mysteriesFound,   color: '#c77dff' },
                  { label: 'TOTAL EXPEDITIONS', val: globalStats.totalExpeditions, color: '#90e0ef' },
                ].map(({ label, val, color }) => (
                  <div className="global-stat-card" key={label}>
                    <div className="gsc-val" style={{ color }}><AnimatedCounter target={val} /></div>
                    <div className="gsc-label text-mono">{label}</div>
                  </div>
                ))}
              </div>

              {/* Depth record + photos row */}
              <div className="cs-highlights">
                <div className="cs-highlight-card">
                  <div className="cs-highlight-icon">⬇️</div>
                  <div>
                    <div className="cs-highlight-val">{globalStats.deepestDiveGlobal.toLocaleString()}m</div>
                    <div className="cs-highlight-label text-mono">DEEPEST DIVE RECORD</div>
                  </div>
                </div>
                <div className="cs-highlight-card">
                  <div className="cs-highlight-icon">📷</div>
                  <div>
                    <div className="cs-highlight-val"><AnimatedCounter target={globalStats.totalPhotos} /></div>
                    <div className="cs-highlight-label text-mono">PHOTOS ARCHIVED</div>
                  </div>
                </div>
                <div className="cs-highlight-card">
                  <div className="cs-highlight-icon">🌍</div>
                  <div>
                    <div className="cs-highlight-val">{globalStats.biomesCharted}/8</div>
                    <div className="cs-highlight-label text-mono">BIOMES CHARTED</div>
                  </div>
                </div>
              </div>

              {/* Recent discoveries feed */}
              <div className="panel-section-label text-mono">RECENT DISCOVERIES</div>
              <div className="recent-list">
                {RECENT_DISCOVERIES.map((d, i) => (
                  <div key={i} className="recent-item">
                    <div className="ri-dot" style={{ background: RARITY_COLORS[d.rarity] ?? '#64748b' }} />
                    <div className="ri-info">
                      <span className="ri-name">{d.name}</span>
                      <span className="ri-meta text-mono">by {d.by} · {d.depth} · {d.time}</span>
                    </div>
                    <span className="cs-rarity-pill text-mono" style={{ color: RARITY_COLORS[d.rarity] }}>
                      {d.rarity.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="cs-leaderboard-header text-mono">
                TOP RESEARCHERS — SEASON {Math.floor(Date.now() / (1000*60*60*24*30))}
              </div>
              <div className="cs-leaderboard-list">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`cs-lb-row ${entry.rank <= 3 ? 'cs-lb-top3' : ''}`}
                  >
                    <div className="cs-lb-badge">{entry.badge}</div>
                    <div className="cs-lb-rank text-mono">#{entry.rank}</div>
                    <div className="cs-lb-name">{entry.name}</div>
                    <div className="cs-lb-stats text-mono">
                      <span title="Species">🔬 {entry.discoveries.toLocaleString()}</span>
                      <span title="Deepest Dive">⬇️ {entry.deepestDive.toLocaleString()}m</span>
                      <span title="Artefacts">🏆 {entry.artefacts}</span>
                    </div>
                    <div className="cs-lb-rp text-mono">{entry.rp.toLocaleString()} RP</div>
                  </div>
                ))}

                {/* Player row */}
                <div className="cs-lb-row cs-lb-player">
                  <div className="cs-lb-badge">🔬</div>
                  <div className="cs-lb-rank text-mono">#{estimatedRank > 10 ? '??' : estimatedRank}</div>
                  <div className="cs-lb-name" style={{ color: 'var(--ocean-glow)' }}>{playerName} ← YOU</div>
                  <div className="cs-lb-stats text-mono">
                    <span title="Species">🔬 {discoveries.length}</span>
                    <span title="Deepest Dive">⬇️ {deepestDive.toLocaleString()}m</span>
                    <span title="Artefacts">🏆 {artefacts.length}</span>
                  </div>
                  <div className="cs-lb-rp text-mono">{researchPoints.toLocaleString()} RP</div>
                </div>
              </div>
              <div className="cs-lb-note text-mono">
                Leaderboard updates daily at midnight. Keep scanning to climb the ranks!
              </div>
            </motion.div>
          )}

          {tab === 'mycontrib' && (
            <motion.div key="mycontrib" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="cs-contrib-header">
                <div className="cs-contrib-avatar">🔬</div>
                <div>
                  <div className="cs-contrib-name">{playerName}</div>
                  <div className="cs-contrib-sub text-mono">OCEAN RESEARCHER — ACTIVE</div>
                </div>
              </div>

              {/* Player's share of global stats */}
              <div className="cs-contrib-grid">
                {[
                  {
                    icon: '🔬', label: 'SPECIES CONTRIBUTION',
                    player: discoveries.length,
                    global: globalStats.speciesFound,
                    unit: 'species',
                    color: '#48cae4',
                  },
                  {
                    icon: '🏆', label: 'ARTEFACT CONTRIBUTION',
                    player: artefacts.length,
                    global: globalStats.artifacts,
                    unit: 'artefacts',
                    color: '#ffd60a',
                  },
                  {
                    icon: '📷', label: 'PHOTO CONTRIBUTION',
                    player: photos.length,
                    global: globalStats.totalPhotos,
                    unit: 'photos',
                    color: '#ff6b9d',
                  },
                ].map(({ icon, label, player, global: g, unit, color }) => {
                  const pct = g > 0 ? Math.min(100, (player / g) * 100) : 0
                  return (
                    <div className="cs-contrib-card" key={label}>
                      <div className="cs-contrib-card-header">
                        <span className="cs-contrib-icon">{icon}</span>
                        <span className="cs-contrib-card-label text-mono">{label}</span>
                      </div>
                      <div className="cs-contrib-nums">
                        <span className="cs-contrib-player" style={{ color }}>{player.toLocaleString()}</span>
                        <span className="cs-contrib-of text-mono">of {g.toLocaleString()}</span>
                      </div>
                      <div className="cs-contrib-bar-wrap">
                        <div
                          className="cs-contrib-bar-fill"
                          style={{ width: `${Math.max(pct * 800, pct > 0 ? 2 : 0)}%`, background: color, maxWidth: '100%' }}
                        />
                      </div>
                      <div className="cs-contrib-pct text-mono" style={{ color }}>
                        {pct < 0.001 ? '<0.001' : pct.toFixed(4)}% of global {unit}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Personal records */}
              <div className="panel-section-label text-mono" style={{ marginTop: '12px' }}>PERSONAL RECORDS</div>
              <div className="cs-records-grid">
                <div className="cs-record-card">
                  <div className="cs-record-icon">⬇️</div>
                  <div className="cs-record-val">{deepestDive.toLocaleString()}m</div>
                  <div className="cs-record-label text-mono">DEEPEST DIVE</div>
                  {deepestDive >= globalStats.deepestDiveGlobal && (
                    <div className="cs-record-world text-mono">🌍 WORLD RECORD!</div>
                  )}
                </div>
                <div className="cs-record-card">
                  <div className="cs-record-icon">💎</div>
                  <div className="cs-record-val">{researchPoints.toLocaleString()}</div>
                  <div className="cs-record-label text-mono">TOTAL RP EARNED</div>
                </div>
                <div className="cs-record-card">
                  <div className="cs-record-icon">🏆</div>
                  <div className="cs-record-val">#{estimatedRank > 10 ? '??' : estimatedRank}</div>
                  <div className="cs-record-label text-mono">COMMUNITY RANK</div>
                </div>
              </div>

              <div className="cs-contrib-cta text-mono">
                Scan more species, dive deeper, and recover artefacts to increase your global contribution.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
