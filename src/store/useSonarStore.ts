import { create } from 'zustand'
import { Vector3 } from 'three'
import { findNeighbors } from '../engine/creatureRegistry'
import { usePlayerStore } from './usePlayerStore'
import { getNearbyArtefacts } from '../engine/procedural/artefactGenerator'

export interface SonarBlip {
  id: string
  relX: number  // relative X to sub at time of ping
  relZ: number  // relative Z to sub at time of ping
  relY: number  // relative Y (positive = target is above sub, negative = below)
  distance: number
  rarity: string
  scanned: boolean
  timestamp: number
}

const BLIP_LIFETIME_MS = 8000  // blips fade and disappear after 8 seconds

interface SonarState {
  lastPingTime: number
  isPinging: boolean
  blips: SonarBlip[]
  triggerPing: (subPos: Vector3) => void
  pruneExpiredBlips: () => void
}

const BASE_RANGE = 500
const PING_COOLDOWN_MS = 10000 // 10s cooldown

export const useSonarStore = create<SonarState>()((set, get) => ({
  lastPingTime: 0,
  isPinging: false,
  blips: [],

  pruneExpiredBlips: () => {
    const now = Date.now()
    const { blips } = get()
    const alive = blips.filter(b => now - b.timestamp < BLIP_LIFETIME_MS)
    if (alive.length !== blips.length) set({ blips: alive })
  },

  triggerPing: (subPos: Vector3) => {
    const now = Date.now()
    const { lastPingTime } = get()

    if (now - lastPingTime < PING_COOLDOWN_MS) return // Cooldown active

    const sonarLvl = usePlayerStore.getState().equipmentLevel?.sonar ?? 0
    const range = BASE_RANGE * (sonarLvl >= 1 ? 1.5 : 1.0)

    // Query creatures in radius from creature registry
    const neighbors = findNeighbors(subPos, range, -1, 30)

    const creatureBlips: SonarBlip[] = neighbors.map((n) => {
      const relX = n.position.x - subPos.x
      const relZ = n.position.z - subPos.z
      const relY = n.position.y - subPos.y
      const distance = Math.sqrt(relX * relX + relZ * relZ)

      return {
        id: `blip_${n.id}_${now}`,
        relX,
        relZ,
        relY,
        distance,
        rarity: n.rarity,
        scanned: false,
        timestamp: now,
      }
    })

    // Query nearby artefacts if Sonar Lvl >= 1 or for general ping detection
    const nearbyArtefacts = getNearbyArtefacts(subPos.x, subPos.z, range)
    const artefactBlips: SonarBlip[] = nearbyArtefacts.map((art) => {
      const relX = art.position[0] - subPos.x
      const relZ = art.position[2] - subPos.z
      const relY = art.position[1] - subPos.y
      const distance = Math.sqrt(relX * relX + relZ * relZ)

      return {
        id: `blip_art_${art.instanceId}_${now}`,
        relX,
        relZ,
        relY,
        distance,
        rarity: art.def.rarity,
        scanned: false,
        timestamp: now,
      }
    })

    const newBlips = [...creatureBlips, ...artefactBlips]

    set({
      lastPingTime: now,
      isPinging: true,
      blips: newBlips,
    })

    setTimeout(() => set({ isPinging: false }), 2000)
  },
}))
