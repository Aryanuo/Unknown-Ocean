import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  InstancedMesh, Object3D, SphereGeometry, MeshBasicMaterial,
  Color, AdditiveBlending, MathUtils
} from 'three'

const _dummy  = new Object3D()
const BUBBLE_COUNT = 40

interface BubbleTrailProps {
  speed: number // 0–1 normalised speed
}

export function BubbleTrail({ speed }: BubbleTrailProps) {
  const meshRef = useRef<InstancedMesh>(null)

  const bubbleData = useMemo(() => Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
    // Local offset relative to sub (emitted behind propeller)
    x: (Math.random() - 0.5) * 1.2,
    y: (Math.random() - 0.5) * 0.8,
    z: 0,                                    // will be set at "birth"
    age:      Math.random() * 3,              // stagger initial ages
    lifetime: 1.8 + Math.random() * 2.2,
    driftX:   (Math.random() - 0.5) * 0.9,
    driftY:   1.2 + Math.random() * 2.4,     // rise speed
    driftZ:   0.4 + Math.random() * 1.8,     // trail behind sub
    scale:    0.08 + Math.random() * 0.28,
    active:   false,
  })), [])

  // Cumulative time between emissions
  const emitAcc = useRef(0)

  const geo = useMemo(() => new SphereGeometry(1, 4, 4), [])
  const mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#c8f0ff'),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    const emitInterval = MathUtils.lerp(0.8, 0.05, speed) // fast at high speed
    emitAcc.current += delta

    // Emit new bubbles
    if (emitAcc.current > emitInterval && speed > 0.05) {
      emitAcc.current = 0
      // Find an inactive bubble
      const b = bubbleData.find(b => !b.active)
      if (b) {
        b.active = true
        b.age    = 0
        b.x      = (Math.random() - 0.5) * 1.2
        b.y      = (Math.random() - 0.5) * 0.8
        b.z      = 4.5 // propeller position (local Z)
      }
    }

    // Update all bubbles
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const b = bubbleData[i]
      if (!b.active) {
        _dummy.scale.setScalar(0)
        _dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, _dummy.matrix)
        continue
      }

      b.age += delta
      if (b.age > b.lifetime) { b.active = false; continue }

      const life = b.age / b.lifetime
      b.x += b.driftX * delta * 0.2
      b.y += b.driftY * delta
      b.z += b.driftZ * delta

      const s = b.scale * (1 + life * 0.5) // bubbles expand slightly
      _dummy.position.set(b.x, b.y, b.z)
      _dummy.scale.setScalar(s)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    // Fade opacity with speed
    mat.opacity = 0.3 + speed * 0.45
  })

  return (
    <instancedMesh ref={meshRef} args={[geo, mat, BUBBLE_COUNT]} frustumCulled={false} />
  )
}
