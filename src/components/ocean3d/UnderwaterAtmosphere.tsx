import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  InstancedMesh, Object3D, MeshBasicMaterial, SphereGeometry,
  AdditiveBlending, Color, PlaneGeometry, ShaderMaterial, Vector3,
  MathUtils, BufferGeometry, BufferAttribute, Points, PointsMaterial,
} from 'three'
import { useWorldStore } from '../../store/useWorldStore'
import { BiomeType } from '../../engine/procedural/biomeGenerator'

// ── Pre-allocated scratch objects ─────────────────────────────────────────────
const _dummy       = new Object3D()
const _camPos      = new Vector3()
const _targetColor = new Color()   // reused for lerp — avoids per-frame `new Color()`

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
    float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    float side = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float wave = 0.6 + 0.4 * sin(vUv.y * 18.0 + uTime * 0.9);
    float alpha = edge * side * wave * uAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Caustic pattern shader
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
// Constants
// ═════════════════════════════════════════════════════════════════════════════
const PARTICLE_COUNT  = 200   // reduced from 220
const RAY_COUNT       = 8
const JELLYFISH_COUNT = 60
const ECLIPSE_COUNT   = 180
const MICRO_COUNT     = 300   // reduced from 400

// Per-biome particle palette
const BIOME_PARTICLE_COLORS: Record<BiomeType, string> = {
  coral:        '#90e0ef',
  kelp:         '#74c69d',
  crystal:      '#e0aaff',
  abyss:        '#0077b6',
  frozen:       '#caf0f8',
  hydrothermal: '#ff6b35',
  ruins:        '#ffc300',
  open:         '#48cae4',
}

interface AtmosphereProps {
  biome?: BiomeType
}

