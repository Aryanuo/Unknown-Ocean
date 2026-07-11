import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { generateCreatureDNA, generateSpeciesId, generateSpeciesName } from '../../engine/procedural/creatureFactory'
import { usePlayerStore } from '../../store/usePlayerStore'
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

export function Encyclopedia({ onClose }: Props) {
  const [search, setSearch] = useState('')
  const [biomeFilter, setBiomeFilter] = useState('all')
  const [selected, setSelected] = useState<ReturnType<typeof getCommunitySpecies>[0] | null>(null)
  const { discoveries } = usePlayerStore()

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

  const filtered = useMemo(() => {
    return allSpecies.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.id.toLowerCase().includes(search.toLowerCase())
      const matchBiome  = biomeFilter === 'all' || s.biome === biomeFilter
      return matchSearch && matchBiome
    })
  }, [allSpecies, search, biomeFilter])

  return (
    <motion.div className="panel-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} onClick={onClose} id="panel-encyclopedia">
      <motion.div className="panel glass wide-panel" initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} onClick={e => e.stopPropagation()}>

        <div className="panel-header">
          <h2 className="panel-title text-cinematic">Ocean Encyclopedia</h2>
          <button className="panel-close" onClick={onClose} id="btn-close-encyclopedia">✕</button>
        </div>

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
            {filtered.slice(0, 100).map(s => (
              <button
                key={s.id}
                className={`encyclopedia-item ${selected?.id === s.id ? 'selected' : ''}`}
                onClick={() => setSelected(s)}
                id={`species-${s.id}`}
              >
                <div className="ei-swatch" style={{ background: s.dna.primaryColor }} />
                <div className="ei-info">
                  <div className="ei-name">{s.name}</div>
                  <div className="ei-meta text-mono">{s.id} · {s.biome} · {s.depth}m</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
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
      </motion.div>
    </motion.div>
  )
}
