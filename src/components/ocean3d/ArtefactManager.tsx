/**
 * ArtefactManager.tsx
 *
 * Manages procedural streaming of collectible ocean artefacts based on player location.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { getNearbyArtefacts, ArtefactInstance } from '../../engine/procedural/artefactGenerator'
import { Artefact3D } from './Artefact3D'
import { usePlayerStore, CollectedArtefact } from '../../store/usePlayerStore'

interface ArtefactManagerProps {
  onCollectToast?: (msg: string) => void
}

export const ArtefactManager = React.memo(function ArtefactManager({ onCollectToast }: ArtefactManagerProps) {
  const { camera } = useThree()
  const { artefacts, addArtefact, coords, depth } = usePlayerStore()

  const collectedSet = useMemo(() => new Set(artefacts.map(a => a.instanceId)), [artefacts])
  const [nearbyArtefacts, setNearbyArtefacts] = useState<ArtefactInstance[]>([])
  const lastCheckPos = useRef<{ x: number; z: number }>({ x: 999999, z: 999999 })

  useFrame(() => {
    const cx = camera.position.x
    const cz = camera.position.z

    const distMoved = Math.hypot(cx - lastCheckPos.current.x, cz - lastCheckPos.current.z)
    if (distMoved > 250) {
      lastCheckPos.current = { x: cx, z: cz }
      const items = getNearbyArtefacts(cx, cz, 2000)
      setNearbyArtefacts(items)
    }
  })

  const handleCollect = (item: ArtefactInstance) => {
    if (collectedSet.has(item.instanceId)) return

    const collectedObj: CollectedArtefact = {
      instanceId: item.instanceId,
      artefactId: item.def.id,
      name: item.def.name,
      type: item.def.type,
      rarity: item.def.rarity,
      rpValue: item.def.rpValue,
      description: item.def.description,
      lore: item.def.lore,
      timestamp: Date.now(),
      depth: Math.abs(Math.round(item.position[1])),
      coords: { x: Math.round(item.position[0]), y: Math.round(item.position[2]) },
    }

    addArtefact(collectedObj)

    if (onCollectToast) {
      onCollectToast(`🏆 Recovered Artefact: ${item.def.name} (+${item.def.rpValue} RP)`)
    }
  }

  return (
    <>
      {nearbyArtefacts.map(art => (
        <Artefact3D
          key={art.instanceId}
          artefact={art}
          collected={collectedSet.has(art.instanceId)}
          onCollect={handleCollect}
        />
      ))}
    </>
  )
})
