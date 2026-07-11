import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Discovery {
  id: string
  speciesId: string
  name: string
  discoveredBy: string
  depth: number
  biome: string
  temperature: number
  coords: { x: number; y: number }
  timestamp: number
  dna: CreatureDNA
  isFirstEver: boolean
}

export interface CreatureDNA {
  bodyLength: number
  bodyWidth: number
  finCount: number
  eyeCount: number
  tailType: number
  primaryColor: string
  secondaryColor: string
  glowColor: string
  glowIntensity: number
  speed: number
  behavior: string
  size: number
  stripePattern: number
  transparency: number
}

export interface PlayerState {
  playerId: string
  playerName: string
  coords: { x: number; y: number }
  depth: number
  discoveries: Discovery[]
  totalDistance: number
  photosCapture: number
  addDiscovery: (d: Discovery) => void
  setCoords: (x: number, y: number) => void
  setDepth: (d: number) => void
  incrementDistance: (d: number) => void
  incrementPhotos: () => void
  setPlayerName: (name: string) => void
}

function generatePlayerId(): string {
  return 'explorer_' + Math.random().toString(36).slice(2, 10)
}

function generateSpawnCoords() {
  return {
    x: Math.floor((Math.random() - 0.5) * 200000),
    y: Math.floor((Math.random() - 0.5) * 200000),
  }
}

const spawn = generateSpawnCoords()

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      playerId: generatePlayerId(),
      playerName: 'Anonymous Researcher',
      coords: spawn,
      depth: 0,
      discoveries: [],
      totalDistance: 0,
      photosCapture: 0,
      addDiscovery: (d) =>
        set((state) => ({ discoveries: [...state.discoveries, d] })),
      setCoords: (x, y) => set({ coords: { x, y } }),
      setDepth: (depth) => set({ depth }),
      incrementDistance: (d) =>
        set((state) => ({ totalDistance: state.totalDistance + d })),
      incrementPhotos: () =>
        set((state) => ({ photosCapture: state.photosCapture + 1 })),
      setPlayerName: (name) => set({ playerName: name }),
    }),
    { name: 'unknown-ocean-player' }
  )
)
