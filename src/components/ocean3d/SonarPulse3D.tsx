import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, RingGeometry, MeshBasicMaterial, AdditiveBlending, Vector3, DoubleSide } from 'three'
import { useSonarStore } from '../../store/useSonarStore'
import { heroSubWorldPos } from './Hero'

export const SonarPulse3D = React.memo(function SonarPulse3D() {
  const ringRef = useRef<Mesh>(null)
  const matRef  = useRef<MeshBasicMaterial>(null)
  const isPinging = useSonarStore((s) => s.isPinging)
  const pingStart = useRef(0)
  const pulsePos  = useRef(new Vector3())

  useFrame((state, delta) => {
    if (!ringRef.current || !matRef.current) return

    if (isPinging && pingStart.current === 0) {
      pingStart.current = state.clock.elapsedTime
      pulsePos.current.copy(heroSubWorldPos.current)
      ringRef.current.position.copy(pulsePos.current)
      ringRef.current.visible = true
    }

    if (ringRef.current.visible && pingStart.current > 0) {
      const elapsed = state.clock.elapsedTime - pingStart.current
      const duration = 2.0 // 2 seconds expansion

      if (elapsed > duration) {
        ringRef.current.visible = false
        pingStart.current = 0
      } else {
        const progress = elapsed / duration
        const scale = 1 + progress * 220 // Expands up to ~220 units
        ringRef.current.scale.set(scale, scale, scale)
        ringRef.current.rotation.x = Math.PI / 2 // Horizontal ring
        matRef.current.opacity = (1 - progress) * 0.45
      }
    }
  })

  return (
    <mesh ref={ringRef} visible={false}>
      <ringGeometry args={[1, 1.3, 64]} />
      <meshBasicMaterial
        ref={matRef}
        color="#00e5ff"
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={AdditiveBlending}
        side={DoubleSide}
      />
    </mesh>
  )
})
