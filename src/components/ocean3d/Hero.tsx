import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Vector3, Group, Quaternion, Euler, MathUtils,
  MeshStandardMaterial, MeshPhysicalMaterial, Color, SpotLight, Object3D
} from 'three'
import { usePlayerStore } from '../../store/usePlayerStore'
import { BubbleTrail } from './BubbleTrail'

// Shared speed ref so BubbleTrail can read it without prop drilling overhead
export const heroSpeedRef = { current: 0 }

// ─── Pre-allocated reusables (no per-frame allocations) ──────────────────────
const _moveDir    = new Vector3()
const _idealCamPos = new Vector3()
const _lookTarget  = new Vector3()
const _vel        = new Vector3()
const _subPos     = new Vector3()
const _q          = new Quaternion()
const _euler      = new Euler()
const _up         = new Vector3(0, 1, 0)
const _forward    = new Vector3(0, 0, -1)
const _bankAxis   = new Vector3(1, 0, 0)

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SPEED        = 32
const ACCELERATION     = 55
const DAMPING          = 0.88          // per-frame multiply (frame-rate corrected below)
const TURN_SPEED       = 1.8           // rad/s
const PITCH_SPEED      = 1.2
const BANK_AMOUNT      = 0.38          // max roll radians while turning
const BANK_SMOOTH      = 6            // lerp speed for banking
const CAM3_OFFSET      = new Vector3(0, 12, 42)
const CAM3_SMOOTH      = 5            // camera lerp speed (spring)
const CAM3_LOOKAHEAD   = 14           // units ahead of sub the camera looks
const CAM1_OFFSET      = new Vector3(0, 1.5, -1.5) // inside cockpit
const FOV_BASE         = 62
const FOV_BOOST        = 12           // extra FOV at max speed
const STORE_SYNC_DIST  = 8            // update Zustand only when moved this far

