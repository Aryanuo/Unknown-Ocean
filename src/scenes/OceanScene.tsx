import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Color, FogExp2, MathUtils, Vector2 } from 'three'
import { usePlayerStore, Discovery } from '../store/usePlayerStore'
import { useWorldStore } from '../store/useWorldStore'
import { getBiomeAt, BIOMES, BiomeType } from '../engine/procedural/biomeGenerator'
import { HUD } from '../components/ui/HUD'
import { DiscoveryAlert } from '../components/ui/DiscoveryAlert'
import { DailyEventBanner } from '../components/ui/DailyEventBanner'
import { ResearchLog } from '../components/panels/ResearchLog'
import { Encyclopedia } from '../components/panels/Encyclopedia'
import { PhotoMode } from '../components/panels/PhotoMode'
import { CommunityStats } from '../components/panels/CommunityStats'
import { Hero } from '../components/ocean3d/Hero'
import { BubbleTrail } from '../components/ocean3d/BubbleTrail'
import { Terrain3D } from '../components/ocean3d/Terrain3D'
import { CreatureManager } from '../components/ocean3d/CreatureManager'
import { UnderwaterAtmosphere } from '../components/ocean3d/UnderwaterAtmosphere'
import './OceanScene.css'

// ── Pre-allocated colour reusables ────────────────────────────────────────────
const _fogColor  = new Color()
const _targetFog = new Color()

// ── Environment scene with smooth fog transitions ─────────────────────────────
interface EnvSceneProps {
  biome: BiomeType
  depth: number
  onDiscovery: (d: Discovery) => void
}

function EnvironmentScene({ biome, depth, onDiscovery }: EnvSceneProps) {
  const { scene } = useThree()
  const biomeConf = BIOMES[biome] || BIOMES.open
  const fogRef    = useRef<FogExp2 | null>(null)

  // Initialise fog once
  useEffect(() => {
    const fog = new FogExp2(biomeConf.fogColor, biomeConf.fogDensity * 0.5)
    scene.fog = fog
    scene.background = new Color(biomeConf.fogColor)
    fogRef.current = fog
  }, []) // eslint-disable-line

  useFrame((_, delta) => {
    if (!fogRef.current) return

    const conf = BIOMES[biome] || BIOMES.open

    // Depth-driven fog density boost (deeper = thicker fog)
    const depthMod = MathUtils.clamp(depth / 3000, 0, 1.5)
    const targetDensity = conf.fogDensity * 0.5 * (1 + depthMod * 0.6)

    _targetFog.set(conf.fogColor)
    _fogColor.set(fogRef.current.color.getHex())

    // Smooth colour & density transition
    fogRef.current.color.lerp(_targetFog, MathUtils.clamp(1.5 * delta, 0, 1))
    fogRef.current.density = MathUtils.lerp(fogRef.current.density, targetDensity, 1.5 * delta)

    // Also smoothly update background
    ;(scene.background as Color)?.lerp(_targetFog, MathUtils.clamp(1.5 * delta, 0, 1))
  })

  return (
    <>
      {/* Ambient: changes with biome */}
      <ambientLight
        intensity={biomeConf.lightIntensity * 0.25}
        color={biomeConf.ambientColor}
      />

      {/* Sun shaft directional from above */}
      <directionalLight
        position={[80, 300, 60]}
        intensity={biomeConf.lightIntensity * (1.0 - MathUtils.clamp(depth / 800, 0, 0.9))}
        color={biomeConf.lightColor}
        castShadow={false}
      />

      {/* Secondary fill light from front-below for rim lighting on sub */}
      <directionalLight
        position={[0, -200, -100]}
        intensity={0.08}
        color="#003d6b"
      />

      {/* Hemisphere — sky/ground */}
      <hemisphereLight
        args={[biomeConf.lightColor, '#000814', biomeConf.lightIntensity * 0.15]}
      />

      {depth < 120 && <Environment preset="city" />}

      <Hero />
      <BubbleTrail />
      <Terrain3D />
      <CreatureManager onDiscovery={onDiscovery} />
      <UnderwaterAtmosphere depth={depth} />
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Root scene component
// ═════════════════════════════════════════════════════════════════════════════
export default function OceanScene() {
  const { coords, depth, addDiscovery } = usePlayerStore()
  const { setCurrentBiome, dailyEvent }  = useWorldStore()

  const [currentBiome, setLocalBiome]    = useState<BiomeType>('coral')
  const [pendingDiscovery, setPendingDiscovery] = useState<Discovery | null>(null)
  const [openPanel, setOpenPanel]        = useState<'log' | 'encyclopedia' | 'photo' | 'stats' | null>(null)
  const [photoMode, setPhotoMode]        = useState(false)

  // Biome check every 1.5 s — no inner re-render overhead
  useEffect(() => {
    const interval = setInterval(() => {
      const b = getBiomeAt(coords.x, coords.y, depth) as BiomeType
      if (b !== currentBiome) {
        setLocalBiome(b)
        setCurrentBiome(b)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [coords.x, coords.y, depth, currentBiome, setCurrentBiome])

  const handleDiscovery = (discovery: Discovery) => {
    addDiscovery(discovery)
    setPendingDiscovery(discovery)
  }

  return (
    <div className="ocean-root">
      <Canvas
        camera={{ position: [0, -20, 42], fov: 62 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        dpr={[1, 1.5]}       // cap pixel ratio for performance
        frameloop="always"
      >
        <EnvironmentScene
          biome={currentBiome}
          depth={depth}
          onDiscovery={handleDiscovery}
        />

        {/* ── Post Processing ─────────────────────────────────────────────── */}
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            luminanceThreshold={0.45}
            luminanceSmoothing={0.85}
            intensity={1.8}
            mipmapBlur
            radius={0.6}
          />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={new Vector2(0.0005, 0.0005)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette
            offset={0.25}
            darkness={0.7}
            eskil={false}
          />
        </EffectComposer>
      </Canvas>

      {/* ── Cockpit overlay (shown in first-person mode via CSS class) ───── */}
      <div className="cockpit-frame" id="cockpit-frame" />

      {!photoMode && (
        <>
          <HUD
            onOpenLog={() => setOpenPanel('log')}
            onOpenEncyclopedia={() => setOpenPanel('encyclopedia')}
            onOpenStats={() => setOpenPanel('stats')}
            onPhotoMode={() => setPhotoMode(true)}
            currentBiome={currentBiome}
          />
          <DailyEventBanner event={dailyEvent} />
        </>
      )}

      {photoMode && (
        <PhotoMode
          canvasRef={{ current: document.querySelector('canvas') }}
          onClose={() => setPhotoMode(false)}
        />
      )}

      {pendingDiscovery && (
        <DiscoveryAlert
          discovery={pendingDiscovery}
          onClose={() => setPendingDiscovery(null)}
        />
      )}

      {openPanel === 'log'          && <ResearchLog    onClose={() => setOpenPanel(null)} />}
      {openPanel === 'encyclopedia' && <Encyclopedia   onClose={() => setOpenPanel(null)} />}
      {openPanel === 'stats'        && <CommunityStats onClose={() => setOpenPanel(null)} />}
    </div>
  )
}
