import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Vector2, Mesh, PlaneGeometry, Float32BufferAttribute, Color, MeshStandardMaterial
} from 'three'
import { createNoise2D } from 'simplex-noise'

// ── Deterministic seeded noise ───────────────────────────────────────────────
function createSeededNoise(seed: number) {
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return createNoise2D(lcg)
}

const noise2D = createSeededNoise(1337)

function getElevation(x: number, z: number): number {
  const scale = 0.003
  let e = 1    * noise2D(1 * x * scale, 1 * z * scale)
        + 0.5  * noise2D(2 * x * scale, 2 * z * scale)
        + 0.25 * noise2D(4 * x * scale, 4 * z * scale)
  e = e / (1 + 0.5 + 0.25)
  return Math.pow(Math.abs(e), 1.5) * Math.sign(e) * 150 - 150
}

// ── Depth-based vertex coloring ───────────────────────────────────────────────
const _sandColor    = new Color('#b5855e')  // shallow sandy ledges
const _rockColor    = new Color('#3d6b4f')  // mid-depth rocky green
const _deepColor    = new Color('#0a2238')  // deep basalt blue
const _abyssColor   = new Color('#020d16')  // abyssal darkness
const _tmpColor     = new Color()

function getTerrainColor(elevation: number, baseDepth: number): Color {
  // elevation is relative; baseDepth is absolute camera depth
  const relH = Math.max(0, elevation - (-150)) / 150 // 0 = trough, 1 = peak

  if (baseDepth < 80) {
    // Shallow: sandy peaks, rocky troughs
    _tmpColor.lerpColors(_rockColor, _sandColor, relH)
  } else if (baseDepth < 400) {
    // Mid depth: rocky green to deep
    _tmpColor.lerpColors(_deepColor, _rockColor, relH)
  } else {
    // Abyss: dark basalt
    _tmpColor.lerpColors(_abyssColor, _deepColor, relH * 0.5)
  }
  return _tmpColor
}

export function Terrain3D() {
  const meshRef = useRef<Mesh>(null)

  // Reduced segments: 80×80 is visually identical at distance, 2.25× fewer vertices
  const gridSize = 1000
  const segments = 80

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(gridSize, gridSize, segments, segments)
    geo.rotateX(-Math.PI / 2)
    // Pre-allocate vertex color buffer
    const vCount = (segments + 1) * (segments + 1)
    const colors = new Float32Array(vCount * 3)
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return geo
  }, [])

  const material = useMemo(() => new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.08,
  }), [])

  const lastChunk = useRef(new Vector2(999999, 999999))

  useFrame((state) => {
    const camPos = state.camera.position
    if (!meshRef.current) return

    const snapSize = 50
    const cx = Math.floor(camPos.x / snapSize) * snapSize
    const cz = Math.floor(camPos.z / snapSize) * snapSize

    if (cx === lastChunk.current.x && cz === lastChunk.current.y) return
    lastChunk.current.set(cx, cz)

    meshRef.current.position.set(cx, 0, cz)

    const positions = geometry.attributes.position as Float32BufferAttribute
    const colors    = geometry.attributes.color    as Float32BufferAttribute
    const camDepth  = Math.abs(camPos.y)

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i) + cx
      const vz = positions.getZ(i) + cz

      const elevation = getElevation(vx, vz)
      const floorY    = -Math.max(100, camDepth + 50) + elevation
      positions.setY(i, floorY)

      const c = getTerrainColor(elevation, camDepth)
      colors.setXYZ(i, c.r, c.g, c.b)
    }

    geometry.computeVertexNormals()
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate    = true
  })

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow={false}>
      <primitive object={material} attach="material" />
    </mesh>
  )
}
