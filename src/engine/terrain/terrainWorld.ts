import { Color } from 'three'
import { createNoise2D } from 'simplex-noise'
import { BIOMES, getBiomeAt } from '../procedural/biomeGenerator'

export const TERRAIN_PATCH_SIZE = 400
export const TERRAIN_SEGMENTS = 36
export const TERRAIN_VERTEX_COUNT = (TERRAIN_SEGMENTS + 1) ** 2
export const TERRAIN_CLEARANCE = 4.5

export interface TerrainChunkData {
  key: string
  chunkX: number
  chunkZ: number
  heights: Float32Array
  colors: Float32Array
}

function createSeededNoise(seed: number) {
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return createNoise2D(lcg)
}

const noise2D = createSeededNoise(9482)
const detailNoise = createSeededNoise(31415)
const chunkCache = new Map<string, TerrainChunkData>()
const MAX_CACHED_CHUNKS = 64
const colorBase = new Color()
const colorPeak = new Color()
const sampleColor = new Color()

export function terrainChunkKey(chunkX: number, chunkZ: number) {
  return `${chunkX}|${chunkZ}`
}

export function worldToTerrainChunk(worldCoordinate: number) {
  return Math.floor((worldCoordinate + TERRAIN_PATCH_SIZE / 2) / TERRAIN_PATCH_SIZE)
}

function sampleVertexHeight(worldX: number, worldZ: number): number {
  const scale = 0.0025
  let elevation = noise2D(worldX * scale, worldZ * scale)
    + 0.45 * noise2D(worldX * scale * 2.1, worldZ * scale * 2.1)
    + 0.20 * detailNoise(worldX * scale * 5.3, worldZ * scale * 5.3)
  elevation /= 1.65
  const signed = Math.pow(Math.abs(elevation), 1.6) * Math.sign(elevation)
  return -220 + signed * 160
}

function createChunk(chunkX: number, chunkZ: number): TerrainChunkData {
  const key = terrainChunkKey(chunkX, chunkZ)
  const heights = new Float32Array(TERRAIN_VERTEX_COUNT)
  const colors = new Float32Array(TERRAIN_VERTEX_COUNT * 3)
  const chunkWorldX = chunkX * TERRAIN_PATCH_SIZE
  const chunkWorldZ = chunkZ * TERRAIN_PATCH_SIZE
  const stride = TERRAIN_SEGMENTS + 1
  for (let row = 0; row <= TERRAIN_SEGMENTS; row++) {
    const localZ = (row / TERRAIN_SEGMENTS - 0.5) * TERRAIN_PATCH_SIZE
    for (let column = 0; column <= TERRAIN_SEGMENTS; column++) {
      const index = row * stride + column
      const localX = (column / TERRAIN_SEGMENTS - 0.5) * TERRAIN_PATCH_SIZE
      const worldX = chunkWorldX + localX
      const worldZ = chunkWorldZ + localZ
      const height = sampleVertexHeight(worldX, worldZ)
      heights[index] = height
      const biome = BIOMES[getBiomeAt(worldX, worldZ, 100)] || BIOMES.open
      colorBase.set(biome.terrainColorBase)
      colorPeak.set(biome.terrainColorPeak)
      sampleColor.lerpColors(colorBase, colorPeak, Math.max(0, Math.min(1, (height + 380) / 160)))
      const colorIndex = index * 3
      colors[colorIndex] = sampleColor.r
      colors[colorIndex + 1] = sampleColor.g
      colors[colorIndex + 2] = sampleColor.b
    }
  }
  return { key, chunkX, chunkZ, heights, colors }
}

export function getTerrainChunk(chunkX: number, chunkZ: number): TerrainChunkData {
  const key = terrainChunkKey(chunkX, chunkZ)
  const cached = chunkCache.get(key)
  if (cached) {
    chunkCache.delete(key)
    chunkCache.set(key, cached)
    return cached
  }
  const chunk = createChunk(chunkX, chunkZ)
  chunkCache.set(key, chunk)
  if (chunkCache.size > MAX_CACHED_CHUNKS) chunkCache.delete(chunkCache.keys().next().value!)
  return chunk
}

/** Returns triangle-interpolated height from the exact cached grid rendered by Terrain3D. */
export function getTerrainHeight(worldX: number, worldZ: number): number {
  const chunkX = worldToTerrainChunk(worldX)
  const chunkZ = worldToTerrainChunk(worldZ)
  const chunk = getTerrainChunk(chunkX, chunkZ)
  const originX = chunkX * TERRAIN_PATCH_SIZE - TERRAIN_PATCH_SIZE / 2
  const originZ = chunkZ * TERRAIN_PATCH_SIZE - TERRAIN_PATCH_SIZE / 2
  const cellSize = TERRAIN_PATCH_SIZE / TERRAIN_SEGMENTS
  const localX = Math.max(0, Math.min(TERRAIN_PATCH_SIZE - Number.EPSILON, worldX - originX))
  const localZ = Math.max(0, Math.min(TERRAIN_PATCH_SIZE - Number.EPSILON, worldZ - originZ))
  const column = Math.floor(localX / cellSize)
  const row = Math.floor(localZ / cellSize)
  const fx = (localX - column * cellSize) / cellSize
  const fz = (localZ - row * cellSize) / cellSize
  const stride = TERRAIN_SEGMENTS + 1
  const topLeft = chunk.heights[row * stride + column]
  const topRight = chunk.heights[row * stride + column + 1]
  const bottomLeft = chunk.heights[(row + 1) * stride + column]
  const bottomRight = chunk.heights[(row + 1) * stride + column + 1]
  return fx + fz <= 1
    ? topLeft + (topRight - topLeft) * fx + (bottomLeft - topLeft) * fz
    : bottomRight + (bottomLeft - bottomRight) * (1 - fx) + (topRight - bottomRight) * (1 - fz)
}