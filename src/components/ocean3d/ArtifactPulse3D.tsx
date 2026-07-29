import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, RingGeometry, MeshBasicMaterial, Color, AdditiveBlending, DoubleSide } from 'three'
import { useArtifactScannerStore } from '../../store/useArtifactScannerStore'
import { heroSubWorldPos } from './Hero'

export const ArtifactPulse3D = React.memo(function ArtifactPulse3D() {
  const meshRef = useRef<Mesh>(null)
  const isScanning = useArtifactScannerStore((s) => s.isScanning)
  const scanPulseRadius = useArtifactScannerStore((s) => s.scanPulseRadius)
  const startTime = useRef(0)

  const geo = useMemo(() => new RingGeometry(1, 1.08, 64), [])
  const mat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#ffd60a'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [])

  useFrame((state) => {
    if (!meshRef.current) return

    if (isScanning) {
      if (startTime.current === 0) startTime.current = state.clock.elapsedTime
      const age = state.clock.elapsedTime - startTime.current
      const duration = 1.8
      const progress = Math.min(1, age / duration)

      const radius = Math.max(1, progress * (scanPulseRadius || 300))
      meshRef.current.position.copy(heroSubWorldPos.current)
      meshRef.current.scale.setScalar(radius)

      // Fade out as it expands
      mat.opacity = (1 - progress) * 0.65
      mat.color.setStyle(progress < 0.5 ? '#ffd60a' : '#00f5d4')
      meshRef.current.visible = true
    } else {
      startTime.current = 0
      mat.opacity = 0
      meshRef.current.visible = false
    }
  })

  return (
    <mesh ref={meshRef} geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} />
  )
})
