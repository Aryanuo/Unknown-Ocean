/**
 * MysteryManager.tsx — Chunk-based mystery streaming + 3D geometry renderer
 *
 * Loads/unloads mysteries as player explores. Each mystery type has a unique
 * 3D shape. Glows when within investigate range. Click to investigate.
 */
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import {
  Vector3, Group, MeshStandardMaterial, MeshBasicMaterial, Color,
  AdditiveBlending, DoubleSide,
} from 'three'
import { MysteryInstance, MysteryType, getMysteriesNear } from '../../engine/procedural/mysteryGenerator'
import { heroSubWorldPos } from './Hero'
import { registerCreature } from '../../engine/creatureRegistry'

// ── Constants ─────────────────────────────────────────────────────────────────
const LOAD_RADIUS_WU   = 1500   // world units — load mysteries within this distance
const UNLOAD_RADIUS_WU = 2000
const INTERACT_DIST    = 80     // highlight and show tooltip within this range
const CHECK_INTERVAL   = 3      // seconds between chunk scans

// ── Pre-allocated ─────────────────────────────────────────────────────────────
const _toSub = new Vector3()

// ── Per-mystery 3D shapes ─────────────────────────────────────────────────────

function AbandonedLabGeometry({ glow }: { glow: MeshStandardMaterial }) {
  return (
    <>
      {/* Main module cylinder */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3, 3, 14, 16]} />
        <meshStandardMaterial color="#37474f" roughness={0.7} metalness={0.8} />
      </mesh>
      {/* Dome end caps */}
      <mesh position={[7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[3, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#455a64" roughness={0.6} metalness={0.7} />
      </mesh>
      <mesh position={[-7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[3, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#455a64" roughness={0.6} metalness={0.7} />
      </mesh>
      {/* Porthole row */}
      {[-4, 0, 4].map((z, i) => (
        <mesh key={i} position={[0, 3.02, z]}>
          <circleGeometry args={[0.6, 12]} />
          <primitive object={glow} attach="material" />
        </mesh>
      ))}
      {/* Support struts */}
      {[-5, 5].map((x, i) => (
        <mesh key={i} position={[x, -4, 0]} rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.3, 0.3, 5, 6]} />
          <meshStandardMaterial color="#263238" roughness={0.8} metalness={0.9} />
        </mesh>
      ))}
    </>
  )
}

function AncientRuinsGeometry({ glow }: { glow: MeshStandardMaterial }) {
  return (
    <>
      {/* Base platform */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[18, 2, 18]} />
        <meshStandardMaterial color="#5d4037" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Corner columns */}
      {[[-6, 6], [6, 6], [-6, -6], [6, -6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 4, z]}>
          <cylinderGeometry args={[1.2, 1.4, 10, 8]} />
          <meshStandardMaterial color="#6d4c41" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
      {/* Central altar */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#4e342e" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Glowing rune disc on altar */}
      <mesh position={[0, 4.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 2, 24]} />
        <primitive object={glow} attach="material" />
      </mesh>
      {/* Fallen column */}
      <mesh position={[8, 0, -2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.1, 1.3, 9, 8]} />
        <meshStandardMaterial color="#5d4037" roughness={0.95} metalness={0.05} />
      </mesh>
    </>
  )
}

function GhostSubmarineGeometry({ glow }: { glow: MeshStandardMaterial }) {
  return (
    <>
      {/* Main hull (tilted, partially buried) */}
      <group rotation={[0, 0.4, 0.15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[3.5, 18, 6, 16]} />
          <meshStandardMaterial color="#455a64" roughness={0.5} metalness={0.85} />
        </mesh>
        {/* Conning tower */}
        <mesh position={[0, 4.2, -2]}>
          <boxGeometry args={[2.5, 3.5, 5]} />
          <meshStandardMaterial color="#37474f" roughness={0.6} metalness={0.8} />
        </mesh>
        {/* Portholes glowing */}
        {[-4, 0, 4].map((z, i) => (
          <mesh key={i} position={[-3.52, 0.5, z]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.5, 12]} />
            <primitive object={glow} attach="material" />
          </mesh>
        ))}
        {/* Propeller remnants */}
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} position={[0, 0, 9.5]} rotation={[0, (i / 4) * Math.PI * 2, 0]}>
            <boxGeometry args={[0.2, 2.5, 0.5]} />
            <meshStandardMaterial color="#546e7a" roughness={0.3} metalness={0.95} />
          </mesh>
        ))}
      </group>
    </>
  )
}

