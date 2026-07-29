import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Vector3, MeshBasicMaterial, Color, AdditiveBlending, CylinderGeometry, RingGeometry } from 'three'
import { usePlayerStore } from '../../store/usePlayerStore'
import { heroSubWorldPos } from './Hero'

const _wpPos = new Vector3()

export const Waypoint3D = React.memo(function Waypoint3D() {
  const groupRef = useRef<Group>(null)
  const activeWaypoint = usePlayerStore((s) => s.activeWaypoint)
  const clearActiveWaypoint = usePlayerStore((s) => s.clearActiveWaypoint)

  const beamGeo = useMemo(() => new CylinderGeometry(1.5, 3.0, 300, 16, 1, true), [])
  const ringGeo = useMemo(() => new RingGeometry(4, 7, 32), [])

  const beamMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00f5d4'),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  const ringMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffd60a'),
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  useFrame((state) => {
    if (!activeWaypoint || !groupRef.current) return

    const [wx, wy, wz] = activeWaypoint.position
    _wpPos.set(wx, wy, wz)
    groupRef.current.position.set(wx, wy + 100, wz)

    const t = state.clock.elapsedTime
    beamMat.opacity = 0.3 + 0.15 * Math.sin(t * 3)

    // Auto-clear waypoint if player gets within 15 units (pickup/investigate range)
    const distToPlayer = heroSubWorldPos.current.distanceTo(_wpPos)
    if (distToPlayer < 15) {
      clearActiveWaypoint()
    }
  })

  if (!activeWaypoint) return null

  return (
    <group ref={groupRef}>
      {/* Vertical light column */}
      <mesh geometry={beamGeo} material={beamMat} />

      {/* Ground indicator ring */}
      <mesh position={[0, -145, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeo} material={ringMat} />
    </group>
  )
})
