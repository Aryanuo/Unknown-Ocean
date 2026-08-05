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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const noiseIsland = createSeededNoise(7777)  // Isolated feature placement
const noiseShape = createSeededNoise(8888)   // Local feature shape
const noiseMicro = createSeededNoise(9999)   // Surface detail

const chunkCache = new Map<string, TerrainChunkData>()
const MAX_CACHED_CHUNKS = 64

export function terrainChunkKey(chunkX: number, chunkZ: number) {
  return `${chunkX}|${chunkZ}`
}

export function worldToTerrainChunk(worldCoordinate: number) {
  return Math.floor((worldCoordinate + TERRAIN_PATCH_SIZE / 2) / TERRAIN_PATCH_SIZE)
}

/**
 * Isolated Feature Model:
 * No continuous seabed. The floor is set to a "void" depth (-4000m).
 * IslandNoise creates sparse areas where features emerge.
 */
function sampleVertexHeight(worldX: number, worldZ: number): number {
  const scaleIsland = 0.0004
  const scaleShape = 0.002
  const scaleMicro = 0.008

  const VOID_DEPTH = -4000
  
  // 1. Feature Mask (Sparse isolated islands/formations)
  const islandN = noiseIsland(worldX * scaleIsland, worldZ * scaleIsland)
  
  // Only generate terrain if island noise is above threshold
  // This creates the "isolated landmark" effect
  if (islandN < 0.65) return VOID_DEPTH

  // 2. Shape within the island
  const intensity = (islandN - 0.65) / 0.35
  const shapeN = noiseShape(worldX * scaleShape, worldZ * scaleShape)
  const microN = noiseMicro(worldX * scaleMicro, worldZ * scaleMicro)
  
  // Feature height is a mix of base elevation and noise
  // Most features start deep and rise up
  const baseElevation = -1200 + intensity * 1000
  const detail = shapeN * 150 + microN * 15
  
  return baseElevation + detail
}

function createChunk(chunkX: number, chunkZ: number): TerrainChunkData {
  const key = terrainChunkKey(chunkX, chunkZ)
  const heights = new Float32Array(TERRAIN_VERTEX_COUNT)
  const colors = new Float32Array(TERRAIN_VERTEX_COUNT * 3)
  const chunkWorldX = chunkX * TERRAIN_PATCH_SIZE
  const chunkWorldZ = chunkZ * TERRAIN_PATCH_SIZE
  const stride = TERRAIN_SEGMENTS + 1
  
  const colorBase = new Color()
  const colorPeak = new Color()
  const sampleColor = new Color()

  for (let row = 0; row <= TERRAIN_SEGMENTS; row++) {
    const localZ = (row / TERRAIN_SEGMENTS - 0.5) * TERRAIN_PATCH_SIZE
    for (let column = 0; column <= TERRAIN_SEGMENTS; column++) {
      const index = row * stride + column
      const localX = (column / TERRAIN_SEGMENTS - 0.5) * TERRAIN_PATCH_SIZE
      const worldX = chunkWorldX + localX
      const worldZ = chunkWorldZ + localZ
      const height = sampleVertexHeight(worldX, worldZ)
      heights[index] = height
      
      if (height <= -3900) {
        // Void color (invisible/black)
        colors[index * 3] = 0
        colors[index * 3 + 1] = 0
        colors[index * 3 + 2] = 0
        continue
      }

      const biomeType = getBiomeAt(worldX, worldZ, Math.abs(height))
      const biome = BIOMES[biomeType] || BIOMES.open
      
      // High-contrast rocky/sandy materials
      if (biomeType === 'coral' || biomeType === 'open') {
        colorBase.set("#8b7355") // Dark rock
        colorPeak.set("#c2a378") // Sandy top
      } else if (biomeType === 'hydrothermal') {
        colorBase.set("#1a0a0a") // Obsidian
        colorPeak.set("#8b0000") // Dried magma
      } else {
        colorBase.set(biome.terrainColorBase).multiplyScalar(1.5)
        colorPeak.set(biome.terrainColorPeak).multiplyScalar(1.5)
      }

      const ratio = Math.max(0, Math.min(1, (height + 1200) / 800))
      sampleColor.lerpColors(colorBase, colorPeak, ratio)
      
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