function GiantFossilGeometry({ glow }: { glow: MeshStandardMaterial }) {
  const segments = 8
  return (
    <>
      {/* Vertebrae chain */}
      {Array.from({ length: segments }).map((_, i) => {
        const t = i / segments
        const x = (i - segments / 2) * 8
        const y = Math.sin(t * Math.PI) * 4 - 6
        return (
          <mesh key={i} position={[x, y, 0]}>
            <cylinderGeometry args={[2.5 - t * 0.8, 2 - t * 0.6, 3.5, 10]} />
            <meshStandardMaterial color="#bcaaa4" roughness={0.9} metalness={0.1} />
          </mesh>
        )
      })}
      {/* Skull */}
      <mesh position={[-35, -10, 0]}>
        <sphereGeometry args={[6, 10, 10]} />
        <meshStandardMaterial color="#d7ccc8" roughness={0.88} metalness={0.08} />
      </mesh>
      {/* Eye socket glow */}
      <mesh position={[-33, -8, 4]}>
        <sphereGeometry args={[1.2, 8, 8]} />
        <primitive object={glow} attach="material" />
      </mesh>
      {/* Rib pairs */}
      {[0, 1, 2, 3].map(i => (
        <group key={i} position={[(i - 1.5) * 8, -8, 0]}>
          <mesh rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.4, 0.2, 9, 6]} />
            <meshStandardMaterial color="#bcaaa4" roughness={0.9} metalness={0.1} />
          </mesh>
          <mesh rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.4, 0.2, 9, 6]} />
            <meshStandardMaterial color="#bcaaa4" roughness={0.9} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function AlienObeliskGeometry({ glow }: { glow: MeshStandardMaterial }) {
  return (
    <>
      {/* Main monolith */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[3.5, 20, 3.5]} />
        <meshStandardMaterial
          color="#1a0033"
          roughness={0.05}
          metalness={0.3}
          emissive={new Color('#6a0080')}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Glowing rune panels */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => {
        const x = Math.sin(angle) * 1.76
        const z = Math.cos(angle) * 1.76
        return (
          <mesh key={i} position={[x, 12, z]} rotation={[0, -angle, 0]}>
            <planeGeometry args={[2.5, 14]} />
            <primitive object={glow} attach="material" />
          </mesh>
        )
      })}
      {/* Base plinth */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[6, 2, 6]} />
        <meshStandardMaterial color="#0d0020" roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Floating crystal shards */}
      {[30, 90, 150, 210, 270, 330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        return (
          <mesh key={i} position={[Math.cos(rad) * 6, 8 + (i % 3) * 2, Math.sin(rad) * 6]}>
            <octahedronGeometry args={[0.6]} />
            <primitive object={glow} attach="material" />
          </mesh>
        )
      })}
    </>
  )
}

function MysteriousEggsGeometry({ glow }: { glow: MeshStandardMaterial }) {
  return (
    <>
      {/* Rock anchor */}
      <mesh position={[0, -2, 0]}>
        <sphereGeometry args={[4, 8, 6]} />
        <meshStandardMaterial color="#37474f" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Egg cluster */}
      {[
        [0, 3, 0], [2.5, 2.5, 1.5], [-2, 3.5, 2], [1, 4.5, -2],
        [-3, 2, -1.5], [3, 3.5, -2], [0, 5, 2],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <sphereGeometry args={[1.2 + (i % 3) * 0.3, 10, 10]} />
            <meshStandardMaterial
              color="#a5d6a7"
              roughness={0.3}
              metalness={0}
              emissive={new Color('#00c853')}
              emissiveIntensity={0.3}
              transparent
              opacity={0.75}
            />
          </mesh>
          {/* Embryo inside */}
          <mesh>
            <sphereGeometry args={[0.5 + (i % 2) * 0.2, 8, 8]} />
            <primitive object={glow} attach="material" />
          </mesh>
        </group>
      ))}
    </>
  )
}

function ShipwreckGeometry({ glow }: { glow: MeshStandardMaterial }) {
  return (
    <>
      {/* Main hull (broken, tilted) */}
      <group rotation={[0, 0.3, 0.2]}>
        <mesh>
          <boxGeometry args={[28, 6, 10]} />
          <meshStandardMaterial color="#4e342e" roughness={0.85} metalness={0.15} />
        </mesh>
        {/* Upper deck */}
        <mesh position={[0, 4, 0]}>
          <boxGeometry args={[20, 1, 9]} />
          <meshStandardMaterial color="#3e2723" roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Bridge cabin */}
        <mesh position={[-5, 6, 0]}>
          <boxGeometry args={[8, 4, 7]} />
          <meshStandardMaterial color="#3e2723" roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Broken mast */}
        <mesh position={[4, 8, 0]} rotation={[0, 0, -0.6]}>
          <cylinderGeometry args={[0.3, 0.4, 10, 8]} />
          <meshStandardMaterial color="#4e342e" roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Glowing cabin window */}
        <mesh position={[-5, 7, 3.6]} rotation={[0, 0, 0]}>
          <planeGeometry args={[1.5, 1.5]} />
          <primitive object={glow} attach="material" />
        </mesh>
        {/* Anchor chain */}
        {[0, 1, 2, 3, 4].map(i => (
          <mesh key={i} position={[-12 - i * 1.5, -i * 0.8, 0]}>
            <torusGeometry args={[0.5, 0.15, 6, 8]} />
            <meshStandardMaterial color="#546e7a" roughness={0.5} metalness={0.9} />
          </mesh>
        ))}
      </group>
    </>
  )
}

