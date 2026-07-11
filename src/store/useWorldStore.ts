import { create } from 'zustand'
import { getDailyEvent, DailyEvent } from '../engine/events/dailyEvents'
import { getBiomeAt, BiomeType } from '../engine/procedural/biomeGenerator'

interface WorldState {
  currentBiome: BiomeType
  dailyEvent: DailyEvent
  globalStats: {
    oceanExplored: number
    mappedRegions: number
    speciesFound: number
    artifacts: number
    activExplorers: number
  }
  setCurrentBiome: (b: BiomeType) => void
  updateGlobalStats: () => void
}

// Seeded "global" stats that grow slowly each day
function getSeededStats() {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const base = daysSinceEpoch * 173 + 91248
  return {
    oceanExplored: parseFloat((3.48 + daysSinceEpoch * 0.0003).toFixed(2)),
    mappedRegions: 182330 + daysSinceEpoch * 47,
    speciesFound: 91248 + daysSinceEpoch * 23,
    artifacts: 5221 + daysSinceEpoch * 3,
    activExplorers: 847 + (base % 200),
  }
}

export const useWorldStore = create<WorldState>((set) => ({
  currentBiome: 'coral',
  dailyEvent: getDailyEvent(),
  globalStats: getSeededStats(),
  setCurrentBiome: (currentBiome) => set({ currentBiome }),
  updateGlobalStats: () => set({ globalStats: getSeededStats() }),
}))
