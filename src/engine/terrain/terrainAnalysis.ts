import { getTerrainHeight } from './terrainWorld'

export interface TerrainClassification {
  openPercent: number
  rollingPercent: number
  featurePercent: number
  meanHeight: number
  maxHeight: number
  minHeight: number
}

/**
 * Samples a deterministic grid to classify terrain distribution.
 * 'open': low slope and low relief relative to local basin
 * 'rolling': moderate relief
 * 'feature': major peaks or deep trenches
 */
export function analyzeTerrainDistribution(
  startX: number,
  startZ: number,
  size: number,
  step: number
): TerrainClassification {
  let open = 0
  let rolling = 0
  let feature = 0
  let total = 0
  let sumH = 0
  let maxH = -Infinity
  let minH = Infinity

  for (let x = startX; x < startX + size; x += step) {
    for (let z = startZ; z < startZ + size; z += step) {
      const h = getTerrainHeight(x, z)
      sumH += h
      maxH = Math.max(maxH, h)
      minH = Math.min(minH, h)
      total++

      // Basic classification based on local relief/height bands
      // In this redesigned model, macro-basins are around -240 to -360.
      // Major features go up to +450 from macro, or -300 below.
      
      // We'll use a relative metric: how far from the "typical" basin floor at this location.
      // For simplicity in this script, we'll use absolute thresholds based on the redesign specs.
      if (h > -150 || h < -500) {
        feature++
      } else if (h > -220) {
        rolling++
      } else {
        open++
      }
    }
  }

  return {
    openPercent: (open / total) * 100,
    rollingPercent: (rolling / total) * 100,
    featurePercent: (feature / total) * 100,
    meanHeight: sumH / total,
    maxHeight: maxH,
    minHeight: minH
  }
}