// ── Dispatch to correct geometry ──────────────────────────────────────────────
function MysteryGeometry({ type, glow }: { type: MysteryType; glow: MeshStandardMaterial }) {
  switch (type) {
    case 'abandoned_lab':    return <AbandonedLabGeometry glow={glow} />
    case 'ancient_ruins':    return <AncientRuinsGeometry glow={glow} />
    case 'ghost_submarine':  return <GhostSubmarineGeometry glow={glow} />
    case 'giant_fossil':     return <GiantFossilGeometry glow={glow} />
    case 'alien_obelisk':    return <AlienObeliskGeometry glow={glow} />
    case 'mysterious_eggs':  return <MysteriousEggsGeometry glow={glow} />
    case 'shipwreck':        return <ShipwreckGeometry glow={glow} />
    default:                 return <AncientRuinsGeometry glow={glow} />
  }
}

// ── Single mystery object ─────────────────────────────────────────────────────
interface MysteryObjectProps {
  mystery: MysteryInstance
  alreadyFound: boolean
  onInvestigate: (m: MysteryInstance) => void
}

const MysteryObject = React.memo(function MysteryObject({
  mystery, alreadyFound, onInvestigate,
}: MysteryObjectProps) {
  const groupRef      = useRef<Group>(null)
  const glowIntRef    = useRef(alreadyFound ? 0.3 : 1.0)
  const inRangeRef    = useRef(false)
  const hovered       = useRef(false)

  const glowColor = mystery.def.glowColor
  const pos = useMemo(() => new Vector3(mystery.wx, mystery.wy, mystery.wz), [mystery])

  const glowMat = useMemo(() => new MeshStandardMaterial({
    color: new Color(glowColor),
    emissive: new Color(glowColor),
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [glowColor])

  const haloMat = useMemo(() => new MeshBasicMaterial({
    color: new Color(glowColor),
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [glowColor])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Check proximity to submarine
    _toSub.copy(heroSubWorldPos.current).sub(pos)
    const dist = _toSub.length()
    inRangeRef.current = dist < INTERACT_DIST

    // Gentle vertical bob
    groupRef.current.position.y = pos.y + Math.sin(t * 0.4 + mystery.wx * 0.01) * 1.5

    // Glow pulse when in range
    if (inRangeRef.current && !alreadyFound) {
      glowMat.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.5
      haloMat.opacity = 0.12 + Math.sin(t * 2) * 0.06
    } else {
      glowMat.emissiveIntensity = alreadyFound ? 0.3 : 0.7
      haloMat.opacity = alreadyFound ? 0.03 : 0.06
    }

    // Register on Sonar spatial registry
    const mysteryNumericId = 880000 + (Math.abs(Math.round(mystery.wx + mystery.wz)) % 100000)
    registerCreature(
      mysteryNumericId,
      pos,
      new Vector3(),
      'stationary',
      8,
      'mystery',
      0,
      mystery.def.rarity
    )
  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (inRangeRef.current) onInvestigate(mystery)
  }, [mystery, onInvestigate])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hovered.current = true
    if (inRangeRef.current) document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback(() => {
    hovered.current = false
    document.body.style.cursor = 'default'
  }, [])

  return (
    <group
      ref={groupRef}
      position={pos}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Mystery-specific geometry */}
      <MysteryGeometry type={mystery.def.type} glow={glowMat} />

      {/* Halo ring (distance indicator) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[14, 18, 32]} />
        <primitive object={haloMat} attach="material" />
      </mesh>

      {/* Point light for atmosphere */}
      <pointLight
        color={glowColor}
        intensity={alreadyFound ? 15 : 40}
        distance={80}
        decay={2}
      />
    </group>
  )
})

// ── MysteryManager ─────────────────────────────────────────────────────────────
interface Props {
  onInvestigate: (m: MysteryInstance) => void
  discoveredMysteryIds: Set<string>
}

export function MysteryManager({ onInvestigate, discoveredMysteryIds }: Props) {
  const [loaded, setLoaded] = useState<MysteryInstance[]>([])
  const lastPos   = useRef<{ x: number; z: number } | null>(null)
  const lastCheck = useRef(0)

  useFrame((state) => {
    const now = state.clock.elapsedTime
    if (now - lastCheck.current < CHECK_INTERVAL) return
    lastCheck.current = now

    const cam = state.camera.position
    const cx = Math.round(cam.x)
    const cz = Math.round(cam.z)

    // Skip if player hasn't moved significantly
    if (lastPos.current && Math.abs(lastPos.current.x - cx) < 300 && Math.abs(lastPos.current.z - cz) < 300) return
    lastPos.current = { x: cx, z: cz }

    const nearby = getMysteriesNear(cam.x, cam.z, LOAD_RADIUS_WU)

    // Filter out those too far away
    const filtered = nearby.filter(m => {
      const dx = m.wx - cam.x
      const dz = m.wz - cam.z
      return Math.sqrt(dx * dx + dz * dz) < UNLOAD_RADIUS_WU
    })

    setLoaded(filtered)
  })

  return (
    <>
      {loaded.map(m => (
        <MysteryObject
          key={m.id}
          mystery={m}
          alreadyFound={discoveredMysteryIds.has(m.id)}
          onInvestigate={onInvestigate}
        />
      ))}
    </>
  )
}
