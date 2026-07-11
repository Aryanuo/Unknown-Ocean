import { useState, useCallback, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { usePlayerStore, Discovery } from '../../store/usePlayerStore'
import { getBiomeAt } from '../../engine/procedural/biomeGenerator'
import { getCreatureSeed, generateCreatureDNA, generateSpeciesId, generateSpeciesName } from '../../engine/procedural/creatureFactory'
import { Creature3D } from './Creature3D'

interface InstancedCreature {
  id: string        // stable string key from chunk coords + index
  speciesId: string
  name: string
  dna: any
  wx: number
  wy: number
  wz: number
  discovered: boolean
}

export function CreatureManager({ onDiscovery }: { onDiscovery: (d: Discovery) => void }) {
  const { discoveries, playerName } = usePlayerStore()
  const discoveredIds = useRef<Set<string>>(new Set(discoveries.map(d => d.speciesId)))
  const [creatureList, setCreatureList] = useState<InstancedCreature[]>([])

  const lastChunk = useRef<{ cx: number; cy: number; cz: number }>({ cx: 99999, cy: 99999, cz: 99999 })
  const lastCheckTime = useRef(0)

  const spawnCreatures = useCallback((camPos: Vector3) => {
    const chunkSize = 200
    const cx = Math.floor(camPos.x / chunkSize)
    const cy = Math.floor(camPos.y / chunkSize)
    const cz = Math.floor(camPos.z / chunkSize)

    if (cx === lastChunk.current.cx && cy === lastChunk.current.cy && cz === lastChunk.current.cz) return
    lastChunk.current = { cx, cy, cz }

    const newCreatures: InstancedCreature[] = []

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const chunkX = (cx + dx) * chunkSize
          const chunkY = (cy + dy) * chunkSize
          const chunkZ = (cz + dz) * chunkSize

          const count = 1 + Math.floor(Math.abs(Math.sin(chunkX * 0.001 + chunkZ * 0.002)) * 3)

          for (let i = 0; i < count; i++) {
            const seed = getCreatureSeed(chunkX, chunkZ, i)
            const wx   = chunkX + ((seed * 7  + i * 137) % chunkSize)
            const wy   = Math.min(-10, chunkY + ((seed * 11 + i * 73) % chunkSize))
            const wz   = chunkZ + ((seed * 13 + i * 97)  % chunkSize)

            const dna       = generateCreatureDNA(seed)
            const speciesId = generateSpeciesId(seed)
            const name      = generateSpeciesName(dna, seed)

            // Stable key from chunk coordinates + index — never changes for a given chunk
            const id = `${cx + dx}_${cy + dy}_${cz + dz}_${i}`

            newCreatures.push({
              id,
              speciesId,
              name,
              dna,
              wx, wy, wz,
              discovered: discoveredIds.current.has(speciesId),
            })
          }
        }
      }
    }

    setCreatureList(newCreatures)
  }, []) // eslint-disable-line

  useFrame((state) => {
    const camPos = state.camera.position
    const now    = state.clock.elapsedTime

    // Check every 2 seconds instead of 1 — halves the work
    if (now - lastCheckTime.current < 2) return
    lastCheckTime.current = now

    spawnCreatures(camPos)

    // Discovery proximity check
    for (const c of creatureList) {
      if (c.discovered || discoveredIds.current.has(c.speciesId)) continue

      const dist = Math.hypot(c.wx - camPos.x, c.wy - camPos.y, c.wz - camPos.z)
      if (dist < 80) {
        c.discovered = true
        discoveredIds.current.add(c.speciesId)

        const currentDepth = Math.round(Math.abs(camPos.y))
        const discovery: Discovery = {
          id:          c.speciesId + '-' + Date.now(),
          speciesId:   c.speciesId,
          name:        c.name,
          discoveredBy: playerName,
          depth:       currentDepth,
          biome:       getBiomeAt(camPos.x, camPos.z, currentDepth),
          temperature: Math.max(1, 25 - currentDepth * 0.018),
          coords:      { x: Math.round(camPos.x), y: Math.round(camPos.z) },
          timestamp:   Date.now(),
          dna:         c.dna,
          isFirstEver: Math.random() > 0.7,
        }
        onDiscovery(discovery)
        break
      }
    }
  })

  return (
    <>
      {creatureList.map((c) => (
        <Creature3D
          key={c.id}
          id={c.speciesId.charCodeAt(0) + c.speciesId.charCodeAt(1)}
          dna={c.dna}
          initialPosition={new Vector3(c.wx, c.wy, c.wz)}
          discovered={c.discovered || discoveredIds.current.has(c.speciesId)}
        />
      ))}
    </>
  )
}