export function Hero() {
  const { coords, depth, setCoords, setDepth } = usePlayerStore()
  const { camera } = useThree()

  // ── Refs (never trigger renders) ──────────────────────────────────────────
  const groupRef   = useRef<Group>(null)
  const propRef    = useRef<Group>(null)
  const spotRef    = useRef<SpotLight>(null)
  const spotTarget = useRef<Object3D>(new Object3D())

  const velocity   = useRef(new Vector3())
  const subYaw     = useRef(0)          // current heading in radians
  const subPitch   = useRef(0)
  const bankAngle  = useRef(0)

  const camPos     = useRef(new Vector3(coords.x, -Math.max(10, depth), coords.y + 42))
  const camMode    = useRef<'third' | 'first'>('third')

  const storePos   = useRef(new Vector3(coords.x, -Math.max(10, depth), coords.y))
  const keys       = useRef<Set<string>>(new Set())

  // ── Input handling via refs (zero React re-renders) ───────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase())
      // Camera toggle
      if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'c') {
        camMode.current = camMode.current === 'third' ? 'first' : 'third'
        document.body.classList.toggle('cockpit-active', camMode.current === 'first')
      }
    }
    const up   = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())

    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)

    // Set initial submarine position
    if (groupRef.current) {
      groupRef.current.position.set(coords.x, -Math.max(10, depth), coords.y)
    }
    // Attach spotlight target to scene
    if (spotTarget.current && groupRef.current) {
      groupRef.current.add(spotTarget.current)
      spotTarget.current.position.set(0, -3, -80)
    }

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup',   up)
    }
  }, []) // eslint-disable-line

  // ── Per-frame logic ───────────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05) // clamp to avoid huge jumps

    const k = keys.current

    // ── 1. Gather input ───────────────────────────────────────────────────
    const fwd   = (k.has('w') || k.has('arrowup'))    ? 1 : 0
    const back  = (k.has('s') || k.has('arrowdown'))  ? 1 : 0
    const left  = (k.has('a') || k.has('arrowleft'))  ? 1 : 0
    const right = (k.has('d') || k.has('arrowright')) ? 1 : 0
    const up    = (k.has('e'))                        ? 1 : 0
    const dn    = (k.has('q'))                        ? 1 : 0
    const boost = (k.has('shift'))                    ? 1.6 : 1.0

    // ── 2. Update heading (yaw/pitch) ─────────────────────────────────────
    const turnInput = right - left
    const pitchInput = dn - up     // Q=dive, E=ascend → negative pitch = nose down

    subYaw.current   -= turnInput   * TURN_SPEED  * dt
    subPitch.current += pitchInput  * PITCH_SPEED * dt
    subPitch.current  = MathUtils.clamp(subPitch.current, -1.1, 1.1)

    // ── 3. Compute movement direction from heading ────────────────────────
    _euler.set(subPitch.current, subYaw.current, 0, 'YXZ')
    _q.setFromEuler(_euler)

    _moveDir.set(0, 0, -(fwd - back))
    _moveDir.applyQuaternion(_q)

    if (_moveDir.lengthSq() > 0) {
      velocity.current.addScaledVector(_moveDir, ACCELERATION * boost * dt)
    }

    // ── 4. Damping (frame-rate independent) ───────────────────────────────
    const frameDamp = Math.pow(DAMPING, dt * 60)
    velocity.current.multiplyScalar(frameDamp)

    // Clamp speed
    const spd = velocity.current.length()
    if (spd > MAX_SPEED * boost) {
      velocity.current.multiplyScalar((MAX_SPEED * boost) / spd)
    }

    // ── 5. Apply position ─────────────────────────────────────────────────
    groupRef.current.position.addScaledVector(velocity.current, dt)
    _subPos.copy(groupRef.current.position)

    // Constrain: surface = Y=-10, max depth = -11000
    _subPos.y = MathUtils.clamp(_subPos.y, -11000, -10)
    groupRef.current.position.y = _subPos.y

    // ── 6. Apply submarine rotation (yaw + pitch + bank) ──────────────────
    const targetBank = -turnInput * BANK_AMOUNT * (spd / MAX_SPEED)
    bankAngle.current = MathUtils.lerp(bankAngle.current, targetBank, BANK_SMOOTH * dt)

    _euler.set(subPitch.current, subYaw.current, bankAngle.current, 'YXZ')
    groupRef.current.quaternion.setFromEuler(_euler)

    // ── 7. Propeller spin ─────────────────────────────────────────────────
    if (propRef.current) {
      propRef.current.rotation.z += spd * dt * 3.5
    }
    heroSpeedRef.current = MathUtils.clamp(spd / MAX_SPEED, 0, 1)

    // ── 8. Camera ─────────────────────────────────────────────────────────
    const speedFrac = MathUtils.clamp(spd / MAX_SPEED, 0, 1)

    if (camMode.current === 'third') {
      // Spring follow: offset is in world space, biased behind sub's yaw
      const behindX = Math.sin(subYaw.current) * CAM3_OFFSET.z
      const behindZ = Math.cos(subYaw.current) * CAM3_OFFSET.z
      _idealCamPos.set(
        _subPos.x + behindX,
        _subPos.y + CAM3_OFFSET.y,
        _subPos.z + behindZ
      )
      // Smooth follow
      camPos.current.lerp(_idealCamPos, MathUtils.clamp(CAM3_SMOOTH * dt, 0, 1))
      camera.position.copy(camPos.current)

      // Look ahead in movement direction
      _lookTarget.copy(_subPos)
      _lookTarget.x -= Math.sin(subYaw.current) * CAM3_LOOKAHEAD
      _lookTarget.y += subPitch.current * 8
      _lookTarget.z -= Math.cos(subYaw.current) * CAM3_LOOKAHEAD
      camera.lookAt(_lookTarget)

      // FOV breathing
      ;(camera as any).fov = MathUtils.lerp(
        (camera as any).fov,
        FOV_BASE + speedFrac * FOV_BOOST,
        3 * dt
      )
      ;(camera as any).updateProjectionMatrix?.()

    } else {
      // First-person cockpit view
      _idealCamPos.copy(CAM1_OFFSET).applyQuaternion(groupRef.current.quaternion).add(_subPos)
      camera.position.lerp(_idealCamPos, Math.min(10 * dt, 1))

      // Cockpit vibration
      const vibAmt = speedFrac * 0.012
      camera.position.x += (Math.random() - 0.5) * vibAmt
      camera.position.y += (Math.random() - 0.5) * vibAmt

      // Look forward from cockpit
      _lookTarget.copy(_forward).applyQuaternion(groupRef.current.quaternion).multiplyScalar(30).add(_subPos)
      camera.lookAt(_lookTarget)
      ;(camera as any).fov = MathUtils.lerp((camera as any).fov, FOV_BASE - 5, 3 * dt)
      ;(camera as any).updateProjectionMatrix?.()
    }

    // ── 9. Sync store (throttled) ─────────────────────────────────────────
    const dx = Math.abs(storePos.current.x - _subPos.x)
    const dy = Math.abs(storePos.current.y - _subPos.y)
    const dz = Math.abs(storePos.current.z - _subPos.z)
    if (dx > STORE_SYNC_DIST || dy > STORE_SYNC_DIST || dz > STORE_SYNC_DIST) {
      setCoords(Math.round(_subPos.x), Math.round(_subPos.z))
      setDepth(Math.round(-_subPos.y))
      storePos.current.copy(_subPos)
    }
  })

  // ── Materials (memo — created once) ───────────────────────────────────────
  const hullMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#b71c1c'),
    roughness: 0.35,
    metalness: 0.82,
    envMapIntensity: 1.2,
  }), [])

  const darkHullMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#7f0000'),
    roughness: 0.45,
    metalness: 0.75,
  }), [])

  const glassMat = useMemo(() => new MeshPhysicalMaterial({
    color: new Color('#a8d8ea'),
    transmission: 0.88,
    opacity: 1,
    transparent: true,
    roughness: 0.05,
    metalness: 0.1,
    ior: 1.52,
    reflectivity: 0.5,
    thickness: 0.5,
    envMapIntensity: 2,
  }), [])

  const metalMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#424242'),
    roughness: 0.2,
    metalness: 0.95,
  }), [])

  const propMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#90a4ae'),
    roughness: 0.15,
    metalness: 0.98,
  }), [])

  const portholeMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#ffe082'),
    emissive: new Color('#ffb300'),
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.3,
  }), [])

  const accentMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#00e5ff'),
    emissive: new Color('#00b0ff'),
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.5,
  }), [])

  return (
    <group ref={groupRef}>
      {/* ── Headlights ───────────────────────────────────────────────────── */}
      <spotLight
        ref={spotRef}
        position={[0, 0.5, -4.5]}
        angle={Math.PI / 5}
        penumbra={0.4}
        intensity={350}
        distance={300}
        color="#c8f0ff"
        target={spotTarget.current}
        castShadow={false}
      />
      {/* Secondary narrower cone */}
      <spotLight
        position={[0, 0.5, -4.5]}
        angle={Math.PI / 10}
        penumbra={0.2}
        intensity={600}
        distance={180}
        color="#ffffff"
        target={spotTarget.current}
        castShadow={false}
      />

      {/* ── Main hull (capsule along Z) ───────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[2.1, 7, 6, 20]} />
        <primitive object={hullMat} attach="material" />
      </mesh>

      {/* Hull accent stripe */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[2.12, 2.12, 1.5, 24, 1, true]} />
        <primitive object={accentMat} attach="material" />
      </mesh>

      {/* ── Conning tower / Sail ─────────────────────────────────────────── */}
      <mesh position={[0, 2.6, 0.5]} castShadow>
        <boxGeometry args={[1.4, 2.2, 2.5]} />
        <primitive object={hullMat} attach="material" />
      </mesh>
      {/* Tower top rounded edge */}
      <mesh position={[0, 3.7, 0.5]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 16]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>

      {/* ── Portholes ────────────────────────────────────────────────────── */}
      {[-1.8, 0, 1.8].map((z, i) => (
        <group key={i}>
          {/* Left porthole */}
          <mesh position={[-2.12, 0.4, z]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.38, 16]} />
            <primitive object={portholeMat} attach="material" />
          </mesh>
          {/* Right porthole */}
          <mesh position={[2.12, 0.4, z]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[0.38, 16]} />
            <primitive object={portholeMat} attach="material" />
          </mesh>
        </group>
      ))}
      {/* Porthole point lights (warm glow) */}
      <pointLight position={[-2.5, 0.4, 0]} intensity={18} distance={12} color="#ffb300" />
      <pointLight position={[2.5, 0.4, 0]}  intensity={18} distance={12} color="#ffb300" />

      {/* ── Front glass dome ─────────────────────────────────────────────── */}
      <mesh position={[0, 0, -4.5]}>
        <sphereGeometry args={[1.8, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={glassMat} attach="material" />
      </mesh>
      {/* Inner dome glow */}
      <pointLight position={[0, 0, -3.5]} intensity={8} distance={6} color="#88ccff" />

      {/* ── Side hydroplane fins ─────────────────────────────────────────── */}
      <mesh position={[3.6, -0.3, 1.5]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[2.8, 0.22, 1.8]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>
      <mesh position={[-3.6, -0.3, 1.5]} rotation={[0, 0, 0.18]} castShadow>
        <boxGeometry args={[2.8, 0.22, 1.8]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>

      {/* ── Tail cross stabilizers ───────────────────────────────────────── */}
      {/* Horizontal */}
      <mesh position={[0, 0, 3.9]} castShadow>
        <boxGeometry args={[3.5, 0.22, 1.6]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>
      {/* Vertical */}
      <mesh position={[0, 1.5, 3.9]} castShadow>
        <boxGeometry args={[0.22, 2.8, 1.6]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>

      {/* ── Propeller hub ────────────────────────────────────────────────── */}
      <mesh position={[0, 0, 4.6]}>
        <cylinderGeometry args={[0.42, 0.42, 0.6, 16]} />
        <primitive object={metalMat} attach="material" />
      </mesh>
      {/* Propeller blades (spinning group) */}
      <group position={[0, 0, 4.8]} ref={propRef}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            rotation={[0, 0, (i / 4) * Math.PI * 2]}
            position={[0, 0, 0.1]}
          >
            <boxGeometry args={[0.18, 1.9, 0.45]} />
            <primitive object={propMat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* ── Sonar/sensor dome on hull underside ──────────────────────────── */}
      <mesh position={[0, -2.3, -1]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <primitive object={metalMat} attach="material" />
      </mesh>

      {/* ── Running lights ───────────────────────────────────────────────── */}
      <mesh position={[2.15, 0, -2]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={4} />
      </mesh>
      <mesh position={[-2.15, 0, -2]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={4} />
      </mesh>
      <pointLight position={[2.5, 0, -2]}  intensity={6} distance={8} color="#ff1744" />
      <pointLight position={[-2.5, 0, -2]} intensity={6} distance={8} color="#00e676" />

      {/* Bubble trail attached to propeller position */}
      <BubbleTrail speed={heroSpeedRef.current} />
    </group>
  )
}
