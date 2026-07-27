import { CreatureDNA } from '../../store/usePlayerStore'
import { BiomeType } from './biomeGenerator'

// ─── Rarity system ────────────────────────────────────────────────────────────
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical'

export const RARITY_WEIGHTS: Rarity[] = [
  'common', 'common', 'common', 'common', 'common', 'common',
  'uncommon', 'uncommon', 'uncommon',
  'rare',
]

// Rarity thresholds from 0–1 seeded RNG with optional biome shift
export function getRarity(rng: () => number, rarityBonus: number = 0): Rarity {
  const r = Math.max(0, rng() - rarityBonus)
  if (r < 0.001) return 'mythical'
  if (r < 0.010) return 'legendary'
  if (r < 0.050) return 'epic'
  if (r < 0.150) return 'rare'
  if (r < 0.400) return 'uncommon'
  return 'common'
}

export const RARITY_CONFIG: Record<Rarity, {
  label: string
  color: string
  glowColor: string
  sizeMultiplier: number
  rpReward: number
  ringStyle: 'none' | 'subtle' | 'pulse' | 'gold' | 'animated' | 'aura'
}> = {
  common:    { label: 'Common',    color: '#90a4ae', glowColor: '#90a4ae', sizeMultiplier: 1.0, rpReward: 10,   ringStyle: 'none' },
  uncommon:  { label: 'Uncommon',  color: '#66bb6a', glowColor: '#66bb6a', sizeMultiplier: 1.2, rpReward: 25,   ringStyle: 'subtle' },
  rare:      { label: 'Rare',      color: '#42a5f5', glowColor: '#42a5f5', sizeMultiplier: 1.5, rpReward: 75,   ringStyle: 'pulse' },
  epic:      { label: 'Epic',      color: '#ab47bc', glowColor: '#ce93d8', sizeMultiplier: 1.8, rpReward: 200,  ringStyle: 'gold' },
  legendary: { label: 'Legendary', color: '#ffa726', glowColor: '#ffcc02', sizeMultiplier: 2.5, rpReward: 500,  ringStyle: 'animated' },
  mythical:  { label: 'Mythical',  color: '#ec407a', glowColor: '#ff80ab', sizeMultiplier: 4.0, rpReward: 2000, ringStyle: 'aura' },
}

// ─── Body archetypes ──────────────────────────────────────────────────────────
export type BodyArchetype = 'fish' | 'ray' | 'eel' | 'jellyfish' | 'cephalopod' | 'leviathan'

