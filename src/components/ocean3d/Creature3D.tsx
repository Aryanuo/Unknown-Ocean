import React, { useRef, useMemo, useCallback, useEffect } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import {
  Vector3, Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial,
  DoubleSide, Color, MeshBasicMaterial, RingGeometry, AdditiveBlending,
} from 'three'
import { CreatureDNA } from '../../store/usePlayerStore'
import { RARITY_CONFIG, Rarity, BodyArchetype, BehaviorType } from '../../engine/procedural/creatureFactory'
import {
  registerCreature, unregisterCreature,
  findNeighbors, findNearest, findSchoolmates,
  CreatureEntry,
} from '../../engine/creatureRegistry'

// Pre-allocated scratch vectors
const _desired  = new Vector3()
const _lookAt   = new Vector3()
const _steer    = new Vector3()
const _toSub    = new Vector3()
const _sep      = new Vector3()
const _ali      = new Vector3()
const _coh      = new Vector3()
const _tmp      = new Vector3()

// ── Shared submarine position (exported from Hero, imported here) ─────────────
let _subWorldPos: Vector3 | null = null
export function registerSubPos(v: Vector3) { _subWorldPos = v }

// ═══════════════════════════════════════════════════════════════════════════════
// Rarity ring configurations
// ═══════════════════════════════════════════════════════════════════════════════
const RING_COLORS: Record<Rarity, string> = {
  common:    '#90a4ae',
  uncommon:  '#66bb6a',
  rare:      '#42a5f5',
  epic:      '#ce93d8',
  legendary: '#ffc300',
  mythical:  '#ff006e',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Behavior constants
// ═══════════════════════════════════════════════════════════════════════════════
const SCHOOL_RADIUS       = 35   // boids neighbor radius
const SCHOOL_SEP_DIST     = 8    // minimum separation distance
const SCHOOL_SEP_WEIGHT   = 2.5
const SCHOOL_ALI_WEIGHT   = 1.2
const SCHOOL_COH_WEIGHT   = 1.0

const PREDATOR_CHASE_DIST = 80   // predator detects prey within this range
const PREDATOR_BURST_MULT = 2.8  // speed burst when chasing

const SHY_FLEE_DIST       = 60   // flee when sub is closer
const SHY_FLEE_SPEED      = 2.5

const CURIOUS_ORBIT_DIST  = 45   // start orbiting when sub within this
const CURIOUS_MIN_DIST    = 10   // don't get closer than this

const AGGRESSIVE_CHARGE_DIST = 50  // charge when sub is closer
const AGGRESSIVE_SPEED    = 3.0

const FRIENDLY_APPROACH_DIST = 55
const FRIENDLY_IDLE_DIST  = 12

const TERRITORIAL_RADIUS  = 30   // patrol radius from spawn
const TERRITORIAL_CHARGE  = 40   // charge intruders within this

const SLEEPING_WAKE_DIST  = 20   // wake if sub within this

const SCAVENGER_SPIRAL_R  = 15   // spiral radius

const FADE_DURATION = 2.0   // seconds for creatures to fade in after spawning

interface CreatureProps {
  dna: CreatureDNA
  wx: number
  wy: number
  wz: number
  id: number
  scanned: boolean
  spawnTime: number   // elapsedTime at spawn; -1 = already opaque
  onClick: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fish archetype — classic capsule-based fish
// ═══════════════════════════════════════════════════════════════════════════════
function FishBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  return (
    <>
      {/* Main body */}
      <mesh>
        <capsuleGeometry args={[dna.bodyWidth, dna.bodyLength, 8, 16]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Tail */}
      <group position={[0, 0, -dna.bodyLength * 0.5]}>
        <mesh position={[0, 0, -dna.bodyLength * 0.2]} rotation={[0, 0, Math.PI / 4]}>
          <coneGeometry args={[dna.bodyWidth * 1.1, dna.bodyLength * 0.6, 4]} />
          <primitive object={finMat} attach="material" />
        </mesh>
      </group>

      {/* Dorsal fin */}
      <mesh position={[0, dna.bodyWidth * 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[dna.bodyWidth * 0.6, dna.bodyLength * 0.5]} />
        <primitive object={finMat} attach="material" />
      </mesh>

      {/* Side fins */}
      {Array.from({ length: Math.min(dna.finCount, 4) }).map((_, i) => {
        const side = i % 2 === 0 ? 1 : -1
        const fz   = (i < 2 ? -0.1 : 0.3) * dna.bodyLength
        return (
          <mesh key={`fin-${i}`} position={[dna.bodyWidth * side, 0, fz]} rotation={[0, side * 0.3, side * 0.4]}>
            <planeGeometry args={[dna.bodyWidth * 1.2, dna.bodyWidth * 0.9]} />
            <primitive object={finMat} attach="material" />
          </mesh>
        )
      })}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ray archetype — flat wide disc shape
// ═══════════════════════════════════════════════════════════════════════════════
function RayBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  return (
    <>
      {/* Central disc body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[dna.bodyWidth, dna.bodyWidth * 0.7, dna.bodyLength * 0.25, 16]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Wing-like pectoral fins */}
      <mesh position={[dna.bodyWidth * 1.1, 0, 0]} rotation={[Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[dna.bodyWidth * 2.2, dna.bodyLength * 0.7]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      <mesh position={[-dna.bodyWidth * 1.1, 0, 0]} rotation={[Math.PI / 2, 0, -0.2]}>
        <planeGeometry args={[dna.bodyWidth * 2.2, dna.bodyLength * 0.7]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Tail */}
      <mesh position={[0, 0, dna.bodyLength * 0.55]}>
        <cylinderGeometry args={[0.04, dna.bodyWidth * 0.3, dna.bodyLength * 0.8, 8]} />
        <primitive object={finMat} attach="material" />
      </mesh>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Eel archetype — long segmented serpentine body
// ═══════════════════════════════════════════════════════════════════════════════
function EelBody({ dna, bodyMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial }) {
  const segments = 6
  return (
    <>
      {Array.from({ length: segments }).map((_, i) => {
        const t = i / segments
        const taper = 1 - t * 0.7
        return (
          <mesh
            key={`seg-${i}`}
            position={[0, 0, (i - segments / 2) * dna.bodyLength * 0.18]}
          >
            <sphereGeometry args={[dna.bodyWidth * taper, 8, 6]} />
            <primitive object={bodyMat} attach="material" />
          </mesh>
        )
      })}
      {/* Fins along body — thin planes */}
      <mesh position={[0, dna.bodyWidth * 1.2, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[dna.bodyWidth * 0.4, dna.bodyLength * 0.85]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      <mesh position={[0, -dna.bodyWidth * 1.2, 0]}>
        <planeGeometry args={[dna.bodyWidth * 0.4, dna.bodyLength * 0.85]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Jellyfish archetype — dome bell + trailing tentacles
// ═══════════════════════════════════════════════════════════════════════════════
function JellyfishBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshPhysicalMaterial; finMat: MeshStandardMaterial }) {
  const tentacleCount = 6 + Math.floor(dna.finCount * 1.5)
  return (
    <>
      {/* Bell dome */}
      <mesh>
        <sphereGeometry args={[dna.bodyWidth, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      {/* Inner glow ring */}
      <mesh position={[0, -dna.bodyWidth * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[dna.bodyWidth * 0.55, dna.bodyWidth * 0.08, 8, 24]} />
        <primitive object={finMat} attach="material" />
      </mesh>
      {/* Tentacles */}
      {Array.from({ length: tentacleCount }).map((_, i) => {
        const angle = (i / tentacleCount) * Math.PI * 2
        const r     = dna.bodyWidth * 0.5
        const ox    = Math.cos(angle) * r
        const oz    = Math.sin(angle) * r
        return (
          <mesh key={`tent-${i}`} position={[ox, -dna.bodyWidth * 0.05, oz]}>
            <cylinderGeometry args={[0.015, 0.005, dna.bodyLength * 0.9, 4]} />
            <primitive object={finMat} attach="material" />
          </mesh>
        )
      })}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cephalopod archetype — rounded mantle + multiple arms
// ═══════════════════════════════════════════════════════════════════════════════
function CephalopodBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  const armCount = 6 + Math.floor(dna.finCount * 1.5)
  return (
    <>
      {/* Mantle */}
      <mesh>
        <capsuleGeometry args={[dna.bodyWidth * 0.9, dna.bodyLength * 0.7, 6, 12]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Eye bulges */}
      <mesh position={[dna.bodyWidth * 0.7, 0.1, dna.bodyLength * 0.3]}>
        <sphereGeometry args={[dna.bodyWidth * 0.28, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-dna.bodyWidth * 0.7, 0.1, dna.bodyLength * 0.3]}>
        <sphereGeometry args={[dna.bodyWidth * 0.28, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Tentacle arms */}
      {Array.from({ length: armCount }).map((_, i) => {
        const angle = (i / armCount) * Math.PI * 2
        const r     = dna.bodyWidth * 0.6
        const ox    = Math.cos(angle) * r * 0.5
        const oz    = Math.sin(angle) * r * 0.5
        return (
          <mesh key={`arm-${i}`} position={[ox, -dna.bodyWidth * 0.4, oz + dna.bodyLength * 0.3]}>
            <cylinderGeometry args={[0.04, 0.01, dna.bodyLength * 0.6, 4]} />
            <primitive object={finMat} attach="material" />
          </mesh>
        )
      })}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Leviathan archetype — massive whale-like creature
// ═══════════════════════════════════════════════════════════════════════════════
function LeviathanBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  return (
    <>
      {/* Main body — large capsule */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[dna.bodyWidth, dna.bodyLength, 6, 16]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Horizontal tail flukes */}
      <mesh position={[0, 0, dna.bodyLength * 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[dna.bodyWidth * 3.5, dna.bodyLength * 0.4]} />
        <primitive object={finMat} attach="material" />
      </mesh>

      {/* Pectoral fins */}
      <mesh position={[dna.bodyWidth * 1.5, -dna.bodyWidth * 0.2, 0]} rotation={[0.4, 0.2, -0.3]}>
        <planeGeometry args={[dna.bodyWidth * 2.5, dna.bodyLength * 0.35]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      <mesh position={[-dna.bodyWidth * 1.5, -dna.bodyWidth * 0.2, 0]} rotation={[0.4, -0.2, 0.3]}>
        <planeGeometry args={[dna.bodyWidth * 2.5, dna.bodyLength * 0.35]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Dorsal fin */}
      <mesh position={[0, dna.bodyWidth * 1.4, -dna.bodyLength * 0.2]}>
        <coneGeometry args={[dna.bodyWidth * 0.3, dna.bodyWidth * 1.8, 8]} />
        <primitive object={finMat} attach="material" />
      </mesh>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Creature3D component
// ═══════════════════════════════════════════════════════════════════════════════
export const Creature3D = React.memo(function Creature3D({ dna, wx, wy, wz, id, scanned, spawnTime, onClick }: CreatureProps) {
  const groupRef    = useRef<Group>(null)
  const ringRef     = useRef<Mesh>(null)
  const ringMatRef  = useRef<MeshBasicMaterial>(null)
  const auraRef     = useRef<Mesh>(null)
  const auraMatRef  = useRef<MeshBasicMaterial>(null)

  const initialPosition = useMemo(() => new Vector3(wx, wy, wz), [wx, wy, wz])

  const timeOffset  = useRef(id * 13.37).current
  const targetPos   = useRef(initialPosition.clone())
  const velocity    = useRef(new Vector3(
    (((id * 73 + 17) % 100) / 100 - 0.5) * dna.speed,
    (((id * 31 + 53) % 100) / 100 - 0.5) * 0.1,
    (((id * 97 + 41) % 100) / 100 - 0.5) * dna.speed,
  ))
  const hovered = useRef(false)

  // Behavior state
  const behaviorMode  = useRef<'idle' | 'flee' | 'chase' | 'orbit' | 'charge' | 'approach' | 'school' | 'spiral'>('idle')
  const neighborCheck = useRef(0)
  const cachedSchoolmates = useRef<CreatureEntry[]>([])
  const cachedPrey    = useRef<CreatureEntry | null>(null)
  const awake         = useRef(dna.behavior !== 'sleeping')

  const rarity    = (dna.rarity   ?? 'common')   as Rarity
  const archetype = (dna.archetype ?? 'fish')     as BodyArchetype
  const rarityCfg = RARITY_CONFIG[rarity]
  const scale     = dna.size * (archetype === 'leviathan' ? 2.5 : archetype === 'ray' ? 3.0 : 4.0)
  const behavior  = dna.behavior as BehaviorType

  // Unregister from creature registry on unmount
  useEffect(() => {
    return () => { unregisterCreature(id) }
  }, [id])

  // ── Materials ─────────────────────────────────────────────────────────────
  const bodyMaterial = useMemo(() => new MeshStandardMaterial({
    color: dna.primaryColor,
    roughness: archetype === 'leviathan' ? 0.8 : 0.25,
    metalness: archetype === 'jellyfish' ? 0 : 0.1,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: dna.glowIntensity > 0.4 ? dna.glowIntensity * 2.5 : 0,
    transparent: dna.transparency < 1,
    opacity: dna.transparency,
    side: DoubleSide,
  }), [dna])

  const jellyfishMaterial = useMemo(() => new MeshPhysicalMaterial({
    color: dna.primaryColor,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: Math.max(0.6, dna.glowIntensity * 3),
    transmission: 0.7,
    opacity: 1,
    transparent: true,
    roughness: 0.1,
    metalness: 0,
    ior: 1.25,
    thickness: 0.3,
  }), [dna])

  const finMaterial = useMemo(() => new MeshStandardMaterial({
    color: dna.secondaryColor,
    roughness: 0.45,
    metalness: 0.05,
    side: DoubleSide,
    transparent: true,
    opacity: 0.75,
    emissive: new Color(dna.glowColor),
    emissiveIntensity: dna.glowIntensity * 0.8,
  }), [dna])

  const hitMaterial = useMemo(() => new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), [])

  const ringColor = RING_COLORS[rarity]
  const ringMat = useMemo(() => new MeshBasicMaterial({
    color: new Color(ringColor),
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [ringColor])

  const auraMat = useMemo(() => new MeshBasicMaterial({
    color: new Color(ringColor),
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [ringColor])

  const ringGeo = useMemo(() => new RingGeometry(
    dna.bodyLength * 1.1,
    dna.bodyLength * 1.55,
    48,
  ), [dna.bodyLength])

  const auraGeo = useMemo(() => new RingGeometry(
    dna.bodyLength * 2.2,
    dna.bodyLength * 3.5,
    48,
  ), [dna.bodyLength])

  // ── Per-frame ─────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (!groupRef.current) return
    const t   = state.clock.elapsedTime + timeOffset
    const dt  = Math.min(delta, 0.05)
    const currentPos = groupRef.current.position

    // ── Fade-in: smoothly increase opacity from 0 → 1 over FADE_DURATION ──
    if (spawnTime >= 0) {
      const age = state.clock.elapsedTime - spawnTime
      const fadeOpacity = Math.min(1, age / FADE_DURATION)
      if (bodyMaterial.opacity !== undefined) {
        bodyMaterial.opacity    = Math.min(dna.transparency, fadeOpacity)
        finMaterial.opacity     = Math.min(0.75, fadeOpacity * 0.75)
        jellyfishMaterial.opacity = Math.min(1, fadeOpacity)
      }
    }

    // Register in creature registry (every frame, cheap copy)
    registerCreature(id, currentPos, velocity.current, behavior, dna.size, archetype, dna.speed, rarity)

    // Sub distance (shared for all behaviors)
    let distToSub = Infinity
    if (_subWorldPos) {
      _toSub.copy(_subWorldPos).sub(currentPos)
      distToSub = _toSub.length()
    }

    // Periodic neighbor queries (every 8 frames to save perf)
    neighborCheck.current++
    if (neighborCheck.current >= 8) {
      neighborCheck.current = 0
      if (behavior === 'schooling') {
        cachedSchoolmates.current = findSchoolmates(currentPos, SCHOOL_RADIUS, id, behavior)
      } else if (behavior === 'predator') {
        cachedPrey.current = findNearest(currentPos, PREDATOR_CHASE_DIST, id, (e) => e.size < dna.size * 0.7)
      }
    }

    // ── BEHAVIOR STATE MACHINE ───────────────────────────────────────────
    let speedMult = 1.0
    behaviorMode.current = 'idle'

    switch (behavior) {

      // ── SCHOOLING (Boids) ────────────────────────────────────────────
      case 'schooling': {
        const mates = cachedSchoolmates.current
        if (mates.length >= 2) {
          behaviorMode.current = 'school'
          _sep.set(0, 0, 0)
          _ali.set(0, 0, 0)
          _coh.set(0, 0, 0)
          let sepCount = 0

          for (const m of mates) {
            _coh.add(m.position)
            _ali.add(m.velocity)
            _tmp.copy(currentPos).sub(m.position)
            const d = _tmp.length()
            if (d > 0 && d < SCHOOL_SEP_DIST) {
              _tmp.divideScalar(d * d)
              _sep.add(_tmp)
              sepCount++
            }
          }

          _coh.divideScalar(mates.length).sub(currentPos)
          if (_coh.length() > 0) _coh.normalize().multiplyScalar(SCHOOL_COH_WEIGHT)
          _ali.divideScalar(mates.length)
          if (_ali.length() > 0) _ali.normalize().multiplyScalar(SCHOOL_ALI_WEIGHT)
          if (sepCount > 0) {
            _sep.divideScalar(sepCount).normalize().multiplyScalar(SCHOOL_SEP_WEIGHT)
          }

          _desired.copy(_coh).add(_ali).add(_sep)
          targetPos.current.copy(currentPos).add(_desired.multiplyScalar(15))

          // Keep school near initial spawn region
          _tmp.copy(initialPosition).sub(targetPos.current)
          if (_tmp.length() > 120) {
            targetPos.current.lerp(initialPosition, 0.3)
          }
        } else {
          if (Math.random() < 0.005) {
            targetPos.current.set(
              initialPosition.x + (Math.random() - 0.5) * 60,
              Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 15),
              initialPosition.z + (Math.random() - 0.5) * 60,
            )
          }
        }
        break
      }

      // ── PREDATOR ──────────────────────────────────────────────────────
      case 'predator': {
        const prey = cachedPrey.current
        if (prey) {
          behaviorMode.current = 'chase'
          targetPos.current.copy(prey.position)
          speedMult = PREDATOR_BURST_MULT
          _tmp.copy(prey.position).sub(currentPos)
          if (_tmp.length() < 5) speedMult = 0.3
        } else {
          if (Math.random() < 0.003) {
            targetPos.current.set(
              initialPosition.x + (Math.random() - 0.5) * 120,
              Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 30),
              initialPosition.z + (Math.random() - 0.5) * 120,
            )
          }
          speedMult = 0.6
        }
        break
      }

      // ── SHY ───────────────────────────────────────────────────────────
      case 'shy': {
        if (_subWorldPos && distToSub < SHY_FLEE_DIST) {
          behaviorMode.current = 'flee'
          _tmp.copy(currentPos).sub(_subWorldPos).normalize()
          targetPos.current.copy(currentPos).addScaledVector(_tmp, 80)
          speedMult = SHY_FLEE_SPEED
        } else {
          if (Math.random() < 0.006) {
            targetPos.current.set(
              initialPosition.x + (Math.random() - 0.5) * 70,
              Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 20),
              initialPosition.z + (Math.random() - 0.5) * 70,
            )
          }
        }
        break
      }

      // ── CURIOUS ───────────────────────────────────────────────────────
      case 'curious': {
        if (_subWorldPos && distToSub < CURIOUS_ORBIT_DIST && distToSub > CURIOUS_MIN_DIST) {
          behaviorMode.current = 'orbit'
          const orbitAngle = t * 0.4
          const orbitR = 20 + Math.sin(t * 0.2) * 8
          targetPos.current.set(
            _subWorldPos.x + Math.cos(orbitAngle) * orbitR,
            _subWorldPos.y + Math.sin(orbitAngle * 0.7) * 6,
            _subWorldPos.z + Math.sin(orbitAngle) * orbitR,
          )
          speedMult = 0.7
        } else if (_subWorldPos && distToSub <= CURIOUS_MIN_DIST) {
          _tmp.copy(currentPos).sub(_subWorldPos).normalize()
          targetPos.current.copy(currentPos).addScaledVector(_tmp, 15)
          speedMult = 0.5
        } else {
          if (Math.random() < 0.006) {
            targetPos.current.set(
              initialPosition.x + (Math.random() - 0.5) * 60,
              Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 20),
              initialPosition.z + (Math.random() - 0.5) * 60,
            )
          }
        }
        break
      }

      // ── AGGRESSIVE ────────────────────────────────────────────────────
      case 'aggressive': {
        if (_subWorldPos && distToSub < AGGRESSIVE_CHARGE_DIST) {
          behaviorMode.current = 'charge'
          targetPos.current.copy(_subWorldPos)
          speedMult = AGGRESSIVE_SPEED
          if (distToSub < 8) {
            const swerve = (id % 2 === 0 ? 1 : -1) * 30
            targetPos.current.x += swerve
            targetPos.current.y += 15
            speedMult = 1.5
          }
        } else {
          if (Math.random() < 0.005) {
            targetPos.current.set(
              initialPosition.x + (Math.random() - 0.5) * 100,
              Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 30),
              initialPosition.z + (Math.random() - 0.5) * 100,
            )
          }
          speedMult = 1.2
        }
        break
      }

      // ── FRIENDLY ──────────────────────────────────────────────────────
      case 'friendly': {
        if (_subWorldPos && distToSub < FRIENDLY_APPROACH_DIST) {
          behaviorMode.current = 'approach'
          if (distToSub > FRIENDLY_IDLE_DIST) {
            _tmp.copy(_subWorldPos).sub(currentPos).normalize()
            targetPos.current.copy(currentPos).addScaledVector(_tmp, 10)
            speedMult = 0.5
          } else {
            const fig8 = t * 0.3
            targetPos.current.set(
              _subWorldPos.x + Math.sin(fig8) * 8,
              _subWorldPos.y + Math.cos(fig8 * 1.5) * 3,
              _subWorldPos.z + Math.cos(fig8) * 8,
            )
            speedMult = 0.3
          }
        } else {
          if (Math.random() < 0.006) {
            targetPos.current.set(
              initialPosition.x + (Math.random() - 0.5) * 60,
              Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 15),
              initialPosition.z + (Math.random() - 0.5) * 60,
            )
          }
        }
        break
      }

      // ── TERRITORIAL ───────────────────────────────────────────────────
      case 'territorial': {
        if (_subWorldPos && distToSub < TERRITORIAL_CHARGE) {
          _tmp.copy(_subWorldPos).sub(initialPosition)
          if (_tmp.length() < TERRITORIAL_RADIUS * 1.5) {
            behaviorMode.current = 'charge'
            targetPos.current.copy(_subWorldPos)
            speedMult = 2.0
            if (distToSub < 6) {
              const swerve = (id % 2 === 0 ? 1 : -1) * 20
              targetPos.current.x += swerve
              speedMult = 1.0
            }
          }
        } else {
          const patrolAngle = t * 0.15
          targetPos.current.set(
            initialPosition.x + Math.cos(patrolAngle) * TERRITORIAL_RADIUS,
            Math.min(-10, initialPosition.y + Math.sin(patrolAngle * 0.5) * 5),
            initialPosition.z + Math.sin(patrolAngle) * TERRITORIAL_RADIUS,
          )
          speedMult = 0.6
        }
        break
      }

      // ── SLEEPING ──────────────────────────────────────────────────────
      case 'sleeping': {
        if (_subWorldPos && distToSub < SLEEPING_WAKE_DIST) {
          if (!awake.current) awake.current = true
          behaviorMode.current = 'flee'
          _tmp.copy(currentPos).sub(_subWorldPos).normalize()
          targetPos.current.copy(currentPos).addScaledVector(_tmp, 40)
          speedMult = 1.8
        } else if (awake.current && _subWorldPos && distToSub > SLEEPING_WAKE_DIST * 3) {
          awake.current = false
        }
        if (!awake.current) {
          targetPos.current.set(
            initialPosition.x + Math.sin(t * 0.05) * 3,
            Math.min(-10, initialPosition.y + Math.cos(t * 0.04) * 1.5),
            initialPosition.z + Math.cos(t * 0.05) * 3,
          )
          speedMult = 0.08
        }
        break
      }

      // ── MIGRATING ─────────────────────────────────────────────────────
      case 'migrating': {
        const migDirX = Math.sin(id * 1.37)
        const migDirZ = Math.cos(id * 2.71)
        if (Math.random() < 0.002) {
          targetPos.current.x += migDirX * 150
          targetPos.current.z += migDirZ * 100
          targetPos.current.y = Math.min(-10, initialPosition.y + Math.sin(t * 0.1) * 15)
        }
        speedMult = 0.8
        break
      }

      // ── SCAVENGER ─────────────────────────────────────────────────────
      case 'scavenger': {
        behaviorMode.current = 'spiral'
        const spiralAngle = t * 0.3
        const spiralY = initialPosition.y - ((t * 0.5) % 60)
        targetPos.current.set(
          initialPosition.x + Math.cos(spiralAngle) * SCAVENGER_SPIRAL_R,
          Math.min(-10, spiralY),
          initialPosition.z + Math.sin(spiralAngle) * SCAVENGER_SPIRAL_R,
        )
        speedMult = 0.4
        if (Math.random() < 0.002) {
          initialPosition.x += (Math.random() - 0.5) * 40
          initialPosition.z += (Math.random() - 0.5) * 40
        }
        break
      }

      // ── DEFAULT: Generic wander ───────────────────────────────────────
      default: {
        if (Math.random() < 0.006) {
          targetPos.current.set(
            initialPosition.x + (Math.random() - 0.5) * 80,
            Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 25),
            initialPosition.z + (Math.random() - 0.5) * 80,
          )
        }
        break
      }
    }

    // ── Steering ──────────────────────────────────────────────────────────
    _desired.copy(targetPos.current).sub(currentPos)
    const dist = _desired.length()

    if (dist > 1) {
      _desired.normalize().multiplyScalar(dna.speed * 8 * speedMult)
      _steer.copy(_desired).sub(velocity.current).clampLength(0, dna.speed * dt * 20 * speedMult)
      velocity.current.add(_steer)
    }

    const maxV = dna.speed * 10 * speedMult
    if (velocity.current.length() > maxV) {
      velocity.current.setLength(maxV)
    }

    velocity.current.multiplyScalar(0.995)
    groupRef.current.position.addScaledVector(velocity.current, dt)

    // Clamp Y above surface
    if (groupRef.current.position.y > -10) {
      groupRef.current.position.y = -10
      velocity.current.y = Math.min(velocity.current.y, 0)
    }

    // ── Facing direction ─────────────────────────────────────────────────
    if (velocity.current.lengthSq() > 0.01) {
      _lookAt.copy(currentPos).add(velocity.current)
      groupRef.current.lookAt(_lookAt)
    }

    // ── Archetype animations ──────────────────────────────────────────────
    if (archetype === 'jellyfish') {
      const pulseFreq = 2 + dna.speed + (behaviorMode.current === 'flee' ? 3 : 0)
      const pulse = 1 + Math.sin(t * pulseFreq) * 0.12
      groupRef.current.scale.setScalar(scale * pulse)
    } else if (archetype === 'ray') {
      const undulAmp = 0.06 + (speedMult > 1 ? 0.04 : 0)
      groupRef.current.rotation.z = Math.sin(t * 1.5) * undulAmp
    } else if (archetype === 'leviathan') {
      groupRef.current.rotation.y += Math.sin(t * 0.4) * 0.002
    } else if (archetype === 'eel') {
      groupRef.current.rotation.z = Math.sin(t * 2.0 + id) * 0.04
    }

    // ── Rarity ring / aura ───────────────────────────────────────────────
    if (ringRef.current && ringMatRef.current) {
      if (!scanned) {
        ringRef.current.lookAt(state.camera.position)
        const style = rarityCfg.ringStyle

        if (style === 'none') {
          ringRef.current.visible = false
        } else {
          ringRef.current.visible = true
          let opacity = 0
          if (style === 'subtle') {
            opacity = hovered.current ? 0.3 : 0.08
          } else if (style === 'pulse') {
            opacity = hovered.current ? 0.5 : (0.15 + 0.12 * Math.sin(t * 2))
          } else if (style === 'gold' || style === 'animated') {
            opacity = hovered.current ? 0.7 : (0.25 + 0.2 * Math.abs(Math.sin(t * 3)))
          } else if (style === 'aura') {
            opacity = hovered.current ? 0.9 : (0.35 + 0.3 * Math.abs(Math.sin(t * 4)))
          }
          ringMatRef.current.opacity = opacity
        }
      } else {
        ringRef.current.visible = false
      }
    }

    // Aura ring (legendary+)
    if (auraRef.current && auraMatRef.current && !scanned) {
      auraRef.current.lookAt(state.camera.position)
      const isLegendary = rarity === 'legendary' || rarity === 'mythical'
      auraRef.current.visible = isLegendary
      if (isLegendary) {
        auraRef.current.rotation.z = t * (rarity === 'mythical' ? 1.2 : 0.6)
        auraMatRef.current.opacity = 0.04 + 0.04 * Math.sin(t * 2)
      }
    }
  })

  // ── Event handlers ────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <group
      ref={groupRef}
      position={initialPosition}
      scale={[scale, scale, scale]}
    >
      {/* Rarity ring (billboarded) */}
      {!scanned && rarityCfg.ringStyle !== 'none' && (
        <mesh ref={ringRef} geometry={ringGeo}>
          <primitive ref={ringMatRef} object={ringMat} attach="material" />
        </mesh>
      )}

      {/* Aura ring for legendary/mythical */}
      {!scanned && (rarity === 'legendary' || rarity === 'mythical') && (
        <mesh ref={auraRef} geometry={auraGeo}>
          <primitive ref={auraMatRef} object={auraMat} attach="material" />
        </mesh>
      )}

      {/* Invisible click hitbox */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <capsuleGeometry args={[dna.bodyWidth * 1.4, dna.bodyLength * 1.3, 4, 8]} />
        <primitive object={hitMaterial} attach="material" />
      </mesh>

      {/* Eyes (most archetypes except jellyfish) */}
      {archetype !== 'jellyfish' && archetype !== 'ray' && dna.eyeCount > 0 && Array.from({ length: Math.min(dna.eyeCount, 2) }).map((_, i) => (
        <group key={`eye-${i}`} position={[
          dna.bodyWidth * 0.85 * (i === 0 ? 1 : -1),
          dna.bodyWidth * 0.3,
          dna.bodyLength * (archetype === 'eel' ? 0.48 : 0.38),
        ]}>
          <mesh>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </group>
      ))}

      {/* Archetype-specific body */}
      {archetype === 'fish'       && <FishBody       dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />}
      {archetype === 'ray'        && <RayBody        dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />}
      {archetype === 'eel'        && <EelBody        dna={dna} bodyMat={bodyMaterial} />}
      {archetype === 'jellyfish'  && <JellyfishBody  dna={dna} bodyMat={jellyfishMaterial as any} finMat={finMaterial} />}
      {archetype === 'cephalopod' && <CephalopodBody dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />}
      {archetype === 'leviathan'  && <LeviathanBody  dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />}

      {/* Bioluminescent glow point for glowing species */}
      {dna.glowIntensity > 0.55 && (
        <pointLight
          color={dna.glowColor}
          intensity={dna.glowIntensity * 8}
          distance={dna.size * 12}
        />
      )}
    </group>
  )
})
