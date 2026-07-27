/**
 * EventObject3D.tsx — World objects spawned by daily ocean events
 *
 * Handles: portal (Abyss Portal), crater (Meteor Impact), temple (Temple Awakening)
 * Each is a distinctive 3D structure with animated shaders, point lights, and optional RP rewards.
 */
import React, { useRef, useMemo, useCallback } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import {
  Group, Mesh, ShaderMaterial, Color, AdditiveBlending, DoubleSide,
  MeshStandardMaterial, MeshBasicMaterial, Vector3,
} from 'three'
import { heroSubWorldPos } from './Hero'
import { registerCreature, unregisterCreature } from '../../engine/creatureRegistry'

export type EventObjectType = 'portal' | 'crater' | 'temple'

interface EventObjectProps {
  type: EventObjectType
  onInteract?: (rpReward: number) => void
}

// ── Portal warp shader ───────────────────────────────────────────────────────
const portalVert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const portalFrag = /* glsl */`
  uniform float uTime;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // Spiral warp
    float spiral = sin(r * 12.0 - uTime * 3.5 + angle * 4.0) * 0.5 + 0.5;
    float ring   = smoothstep(0.88, 0.9, r) * smoothstep(1.02, 1.0, r);
    float glow   = (1.0 - r) * spiral;

    vec3 col = mix(uColorA, uColorB, glow);
    float alpha = clamp(glow * 1.4 + ring, 0.0, 1.0) * (1.0 - smoothstep(0.92, 1.0, r));
    gl_FragColor = vec4(col, alpha * 0.85);
  }
`

// ── Lava crack shader (crater) ───────────────────────────────────────────────
const craterFrag = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.4;
    float n = noise(uv * 5.0 + t) * 0.6 + noise(uv * 12.0 - t * 0.7) * 0.4;
    float crack = smoothstep(0.55, 0.65, n);
    float edge  = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)
                * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
    vec3 lava = mix(uColor * 0.5, uColor * 2.0, crack);
    gl_FragColor = vec4(lava, crack * edge * 0.9);
  }
