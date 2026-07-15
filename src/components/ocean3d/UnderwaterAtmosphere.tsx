import React, { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  InstancedMesh, Object3D, MeshBasicMaterial, SphereGeometry,
  AdditiveBlending, Color, PlaneGeometry, ShaderMaterial, Vector3,
  MathUtils, BufferGeometry, BufferAttribute, Points, PointsMaterial
} from 'three'

// ── Pre-allocated scratch object ─────────────────────────────────────────────
const _dummy  = new Object3D()
const _camPos = new Vector3()

// ═════════════════════════════════════════════════════════════════════════════
// God Ray shader (additive vertical shafts that scroll slowly)
// ═════════════════════════════════════════════════════════════════════════════
const godRayVert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const godRayFrag = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uAlpha;
  varying vec2 vUv;

  void main() {
    // Fade on top and bottom edges, strong center
    float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    float side = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    // Animated shimmer along the ray length
    float wave = 0.6 + 0.4 * sin(vUv.y * 18.0 + uTime * 0.9);
    float alpha = edge * side * wave * uAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Caustic pattern shader (on a thin horizontal plane just above seabed)
// ═════════════════════════════════════════════════════════════════════════════
const causticVert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const causticFrag = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2 vUv;

  // Approximated caustic via 3 overlapping animated interference rings
  float causticRing(vec2 p, float t, float freq) {
    float r = length(p);
    return pow(max(0.0, sin(r * freq - t * 1.8) * 0.5 + 0.5), 3.0);
  }

  void main() {
    vec2 uv = vUv * 6.0;
    float t  = uTime * 0.5;

    vec2 c1 = uv + vec2(sin(t * 0.4) * 0.8, cos(t * 0.3) * 0.8);
    vec2 c2 = uv + vec2(cos(t * 0.5) * 0.6, sin(t * 0.6) * 0.6);
    vec2 c3 = uv - vec2(sin(t * 0.3 + 1.0) * 0.7, cos(t * 0.4 + 0.5) * 0.7);

    float pattern =
      causticRing(c1, t, 8.0) * 0.5 +
      causticRing(c2, t, 6.0) * 0.3 +
      causticRing(c3, t, 9.0) * 0.2;

    gl_FragColor = vec4(uColor * pattern, pattern * 0.55);
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════
const PARTICLE_COUNT = 220
const RAY_COUNT      = 8



export const UnderwaterAtmosphere = React.memo(function UnderwaterAtmosphere() {
  const { camera } = useThree()

  // ── Particle instanced mesh ──────────────────────────────────────────────
  const particleRef = useRef<InstancedMesh>(null)
  const particleData = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      // Random sphere around origin — will be repositioned relative to camera
      ox: (Math.random() - 0.5) * 280,
      oy: (Math.random() - 0.5) * 120,
      oz: (Math.random() - 0.5) * 280,
      driftY:  0.4 + Math.random() * 1.8,   // upward drift speed
      driftX:  (Math.random() - 0.5) * 0.5,
      driftZ:  (Math.random() - 0.5) * 0.5,
      scale:   0.06 + Math.random() * 0.22,
      phase:   Math.random() * Math.PI * 2,
    }))
  }, [])

  const particleMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#90e0ef'),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  const particleGeo = useMemo(() => new SphereGeometry(1, 4, 4), [])

  // ── God ray materials (one per ray, each with own time uniform) ───────────
  const rayMats = useMemo(() => {
    return Array.from({ length: RAY_COUNT }, (_, i) => new ShaderMaterial({
      vertexShader:   godRayVert,
      fragmentShader: godRayFrag,
      transparent:    true,
      depthWrite:     false,
      blending:       AdditiveBlending,
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: new Color(i % 2 === 0 ? '#a8e0ff' : '#48cae4') },
        uAlpha: { value: 0.0 }, // will be set in useFrame based on depth
      },
    }))
  }, [])

  const rayGeo = useMemo(() => new PlaneGeometry(1, 1), [])

  // Stable positions for rays (offsets around camera)
  const rayOffsets = useMemo(() =>
    Array.from({ length: RAY_COUNT }, (_, i) => {
      const angle = (i / RAY_COUNT) * Math.PI * 2 + i * 0.4
      const radius = 18 + (i % 3) * 12
      return {
        angle,
        radius,
        width:  2.5 + (i % 3) * 1.5,
        height: 55  + (i % 4) * 20,
        sway:   (i % 2 === 0 ? 1 : -1) * (0.3 + (i % 3) * 0.15),
        // Stable deterministic position offsets (was Math.random() — caused god rays to jump on re-render)
        posX: Math.cos(angle) * radius + (((i * 7 + 3) % 10) / 10 - 0.5) * 5,
        posZ: Math.sin(angle) * radius + (((i * 13 + 7) % 10) / 10 - 0.5) * 5,
      }
    }),
  [])

  // ── Caustic material ──────────────────────────────────────────────────────
  const causticMat = useMemo(() => new ShaderMaterial({
    vertexShader:   causticVert,
    fragmentShader: causticFrag,
    transparent:    true,
    depthWrite:     false,
    blending:       AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new Color('#48cae4') },
    },
  }), [])

  const causticGeo = useMemo(() => new PlaneGeometry(600, 600), [])

  // ── Bioluminescent particles (deep only) ──────────────────────────────────
  const bioRef = useRef<Points>(null)
  const bioGeo = useMemo(() => {
    const count = 120
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 340
      positions[i * 3 + 1] = (Math.random() - 0.5) * 140
      positions[i * 3 + 2] = (Math.random() - 0.5) * 340
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    return geo
  }, [])
  const bioMat = useMemo(() => new PointsMaterial({
    color: new Color('#00e5ff'),
    size: 1.2,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), [])

  // ── Frame update ─────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const t   = state.clock.elapsedTime
    _camPos.copy(camera.position)
    const currentDepth = Math.abs(_camPos.y) // depth in units = metres

    // ── Particles: orbit camera ──────────────────────────────────────────
    if (particleRef.current) {
      const halfX = 140, halfY = 60, halfZ = 140
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pd = particleData[i]
        // Drift upward, wrap when too far above camera
        pd.oy += pd.driftY * delta
        pd.ox += pd.driftX * delta
        pd.oz += pd.driftZ * delta

        // Wrap relative to camera
        let wx = _camPos.x + pd.ox
        let wy = _camPos.y + pd.oy
        let wz = _camPos.z + pd.oz

        if (pd.oy > halfY)  { pd.oy -= 120; wy = _camPos.y + pd.oy }
        if (pd.oy < -halfY) { pd.oy += 120; wy = _camPos.y + pd.oy }
        if (Math.abs(pd.ox) > halfX) { pd.ox = (Math.random() - 0.5) * halfX * 2; wx = _camPos.x + pd.ox }
        if (Math.abs(pd.oz) > halfZ) { pd.oz = (Math.random() - 0.5) * halfZ * 2; wz = _camPos.z + pd.oz }

        const s = pd.scale * (0.85 + 0.15 * Math.sin(t * 1.5 + pd.phase))
        _dummy.position.set(wx, wy, wz)
        _dummy.scale.setScalar(s)
        _dummy.updateMatrix()
        particleRef.current.setMatrixAt(i, _dummy.matrix)
      }
      particleRef.current.instanceMatrix.needsUpdate = true

      // Opacity depends on depth (less visible in surface waters, richer deeper)
      particleMat.opacity = MathUtils.lerp(0.3, 0.7, MathUtils.smoothstep(currentDepth, 50, 500))
    }

    // ── God rays (only visible at shallow-mid depth, near surface light) ──
    const rayAlpha = MathUtils.clamp(1.0 - currentDepth / 250, 0, 0.35)
    for (let i = 0; i < RAY_COUNT; i++) {
      const ro = rayOffsets[i]
      const mat = rayMats[i]
      mat.uniforms.uTime.value  = t
      mat.uniforms.uAlpha.value = rayAlpha
    }

    // ── Caustics: positioned on seabed plane ──────────────────────────────
    causticMat.uniforms.uTime.value = t
    // Caustics more visible in shallow water
    const causticAlpha = MathUtils.clamp(1.0 - currentDepth / 300, 0, 1)
    causticMat.uniforms.uColor.value.setStyle(
      currentDepth < 100 ? '#6cd4ff' : '#2196f3'
    )
    causticMat.opacity = causticAlpha // ignored by shader but can guard

    // ── Bioluminescence: only deep ────────────────────────────────────────
    if (bioRef.current) {
      const bioOpacity = MathUtils.smoothstep(currentDepth, 300, 800) * 0.8
      bioMat.opacity = MathUtils.lerp(bioMat.opacity, bioOpacity, 3 * delta)
      // Gentle pulsing
      bioMat.size = 0.9 + 0.5 * Math.sin(t * 0.7)
      // Follow camera
      bioRef.current.position.copy(_camPos)
    }
  })

  return (
    <>
      {/* ── Floating particles ──────────────────────────────────────────── */}
      <instancedMesh
        ref={particleRef}
        args={[particleGeo, particleMat, PARTICLE_COUNT]}
        frustumCulled={false}
      />

      {/* ── God rays (additive planes near surface) ─────────────────────── */}
      {rayOffsets.map((ro, i) => (
        <mesh
          key={`ray-${i}`}
          frustumCulled={false}
          position={[ro.posX, 30, ro.posZ]}
          rotation={[0, ro.angle + Math.PI / 2, ro.sway]}
          scale={[ro.width, ro.height, 1]}
        >
          <primitive object={rayGeo} attach="geometry" />
          <primitive object={rayMats[i]} attach="material" />
        </mesh>
      ))}

      {/* ── Caustic overlay plane (sits just above dynamic terrain floor) ── */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -5, 0]}
        frustumCulled={false}
      >
        <primitive object={causticGeo} attach="geometry" />
        <primitive object={causticMat} attach="material" />
      </mesh>

      {/* ── Bioluminescent deep particles ───────────────────────────────── */}
      <points ref={bioRef} frustumCulled={false}>
        <primitive object={bioGeo} attach="geometry" />
        <primitive object={bioMat} attach="material" />
      </points>
    </>
  )
})
