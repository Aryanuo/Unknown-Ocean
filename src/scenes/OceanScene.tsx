import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Color, FogExp2, MathUtils, Vector2 } from 'three'
import { usePlayerStore, Discovery } from '../store/usePlayerStore'
import { useWorldStore } from '../store/useWorldStore'
import { getBiomeAt, BIOMES, BiomeType } from '../engine/procedural/biomeGenerator'
import { HUD } from '../components/ui/HUD'
import { DailyEventBanner } from '../components/ui/DailyEventBanner'
import { ScanHUD, ScanState } from '../components/ui/ScanHUD'
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
  onScanCreature: (id: string, speciesId: string, name: string, dna: any, wx: number, wy: number, wz: number) => void
  onDiscovery: (d: Discovery) => void
}

const EnvironmentScene = React.memo(function EnvironmentScene({ biome, onScanCreature, onDiscovery }: EnvSceneProps) {
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

  useFrame((state, delta) => {
    if (!fogRef.current) return

    const conf = BIOMES[biome] || BIOMES.open

    // Read depth directly from camera Y (no prop needed)
    const depth = Math.abs(state.camera.position.y)
    const depthMod = MathUtils.clamp(depth / 3000, 0, 1.5)
    const targetDensity = conf.fogDensity * 0.5 * (1 + depthMod * 0.6)

    _targetFog.set(conf.fogColor)
    _fogColor.set(fogRef.current.color.getHex())

    fogRef.current.color.lerp(_targetFog, MathUtils.clamp(1.5 * delta, 0, 1))
    fogRef.current.density = MathUtils.lerp(fogRef.current.density, targetDensity, 1.5 * delta)
    ;(scene.background as Color)?.lerp(_targetFog, MathUtils.clamp(1.5 * delta, 0, 1))
  })

  return (
    <>
      <ambientLight
        intensity={biomeConf.lightIntensity * 0.25}
        color={biomeConf.ambientColor}
      />
      <directionalLight
        position={[80, 300, 60]}
        intensity={biomeConf.lightIntensity * 0.5}
        color={biomeConf.lightColor}
        castShadow={false}
      />
      <directionalLight
        position={[0, -200, -100]}
        intensity={0.08}
        color="#003d6b"
      />
      <hemisphereLight
        args={[biomeConf.lightColor, '#000814', biomeConf.lightIntensity * 0.15]}
      />

      <Environment preset="city" />

      <Hero />
      <BubbleTrail />
      <Terrain3D />
      <CreatureManager onScanCreature={onScanCreature} onDiscovery={onDiscovery} />
      <UnderwaterAtmosphere />
    </>
  )
})

// ═════════════════════════════════════════════════════════════════════════════
// Root scene component
// ═════════════════════════════════════════════════════════════════════════════
export default function OceanScene() {
  // Only subscribe to stable / rarely-changing store values
  const addDiscovery = usePlayerStore(s => s.addDiscovery)
  const playerName   = usePlayerStore(s => s.playerName)
  const { setCurrentBiome, dailyEvent }  = useWorldStore()

  const [currentBiome, setLocalBiome]    = useState<BiomeType>('coral')
  const [openPanel, setOpenPanel]        = useState<'log' | 'encyclopedia' | 'photo' | 'stats' | null>(null)
  const [photoMode, setPhotoMode]        = useState(false)

  // Scan state managed at the top level so ScanHUD can read it
  const [scanState, setScanState]        = useState<ScanState>({ phase: 'idle' })
  const [logToast, setLogToast]          = useState<string | null>(null)

  // Coords/depth are read via refs — updated through a non-rendering subscription
  // so that frequent player movement doesn't trigger React re-renders
  const coordsRef = useRef(usePlayerStore.getState().coords)
  const depthRef  = useRef(usePlayerStore.getState().depth)

  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state) => {
      coordsRef.current = state.coords
      depthRef.current  = state.depth
    })
    return unsub
  }, [])

  // ── Stable biome check: interval only started once, reads coords via ref ──
  useEffect(() => {
    let prevBiome: BiomeType = 'coral'
    const id = setInterval(() => {
      const c = coordsRef.current
      const d = depthRef.current
      const b = getBiomeAt(c.x, c.y, d) as BiomeType
      if (b !== prevBiome) {
        prevBiome = b
        setLocalBiome(b)
        setCurrentBiome(b)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [setCurrentBiome]) // setCurrentBiome is stable (Zustand)

  // ── Scan flow ──────────────────────────────────────────────────────────────
  const handleScanCreature = useCallback((
    id: string, speciesId: string, name: string, dna: any,
    wx: number, wy: number, wz: number,
  ) => {
    setScanState({
      phase: 'selected',
      id, speciesId, name, dna,
      wx, wy, wz,
    })
  }, [])

  const handleScanStart = useCallback(() => {
    setScanState(prev => prev.phase === 'selected' ? { ...prev, phase: 'scanning', progress: 0 } : prev)
  }, [])

  const handleScanComplete = useCallback((d: Discovery) => {
    addDiscovery(d)
    setScanState(prev => ({ ...prev, phase: 'result', discovery: d }))
    // Small toast notification
    setLogToast('New species added to Research Log')
    setTimeout(() => setLogToast(null), 4000)
  }, [addDiscovery])

  const handleScanDismiss = useCallback(() => {
    setScanState({ phase: 'idle' })
  }, [])

  const handleDiscovery = useCallback((d: Discovery) => {
    // Legacy path kept for compatibility – routes through same store call
    addDiscovery(d)
  }, [addDiscovery])

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
        dpr={[1, 1.5]}
        frameloop="always"
      >
        <EnvironmentScene
          biome={currentBiome}
          onScanCreature={handleScanCreature}
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

      {/* ── Cockpit overlay ─────────────────────────────────────────────── */}
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

      {/* Scan HUD – always rendered so it can track scan progress */}
      <ScanHUD
        scanState={scanState}
        playerName={playerName}
        onScanStart={handleScanStart}
        onScanComplete={handleScanComplete}
        onDismiss={handleScanDismiss}
      />

      {/* Log toast */}
      {logToast && (
        <div className="log-toast" id="log-toast">
          <span>🔬</span> {logToast}
        </div>
      )}

      {photoMode && (
        <PhotoMode
          canvasRef={{ current: document.querySelector('canvas') }}
          onClose={() => setPhotoMode(false)}
        />
      )}

      {openPanel === 'log'          && <ResearchLog    onClose={() => setOpenPanel(null)} />}
      {openPanel === 'encyclopedia' && <Encyclopedia   onClose={() => setOpenPanel(null)} />}
      {openPanel === 'stats'        && <CommunityStats onClose={() => setOpenPanel(null)} />}
    </div>
  )
}
