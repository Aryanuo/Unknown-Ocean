import { CreatureDNA } from '../../store/usePlayerStore'
import { BiomeType } from '../procedural/biomeGenerator'

export interface MissionObjective {
  id: string
  title: string
  description: string
  category: 'scan' | 'depth' | 'travel' | 'rarity' | 'biome' | 'photo'
  target: number
  progress: number
  rewardRP: number
  completed: boolean
  claimed: boolean
}

export function getDaySeed(): number {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

function seededRNG(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const MISSION_TEMPLATES: Array<{
  title: string
  description: string
  category: MissionObjective['category']
  target: number
  rewardRP: number
  condition?: (data: any) => boolean
}> = [
  {
    title: 'Abyssal Recon',
    description: 'Scan 3 creatures in the Deep Abyss.',
    category: 'biome',
    target: 3,
    rewardRP: 350,
    condition: (data) => data.biome === 'abyss',
  },
  {
    title: 'Reef Surveyor',
    description: 'Scan 4 creatures in Coral Kingdom or Kelp Forest.',
    category: 'biome',
    target: 4,
    rewardRP: 200,
    condition: (data) => data.biome === 'coral' || data.biome === 'kelp',
  },
  {
    title: 'Rare Specimen Hunter',
    description: 'Scan 2 species of Rare or higher rarity.',
    category: 'rarity',
    target: 2,
    rewardRP: 500,
    condition: (data) => ['rare', 'epic', 'legendary', 'mythical'].includes(data.dna?.rarity),
  },
  {
    title: 'Deep Trench Dive',
    description: 'Dive below 3,000m depth.',
    category: 'depth',
    target: 3000,
    rewardRP: 300,
  },
  {
    title: 'Oceanic Expedition',
    description: 'Travel 5,000 meters across the ocean.',
    category: 'travel',
    target: 50, // 50km in-game units (5,000m display)
    rewardRP: 250,
  },
  {
    title: 'Social Behavior Study',
    description: 'Scan 3 creatures exhibiting Schooling or Curious behavior.',
    category: 'scan',
    target: 3,
    rewardRP: 250,
    condition: (data) => ['schooling', 'curious'].includes(data.dna?.behavior),
  },
  {
    title: 'Wildlife Photographer',
    description: 'Capture 3 wildlife photographs in Photo Mode.',
    category: 'photo',
    target: 3,
    rewardRP: 150,
  },
  {
    title: 'Crystal Cavern Probe',
    description: 'Discover 2 species in Crystal Caves.',
    category: 'biome',
    target: 2,
    rewardRP: 300,
    condition: (data) => data.biome === 'crystal',
  },
  {
    title: 'Hydrothermal Extremophiles',
    description: 'Discover 2 species near Hydrothermal Vents.',
    category: 'biome',
    target: 2,
    rewardRP: 400,
    condition: (data) => data.biome === 'hydrothermal',
  },
]

export function generateDailyMissions(daySeed: number = getDaySeed()): MissionObjective[] {
  const rng = seededRNG(daySeed)
  const shuffled = [...MISSION_TEMPLATES].sort(() => rng() - 0.5)

  // Pick 3 missions (1 easy, 1 medium, 1 hard)
  const selected = shuffled.slice(0, 3)

  return selected.map((template, idx) => ({
    id: `daily_${daySeed}_${idx}`,
    title: template.title,
    description: template.description,
    category: template.category,
    target: template.target,
    progress: 0,
    rewardRP: template.rewardRP,
    completed: false,
    claimed: false,
  }))
}

export function checkMissionProgressOnScan(
  missions: MissionObjective[],
  scanData: { speciesId: string; biome: string; depth: number; dna: CreatureDNA }
): MissionObjective[] {
  return missions.map((m) => {
    if (m.completed) return m

    let inc = 0
    if (m.category === 'scan') {
      if (m.title.includes('Social') && ['schooling', 'curious'].includes(scanData.dna?.behavior)) inc = 1
      else if (!m.title.includes('Social')) inc = 1
    } else if (m.category === 'rarity') {
      if (['rare', 'epic', 'legendary', 'mythical'].includes(scanData.dna?.rarity ?? 'common')) inc = 1
    } else if (m.category === 'biome') {
      if (m.title.includes('Abyssal') && scanData.biome === 'Deep Abyss') inc = 1
      else if (m.title.includes('Reef') && (scanData.biome === 'Coral Kingdom' || scanData.biome === 'Kelp Forest')) inc = 1
      else if (m.title.includes('Crystal') && scanData.biome === 'Crystal Caves') inc = 1
      else if (m.title.includes('Hydrothermal') && scanData.biome === 'Hydrothermal Fields') inc = 1
    }

    if (inc > 0) {
      const newProgress = Math.min(m.target, m.progress + inc)
      return {
        ...m,
        progress: newProgress,
        completed: newProgress >= m.target,
      }
    }
    return m
  })
}

export function checkMissionProgressOnDepth(missions: MissionObjective[], currentDepth: number): MissionObjective[] {
  return missions.map((m) => {
    if (m.category === 'depth' && !m.completed) {
      const newProgress = Math.min(m.target, Math.max(m.progress, currentDepth))
      return {
        ...m,
        progress: newProgress,
        completed: newProgress >= m.target,
      }
    }
    return m
  })
}

export function checkMissionProgressOnTravel(missions: MissionObjective[], totalDistanceKm: number): MissionObjective[] {
  return missions.map((m) => {
    if (m.category === 'travel' && !m.completed) {
      const newProgress = Math.min(m.target, totalDistanceKm)
      return {
        ...m,
        progress: newProgress,
        completed: newProgress >= m.target,
      }
    }
    return m
  })
}

export function checkMissionProgressOnPhoto(missions: MissionObjective[]): MissionObjective[] {
  return missions.map((m) => {
    if (m.category === 'photo' && !m.completed) {
      const newProgress = Math.min(m.target, m.progress + 1)
      return {
        ...m,
        progress: newProgress,
        completed: newProgress >= m.target,
      }
    }
    return m
  })
}
