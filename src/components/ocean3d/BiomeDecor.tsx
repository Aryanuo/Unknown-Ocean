/**
 * BiomeDecor.tsx
 *
 * Biome-specific environmental decorations rendered as instanced meshes.
 * Each biome gets a distinct visual signature beyond fog/lighting:
 *   coral        → coral fans, tube corals, anemones
 *   kelp         → tall waving kelp fronds (billboards)
 *   crystal      → glowing crystal spires
 *   abyss        → sparse glowing floor nodes
 *   hydrothermal → bubble vent columns
 *   frozen       → overhead ice plates + ice stalactites
 *   ruins        → stone columns + scattered debris blocks
 *   open         → drifting plankton blobs
 */

import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  InstancedMesh, Object3D, MeshStandardMaterial, MeshBasicMaterial,
  ConeGeometry, CylinderGeometry, BoxGeometry, SphereGeometry,
  AdditiveBlending, Color, PlaneGeometry, ShaderMaterial,
  BufferGeometry, BufferAttribute, Points, PointsMaterial,
  MathUtils,
} from 'three'
import { BiomeType } from '../../engine/procedural/biomeGenerator'

// ── Seeded deterministic random (same position → same decor) ──────────────────
function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) & 0x7fffffff
    return (s & 0xffff) / 0xffff
  }
}

// ── Pre-allocated scratch ─────────────────────────────────────────────────────
const _dummy = new Object3D()

// ═════════════════════════════════════════════════════════════════════════════
// Kelp wave shader (simple vertex displacement)
// ═════════════════════════════════════════════════════════════════════════════
const kelpVert = /* glsl */`
  uniform float uTime;
  varying vec2  vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Sway increases with height on the mesh
    float sway = uv.y * sin(uTime * 1.4 + position.x * 0.5) * 1.2;
    pos.x += sway;
    pos.z += uv.y * cos(uTime * 1.1 + position.z * 0.4) * 0.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`
const kelpFrag = /* glsl */`
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    float side = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
    float alpha = fade * side * 0.82;
    gl_FragColor = vec4(uColor * (0.6 + 0.4 * vUv.y), alpha);
  }
`

// Ice crystal facet shader
const iceVert = /* glsl */`
  varying vec3 vNormal;
  void main() {
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const iceFrag = /* glsl */`
  uniform float uTime;
  varying vec3 vNormal;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    vec3 color = mix(vec3(0.55, 0.85, 1.0), vec3(0.88, 0.96, 1.0), fresnel);
    float shimmer = 0.85 + 0.15 * sin(uTime * 2.0 + vNormal.x * 8.0);
    gl_FragColor = vec4(color * shimmer, 0.5 + fresnel * 0.3);
  }
`

// Crystal glow shader
const crystalFrag = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2  vUv;
  void main() {
    float pulse = 0.75 + 0.25 * sin(uTime * 2.2 + vUv.y * 4.0);
    float edge  = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
    gl_FragColor = vec4(uColor * pulse, edge * 0.9);
  }
`
const crystalVert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// ═════════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════════
const DECOR_RADIUS = 160   // half-extent around camera to place decor
const DECOR_COUNT  = 48    // instances per type
const GRID_SNAP    = 30    // snap decor to a grid cell (creates stable layout)

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════
interface BiomeDecorProps {
  biome: BiomeType
}

