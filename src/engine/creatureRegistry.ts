/**
 * creatureRegistry.ts — Shared spatial index for creature awareness
 *
 * Every live creature registers its position, behavior, size, and velocity
 * each frame. Other creatures can query neighbors for schooling, predation,
 * and other proximity-based behaviors.
 *
 * Uses a simple flat map — with ~100 creatures max loaded this is fast enough.
 * If creature count exceeds ~500, switch to a spatial hash grid.
 */
import { Vector3 } from 'three'

export interface CreatureEntry {
  id: number          // stable numeric id
  position: Vector3   // world position (updated per-frame)
  velocity: Vector3   // current velocity (updated per-frame)
  behavior: string    // DNA behavior type
  size: number        // creature size (used to determine prey vs predator)
  archetype: string   // body archetype
  speed: number       // DNA speed value
  rarity: string      // rarity tier (for sonar blip coloring)
}

// The registry itself — module-level singleton
const _registry = new Map<number, CreatureEntry>()

// Scratch vectors to avoid allocation in hot path
const _diff = new Vector3()

/**
 * Register or update a creature in the registry.
 * Call every frame from Creature3D useFrame.
 */
export function registerCreature(
  id: number,
  position: Vector3,
  velocity: Vector3,
  behavior: string,
  size: number,
  archetype: string,
  speed: number,
  rarity: string = 'common',
): void {
  let entry = _registry.get(id)
  if (!entry) {
    entry = {
      id,
      position: position.clone(),
      velocity: velocity.clone(),
      behavior,
      size,
      archetype,
      speed,
      rarity,
    }
    _registry.set(id, entry)
  } else {
    entry.position.copy(position)
    entry.velocity.copy(velocity)
    entry.rarity = rarity
  }
}

/**
 * Remove a creature from the registry (on unmount).
 */
export function unregisterCreature(id: number): void {
  _registry.delete(id)
}

/**
 * Find all neighbors within a given radius of `origin`.
 * Returns an array of entries (excludes the creature with `excludeId`).
 *
 * NOTE: Allocates a new array — call sparingly (e.g. once per 10 frames, not every frame).
 */
export function findNeighbors(
  origin: Vector3,
  radius: number,
  excludeId: number,
  maxResults: number = 12,
): CreatureEntry[] {
  const r2 = radius * radius
  const results: CreatureEntry[] = []

  for (const entry of _registry.values()) {
    if (entry.id === excludeId) continue
    _diff.copy(entry.position).sub(origin)
    if (_diff.lengthSq() < r2) {
      results.push(entry)
      if (results.length >= maxResults) break
    }
  }
  return results
}

/**
 * Find the nearest creature matching a filter function.
 */
export function findNearest(
  origin: Vector3,
  radius: number,
  excludeId: number,
  filter?: (e: CreatureEntry) => boolean,
): CreatureEntry | null {
  const r2 = radius * radius
  let best: CreatureEntry | null = null
  let bestDist = Infinity

  for (const entry of _registry.values()) {
    if (entry.id === excludeId) continue
    if (filter && !filter(entry)) continue
    _diff.copy(entry.position).sub(origin)
    const d2 = _diff.lengthSq()
    if (d2 < r2 && d2 < bestDist) {
      bestDist = d2
      best = entry
    }
  }
  return best
}

/**
 * Find schoolmates — same behavior and archetype, within range.
 */
export function findSchoolmates(
  origin: Vector3,
  radius: number,
  excludeId: number,
  behavior: string,
): CreatureEntry[] {
  return findNeighbors(origin, radius, excludeId, 8).filter(
    e => e.behavior === behavior || e.behavior === 'schooling'
  )
}

/**
 * Clear the entire registry (e.g. on scene unmount).
 */
export function clearRegistry(): void {
  _registry.clear()
}
