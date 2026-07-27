/**
 * mysteryGenerator.ts — Procedural hidden mystery placement
 *
 * Mysteries are sparser than creatures: 1 per 5×5 chunk area (1250×1250 world units).
 * Each mystery is seeded from its macro-chunk position, giving a deterministic world.
 * Sonar Level 2 reveals mystery signatures on ping.
 */

export type MysteryType =
  | 'abandoned_lab'
  | 'ancient_ruins'
  | 'ghost_submarine'
  | 'giant_fossil'
  | 'alien_obelisk'
  | 'mysterious_eggs'
  | 'shipwreck'

export type MysteryRarity = 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface MysteryDef {
  type: MysteryType
  name: string
  lore: string
  rarity: MysteryRarity
  rpReward: number
  glowColor: string
  artifactName?: string
  artifactLore?: string
}

// ── Mystery definitions ────────────────────────────────────────────────────────
export const MYSTERY_DEFS: MysteryDef[] = [
  {
    type: 'abandoned_lab',
    name: 'Abandoned Research Station',
    lore: 'A pressurised habitat module — its identification markings corroded beyond recognition. Emergency lights still flicker inside. What experiment was abandoned here, and why did the crew leave in such haste?',
    rarity: 'rare',
    rpReward: 150,
    glowColor: '#00e5ff',
    artifactName: 'Encrypted Data Drive',
    artifactLore: 'Partial telemetry logs. The final entry reads only: "Specimen has breached containment. Do not retrieve."',
  },
  {
    type: 'ancient_ruins',
    name: 'Sunken Temple Complex',
    lore: 'Coral-encrusted stonework of impossible precision. The geometric symbols carved into each block match no known civilisation. The city these belonged to would predate the last glacial maximum by 12,000 years.',
    rarity: 'epic',
    rpReward: 300,
    glowColor: '#ff9800',
    artifactName: 'Stone Cipher Tablet',
    artifactLore: 'A palm-sized obsidian tablet covered in spiraling glyphs. Three linguists have studied it. None agree on translation.',
  },
  {
    type: 'ghost_submarine',
    name: 'Silent Running: Unidentified Submersible',
    lore: 'A military-class submarine, vintage uncertain. All hatches are sealed from the outside. No distress buoy deployed. Registry plates have been deliberately removed. The hull bears no collision damage.',
    rarity: 'rare',
    rpReward: 200,
    glowColor: '#78909c',
    artifactName: 'Sonar Log Cassette',
    artifactLore: 'Magnetic tape in near-perfect condition. The recordings contain 47 minutes of something — breathing, or possibly a biological signal — with no acoustic source.',
  },
  {
    type: 'giant_fossil',
    name: 'Megafauna Skeleton',
    lore: 'An enormous skeletal structure embedded in the sediment — at least 80 metres long. The bone density is three times that of any known cetacean. This creature existed long after the extinction events that should have prevented it.',
    rarity: 'rare',
    rpReward: 175,
    glowColor: '#bcaaa4',
    artifactName: 'Ossified Vertebra Fragment',
    artifactLore: 'A segment of petrified bone the size of a car tyre. Carbon dating will take weeks. You already know it will be wrong.',
  },
  {
    type: 'alien_obelisk',
    name: 'Non-Terrestrial Structure',
    lore: 'A monolith of unknown material — neither mineral nor manufactured. It emits a weak electromagnetic field at a frequency precisely 0.001 Hz higher than any known natural source. No growth, no erosion, no age.',
    rarity: 'legendary',
    rpReward: 500,
    glowColor: '#e040fb',
    artifactName: 'Resonance Crystal',
    artifactLore: 'Broken from the obelisk base. It hums. The frequency changes when you think about it directly.',
  },
  {
    type: 'mysterious_eggs',
    name: 'Unclassified Egg Cluster',
    lore: 'A clutch of translucent ovoids the size of beach balls, anchored to the rock face. The embryos inside are fully formed and watching. Species unknown. Gestation period: unknown. Temperament: unknown.',
    rarity: 'uncommon',
    rpReward: 100,
    glowColor: '#69f0ae',
    artifactName: 'Bioluminescent Shell Shard',
    artifactLore: 'A fragment of hatched eggshell. Still warm. DNA sequencing fails to return a match in any known database.',
  },
  {
    type: 'shipwreck',
    name: 'Deep-Water Wreck Site',
    lore: 'A merchant vessel — perhaps a century old, perhaps three. The manifest plate is gone. The cargo hold is open, its contents long claimed by the sea. One cabin still has a chair facing a porthole, as though someone sat waiting.',
    rarity: 'uncommon',
    rpReward: 125,
    glowColor: '#ff7043',
    artifactName: 'Captain\'s Chronometer',
    artifactLore: 'A brass pocket watch, perfectly preserved in the anaerobic sediment. It is still running. The time is correct.',
  },
]