export const BiomeDecor = React.memo(function BiomeDecor({ biome }: BiomeDecorProps) {
  const { camera } = useThree()

  // ── Shared time ref for shaders ──────────────────────────────────────────
  const kelpMatRef    = useRef<ShaderMaterial | null>(null)
  const iceMatRef     = useRef<ShaderMaterial | null>(null)
  const crystalMatRef = useRef<ShaderMaterial | null>(null)

  // ── Coral fans (instanced cones + cylinders) ─────────────────────────────
  const coralFanRef  = useRef<InstancedMesh>(null)
  const coralTubeRef = useRef<InstancedMesh>(null)
  const anemoneRef   = useRef<InstancedMesh>(null)

  const coralFanGeo  = useMemo(() => new ConeGeometry(2, 5, 7, 1), [])
  const coralTubeGeo = useMemo(() => new CylinderGeometry(0.25, 0.4, 6, 6), [])
  const anemoneGeo   = useMemo(() => new SphereGeometry(1.2, 8, 5), [])

  const coralFanMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#ff6b6b'),
    emissive: new Color('#ff2255'),
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.9,
  }), [])
  const coralTubeMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#ffc300'),
    emissive: new Color('#ff8c00'),
    emissiveIntensity: 0.15,
  }), [])
  const anemoneMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#ff4d94'),
    emissive: new Color('#cc0055'),
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.85,
  }), [])

  // ── Kelp (instanced thin planes with wave shader) ─────────────────────────
  const kelpRef = useRef<InstancedMesh>(null)
  const kelpGeo = useMemo(() => new PlaneGeometry(3, 18, 2, 8), [])
  const kelpMat = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: kelpVert,
      fragmentShader: kelpFrag,
      transparent: true,
      depthWrite: false,
      side: 2, // DoubleSide
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: new Color('#52b788') },
      },
    })
    return m
  }, [])

  // ── Crystal spires (cone geometry with emissive shader) ───────────────────
  const crystalRef = useRef<InstancedMesh>(null)
  const crystalGeo = useMemo(() => new ConeGeometry(1, 12, 6), [])
  const crystalMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#c77dff'),
    emissive: new Color('#7209b7'),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
    metalness: 0.6,
  }), [])

  // ── Abyss glow nodes (small spheres, emissive) ────────────────────────────
  const abyssRef = useRef<InstancedMesh>(null)
  const abyssGeo = useMemo(() => new SphereGeometry(0.5, 6, 6), [])
  const abyssMat = useMemo(() => new MeshBasicMaterial({
    color: new Color('#00d4ff'),
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
    depthWrite: false,
  }), [])

  // ── Hydrothermal vents (tall thin cylinders, orange glow) ─────────────────
  const ventRef    = useRef<InstancedMesh>(null)
  const ventGeo    = useMemo(() => new CylinderGeometry(0.5, 1.2, 14, 8), [])
  const ventMat    = useMemo(() => new MeshStandardMaterial({
    color: new Color('#1a0000'),
    emissive: new Color('#ff3300'),
    emissiveIntensity: 0.6,
    roughness: 0.9,
  }), [])

  // Vent bubble particles (Points)
  const ventBubbleRef = useRef<Points>(null)
  const ventBubbleGeo = useMemo(() => {
    const count = 80
    const pos = new Float32Array(count * 3)
    const rng = seededRng(8844)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (rng() - 0.5) * DECOR_RADIUS * 2
      pos[i * 3 + 1] = -15 + rng() * 20
      pos[i * 3 + 2] = (rng() - 0.5) * DECOR_RADIUS * 2
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])
  const ventBubbleMat = useMemo(() => new PointsMaterial({
    color: new Color('#ff6633'),
    size: 1.4,
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), [])

  // ── Frozen: ice stalactites (downward cones) + top ice shelf ──────────────
  const iceRef    = useRef<InstancedMesh>(null)
  const iceGeo    = useMemo(() => new ConeGeometry(1.5, 8, 6), [])
  const iceMat    = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader:   iceVert,
      fragmentShader: iceFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
    })
    return m
  }, [])

  // ── Ruins: stone columns + scattered debris ───────────────────────────────
  const columnRef = useRef<InstancedMesh>(null)
  const debrisRef = useRef<InstancedMesh>(null)
  const columnGeo = useMemo(() => new CylinderGeometry(1.2, 1.5, 20, 8), [])
  const debrisGeo = useMemo(() => new BoxGeometry(2, 1, 2), [])
  const columnMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#3d3d5c'),
    emissive: new Color('#ffd60a'),
    emissiveIntensity: 0.08,
    roughness: 0.95,
  }), [])
  const debrisMat = useMemo(() => new MeshStandardMaterial({
    color: new Color('#2a2a40'),
    roughness: 0.98,
  }), [])

  // ── Open: drifting plankton Points ────────────────────────────────────────
  const planktonRef = useRef<Points>(null)
  const planktonGeo = useMemo(() => {
    const count = 150
    const pos = new Float32Array(count * 3)
    const rng = seededRng(3141)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (rng() - 0.5) * 300
      pos[i * 3 + 1] = (rng() - 0.5) * 80
      pos[i * 3 + 2] = (rng() - 0.5) * 300
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])
  const planktonMat = useMemo(() => new PointsMaterial({
    color: new Color('#90e0ef'),
    size: 0.6,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), [])

  // ── Stable per-instance data (seeded by chunk-snap of camera start pos) ──
  // We re-generate when the snapped camera chunk changes significantly
  const lastChunkRef = useRef({ x: 0, z: 0 })
  const instanceData = useRef<Array<{ox: number, oy: number, oz: number, ry: number, sx: number, sy: number, sz: number}>>([])

  function generateInstanceData(snapX: number, snapZ: number) {
    const rng = seededRng(snapX * 1337 + snapZ * 7919)
    const data = []
    for (let i = 0; i < DECOR_COUNT; i++) {
      const ox = (rng() - 0.5) * DECOR_RADIUS * 2
      const oz = (rng() - 0.5) * DECOR_RADIUS * 2
      const oy = 0 // floor offset — set in useFrame
      const ry = rng() * Math.PI * 2
      const scale = 0.6 + rng() * 0.8
      data.push({ ox, oy, oz, ry, sx: scale, sy: 0.7 + rng() * 0.8, sz: scale })
    }
    instanceData.current = data
  }

  // ── Dispose all GPU resources on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      [coralFanGeo, coralTubeGeo, anemoneGeo, kelpGeo, crystalGeo,
       abyssGeo, ventGeo, ventBubbleGeo, iceGeo, columnGeo, debrisGeo, planktonGeo].forEach(g => g.dispose())
      ;[coralFanMat, coralTubeMat, anemoneMat, kelpMat, crystalMat,
        abyssMat, ventMat, ventBubbleMat, iceMat, columnMat, debrisMat, planktonMat].forEach((m: any) => m.dispose())
    }
  }, []) // eslint-disable-line

  // ── Frame update ──────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const cx = camera.position.x
    const cy = camera.position.y
    const cz = camera.position.z

    // Update shader times only for active biome
    if (biome === 'kelp' && kelpMat.uniforms) kelpMat.uniforms.uTime.value = t
    if (biome === 'frozen' && iceMat.uniforms)  iceMat.uniforms.uTime.value  = t

    // Chunk snap — regenerate instance offsets when chunk changes
    const snapX = Math.round(cx / (GRID_SNAP * 5))
    const snapZ = Math.round(cz / (GRID_SNAP * 5))
    if (snapX !== lastChunkRef.current.x || snapZ !== lastChunkRef.current.z) {
      lastChunkRef.current = { x: snapX, z: snapZ }
      generateInstanceData(snapX, snapZ)
    }
    if (instanceData.current.length === 0) generateInstanceData(snapX, snapZ)

    const data = instanceData.current
    const floorY = cy - 40  // place decor items relative to camera, near sea floor

    // ── Per-biome rendering ──────────────────────────────────
    // Only update instances for the ACTIVE biome; skip all others to save GPU
    if (biome === 'coral') {
      // Coral fans
      if (coralFanRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          const pulse = 1.0 + 0.08 * Math.sin(t * 1.8 + i * 0.7)
          _dummy.position.set(cx + d.ox, floorY + 1, cz + d.oz)
          _dummy.rotation.set(0, d.ry, 0)
          _dummy.scale.set(d.sx * pulse, d.sy, d.sx * pulse)
          _dummy.updateMatrix()
          coralFanRef.current.setMatrixAt(i, _dummy.matrix)
        }
        coralFanRef.current.instanceMatrix.needsUpdate = true
      }
      // Coral tubes (alternate set)
      if (coralTubeRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[(i + 12) % data.length]
          _dummy.position.set(cx + d.ox * 0.8, floorY + 1.5, cz + d.oz * 0.8)
          _dummy.rotation.set(0, d.ry * 1.3, 0)
          _dummy.scale.set(0.5, d.sy * 1.2, 0.5)
          _dummy.updateMatrix()
          coralTubeRef.current.setMatrixAt(i, _dummy.matrix)
        }
        coralTubeRef.current.instanceMatrix.needsUpdate = true
      }
      // Anemones
      if (anemoneRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[(i + 24) % data.length]
          const pulsed = 1.0 + 0.15 * Math.sin(t * 2.2 + i)
          _dummy.position.set(cx + d.ox * 0.6, floorY + 0.8, cz + d.oz * 0.6)
          _dummy.scale.setScalar(d.sx * 0.9 * pulsed)
          _dummy.updateMatrix()
          anemoneRef.current.setMatrixAt(i, _dummy.matrix)
        }
        anemoneRef.current.instanceMatrix.needsUpdate = true
      }
    }

    if (biome === 'kelp') {
      if (kelpRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          _dummy.position.set(cx + d.ox, floorY + 7, cz + d.oz)
          _dummy.rotation.set(0, d.ry, 0)
          _dummy.scale.set(d.sx, d.sy * 1.5, 1)
          _dummy.updateMatrix()
          kelpRef.current.setMatrixAt(i, _dummy.matrix)
        }
        kelpRef.current.instanceMatrix.needsUpdate = true
      }
    }

    if (biome === 'crystal') {
      if (crystalRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          const glow = 1.0 + 0.2 * Math.sin(t * 1.5 + i * 0.5)
          _dummy.position.set(cx + d.ox, floorY + 3, cz + d.oz)
          _dummy.rotation.set(0, d.ry, 0)
          _dummy.scale.set(d.sx * glow, d.sy * 2, d.sx * glow)
          _dummy.updateMatrix()
          crystalRef.current.setMatrixAt(i, _dummy.matrix)
        }
        crystalRef.current.instanceMatrix.needsUpdate = true
        // Pulse emissive intensity
        crystalMat.emissiveIntensity = 0.5 + 0.4 * Math.sin(t * 1.8)
      }
    }

    if (biome === 'abyss') {
      if (abyssRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          const flicker = 0.6 + 0.4 * Math.sin(t * 3.5 + i * 1.3)
          _dummy.position.set(cx + d.ox, floorY + 0.5, cz + d.oz)
          _dummy.scale.setScalar(d.sx * 0.6 * flicker)
          _dummy.updateMatrix()
          abyssRef.current.setMatrixAt(i, _dummy.matrix)
        }
        abyssRef.current.instanceMatrix.needsUpdate = true
        abyssMat.opacity = 0.4 + 0.35 * Math.sin(t * 0.7)
      }
    }

    if (biome === 'hydrothermal') {
      if (ventRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          _dummy.position.set(cx + d.ox, floorY + 3, cz + d.oz)
          _dummy.scale.set(d.sx * 0.8, d.sy, d.sx * 0.8)
          _dummy.updateMatrix()
          ventRef.current.setMatrixAt(i, _dummy.matrix)
        }
        ventRef.current.instanceMatrix.needsUpdate = true
        ventMat.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 2.5)
      }
      // Bubble vents rise
      if (ventBubbleRef.current) {
        const pos = ventBubbleGeo.attributes.position as any
        for (let i = 0; i < 80; i++) {
          pos.array[i * 3 + 1] += delta * (2 + (i % 3) * 0.5)
          if (pos.array[i * 3 + 1] > floorY + 30) {
            pos.array[i * 3 + 1] = floorY - 5
          }
        }
        pos.needsUpdate = true
        ventBubbleRef.current.position.set(cx, 0, cz)
      }
    }

    if (biome === 'frozen') {
      if (iceRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          // Stalactites hang from above camera
          _dummy.position.set(cx + d.ox, cy + 30 - d.sy * 4, cz + d.oz)
          _dummy.rotation.set(Math.PI, d.ry, 0) // flip downward
          _dummy.scale.set(d.sx * 0.7, d.sy, d.sx * 0.7)
          _dummy.updateMatrix()
          iceRef.current.setMatrixAt(i, _dummy.matrix)
        }
        iceRef.current.instanceMatrix.needsUpdate = true
      }
    }

    if (biome === 'ruins') {
      if (columnRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[i]
          // Columns stand on the floor, some tilted
          _dummy.position.set(cx + d.ox, floorY + 8, cz + d.oz)
          _dummy.rotation.set(
            (d.ry < 0.5 ? 1 : -1) * 0.05 * Math.sin(d.ry * 4),
            d.ry,
            0,
          )
          _dummy.scale.set(d.sx, d.sy * 1.8, d.sx)
          _dummy.updateMatrix()
          columnRef.current.setMatrixAt(i, _dummy.matrix)
        }
        columnRef.current.instanceMatrix.needsUpdate = true
      }
      if (debrisRef.current) {
        for (let i = 0; i < Math.min(DECOR_COUNT, data.length); i++) {
          const d = data[(i + 16) % data.length]
          _dummy.position.set(cx + d.ox * 0.7, floorY + 0.5, cz + d.oz * 0.7)
          _dummy.rotation.set(d.ry * 0.3, d.ry, d.ry * 0.2)
          _dummy.scale.set(d.sx, 0.4 + d.sy * 0.3, d.sz)
          _dummy.updateMatrix()
          debrisRef.current.setMatrixAt(i, _dummy.matrix)
        }
        debrisRef.current.instanceMatrix.needsUpdate = true
      }
    }

    if (biome === 'open') {
      if (planktonRef.current) {
        planktonRef.current.position.set(cx, cy, cz)
        planktonMat.opacity = 0.3 + 0.2 * Math.sin(t * 0.4)
      }
    }
  })

  return (
    <>
      {/* ── CORAL ───────────────────────────────────────────────────────── */}
      {biome === 'coral' && (
        <>
          <instancedMesh ref={coralFanRef}  args={[coralFanGeo,  coralFanMat,  DECOR_COUNT]} frustumCulled={false} />
          <instancedMesh ref={coralTubeRef} args={[coralTubeGeo, coralTubeMat, DECOR_COUNT]} frustumCulled={false} />
          <instancedMesh ref={anemoneRef}   args={[anemoneGeo,   anemoneMat,   DECOR_COUNT]} frustumCulled={false} />
        </>
      )}

      {/* ── KELP ────────────────────────────────────────────────────────── */}
      {biome === 'kelp' && (
        <instancedMesh ref={kelpRef} args={[kelpGeo, kelpMat, DECOR_COUNT]} frustumCulled={false} />
      )}

      {/* ── CRYSTAL ─────────────────────────────────────────────────────── */}
      {biome === 'crystal' && (
        <instancedMesh ref={crystalRef} args={[crystalGeo, crystalMat, DECOR_COUNT]} frustumCulled={false} />
      )}

      {/* ── ABYSS ───────────────────────────────────────────────────────── */}
      {biome === 'abyss' && (
        <instancedMesh ref={abyssRef} args={[abyssGeo, abyssMat, DECOR_COUNT]} frustumCulled={false} />
      )}

      {/* ── HYDROTHERMAL ────────────────────────────────────────────────── */}
      {biome === 'hydrothermal' && (
        <>
          <instancedMesh ref={ventRef} args={[ventGeo, ventMat, DECOR_COUNT]} frustumCulled={false} />
          <points ref={ventBubbleRef} frustumCulled={false}>
            <primitive object={ventBubbleGeo} attach="geometry" />
            <primitive object={ventBubbleMat} attach="material" />
          </points>
        </>
      )}

      {/* ── FROZEN ──────────────────────────────────────────────────────── */}
      {biome === 'frozen' && (
        <instancedMesh ref={iceRef} args={[iceGeo, iceMat, DECOR_COUNT]} frustumCulled={false} />
      )}

      {/* ── RUINS ───────────────────────────────────────────────────────── */}
      {biome === 'ruins' && (
        <>
          <instancedMesh ref={columnRef} args={[columnGeo, columnMat, DECOR_COUNT]} frustumCulled={false} />
          <instancedMesh ref={debrisRef} args={[debrisGeo, debrisMat, DECOR_COUNT]} frustumCulled={false} />
        </>
      )}

      {/* ── OPEN: plankton ──────────────────────────────────────────────── */}
      {biome === 'open' && (
        <points ref={planktonRef} frustumCulled={false}>
          <primitive object={planktonGeo} attach="geometry" />
          <primitive object={planktonMat} attach="material" />
        </points>
      )}
    </>
  )
})
