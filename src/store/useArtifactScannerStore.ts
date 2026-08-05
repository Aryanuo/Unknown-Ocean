import { create } from 'zustand'
import { Vector3 } from 'three'
import { usePlayerStore, DetectedArtefact } from './usePlayerStore'
import { getNearbyArtefacts, ArtefactInstance } from '../engine/procedural/artefactGenerator'
import { getMysteriesNear, MysteryInstance } from '../engine/procedural/mysteryGenerator'

export interface SignalInfo {
  id: string
  name: string
  type: string
  rarity: string
  distance: number
  cardinalDir: string
  arrowIcon: string
  signalStrength: 'Weak' | 'Moderate' | 'Strong' | 'Very Strong'
  relY: number
  position: [number, number, number]
  isMystery?: boolean
}

interface ScannerConfig {
  range: number
  maxRarityRank: number
  cooldownMs: number
  showDepth: boolean
}

const SCANNER_CONFIGS: Record<number, ScannerConfig> = {
  0: { range: 400, maxRarityRank: 0, cooldownMs: 15000, showDepth: false },
  1: { range: 450, maxRarityRank: 1, cooldownMs: 14000, showDepth: false },
  2: { range: 550, maxRarityRank: 2, cooldownMs: 12000, showDepth: false },
  3: { range: 600, maxRarityRank: 4, cooldownMs: 10000, showDepth: false },
  4: { range: 800, maxRarityRank: 5, cooldownMs: 8000,  showDepth: true  },
}

const RARITY_RANKS: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythical: 5,
}

interface ArtifactScannerState {
  lastScanTime: number
  isScanning: boolean
  activeSignal: SignalInfo | null
  scanPulseRadius: number
  scanToast: string | null
  triggerScan: (subPos: Vector3, subHeadingYaw: number) => void
  clearSignal: () => void
  clearToast: () => void
}

/**
 * Calculates 8-way cardinal direction and arrow icon relative to submarine heading
 */
export function calculateDirection(relX: number, relZ: number, subHeadingYaw: number): { cardinal: string; arrow: string } {
  // World angle from sub to target (0 = North/Z-, PI/2 = East/X+, etc.)
  const worldAngle = Math.atan2(relX, -relZ)
  // Relative angle accounting for sub yaw
  let relAngle = worldAngle - subHeadingYaw
  while (relAngle < -Math.PI) relAngle += Math.PI * 2
  while (relAngle > Math.PI) relAngle -= Math.PI * 2

  // Convert angle (-PI to PI) to 8 sectors
  const deg = (relAngle * 180) / Math.PI

  if (deg >= -22.5 && deg < 22.5)   return { cardinal: 'North',     arrow: '⬆' }
  if (deg >= 22.5 && deg < 67.5)     return { cardinal: 'Northeast', arrow: '↗' }
  if (deg >= 67.5 && deg < 112.5)    return { cardinal: 'East',      arrow: '➡' }
  if (deg >= 112.5 && deg < 157.5)   return { cardinal: 'Southeast', arrow: '↘' }
  if (deg >= 157.5 || deg < -157.5)  return { cardinal: 'South',     arrow: '⬇' }
  if (deg >= -157.5 && deg < -112.5) return { cardinal: 'Southwest', arrow: '↙' }
  if (deg >= -112.5 && deg < -67.5)  return { cardinal: 'West',      arrow: '⬅' }
  return { cardinal: 'Northwest', arrow: '↖' }
}

