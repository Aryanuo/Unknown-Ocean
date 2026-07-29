/**
 * Artefact3D.tsx
 *
 * Renders a 3D collectible artefact object in the ocean.
 * Features glowing visual indicator, type-specific geometry, floating animation,
 * and proximity detection for pickup interaction (Space key or click).
 */

import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Mesh, Group, SphereGeometry, BoxGeometry, DodecahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, Color, Vector3, AdditiveBlending
} from 'three'
import { Html } from '@react-three/drei'
import { ArtefactInstance } from '../../engine/procedural/artefactGenerator'
import { heroPropWorldPos } from './Hero'

interface Artefact3DProps {
  artefact: ArtefactInstance
  collected: boolean
  onCollect: (artefact: ArtefactInstance) => void
}

const RARITY_COLORS: Record<string, string> = {
  common: '#90a4ae',
  uncommon: '#66bb6a',
  rare: '#42a5f5',
  epic: '#ce93d8',
  legendary: '#ffc300',
  mythical: '#ff006e',
}

export function Artefact3D({ artefact, collected, onCollect }: Artefact3DProps) {
  const groupRef = useRef<Group>(null)
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const [inRange, setInRange] = useState(false)
  const [distance, setDistance] = useState(999)

  const { def, position } = artefact
  const colorHex = RARITY_COLORS[def.rarity] || '#48cae4'

  // Geometry based on artefact type
  const geometry = useMemo(() => {
    switch (def.type) {
      case 'fossil':
        return new DodecahedronGeometry(1.2, 0)
      case 'journal':
      case 'equipment':
        return new BoxGeometry(1.4, 1.4, 1.4)
      case 'pearl':
        return new SphereGeometry(1.2, 16, 16)
      case 'sculpture':
      case 'relic':
        return new DodecahedronGeometry(1.6, 1)
      default:
        return new SphereGeometry(1.2, 12, 12)
    }
  }, [def.type])

  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(colorHex),
      emissive: new Color(colorHex),
      emissiveIntensity: def.rarity === 'mythical' || def.rarity === 'legendary' ? 0.8 : 0.4,
      roughness: 0.2,
      metalness: 0.6,
    })
  }, [colorHex, def.rarity])

  const auraMaterial = useMemo(() => {
    return new MeshBasicMaterial({
      color: new Color(colorHex),
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  }, [colorHex])

  // Check proximity to submarine hero
  useFrame((state) => {
    if (collected || !groupRef.current) return
    const t = state.clock.elapsedTime

    // Gentle floating animation
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(t * 1.5 + position[0]) * 0.4
      meshRef.current.rotation.y = t * 0.5
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.2
    }

    if (glowRef.current) {
      const pulse = 1 + Math.sin(t * 3) * 0.2
      glowRef.current.scale.setScalar(pulse * 3.2)
    }

    // Distance check to player submarine
    const heroPos = heroPropWorldPos.current
    const dx = position[0] - heroPos.x
    const dy = position[1] - heroPos.y
    const dz = position[2] - heroPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    setDistance(Math.round(dist))
    const closeEnough = dist < 35
    if (closeEnough !== inRange) {
      setInRange(closeEnough)
    }
  })

  // Keyboard Space pickup listener when in range
  useEffect(() => {
    if (!inRange || collected) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        onCollect(artefact)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inRange, collected, artefact, onCollect])

  if (collected) return null

  return (
    <group ref={groupRef} position={position}>
      {/* Central Artefact Mesh */}
      <mesh ref={meshRef} geometry={geometry} material={material} />

      {/* Outer Glowing Aura */}
      <mesh ref={glowRef} material={auraMaterial}>
        <sphereGeometry args={[1.5, 12, 12]} />
      </mesh>

      {/* Proximity Interaction Prompt */}
      {inRange && (
        <Html position={[0, 3, 0]} center distanceFactor={40}>
          <div
            onClick={() => onCollect(artefact)}
            style={{
              background: 'rgba(0, 15, 25, 0.88)',
              border: `1px solid ${colorHex}`,
              boxShadow: `0 0 12px ${colorHex}`,
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              textAlign: 'center',
              userSelect: 'none',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ fontSize: '11px', color: colorHex, fontWeight: 'bold' }}>
              ✨ {def.name.toUpperCase()} ({def.rarity.toUpperCase()})
            </div>
            <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.9 }}>
              Press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: '3px' }}>SPACE</kbd> or click to Collect (+{def.rpValue} RP)
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
