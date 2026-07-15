import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  InstancedMesh, Object3D, SphereGeometry, MeshBasicMaterial,
  Color, AdditiveBlending, MathUtils, Vector3,
} from 'three'
import { heroSpeedRef, heroPropWorldPos, heroVelocityRef } from './Hero'

// ── Pre-allocated dummy object for instancing ────────────────────────────────
const _dummy  = new Object3D()
const _emitPos = new Vector3()

// ─────────────────────────────────────────────────────────────────────────────
// Bubbles live entirely in WORLD space so they are left behind as the sub moves.
// They are NOT children of the submarine group.
// ─────────────────────────────────────────────────────────────────────────────
const BUBBLE_COUNT = 80  // more bubbles for richer trail

interface BubbleData {
  wx: number; wy: number; wz: number   // world-space position
  age: number; lifetime: number
  driftX: number; driftY: number; driftZ: number
  scale: number
  active: boolean
}

export const BubbleTrail = React.memo(function BubbleTrail() {
  const meshRef  = useRef<InstancedMesh>(null)
  const emitAcc  = useRef(0)
  // Emit multiple bubbles per interval for richer trail
  const burstAcc = useRef(0)

  const bubbleData = useMemo<BubbleData[]>(() =>
    Array.from({ length: BUBBLE_COUNT }, () => ({
      wx: 0, wy: 0, wz: 0,
      age: Math.random() * 3,
      lifetime: 1.5 + Math.random() * 2.5,
      driftX:  (Math.random() - 0.5) * 0.6,
      driftY:   0.8 + Math.random() * 2.2,  // bubbles rise in world space
      driftZ:  (Math.random() - 0.5) * 0.6,
      scale:   0.06 + Math.random() * 0.22,
      active:  false,
    })), [])

  const geo = useMemo(() => new SphereGeometry(1, 5, 5), [])
  const mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#c8f8ff'),
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    const speed = heroSpeedRef.current
    const propPos = heroPropWorldPos.current
    const vel = heroVelocityRef.current

    // ── Emission ─────────────────────────────────────────────────────────────
    // Faster sub → more frequent emission; minimum interval at max speed ~0.02s
    const emitInterval = MathUtils.lerp(0.35, 0.02, speed)
    emitAcc.current += delta

    if (emitAcc.current > emitInterval && speed > 0.02) {
      emitAcc.current = 0
      // Emit 1–4 bubbles per burst depending on speed
      const burstCount = Math.max(1, Math.floor(speed * 4))
      let emitted = 0

      for (let i = 0; i < BUBBLE_COUNT && emitted < burstCount; i++) {
        const b = bubbleData[i]
        if (!b.active) {
          b.active   = true
          b.age      = 0
          b.lifetime = 1.5 + Math.random() * 2.5

          // Emit at world-space propeller + random spread
          _emitPos.copy(propPos)
          b.wx = _emitPos.x + (Math.random() - 0.5) * 1.4
          b.wy = _emitPos.y + (Math.random() - 0.5) * 1.0
          b.wz = _emitPos.z + (Math.random() - 0.5) * 1.4

          // Base drift is mostly upward; also carry some opposite velocity
          b.driftX = (Math.random() - 0.5) * 0.8 - vel.x * 0.04
          b.driftY =  0.8 + Math.random() * 2.0
          b.driftZ = (Math.random() - 0.5) * 0.8 - vel.z * 0.04
          b.scale  = (0.06 + Math.random() * 0.22) * (1 + speed * 0.5)
          emitted++
        }
      }
    }

    // ── Update all bubbles ────────────────────────────────────────────────────
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const b = bubbleData[i]
      if (!b.active) {
        _dummy.scale.setScalar(0)
        _dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, _dummy.matrix)
        continue
      }

      b.age += delta
      if (b.age > b.lifetime) {
        b.active = false
        _dummy.scale.setScalar(0)
        _dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, _dummy.matrix)
        continue
      }

      const life = b.age / b.lifetime

      // Move in world space (independent of submarine position)
      b.wx += b.driftX * delta
      b.wy += b.driftY * delta
      b.wz += b.driftZ * delta

      // Bubbles expand and fade toward end of life
      const s = b.scale * (1 + life * 0.6)
      _dummy.position.set(b.wx, b.wy, b.wz)
      _dummy.scale.setScalar(s)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true

    // Fade opacity with speed
    mat.opacity = MathUtils.lerp(0.25, 0.75, speed)
  })

  return (
    // frustumCulled=false so we never miss bubbles near camera edge
    <instancedMesh ref={meshRef} args={[geo, mat, BUBBLE_COUNT]} frustumCulled={false} />
  )
})
