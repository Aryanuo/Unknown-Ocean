import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Vector3, Group, Quaternion, Euler, MathUtils,
  MeshStandardMaterial, MeshPhysicalMaterial, Color, SpotLight, Object3D,
  PointLight,
} from 'three'
import { usePlayerStore } from '../../store/usePlayerStore'

// Shared speed ref so BubbleTrail / HUD can read it without prop drilling
export const heroSpeedRef = { current: 0 }
// World-space propeller position ref for BubbleTrail emitter
export const heroPropWorldPos = { current: new Vector3() }
// Velocity direction ref for BubbleTrail trail direction
export const heroVelocityRef  = { current: new Vector3() }

// ─── Pre-allocated reusables (zero per-frame allocations) ────────────────────
const _moveDir    = new Vector3()
const _idealCamPos = new Vector3()
const _lookTarget  = new Vector3()
const _subPos     = new Vector3()
const _q          = new Quaternion()
const _euler      = new Euler()
const _forward    = new Vector3(0, 0, -1)
const _propWorld  = new Vector3()

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SPEED        = 55          // significantly faster cruise
const BOOST_MULT       = 1.75        // Shift multiplier
const ACCELERATION     = 90          // very responsive
const DAMPING          = 0.84        // per-frame (corrected below)
const TURN_SPEED       = 2.2         // rad/s – snappier turns
const PITCH_SPEED      = 1.6
const BANK_AMOUNT      = 0.42
const BANK_SMOOTH      = 7

// Third-person camera
const CAM3_OFFSET      = new Vector3(0, 10, 36)
const CAM3_SMOOTH      = 6
const CAM3_LOOKAHEAD   = 18

// First-person: position well forward of the front dome (dome is at Z=-4.5, radius ~1.8)
// Place camera at Z=-6.5 so it's in front of all hull geometry, looking forward
const CAM1_OFFSET      = new Vector3(0, 0.4, -6.5)

const FOV_BASE         = 62
const FOV_BOOST        = 16
const STORE_SYNC_DIST  = 6