// Archetype weights (seeded) with optional biome weights
export function getArchetype(rng: () => number, rarity: Rarity, archetypeWeights?: Record<BodyArchetype, number>): BodyArchetype {
  const r = rng()
  if (rarity === 'legendary' || rarity === 'mythical') {
    if (r < 0.35) return 'leviathan'
  }

  if (archetypeWeights) {
    let acc = 0
    const total = Object.values(archetypeWeights).reduce((a, b) => a + b, 0)
    const roll = r * total
    for (const [arch, weight] of Object.entries(archetypeWeights) as [BodyArchetype, number][]) {
      acc += weight
      if (roll <= acc) return arch
    }
  }

  if (r < 0.35) return 'fish'
  if (r < 0.55) return 'ray'
  if (r < 0.68) return 'eel'
  if (r < 0.80) return 'jellyfish'
  return 'cephalopod'
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS_BY_RARITY: Record<Rarity, string[]> = {
  common: [
    '#90e0ef', '#48cae4', '#0077b6', '#023e8a',
    '#74c69d', '#52b788', '#b7e4c7', '#264653',
    '#f4a261', '#e9c46a', '#e76f51', '#adb5bd',
  ],
  uncommon: [
    '#00b4d8', '#0096c7', '#48cae4', '#52b788',
    '#2d6a4f', '#1b4332', '#ff9f1c', '#ffbf69',
    '#ff6b9d', '#f72585',
  ],
  rare: [
    '#4361ee', '#4cc9f0', '#4895ef', '#7400b8',
    '#6930c3', '#5390d9', '#c77dff', '#e0aaff',
    '#ff4d6d', '#ff758f',
  ],
  epic: [
    '#7209b7', '#560bad', '#480ca8', '#3a0ca3',
    '#b5179e', '#f72585', '#ffd166', '#ef233c',
  ],
  legendary: [
    '#ffd60a', '#ffc300', '#ffb703', '#fb8500',
    '#f4a261', '#e63946', '#06d6a0', '#118ab2',
  ],
  mythical: [
    '#ff006e', '#fb5607', '#ffbe0b', '#8338ec',
    '#3a86ff', '#06d6a0', '#ef233c', '#fff',
  ],
}

// ─── Behaviors ────────────────────────────────────────────────────────────────
const BEHAVIORS = ['curious', 'aggressive', 'friendly', 'schooling', 'territorial', 'sleeping', 'migrating', 'shy', 'predator', 'scavenger'] as const
export type BehaviorType = typeof BEHAVIORS[number]

// ─── Biome Creature Overrides / Configs ────────────────────────────────────────
export interface BiomeCreatureConfig {
  archetypeWeights: Record<BodyArchetype, number>
  behaviors: BehaviorType[]
  colors: string[]
  glowMultiplier: number
  sizeRange: [number, number]
  rarityBonus: number
}

export const BIOME_CREATURE_CONFIGS: Record<BiomeType, BiomeCreatureConfig> = {
  coral: {
    archetypeWeights: { fish: 0.6, ray: 0.2, jellyfish: 0.15, eel: 0.05, cephalopod: 0.0, leviathan: 0.0 },
    behaviors: ['schooling', 'curious', 'friendly'],
    colors: ['#00b4d8', '#48cae4', '#f4a261', '#e76f51', '#74c69d', '#ff9f1c', '#f72585', '#ffd166'],
    glowMultiplier: 0.6,
    sizeRange: [0.3, 1.2],
    rarityBonus: 0.0,
  },
  kelp: {
    archetypeWeights: { eel: 0.4, ray: 0.3, fish: 0.25, cephalopod: 0.05, jellyfish: 0.0, leviathan: 0.0 },
    behaviors: ['territorial', 'shy', 'predator'],
    colors: ['#2d6a4f', '#52b788', '#1b4332', '#b7e4c7', '#ffbf69', '#264653', '#e9c46a'],
    glowMultiplier: 0.8,
    sizeRange: [0.6, 1.8],
    rarityBonus: 0.02,
  },
  crystal: {
    archetypeWeights: { jellyfish: 0.6, eel: 0.2, cephalopod: 0.15, fish: 0.05, ray: 0.0, leviathan: 0.0 },
    behaviors: ['curious', 'sleeping', 'friendly'],
    colors: ['#c77dff', '#e0aaff', '#4895ef', '#7400b8', '#4cc9f0', '#ff758f', '#a8dadc'],
    glowMultiplier: 2.2,
    sizeRange: [0.5, 1.6],
    rarityBonus: 0.05,
  },
  abyss: {
    archetypeWeights: { cephalopod: 0.35, leviathan: 0.25, fish: 0.25, eel: 0.15, ray: 0.0, jellyfish: 0.0 },
    behaviors: ['predator', 'scavenger', 'aggressive'],
    colors: ['#000508', '#023e8a', '#001233', '#ff006e', '#3a0ca3', '#7209b7', '#ef233c'],
    glowMultiplier: 1.8,
    sizeRange: [1.2, 3.5],
    rarityBonus: 0.08,
  },
  frozen: {
    archetypeWeights: { fish: 0.4, ray: 0.3, leviathan: 0.2, eel: 0.1, jellyfish: 0.0, cephalopod: 0.0 },
    behaviors: ['migrating', 'shy', 'sleeping'],
    colors: ['#a8dadc', '#caf0f8', '#e0f7fa', '#457b9d', '#90e0ef', '#ffffff', '#48cae4'],
    glowMultiplier: 0.7,
    sizeRange: [1.0, 2.8],
    rarityBonus: 0.03,
  },
  hydrothermal: {
    archetypeWeights: { eel: 0.4, cephalopod: 0.35, fish: 0.25, ray: 0.0, jellyfish: 0.0, leviathan: 0.0 },
    behaviors: ['aggressive', 'territorial', 'scavenger'],
    colors: ['#ff4d00', '#ff6b35', '#d90429', '#e63946', '#ff9f1c', '#3d0000', '#fb8500'],
    glowMultiplier: 2.0,
    sizeRange: [0.8, 2.2],
    rarityBonus: 0.06,
  },
  ruins: {
    archetypeWeights: { cephalopod: 0.35, jellyfish: 0.25, ray: 0.25, fish: 0.15, eel: 0.0, leviathan: 0.0 },
    behaviors: ['curious', 'territorial', 'shy'],
    colors: ['#ffd60a', '#ffc300', '#7209b7', '#4cc9f0', '#f72585', '#e0aaff', '#06d6a0'],
    glowMultiplier: 1.5,
    sizeRange: [0.7, 2.0],
    rarityBonus: 0.10, // Ruins spawn rarer creatures!
  },
  open: {
    archetypeWeights: { fish: 0.4, ray: 0.35, leviathan: 0.2, eel: 0.05, jellyfish: 0.0, cephalopod: 0.0 },
    behaviors: ['migrating', 'schooling', 'curious'],
    colors: ['#0077b6', '#0096c7', '#03045e', '#48cae4', '#023e8a', '#caf0f8'],
    glowMultiplier: 0.5,
    sizeRange: [0.8, 3.0],
    rarityBonus: 0.01,
  },
}

export function getBiomeCreatureConfig(biome: BiomeType): BiomeCreatureConfig {
  return BIOME_CREATURE_CONFIGS[biome] ?? BIOME_CREATURE_CONFIGS.open
}

// ─── Name parts ───────────────────────────────────────────────────────────────
const PREFIXES: Record<Rarity, string[]> = {
  common:    ['Azure', 'Tidal', 'Drift', 'Reef', 'Sandy', 'Shore', 'Kelp', 'Coral', 'Blue', 'Green'],
  uncommon:  ['Crystal', 'Shadow', 'Ember', 'Cobalt', 'Velvet', 'Silver', 'Indigo', 'Crimson', 'Neon'],
  rare:      ['Phantom', 'Void', 'Lunar', 'Solar', 'Prism', 'Spectral', 'Ancient', 'Ghost', 'Radiant'],
  epic:      ['Abyssal', 'Celestial', 'Ethereal', 'Astral', 'Infernal', 'Arcane', 'Sacred', 'Mythic'],
  legendary: ['Primordial', 'Colossal', 'Eternal', 'Omega', 'Alpha', 'Sovereign', 'Divine'],
  mythical:  ['World-Ender', 'Sea-God', 'Abyss-Born', 'Void-Weaver', 'Dream', 'Titan'],
}

const BODIES: Record<BodyArchetype, string[]> = {
  fish:       ['Ray', 'Drifter', 'Swimmer', 'Glider', 'Stalker', 'Dancer', 'Wanderer', 'Hunter', 'Grazer', 'Floater'],
  ray:        ['Manta', 'Glider', 'Veil', 'Blanket', 'Shade', 'Cape'],
  eel:        ['Serpent', 'Coil', 'Ribbon', 'Needle', 'Strand', 'Wire'],
  jellyfish:  ['Bell', 'Bloom', 'Drift', 'Pulse', 'Veil', 'Wisp'],
  cephalopod: ['Specter', 'Lurker', 'Inkwraith', 'Mantle', 'Tentacle', 'Shroud'],
  leviathan:  ['Leviathan', 'Colossus', 'Elder', 'Ancient', 'Titan', 'Behemoth'],
}

const SUFFIXES = ['fin', 'tail', 'spine', 'glow', 'veil', 'fang', 'eye', 'scale', 'void', 'light', 'shade', 'drift', 'song', 'bloom', 'shard']

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
export function seededRNG(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// ─── Core DNA generator ───────────────────────────────────────────────────────
export function generateCreatureDNA(seed: number, biome?: BiomeType): CreatureDNA {
  const rng = seededRNG(seed)
  const biomeCfg = biome ? getBiomeCreatureConfig(biome) : undefined

  const rarity = getRarity(rng, biomeCfg?.rarityBonus ?? 0)
  const archetype = getArchetype(rng, rarity, biomeCfg?.archetypeWeights)
  const rarityCfg = RARITY_CONFIG[rarity]
  const colorPool = COLORS_BY_RARITY[rarity]

  // Archetype-specific body proportions
  let bodyLength: number
  let bodyWidth: number
  let finCount: number

  switch (archetype) {
    case 'ray':
      bodyLength = 0.3 + rng() * 0.6
      bodyWidth  = 1.2 + rng() * 1.5
      finCount   = 0
      break
    case 'eel':
      bodyLength = 2.5 + rng() * 3.5
      bodyWidth  = 0.12 + rng() * 0.18
      finCount   = Math.floor(rng() * 2)
      break
    case 'jellyfish':
      bodyLength = 0.4 + rng() * 0.8
      bodyWidth  = 0.5 + rng() * 0.8
      finCount   = 0
      break
    case 'cephalopod':
      bodyLength = 0.8 + rng() * 1.2
      bodyWidth  = 0.4 + rng() * 0.6
      finCount   = Math.floor(rng() * 3)
      break
    case 'leviathan':
      bodyLength = 4.0 + rng() * 6.0
      bodyWidth  = 1.2 + rng() * 2.0
      finCount   = 2 + Math.floor(rng() * 3)
      break
    default: // fish
      bodyLength = 0.4 + rng() * 2.0
      bodyWidth  = 0.2 + rng() * 0.7
      finCount   = Math.floor(rng() * 5) + 1
      break
  }

  // Size range from biome or default
  const sizeMin  = biomeCfg?.sizeRange[0] ?? 0.3
  const sizeMax  = biomeCfg?.sizeRange[1] ?? 2.0
  const sizeBase = sizeMin + rng() * (sizeMax - sizeMin)
  const size     = sizeBase * rarityCfg.sizeMultiplier

  // Colors with biome bias
  const primaryPool    = biomeCfg?.colors ?? colorPool
  const primaryColor   = primaryPool[Math.floor(rng() * primaryPool.length)]
  const secondaryColor = colorPool[Math.floor(rng() * colorPool.length)]
  const glowColor      = rng() > 0.4 ? rarityCfg.glowColor : primaryPool[Math.floor(rng() * primaryPool.length)]

  // Glow intensity with biome multiplier
  const rarityGlowBonus = { common: 0, uncommon: 0.1, rare: 0.25, epic: 0.5, legendary: 0.75, mythical: 1.0 }[rarity]
  const glowMult        = biomeCfg?.glowMultiplier ?? 1.0
  const glowIntensity   = (rarityGlowBonus + rng() * rng() * 0.4) * glowMult

  // Speed: varies by archetype
  const speedBase = { fish: 0.8, ray: 0.5, eel: 0.6, jellyfish: 0.15, cephalopod: 0.7, leviathan: 0.3 }[archetype]
  const speed     = speedBase * (0.6 + rng() * 0.8)

  // Behavior from biome pool or global pool
  const behaviorPool = biomeCfg?.behaviors ?? BEHAVIORS
  const behavior     = behaviorPool[Math.floor(rng() * behaviorPool.length)] as BehaviorType

  return {
    bodyLength,
    bodyWidth,
    finCount,
    eyeCount:       archetype === 'jellyfish' ? 0 : (Math.floor(rng() * 2) + (archetype === 'cephalopod' ? 2 : 1)),
    tailType:       Math.floor(rng() * 5),
    primaryColor,
    secondaryColor,
    glowColor,
    glowIntensity,
    speed,
    behavior,
    size,
    stripePattern:  Math.floor(rng() * 6),
    transparency:   archetype === 'jellyfish' ? (0.35 + rng() * 0.4) : (0.85 + rng() * 0.15),
    rarity,
    archetype,
  }
}

export function getCreatureSeed(worldX: number, worldY: number, index: number): number {
  return Math.abs(worldX * 73856093 ^ worldY * 19349663 ^ index * 83492791) % 2147483647
}

export function generateSpeciesId(seed: number): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const a = letters[seed % 24]
  const b = letters[(seed >> 4) % 24]
  const num = (seed % 99999).toString().padStart(5, '0')
  return `${a}${b}-${num}`
}

export function generateSpeciesName(dna: CreatureDNA, seed: number): string {
  const rng = seededRNG(seed + 7)
  const rarity   = (dna.rarity ?? 'common') as Rarity
  const archetype = (dna.archetype ?? 'fish') as BodyArchetype

  const prefixPool = PREFIXES[rarity]
  const bodyPool   = BODIES[archetype]
  const suffix     = SUFFIXES[Math.floor(rng() * SUFFIXES.length)]
  const prefix     = prefixPool[Math.floor(rng() * prefixPool.length)]
  const body       = bodyPool[Math.floor(rng() * bodyPool.length)]

  if (rarity === 'legendary' || rarity === 'mythical') {
    return `${prefix} ${body}`
  }
  return `${prefix} ${body}${suffix}`
}
