/**
 * artefactGenerator.ts
 *
 * Procedural generation and static definitions for collectible ocean artefacts.
 * Artefacts are scattered across the world (seeded deterministically by 5x5 chunk grid).
 */

export type ArtefactType = 'fossil' | 'journal' | 'sculpture' | 'equipment' | 'pearl' | 'relic'
export type ArtefactRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical'

export interface ArtefactDef {
  id: string
  type: ArtefactType
  name: string
  description: string
  lore: string
  rarity: ArtefactRarity
  rpValue: number
}

export interface ArtefactInstance {
  instanceId: string
  def: ArtefactDef
  position: [number, number, number]
}

export const ARTEFACT_CATALOG: ArtefactDef[] = [
  // Fossils
  {
    id: 'fossil_trilobite',
    type: 'fossil',
    name: 'Petrified Trilobite Shield',
    description: 'A beautifully preserved exoskeleton of an ancient arthropod.',
    lore: 'Dating back 450 million years, this creature crawled along the primordial seabed before land life existed.',
    rarity: 'common',
    rpValue: 50,
  },
  {
    id: 'fossil_ammonite',
    type: 'fossil',
    name: 'Spiral Ammonite Shell',
    description: 'A heavy calcified chambered shell with iridescent nacre intact.',
    lore: 'Ammonites filled the ancient oceans until the end-Cretaceous extinction event. The spiral ratio matches golden ratio proportions.',
    rarity: 'uncommon',
    rpValue: 100,
  },
  {
    id: 'fossil_megalodon_tooth',
    type: 'fossil',
    name: 'Fossilized Megalodon Tooth',
    description: 'A serrated, palm-sized tooth from the ultimate oceanic apex predator.',
    lore: 'Belonging to Otodus megalodon, which grew up to 18 meters long and terrorized warm Miocene seas.',
    rarity: 'rare',
    rpValue: 250,
  },
  {
    id: 'fossil_ichthyosaur_rib',
    type: 'fossil',
    name: 'Ichthyosaur Rib Fragment',
    description: 'A mineralized rib bone showing healed fracture marks.',
    lore: 'Evidence that these dolphin-like marine reptiles survived brutal fights with larger predators.',
    rarity: 'rare',
    rpValue: 300,
  },
  {
    id: 'fossil_leviathan_vertebra',
    type: 'fossil',
    name: 'Colossal Leviathan Vertebra',
    description: 'A massive bone fossil larger than a diving helmet.',
    lore: 'Belongs to an unclassified prehistoric sea giant. The bone density suggests deep-dive pressure adaptations.',
    rarity: 'legendary',
    rpValue: 800,
  },

  // Journals & Logbooks
  {
    id: 'journal_captain_log',
    type: 'journal',
    name: "Captain Vance's Waterproof Ledger",
    description: 'A leather-bound logbook sealed in a bronze cylinder.',
    lore: '"Day 42: The lights below the kelp canopy are not reflections. They are swimming in synchronized patterns..."',
    rarity: 'common',
    rpValue: 60,
  },
  {
    id: 'journal_abyss_notes',
    type: 'journal',
    name: 'Research Notes: Depth Anomalies',
    description: 'Water-logged field notes with hand-drawn species diagrams.',
    lore: 'Detailed observations of bioluminescent flashes at 4,000m that correspond to prime number intervals.',
    rarity: 'uncommon',
    rpValue: 120,
  },
  {
    id: 'journal_lost_expedition',
    type: 'journal',
    name: 'Project Triton Final Directive',
    description: 'A brass-cased encrypted drive from an earlier government expedition.',
    lore: '"If you are reading this, do not attempt to contact the surface. The trench is waking up."',
    rarity: 'epic',
    rpValue: 500,
  },

  // Scientific & Explorer Equipment
  {
    id: 'equip_brass_sextant',
    type: 'equipment',
    name: 'Victorian Brass Navigation Sextant',
    description: 'A gleaming 19th-century navigation instrument with silver scales.',
    lore: 'Lost during an early mapping expedition. The optics are surprisingly undamaged by the sea water.',
    rarity: 'uncommon',
    rpValue: 150,
  },
  {
    id: 'equip_bathysphere_gauge',
    type: 'equipment',
    name: 'Pioneer Pressure Gauge',
    description: 'An antique analog manometer calibrated up to 10,000 PSI.',
    lore: 'Salvaged from an experimental 1950s deep-submergence capsule that set an unrecorded depth record.',
    rarity: 'rare',
    rpValue: 350,
  },
  {
    id: 'equip_quantum_core',
    type: 'equipment',
    name: 'Experimental Sonar Transceiver',
    description: 'A prototype emitter module that hums with faint residual energy.',
    lore: 'Designed to transmit audio through rock strata. Gives off a soft harmonic pulse when held.',
    rarity: 'epic',
    rpValue: 600,
  },

  // Pearls & Natural Wonders
  {
    id: 'pearl_black_abyssal',
    type: 'pearl',
    name: 'Abyssal Black Pearl',
    description: 'A dark, flawless pearl the size of a plum, glowing with faint blue iridescence.',
    lore: 'Formed deep in hydrothermal vents over centuries inside colossal deep-sea bivalves.',
    rarity: 'rare',
    rpValue: 400,
  },
  {
    id: 'pearl_luminous_orb',
    type: 'pearl',
    name: 'Bioluminescent Pearl Core',
    description: 'A self-illuminating orb that casts soft golden light on nearby surfaces.',
    lore: 'Absorbs ambient bioluminescence and slowly radiates light across the spectrum.',
    rarity: 'epic',
    rpValue: 700,
  },
  {
    id: 'pearl_starlight',
    type: 'pearl',
    name: 'Starlight Prism Pearl',
    description: 'An impossibly clear spherical gemstone that refracts light into aurora-like patterns.',
    lore: 'Legend says these pearls fall from meteor showers that land in deep trenches.',
    rarity: 'mythical',
    rpValue: 1500,
  },

  // Sculptures & Relics
  {
    id: 'sculpture_coral_idol',
    type: 'sculpture',
    name: 'Carved Coral Figurine',
    description: 'A small statuette of a winged aquatic deity carved from red coral.',
    lore: 'Crafted by an unknown coastal culture before the great sea level rise 12,000 years ago.',
    rarity: 'uncommon',
    rpValue: 180,
  },
  {
    id: 'sculpture_abyssal_mask',
    type: 'sculpture',
    name: 'Obsidian Ritual Mask',
    description: 'A smooth volcanic glass mask with inlaid pearl eyes.',
    lore: 'Worn by priests of ancient sunken city-states during deep tide ceremonies.',
    rarity: 'rare',
    rpValue: 450,
  },
  {
    id: 'relic_starlight_astrolabe',
    type: 'relic',
    name: 'Celestial Sea Astrolabe',
    description: 'An intricate bronze device with rotating star maps aligning with forgotten constellations.',
    lore: 'Calculates ocean currents based on lunar phases and star movements from 20,000 years past.',
    rarity: 'epic',
    rpValue: 650,
  },
  {
    id: 'relic_alien_tablet',
    type: 'relic',
    name: 'Glyph-Carved Basalt Slab',
    description: 'A heavy stone tablet covered in self-illuminating blue geometric symbols.',
    lore: 'The script matches no known terrestrial language, but mathematical constants are clearly recognizable.',
    rarity: 'legendary',
    rpValue: 1000,
  },
  {
    id: 'relic_heart_of_trench',
    type: 'relic',
    name: 'Heart of the Trench',
    description: 'A crystalline artifact pulsing with deep rhythmic thermal energy.',
    lore: 'The central power matrix of a lost civilization that mastered deep-ocean geothermal harvesting.',
    rarity: 'mythical',
    rpValue: 2000,
  },
]