export const UnderwaterAtmosphere = React.memo(function UnderwaterAtmosphere({ biome = 'open' }: AtmosphereProps) {
  const { camera } = useThree()
  const dailyEvent = useWorldStore((s) => s.dailyEvent)
  const eventType  = dailyEvent?.type
  const effect     = dailyEvent?.worldEffect

  // ── Particle instanced mesh ──────────────────────────────────────────────
  const particleRef = useRef<InstancedMesh>(null)
  const particleData = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      ox: (Math.random() - 0.5) * 280,
      oy: (Math.random() - 0.5) * 120,
      oz: (Math.random() - 0.5) * 280,
      driftY:  0.4 + Math.random() * 1.8,
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

  // ── Bloom event: jellyfish swarm ─────────────────────────────────────────
  const jellyRef  = useRef<InstancedMesh>(null)
  const jellyData = useMemo(() => Array.from({ length: JELLYFISH_COUNT }, () => ({
    ox: (Math.random() - 0.5) * 320,
    oy: (Math.random() - 0.5) * 140,
    oz: (Math.random() - 0.5) * 320,
    driftY:  0.15 + Math.random() * 0.6,
    phase:   Math.random() * Math.PI * 2,
    speed:   0.5 + Math.random() * 1.2,
    radius:  1.5 + Math.random() * 2.5,
  })), [])

  const jellyGeo = useMemo(() => new SphereGeometry(1, 8, 5), [])
  const jellyMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00ffff'),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  // ── Eclipse event: dark veil particles ───────────────────────────────────
  const eclipseRef  = useRef<InstancedMesh>(null)
  const eclipseData = useMemo(() => Array.from({ length: ECLIPSE_COUNT }, () => ({
    ox: (Math.random() - 0.5) * 350,
    oy: (Math.random() - 0.5) * 160,
    oz: (Math.random() - 0.5) * 350,
    driftY: -(0.1 + Math.random() * 0.4),
    phase:   Math.random() * Math.PI * 2,
    scale:   0.3 + Math.random() * 1.2,
  })), [])

  const eclipseGeo = useMemo(() => new SphereGeometry(1, 4, 4), [])
  const eclipseMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#b5179e'),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  // ── God ray materials ─────────────────────────────────────────────────────
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
        uAlpha: { value: 0.0 },
      },
    }))
  }, [])

  const rayGeo = useMemo(() => new PlaneGeometry(1, 1), [])

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

  // ── Micro-organism layer ──────────────────────────────────────────────────
  const microRef = useRef<Points>(null)
  const microGeo = useMemo(() => {
    const positions = new Float32Array(MICRO_COUNT * 3)
    for (let i = 0; i < MICRO_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 80
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    return geo
  }, [])
  const microMat = useMemo(() => new PointsMaterial({
    color: new Color('#90e0ef'),
    size: 0.18,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), [])

  // ── Dispose all GPU resources on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      particleGeo.dispose()
      particleMat.dispose()
      jellyGeo.dispose()
      jellyMat.dispose()
      eclipseGeo.dispose()
      eclipseMat.dispose()
      rayGeo.dispose()
      rayMats.forEach(m => m.dispose())
      causticGeo.dispose()
      causticMat.dispose()
      bioGeo.dispose()
      bioMat.dispose()
      microGeo.dispose()
      microMat.dispose()
    }
  }, []) // eslint-disable-line

  // ── Frame update ─────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const t   = state.clock.elapsedTime
    _camPos.copy(camera.position)
    const currentDepth = Math.abs(_camPos.y)
    const isBloom   = eventType === 'bloom'
    const isEclipse = eventType === 'eclipse'

    // ── Particles: orbit camera ──────────────────────────────────────────
    if (particleRef.current) {
      const halfX = 140, halfY = 60, halfZ = 140
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pd = particleData[i]
        pd.oy += pd.driftY * delta
        pd.ox += pd.driftX * delta
        pd.oz += pd.driftZ * delta

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

      const glowMult = effect?.glowMultiplier ?? 1.0
      particleMat.opacity = MathUtils.lerp(0.3, 0.7, MathUtils.smoothstep(currentDepth, 50, 500)) * Math.min(1.5, glowMult)

      // Dynamic particle color — reuse scratch Color to avoid allocation
      if (effect?.particleColor) {
        _targetColor.setStyle(effect.particleColor)
        particleMat.color.lerp(_targetColor, 0.05)
      } else {
        const biomeParticleColor = BIOME_PARTICLE_COLORS[biome] ?? '#90e0ef'
        _targetColor.setStyle(biomeParticleColor)
        particleMat.color.lerp(_targetColor, 0.03)
      }
    }

    // ── Bloom jellyfish swarm — only update matrices when active ─────────
    if (jellyRef.current) {
      const targetOpacity = isBloom ? 0.55 : 0.0
      jellyMat.opacity = MathUtils.lerp(jellyMat.opacity, targetOpacity, 2 * delta)

      // Skip per-instance updates when invisible — major perf win
      if (jellyMat.opacity > 0.01) {
        if (isBloom) {
          jellyMat.color.lerp(
            0.5 + 0.5 * Math.sin(t * 0.5) > 0.5
              ? _targetColor.setStyle('#00ffff')
              : _targetColor.setStyle('#ffd60a'),
            0.04,
          )
        }
        for (let i = 0; i < JELLYFISH_COUNT; i++) {
          const jd = jellyData[i]
          jd.oy += jd.driftY * delta * (isBloom ? 1.8 : 0.2)
          if (jd.oy > 70)  jd.oy -= 140
          if (jd.oy < -70) jd.oy += 140
          const pulse = jd.radius * (1.0 + 0.35 * Math.sin(t * jd.speed + jd.phase))
          const squash = 1.0 - 0.3 * Math.abs(Math.sin(t * jd.speed * 0.5 + jd.phase))
          _dummy.position.set(_camPos.x + jd.ox, _camPos.y + jd.oy, _camPos.z + jd.oz)
          _dummy.scale.set(pulse, pulse * squash, pulse)
          _dummy.updateMatrix()
          jellyRef.current.setMatrixAt(i, _dummy.matrix)
        }
        jellyRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // ── Eclipse dark veil — only update matrices when active ─────────────
    if (eclipseRef.current) {
      const targetOpacity = isEclipse ? 0.35 : 0.0
      eclipseMat.opacity = MathUtils.lerp(eclipseMat.opacity, targetOpacity, 2 * delta)

      if (eclipseMat.opacity > 0.01) {
        for (let i = 0; i < ECLIPSE_COUNT; i++) {
          const ed = eclipseData[i]
          ed.oy += ed.driftY * delta * (isEclipse ? 1.0 : 0.1)
          if (ed.oy < -80) ed.oy += 160
          if (ed.oy > 80)  ed.oy -= 160
          const s = ed.scale * (0.9 + 0.1 * Math.sin(t * 0.8 + ed.phase))
          _dummy.position.set(_camPos.x + ed.ox, _camPos.y + ed.oy, _camPos.z + ed.oz)
          _dummy.scale.setScalar(s)
          _dummy.updateMatrix()
          eclipseRef.current.setMatrixAt(i, _dummy.matrix)
        }
        eclipseRef.current.instanceMatrix.needsUpdate = true
      }
    }

    // ── God rays ──────────────────────────────────────────────────────────
    const rayAlpha = MathUtils.clamp(1.0 - currentDepth / 250, 0, 0.35) * (effect?.lightingMult ?? 1.0)
    for (let i = 0; i < RAY_COUNT; i++) {
      const mat = rayMats[i]
      mat.uniforms.uTime.value  = t
      mat.uniforms.uAlpha.value = rayAlpha
    }

    // ── Caustics ──────────────────────────────────────────────────────────
    causticMat.uniforms.uTime.value = t
    const causticAlpha = MathUtils.clamp(1.0 - currentDepth / 300, 0, 1) * (effect?.lightingMult ?? 1.0)
    causticMat.uniforms.uColor.value.setStyle(currentDepth < 100 ? '#6cd4ff' : '#2196f3')
    causticMat.opacity = causticAlpha

    // ── Bioluminescence ───────────────────────────────────────────────────
    if (bioRef.current) {
      const bioOpacity = MathUtils.smoothstep(currentDepth, 250, 700) * 0.8 * (effect?.glowMultiplier ?? 1.0)
      bioMat.opacity = MathUtils.lerp(bioMat.opacity, Math.min(1.0, bioOpacity), 3 * delta)
      bioMat.size = (0.9 + 0.5 * Math.sin(t * 0.7)) * (effect?.glowMultiplier ? 1.5 : 1.0)
      if (effect?.particleColor) {
        _targetColor.setStyle(effect.particleColor)
        bioMat.color.lerp(_targetColor, 0.05)
      }
      bioRef.current.position.copy(_camPos)
    }

    // ── Micro-organisms ───────────────────────────────────────────────────
    if (microRef.current) {
      microRef.current.position.copy(_camPos)
      const biomeColor = BIOME_PARTICLE_COLORS[biome] ?? '#90e0ef'
      _targetColor.setStyle(biomeColor)
      microMat.color.lerp(_targetColor, 0.04)
      const shallowBoost = biome === 'coral' || biome === 'kelp' ? 0.55 : 0.28
      const abyssBoost   = biome === 'abyss' ? 0.0 : 1.0
      microMat.opacity = MathUtils.lerp(
        microMat.opacity,
        shallowBoost * abyssBoost * (0.8 + 0.2 * Math.sin(t * 0.5)),
        2 * delta,
      )
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

      {/* ── Bloom: jellyfish swarm ─────────────────────────────────────── */}
      <instancedMesh
        ref={jellyRef}
        args={[jellyGeo, jellyMat, JELLYFISH_COUNT]}
        frustumCulled={false}
      />

      {/* ── Eclipse: dark veil particles ──────────────────────────────── */}
      <instancedMesh
        ref={eclipseRef}
        args={[eclipseGeo, eclipseMat, ECLIPSE_COUNT]}
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

      {/* ── Caustic overlay plane ─────────────────────────────────────── */}
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

      {/* ── Micro-organism layer ──────────────────────────────────────────── */}
      <points ref={microRef} frustumCulled={false}>
        <primitive object={microGeo} attach="geometry" />
        <primitive object={microMat} attach="material" />
      </points>
    </>
  )
})