export const useArtifactScannerStore = create<ArtifactScannerState>()((set, get) => ({
  lastScanTime: 0,
  isScanning: false,
  activeSignal: null,
  scanPulseRadius: 0,
  scanToast: null,

  clearSignal: () => set({ activeSignal: null }),
  clearToast: () => set({ scanToast: null }),

  triggerScan: (subPos: Vector3, subHeadingYaw: number) => {
    const now = Date.now()
    const { lastScanTime } = get()
    const level = usePlayerStore.getState().equipmentLevel?.scanner ?? 0
    const config = SCANNER_CONFIGS[level] ?? SCANNER_CONFIGS[0]

    if (now - lastScanTime < config.cooldownMs) return // Cooldown active

    const collectedArtefacts = usePlayerStore.getState().artefacts
    const collectedSet = new Set(collectedArtefacts.map(a => a.instanceId))
    const discoveredMysteries = usePlayerStore.getState().discoveredMysteries
    const mysterySet = new Set(discoveredMysteries.map(m => m.id))

    // Query nearby artefacts
    const nearbyArtefacts = getNearbyArtefacts(subPos.x, subPos.z, config.range)
    const validArtefacts = nearbyArtefacts.filter(art => {
      if (collectedSet.has(art.instanceId)) return false
      const rank = RARITY_RANKS[art.def.rarity] ?? 0
      return rank <= config.maxRarityRank
    })

    // Query nearby mysteries
    const nearbyMysteries = getMysteriesNear(subPos.x, subPos.z, config.range)
    const validMysteries = nearbyMysteries.filter(m => {
      const rank = RARITY_RANKS[m.def.rarity] ?? 0
      return rank <= config.maxRarityRank
    })

    // Combine candidate signals
    type Candidate = {
      id: string
      name: string
      type: string
      rarity: string
      pos: [number, number, number]
      isMystery?: boolean
    }

    const candidates: Candidate[] = [
      ...validArtefacts.map(art => ({
        id: art.instanceId,
        name: art.def.name,
        type: art.def.type,
        rarity: art.def.rarity,
        pos: art.position,
      })),
      ...validMysteries.map(m => ({
        id: m.id,
        name: m.def.name,
        type: m.def.type,
        rarity: m.def.rarity,
        pos: [m.wx, m.wy, m.wz] as [number, number, number],
        isMystery: true,
      })),
    ]

    set({ lastScanTime: now, isScanning: true, scanPulseRadius: config.range })

    if (candidates.length === 0) {
      set({
        activeSignal: null,
        scanToast: 'Scan complete. No uncollected artifacts in range.',
      })
      setTimeout(() => set({ isScanning: false }), 1500)
      return
    }

    // Find nearest target
    let closestCandidate: Candidate | null = null
    let minDistance = Infinity
    let closestRelX = 0, closestRelZ = 0, closestRelY = 0

    for (const c of candidates) {
      const dx = c.pos[0] - subPos.x
      const dz = c.pos[2] - subPos.z
      const dy = c.pos[1] - subPos.y
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < minDistance) {
        minDistance = dist
        closestCandidate = c
        closestRelX = dx
        closestRelZ = dz
        closestRelY = dy
      }
    }

    if (closestCandidate) {
      const { cardinal, arrow } = calculateDirection(closestRelX, closestRelZ, subHeadingYaw)
      const frac = minDistance / config.range
      const signalStrength = frac < 0.25 ? 'Very Strong' : frac < 0.5 ? 'Strong' : frac < 0.75 ? 'Moderate' : 'Weak'

      const signalInfo: SignalInfo = {
        id: closestCandidate.id,
        name: closestCandidate.name,
        type: closestCandidate.type,
        rarity: closestCandidate.rarity,
        distance: Math.round(minDistance),
        cardinalDir: cardinal,
        arrowIcon: arrow,
        signalStrength,
        relY: Math.round(closestRelY),
        position: closestCandidate.pos,
        isMystery: closestCandidate.isMystery,
      }

      // Save detected artifact to player store so it appears on World Map
      usePlayerStore.getState().addDetectedArtefact({
        instanceId: closestCandidate.id,
        artefactId: closestCandidate.id,
        name: closestCandidate.name,
        type: closestCandidate.type,
        rarity: closestCandidate.rarity,
        position: closestCandidate.pos,
        timestamp: now,
        collected: false,
      })

      set({
        activeSignal: signalInfo,
        scanToast: `📡 ${closestCandidate.isMystery ? 'Mystery Anomaly' : 'Artifact Signal'} Detected (${cardinal})`,
      })
    }

    setTimeout(() => set({ isScanning: false }), 2000)
  },
}))