`

export const EventObject3D = React.memo(function EventObject3D({ type, onInteract }: EventObjectProps) {
  const groupRef = useRef<Group>(null)
  const ringRef  = useRef<Mesh>(null)
  const innerRef = useRef<Mesh>(null)

  // Spawn at a fixed location near where the player starts this session
  const spawnPos = useMemo(() => {
    const sub = heroSubWorldPos.current
    const offsets: Record<EventObjectType, [number, number, number]> = {
      portal:  [sub.x + 180, Math.min(-200, sub.y - 150), sub.z - 180],
      crater:  [sub.x - 120, Math.min(-70, sub.y - 60),   sub.z + 140],
      temple:  [sub.x + 120, Math.min(-150, sub.y - 120), sub.z + 120],
    }
    return new Vector3(...offsets[type])
  }, [type])

  // Register on Sonar (so it appears as a Mythical blip on ping)
  const eventId = useMemo(() => 990000 + (type === 'portal' ? 1 : type === 'crater' ? 2 : 3), [type])
  React.useEffect(() => {
    registerCreature(eventId, spawnPos, new Vector3(), 'stationary', 5, 'object', 0, 'mythical')
    return () => unregisterCreature(eventId)
  }, [eventId, spawnPos])

  // ── Portal materials ─────────────────────────────────────────────────────
  const portalMat = useMemo(() => {
    if (type !== 'portal') return null
    return new ShaderMaterial({
      vertexShader: portalVert,
      fragmentShader: portalFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime:   { value: 0 },
        uColorA: { value: new Color('#7b2fbe') },
        uColorB: { value: new Color('#00e5ff') },
      },
    })
  }, [type])

  // ── Crater floor shader ──────────────────────────────────────────────────
  const craterMat = useMemo(() => {
    if (type !== 'crater') return null
    return new ShaderMaterial({
      vertexShader: portalVert, // same simple vert
      fragmentShader: craterFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: new Color('#ff4d00') },
      },
    })
  }, [type])

  // ── Temple/stone shared mat ──────────────────────────────────────────────
  const stoneMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#2d2d44'),
    roughness: 0.8,
    metalness: 0.1,
    emissive: new Color('#ffd60a'),
    emissiveIntensity: type === 'temple' ? 0.6 : 0.0,
  }), [type])

  const glowMat = useMemo(() => new MeshBasicMaterial({
    color: new Color(
      type === 'portal'  ? '#7b2fbe' :
      type === 'crater'  ? '#ff6b2b' :
      '#ffd60a'
    ),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
    depthWrite: false,
  }), [type])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime

    // Portal: slow Y-axis spin + shader time
    if (type === 'portal') {
      groupRef.current.rotation.y = t * 0.3
      if (portalMat) portalMat.uniforms.uTime.value = t
      if (innerRef.current) {
        innerRef.current.rotation.z = -t * 0.8
        innerRef.current.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08)
      }
    }

    // Crater: pulsing glow on the lava cracks
    if (type === 'crater') {
      if (craterMat) craterMat.uniforms.uTime.value = t
      if (innerRef.current) {
        const pulse = 1 + Math.sin(t * 1.8) * 0.05
        innerRef.current.scale.setScalar(pulse)
      }
    }

    // Temple: pillars gentle light pulse
    if (type === 'temple') {
      const pulse = 0.4 + 0.4 * Math.sin(t * 0.8)
      stoneMat.emissiveIntensity = pulse
      groupRef.current.rotation.y = Math.sin(t * 0.1) * 0.05
    }

    // Floating ring
    if (ringRef.current) {
      ringRef.current.lookAt(state.camera.position)
      glowMat.opacity = 0.3 + 0.3 * Math.sin(t * 2.5)
    }
  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const rewards: Record<EventObjectType, number> = { portal: 800, crater: 600, temple: 1000 }
    onInteract?.(rewards[type])
  }, [type, onInteract])

  const lightColor = type === 'portal' ? '#7b2fbe' : type === 'crater' ? '#ff4d00' : '#ffd60a'
  const lightIntensity = type === 'portal' ? 120 : type === 'crater' ? 100 : 80

  return (
    <group ref={groupRef} position={spawnPos.toArray()} onClick={handleClick}>

      {/* ── PORTAL ───────────────────────────────────────────────────────── */}
      {type === 'portal' && (
        <>
          {/* Outer ring arch */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[28, 2.5, 16, 64]} />
            <primitive object={stoneMat} attach="material" />
          </mesh>
          {/* Inner warp disk */}
          <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[25, 64]} />
            {portalMat && <primitive object={portalMat} attach="material" />}
          </mesh>
          {/* Floating rune stones */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(angle) * 32, Math.sin(angle * 0.5) * 4, Math.sin(angle) * 32]}>
                <boxGeometry args={[3, 5, 1.5]} />
                <primitive object={stoneMat} attach="material" />
              </mesh>
            )
          })}
        </>
      )}

      {/* ── CRATER ───────────────────────────────────────────────────────── */}
      {type === 'crater' && (
        <>
          {/* Crater rim ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[38, 48, 32]} />
            <primitive object={stoneMat} attach="material" />
          </mesh>
          {/* Lava floor disk */}
          <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
            <circleGeometry args={[38, 48]} />
            {craterMat && <primitive object={craterMat} attach="material" />}
          </mesh>
          {/* Meteor impact fragments */}
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * Math.PI * 2
            const r = 20 + (i * 7 % 18)
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * r, 4 + i * 2, Math.sin(angle) * r]}
                rotation={[i * 0.5, angle, i * 0.3]}
              >
                <dodecahedronGeometry args={[3 + i * 0.8, 0]} />
                <primitive object={stoneMat} attach="material" />
              </mesh>
            )
          })}
          {/* Central glowing core */}
          <mesh position={[0, -2, 0]}>
            <sphereGeometry args={[8, 16, 16]} />
            <primitive object={glowMat} attach="material" />
          </mesh>
        </>
      )}

      {/* ── TEMPLE ───────────────────────────────────────────────────────── */}
      {type === 'temple' && (
        <>
          {/* Central obelisk */}
          <mesh position={[0, 20, 0]}>
            <cylinderGeometry args={[1.5, 4, 40, 8]} />
            <primitive object={stoneMat} attach="material" />
          </mesh>
          {/* Obelisk top cap */}
          <mesh position={[0, 42, 0]}>
            <coneGeometry args={[4, 8, 8]} />
            <primitive object={glowMat} attach="material" />
          </mesh>
          {/* Surrounding pillars */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(angle) * 30, 10, Math.sin(angle) * 30]}>
                <cylinderGeometry args={[1.2, 1.8, 22, 8]} />
                <primitive object={stoneMat} attach="material" />
              </mesh>
            )
          })}
          {/* Temple base platform */}
          <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0, 40, 32]} />
            <primitive object={stoneMat} attach="material" />
          </mesh>
          {/* Glowing altar */}
          <mesh position={[0, 4, 0]}>
            <boxGeometry args={[8, 3, 8]} />
            <primitive object={glowMat} attach="material" />
          </mesh>
        </>
      )}

      {/* ── Shared: glow ring indicator ──────────────────────────────────── */}
      <mesh ref={ringRef}>
        <ringGeometry args={[55, 60, 48]} />
        <primitive object={glowMat} attach="material" />
      </mesh>

      {/* Point light */}
      <pointLight color={lightColor} intensity={lightIntensity} distance={400} decay={2} />
    </group>
  )
})
