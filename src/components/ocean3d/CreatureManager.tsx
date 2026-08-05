import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { usePlayerStore, Discovery } from '../../store/usePlayerStore'
import { useWorldStore } from '../../store/useWorldStore'
import { getBiomeAt } from '../../engine/procedural/biomeGenerator'
import { getCreatureSeed, generateCreatureDNA, generateSpeciesId, generateSpeciesName } from '../../engine/procedural/creatureFactory'
import { Creature3D, registerSubPos } from './Creature3D'
import { heroSubWorldPos } from './Hero'

// ─── Types ────────────────────────────────────────────────────────────────────
interface InstancedCreature {
  id: string          // stable: chunkKey_index
  speciesId: string
  name: string
  dna: any
  wx: number
  wy: number
  wz: number
  scanned: boolean
  spawnTime: number   // elapsed time at spawn — used for fade-in
}

interface Props {
  onScanCreature: (
    id: string, speciesId: string, name: string, dna: any,
    wx: number, wy: number, wz: number,
  ) => void
  onDiscovery: (d: Discovery) => void // kept for legacy compat
}

// ─── Chunk math ───────────────────────────────────────────────────────────────
const CHUNK_SIZE  = 250        // world units per chunk
const LOAD_RADIUS = 2          // ±2 chunks in each axis → 5×5×5 = 125 chunks, but practically 5×5 XZ = 25
const UNLOAD_DIST = 4          // unload when > 4 chunks away

// Spawn protection radius — don't place fish directly on top of player
const SPAWN_PROTECT_RADIUS = 30

