import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  MissionObjective,
  generateDailyMissions,
  getDaySeed,
  checkMissionProgressOnScan,
  checkMissionProgressOnDepth,
  checkMissionProgressOnTravel,
  checkMissionProgressOnPhoto,
} from '../engine/missions/missionEngine'

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

export interface DiscoveredMystery {
  id: string           // mystery instance id (e.g. "mystery_5_-3")
  type: string         // MysteryType
  name: string
  timestamp: number
  depth: number
  coords: { x: number; y: number }
  artifactCollected: boolean
}

export interface CollectedArtefact {
  instanceId: string
  artefactId: string
  name: string
  type: string
  rarity: string
  rpValue: number
  description: string
  lore: string
  timestamp: number
  depth: number
  coords: { x: number; y: number }
}

export interface SavedPhoto {
  id: string
  dataUrl: string
  timestamp: number
  score: number
  rpEarned: number
  subjectName: string
  subjectRarity: string
  subjectBehavior: string
  biome: string
  depth: number
  creaturesCount: number
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
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical'
  archetype?: 'fish' | 'ray' | 'eel' | 'jellyfish' | 'cephalopod' | 'leviathan'
}

export interface DetectedArtefact {
  instanceId: string
  artefactId: string
  name: string
  type: string
  rarity: string
  position: [number, number, number]
  timestamp: number
  collected: boolean
}

export type EquipmentType = 'sonar' | 'camera' | 'lights' | 'pressure' | 'scanner'

export interface EquipmentUpgrade {
  name: string
  description: string
  cost: number
  level: number
  effect: string
}

export const EQUIPMENT_UPGRADES: Record<EquipmentType, EquipmentUpgrade[]> = {
  sonar: [
    { name: 'Basic Sonar', description: 'Standard eco-location array.', cost: 0, level: 0, effect: 'Standard range' },
    { name: 'Advanced Sonar Array', description: 'Increases ping detection range by 50%.', cost: 500, level: 1, effect: '+50% Range' },
    { name: 'Deep Scanner', description: 'Reveals mystery signatures on sonar ping.', cost: 2000, level: 2, effect: 'Detects Anomalies' },
  ],
  camera: [
    { name: 'Standard Lens', description: 'Basic underwater capture device.', cost: 0, level: 0, effect: 'Standard Photo Mode' },
    { name: 'High-Res Optical Zoom', description: 'Adds composition grid overlay and zoom capabilities.', cost: 800, level: 1, effect: 'Grid & Zoom' },
    { name: 'Scientific Photo Suite', description: 'Enables automatic photo scoring and scientific analysis.', cost: 5000, level: 2, effect: 'Photo Scoring' },
  ],
  lights: [
    { name: 'Standard Spotlights', description: 'Twin submersible halogen bulbs.', cost: 0, level: 0, effect: 'Standard Beam' },
    { name: 'High-Intensity LED Array', description: 'Doubles headlight intensity and beam distance.', cost: 1200, level: 1, effect: '+100% Beam Distance' },
    { name: 'Bioluminescent Flash Beam', description: 'Pulsing ultra-wide beam that illuminates entire caverns.', cost: 3500, level: 2, effect: 'Wide Illuminator' },
  ],
  pressure: [
    { name: 'Class-A Titanium Hull', description: 'Standard hull rated for up to 8,000m depth.', cost: 0, level: 0, effect: '8,000m Depth Limit' },
    { name: 'Reinforced Graphene Hull', description: 'Allows diving into extreme deep trenches below 8,000m.', cost: 3000, level: 1, effect: 'Unlimited Depth Limit' },
  ],
  scanner: [
    { name: 'Basic Artifact Scanner', description: 'Detects common nearby artifacts within 200m.', cost: 0, level: 0, effect: '200m Range (Common)' },
    { name: 'Resonance Scanner L1', description: 'Increases scan range to 300m and detects uncommon items.', cost: 600, level: 1, effect: '300m Range (Uncommon)' },
    { name: 'Harmonic Pulse Scanner L2', description: 'Increases range to 450m and detects rare artifacts.', cost: 1500, level: 2, effect: '450m Range (Rare)' },
    { name: 'Abyssal Relic Suite L3', description: 'Expands range to 600m and detects epic/legendary relics.', cost: 3500, level: 3, effect: '600m Range (Epic/Legendary)' },
    { name: 'Quantum Relic Tracker L4', description: 'Maximum 800m range, mythical detection, depth display & fast cooldown.', cost: 7000, level: 4, effect: '800m Range (Mythical & Depth)' },
  ],
}

