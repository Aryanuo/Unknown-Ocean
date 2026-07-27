import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { generateCreatureDNA, generateSpeciesId, generateSpeciesName, RARITY_CONFIG } from '../../engine/procedural/creatureFactory'
import { usePlayerStore, SavedPhoto } from '../../store/usePlayerStore'
import './Panel.css'

interface Props { onClose: () => void }

// Generate a seeded community encyclopedia
function getCommunitySpecies(count: number) {
  const species = []
  for (let i = 0; i < count; i++) {
    const seed = (i + 1) * 7919 + 12345
    const dna = generateCreatureDNA(seed)
    species.push({
      id: generateSpeciesId(seed),
      name: generateSpeciesName(dna, seed),
      biome: ['coral', 'kelp', 'crystal', 'abyss', 'frozen', 'hydrothermal', 'ruins', 'open'][i % 8],
      depth: Math.floor(10 + (seed % 10000)),
      discoveredBy: ['OceanRider_42', 'DeepDiver99', 'AquaMarine', 'CrystalFin', 'AbyssWalker',
                     'CoralKnight', 'TidalForce', 'FrostFin', 'VoidStalker', 'NeonDrifter'][i % 10],
      timestamp: Date.now() - Math.floor(seed % (1000 * 60 * 60 * 24 * 30)),
      dna,
    })
  }
  return species
}

const BIOME_FILTERS = ['all', 'coral', 'kelp', 'crystal', 'abyss', 'frozen', 'hydrothermal', 'ruins', 'open']

const RARITY_COLORS: Record<string, string> = {
  common:    '#90a4ae',
  uncommon:  '#66bb6a',
  rare:      '#42a5f5',
  epic:      '#ce93d8',
  legendary: '#ffc300',
  mythical:  '#ff006e',
}

