import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { usePlayerStore, Discovery } from '../../store/usePlayerStore'
import { getBiomeAt } from '../../engine/procedural/biomeGenerator'
import { getCreatureSeed, generateCreatureDNA, generateSpeciesId, generateSpeciesName } from '../../engine/procedural/creatureFactory'
import { Creature3D } from './Creature3D'

// ─── Types ────────────────────────────────────────────────────────────────────
interface InstancedCreature {
  id: string          // stable: chunkKey_index
  speciesId: string
  name: string
  dna: any
  wx: number
  wy: number
  wz: number
  scanned: boolean    // true after player has scanned this instance
}

interface Props {
  onScanCreature: (
    id: string, speciesId: string, name: string, dna: any,
    wx: number, wy: number, wz: number,
  ) => void
  onDiscovery: (d: Discovery) => void // kept for legacy compat; no longer auto-fires
}

// ─── Chunk math ───────────────────────────────────────────────────────────────
const CHUNK_SIZE = 250        // world units per chunk – bigger = fewer updates
const LOAD_RADIUS = 1         // ±1 chunk in each axis (3×3×3 = 27 chunks max)
const UNLOAD_DIST = 3         // chunks away before a creature is culled

function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx}|${cy}|${cz}`
}

// Generate the full list of stable creature IDs+data for one chunk (pure function)
function generateChunkCreatures(cx: number, cy: number, cz: number): InstancedCreature[] {
  const chunkX = cx * CHUNK_SIZE
  const chunkY = cy * CHUNK_SIZE
  const chunkZ = cz * CHUNK_SIZE

  const count = 1 + Math.floor(Math.abs(Math.sin(chunkX * 0.001 + chunkZ * 0.002)) * 3)
  const results: InstancedCreature[] = []

  for (let i = 0; i < count; i++) {
    const seed      = getCreatureSeed(chunkX, chunkZ, i)
    const wx        = chunkX + ((seed * 7  + i * 137) % CHUNK_SIZE)
    const wy        = Math.min(-10, chunkY + ((seed * 11 + i * 73) % CHUNK_SIZE))
    const wz        = chunkZ + ((seed * 13 + i * 97)  % CHUNK_SIZE)
    const dna       = generateCreatureDNA(seed)
    const speciesId = generateSpeciesId(seed)
    const name      = generateSpeciesName(dna, seed)
    const id        = `${chunkKey(cx, cy, cz)}_${i}`

    results.push({ id, speciesId, name, dna, wx, wy, wz, scanned: false })
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
  const lastCheckTime   = useRef(0)

  // React render trigger – only incremented when creature set actually changes
  const [renderTick, setRenderTick] = useState(0)

  // Set of speciesIds the player has already scanned
  // Synced via a non-rendering subscription so discovery changes don't re-render CreatureManager
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

  // ── Chunk streaming ────────────────────────────────────────────────────────
  const updateChunks = useCallback((camPos: Vector3) => {
    const px = Math.floor(camPos.x / CHUNK_SIZE)
    const py = Math.floor(camPos.y / CHUNK_SIZE)
    const pz = Math.floor(camPos.z / CHUNK_SIZE)

    const lpc = lastPlayerChunk.current
    if (lpc && lpc.cx === px && lpc.cy === py && lpc.cz === pz) return
    lastPlayerChunk.current = { cx: px, cy: py, cz: pz }

    let changed = false

    // ── Load nearby chunks that aren't already loaded ────────────────────
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
          const ck = chunkKey(px + dx, py + dy, pz + dz)
          if (loadedChunks.current.has(ck)) continue

          loadedChunks.current.add(ck)
          const creatures = generateChunkCreatures(px + dx, py + dy, pz + dz)
          for (const c of creatures) {
            if (!creatureMap.current.has(c.id)) {
              // Preserve scanned state if the player already scanned this speciesId
              c.scanned = discoveredSpecies.current.has(c.speciesId)
              creatureMap.current.set(c.id, c)
              changed = true
            }
          }
        }
      }
    }

    // ── Unload distant chunks ─────────────────────────────────────────────
    for (const ck of loadedChunks.current) {
      const [cx, cy, cz] = ck.split('|').map(Number)
      const distX = Math.abs(cx - px)
      const distY = Math.abs(cy - py)
      const distZ = Math.abs(cz - pz)
      if (distX > UNLOAD_DIST || distY > UNLOAD_DIST || distZ > UNLOAD_DIST) {
        loadedChunks.current.delete(ck)
        // Remove creatures belonging to this chunk
        for (const [id] of creatureMap.current) {
          if (id.startsWith(ck + '_')) {
            creatureMap.current.delete(id)
            changed = true
          }
        }
      }
    }

    if (changed) setRenderTick(t => t + 1)
  }, []) // eslint-disable-line

  // ── Per-frame logic ────────────────────────────────────────────────────────
  useFrame((state) => {
    const now = state.clock.elapsedTime
    // Check every 1.5 seconds – enough to preload chunks before they're needed
    if (now - lastCheckTime.current < 1.5) return
    lastCheckTime.current = now
    updateChunks(state.camera.position)
  })

  // ── Click-to-scan handler passed down to each creature ────────────────────
  const handleCreatureClick = useCallback((c: InstancedCreature) => {
    if (c.scanned) return   // already scanned, ignore re-click silently
    onScanCreature(c.id, c.speciesId, c.name, c.dna, c.wx, c.wy, c.wz)
  }, [onScanCreature])

  // ── Render ─────────────────────────────────────────────────────────────────
  const creatures = Array.from(creatureMap.current.values())

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
          onClick={() => handleCreatureClick(c)}
        />
      ))}
    </>
  )
}
