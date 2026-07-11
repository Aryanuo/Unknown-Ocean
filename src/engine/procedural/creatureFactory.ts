import { CreatureDNA } from '../../store/usePlayerStore'

const BEHAVIORS = ['curious', 'aggressive', 'friendly', 'schooling', 'territorial', 'sleeping', 'migrating', 'shy', 'predator', 'scavenger']
const COLORS = [
  '#00b4d8', '#90e0ef', '#0077b6', '#023e8a',
  '#7400b8', '#6930c3', '#5390d9', '#4ea8de',
  '#ff9f1c', '#ffbf69', '#ff6b9d', '#c77dff',
  '#2d6a4f', '#52b788', '#74c69d', '#b7e4c7',
  '#e63946', '#f4a261', '#e76f51', '#264653',
]

function seededRNG(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function generateCreatureDNA(seed: number): CreatureDNA {
  const rng = seededRNG(seed)
  return {
    bodyLength:      0.4 + rng() * 2.6,
    bodyWidth:       0.2 + rng() * 0.8,
    finCount:        Math.floor(rng() * 6) + 1,
    eyeCount:        Math.floor(rng() * 4) + 1,
    tailType:        Math.floor(rng() * 5),
    primaryColor:    COLORS[Math.floor(rng() * COLORS.length)],
    secondaryColor:  COLORS[Math.floor(rng() * COLORS.length)],
    glowColor:       COLORS[Math.floor(rng() * COLORS.length)],
    glowIntensity:   rng() * rng(), // bias toward low glow
    speed:           0.3 + rng() * 1.4,
    behavior:        BEHAVIORS[Math.floor(rng() * BEHAVIORS.length)],
    size:            0.3 + rng() * 3.5,
    stripePattern:   Math.floor(rng() * 6),
    transparency:    0.85 + rng() * 0.15,
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
  const prefixes = ['Azure', 'Phantom', 'Crystal', 'Shadow', 'Ember', 'Void', 'Solar', 'Lunar', 'Abyssal', 'Radiant', 'Silent', 'Ancient', 'Ghost', 'Neon', 'Crimson', 'Cobalt', 'Velvet', 'Spectral', 'Prism', 'Tidal']
  const bodies = ['Ray', 'Drifter', 'Swimmer', 'Glider', 'Stalker', 'Lurker', 'Dancer', 'Wanderer', 'Hunter', 'Grazer', 'Feeder', 'Floater', 'Specter', 'Leviathan', 'Mote']
  const suffixes = ['fin', 'tail', 'spine', 'glow', 'veil', 'fang', 'eye', 'scale', 'void', 'light', 'shade', 'drift']

  const rng = seededRNG(seed + 7)
  const prefix = prefixes[Math.floor(rng() * prefixes.length)]
  const body   = bodies[Math.floor(rng() * bodies.length)]
  const suffix = suffixes[Math.floor(rng() * suffixes.length)]

  return `${prefix} ${body}${suffix}`
}