export function Encyclopedia({ onClose }: Props) {
  const [tab, setTab] = useState<'species' | 'gallery'>('species')
  const [search, setSearch] = useState('')
  const [biomeFilter, setBiomeFilter] = useState('all')
  const [selected, setSelected] = useState<ReturnType<typeof getCommunitySpecies>[0] | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null)

  const { discoveries, photos } = usePlayerStore()

  const communitySpecies = useMemo(() => getCommunitySpecies(200), [])

  // Merge community + player discoveries
  const allSpecies = useMemo(() => {
    const playerEntries = discoveries.map(d => ({
      id: d.speciesId,
      name: d.name,
      biome: d.biome,
      depth: d.depth,
      discoveredBy: d.discoveredBy,
      timestamp: d.timestamp,
      dna: d.dna,
    }))
    return [...playerEntries, ...communitySpecies]
  }, [discoveries, communitySpecies])

  const filteredSpecies = useMemo(() => {
    return allSpecies.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.id.toLowerCase().includes(search.toLowerCase())
      const matchBiome  = biomeFilter === 'all' || s.biome === biomeFilter
      return matchSearch && matchBiome
    })
  }, [allSpecies, search, biomeFilter])

  const handleDownloadPhoto = (photo: SavedPhoto) => {
    const link = document.createElement('a')
    link.download = `ocean-photo-${photo.timestamp}.png`
    link.href = photo.dataUrl
    link.click()
  }

  return (
    <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} onClick={onClose} id="panel-encyclopedia">
      <motion.div className="panel glass wide-panel" initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} onClick={e => e.stopPropagation()}>

        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="panel-title text-cinematic">Ocean Encyclopedia</h2>
            <div className="panel-tabs">
              <button
                className={`panel-tab-btn ${tab === 'species' ? 'active' : ''}`}
                onClick={() => setTab('species')}
              >
                Species Archive
              </button>
              <button
                className={`panel-tab-btn ${tab === 'gallery' ? 'active' : ''}`}
                onClick={() => setTab('gallery')}
              >
                Photo Gallery ({photos.length})
              </button>
            </div>
          </div>
          <button className="panel-close" onClick={onClose} id="btn-close-encyclopedia">✕</button>
        </div>

        {tab === 'species' ? (
          <>
            <div className="encyclopedia-meta text-mono">
              {allSpecies.length.toLocaleString()} species documented • {discoveries.length} discovered by you
            </div>

            <input
              className="encyclopedia-search"
              placeholder="Search species or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="input-encyclopedia-search"
            />

            <div className="biome-filters">
              {BIOME_FILTERS.map(b => (
                <button
                  key={b}
                  className={`biome-filter-btn ${biomeFilter === b ? 'active' : ''}`}
                  onClick={() => setBiomeFilter(b)}
                  id={`filter-${b}`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="encyclopedia-layout">
              <div className="encyclopedia-list">
                {filteredSpecies.slice(0, 100).map(s => {
                  const rarity = s.dna?.rarity ?? 'common'
                  const rarityColor = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]?.color ?? '#90a4ae'
                  return (
                    <button
                      key={s.id}
                      className={`encyclopedia-item ${selected?.id === s.id ? 'selected' : ''}`}
                      onClick={() => setSelected(s)}
                      id={`species-${s.id}`}
                    >
                      <div className="ei-swatch" style={{ background: s.dna.primaryColor, boxShadow: `0 0 6px ${s.dna.primaryColor}88` }} />
                      <div className="ei-info">
                        <div className="ei-name">{s.name}</div>
                        <div className="ei-meta text-mono">{s.id} · {s.biome} · {s.depth}m</div>
                      </div>
                      <span className="ei-rarity text-mono" style={{ color: rarityColor, borderColor: rarityColor + '44' }}>
                        {rarity}
                      </span>
                    </button>
                  )
                })}
                {filteredSpecies.length === 0 && (
                  <div className="panel-empty">
                    <div className="panel-empty-icon">🔍</div>
                    <p>No species found</p>
                  </div>
                )}
              </div>

              {selected && (
                <div className="encyclopedia-detail">
                  <div className="ed-color-bar" style={{ background: `linear-gradient(135deg, ${selected.dna.primaryColor}, ${selected.dna.secondaryColor})` }} />
                  <div className="ed-id text-mono">{selected.id}</div>
                  <div className="ed-name text-cinematic">{selected.name}</div>
                  <div className="ed-stats">
                    <div className="ed-row">
                      <span className="ed-label text-mono">BIOME</span>
                      <span>{selected.biome}</span>
                    </div>
                    <div className="ed-row">
                      <span className="ed-label text-mono">DEPTH</span>
                      <span>{selected.depth.toLocaleString()}m</span>
                    </div>
                    <div className="ed-row">
                      <span className="ed-label text-mono">BEHAVIOR</span>
                      <span>{selected.dna.behavior}</span>
                    </div>
                    <div className="ed-row">
                      <span className="ed-label text-mono">SIZE</span>
                      <span>{selected.dna.size.toFixed(1)}m</span>
                    </div>
                    <div className="ed-row">
                      <span className="ed-label text-mono">SPEED</span>
                      <span>{(selected.dna.speed * 100).toFixed(0)} cm/s</span>
                    </div>
                    <div className="ed-row">
                      <span className="ed-label text-mono">DISCOVERER</span>
                      <span>{selected.discoveredBy}</span>
                    </div>
                    <div className="ed-row">
                      <span className="ed-label text-mono">DATE</span>
                      <span>{new Date(selected.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="ed-glow-preview" style={{
                    background: `radial-gradient(circle, ${selected.dna.glowColor}44, transparent 70%)`,
                    boxShadow: `0 0 40px ${selected.dna.glowColor}66`
                  }} />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="encyclopedia-meta text-mono">
              PHOTOGRAPHIC ARCHIVE • {photos.length} CAPTURED SNAPSHOTS
            </div>

            {photos.length === 0 ? (
              <div className="panel-empty">
                <div className="panel-empty-icon">📷</div>
                <p>No photos taken yet. Open <strong>Photo Mode</strong> in the ocean HUD to capture high-scoring scientific snapshots!</p>
              </div>
            ) : (
              <div className="photo-gallery-grid">
                {photos.map((p) => {
                  const rarityColor = RARITY_COLORS[p.subjectRarity] || '#90a4ae'
                  return (
                    <div
                      key={p.id}
                      className="gallery-card"
                      onClick={() => setSelectedPhoto(p)}
                    >
                      <div className="gc-img-wrapper">
                        <img src={p.dataUrl} alt={p.subjectName} className="gc-img" />
                        <div className="gc-score-badge text-mono">{p.score} PTS</div>
                        <div
                          className="gc-rarity-tag text-mono"
                          style={{ color: rarityColor, borderColor: rarityColor }}
                        >
                          {p.subjectRarity.toUpperCase()}
                        </div>
                      </div>
                      <div className="gc-info">
                        <div className="gc-title">{p.subjectName}</div>
                        <div className="gc-meta text-mono">
                          <span>{p.depth}M</span>
                          <span>+{p.rpEarned} RP</span>
                          <span>{new Date(p.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Selected Photo Modal */}
        {selectedPhoto && (
          <div className="photo-modal-overlay" onClick={() => setSelectedPhoto(null)}>
            <div className="photo-modal-card glass" onClick={e => e.stopPropagation()}>
              <div className="pmc-header">
                <div className="pmc-title">{selectedPhoto.subjectName}</div>
                <button className="panel-close" onClick={() => setSelectedPhoto(null)}>✕</button>
              </div>
              <img src={selectedPhoto.dataUrl} alt={selectedPhoto.subjectName} className="pmc-img" />
              <div className="pmc-stats">
                <div className="pmc-stat">
                  <span className="pmc-label text-mono">SCORE</span>
                  <span className="pmc-val text-mono" style={{ color: '#00e5ff' }}>{selectedPhoto.score} PTS</span>
                </div>
                <div className="pmc-stat">
                  <span className="pmc-label text-mono">REWARD</span>
                  <span className="pmc-val text-mono" style={{ color: '#ffc300' }}>+{selectedPhoto.rpEarned} RP</span>
                </div>
                <div className="pmc-stat">
                  <span className="pmc-label text-mono">DEPTH</span>
                  <span className="pmc-val text-mono">{selectedPhoto.depth}M</span>
                </div>
              </div>
              <button className="prc-btn primary" onClick={() => handleDownloadPhoto(selectedPhoto)}>
                ⬇ Download High-Res Image
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