// ── Seeded RNG ─────────────────────────────────────────────────────────────────
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123
  return x - Math.floor(x)
}

// ── Public mystery data type ───────────────────────────────────────────────────
export interface MysteryInstance {
  id: string
  def: MysteryDef
  wx: number   // world X
  wy: number   // world Y (depth — negative)
  wz: number   // world Z
}

/**
 * MYSTERY_CHUNK_SIZE — each "macro chunk" is 5× the creature chunk size.
 * Gives roughly 1 mystery per 1250×1250 world unit area.
 */
const MYSTERY_CHUNK_SIZE = 1250   // world units
const MYSTERY_DEPTH_MIN  = -200   // not too shallow
const MYSTERY_DEPTH_MAX  = -6000  // not completely inaccessible

/**
 * Get the MysteryInstance for a given macro-chunk coord.
 * Returns null if this chunk has no mystery (50% chance per chunk).
 */
export function getMysteryAtChunk(mcx: number, mcz: number): MysteryInstance | null {
  const seed1 = seededRand(mcx * 1117 + mcz * 997 + 31337)

  // 50% of macro-chunks have a mystery
  if (seed1 > 0.5) return null

  const seed2 = seededRand(mcx * 2311 + mcz * 1777)
  const seed3 = seededRand(mcx * 4003 + mcz * 3331)
  const seed4 = seededRand(mcx * 5003 + mcz * 2027 + 77777)

  // Pick mystery type (weighted by rarity)
  const defIndex = Math.floor(seed2 * MYSTERY_DEFS.length)
  const def = MYSTERY_DEFS[defIndex] ?? MYSTERY_DEFS[0]

  // Scatter position within the macro-chunk
  const wx = mcx * MYSTERY_CHUNK_SIZE + seed3 * MYSTERY_CHUNK_SIZE
  const wz = mcz * MYSTERY_CHUNK_SIZE + seed4 * MYSTERY_CHUNK_SIZE
  const wy = MYSTERY_DEPTH_MIN + seededRand(mcx * 7919 + mcz * 6311) * (MYSTERY_DEPTH_MAX - MYSTERY_DEPTH_MIN)

  return {
    id: `mystery_${mcx}_${mcz}`,
    def,
    wx,
    wy,
    wz,
  }
}

/**
 * Get all MysteryInstances visible in a world-space radius around a point.
 * Checks all macro-chunks within range.
 */
export function getMysteriesNear(
  worldX: number,
  worldZ: number,
  radiusWorldUnits: number,
): MysteryInstance[] {
  const chunkRadius = Math.ceil(radiusWorldUnits / MYSTERY_CHUNK_SIZE) + 1
  const mcxOrigin = Math.floor(worldX / MYSTERY_CHUNK_SIZE)
  const mczOrigin = Math.floor(worldZ / MYSTERY_CHUNK_SIZE)
  const results: MysteryInstance[] = []

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const m = getMysteryAtChunk(mcxOrigin + dx, mczOrigin + dz)
      if (m) results.push(m)
    }
  }
  return results
}
