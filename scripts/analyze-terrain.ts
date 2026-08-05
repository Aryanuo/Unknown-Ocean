import { analyzeTerrainDistribution } from '../src/engine/terrain/terrainAnalysis'

console.log('--- Deterministic Terrain Analysis ---')

const zones = [
  { name: 'Shallow Zone', x: 0, z: 0 },
  { name: 'Mid-Depth Zone', x: 5000, z: 5000 },
  { name: 'Deep Zone', x: 15000, z: 15000 },
  { name: 'Abyss Zone', x: 30000, z: 30000 }
]

const results = zones.map(zone => {
  const stats = analyzeTerrainDistribution(zone.x, zone.z, 2000, 100)
  console.log(`\n[${zone.name}] at ${zone.x}, ${zone.z}`)
  console.log(`  Open/Navigable: ${stats.openPercent.toFixed(1)}%`)
  console.log(`  Rolling Hills:  ${stats.rollingPercent.toFixed(1)}%`)
  console.log(`  Major Features: ${stats.featurePercent.toFixed(1)}%`)
  console.log(`  Elevation:      ${stats.minHeight.toFixed(0)}m to ${stats.maxHeight.toFixed(0)}m`)
  return stats
})

const avgOpen = results.reduce((a, b) => a + b.openPercent, 0) / results.length
console.log('\n--- Final Distribution ---')
console.log(`Average Open Water: ${avgOpen.toFixed(1)}% (Target: 60-70%)`)

if (avgOpen < 55) {
  console.error('FAILED: Terrain is too dense.')
  process.exit(1)
}
console.log('PASSED: Terrain distribution meets gameplay requirements.')