import React, { useRef, useMemo, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import {
  Vector3, Group, Mesh, MeshStandardMaterial, DoubleSide, Color,
  MeshBasicMaterial, RingGeometry, AdditiveBlending, MathUtils,
} from 'three'
import { CreatureDNA } from '../../store/usePlayerStore'

// Pre-allocate scratch vector (no per-frame alloc)
const _desired  = new Vector3()
const _lookAt   = new Vector3()
const _steer    = new Vector3()

interface CreatureProps {
  dna: CreatureDNA
  wx: number
  wy: number
  wz: number
  id: number
  scanned: boolean
  onClick: () => void
}

export const Creature3D = React.memo(function Creature3D({ dna, wx, wy, wz, id, scanned, onClick }: CreatureProps) {
  const groupRef    = useRef<Group>(null)
  const bodyRef     = useRef<Mesh>(null)
  const tailRef     = useRef<Mesh>(null)
  const ringRef     = useRef<Mesh>(null)
  const ringMatRef  = useRef<MeshBasicMaterial>(null)

  // Stable initial position created once from primitives
  const initialPosition = useMemo(() => new Vector3(wx, wy, wz), [wx, wy, wz])

  const timeOffset  = useRef(id * 13.37).current
  const targetPos   = useRef(initialPosition.clone())
  // Deterministic initial velocity based on id (was Math.random() — caused popping on remount)
  const velocity    = useRef(new Vector3(
    (((id * 73 + 17) % 100) / 100 - 0.5) * dna.speed,
    (((id * 31 + 53) % 100) / 100 - 0.5) * 0.1,
    (((id * 97 + 41) % 100) / 100 - 0.5) * dna.speed,
  ))
  // Hover state for highlight ring pulsing
  const hovered = useRef(false)

  const scale = dna.size * 5

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime + timeOffset

    // ── Wander AI ──────────────────────────────────────────────────────────
    if (Math.random() < 0.008) {
      targetPos.current.set(
        targetPos.current.x + (Math.random() - 0.5) * 30,
        Math.min(-10, Math.max(initialPosition.y - 100, targetPos.current.y + (Math.random() - 0.5) * 10)),
        targetPos.current.z + (Math.random() - 0.5) * 30,
      )
    }

    const currentPos = groupRef.current.position
    _desired.copy(targetPos.current).sub(currentPos)
    const dist = _desired.length()

    if (dist > 1) {
      _desired.normalize().multiplyScalar(dna.speed * 8)
      _steer.copy(_desired).sub(velocity.current).clampLength(0, dna.speed * delta * 20)
      velocity.current.add(_steer)
    }

    groupRef.current.position.addScaledVector(velocity.current, delta)

    if (velocity.current.lengthSq() > 0.01) {
      _lookAt.copy(currentPos).add(velocity.current)
      groupRef.current.lookAt(_lookAt)
    }

    // ── Swimming wiggle ────────────────────────────────────────────────────
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * dna.speed * 3) * 0.3
    }

    // ── Highlight ring ─────────────────────────────────────────────────────
    if (ringRef.current && ringMatRef.current) {
      if (!scanned) {
        // Idle unknown: faint slow pulse
        const pulse = 0.12 + 0.08 * Math.sin(t * 1.4)
        ringMatRef.current.opacity = hovered.current ? pulse + 0.25 : pulse
        ringRef.current.visible = true
        // Billboard: keep facing camera
        ringRef.current.lookAt(state.camera.position)
      } else {
        ringRef.current.visible = false
      }
    }
  })

  // ── Materials ─────────────────────────────────────────────────────────────
  const bodyMaterial = useMemo(() => new MeshStandardMaterial({
    color: dna.primaryColor,
    roughness: 0.2,
    metalness: 0.1,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: dna.glowIntensity > 0.5 ? dna.glowIntensity * 2 : 0,
    transparent: dna.transparency < 1,
    opacity: dna.transparency,
  }), [dna])

  const finMaterial = useMemo(() => new MeshStandardMaterial({
    color: dna.secondaryColor,
    roughness: 0.5,
    metalness: 0.0,
    side: DoubleSide,
    transparent: true,
    opacity: 0.8,
  }), [dna])

  // Clickable transparent hit-box material (invisible but interceptable)
  const hitMaterial = useMemo(() => new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), [])

  // Ring material for unknown species indicator
  const ringMaterial = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00e5ff'),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [])

  const ringGeo = useMemo(() => new RingGeometry(
    dna.bodyLength * 1.1,
    dna.bodyLength * 1.4,
    32,
  ), [dna.bodyLength])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }, [onClick])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hovered.current = true
    document.body.style.cursor = scanned ? 'default' : 'pointer'
  }, [scanned])

  const handlePointerOut = useCallback(() => {
    hovered.current = false
    document.body.style.cursor = 'default'
  }, [])

  return (
    <group
      ref={groupRef}
      position={initialPosition}
      scale={[scale, scale, scale]}
    >
      {/* Unknown species highlight ring – billboarded */}
      {!scanned && (
        <mesh ref={ringRef} geometry={ringGeo}>
          <primitive ref={ringMatRef} object={ringMaterial} attach="material" />
        </mesh>
      )}

      {/* Transparent click hit-box – slightly larger than body */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <capsuleGeometry args={[dna.bodyWidth * 1.3, dna.bodyLength * 1.2, 4, 8]} />
        <primitive object={hitMaterial} attach="material" />
      </mesh>

      {/* Main Body */}
      <mesh ref={bodyRef}>
        <capsuleGeometry args={[dna.bodyWidth, dna.bodyLength, 8, 16]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>

      {/* Eyes */}
      {Array.from({ length: Math.min(dna.eyeCount, 2) }).map((_, i) => (
        <mesh
          key={`eye-${i}`}
          position={[dna.bodyWidth * 0.8 * (i === 0 ? 1 : -1), dna.bodyWidth * 0.5, dna.bodyLength * 0.4]}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </mesh>
      ))}

      {/* Tail */}
      <group position={[0, 0, -dna.bodyLength * 0.5]} ref={tailRef}>
        <mesh position={[0, 0, -dna.bodyLength * 0.25]}>
          <coneGeometry args={[dna.bodyWidth * 0.8, dna.bodyLength * 0.5, 3]} />
          <primitive object={finMaterial} attach="material" />
        </mesh>
      </group>

      {/* Side Fins */}
      {Array.from({ length: Math.min(dna.finCount, 4) }).map((_, i) => {
        const angle = (i / Math.max(1, dna.finCount - 1)) * Math.PI - Math.PI / 2
        const finX  = Math.cos(angle) * dna.bodyWidth
        const finZ  = Math.sin(angle) * dna.bodyLength * 0.3
        return (
          <mesh key={`fin-${i}`} position={[finX, 0, finZ]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[dna.bodyWidth * 0.8, dna.bodyWidth * 1.5]} />
            <primitive object={finMaterial} attach="material" />
          </mesh>
        )
      })}
    </group>
  )
})
