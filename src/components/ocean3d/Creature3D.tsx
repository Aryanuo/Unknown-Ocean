import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import { useFrame, ThreeEvent, useThree } from '@react-three/fiber'
import {
  Vector3, Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial,
  DoubleSide, Color, MeshBasicMaterial, RingGeometry, AdditiveBlending,
  MathUtils
} from 'three'
import { CreatureDNA } from '../../store/usePlayerStore'
import { RARITY_CONFIG, Rarity, BodyArchetype, BehaviorType } from '../../engine/procedural/creatureFactory'
import {
  registerCreature, unregisterCreature,
  findNeighbors, findNearest, findSchoolmates,
  CreatureEntry,
} from '../../engine/creatureRegistry'

const _desired  = new Vector3()
const _lookAt   = new Vector3()
const _steer    = new Vector3()
const _toSub    = new Vector3()
const _sep      = new Vector3()
const _ali      = new Vector3()
const _coh      = new Vector3()
const _tmp      = new Vector3()

let _subWorldPos: Vector3 | null = null
export function registerSubPos(v: Vector3) { _subWorldPos = v }

const RING_COLORS: Record<Rarity, string> = {
  common: '#90a4ae', uncommon: '#66bb6a', rare: '#42a5f5', epic: '#ce93d8', legendary: '#ffc300', mythical: '#ff006e',
}

const SCHOOL_RADIUS = 35; const SCHOOL_SEP_DIST = 8; const SCHOOL_SEP_WEIGHT = 2.5; const SCHOOL_ALI_WEIGHT = 1.2; const SCHOOL_COH_WEIGHT = 1.0; const PREDATOR_CHASE_DIST = 80; const PREDATOR_BURST_MULT = 2.8; const SHY_FLEE_DIST = 60; const SHY_FLEE_SPEED = 2.5; const CURIOUS_ORBIT_DIST = 45; const CURIOUS_MIN_DIST = 10; const AGGRESSIVE_CHARGE_DIST = 50; const AGGRESSIVE_SPEED = 3.0; const FRIENDLY_APPROACH_DIST = 55; const FRIENDLY_IDLE_DIST = 12; const TERRITORIAL_RADIUS = 30; const TERRITORIAL_CHARGE = 40; const SLEEPING_WAKE_DIST = 20; const SCAVENGER_SPIRAL_R = 15; const FADE_DURATION = 2.0

interface CreatureProps { dna: CreatureDNA; wx: number; wy: number; wz: number; id: number; scanned: boolean; spawnTime: number; onClick: () => void }

function FishBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  return (<><mesh><capsuleGeometry args={[dna.bodyWidth, dna.bodyLength, 8, 16]} /><primitive object={bodyMat} attach="material" /></mesh><group position={[0, 0, -dna.bodyLength * 0.5]}><mesh position={[0, 0, -dna.bodyLength * 0.2]} rotation={[0, 0, Math.PI / 4]}><coneGeometry args={[dna.bodyWidth * 1.1, dna.bodyLength * 0.6, 4]} /><primitive object={finMat} attach="material" /></mesh></group><mesh position={[0, dna.bodyWidth * 1.4, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[dna.bodyWidth * 0.6, dna.bodyLength * 0.5]} /><primitive object={finMat} attach="material" /></mesh>{Array.from({ length: Math.min(dna.finCount, 4) }).map((_, i) => { const side = i % 2 === 0 ? 1 : -1; const fz = (i < 2 ? -0.1 : 0.3) * dna.bodyLength; return (<mesh key={`fin-${i}`} position={[dna.bodyWidth * side, 0, fz]} rotation={[0, side * 0.3, side * 0.4]}><planeGeometry args={[dna.bodyWidth * 1.2, dna.bodyWidth * 0.9]} /><primitive object={finMat} attach="material" /></mesh>) })}</>)
}

function RayBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  return (<><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[dna.bodyWidth, dna.bodyWidth * 0.7, dna.bodyLength * 0.25, 16]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[dna.bodyWidth * 1.1, 0, 0]} rotation={[Math.PI / 2, 0, 0.2]}><planeGeometry args={[dna.bodyWidth * 2.2, dna.bodyLength * 0.7]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[-dna.bodyWidth * 1.1, 0, 0]} rotation={[Math.PI / 2, 0, -0.2]}><planeGeometry args={[dna.bodyWidth * 2.2, dna.bodyLength * 0.7]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[0, 0, dna.bodyLength * 0.55]}><cylinderGeometry args={[0.04, dna.bodyWidth * 0.3, dna.bodyLength * 0.8, 8]} /><primitive object={finMat} attach="material" /></mesh></>)
}

