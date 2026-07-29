import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, PlaneGeometry, Float32BufferAttribute, MeshStandardMaterial, Group, Vector2 } from 'three'
import { generationProfiler } from '../../engine/performance/generationProfiler'
import { getTerrainChunk, TERRAIN_PATCH_SIZE, TERRAIN_SEGMENTS, terrainChunkKey, worldToTerrainChunk } from '../../engine/terrain/terrainWorld'

const GRID_RANGE = [-1, 0, 1]
interface Patch { id: number; geo: PlaneGeometry; mat: MeshStandardMaterial; key: string | null }

export function Terrain3D() {
  const groupRef = useRef<Group>(null)
  const patchRefs = useRef<Array<Mesh | null>>([])
  const lastCenter = useRef(new Vector2(999999, 999999))
  const template = useMemo(() => {
    const geometry = new PlaneGeometry(TERRAIN_PATCH_SIZE, TERRAIN_PATCH_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
    geometry.rotateX(-Math.PI / 2)
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array((TERRAIN_SEGMENTS + 1) ** 2 * 3), 3))
    return geometry
  }, [])
  const patches = useMemo<Patch[]>(() => Array.from({ length: 9 }, (_, id) => ({
    id, geo: template.clone(), mat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.12 }), key: null,
  })), [template])

  useEffect(() => () => {
    template.dispose()
    patches.forEach(patch => { patch.geo.dispose(); patch.mat.dispose() })
  }, [patches, template])

  useFrame((state) => {
    const centerX = worldToTerrainChunk(state.camera.position.x)
    const centerZ = worldToTerrainChunk(state.camera.position.z)
    if (lastCenter.current.x === centerX && lastCenter.current.y === centerZ) return
    lastCenter.current.set(centerX, centerZ)
    const startedAt = performance.now()
    const required = new Set<string>()
    for (const dx of GRID_RANGE) for (const dz of GRID_RANGE) required.add(terrainChunkKey(centerX + dx, centerZ + dz))

    const retained = new Set(patches.map(patch => patch.key).filter((key): key is string => key !== null && required.has(key)))
    let updated = 0
    for (const key of required) {
      if (retained.has(key)) continue
      const [chunkX, chunkZ] = key.split('|').map(Number)
      const patch = patches.find(candidate => candidate.key === null || !required.has(candidate.key))
      if (!patch) continue
      const data = getTerrainChunk(chunkX, chunkZ)
      const position = patch.geo.attributes.position as Float32BufferAttribute
      const color = patch.geo.attributes.color as Float32BufferAttribute
      for (let index = 0; index < position.count; index++) position.setY(index, data.heights[index])
      color.array.set(data.colors)
      position.needsUpdate = true
      color.needsUpdate = true
      patch.geo.computeVertexNormals()
      patch.key = key
      patchRefs.current[patch.id]?.position.set(chunkX * TERRAIN_PATCH_SIZE, 0, chunkZ * TERRAIN_PATCH_SIZE)
      updated++
    }
    generationProfiler.record('terrain', performance.now() - startedAt, updated, 0, 0)
  })

  return <group ref={groupRef}>{patches.map(patch => <mesh key={patch.id} ref={element => { patchRefs.current[patch.id] = element }} geometry={patch.geo} material={patch.mat} receiveShadow={false} />)}</group>
}