/**
 * photoScorer.ts — Photography scoring algorithm
 *
 * Evaluates composition, creature rarity, distance, behavior, and camera upgrade level
 * when taking a snapshot in Photo Mode.
 */
import { Vector3 } from 'three'
import { findNeighbors, CreatureEntry } from '../creatureRegistry'
import { heroSubWorldPos } from '../../components/ocean3d/Hero'

export interface PhotoScoreResult {
  score: number
  rpEarned: number
  subjectName: string
  subjectRarity: string
  subjectBehavior: string
  creaturesCount: number
  breakdown: {
    basePoints: number
    rarityMultiplier: number
    distanceBonus: number
    behaviorBonusPct: number
    multiCreatureBonusPct: number
    cameraLevelBonusPct: number
  }
}

const RARITY_MULTIPLIERS: Record<string, number> = {
  common:    1.0,
  uncommon:  2.0,
  rare:      4.5,
  epic:      10.0,
  legendary: 25.0,
  mythical:  60.0,
}

const BEHAVIOR_BONUSES: Record<string, number> = {
  chase:      0.5,
  flee:       0.4,
  charge:     0.5,
  orbit:      0.35,
  school:     0.4,
  schooling:  0.4,
  spiral:     0.3,
  sleeping:   0.3,
  predator:   0.45,
  scavenger:  0.25,
  territorial:0.35,
}

export function calculatePhotoScore(cameraLvl: number = 0): PhotoScoreResult {
  const subPos = heroSubWorldPos.current
  // Query all creatures within 120 units
  const nearby = findNeighbors(subPos, 120, -1, 20)

  if (nearby.length === 0) {
    // Landscape photo
    const basePoints = 150
    const cameraBonus = cameraLvl >= 2 ? 0.25 : 0
    const finalScore = Math.round(basePoints * (1 + cameraBonus))
    const rp = Math.max(10, Math.round(finalScore / 10))

    return {
      score: finalScore,
      rpEarned: rp,
      subjectName: 'Ocean Landscape',
      subjectRarity: 'common',
      subjectBehavior: 'ambient',
      creaturesCount: 0,
      breakdown: {
        basePoints,
        rarityMultiplier: 1.0,
        distanceBonus: 0,
        behaviorBonusPct: 0,
        multiCreatureBonusPct: 0,
        cameraLevelBonusPct: cameraBonus * 100,
      },
    }
  }

  // Sort creatures by distance to submarine
  const sorted = [...nearby].map((c) => {
    const dx = c.position.x - subPos.x
    const dy = c.position.y - subPos.y
    const dz = c.position.z - subPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    return { entry: c, dist }
  }).sort((a, b) => a.dist - b.dist)

  // Pick primary subject (prefer closest or highest rarity)
  const primary = sorted[0]
  const creature = primary.entry
  const dist = primary.dist

  const rarity = creature.rarity || 'common'
  const rarityMult = RARITY_MULTIPLIERS[rarity] || 1.0

  // Base points by size & archetype
  const basePoints = 250 + Math.round(creature.size * 20)

  // Distance bonus (optimal range 5 - 35 units)
  let distanceBonus = 0
  if (dist >= 5 && dist <= 35) {
    distanceBonus = 150
  } else if (dist <= 60) {
    distanceBonus = 60
  }

  // Behavior bonus
  const behaviorBonusPct = BEHAVIOR_BONUSES[creature.behavior] || 0.15

  // Multi-creature bonus (+25% per extra creature, max +125%)
  const extraCreatures = sorted.length - 1
  const multiCreatureBonusPct = Math.min(1.25, extraCreatures * 0.25)

  // Camera upgrade bonus
  const cameraLevelBonusPct = cameraLvl >= 2 ? 0.25 : cameraLvl >= 1 ? 0.10 : 0

  // Calculate final score
  const subtotal = (basePoints * rarityMult + distanceBonus)
  const totalMultiplier = 1 + behaviorBonusPct + multiCreatureBonusPct + cameraLevelBonusPct
  const score = Math.round(subtotal * totalMultiplier)
  const rpEarned = Math.max(15, Math.round(score / 8))

  // Generate subject name
  const archetypeStr = creature.archetype ? creature.archetype.toUpperCase() : 'CREATURE'
  const subjectName = `${rarity.toUpperCase()} ${archetypeStr}`

  return {
    score,
    rpEarned,
    subjectName,
    subjectRarity: rarity,
    subjectBehavior: creature.behavior,
    creaturesCount: sorted.length,
    breakdown: {
      basePoints,
      rarityMultiplier: rarityMult,
      distanceBonus,
      behaviorBonusPct: Math.round(behaviorBonusPct * 100),
      multiCreatureBonusPct: Math.round(multiCreatureBonusPct * 100),
      cameraLevelBonusPct: Math.round(cameraLevelBonusPct * 100),
    },
  }
}
