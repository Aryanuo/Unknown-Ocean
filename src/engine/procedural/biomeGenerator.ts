export type BiomeType =
  | 'coral'
  | 'kelp'
  | 'crystal'
  | 'abyss'
  | 'frozen'
  | 'hydrothermal'
  | 'ruins'
  | 'open'

export interface BiomeConfig {
  name: string
  fogColor: string
  fogDensity: number
  ambientColor: string
  lightColor: string
  lightIntensity: number
  particleColor: string
  depth: [number, number]
  rarity: number
  description: string
}

export const BIOMES: Record<BiomeType, BiomeConfig> = {
  coral: {
    name: 'Coral Kingdom',
    fogColor: '#0077b6',
    fogDensity: 0.018,
    ambientColor: '#003d6b',
    lightColor: '#48cae4',
    lightIntensity: 1.2,
    particleColor: '#90e0ef',
    depth: [0, 200],
    rarity: 1,
    description: 'Vibrant reefs teeming with life. Schools of fish weave through ancient coral formations.',
  },
  kelp: {
    name: 'Kelp Forest',
    fogColor: '#1b4332',
    fogDensity: 0.025,
    ambientColor: '#081c15',
    lightColor: '#52b788',
    lightIntensity: 0.9,
    particleColor: '#74c69d',
    depth: [50, 300],
    rarity: 1,
    description: 'Dense underwater forests where shadows hide ancient creatures.',
  },
  crystal: {
    name: 'Crystal Caves',
    fogColor: '#5b2d8e',
    fogDensity: 0.02,
    ambientColor: '#2d1b69',
    lightColor: '#c77dff',
    lightIntensity: 1.5,
    particleColor: '#e0aaff',
    depth: [200, 600],
    rarity: 2,
    description: 'Caverns of glowing minerals that pulse with mysterious bioluminescent light.',
  },
  abyss: {
    name: 'Deep Abyss',
    fogColor: '#000508',
    fogDensity: 0.04,
    ambientColor: '#000205',
    lightColor: '#023e8a',
    lightIntensity: 0.3,
    particleColor: '#0077b6',
    depth: [1000, 11000],
    rarity: 3,
    description: 'Near total darkness. Massive unknown creatures patrol the crushing depths.',
  },
  frozen: {
    name: 'Frozen Ocean',
    fogColor: '#a8dadc',
    fogDensity: 0.015,
    ambientColor: '#457b9d',
    lightColor: '#e0f7fa',
    lightIntensity: 0.8,
    particleColor: '#caf0f8',
    depth: [0, 400],
    rarity: 2,
    description: 'Arctic waters beneath sheets of ice. Only the hardiest species survive here.',
  },
  hydrothermal: {
    name: 'Hydrothermal Fields',
    fogColor: '#3d0000',
    fogDensity: 0.03,
    ambientColor: '#1a0000',
    lightColor: '#ff4d00',
    lightIntensity: 1.1,
    particleColor: '#ff6b35',
    depth: [500, 3000],
    rarity: 3,
    description: 'Volcanic vents heat the water to extreme temperatures, hosting unique extremophile life.',
  },
  ruins: {
    name: 'Ancient Ruins',
    fogColor: '#1a1a2e',
    fogDensity: 0.022,
    ambientColor: '#0f0e17',
    lightColor: '#ffd60a',
    lightIntensity: 0.7,
    particleColor: '#ffc300',
    depth: [100, 800],
    rarity: 4,
    description: 'Sunken temples of a lost civilization. Fragments of unknown technology lay scattered.',
  },
  open: {
    name: 'Open Ocean',
    fogColor: '#023e8a',
    fogDensity: 0.012,
    ambientColor: '#012a4a',
    lightColor: '#0096c7',
    lightIntensity: 1.0,
    particleColor: '#48cae4',
    depth: [0, 500],
    rarity: 1,
    description: 'Endless water in every direction. The silence itself is the experience.',
  },
}

// Simplex-noise-like deterministic biome mapping
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123
  return x - Math.floor(x)
}

export function getBiomeAt(wx: number, wy: number, depth: number): BiomeType {
  const scale = 0.00015
  const nx = wx * scale
  const ny = wy * scale
  
  // Multi-octave noise approximation
  const n1 = seededRandom(Math.floor(nx) * 31337 + Math.floor(ny) * 7919)
  const n2 = seededRandom(Math.floor(nx * 3) * 2311 + Math.floor(ny * 3) * 4973)
  const n3 = seededRandom(Math.floor(nx * 7) * 1103 + Math.floor(ny * 7) * 6271)
  const noise = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2)

  // Depth override
  if (depth > 2000) return 'abyss'
  if (depth > 1000 && noise > 0.7) return 'hydrothermal'
  
  // Biome thresholds
  if (noise < 0.12) return 'open'
  if (noise < 0.25) return 'coral'
  if (noise < 0.38) return 'kelp'
  if (noise < 0.50) return 'open'
  if (noise < 0.60) return 'frozen'
  if (noise < 0.70) return 'crystal'
  if (noise < 0.83) return 'ruins'
  return 'hydrothermal'
}

export function getBiomeConfig(biome: BiomeType): BiomeConfig {
  return BIOMES[biome]
}
