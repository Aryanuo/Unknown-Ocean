import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  InstancedMesh, Object3D, MeshBasicMaterial, SphereGeometry,
  AdditiveBlending, Color, PlaneGeometry, ShaderMaterial, Vector3,
  MathUtils, BufferGeometry, BufferAttribute, Points, PointsMaterial,
} from 'three'
import { useWorldStore } from '../../store/useWorldStore'
import { BiomeType } from '../../engine/procedural/biomeGenerator'

const _dummy       = new Object3D()
const _camPos      = new Vector3()
const _targetColor = new Color()

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
    float pattern = causticRing(c1, t, 8.0) * 0.5 + causticRing(c2, t, 6.0) * 0.3 + causticRing(c3, t, 9.0) * 0.2;
    gl_FragColor = vec4(uColor * pattern, pattern * 0.55);
  }
`

const PARTICLE_COUNT  = 500   // Significant increase
const RAY_COUNT       = 12    // More god rays
const JELLYFISH_COUNT = 60
const ECLIPSE_COUNT   = 180
const MICRO_COUNT     = 800   // Much more marine snow

const BIOME_PARTICLE_COLORS: Record<BiomeType, string> = {
  coral:        '#b9f3ff',
  kelp:         '#a2d9a1',
  crystal:      '#e0aaff',
  abyss:        '#1a3a4a',
  frozen:       '#caf0f8',
  hydrothermal: '#ff9b71',
  ruins:        '#ffd60a',
  open:         '#48cae4',
}

interface AtmosphereProps { biome?: BiomeType }

export const UnderwaterAtmosphere = React.memo(function UnderwaterAtmosphere({ biome = 'open' }: AtmosphereProps) {
  const { camera, scene } = useThree()
  const dailyEvent = useWorldStore((s) => s.dailyEvent)
  const eventType  = dailyEvent?.type
  const effect     = dailyEvent?.worldEffect

  useEffect(() => {
    // Force scene background to a deep aquatic gradient base
    scene.background = new Color('#000d1a')
  }, [scene])

  const particleRef = useRef<InstancedMesh>(null)
  const particleData = useMemo(() => Array.from({ length: PARTICLE_COUNT }, () => ({
    ox: (Math.random() - 0.5) * 400,
    oy: (Math.random() - 0.5) * 180,
    oz: (Math.random() - 0.5) * 400,
    driftY: 0.2 + Math.random() * 1.2,
    driftX: (Math.random() - 0.5) * 0.4,
    driftZ: (Math.random() - 0.5) * 0.4,
    scale: 0.12 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
  })), [])

  const particleMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#b9f3ff'),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])
  const particleGeo = useMemo(() => new SphereGeometry(1, 6, 6), [])

  const jellyRef  = useRef<InstancedMesh>(null)
  const jellyData = useMemo(() => Array.from({ length: JELLYFISH_COUNT }, () => ({
    ox: (Math.random() - 0.5) * 320,
    oy: (Math.random() - 0.5) * 140,
    oz: (Math.random() - 0.5) * 320,
    driftY: 0.15 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.2,
    radius: 1.5 + Math.random() * 2.5,
  })), [])
  const jellyGeo = useMemo(() => new SphereGeometry(1, 8, 5), [])
  const jellyMat = useMemo(() => new MeshBasicMaterial({ color: new Color('#00ffff'), transparent: true, opacity: 0.0, depthWrite: false, blending: AdditiveBlending }), [])

  const eclipseRef  = useRef<InstancedMesh>(null)
  const eclipseData = useMemo(() => Array.from({ length: ECLIPSE_COUNT }, () => ({
    ox: (Math.random() - 0.5) * 350, oy: (Math.random() - 0.5) * 160, oz: (Math.random() - 0.5) * 350, driftY: -(0.1 + Math.random() * 0.4), phase: Math.random() * Math.PI * 2, scale: 0.3 + Math.random() * 1.2,
  })), [])
  const eclipseGeo = useMemo(() => new SphereGeometry(1, 4, 4), [])
  const eclipseMat = useMemo(() => new MeshBasicMaterial({ color: new Color('#b5179e'), transparent: true, opacity: 0.0, depthWrite: false, blending: AdditiveBlending }), [])

  const rayMats = useMemo(() => Array.from({ length: RAY_COUNT }, (_, i) => new ShaderMaterial({
    vertexShader: godRayVert, fragmentShader: godRayFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uColor: { value: new Color(i % 2 === 0 ? '#b9f3ff' : '#48cae4') }, uAlpha: { value: 0.0 } },
  })), [])
  const rayGeo = useMemo(() => new PlaneGeometry(1, 1), [])
  const rayOffsets = useMemo(() => Array.from({ length: RAY_COUNT }, (_, i) => {
    const angle = (i / RAY_COUNT) * Math.PI * 2 + i * 0.4; const radius = 22 + (i % 3) * 15
    return { angle, radius, width: 3.5 + (i % 3) * 2.5, height: 80 + (i % 4) * 30, sway: (i % 2 === 0 ? 1 : -1) * (0.3 + (i % 3) * 0.15), posX: Math.cos(angle) * radius + (((i * 7 + 3) % 10) / 10 - 0.5) * 8, posZ: Math.sin(angle) * radius + (((i * 13 + 7) % 10) / 10 - 0.5) * 8 }
  }), [])

  const causticMat = useMemo(() => new ShaderMaterial({ vertexShader: causticVert, fragmentShader: causticFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uColor: { value: new Color('#48cae4') } } }), [])
  const causticGeo = useMemo(() => new PlaneGeometry(800, 800), [])

  const bioRef = useRef<Points>(null)
  const bioGeo = useMemo(() => {
    const count = 200; const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * 400; pos[i * 3 + 1] = (Math.random() - 0.5) * 200; pos[i * 3 + 2] = (Math.random() - 0.5) * 400 }
    const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(pos, 3)); return geo
  }, [])
  const bioMat = useMemo(() => new PointsMaterial({ color: new Color('#00f2ff'), size: 1.5, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true }), [])

  const microRef = useRef<Points>(null)
  const microGeo = useMemo(() => {
    const pos = new Float32Array(MICRO_COUNT * 3)
    for (let i = 0; i < MICRO_COUNT; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = (Math.random() - 0.5) * 60; pos[i * 3 + 2] = (Math.random() - 0.5) * 120 }
    const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(pos, 3)); return geo
  }, [])
  const microMat = useMemo(() => new PointsMaterial({ color: new Color('#b9f3ff'), size: 0.25, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true }), [])

  useEffect(() => () => {
    particleGeo.dispose(); particleMat.dispose(); jellyGeo.dispose(); jellyMat.dispose(); eclipseGeo.dispose(); eclipseMat.dispose(); rayGeo.dispose(); rayMats.forEach(m => m.dispose()); causticGeo.dispose(); causticMat.dispose(); bioGeo.dispose(); bioMat.dispose(); microGeo.dispose(); microMat.dispose()
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime; _camPos.copy(camera.position); const depth = Math.abs(_camPos.y)
    if (particleRef.current) {
      const hX = 200, hY = 90, hZ = 200
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pd = particleData[i]; pd.oy += pd.driftY * delta; pd.ox += pd.driftX * delta; pd.oz += pd.driftZ * delta
        let wx = _camPos.x + pd.ox, wy = _camPos.y + pd.oy, wz = _camPos.z + pd.oz
        if (pd.oy > hY) { pd.oy -= 180; wy = _camPos.y + pd.oy }; if (pd.oy < -hY) { pd.oy += 180; wy = _camPos.y + pd.oy }
        if (Math.abs(pd.ox) > hX) { pd.ox = (Math.random() - 0.5) * hX * 2; wx = _camPos.x + pd.ox }
        if (Math.abs(pd.oz) > hZ) { pd.oz = (Math.random() - 0.5) * hZ * 2; wz = _camPos.z + pd.oz }
        const s = pd.scale * (0.85 + 0.15 * Math.sin(t * 1.5 + pd.phase))
        _dummy.position.set(wx, wy, wz); _dummy.scale.setScalar(s); _dummy.updateMatrix(); particleRef.current.setMatrixAt(i, _dummy.matrix)
      }
      particleRef.current.instanceMatrix.needsUpdate = true
      particleMat.opacity = MathUtils.lerp(0.4, 0.8, MathUtils.smoothstep(depth, 50, 600)) * (effect?.glowMultiplier ?? 1.0)
      const pCol = effect?.particleColor ?? BIOME_PARTICLE_COLORS[biome] ?? '#b9f3ff'
      _targetColor.setStyle(pCol); particleMat.color.lerp(_targetColor, 0.05)
    }
    if (jellyRef.current) {
      const targetOp = eventType === 'bloom' ? 0.6 : 0.0; jellyMat.opacity = MathUtils.lerp(jellyMat.opacity, targetOp, 2 * delta)
      if (jellyMat.opacity > 0.01) {
        for (let i = 0; i < JELLYFISH_COUNT; i++) {
          const jd = jellyData[i]; jd.oy += jd.driftY * delta * 1.8; if (jd.oy > 70) jd.oy -= 140; if (jd.oy < -70) jd.oy += 140
          const pulse = jd.radius * (1.0 + 0.35 * Math.sin(t * jd.speed + jd.phase)); const squash = 1.0 - 0.3 * Math.abs(Math.sin(t * jd.speed * 0.5 + jd.phase))
          _dummy.position.set(_camPos.x + jd.ox, _camPos.y + jd.oy, _camPos.z + jd.oz); _dummy.scale.set(pulse, pulse * squash, pulse); _dummy.updateMatrix(); jellyRef.current.setMatrixAt(i, _dummy.matrix)
        }
        jellyRef.current.instanceMatrix.needsUpdate = true
      }
    }
    const rayAlpha = MathUtils.clamp(1.0 - depth / 350, 0, 0.5) * (effect?.lightingMult ?? 1.0)
    rayMats.forEach(m => { m.uniforms.uTime.value = t; m.uniforms.uAlpha.value = rayAlpha })
    causticMat.uniforms.uTime.value = t; causticMat.opacity = MathUtils.clamp(1.0 - depth / 400, 0, 1) * (effect?.lightingMult ?? 1.0)
    if (bioRef.current) {
      bioMat.opacity = MathUtils.lerp(bioMat.opacity, MathUtils.smoothstep(depth, 200, 800) * 0.9, 3 * delta); bioRef.current.position.copy(_camPos)
    }
    if (microRef.current) {
      microRef.current.position.copy(_camPos); microMat.opacity = (biome === 'abyss' ? 0.1 : 0.7) * (0.8 + 0.2 * Math.sin(t * 0.5))
    }
  })

  return (
    <>
      <instancedMesh ref={particleRef} args={[particleGeo, particleMat, PARTICLE_COUNT]} frustumCulled={false} />
      <instancedMesh ref={jellyRef} args={[jellyGeo, jellyMat, JELLYFISH_COUNT]} frustumCulled={false} />
      <instancedMesh ref={eclipseRef} args={[eclipseGeo, eclipseMat, ECLIPSE_COUNT]} frustumCulled={false} />
      {rayOffsets.map((ro, i) => (
        <mesh key={`ray-${i}`} frustumCulled={false} position={[ro.posX, 40, ro.posZ]} rotation={[0, ro.angle + Math.PI / 2, ro.sway]} scale={[ro.width, ro.height, 1]}>
          <primitive object={rayGeo} attach="geometry" />
          <primitive object={rayMats[i]} attach="material" />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} frustumCulled={false}>
        <primitive object={causticGeo} attach="geometry" />
        <primitive object={causticMat} attach="material" />
      </mesh>
      <points ref={bioRef} frustumCulled={false}><primitive object={bioGeo} attach="geometry" /><primitive object={bioMat} attach="material" /></points>
      <points ref={microRef} frustumCulled={false}><primitive object={microGeo} attach="geometry" /><primitive object={microMat} attach="material" /></points>
    </>
  )
})