export interface PlayerState {
  playerId: string
  playerName: string
  coords: { x: number; y: number }
  depth: number
  deepestDive: number
  discoveries: Discovery[]
  discoveredMysteries: DiscoveredMystery[]
  photos: SavedPhoto[]
  totalDistance: number
  photosCapture: number
  researchPoints: number
  equipmentLevel: Record<EquipmentType, number>
  dailyMissions: MissionObjective[]
  lastMissionDaySeed: number
  artefacts: CollectedArtefact[]
  detectedArtefacts: DetectedArtefact[]
  activeWaypoint: DetectedArtefact | null

  addDiscovery: (d: Discovery) => void
  setCoords: (x: number, y: number) => void
  setDepth: (d: number) => void
  incrementDistance: (d: number) => void
  incrementPhotos: () => void
  setPlayerName: (name: string) => void
  addResearchPoints: (rp: number) => void
  upgradeEquipment: (type: EquipmentType) => boolean
  initDailyMissions: () => void
  claimMissionReward: (id: string) => boolean
  addDiscoveredMystery: (m: DiscoveredMystery) => void
  addPhoto: (photo: SavedPhoto) => void
  addArtefact: (a: CollectedArtefact) => void
  addDetectedArtefact: (da: DetectedArtefact) => void
  setActiveWaypoint: (wp: DetectedArtefact | null) => void
  clearActiveWaypoint: () => void
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
    (set, get) => ({
      playerId: generatePlayerId(),
      playerName: 'Anonymous Researcher',
      coords: spawn,
      depth: 0,
      deepestDive: 0,
      discoveries: [],
      totalDistance: 0,
      photosCapture: 0,
      researchPoints: 0,
      equipmentLevel: {
        sonar: 0,
        camera: 0,
        lights: 0,
        pressure: 0,
        scanner: 0,
      },
      dailyMissions: [],
      lastMissionDaySeed: 0,
      discoveredMysteries: [] as DiscoveredMystery[],
      photos: [] as SavedPhoto[],
      artefacts: [] as CollectedArtefact[],
      detectedArtefacts: [] as DetectedArtefact[],
      activeWaypoint: null as DetectedArtefact | null,

      initDailyMissions: () => {
        const todaySeed = getDaySeed()
        const currentSeed = get().lastMissionDaySeed
        if (currentSeed !== todaySeed || get().dailyMissions.length === 0) {
          set({
            dailyMissions: generateDailyMissions(todaySeed),
            lastMissionDaySeed: todaySeed,
          })
        }
      },

      addDiscovery: (d) => {
        set((state) => {
          const newDiscoveries = [...state.discoveries, d]
          const updatedMissions = checkMissionProgressOnScan(state.dailyMissions, {
            speciesId: d.speciesId,
            biome: d.biome,
            depth: d.depth,
            dna: d.dna,
          })
          return {
            discoveries: newDiscoveries,
            dailyMissions: updatedMissions,
          }
        })
      },

      setCoords: (x, y) => set({ coords: { x, y } }),

      setDepth: (depth) => {
        set((state) => {
          const updatedMissions = checkMissionProgressOnDepth(state.dailyMissions, depth)
          // Track deepest dive (depth values are positive meters below surface)
          const deepestDive = Math.max(state.deepestDive, depth)
          return { depth, deepestDive, dailyMissions: updatedMissions }
        })
      },

      incrementDistance: (d) => {
        set((state) => {
          const newDist = state.totalDistance + d
          const distKm = Math.round(newDist / 100)
          const updatedMissions = checkMissionProgressOnTravel(state.dailyMissions, distKm)
          return { totalDistance: newDist, dailyMissions: updatedMissions }
        })
      },

      incrementPhotos: () => {
        set((state) => {
          const updatedMissions = checkMissionProgressOnPhoto(state.dailyMissions)
          return { photosCapture: state.photosCapture + 1, dailyMissions: updatedMissions }
        })
      },

      setPlayerName: (name) => set({ playerName: name }),

      addResearchPoints: (rp) =>
        set((state) => ({ researchPoints: state.researchPoints + rp })),

      upgradeEquipment: (type: EquipmentType) => {
        const state = get()
        const currentLevel = state.equipmentLevel[type] ?? 0
        const availableUpgrades = EQUIPMENT_UPGRADES[type]
        const nextUpgrade = availableUpgrades[currentLevel + 1]

        if (!nextUpgrade) return false
        if (state.researchPoints < nextUpgrade.cost) return false

        set((s) => ({
          researchPoints: s.researchPoints - nextUpgrade.cost,
          equipmentLevel: {
            ...s.equipmentLevel,
            [type]: currentLevel + 1,
          },
        }))
        return true
      },

      claimMissionReward: (id: string) => {
        const state = get()
        const mission = state.dailyMissions.find((m) => m.id === id)
        if (!mission || !mission.completed || mission.claimed) return false

        set((s) => ({
          researchPoints: s.researchPoints + mission.rewardRP,
          dailyMissions: s.dailyMissions.map((m) =>
            m.id === id ? { ...m, claimed: true } : m
          ),
        }))
        return true
      },

      addDiscoveredMystery: (m: DiscoveredMystery) => {
        set((state) => {
          if (state.discoveredMysteries.some(d => d.id === m.id)) return state
          return { discoveredMysteries: [...state.discoveredMysteries, m] }
        })
      },

      addPhoto: (photo: SavedPhoto) => {
        set((state) => {
          const updatedMissions = checkMissionProgressOnPhoto(state.dailyMissions)
          return {
            photos: [photo, ...state.photos],
            photosCapture: state.photosCapture + 1,
            researchPoints: state.researchPoints + photo.rpEarned,
            dailyMissions: updatedMissions,
          }
        })
      },

      addArtefact: (a: CollectedArtefact) => {
        set((state) => {
          if (state.artefacts.some(item => item.instanceId === a.instanceId)) return state
          // Also mark as collected in detectedArtefacts list if present
          const updatedDetected = state.detectedArtefacts.map(da =>
            da.instanceId === a.instanceId ? { ...da, collected: true } : da
          )
          // Clear active waypoint if it was this collected artefact
          const clearWaypoint = state.activeWaypoint?.instanceId === a.instanceId ? null : state.activeWaypoint
          return {
            artefacts: [a, ...state.artefacts],
            detectedArtefacts: updatedDetected,
            activeWaypoint: clearWaypoint,
            researchPoints: state.researchPoints + a.rpValue,
          }
        })
      },

      addDetectedArtefact: (da: DetectedArtefact) => {
        set((state) => {
          const exists = state.detectedArtefacts.some(item => item.instanceId === da.instanceId)
          if (exists) {
            return {
              detectedArtefacts: state.detectedArtefacts.map(item =>
                item.instanceId === da.instanceId ? { ...item, ...da } : item
              ),
            }
          }
          return { detectedArtefacts: [da, ...state.detectedArtefacts] }
        })
      },

      setActiveWaypoint: (wp: DetectedArtefact | null) => set({ activeWaypoint: wp }),
      clearActiveWaypoint: () => set({ activeWaypoint: null }),
    }),
    { name: 'unknown-ocean-player' }
  )
)
