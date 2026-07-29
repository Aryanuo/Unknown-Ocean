import { create } from 'zustand'
import { getDailyEvent, DailyEvent } from '../engine/events/dailyEvents'
import { getBiomeAt, BiomeType } from '../engine/procedural/biomeGenerator'

// ── Fake researcher names for leaderboard ────────────────────────────────────
const RESEARCHER_FIRST = [
  'Dr.', 'Prof.', 'Lt.', 'Cmdr.', 'Dr.', 'Mx.', 'Dr.', 'Dr.', 'Prof.', 'Dr.',
]
const RESEARCHER_LAST = [
  'Solaris', 'Maren', 'Vega', 'Thorne', 'Okafor', 'Pellucid', 'Azari',
  'Keswick', 'Yuen', 'Dakarai', 'Nkemdirim', 'Larkin', 'Vasquez', 'Inoue',
  'Crestfall', 'Halverson', 'Mbeki', 'Deveraux', 'Quill', 'Strand',
]
const RESEARCHER_HANDLES = [
  'OceanRider', 'DeepDiver', 'AbyssWalker', 'CoralKnight', 'TidalForce',
  'AquaMarine', 'CrystalFin', 'DarkCurrent', 'VoidHunter', 'StormChaser',
  'BiolumLight', 'PelagicDrift', 'MidnightRay', 'NautilEye', 'HydroVent',
]

// ── Leaderboard entry ─────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number
  name: string
  discoveries: number
  deepestDive: number
  artefacts: number
  biomes: number
  rp: number
  badge: string
}

// ── Global stats ──────────────────────────────────────────────────────────────
export interface GlobalStats {
  oceanExplored: number      // % of ocean explored (global)
  mappedRegions: number      // total km² charted
  speciesFound: number       // total species documented globally
  artifacts: number          // artefacts recovered globally
  activExplorers: number     // explorers online now (seeded + variation)
  deepestDiveGlobal: number  // global deepest dive record (meters)
  totalPhotos: number        // total photos captured globally
  biomesCharted: number      // distinct biome types charted (out of 8)
  mysteriesFound: number     // total mysteries investigated globally
  totalExpeditions: number   // total dives undertaken globally
}

interface WorldState {
  currentBiome: BiomeType
  dailyEvent: DailyEvent
  globalStats: GlobalStats
  leaderboard: LeaderboardEntry[]
  setCurrentBiome: (b: BiomeType) => void
  updateGlobalStats: () => void
}

// ── Seeded RNG ────────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed | 0
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1)
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296
  }
}

// ── Seeded "global" stats that grow slowly each day ───────────────────────────
function getSeededStats(): GlobalStats {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const base = daysSinceEpoch * 173 + 91248
  const rng = seededRng(base)
  return {
    oceanExplored:     parseFloat((3.48 + daysSinceEpoch * 0.0003).toFixed(2)),
    mappedRegions:     182330 + daysSinceEpoch * 47,
    speciesFound:      91248  + daysSinceEpoch * 23,
    artifacts:         5221   + daysSinceEpoch * 3,
    activExplorers:    847    + Math.floor(rng() * 200),
    deepestDiveGlobal: 10823  + Math.floor(rng() * 50),
    totalPhotos:       234891 + daysSinceEpoch * 61,
    biomesCharted:     8,
    mysteriesFound:    12473  + daysSinceEpoch * 8,
    totalExpeditions:  891234 + daysSinceEpoch * 312,
  }
}

// ── Fake community leaderboard (seeded, stable per day) ──────────────────────
function getSeededLeaderboard(): LeaderboardEntry[] {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const rng = seededRng(daysSinceEpoch * 9973 + 42)

  const badges = ['🏆', '🥈', '🥉', '🔬', '🐳', '⭐', '💎', '🌊', '🦑', '🐟']

  return Array.from({ length: 10 }, (_, i) => {
    const handleIdx = Math.floor(rng() * RESEARCHER_HANDLES.length)
    const lastIdx   = Math.floor(rng() * RESEARCHER_LAST.length)
    const discoveries = Math.floor(2400 - i * 180 - rng() * 80)
    const deepest     = Math.floor(10800 - i * 300 - rng() * 200)
    const artefacts   = Math.floor(380 - i * 28 - rng() * 20)
    const biomesN     = 8 - Math.floor(i / 3)
    const rp          = Math.floor(discoveries * 110 + artefacts * 500 + rng() * 10000)

    return {
      rank:        i + 1,
      name:        `${RESEARCHER_HANDLES[handleIdx]}_${RESEARCHER_LAST[lastIdx]}`,
      discoveries,
      deepestDive: deepest,
      artefacts,
      biomes:      biomesN,
      rp,
      badge:       badges[i] ?? '🔬',
    }
  })
}

export const useWorldStore = create<WorldState>((set) => ({
  currentBiome: 'coral',
  dailyEvent: getDailyEvent(),
  globalStats: getSeededStats(),
  leaderboard: getSeededLeaderboard(),
  setCurrentBiome: (currentBiome) => set({ currentBiome }),
  updateGlobalStats: () => set({
    globalStats: getSeededStats(),
    leaderboard: getSeededLeaderboard(),
  }),
}))