function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx}|${cy}|${cz}`
}

// Module-level ref for event spawn rate multiplier
const spawnRateRef = { current: 1.0 }

// Generate the full list of stable creature IDs+data for one chunk (pure function)
function generateChunkCreatures(
  cx: number, cy: number, cz: number,
  playerX: number, playerZ: number,
): InstancedCreature[] {
  const chunkX = cx * CHUNK_SIZE
  const chunkY = cy * CHUNK_SIZE
  const chunkZ = cz * CHUNK_SIZE

  // Dense but bounded local population: 5–10 creatures per streamed chunk.
  const baseCount = 5 + Math.floor(Math.abs(Math.sin(chunkX * 0.001 + chunkZ * 0.002)) * 6)
  const count = Math.min(12, Math.floor(baseCount * spawnRateRef.current))
  const results: InstancedCreature[] = []

  for (let i = 0; i < count; i++) {
    const seed      = getCreatureSeed(chunkX, chunkZ, i)
    const wx        = chunkX + ((seed * 7  + i * 137) % CHUNK_SIZE)
    const wy        = Math.min(-10, chunkY + ((seed * 11 + i * 73) % CHUNK_SIZE))
    const wz        = chunkZ + ((seed * 13 + i * 97)  % CHUNK_SIZE)

    // Skip spawning too close to player (anti-pop)
    const dx = wx - playerX
    const dz = wz - playerZ
    if (dx * dx + dz * dz < SPAWN_PROTECT_RADIUS * SPAWN_PROTECT_RADIUS) continue

    const depth     = Math.abs(wy)
    const biome     = getBiomeAt(wx, wz, depth)
    const dna       = generateCreatureDNA(seed, biome)
    const speciesId = generateSpeciesId(seed)
    const name      = generateSpeciesName(dna, seed)
    const id        = `${chunkKey(cx, cy, cz)}_${i}`

    results.push({ id, speciesId, name, dna, wx, wy, wz, scanned: false, spawnTime: -1 })
  }
  return results
}

// ─────────────────────────────────────────────────────────────────────────────

export function CreatureManager({ onScanCreature, onDiscovery }: Props) {
  // Persistent map: id → creature data (never fully replaced)
  const creatureMap  = useRef<Map<string, InstancedCreature>>(new Map())
  // Set of chunk keys currently loaded
  const loadedChunks = useRef<Set<string>>(new Set())
  // Last player chunk position so we don't re-run logic every frame
  const lastPlayerChunk = useRef<{ cx: number; cy: number; cz: number } | null>(null)
  const lastCheckTime   = useRef(-1.5)

  // React render trigger – only incremented when creature set actually changes
  const [renderTick, setRenderTick] = useState(0)

  // Cached creature array — only rebuilt when renderTick changes
  const cachedCreatures = useRef<InstancedCreature[]>([])

  // Sync event spawn rate from world store (no re-renders; just update a ref)
  useEffect(() => {
    const updateRate = () => {
      const mult = useWorldStore.getState().dailyEvent?.worldEffect?.spawnRateMultiplier ?? 1.0
      spawnRateRef.current = mult
    }
    updateRate()
    const unsub = useWorldStore.subscribe(updateRate)
    return unsub
  }, [])

  // Set of speciesIds the player has already scanned
  const discoveredSpecies = useRef<Set<string>>(
    new Set(usePlayerStore.getState().discoveries.map(d => d.speciesId))
  )

  useEffect(() => {
    const unsub = usePlayerStore.subscribe(
      (state) => {
        discoveredSpecies.current = new Set(state.discoveries.map(d => d.speciesId))
      }
    )
    return unsub
  }, [])

  // ── Chunk streaming ────────────────────────────────────────────────────
  const updateChunks = useCallback((camPos: Vector3, elapsedTime: number) => {
    const px = Math.floor(camPos.x / CHUNK_SIZE)
    const py = Math.floor(camPos.y / CHUNK_SIZE)
    const pz = Math.floor(camPos.z / CHUNK_SIZE)

    const lpc = lastPlayerChunk.current
    if (lpc && lpc.cx === px && lpc.cy === py && lpc.cz === pz) return
    lastPlayerChunk.current = { cx: px, cy: py, cz: pz }

    let changed = false

    // ── Load nearby chunks ────────────────────────────────────────────
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
          const ck = chunkKey(px + dx, py + dy, pz + dz)
          if (loadedChunks.current.has(ck)) continue

          loadedChunks.current.add(ck)
          const creatures = generateChunkCreatures(
            px + dx, py + dy, pz + dz,
            camPos.x, camPos.z,
          )
          for (const c of creatures) {
            if (!creatureMap.current.has(c.id)) {
              c.scanned = discoveredSpecies.current.has(c.speciesId)
              c.spawnTime = elapsedTime  // record spawn time for fade-in
              creatureMap.current.set(c.id, c)
              changed = true
            }
          }
        }
      }
    }

    // ── Unload distant chunks ─────────────────────────────────────────
    for (const ck of loadedChunks.current) {
      const [cx, cy, cz] = ck.split('|').map(Number)
      const distX = Math.abs(cx - px)
      const distY = Math.abs(cy - py)
      const distZ = Math.abs(cz - pz)
      if (distX > UNLOAD_DIST || distY > UNLOAD_DIST || distZ > UNLOAD_DIST) {
        loadedChunks.current.delete(ck)
        for (const [id] of creatureMap.current) {
          if (id.startsWith(ck + '_')) {
            creatureMap.current.delete(id)
            changed = true
          }
        }
      }
    }

    if (changed) {
      cachedCreatures.current = Array.from(creatureMap.current.values())
      setRenderTick(t => t + 1)
    }
  }, []) // eslint-disable-line

  // ── Per-frame logic ────────────────────────────────────────────────────────
  useFrame((state) => {
    const now = state.clock.elapsedTime
    registerSubPos(heroSubWorldPos.current)
    // Check every 1.5 seconds
    if (now - lastCheckTime.current < 1.5) return
    lastCheckTime.current = now
    updateChunks(state.camera.position, now)
  })

  // ── Click-to-scan handler ─────────────────────────────────────────────────
  const handleCreatureClick = useCallback((c: InstancedCreature) => {
    if (c.scanned) return
    onScanCreature(c.id, c.speciesId, c.name, c.dna, c.wx, c.wy, c.wz)
  }, [onScanCreature])

  // ── Render ─────────────────────────────────────────────────────────────────
  const creatures = cachedCreatures.current

  return (
    <>
      {creatures.map((c) => (
        <Creature3D
          key={c.id}
          id={c.speciesId.charCodeAt(0) + c.speciesId.charCodeAt(1)}
          dna={c.dna}
          wx={c.wx}
          wy={c.wy}
          wz={c.wz}
          scanned={c.scanned || discoveredSpecies.current.has(c.speciesId)}
          spawnTime={c.spawnTime}
          onClick={() => handleCreatureClick(c)}
        />
      ))}
    </>
  )
}