function EelBody({ dna, bodyMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial }) {
  const segments = 6; return (<>{Array.from({ length: segments }).map((_, i) => { const t = i / segments; const taper = 1 - t * 0.7; return (<mesh key={`seg-${i}`} position={[0, 0, (i - segments / 2) * dna.bodyLength * 0.18]}><sphereGeometry args={[dna.bodyWidth * taper, 8, 6]} /><primitive object={bodyMat} attach="material" /></mesh>) })}<mesh position={[0, dna.bodyWidth * 1.2, 0]} rotation={[0, 0, 0]}><planeGeometry args={[dna.bodyWidth * 0.4, dna.bodyLength * 0.85]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[0, -dna.bodyWidth * 1.2, 0]}><planeGeometry args={[dna.bodyWidth * 0.4, dna.bodyLength * 0.85]} /><primitive object={bodyMat} attach="material" /></mesh></>)
}

function JellyfishBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshPhysicalMaterial; finMat: MeshStandardMaterial }) {
  const tentacleCount = 6 + Math.floor(dna.finCount * 1.5); return (<><mesh><sphereGeometry args={[dna.bodyWidth, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[0, -dna.bodyWidth * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[dna.bodyWidth * 0.55, dna.bodyWidth * 0.08, 8, 24]} /><primitive object={finMat} attach="material" /></mesh>{Array.from({ length: tentacleCount }).map((_, i) => { const angle = (i / tentacleCount) * Math.PI * 2; const r = dna.bodyWidth * 0.5; const ox = Math.cos(angle) * r; const oz = Math.sin(angle) * r; return (<mesh key={`tent-${i}`} position={[ox, -dna.bodyWidth * 0.05, oz]}><cylinderGeometry args={[0.015, 0.005, dna.bodyLength * 0.9, 4]} /><primitive object={finMat} attach="material" /></mesh>) })}</>)
}

function CephalopodBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  const armCount = 6 + Math.floor(dna.finCount * 1.5); return (<><mesh><capsuleGeometry args={[dna.bodyWidth * 0.9, dna.bodyLength * 0.7, 6, 12]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[dna.bodyWidth * 0.7, 0.1, dna.bodyLength * 0.3]}><sphereGeometry args={[dna.bodyWidth * 0.28, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh><mesh position={[-dna.bodyWidth * 0.7, 0.1, dna.bodyLength * 0.3]}><sphereGeometry args={[dna.bodyWidth * 0.28, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>{Array.from({ length: armCount }).map((_, i) => { const angle = (i / armCount) * Math.PI * 2; const r = dna.bodyWidth * 0.6; const ox = Math.cos(angle) * r * 0.5; const oz = Math.sin(angle) * r * 0.5; return (<mesh key={`arm-${i}`} position={[ox, -dna.bodyWidth * 0.4, oz + dna.bodyLength * 0.3]}><cylinderGeometry args={[0.04, 0.01, dna.bodyLength * 0.6, 4]} /><primitive object={finMat} attach="material" /></mesh>) })}</>)
}

function LeviathanBody({ dna, bodyMat, finMat }: { dna: CreatureDNA; bodyMat: MeshStandardMaterial; finMat: MeshStandardMaterial }) {
  return (<><mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[dna.bodyWidth, dna.bodyLength, 6, 16]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[0, 0, dna.bodyLength * 0.6]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[dna.bodyWidth * 3.5, dna.bodyLength * 0.4]} /><primitive object={finMat} attach="material" /></mesh><mesh position={[dna.bodyWidth * 1.5, -dna.bodyWidth * 0.2, 0]} rotation={[0.4, 0.2, -0.3]}><planeGeometry args={[dna.bodyWidth * 2.5, dna.bodyLength * 0.35]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[-dna.bodyWidth * 1.5, -dna.bodyWidth * 0.2, 0]} rotation={[0.4, -0.2, 0.3]}><planeGeometry args={[dna.bodyWidth * 2.5, dna.bodyLength * 0.35]} /><primitive object={bodyMat} attach="material" /></mesh><mesh position={[0, dna.bodyWidth * 1.4, -dna.bodyLength * 0.2]}><coneGeometry args={[dna.bodyWidth * 0.3, dna.bodyWidth * 1.8, 8]} /><primitive object={finMat} attach="material" /></mesh></>)
}

export const Creature3D = React.memo(function Creature3D({ dna, wx, wy, wz, id, scanned, spawnTime, onClick }: CreatureProps) {
  const groupRef = useRef<Group>(null); const ringRef = useRef<Mesh>(null); const ringMatRef = useRef<MeshBasicMaterial>(null); const { camera } = useThree()
  const initialPosition = useMemo(() => new Vector3(wx, wy, wz), [wx, wy, wz])
  const timeOffset = useRef(id * 13.37).current; const targetPos = useRef(initialPosition.clone()); const velocity = useRef(new Vector3((((id * 73 + 17) % 100) / 100 - 0.5) * dna.speed, (((id * 31 + 53) % 100) / 100 - 0.5) * 0.1, (((id * 97 + 41) % 100) / 100 - 0.5) * dna.speed))
  const hovered = useRef(false); const behaviorMode = useRef<string>('idle'); const neighborCheck = useRef(0); const cachedSchoolmates = useRef<CreatureEntry[]>([]); const cachedPrey = useRef<CreatureEntry | null>(null); const awake = useRef(dna.behavior !== 'sleeping')
  const rarity = (dna.rarity ?? 'common') as Rarity; const archetype = (dna.archetype ?? 'fish') as BodyArchetype; const rarityCfg = RARITY_CONFIG[rarity]; const scale = dna.size * (archetype === 'leviathan' ? 2.5 : archetype === 'ray' ? 3.0 : 4.0); const behavior = dna.behavior as BehaviorType

  useEffect(() => () => unregisterCreature(id), [id])

  const bodyMaterial = useMemo(() => new MeshStandardMaterial({ color: dna.primaryColor, roughness: archetype === 'leviathan' ? 0.8 : 0.25, metalness: archetype === 'jellyfish' ? 0 : 0.1, emissive: new Color(dna.glowColor), emissiveIntensity: dna.glowIntensity > 0.4 ? dna.glowIntensity * 2.5 : 0, transparent: true, opacity: 0, side: DoubleSide }), [dna, archetype])
  const jellyfishMaterial = useMemo(() => new MeshPhysicalMaterial({ color: dna.primaryColor, emissive: new Color(dna.glowColor), emissiveIntensity: Math.max(0.6, dna.glowIntensity * 3), transmission: 0.7, opacity: 0, transparent: true, roughness: 0.1, metalness: 0, ior: 1.25, thickness: 0.3 }), [dna])
  const finMaterial = useMemo(() => new MeshStandardMaterial({ color: dna.secondaryColor, roughness: 0.45, metalness: 0.05, side: DoubleSide, transparent: true, opacity: 0, emissive: new Color(dna.glowColor), emissiveIntensity: dna.glowIntensity * 0.8 }), [dna])
  const hitMaterial = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])
  const ringMat = useMemo(() => new MeshBasicMaterial({ color: new Color(RING_COLORS[rarity]), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }), [rarity])
  const ringGeo = useMemo(() => new RingGeometry(dna.bodyLength * 1.1, dna.bodyLength * 1.55, 48), [dna.bodyLength])

  useFrame((state, delta) => {
    if (!groupRef.current) return; const t = state.clock.elapsedTime + timeOffset; const dt = Math.min(delta, 0.05); const currentPos = groupRef.current.position
    const distToCam = currentPos.distanceTo(camera.position)

    // FADE & DISTANCE FOG (Ocean Haze)
    // Distant creatures fade into the background instead of being sharp points or disappearing suddenly
    const baseOp = spawnTime >= 0 ? Math.min(1, (state.clock.elapsedTime - spawnTime) / FADE_DURATION) : 1
    const distFade = MathUtils.smoothstep(distToCam, 180, 280) // Fade out completely by 280 units
    const finalOp = baseOp * (1 - distFade)
    
    bodyMaterial.opacity = dna.transparency * finalOp
    finMaterial.opacity = 0.75 * finalOp
    jellyfishMaterial.opacity = finalOp
    ringMat.opacity = finalOp * 0.2

    if (distToCam > 280) { groupRef.current.visible = false; return } else { groupRef.current.visible = true }

    registerCreature(id, currentPos, velocity.current, behavior, dna.size, archetype, dna.speed, rarity)
    let distToSub = Infinity; if (_subWorldPos) { _toSub.copy(_subWorldPos).sub(currentPos); distToSub = _toSub.length() }
    neighborCheck.current++
    if (neighborCheck.current >= 8) {
      neighborCheck.current = 0
      if (behavior === 'schooling') cachedSchoolmates.current = findSchoolmates(currentPos, SCHOOL_RADIUS, id, behavior)
      else if (behavior === 'predator') cachedPrey.current = findNearest(currentPos, PREDATOR_CHASE_DIST, id, (e) => e.size < dna.size * 0.7)
    }

    let speedMult = 1.0; behaviorMode.current = 'idle'
    switch (behavior) {
      case 'schooling': { const mates = cachedSchoolmates.current; if (mates.length >= 2) { behaviorMode.current = 'school'; _sep.set(0, 0, 0); _ali.set(0, 0, 0); _coh.set(0, 0, 0); let sepCount = 0; for (const m of mates) { _coh.add(m.position); _ali.add(m.velocity); _tmp.copy(currentPos).sub(m.position); const d = _tmp.length(); if (d > 0 && d < SCHOOL_SEP_DIST) { _tmp.divideScalar(d * d); _sep.add(_tmp); sepCount++ } }; _coh.divideScalar(mates.length).sub(currentPos); if (_coh.length() > 0) _coh.normalize().multiplyScalar(SCHOOL_COH_WEIGHT); _ali.divideScalar(mates.length); if (_ali.length() > 0) _ali.normalize().multiplyScalar(SCHOOL_ALI_WEIGHT); if (sepCount > 0) _sep.divideScalar(sepCount).normalize().multiplyScalar(SCHOOL_SEP_WEIGHT); _desired.copy(_coh).add(_ali).add(_sep); targetPos.current.copy(currentPos).add(_desired.multiplyScalar(15)); _tmp.copy(initialPosition).sub(targetPos.current); if (_tmp.length() > 120) targetPos.current.lerp(initialPosition, 0.3) } else { if (Math.random() < 0.005) targetPos.current.set(initialPosition.x + (Math.random() - 0.5) * 60, Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 15), initialPosition.z + (Math.random() - 0.5) * 60) }; break }
      case 'predator': { const prey = cachedPrey.current; if (prey) { behaviorMode.current = 'chase'; targetPos.current.copy(prey.position); speedMult = PREDATOR_BURST_MULT; _tmp.copy(prey.position).sub(currentPos); if (_tmp.length() < 5) speedMult = 0.3 } else { if (Math.random() < 0.003) targetPos.current.set(initialPosition.x + (Math.random() - 0.5) * 120, Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 30), initialPosition.z + (Math.random() - 0.5) * 120); speedMult = 0.6 }; break }
      case 'shy': { if (_subWorldPos && distToSub < SHY_FLEE_DIST) { behaviorMode.current = 'flee'; _tmp.copy(currentPos).sub(_subWorldPos).normalize(); targetPos.current.copy(currentPos).addScaledVector(_tmp, 80); speedMult = SHY_FLEE_SPEED } else { if (Math.random() < 0.006) targetPos.current.set(initialPosition.x + (Math.random() - 0.5) * 70, Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 20), initialPosition.z + (Math.random() - 0.5) * 70) }; break }
      case 'curious': { if (_subWorldPos && distToSub < CURIOUS_ORBIT_DIST && distToSub > CURIOUS_MIN_DIST) { behaviorMode.current = 'orbit'; const orbitAngle = t * 0.4; const orbitR = 20 + Math.sin(t * 0.2) * 8; targetPos.current.set(_subWorldPos.x + Math.cos(orbitAngle) * orbitR, _subWorldPos.y + Math.sin(orbitAngle * 0.7) * 6, _subWorldPos.z + Math.sin(orbitAngle) * orbitR); speedMult = 0.7 } else if (_subWorldPos && distToSub <= CURIOUS_MIN_DIST) { _tmp.copy(currentPos).sub(_subWorldPos).normalize(); targetPos.current.copy(currentPos).addScaledVector(_tmp, 15); speedMult = 0.5 } else { if (Math.random() < 0.006) targetPos.current.set(initialPosition.x + (Math.random() - 0.5) * 60, Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 20), initialPosition.z + (Math.random() - 0.5) * 60) }; break }
      case 'aggressive': { if (_subWorldPos && distToSub < AGGRESSIVE_CHARGE_DIST) { behaviorMode.current = 'charge'; targetPos.current.copy(_subWorldPos); speedMult = AGGRESSIVE_SPEED; if (distToSub < 8) { const swerve = (id % 2 === 0 ? 1 : -1) * 30; targetPos.current.x += swerve; targetPos.current.y += 15; speedMult = 1.5 } } else { if (Math.random() < 0.005) targetPos.current.set(initialPosition.x + (Math.random() - 0.5) * 100, Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 30), initialPosition.z + (Math.random() - 0.5) * 100); speedMult = 1.2 }; break }
      default: { if (Math.random() < 0.006) targetPos.current.set(initialPosition.x + (Math.random() - 0.5) * 80, Math.min(-10, initialPosition.y + (Math.random() - 0.5) * 25), initialPosition.z + (Math.random() - 0.5) * 80); break }
    }

    _desired.copy(targetPos.current).sub(currentPos); const d = _desired.length()
    if (d > 1) { _desired.normalize().multiplyScalar(dna.speed * 8 * speedMult); _steer.copy(_desired).sub(velocity.current).clampLength(0, dna.speed * dt * 20 * speedMult); velocity.current.add(_steer) }
    const maxV = dna.speed * 10 * speedMult; if (velocity.current.length() > maxV) velocity.current.setLength(maxV)
    velocity.current.multiplyScalar(0.995); groupRef.current.position.addScaledVector(velocity.current, dt)
    if (groupRef.current.position.y > -10) { groupRef.current.position.y = -10; velocity.current.y = Math.min(velocity.current.y, 0) }
    if (velocity.current.lengthSq() > 0.01) { _lookAt.copy(currentPos).add(velocity.current); groupRef.current.lookAt(_lookAt) }

    groupRef.current.scale.setScalar(scale * (archetype === 'jellyfish' ? (1 + Math.sin(t * (2 + dna.speed)) * 0.12) : 1))
    if (ringRef.current) { ringRef.current.lookAt(state.camera.position); ringRef.current.visible = !scanned && distToCam < 120 }
  })

  const bodyMat = archetype === 'jellyfish' ? jellyfishMaterial : bodyMaterial
  const renderBody = useMemo(() => {
    // 👁 Sub-component: Eye rendering (most archetypes have 2 lateral eyes)
    const renderEyes = (widthMult = 1.0, lengthMult = 1.0, verticalOffset = 0.3) => {
      if (dna.eyeCount <= 0) return null
      const count = Math.min(dna.eyeCount, 2)
      return Array.from({ length: count }).map((_, i) => {
        const side = i === 0 ? 1 : -1
        const xPos = dna.bodyWidth * 0.7 * side * widthMult
        const zPos = dna.bodyLength * 0.3 * lengthMult
        const yPos = dna.bodyWidth * verticalOffset
        return (
          <group key={`eye-${i}`} position={[xPos, yPos, zPos]}>
            {/* Sclera */}
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Pupil */}
            <mesh position={[0, 0, 0.05]}>
              <sphereGeometry args={[0.045, 6, 6]} />
              <meshBasicMaterial color="#000000" />
            </mesh>
          </group>
        )
      })
    }

    switch (archetype) {
      case 'fish': return (
        <>
          <FishBody dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />
          {renderEyes(1.0, 1.0, 0.3)}
        </>
      )
      case 'ray': return (
        <>
          <RayBody dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />
          {renderEyes(0.6, 0.8, 0.45)}
        </>
      )
      case 'eel': return (
        <>
          <EelBody dna={dna} bodyMat={bodyMaterial} />
          {renderEyes(0.9, 1.3, 0.3)}
        </>
      )
      case 'jellyfish': return <JellyfishBody dna={dna} bodyMat={jellyfishMaterial} finMat={finMaterial} />
      case 'cephalopod': return <CephalopodBody dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />
      case 'leviathan': return (
        <>
          <LeviathanBody dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />
          {renderEyes(0.8, 1.2, 0.4)}
        </>
      )
      default: return <FishBody dna={dna} bodyMat={bodyMaterial} finMat={finMaterial} />
    }
  }, [archetype, dna, bodyMaterial, finMaterial, jellyfishMaterial])

  return (
    <group ref={groupRef} position={initialPosition}>
      {renderBody}
      <mesh rotation={[0, 0, 0]} onPointerOver={() => { hovered.current = true }} onPointerOut={() => { hovered.current = false }} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick() }}>
        <sphereGeometry args={[dna.bodyLength * 0.8, 8, 8]} /><primitive object={hitMaterial} attach="material" />
      </mesh>
      <mesh ref={ringRef} geometry={ringGeo} material={ringMat} />
    </group>
  )
})