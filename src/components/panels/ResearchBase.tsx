/**
 * ResearchBase.tsx
 *
 * Full-screen Research Base Hub overlay (press B to open/close).
 * Sections:
 *   🏠 Overview     — Player stats + RP + quick info
 *   🔬 Research Lab — Equipment upgrades
 *   📖 Archive      — Discovered species list
 *   🗺️ World Map    — 2D top-down biome exploration map
 *   📸 Gallery      — Best photos
 *   🎯 Missions     — Today's missions with progress
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore, EQUIPMENT_UPGRADES, EquipmentType } from '../../store/usePlayerStore'
import { useWorldStore } from '../../store/useWorldStore'
import { BIOMES, BiomeType } from '../../engine/procedural/biomeGenerator'
import './ResearchBase.css'

// ── World Map: seeded biome tiles ────────────────────────────────────────────
const BIOME_COLORS: Record<string, string> = {
  coral:        '#0077b6',
  kelp:         '#1b4332',
  crystal:      '#5b2d8e',
  abyss:        '#000508',
  frozen:       '#a8dadc',
  hydrothermal: '#3d0000',
  ruins:        '#1a1a2e',
  open:         '#023e8a',
}

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) & 0x7fffffff
    return (s & 0xffff) / 0xffff
  }
}

const BIOME_LIST: BiomeType[] = ['coral','kelp','crystal','abyss','frozen','hydrothermal','ruins','open']
const MAP_COLS = 20
const MAP_ROWS = 12

const MAP_TILES = (() => {
  const rng = seededRng(9234)
  return Array.from({ length: MAP_ROWS }, (_, row) =>
    Array.from({ length: MAP_COLS }, (_, col) => {
      const n = rng()
      return BIOME_LIST[Math.floor(n * BIOME_LIST.length)]
    })
  )
})()

// Rarity rank for sorting
const RARITY_RANK: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythical: 5,
}

interface ResearchBaseProps {
  onClose: () => void
}

type Section = 'overview' | 'lab' | 'archive' | 'artefacts' | 'map' | 'gallery' | 'missions'

const NAV_ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: 'overview',  icon: '🏠', label: 'Overview'    },
  { id: 'lab',       icon: '⚙️',  label: 'Research Lab' },
  { id: 'archive',   icon: '📖', label: 'Archive'     },
  { id: 'artefacts', icon: '🏆', label: 'Artefacts'   },
  { id: 'map',       icon: '🗺️', label: 'World Map'   },
  { id: 'gallery',   icon: '📸', label: 'Gallery'     },
  { id: 'missions',  icon: '🎯', label: 'Missions'    },
]

export function ResearchBase({ onClose }: ResearchBaseProps) {
  const [section, setSection] = useState<Section>('overview')
  const {
    playerName, researchPoints, discoveries, discoveredMysteries,
    photos, totalDistance, photosCapture, depth, deepestDive,
    equipmentLevel, upgradeEquipment, dailyMissions, claimMissionReward,
    artefacts, detectedArtefacts, activeWaypoint, setActiveWaypoint,
  } = usePlayerStore()
  const { dailyEvent, globalStats } = useWorldStore()
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null)

  const playerPos = usePlayerStore(s => s.coords)

  const handleUpgrade = (type: EquipmentType) => {
    const ok = upgradeEquipment(type)
    if (ok) {
      setPurchaseNotice(`✅ ${type.toUpperCase()} upgraded!`)
      setTimeout(() => setPurchaseNotice(null), 2500)
    }
  }

  const handleClaim = (id: string) => {
    claimMissionReward(id)
  }

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B' || e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const raritySort = [...discoveries].sort(
    (a, b) => (RARITY_RANK[b.dna?.rarity ?? 'common'] ?? 0) - (RARITY_RANK[a.dna?.rarity ?? 'common'] ?? 0)
  )

  // Map player marker position (approx from world coords)
  const mapMarkerCol = Math.min(MAP_COLS - 1, Math.max(0, Math.floor((playerPos.x + 100000) / 200000 * MAP_COLS)))
  const mapMarkerRow = Math.min(MAP_ROWS - 1, Math.max(0, Math.floor((playerPos.y + 100000) / 200000 * MAP_ROWS)))

  return (
    <AnimatePresence>
      <motion.div
        className="rbase-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        id="research-base-panel"
      >
        {/* ── Animated background grid ─────────────────────────────────── */}
        <div className="rbase-grid-bg" aria-hidden="true" />

        <motion.div
          className="rbase-shell"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* ── Sidebar nav ──────────────────────────────────────────────── */}
          <aside className="rbase-sidebar">
            <div className="rbase-logo">
              <div className="rbase-logo-icon">🌊</div>
              <div className="rbase-logo-text">
                <div className="rbase-logo-title text-cinematic">UNKNOWN OCEAN</div>
                <div className="rbase-logo-sub text-mono">RESEARCH BASE α</div>
              </div>
            </div>

            <nav className="rbase-nav">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  className={`rbase-nav-btn ${section === item.id ? 'active' : ''}`}
                  onClick={() => setSection(item.id)}
                  id={`rbase-nav-${item.id}`}
                >
                  <span className="rbase-nav-icon">{item.icon}</span>
                  <span className="rbase-nav-label">{item.label}</span>
                  {item.id === 'missions' && dailyMissions.filter(m => m.completed && !m.claimed).length > 0 && (
                    <span className="rbase-badge">{dailyMissions.filter(m => m.completed && !m.claimed).length}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* RP display */}
            <div className="rbase-rp-box">
              <div className="rbase-rp-label text-mono">RESEARCH POINTS</div>
              <div className="rbase-rp-amount">{researchPoints.toLocaleString()}</div>
              <div className="rbase-rp-icon">💎</div>
            </div>

            <button className="rbase-close-btn" onClick={onClose} id="btn-close-base">
              ✕ Close Base
            </button>
          </aside>

          {/* ── Main content ─────────────────────────────────────────────── */}
          <main className="rbase-main">
            <AnimatePresence mode="wait">
              {section === 'overview' && (
                <OverviewSection
                  key="overview"
                  playerName={playerName}
                  discoveries={discoveries.length}
                  mysteries={discoveredMysteries.length}
                  artefacts={artefacts.length}
                  photos={photosCapture}
                  distance={Math.round(totalDistance / 100)}
                  maxDepth={deepestDive}
                  rp={researchPoints}
                  event={dailyEvent}
                  equipmentLevel={equipmentLevel}
                />
              )}
              {section === 'lab' && (
                <LabSection
                  key="lab"
                  equipmentLevel={equipmentLevel}
                  researchPoints={researchPoints}
                  onUpgrade={handleUpgrade}
                  purchaseNotice={purchaseNotice}
                />
              )}
              {section === 'archive' && (
                <ArchiveSection key="archive" discoveries={raritySort} />
              )}
              {section === 'artefacts' && (
                <ArtefactsSection key="artefacts" artefacts={artefacts} />
              )}
              {section === 'map' && (
                <MapSection
                  key="map"
                  tiles={MAP_TILES}
                  markerCol={mapMarkerCol}
                  markerRow={mapMarkerRow}
                  discoveredBiomes={discoveries.map(d => d.biome)}
                  dailyEvent={dailyEvent}
                  globalStats={globalStats}
                  collectedArtefacts={artefacts}
                  detectedArtefacts={detectedArtefacts}
                  discoveredMysteries={discoveredMysteries}
                  activeWaypoint={activeWaypoint}
                  onSelectWaypoint={(da: any) => {
                    setActiveWaypoint(da)
                    setPurchaseNotice(`📍 Navigation Waypoint set: ${da.name}`)
                    setTimeout(() => setPurchaseNotice(null), 3000)
                  }}
                  playerPos={playerPos}
                />
              )}
              {section === 'gallery' && (
                <GallerySection key="gallery" photos={photos} />
              )}
              {section === 'missions' && (
                <MissionsSection
                  key="missions"
                  missions={dailyMissions}
                  onClaim={handleClaim}
                />
              )}
            </AnimatePresence>
          </main>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: Overview
// ═════════════════════════════════════════════════════════════════════════════
function OverviewSection({ playerName, discoveries, mysteries, artefacts, photos, distance, maxDepth, rp, event, equipmentLevel }: any) {
  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">Mission Overview</h2>
        <div className="rbase-section-sub text-mono">EXPEDITION STATUS REPORT</div>
      </div>

      {/* Researcher card */}
      <div className="rbase-researcher-card">
        <div className="rbase-researcher-avatar">🔬</div>
        <div className="rbase-researcher-info">
          <div className="rbase-researcher-name">{playerName}</div>
          <div className="rbase-researcher-title text-mono">SENIOR MARINE RESEARCHER</div>
        </div>
        <div className="rbase-researcher-rp">
          <div className="rbase-researcher-rp-amt">{rp.toLocaleString()}</div>
          <div className="rbase-researcher-rp-label text-mono">RP TOTAL</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="rbase-stats-grid">
        {[
          { icon: '🔬', val: discoveries, label: 'Species Found' },
          { icon: '🏛️', val: mysteries,   label: 'Mysteries' },
          { icon: '🏆', val: artefacts,   label: 'Artefacts Found' },
          { icon: '📷', val: photos,      label: 'Photos Taken' },
          { icon: '🚢', val: `${distance} km`, label: 'Distance Traveled' },
          { icon: '⬇️', val: `${maxDepth.toLocaleString()} m`, label: 'Max Depth' },
        ].map(({ icon, val, label }) => (
          <div className="rbase-stat-card" key={label}>
            <div className="rbase-stat-icon">{icon}</div>
            <div className="rbase-stat-val">{val}</div>
            <div className="rbase-stat-label text-mono">{label}</div>
          </div>
        ))}
      </div>

      {/* Equipment summary */}
      <div className="rbase-subsection-title text-mono">EQUIPMENT STATUS</div>
      <div className="rbase-equip-row">
        {(['sonar', 'scanner', 'camera', 'lights', 'pressure'] as EquipmentType[]).map(type => {
          const lvl = equipmentLevel[type] ?? 0
          const upgrades = EQUIPMENT_UPGRADES[type]
          return (
            <div className="rbase-equip-pill" key={type}>
              <span>{type === 'sonar' ? '📡' : type === 'scanner' ? '🌐' : type === 'camera' ? '📷' : type === 'lights' ? '💡' : '🛡️'}</span>
              <span className="text-mono rbase-equip-name">{type.toUpperCase()}</span>
              <span className="rbase-equip-lvl text-mono">LVL {lvl}/{upgrades.length - 1}</span>
            </div>
          )
        })}
      </div>

      {/* Today's event */}
      {event && (
        <div className="rbase-event-banner">
          <div className="rbase-event-label text-mono">TODAY'S ACTIVE EVENT</div>
          <div className="rbase-event-name">{event.name}</div>
          <div className="rbase-event-desc">{event.description}</div>
        </div>
      )}

      {/* Sub hangar — cosmetic animated sub */}
      <div className="rbase-hangar">
        <div className="rbase-hangar-label text-mono">SUBMERSIBLE HANGAR — UNIT-1</div>
        <div className="rbase-hangar-scene">
          <div className="rbase-sub-anim">
            <div className="rbase-sub-body">
              <div className="rbase-sub-dome" />
              <div className="rbase-sub-window" />
              <div className="rbase-sub-fin rbase-sub-fin-top" />
              <div className="rbase-sub-fin rbase-sub-fin-bot" />
              <div className="rbase-sub-prop" />
            </div>
            <div className="rbase-sub-bubbles">
              <span className="rbase-bubble" />
              <span className="rbase-bubble" />
              <span className="rbase-bubble" />
            </div>
          </div>
          <div className="rbase-hangar-floor" />
        </div>
      </div>
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: Research Lab (Equipment Upgrades)
// ═════════════════════════════════════════════════════════════════════════════
function LabSection({ equipmentLevel, researchPoints, onUpgrade, purchaseNotice }: any) {
  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">Research Laboratory</h2>
        <div className="rbase-section-sub text-mono">EQUIPMENT UPGRADE STATION</div>
      </div>

      <div className="rbase-rp-banner">
        <span className="text-mono">AVAILABLE RP</span>
        <span className="rbase-rp-big">{researchPoints.toLocaleString()} 💎</span>
      </div>

      {purchaseNotice && (
        <div className="rbase-purchase-notice">{purchaseNotice}</div>
      )}

      <div className="rbase-upgrades-grid">
        {(['sonar', 'scanner', 'camera', 'lights', 'pressure'] as EquipmentType[]).map(type => {
          const currentLvl = equipmentLevel[type] ?? 0
          const allUpgrades = EQUIPMENT_UPGRADES[type]
          const currentItem = allUpgrades[currentLvl]
          const nextItem = allUpgrades[currentLvl + 1]
          const canAfford = nextItem && researchPoints >= nextItem.cost

          return (
            <div className={`rbase-upgrade-card ${canAfford ? 'can-afford' : ''}`} key={type}>
              <div className="rbase-uc-icon">
                {type === 'sonar' ? '📡' : type === 'scanner' ? '🌐' : type === 'camera' ? '📷' : type === 'lights' ? '💡' : '🛡️'}
              </div>
              <div className="rbase-uc-body">
                <div className="rbase-uc-type text-mono">{type.toUpperCase()} SYSTEM</div>
                <div className="rbase-uc-name">{currentItem.name}</div>
                <div className="rbase-uc-desc">{currentItem.description}</div>
                <div className="rbase-uc-effect text-mono">⚡ {currentItem.effect}</div>

                {/* Level bar */}
                <div className="rbase-lvl-bar-wrap">
                  {allUpgrades.map((_, i) => (
                    <div
                      key={i}
                      className={`rbase-lvl-pip ${i <= currentLvl ? 'filled' : ''}`}
                    />
                  ))}
                  <span className="rbase-lvl-text text-mono">LVL {currentLvl}</span>
                </div>
              </div>

              <div className="rbase-uc-footer">
                {nextItem ? (
                  <button
                    className={`rbase-upgrade-btn ${canAfford ? 'affordable' : 'locked'}`}
                    onClick={() => onUpgrade(type)}
                    disabled={!canAfford}
                    id={`btn-upgrade-${type}`}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem' }}>→ {nextItem.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{nextItem.effect}</div>
                    </div>
                    <div className="rbase-cost-tag text-mono">{nextItem.cost.toLocaleString()} RP</div>
                  </button>
                ) : (
                  <div className="rbase-max-tag text-mono">✓ MAX LEVEL</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rbase-lab-note text-mono">
        Earn RP by scanning species, photographing wildlife, completing missions, and investigating mysteries.
      </div>
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: Archive
// ═════════════════════════════════════════════════════════════════════════════
function ArchiveSection({ discoveries }: any) {
  const [filter, setFilter] = useState<string>('all')

  const rarities = ['all', 'mythical', 'legendary', 'epic', 'rare', 'uncommon', 'common']
  const filtered = filter === 'all' ? discoveries : discoveries.filter((d: any) => d.dna?.rarity === filter)

  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">Species Archive</h2>
        <div className="rbase-section-sub text-mono">{discoveries.length} SPECIES CATALOGUED</div>
      </div>

      <div className="rbase-filter-row">
        {rarities.map(r => (
          <button
            key={r}
            className={`rbase-filter-btn rarity-${r} ${filter === r ? 'active' : ''}`}
            onClick={() => setFilter(r)}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rbase-empty">
          <div className="rbase-empty-icon">🔬</div>
          <p>No species catalogued yet. Dive in and start scanning!</p>
        </div>
      ) : (
        <div className="rbase-archive-list">
          {filtered.map((d: any) => (
            <div className="rbase-archive-item" key={d.id}>
              <div
                className="rbase-archive-swatch"
                style={{ background: d.dna?.primaryColor ?? '#48cae4' }}
              />
              <div className="rbase-archive-info">
                <div className="rbase-archive-name">{d.name}</div>
                <div className="rbase-archive-meta text-mono">
                  <span>{d.speciesId}</span>
                  <span>{d.biome}</span>
                  <span>{d.depth}m</span>
                  <span>{d.dna?.archetype ?? 'unknown'}</span>
                </div>
              </div>
              <div className={`rbase-rarity-badge rarity-${d.dna?.rarity ?? 'common'}`}>
                {(d.dna?.rarity ?? 'common').toUpperCase()}
              </div>
              {d.isFirstEver && (
                <div className="rbase-first-badge text-mono">WORLD FIRST</div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: World Map
// ═════════════════════════════════════════════════════════════════════════════
function MapSection({
  tiles, markerCol, markerRow, discoveredBiomes, dailyEvent, globalStats,
  collectedArtefacts, detectedArtefacts, discoveredMysteries, activeWaypoint, onSelectWaypoint, playerPos,
}: any) {
  const discoveredSet = new Set<string>(discoveredBiomes)
  const discoveredBiomeCount = new Set(discoveredBiomes).size

  // Seed a deterministic event tile position from today's date
  const eventDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const eventCol = (eventDay * 7 + 3) % MAP_COLS
  const eventRow = (eventDay * 5 + 2) % MAP_ROWS

  // Build marker list combining detected, collected, and mystery items
  const allMapMarkers = useMemo(() => {
    const list: Array<{
      id: string
      col: number
      row: number
      icon: string
      stateIcon: string
      name: string
      collected: boolean
      pos: [number, number, number]
      raw: any
    }> = []

    // Collected artefacts (🟢)
    for (const a of (collectedArtefacts ?? [])) {
      const col = Math.min(MAP_COLS - 1, Math.max(0, Math.floor((a.coords?.x + 100000) / 200000 * MAP_COLS)))
      const row = Math.min(MAP_ROWS - 1, Math.max(0, Math.floor((a.coords?.y + 100000) / 200000 * MAP_ROWS)))
      const icon = a.type === 'journal' ? '📖' : a.type === 'pearl' ? '💎' : a.type === 'equipment' ? '⚙️' : a.type === 'fossil' ? '🐚' : '🏺'
      list.push({
        id: a.instanceId,
        col, row, icon,
        stateIcon: '🟢',
        name: a.name,
        collected: true,
        pos: [a.coords?.x ?? 0, -a.depth, a.coords?.y ?? 0],
        raw: a,
      })
    }

    // Detected (uncollected) artefacts (🟡)
    for (const da of (detectedArtefacts ?? [])) {
      if (list.some(item => item.id === da.instanceId)) continue
      const col = Math.min(MAP_COLS - 1, Math.max(0, Math.floor((da.position[0] + 100000) / 200000 * MAP_COLS)))
      const row = Math.min(MAP_ROWS - 1, Math.max(0, Math.floor((da.position[2] + 100000) / 200000 * MAP_ROWS)))
      const icon = da.type === 'journal' ? '📖' : da.type === 'pearl' ? '💎' : da.type === 'equipment' ? '⚙️' : da.type === 'fossil' ? '🐚' : '🏺'
      list.push({
        id: da.instanceId,
        col, row, icon,
        stateIcon: da.collected ? '🟢' : '🟡',
        name: da.name,
        collected: da.collected,
        pos: da.position,
        raw: da,
      })
    }

    // Discovered mysteries (🏛)
    for (const m of (discoveredMysteries ?? [])) {
      const col = Math.min(MAP_COLS - 1, Math.max(0, Math.floor((m.coords?.x + 100000) / 200000 * MAP_COLS)))
      const row = Math.min(MAP_ROWS - 1, Math.max(0, Math.floor((m.coords?.y + 100000) / 200000 * MAP_ROWS)))
      list.push({
        id: m.id,
        col, row, icon: '🏛',
        stateIcon: '🟢',
        name: m.name,
        collected: true,
        pos: [m.coords?.x ?? 0, -m.depth, m.coords?.y ?? 0],
        raw: m,
      })
    }

    return list
  }, [collectedArtefacts, detectedArtefacts, discoveredMysteries])

  // Build tile lookup
  const tileMarkerLookup = useMemo(() => {
    const map: Record<string, typeof allMapMarkers> = {}
    for (const item of allMapMarkers) {
      const k = `${item.row}-${item.col}`
      if (!map[k]) map[k] = []
      map[k].push(item)
    }
    return map
  }, [allMapMarkers])

  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">World Map</h2>
        <div className="rbase-section-sub text-mono">OCEAN SURVEY CHART — CLASSIFIED</div>
      </div>

      {/* Global stats strip */}
      {globalStats && (
        <div className="rbase-map-stats-strip">
          <div className="rbase-map-stat">
            <span className="rbase-map-stat-val">{globalStats.deepestDiveGlobal?.toLocaleString()}m</span>
            <span className="rbase-map-stat-label text-mono">GLOBAL DEPTH RECORD</span>
          </div>
          <div className="rbase-map-stat">
            <span className="rbase-map-stat-val">{globalStats.activExplorers?.toLocaleString()}</span>
            <span className="rbase-map-stat-label text-mono">EXPLORERS ONLINE</span>
          </div>
          <div className="rbase-map-stat">
            <span className="rbase-map-stat-val">{globalStats.totalExpeditions?.toLocaleString()}</span>
            <span className="rbase-map-stat-label text-mono">TOTAL EXPEDITIONS</span>
          </div>
        </div>
      )}

      <div className="rbase-map-wrap">
        <div className="rbase-map-grid" style={{ gridTemplateColumns: `repeat(${MAP_COLS}, 1fr)` }}>
          {tiles.map((row: BiomeType[], ri: number) =>
            row.map((biome: BiomeType, ci: number) => {
              const isMarker    = ri === markerRow && ci === markerCol
              const isEvent     = ri === eventRow  && ci === eventCol
              const isDiscovered = discoveredSet.has(biome)
              const tileMarkers = tileMarkerLookup[`${ri}-${ci}`] ?? []
              const firstUncollected = tileMarkers.find(m => !m.collected)
              const isWaypoint = activeWaypoint && tileMarkers.some(m => m.id === activeWaypoint.instanceId)

              return (
                <div
                  key={`${ri}-${ci}`}
                  className={`rbase-map-tile ${isDiscovered ? 'discovered' : 'fog'} ${isMarker ? 'marker' : ''} ${isEvent ? 'event-marker' : ''} ${isWaypoint ? 'waypoint-tile' : ''}`}
                  style={{
                    background: BIOME_COLORS[biome] ?? '#023e8a',
                    position: 'relative',
                    cursor: firstUncollected ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (firstUncollected && onSelectWaypoint) {
                      onSelectWaypoint({
                        instanceId: firstUncollected.id,
                        artefactId: firstUncollected.id,
                        name: firstUncollected.name,
                        type: firstUncollected.raw?.type ?? 'artefact',
                        rarity: firstUncollected.raw?.rarity ?? 'rare',
                        position: firstUncollected.pos,
                        timestamp: Date.now(),
                        collected: false,
                      })
                    }
                  }}
                  title={[
                    isEvent ? `📡 ${dailyEvent?.name ?? 'Active Event'}` : '',
                    isWaypoint ? `📍 WAYPOINT: ${activeWaypoint?.name}` : '',
                    ...tileMarkers.map(m => `${m.stateIcon} ${m.icon} ${m.name} ${!m.collected ? '(Click to set Waypoint)' : ''}`),
                    BIOMES[biome]?.name ?? biome,
                  ].filter(Boolean).join(' | ')}
                >
                  {isMarker && <span className="rbase-map-marker">▲</span>}
                  {isEvent && !isMarker && <span className="rbase-map-event-dot">✦</span>}

                  {/* Render marker icons */}
                  {!isMarker && !isEvent && tileMarkers.length > 0 && (
                    <span style={{
                      position: 'absolute', top: 1, right: 1,
                      fontSize: '8px', lineHeight: 1,
                      filter: 'drop-shadow(0 0 2px #fff8)',
                      display: 'flex', gap: '1px',
                    }}>
                      <span>{tileMarkers[0].stateIcon}</span>
                      <span>{tileMarkers[0].icon}</span>
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Event location callout */}
        {dailyEvent && (
          <div className="rbase-map-event-callout">
            <span className="rbase-map-event-icon">📡</span>
            <div>
              <div className="rbase-map-event-name">{dailyEvent.name}</div>
              <div className="rbase-map-event-desc text-mono">Active event — location marked ✦ on map</div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="rbase-map-legend">
          {Object.entries(BIOME_COLORS).map(([biome, color]) => (
            <div className="rbase-map-legend-item" key={biome}>
              <div className="rbase-map-legend-swatch" style={{ background: color }} />
              <span className="text-mono rbase-map-legend-label">
                {BIOMES[biome as BiomeType]?.name ?? biome}
              </span>
              {discoveredSet.has(biome) && <span className="rbase-map-legend-discovered">✓</span>}
            </div>
          ))}
          <div className="rbase-map-legend-item">
            <div className="rbase-map-legend-swatch" style={{ background: '#00e5ff' }} />
            <span className="text-mono rbase-map-legend-label">Your Position ▲</span>
          </div>
          <div className="rbase-map-legend-item">
            <div className="rbase-map-legend-swatch" style={{ background: '#ff6b9d', boxShadow: '0 0 6px #ff6b9d' }} />
            <span className="text-mono rbase-map-legend-label">Active Event ✦</span>
          </div>
          <div className="rbase-map-legend-item">
            <span style={{ fontSize: '10px' }}>🟡 Detected</span>
            <span style={{ fontSize: '10px' }}>🟢 Collected</span>
            <span className="text-mono rbase-map-legend-label">📖 Journal / 🏺 Relic / 🐚 Fossil / 💎 Pearl</span>
          </div>
        </div>

        {/* Biome progress bar */}
        <div className="rbase-map-biome-progress">
          <div className="rbase-map-note text-mono">
            Biomes discovered: {discoveredBiomeCount} / {Object.keys(BIOME_COLORS).length}
            &nbsp;|&nbsp; Detected on map: {(detectedArtefacts ?? []).length}
            &nbsp;|&nbsp; Collected: {(collectedArtefacts ?? []).length}
            &nbsp;|&nbsp; Mysteries found: {(discoveredMysteries ?? []).length}
          </div>
          <div className="rbase-map-biome-bar-wrap">
            {Object.keys(BIOME_COLORS).map(b => (
              <div
                key={b}
                className="rbase-map-biome-segment"
                style={{
                  background: discoveredSet.has(b) ? BIOME_COLORS[b] : 'rgba(255,255,255,0.06)',
                  flex: 1,
                }}
                title={BIOMES[b as BiomeType]?.name ?? b}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: Gallery
// ═════════════════════════════════════════════════════════════════════════════
function GallerySection({ photos }: any) {
  const sorted = [...photos].sort((a: any, b: any) => b.score - a.score)

  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">Photo Gallery</h2>
        <div className="rbase-section-sub text-mono">{photos.length} IMAGES ARCHIVED</div>
      </div>

      {sorted.length === 0 ? (
        <div className="rbase-empty">
          <div className="rbase-empty-icon">📸</div>
          <p>No photos taken yet. Use Photo Mode (📷) to capture the ocean!</p>
        </div>
      ) : (
        <div className="rbase-gallery-grid">
          {sorted.map((p: any) => (
            <div className="rbase-gallery-item" key={p.id}>
              <img src={p.dataUrl} alt={p.subjectName} className="rbase-gallery-img" />
              <div className="rbase-gallery-overlay">
                <div className="rbase-gallery-name">{p.subjectName}</div>
                <div className="rbase-gallery-meta text-mono">
                  <span className={`rbase-rarity-badge rarity-${p.subjectRarity}`}>{p.subjectRarity?.toUpperCase()}</span>
                  <span>{p.biome}</span>
                  <span>{p.depth}m</span>
                </div>
                <div className="rbase-gallery-score text-mono">
                  ⭐ {p.score} pts &nbsp;|&nbsp; +{p.rpEarned} RP
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: Missions
// ═════════════════════════════════════════════════════════════════════════════
function MissionsSection({ missions, onClaim }: any) {
  if (!missions || missions.length === 0) {
    return (
      <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <div className="rbase-section-header">
          <h2 className="rbase-section-title text-cinematic">Daily Missions</h2>
        </div>
        <div className="rbase-empty">
          <div className="rbase-empty-icon">🎯</div>
          <p>No missions loaded. Return to the ocean to initialize today's missions.</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">Daily Missions</h2>
        <div className="rbase-section-sub text-mono">REFRESH IN — {hoursUntilMidnight()}h</div>
      </div>

      <div className="rbase-mission-list">
        {missions.map((m: any) => {
          const pct = Math.min(1, m.progress / m.target)
          const statusClass = m.claimed ? 'claimed' : m.completed ? 'completed' : 'active'
          return (
            <div className={`rbase-mission-card ${statusClass}`} key={m.id}>
              <div className="rbase-mission-top">
                <div className="rbase-mission-info">
                  <div className="rbase-mission-title">{m.description}</div>
                  <div className="rbase-mission-meta text-mono">
                    <span className={`rbase-diff-badge diff-${m.difficulty}`}>{m.difficulty?.toUpperCase()}</span>
                    <span>{m.progress} / {m.target}</span>
                    <span>+{m.rewardRP} RP</span>
                  </div>
                </div>
                {m.completed && !m.claimed && (
                  <button
                    className="rbase-claim-btn"
                    onClick={() => onClaim(m.id)}
                    id={`btn-claim-${m.id}`}
                  >
                    CLAIM +{m.rewardRP} RP
                  </button>
                )}
                {m.claimed && (
                  <div className="rbase-claimed-tag text-mono">✓ CLAIMED</div>
                )}
              </div>

              <div className="rbase-mission-bar-wrap">
                <div
                  className="rbase-mission-bar-fill"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="rbase-mission-note text-mono">
        Complete missions during your dive, then return here to claim rewards.
      </div>
    </motion.div>
  )
}

function hoursUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  return Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60))
}

// ═════════════════════════════════════════════════════════════════════════════
// Section: Artefacts Vault
// ═════════════════════════════════════════════════════════════════════════════
function ArtefactsSection({ artefacts }: any) {
  const [filter, setFilter] = useState<string>('all')
  const types = ['all', 'fossil', 'journal', 'equipment', 'pearl', 'sculpture', 'relic']

  const filtered = filter === 'all' ? artefacts : artefacts.filter((a: any) => a.type === filter)

  return (
    <motion.div className="rbase-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="rbase-section-header">
        <h2 className="rbase-section-title text-cinematic">Relic & Artefact Vault</h2>
        <div className="rbase-section-sub text-mono">{artefacts.length} ARTEFACTS RECOVERED</div>
      </div>

      <div className="rbase-filter-row">
        {types.map(t => (
          <button
            key={t}
            className={`rbase-filter-btn ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rbase-empty">
          <div className="rbase-empty-icon">🏆</div>
          <p>No artefacts recovered yet. Explore ocean depths and approach glowing relic signals to collect them!</p>
        </div>
      ) : (
        <div className="rbase-archive-list">
          {filtered.map((a: any) => (
            <div className="rbase-archive-item" key={a.instanceId} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {a.type === 'fossil' ? '🦴' : a.type === 'journal' ? '📜' : a.type === 'equipment' ? '⚙️' : a.type === 'pearl' ? '🔮' : '🗿'}
                  </span>
                  <span className="rbase-archive-name" style={{ fontWeight: 'bold' }}>{a.name}</span>
                </div>
                <div className={`rbase-rarity-badge rarity-${a.rarity}`}>
                  {a.rarity.toUpperCase()} (+{a.rpValue} RP)
                </div>
              </div>
              <div className="rbase-archive-desc" style={{ fontSize: '0.82rem', color: 'var(--ui-text)', opacity: 0.9 }}>
                {a.description}
              </div>
              <div className="rbase-archive-lore" style={{ fontSize: '0.78rem', color: 'var(--ocean-glow)', fontStyle: 'italic', background: 'rgba(0, 180, 216, 0.05)', padding: '6px 10px', borderRadius: '4px' }}>
                "{a.lore}"
              </div>
              <div className="rbase-archive-meta text-mono" style={{ marginTop: '2px', fontSize: '9px', opacity: 0.6 }}>
                <span>DEPTH: {a.depth}m</span>
                <span>COORDS: X:{a.coords?.x} Y:{a.coords?.y}</span>
                <span>RECOVERED: {new Date(a.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