export const Hero = React.memo(function Hero() {
  // Only subscribe to stable setter references — never to coords/depth
  // (Hero WRITES those, so subscribing would cause a write→re-render loop)
  const setCoords = usePlayerStore(s => s.setCoords)
  const setDepth  = usePlayerStore(s => s.setDepth)
  const initialState = useRef(usePlayerStore.getState())
  const { camera } = useThree()

  // ── Refs ──────────────────────────────────────────────────────────────────
  const groupRef   = useRef<Group>(null)
  const propRef    = useRef<Group>(null)

  // Two spotlights for left and right headlights
  const spot1Ref   = useRef<SpotLight>(null)
  const spot2Ref   = useRef<SpotLight>(null)
  const spotTarget = useRef<Object3D>(new Object3D())

  // Point light for inner glow when headlights on
  const headlightGlowRef = useRef<PointLight>(null)

  const velocity   = useRef(new Vector3())
  const subYaw     = useRef(0)
  const subPitch   = useRef(0)
  const bankAngle  = useRef(0)

  const camPos     = useRef(new Vector3(initialState.current.coords.x, -Math.max(10, initialState.current.depth), initialState.current.coords.y + 36))
  const camMode    = useRef<'third' | 'first'>('third')
  const headlights = useRef(true)

  const storePos   = useRef(new Vector3(initialState.current.coords.x, -Math.max(10, initialState.current.depth), initialState.current.coords.y))
  const keys       = useRef<Set<string>>(new Set())

  // Smooth camera pull-back accumulator
  const camPullback = useRef(0)

  // ── Input handling ────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase())
      // Camera toggle
      if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'c') {
        camMode.current = camMode.current === 'third' ? 'first' : 'third'
        document.body.classList.toggle('cockpit-active', camMode.current === 'first')
      }
      // Headlight toggle
      if (e.key.toLowerCase() === 'f') {
        headlights.current = !headlights.current
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())

    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)

    if (groupRef.current) {
      const ic = initialState.current.coords
      const id = initialState.current.depth
      groupRef.current.position.set(ic.x, -Math.max(10, id), ic.y)
    }
    if (spotTarget.current && groupRef.current) {
      groupRef.current.add(spotTarget.current)
      spotTarget.current.position.set(0, -2, -120)
    }

    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup',   up)
    }
  }, []) // eslint-disable-line

  // ── Per-frame logic ───────────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05)

    const k = keys.current

    // ── 1. Input ─────────────────────────────────────────────────────────
    const fwd   = (k.has('w') || k.has('arrowup'))    ? 1 : 0
    const back  = (k.has('s') || k.has('arrowdown'))  ? 1 : 0
    const left  = (k.has('a') || k.has('arrowleft'))  ? 1 : 0
    const right = (k.has('d') || k.has('arrowright')) ? 1 : 0

    // Ascend: Q, Descend: E
    const ascend = k.has('q') ? 1 : 0
    const descend= k.has('e') ? 1 : 0

    const boost  = (k.has('shift'))                                  ? BOOST_MULT : 1.0

    // ── 2. Heading ───────────────────────────────────────────────────────
    const turnInput  = right - left
    const pitchInput = descend - ascend

    subYaw.current   -= turnInput   * TURN_SPEED  * dt
    subPitch.current += pitchInput  * PITCH_SPEED * dt
    subPitch.current  = MathUtils.clamp(subPitch.current, -1.2, 1.2)

    // ── 3. Movement direction ────────────────────────────────────────────
    _euler.set(subPitch.current, subYaw.current, 0, 'YXZ')
    _q.setFromEuler(_euler)

    _moveDir.set(0, 0, -(fwd - back))
    _moveDir.applyQuaternion(_q)

    const maxSpd = MAX_SPEED * boost
    if (_moveDir.lengthSq() > 0) {
      velocity.current.addScaledVector(_moveDir, ACCELERATION * boost * dt)
    }

    // ── 4. Damping (frame-rate independent) ──────────────────────────────
    const frameDamp = Math.pow(DAMPING, dt * 60)
    velocity.current.multiplyScalar(frameDamp)

    const spd = velocity.current.length()
    if (spd > maxSpd) {
      velocity.current.multiplyScalar(maxSpd / spd)
    }

    // ── 5. Position ──────────────────────────────────────────────────────
    groupRef.current.position.addScaledVector(velocity.current, dt)
    _subPos.copy(groupRef.current.position)

    // Depth clamp: surface = -10, max depth = -11000
    _subPos.y = MathUtils.clamp(_subPos.y, -11000, -10)
    groupRef.current.position.y = _subPos.y

    // ── 6. Rotation (yaw + pitch + bank) ─────────────────────────────────
    const targetBank = -turnInput * BANK_AMOUNT * Math.min(spd / MAX_SPEED, 1)
    bankAngle.current = MathUtils.lerp(bankAngle.current, targetBank, BANK_SMOOTH * dt)
    _euler.set(subPitch.current, subYaw.current, bankAngle.current, 'YXZ')
    groupRef.current.quaternion.setFromEuler(_euler)

    // ── 7. Propeller spin ─────────────────────────────────────────────────
    if (propRef.current) {
      propRef.current.rotation.z += spd * dt * 5.0   // faster spin at speed
    }

    const speedFrac = MathUtils.clamp(spd / MAX_SPEED, 0, 1)
    heroSpeedRef.current = speedFrac
    heroVelocityRef.current.copy(velocity.current)

    // World-space propeller position for BubbleTrail
    _propWorld.set(0, 0, 4.8)
    _propWorld.applyQuaternion(groupRef.current.quaternion)
    _propWorld.add(_subPos)
    heroPropWorldPos.current.copy(_propWorld)

    // ── 8. Headlights ────────────────────────────────────────────────────
    const hlIntensity = headlights.current ? 1 : 0
    if (spot1Ref.current) spot1Ref.current.intensity  = MathUtils.lerp(spot1Ref.current.intensity, hlIntensity * 600, 8 * dt)
    if (spot2Ref.current) spot2Ref.current.intensity  = MathUtils.lerp(spot2Ref.current.intensity, hlIntensity * 900, 8 * dt)
    if (headlightGlowRef.current) headlightGlowRef.current.intensity = MathUtils.lerp(headlightGlowRef.current.intensity, hlIntensity * 40, 8 * dt)

    // ── 9. Camera ─────────────────────────────────────────────────────────
    if (camMode.current === 'third') {
      // Acceleration-based pull-back
      const accelFrac = MathUtils.clamp((fwd - back) * boost, 0, 1)
      camPullback.current = MathUtils.lerp(camPullback.current, accelFrac * 8, 3 * dt)
      const pullZ = CAM3_OFFSET.z + camPullback.current

      const behindX = Math.sin(subYaw.current) * pullZ
      const behindZ = Math.cos(subYaw.current) * pullZ
      _idealCamPos.set(
        _subPos.x + behindX,
        _subPos.y + CAM3_OFFSET.y + subPitch.current * -4,
        _subPos.z + behindZ
      )
      camPos.current.lerp(_idealCamPos, MathUtils.clamp(CAM3_SMOOTH * dt, 0, 1))
      camera.position.copy(camPos.current)

      _lookTarget.copy(_subPos)
      _lookTarget.x -= Math.sin(subYaw.current) * CAM3_LOOKAHEAD
      _lookTarget.y += subPitch.current * 8
      _lookTarget.z -= Math.cos(subYaw.current) * CAM3_LOOKAHEAD
      camera.lookAt(_lookTarget)

      // FOV breathing with speed
      ;(camera as any).fov = MathUtils.lerp(
        (camera as any).fov,
        FOV_BASE + speedFrac * FOV_BOOST,
        3 * dt
      )
      ;(camera as any).updateProjectionMatrix?.()

    } else {
      // First-person: camera placed FORWARD of the front dome
      _idealCamPos.copy(CAM1_OFFSET).applyQuaternion(groupRef.current.quaternion).add(_subPos)
      camera.position.lerp(_idealCamPos, Math.min(12 * dt, 1))

      // Subtle cockpit vibration at speed
      const vibAmt = speedFrac * 0.008
      camera.position.x += (Math.random() - 0.5) * vibAmt
      camera.position.y += (Math.random() - 0.5) * vibAmt

      // Look exactly forward from sub orientation
      _lookTarget.copy(_forward)
        .applyQuaternion(groupRef.current.quaternion)
        .multiplyScalar(50)
        .add(camera.position)
      camera.lookAt(_lookTarget)

      // Slightly narrower FOV in first-person
      ;(camera as any).fov = MathUtils.lerp((camera as any).fov, FOV_BASE - 4 + speedFrac * 6, 3 * dt)
      ;(camera as any).updateProjectionMatrix?.()
    }

    // ── 10. Store sync (throttled, not every frame) ───────────────────────
    const dx = Math.abs(storePos.current.x - _subPos.x)
    const dy = Math.abs(storePos.current.y - _subPos.y)
    const dz = Math.abs(storePos.current.z - _subPos.z)
    if (dx > STORE_SYNC_DIST || dy > STORE_SYNC_DIST || dz > STORE_SYNC_DIST) {
      setCoords(Math.round(_subPos.x), Math.round(_subPos.z))
      setDepth(Math.round(-_subPos.y))
      storePos.current.copy(_subPos)
    }
  })

  // ── Materials (created once) ───────────────────────────────────────────────
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
      {/* ── Dual Headlights ─────────────────────────────────────────────── */}
      {/* Wide flood cone – fills the area with cool blue-white light */}
      <spotLight
        ref={spot1Ref}
        position={[-0.8, 0.2, -4.8]}
        angle={Math.PI / 5.5}
        penumbra={0.35}
        intensity={600}
        distance={420}
        color="#b8e8ff"
        target={spotTarget.current}
        castShadow={false}
      />
      {/* Right headlight – narrower, stronger center beam */}
      <spotLight
        ref={spot2Ref}
        position={[0.8, 0.2, -4.8]}
        angle={Math.PI / 8}
        penumbra={0.18}
        intensity={900}
        distance={320}
        color="#ffffff"
        target={spotTarget.current}
        castShadow={false}
      />
      {/* Headlight glow halo just in front of the dome */}
      <pointLight
        ref={headlightGlowRef}
        position={[0, 0, -7]}
        intensity={40}
        distance={18}
        color="#88ccff"
      />

      {/* ── Main hull (capsule along Z) ────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[2.1, 7, 6, 20]} />
        <primitive object={hullMat} attach="material" />
      </mesh>

      {/* Hull accent stripe */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[2.12, 2.12, 1.5, 24, 1, true]} />
        <primitive object={accentMat} attach="material" />
      </mesh>

      {/* ── Conning tower / Sail ──────────────────────────────────────── */}
      <mesh position={[0, 2.6, 0.5]} castShadow>
        <boxGeometry args={[1.4, 2.2, 2.5]} />
        <primitive object={hullMat} attach="material" />
      </mesh>
      <mesh position={[0, 3.7, 0.5]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 16]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>

      {/* ── Portholes ─────────────────────────────────────────────────── */}
      {[-1.8, 0, 1.8].map((z, i) => (
        <group key={i}>
          <mesh position={[-2.12, 0.4, z]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.38, 16]} />
            <primitive object={portholeMat} attach="material" />
          </mesh>
          <mesh position={[2.12, 0.4, z]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[0.38, 16]} />
            <primitive object={portholeMat} attach="material" />
          </mesh>
        </group>
      ))}
      <pointLight position={[-2.5, 0.4, 0]} intensity={22} distance={14} color="#ffb300" />
      <pointLight position={[2.5, 0.4, 0]}  intensity={22} distance={14} color="#ffb300" />

      {/* ── Front glass dome ──────────────────────────────────────────── */}
      <mesh position={[0, 0, -4.5]}>
        <sphereGeometry args={[1.8, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={glassMat} attach="material" />
      </mesh>
      <pointLight position={[0, 0, -3.5]} intensity={10} distance={8} color="#88ccff" />

      {/* ── Side hydroplane fins ──────────────────────────────────────── */}
      <mesh position={[3.6, -0.3, 1.5]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[2.8, 0.22, 1.8]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>
      <mesh position={[-3.6, -0.3, 1.5]} rotation={[0, 0, 0.18]} castShadow>
        <boxGeometry args={[2.8, 0.22, 1.8]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>

      {/* ── Tail stabilizers ─────────────────────────────────────────── */}
      <mesh position={[0, 0, 3.9]} castShadow>
        <boxGeometry args={[3.5, 0.22, 1.6]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>
      <mesh position={[0, 1.5, 3.9]} castShadow>
        <boxGeometry args={[0.22, 2.8, 1.6]} />
        <primitive object={darkHullMat} attach="material" />
      </mesh>

      {/* ── Propeller hub ─────────────────────────────────────────────── */}
      <mesh position={[0, 0, 4.6]}>
        <cylinderGeometry args={[0.42, 0.42, 0.6, 16]} />
        <primitive object={metalMat} attach="material" />
      </mesh>
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

      {/* ── Sonar dome ────────────────────────────────────────────────── */}
      <mesh position={[0, -2.3, -1]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <primitive object={metalMat} attach="material" />
      </mesh>

      {/* ── Running lights ────────────────────────────────────────────── */}
      <mesh position={[2.15, 0, -2]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={4} />
      </mesh>
      <mesh position={[-2.15, 0, -2]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={4} />
      </mesh>
      <pointLight position={[2.5, 0, -2]}  intensity={8} distance={10} color="#ff1744" />
      <pointLight position={[-2.5, 0, -2]} intensity={8} distance={10} color="#00e676" />

      {/* BubbleTrail is now rendered outside the group (world space) via OceanScene */}
    </group>
  )
})
