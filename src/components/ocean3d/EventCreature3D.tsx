/**
 * EventCreature3D.tsx — Special event-driven world entities (Leviathan, Giant Squid)
 *
 * Spawns massive unique creatures into the ocean world during active daily events.
 * Provides distinct animations, bioluminescence, scan flow integration, and massive RP rewards.
 */
import React, { useRef, useMemo, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import {
  Vector3, Group, MeshStandardMaterial, MeshBasicMaterial, Color,
  DoubleSide, AdditiveBlending, RingGeometry, Mesh,
} from 'three'
import { CreatureDNA } from '../../store/usePlayerStore'
import { heroSubWorldPos } from './Hero'

interface EventCreatureProps {
  type: 'leviathan' | 'squid'
  eventName: string
  scanned: boolean
  onScan: (id: string, speciesId: string, name: string, dna: CreatureDNA, wx: number, wy: number, wz: number) => void
}

const _toSub = new Vector3()
const _lookTarget = new Vector3()

export const EventCreature3D = React.memo(function EventCreature3D({
  type, eventName, scanned, onScan,
}: EventCreatureProps) {
  const groupRef = useRef<Group>(null)
  const ringRef  = useRef<Mesh>(null)

  // DNA configuration for event leviathan / squid
  const dna: CreatureDNA = useMemo(() => {
    if (type === 'leviathan') {
      return {
        bodyLength: 22.0,
        bodyWidth: 4.5,
        finCount: 6,
        eyeCount: 2,
        tailType: 1,
        primaryColor: '#0077b6',
        secondaryColor: '#48cae4',
        glowColor: '#00e5ff',
        glowIntensity: 1.8,
        speed: 1.2,
        behavior: 'migrating',
        size: 3.5,
        stripePattern: 2,
        transparency: 1,
        rarity: 'legendary',
        archetype: 'leviathan',
      }
    } else {
      return {
        bodyLength: 14.0,
        bodyWidth: 2.8,
        finCount: 10,
        eyeCount: 2,
        tailType: 0,
        primaryColor: '#6a040f',
        secondaryColor: '#dc2f02',
        glowColor: '#ff4d00',
        glowIntensity: 2.0,
        speed: 1.8,
        behavior: 'predator',
        size: 2.8,
        stripePattern: 1,
        transparency: 0.9,
        rarity: 'mythical',
        archetype: 'cephalopod',
      }
    }
  }, [type])

  const speciesId = type === 'leviathan' ? 'LEVIATHAN_PRIME' : 'ARCHITEUTHIS_REX'
  const creatureName = type === 'leviathan' ? 'Titan Leviathan Whale' : 'Colossal Architeuthis'
  const idStr = `event_creature_${type}`

  // Initial spawn position ahead and slightly below player
  const spawnPos = useMemo(() => {
    const sub = heroSubWorldPos.current
    return new Vector3(
      sub.x + (type === 'leviathan' ? 120 : -80),
      Math.min(-30, sub.y - 40),
      sub.z + (type === 'leviathan' ? -150 : 100),
    )
  }, [type])

  const currentPos = useRef(spawnPos.clone())
  const velocity   = useRef(new Vector3(type === 'leviathan' ? 8 : -10, 0, type === 'leviathan' ? 12 : -8))

  // Materials
  const skinMat = useMemo(() => new MeshStandardMaterial({
    color: new Color(dna.primaryColor),
    roughness: 0.4,
    metalness: 0.3,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: 0.8,
    side: DoubleSide,
  }), [dna])

  const accentMat = useMemo(() => new MeshStandardMaterial({
    color: new Color(dna.secondaryColor),
    roughness: 0.2,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: 1.5,
    side: DoubleSide,
  }), [dna])

  const ringMat = useMemo(() => new MeshBasicMaterial({
    color: new Color(dna.glowColor),
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [dna])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)

    // Smooth wide swimming path
    if (type === 'leviathan') {
      const angle = t * 0.08
      currentPos.current.x = spawnPos.x + Math.sin(angle) * 180
      currentPos.current.z = spawnPos.z + Math.cos(angle) * 180
      currentPos.current.y = spawnPos.y + Math.sin(t * 0.2) * 15

      velocity.current.set(
        Math.cos(angle) * 14,
        Math.cos(t * 0.2) * 3,
        -Math.sin(angle) * 14
      )
    } else {
      // Giant Squid hunting movement
      const angle = t * 0.12
      currentPos.current.x = spawnPos.x + Math.cos(angle) * 120
      currentPos.current.z = spawnPos.z + Math.sin(angle * 1.3) * 120
      currentPos.current.y = spawnPos.y + Math.sin(t * 0.3) * 20

      velocity.current.set(
        -Math.sin(angle) * 16,
        Math.cos(t * 0.3) * 6,
        Math.cos(angle * 1.3) * 16
      )
    }

    groupRef.current.position.copy(currentPos.current)

    // Face velocity direction
    if (velocity.current.lengthSq() > 0.1) {
      _lookTarget.copy(currentPos.current).add(velocity.current)
      groupRef.current.lookAt(_lookTarget)
    }

    // Gentle body undulation / pulse
    if (type === 'leviathan') {
      groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.05
    } else {
      const pulse = 1 + Math.sin(t * 1.5) * 0.08
      groupRef.current.scale.setScalar(pulse)
    }

    // Ring orientation
    if (ringRef.current && !scanned) {
      ringRef.current.lookAt(state.camera.position)
      ringMat.opacity = 0.4 + 0.3 * Math.sin(t * 3)
    }
  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (scanned) return
    const pos = currentPos.current
    onScan(idStr, speciesId, creatureName, dna, pos.x, pos.y, pos.z)
  }, [scanned, idStr, speciesId, creatureName, dna, onScan])

  return (
    <group ref={groupRef} onClick={handleClick}>
      {/* 3D Geometry */}
      {type === 'leviathan' ? (
        <group scale={[2.8, 2.8, 2.8]}>
          {/* Main hull/body */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[3.2, 18, 8, 20]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          {/* Glowing belly stripes */}
          <mesh position={[0, -1.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.25, 3.25, 12, 16, 1, true]} />
            <primitive object={accentMat} attach="material" />
          </mesh>
          {/* Horizontal tail flukes */}
          <mesh position={[0, 0, 11]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[14, 4.5]} />
            <primitive object={accentMat} attach="material" />
          </mesh>
          {/* Massive pectoral fins */}
          <mesh position={[7, -0.5, -2]} rotation={[0.3, 0.2, -0.4]}>
            <planeGeometry args={[10, 3.5]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          <mesh position={[-7, -0.5, -2]} rotation={[0.3, -0.2, 0.4]}>
            <planeGeometry args={[10, 3.5]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          {/* Eyes */}
          <mesh position={[3.1, 0.5, -8]}>
            <sphereGeometry args={[0.8, 12, 12]} />
            <primitive object={accentMat} attach="material" />
          </mesh>
          <mesh position={[-3.1, 0.5, -8]}>
            <sphereGeometry args={[0.8, 12, 12]} />
            <primitive object={accentMat} attach="material" />
          </mesh>
        </group>
      ) : (
        <group scale={[2.2, 2.2, 2.2]}>
          {/* Giant Squid mantle */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[2.5, 12, 8, 16]} />
            <primitive object={skinMat} attach="material" />
          </mesh>
          {/* Giant eyes */}
          <mesh position={[2.2, 0.2, -3]}>
            <sphereGeometry args={[1.1, 12, 12]} />
            <primitive object={accentMat} attach="material" />
          </mesh>
          <mesh position={[-2.2, 0.2, -3]}>
            <sphereGeometry args={[1.1, 12, 12]} />
            <primitive object={accentMat} attach="material" />
          </mesh>
          {/* 10 Trailing tentacles */}
          {Array.from({ length: 10 }).map((_, i) => {
            const angle = (i / 10) * Math.PI * 2
            const ox = Math.cos(angle) * 1.8
            const oz = Math.sin(angle) * 1.8
            return (
              <mesh key={i} position={[ox, -0.5, 6 + (i % 2) * 2]} rotation={[0.3, angle, 0.2]}>
                <cylinderGeometry args={[0.22, 0.04, 18, 6]} />
                <primitive object={accentMat} attach="material" />
              </mesh>
            )
          })}
        </group>
      )}

      {/* Target indicator ring */}
      {!scanned && (
        <mesh ref={ringRef}>
          <ringGeometry args={[24, 28, 48]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
      )}

      {/* Light glow */}
      <pointLight
        color={dna.glowColor}
        intensity={80}
        distance={250}
        decay={2}
      />
    </group>
  )
})