// Seeded random helper
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123
  return x - Math.floor(x)
}

/**
 * Deterministically retrieves an artefact for a 5x5 chunk grid cell (cell size 1250 units)
 */
export function getArtefactForCell(cellX: number, cellZ: number): ArtefactInstance | null {
  const seed = cellX * 73856093 ^ cellZ * 19349663
  const roll = seededRandom(seed)

  // 70% chance a 5x5 cell has a collectible artefact — exploration-friendly density.
  if (roll > 0.98) return null

  const indexRoll = Math.floor(seededRandom(seed + 1) * ARTEFACT_CATALOG.length)
  const def = ARTEFACT_CATALOG[indexRoll]

  // Calculate world coordinates near center of cell
  const cellSize = 1000
  const offsetX = (seededRandom(seed + 2) - 0.5) * (cellSize * 0.7)
  const offsetZ = (seededRandom(seed + 3) - 0.5) * (cellSize * 0.7)
  const depthY = -(50 + Math.floor(seededRandom(seed + 4) * 2500))

  const wx = cellX * cellSize + offsetX
  const wz = cellZ * cellSize + offsetZ

  return {
    instanceId: `artefact_${cellX}_${cellZ}_${def.id}`,
    def,
    position: [wx, depthY, wz],
  }
}

/**
 * Gets all nearby artefacts within radius of world coordinates (wx, wz)
 */
export function getNearbyArtefacts(wx: number, wz: number, radius = 3000): ArtefactInstance[] {
  const cellSize = 1000
  const minCellX = Math.floor((wx - radius) / cellSize)
  const maxCellX = Math.floor((wx + radius) / cellSize)
  const minCellZ = Math.floor((wz - radius) / cellSize)
  const maxCellZ = Math.floor((wz + radius) / cellSize)

  const list: ArtefactInstance[] = []

  for (let cx = minCellX; cx <= maxCellX; cx++) {
    for (let cz = minCellZ; cz <= maxCellZ; cz++) {
      const item = getArtefactForCell(cx, cz)
      if (item) {
        const dx = item.position[0] - wx
        const dz = item.position[2] - wz
        if (dx * dx + dz * dz <= radius * radius) {
          list.push(item)
        }
      }
    }
  }

  return list
}
